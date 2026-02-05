# 2.7 Статическое связывание (Late Static Binding)

## Краткое резюме

> **Late Static Binding** — механизм, позволяющий обращаться к вызывающему классу (static) вместо класса определения (self).
>
> **Ключевые концепции:** self (класс определения), static (класс вызова), new static (экземпляр вызывающего), static::class (имя класса).
>
> **Важно:** Eloquent использует static для возврата правильного типа из find(), all(). static::boot() + parent::boot() для расширения логики.

---

## Содержание

- [self vs static](#self-vs-static)
- [static:: в методах](#static-в-методах)
- [new static vs new self](#new-static-vs-new-self)
- [parent:: с static](#parent-с-static)
- [get_called_class() (устарела в PHP 8.0)](#get_called_class-устарела-в-php-80)
- [Проблемы с Late Static Binding](#проблемы-с-late-static-binding)
- [Резюме](#резюме-статического-связывания)
- [Практические задания](#практические-задания)

---

## self vs static

**Что это:**
`self` ссылается на класс, где метод определён. `static` — на класс, где метод вызван (позднее связывание).

**Как работает:**
```php
class Animal
{
    public static function getClass(): string
    {
        return self::class;  // Animal (класс, где определён)
    }

    public static function getCalledClass(): string
    {
        return static::class;  // Класс, который вызвал (Late Static Binding)
    }
}

class Dog extends Animal {}

echo Animal::getClass();  // "Animal"
echo Dog::getClass();     // "Animal" (self — всегда Animal)

echo Animal::getCalledClass();  // "Animal"
echo Dog::getCalledClass();     // "Dog" (static — класс вызова)
```

**Когда использовать:**
`static` для методов, которые должны работать с вызывающим классом (фабрики, Active Record).

**Пример из практики:**
```php
// Eloquent Model (упрощённо)
class Model
{
    public static function find(int $id): ?static
    {
        $class = static::class;  // Получить вызывающий класс
        // SELECT * FROM {table} WHERE id = {$id}
        return new $class;  // Вернуть экземпляр вызывающего класса
    }

    public static function all(): Collection
    {
        $class = static::class;
        // SELECT * FROM {table}
        return collect([new $class, new $class]);
    }
}

class User extends Model {}
class Post extends Model {}

$user = User::find(1);  // Вернёт User (не Model!)
// static::class = User::class

$post = Post::find(1);  // Вернёт Post (не Model!)
// static::class = Post::class

// С self было бы:
class ModelBad
{
    public static function find(int $id): ?self
    {
        return new self;  // Всегда Model (не то, что нужно!)
    }
}

$user = User::find(1);  // Вернёт Model (не User!) ❌
```

**На собеседовании скажешь:**
> "self ссылается на класс, где определён метод. static — на вызывающий класс (Late Static Binding). Eloquent использует static для возврата правильного типа из find(), all(). static позволяет наследникам переопределять поведение."

---

## static:: в методах

**Что это:**
Вызов статических методов вызывающего класса через `static::`.

**Как работает:**
```php
class Model
{
    protected static string $table;

    public static function getTable(): string
    {
        return static::$table;  // Берёт $table из вызывающего класса
    }

    public static function all(): array
    {
        $table = static::getTable();  // Вызов метода вызывающего класса
        return DB::select("SELECT * FROM {$table}");
    }
}

class User extends Model
{
    protected static string $table = 'users';
}

class Post extends Model
{
    protected static string $table = 'posts';
}

echo User::getTable();  // "users" (static::$table из User)
echo Post::getTable();  // "posts" (static::$table из Post)

$users = User::all();  // SELECT * FROM users
$posts = Post::all();  // SELECT * FROM posts
```

**Когда использовать:**
Для вызова методов/свойств наследников из базового класса.

**Пример из практики:**
```php
// Active Record pattern
abstract class ActiveRecord
{
    protected static string $table;
    protected static string $primaryKey = 'id';

    public static function find(int $id): ?static
    {
        $table = static::$table;
        $pk = static::$primaryKey;

        $data = DB::selectOne("SELECT * FROM {$table} WHERE {$pk} = ?", [$id]);

        if ($data === null) {
            return null;
        }

        return static::hydrate($data);  // Создать объект вызывающего класса
    }

    protected static function hydrate(array $data): static
    {
        $instance = new static();  // Создать экземпляр вызывающего класса

        foreach ($data as $key => $value) {
            $instance->$key = $value;
        }

        return $instance;
    }

    public function save(): bool
    {
        $table = static::$table;

        // INSERT или UPDATE
        return true;
    }
}

class User extends ActiveRecord
{
    protected static string $table = 'users';

    public int $id;
    public string $name;
    public string $email;
}

$user = User::find(1);  // Вернёт User (не ActiveRecord)
// static::hydrate создаст new User()
```

**На собеседовании скажешь:**
> "static:: вызывает метод/свойство вызывающего класса. Использую в Active Record, фабриках, базовых классах. static::$property берёт значение из наследника, static::method() вызывает метод наследника."

---

## new static vs new self

**Что это:**
`new self` создаёт экземпляр класса, где метод определён. `new static` — вызывающего класса.

**Как работает:**
```php
class Animal
{
    public static function createSelf(): self
    {
        return new self();  // Всегда Animal
    }

    public static function createStatic(): static
    {
        return new static();  // Класс вызова
    }
}

class Dog extends Animal {}

$animal1 = Animal::createSelf();  // Animal
$animal2 = Animal::createStatic();  // Animal

$dog1 = Dog::createSelf();  // Animal (не Dog!) ❌
$dog2 = Dog::createStatic();  // Dog ✅
```

**Когда использовать:**
`new static` для фабрик, builder'ов, методов создания объектов.

**Пример из практики:**
```php
// Factory method
abstract class Model
{
    public static function make(array $attributes = []): static
    {
        $instance = new static();  // Создать экземпляр вызывающего класса

        foreach ($attributes as $key => $value) {
            $instance->$key = $value;
        }

        return $instance;
    }

    public static function create(array $attributes): static
    {
        $instance = static::make($attributes);
        $instance->save();

        return $instance;
    }
}

class User extends Model
{
    public string $name;
    public string $email;

    public function save(): void
    {
        // Сохранение в БД
    }
}

$user = User::make(['name' => 'Иван', 'email' => 'ivan@mail.com']);
// $user — это User (не Model)

$user = User::create(['name' => 'Пётр', 'email' => 'petr@mail.com']);
// Создаст и сохранит User

// Builder pattern
class QueryBuilder
{
    protected array $wheres = [];

    public function where(string $column, mixed $value): static
    {
        $this->wheres[$column] = $value;
        return $this;  // Fluent interface
    }

    public function clone(): static
    {
        return clone $this;  // Клонировать с правильным типом
    }
}

class UserQueryBuilder extends QueryBuilder
{
    public function active(): static
    {
        return $this->where('is_active', true);
    }
}

$query = new UserQueryBuilder();
$activeUsers = $query->active()->where('department_id', 5);
// Все методы возвращают UserQueryBuilder (не QueryBuilder)
```

**На собеседовании скажешь:**
> "new self создаёт экземпляр класса, где определён. new static — вызывающего класса. Использую new static для фабрик, builder'ов. Eloquent::make(), Eloquent::create() используют new static."

---

## parent:: с static

**Что это:**
Комбинация вызова родительского метода с Late Static Binding.

**Как работает:**
```php
class Model
{
    public static function boot(): void
    {
        echo "Model booted\n";
    }

    public static function initialize(): void
    {
        static::boot();  // Вызовет boot() вызывающего класса
    }
}

class User extends Model
{
    public static function boot(): void
    {
        parent::boot();  // Вызов родительского boot()
        echo "User booted\n";
    }
}

User::initialize();
// Model booted
// User booted

// Без parent::
class PostBad extends Model
{
    public static function boot(): void
    {
        // Не вызвали parent::boot() — логика родителя пропущена!
        echo "Post booted\n";
    }
}

PostBad::initialize();
// Post booted (Model booted не выполнился!)
```

**Когда использовать:**
Для расширения логики родителя в наследниках.

**Пример из практики:**
```php
// Eloquent Model boot
abstract class Model
{
    protected static function boot(): void
    {
        static::bootTraits();  // Загрузить traits

        // Базовая логика
    }

    protected static function bootTraits(): void
    {
        foreach (class_uses_recursive(static::class) as $trait) {
            $method = 'boot' . class_basename($trait);

            if (method_exists(static::class, $method)) {
                static::$method();
            }
        }
    }
}

trait SoftDeletes
{
    protected static function bootSoftDeletes(): void
    {
        static::addGlobalScope('soft_deletes', function ($query) {
            $query->whereNull('deleted_at');
        });
    }
}

class Post extends Model
{
    use SoftDeletes;

    protected static function boot(): void
    {
        parent::boot();  // ВАЖНО: вызвать родительский boot

        static::creating(function ($post) {
            if (empty($post->slug)) {
                $post->slug = Str::slug($post->title);
            }
        });
    }
}

// При вызове Post::boot():
// 1. parent::boot() → Model::boot() → bootTraits() → bootSoftDeletes()
// 2. static::creating() — добавить свою логику
```

**На собеседовании скажешь:**
> "parent::method() вызывает метод родителя, static:: — вызывающего класса. В Eloquent boot() всегда вызываю parent::boot() для загрузки traits. parent + static позволяют расширять логику родителя в наследниках."

---

## get_called_class() (устарела в PHP 8.0)

**Что это:**
Функция, возвращающая имя вызывающего класса. В PHP 8.0+ заменена на `static::class`.

**Как работает:**
```php
class Animal
{
    public static function whoAmI(): string
    {
        // PHP < 8.0
        return get_called_class();

        // PHP 8.0+
        return static::class;  // Предпочтительнее
    }
}

class Dog extends Animal {}

echo Dog::whoAmI();  // "Dog"

// static::class (PHP 8.0+)
class Model
{
    public static function getModelName(): string
    {
        return static::class;  // Короче и читаемее
    }
}

echo User::getModelName();  // "User"
```

**Когда использовать:**
В PHP 8.0+ всегда используй `static::class` вместо `get_called_class()`.

**Пример из практики:**
```php
// Logger
class BaseService
{
    protected function log(string $message): void
    {
        $class = static::class;  // Класс, который вызвал
        Log::info("[{$class}] {$message}");
    }
}

class OrderService extends BaseService
{
    public function process(): void
    {
        $this->log('Processing order');
        // [OrderService] Processing order
    }
}

class UserService extends BaseService
{
    public function process(): void
    {
        $this->log('Processing user');
        // [UserService] Processing user
    }
}

// Routing
class Controller
{
    public function getRoute(): string
    {
        $class = static::class;
        $shortName = class_basename($class);  // UserController → UserController
        $route = Str::snake(str_replace('Controller', '', $shortName));

        return "/{$route}";
    }
}

class UserController extends Controller {}

echo (new UserController())->getRoute();  // "/user"
```

**На собеседовании скажешь:**
> "get_called_class() возвращает имя вызывающего класса (устарела в PHP 8.0). Используй static::class вместо неё. static::class возвращает полное имя класса с namespace."

---

## Проблемы с Late Static Binding

**Что это:**
Late Static Binding может привести к неожиданному поведению, если не понимать, как работает.

**Проблемы:**
```php
// Проблема 1: статические свойства не наследуются правильно
class Model
{
    protected static array $instances = [];

    public static function register(): void
    {
        static::$instances[] = new static();
    }

    public static function getInstances(): array
    {
        return static::$instances;
    }
}

class User extends Model {}
class Post extends Model {}

User::register();
User::register();
Post::register();

// Ожидаем: User — 2, Post — 1
// Реальность: все в одном массиве Model::$instances
var_dump(User::getInstances());  // 3 элемента (User, User, Post) ❌

// Решение: каждый класс должен объявить своё свойство
class UserFixed extends Model
{
    protected static array $instances = [];
}

class PostFixed extends Model
{
    protected static array $instances = [];
}

// Проблема 2: сложность отладки
class Base
{
    public static function who(): string
    {
        return static::class;  // Зависит от контекста вызова
    }
}

class Child extends Base
{
    public static function test(): string
    {
        return parent::who();  // Какой класс вернёт?
    }
}

echo Child::test();  // "Child" (Late Static Binding работает даже через parent)
```

**Когда использовать:**
Используй осторожно, документируй поведение. Предпочитай композицию наследованию.

**Пример из практики:**
```php
// Правильное использование: Eloquent Model
abstract class Model
{
    // Каждый наследник должен определить свою таблицу
    abstract protected static function getTable(): string;

    public static function all(): Collection
    {
        $table = static::getTable();  // Вызовет метод наследника
        return DB::table($table)->get();
    }
}

class User extends Model
{
    protected static function getTable(): string
    {
        return 'users';
    }
}

$users = User::all();  // SELECT * FROM users

// Неправильное использование: сложная иерархия
class A
{
    public static function test(): string
    {
        return static::getClass();
    }

    protected static function getClass(): string
    {
        return self::class;
    }
}

class B extends A
{
    protected static function getClass(): string
    {
        return parent::getClass() . ' -> ' . static::class;
    }
}

class C extends B {}

echo C::test();  // "A -> C" (сложно отследить логику) ❌
```

**На собеседовании скажешь:**
> "Late Static Binding может усложнить отладку. Статические свойства нужно переопределять в каждом наследнике. Использую осторожно, документирую. Предпочитаю композицию наследованию для сложных случаев."

---

## Резюме статического связывания

**Основное:**
- `self` — класс, где метод определён
- `static` — класс, который вызвал (Late Static Binding)
- `new self` — создаёт экземпляр класса определения
- `new static` — создаёт экземпляр вызывающего класса
- `static::` — вызов метода/свойства вызывающего класса
- `parent::` + `static` — расширение логики родителя
- `static::class` — имя вызывающего класса (PHP 8.0+)

**self vs static:**
| self | static |
|------|--------|
| Класс определения | Класс вызова |
| Раннее связывание | Позднее связывание |
| Не переопределяется | Переопределяется в наследниках |

**Важно на собесе:**
- Eloquent использует `static` для возврата правильного типа из find(), all()
- `new static` для фабрик и builder'ов
- `static::boot()` + `parent::boot()` для расширения логики
- Осторожно со статическими свойствами (переопределять в каждом наследнике)
- `static::class` вместо `get_called_class()` (PHP 8.0+)

---

## Практические задания

### Задание 1: Active Record с static

Создай базовый `Model` с методами find(), all(), create() используя static для возврата правильного типа.

<details>
<summary>Решение</summary>

```php
abstract class Model
{
    protected array $attributes = [];
    protected static array $instances = [];

    abstract protected static function getTable(): string;

    public static function find(int $id): ?static
    {
        $table = static::getTable();
        echo "SELECT * FROM {$table} WHERE id = {$id}\n";

        // Создаём экземпляр вызывающего класса (User/Post)
        $instance = new static();
        $instance->attributes = ['id' => $id, 'loaded' => true];

        return $instance;
    }

    public static function all(): array
    {
        $table = static::getTable();
        echo "SELECT * FROM {$table}\n";

        return [
            static::make(['id' => 1]),
            static::make(['id' => 2]),
        ];
    }

    public static function make(array $attributes = []): static
    {
        $instance = new static();
        $instance->attributes = $attributes;
        return $instance;
    }

    public static function create(array $attributes): static
    {
        $instance = static::make($attributes);
        $instance->save();
        return $instance;
    }

    public function save(): bool
    {
        $table = static::getTable();

        if (isset($this->attributes['id'])) {
            echo "UPDATE {$table} SET ... WHERE id = {$this->attributes['id']}\n";
        } else {
            $this->attributes['id'] = rand(1, 1000);
            echo "INSERT INTO {$table} (...) VALUES (...)\n";
        }

        return true;
    }

    public function __get($key)
    {
        return $this->attributes[$key] ?? null;
    }

    public function __set($key, $value)
    {
        $this->attributes[$key] = $value;
    }
}

class User extends Model
{
    protected static function getTable(): string
    {
        return 'users';
    }
}

class Post extends Model
{
    protected static function getTable(): string
    {
        return 'posts';
    }
}

// Использование
$user = User::find(1);  // Вернёт User (не Model!)
// SELECT * FROM users WHERE id = 1
var_dump($user instanceof User);  // true

$post = Post::find(1);  // Вернёт Post (не Model!)
// SELECT * FROM posts WHERE id = 1
var_dump($post instanceof Post);  // true

$users = User::all();  // Массив User объектов
// SELECT * FROM users
var_dump($users[0] instanceof User);  // true

$newUser = User::create(['name' => 'Иван']);
// INSERT INTO users (...) VALUES (...)
```
</details>

### Задание 2: Factory Pattern с new static

Создай базовый `Factory` класс, который использует new static для создания экземпляров.

<details>
<summary>Решение</summary>

```php
abstract class Factory
{
    protected array $attributes = [];

    public static function new(array $attributes = []): static
    {
        $instance = new static();
        $instance->attributes = $attributes;
        return $instance;
    }

    public function state(string $name): static
    {
        $method = "state" . ucfirst($name);

        if (!method_exists($this, $method)) {
            throw new \Exception("State {$name} does not exist");
        }

        $this->$method();
        return $this;
    }

    public function make(): object
    {
        return $this->createInstance();
    }

    public function create(): object
    {
        $instance = $this->make();
        echo "Saving to database...\n";
        return $instance;
    }

    abstract protected function createInstance(): object;
}

class UserFactory extends Factory
{
    protected function createInstance(): object
    {
        $user = new \stdClass();
        $user->name = $this->attributes['name'] ?? 'John Doe';
        $user->email = $this->attributes['email'] ?? 'john@example.com';
        $user->is_admin = $this->attributes['is_admin'] ?? false;
        return $user;
    }

    protected function stateAdmin(): void
    {
        $this->attributes['is_admin'] = true;
        $this->attributes['email'] = $this->attributes['email'] ?? 'admin@example.com';
    }

    protected function stateActive(): void
    {
        $this->attributes['is_active'] = true;
    }
}

class PostFactory extends Factory
{
    protected function createInstance(): object
    {
        $post = new \stdClass();
        $post->title = $this->attributes['title'] ?? 'Default Title';
        $post->content = $this->attributes['content'] ?? 'Default content';
        $post->published = $this->attributes['published'] ?? false;
        return $post;
    }

    protected function statePublished(): void
    {
        $this->attributes['published'] = true;
        $this->attributes['published_at'] = date('Y-m-d H:i:s');
    }

    protected function stateDraft(): void
    {
        $this->attributes['published'] = false;
        $this->attributes['published_at'] = null;
    }
}

// Использование
$user = UserFactory::new(['name' => 'Иван'])->make();
print_r($user);  // stdClass {name: "Иван", email: "john@example.com", ...}

$admin = UserFactory::new()->state('admin')->make();
print_r($admin);  // stdClass {is_admin: true, email: "admin@example.com"}

$activeAdmin = UserFactory::new()
    ->state('admin')
    ->state('active')
    ->create();  // Saving to database...

$publishedPost = PostFactory::new(['title' => 'My Post'])
    ->state('published')
    ->make();
print_r($publishedPost);
// stdClass {title: "My Post", published: true, published_at: "2024-..."}
```
</details>

### Задание 3: Boot механизм с parent::boot()

Создай систему boot методов, где наследники расширяют логику родителя.

<details>
<summary>Решение</summary>

```php
abstract class Model
{
    protected static array $booted = [];
    protected static array $observers = [];

    public static function boot(): void
    {
        // Проверка, что класс ещё не загружен
        if (isset(static::$booted[static::class])) {
            return;
        }

        echo "Booting " . static::class . "\n";

        // Загрузка трейтов
        static::bootTraits();

        // Отметить как загруженный
        static::$booted[static::class] = true;
    }

    protected static function bootTraits(): void
    {
        foreach (class_uses(static::class) as $trait) {
            $method = 'boot' . class_basename($trait);

            if (method_exists(static::class, $method)) {
                static::$method();
            }
        }
    }

    protected static function observe(string $event, callable $callback): void
    {
        if (!isset(static::$observers[static::class])) {
            static::$observers[static::class] = [];
        }

        static::$observers[static::class][$event][] = $callback;
    }

    protected static function fireEvent(string $event, $model): void
    {
        if (!isset(static::$observers[static::class][$event])) {
            return;
        }

        foreach (static::$observers[static::class][$event] as $callback) {
            $callback($model);
        }
    }

    public function save(): void
    {
        static::fireEvent('saving', $this);
        echo "Saving " . static::class . "\n";
        static::fireEvent('saved', $this);
    }
}

trait SoftDeletes
{
    protected static function bootSoftDeletes(): void
    {
        echo "  - Booting SoftDeletes trait\n";

        static::observe('deleting', function ($model) {
            echo "  - SoftDeletes: Setting deleted_at\n";
        });
    }
}

trait HasUuid
{
    protected static function bootHasUuid(): void
    {
        echo "  - Booting HasUuid trait\n";

        static::observe('creating', function ($model) {
            echo "  - HasUuid: Generating UUID\n";
        });
    }
}

class Post extends Model
{
    use SoftDeletes, HasUuid;

    public static function boot(): void
    {
        parent::boot();  // ВАЖНО: вызвать родительский boot

        echo "  - Custom Post boot logic\n";

        static::observe('saving', function ($post) {
            echo "  - Post: Generating slug\n";
        });
    }
}

class User extends Model
{
    use SoftDeletes;

    public static function boot(): void
    {
        parent::boot();

        echo "  - Custom User boot logic\n";

        static::observe('creating', function ($user) {
            echo "  - User: Hashing password\n";
        });
    }
}

// Использование
Post::boot();
// Booting Post
//   - Booting SoftDeletes trait
//   - Booting HasUuid trait
//   - Custom Post boot logic

echo "\n";

User::boot();
// Booting User
//   - Booting SoftDeletes trait
//   - Custom User boot logic

echo "\n";

$post = new Post();
$post->save();
// - Post: Generating slug
// Saving Post
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
