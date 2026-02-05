# 2.2 Наследование

## Краткое резюме

> **Наследование** — механизм создания класса на основе другого (extends). Дочерний класс наследует свойства и методы родителя.
>
> **Ключевые концепции:** переопределение методов (override), parent::__construct(), final (запрет наследования/переопределения), abstract (абстрактные классы и методы).
>
> **Важно:** PHP поддерживает только одиночное наследование. Для множественного поведения используй Трейты или Интерфейсы.

---

## Содержание

- [Что такое наследование](#что-такое-наследование)
- [Переопределение методов (Override)](#переопределение-методов-override)
- [parent::__construct()](#parent__construct)
- [final (запрет наследования/переопределения)](#final-запрет-наследованияпереопределения)
- [abstract (абстрактные классы)](#abstract-абстрактные-классы)
- [Множественное наследование (НЕТ в PHP)](#множественное-наследование-нет-в-php)
- [Резюме](#резюме-наследования)
- [Практические задания](#практические-задания)

---

## Что такое наследование

**Что это:**
Механизм, позволяющий создать класс на основе другого класса, наследуя его свойства и методы.

**Как работает:**
```php
class Animal
{
    protected string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function eat(): string
    {
        return "{$this->name} ест";
    }
}

class Dog extends Animal
{
    public function bark(): string
    {
        return "{$this->name} лает: Гав!";
    }
}

class Cat extends Animal
{
    public function meow(): string
    {
        return "{$this->name} мяукает: Мяу!";
    }
}

$dog = new Dog('Шарик');
echo $dog->eat();   // "Шарик ест" (унаследовано от Animal)
echo $dog->bark();  // "Шарик лает: Гав!" (собственный метод)

$cat = new Cat('Мурка');
echo $cat->eat();   // "Мурка ест" (унаследовано)
echo $cat->meow();  // "Мурка мяукает: Мяу!"
```

**Когда использовать:**
Когда классы имеют общую функциональность (IS-A отношение: Dog IS-A Animal).

**Пример из практики:**
```php
// Базовый контроллер в Laravel
class Controller
{
    protected function respondWithSuccess(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $data], $status);
    }

    protected function respondWithError(string $message, int $status = 400): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $message], $status);
    }
}

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();
        return $this->respondWithSuccess($users);  // Используем метод родителя
    }

    public function store(Request $request)
    {
        $validated = $request->validate([...]);

        try {
            $user = User::create($validated);
            return $this->respondWithSuccess($user, 201);
        } catch (\Exception $e) {
            return $this->respondWithError($e->getMessage(), 500);
        }
    }
}

// Eloquent Model
class Post extends Model  // Наследует от Model
{
    protected $fillable = ['title', 'content'];

    // Получаем все методы Model: find(), create(), update(), delete()
    // + можем добавить свои
    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
```

**На собеседовании скажешь:**
> "Наследование через extends. Дочерний класс получает свойства и методы родителя. В Laravel все модели наследуются от Model, контроллеры от Controller. Использую для IS-A отношений."

---

## Переопределение методов (Override)

**Что это:**
Возможность изменить поведение метода родителя в дочернем классе.

**Как работает:**
```php
class Animal
{
    public function makeSound(): string
    {
        return "Какой-то звук";
    }
}

class Dog extends Animal
{
    // Переопределяем метод
    public function makeSound(): string
    {
        return "Гав!";
    }
}

class Cat extends Animal
{
    public function makeSound(): string
    {
        return "Мяу!";
    }
}

$dog = new Dog();
echo $dog->makeSound();  // "Гав!" (переопределённый метод)

$cat = new Cat();
echo $cat->makeSound();  // "Мяу!"
```

**Когда использовать:**
Когда нужно изменить или расширить поведение родительского метода.

**Пример из практики:**
```php
// Eloquent Model с переопределением save()
class Post extends Model
{
    public function save(array $options = [])
    {
        // Дополнительная логика перед сохранением
        if (empty($this->slug)) {
            $this->slug = Str::slug($this->title);
        }

        // Вызов родительского метода
        return parent::save($options);
    }
}

// API Resource с переопределением toArray()
class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'created_at' => $this->created_at->toDateTimeString(),
            // Добавляем дополнительные поля
            'posts_count' => $this->posts->count(),
        ];
    }
}

// FormRequest с переопределением rules()
class StorePostRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => 'required|max:255',
            'content' => 'required',
            'category_id' => 'required|exists:categories,id',
        ];
    }

    // Можем переопределить messages()
    public function messages(): array
    {
        return [
            'title.required' => 'Заголовок обязателен',
            'content.required' => 'Содержимое обязательно',
        ];
    }
}
```

**На собеседовании скажешь:**
> "Переопределение — изменение метода родителя в дочернем классе. parent::method() вызывает родительский метод. В Laravel переопределяю save() в моделях, toArray() в Resources, rules() в FormRequests."

---

## parent::__construct()

**Что это:**
Вызов конструктора родительского класса из дочернего.

**Как работает:**
```php
class Animal
{
    protected string $name;
    protected int $age;

    public function __construct(string $name, int $age)
    {
        $this->name = $name;
        $this->age = $age;
    }
}

class Dog extends Animal
{
    private string $breed;

    public function __construct(string $name, int $age, string $breed)
    {
        parent::__construct($name, $age);  // Вызов родительского конструктора
        $this->breed = $breed;
    }

    public function getInfo(): string
    {
        return "{$this->name}, {$this->age} лет, порода: {$this->breed}";
    }
}

$dog = new Dog('Шарик', 3, 'Лабрадор');
echo $dog->getInfo();  // "Шарик, 3 лет, порода: Лабрадор"
```

**Когда использовать:**
**Всегда** вызывай `parent::__construct()`, если у родителя есть конструктор.

**Пример из практики:**
```php
// Service с базовыми зависимостями
class BaseService
{
    public function __construct(
        protected LoggerInterface $logger,
    ) {}
}

class OrderService extends BaseService
{
    public function __construct(
        LoggerInterface $logger,
        private OrderRepository $repository,
        private PaymentGateway $gateway,
    ) {
        parent::__construct($logger);  // Передаём logger родителю
    }

    public function create(array $data): Order
    {
        $this->logger->info('Creating order', $data);
        $order = $this->repository->create($data);
        $this->gateway->charge($order->amount);

        return $order;
    }
}

// Eloquent Model
class Post extends Model
{
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        // Дополнительная инициализация
        $this->perPage = 20;
    }
}

// Exception
class OrderException extends Exception
{
    public function __construct(
        string $message,
        private Order $order,
        int $code = 0,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }

    public function getOrder(): Order
    {
        return $this->order;
    }
}

throw new OrderException('Payment failed', $order);
```

**На собеседовании скажешь:**
> "parent::__construct() вызывает конструктор родителя. Всегда вызываю, если у родителя есть конструктор. Используется для инициализации базовых свойств, затем добавляю свои."

---

## final (запрет наследования/переопределения)

**Что это:**
Ключевое слово, запрещающее наследование класса или переопределение метода.

**Как работает:**
```php
// final класс — нельзя наследовать
final class Money
{
    public function __construct(
        private int $amount,
        private string $currency,
    ) {}

    public function getAmount(): int
    {
        return $this->amount;
    }
}

class Euro extends Money {}  // ❌ Fatal error: Cannot extend final class Money

// final метод — нельзя переопределить
class Animal
{
    final public function getId(): int
    {
        return $this->id;
    }

    public function makeSound(): string
    {
        return "Sound";
    }
}

class Dog extends Animal
{
    public function getId(): int  // ❌ Fatal error: Cannot override final method
    {
        return 123;
    }

    public function makeSound(): string  // ✅ OK (метод не final)
    {
        return "Гав!";
    }
}
```

**Когда использовать:**
- `final class` — для Value Objects, где наследование не имеет смысла
- `final method` — для критичных методов, которые нельзя изменять

**Пример из практики:**
```php
// Value Object — не должен наследоваться
final class Email
{
    private string $value;

    public function __construct(string $email)
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email');
        }

        $this->value = $email;
    }

    public function getValue(): string
    {
        return $this->value;
    }
}

// DTO — не должен наследоваться
final class CreateUserDTO
{
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly string $password,
    ) {}
}

// Критичный метод, который нельзя переопределить
class Model
{
    final public function save(): bool
    {
        // Критичная логика сохранения
        // Нельзя изменить в наследниках
        return $this->performSave();
    }

    protected function performSave(): bool
    {
        // Можно переопределить в наследниках
        return true;
    }
}

// Laravel Middleware
final class Authenticate
{
    public function handle($request, Closure $next)
    {
        // Логика аутентификации
        return $next($request);
    }
}
```

**На собеседовании скажешь:**
> "final class запрещает наследование, final method — переопределение. Использую для Value Objects (Email, Money), DTO, критичных методов. В Laravel некоторые классы final (например, некоторые middleware)."

---

## abstract (абстрактные классы)

**Что это:**
Класс, который нельзя создать напрямую (только наследовать), может содержать абстрактные методы (без реализации).

**Как работает:**
```php
abstract class Shape
{
    protected string $color;

    public function __construct(string $color)
    {
        $this->color = $color;
    }

    // Абстрактный метод (без реализации)
    abstract public function calculateArea(): float;

    // Обычный метод (с реализацией)
    public function getColor(): string
    {
        return $this->color;
    }
}

class Circle extends Shape
{
    public function __construct(
        string $color,
        private float $radius,
    ) {
        parent::__construct($color);
    }

    // ОБЯЗАТЕЛЬНО реализовать
    public function calculateArea(): float
    {
        return pi() * $this->radius ** 2;
    }
}

class Rectangle extends Shape
{
    public function __construct(
        string $color,
        private float $width,
        private float $height,
    ) {
        parent::__construct($color);
    }

    public function calculateArea(): float
    {
        return $this->width * $this->height;
    }
}

// $shape = new Shape('red');  // ❌ Cannot instantiate abstract class

$circle = new Circle('red', 5);
echo $circle->calculateArea();  // 78.54

$rectangle = new Rectangle('blue', 4, 6);
echo $rectangle->calculateArea();  // 24
```

**Когда использовать:**
Когда есть общая логика, но часть методов должна быть реализована в наследниках.

**Пример из практики:**
```php
// Базовый репозиторий
abstract class BaseRepository
{
    public function __construct(
        protected Model $model,
    ) {}

    public function find(int $id): ?Model
    {
        return $this->model->find($id);
    }

    public function all(): Collection
    {
        return $this->model->all();
    }

    // Каждый репозиторий должен реализовать свои критерии поиска
    abstract public function findByCustomCriteria(array $criteria): Collection;
}

class UserRepository extends BaseRepository
{
    public function __construct()
    {
        parent::__construct(new User());
    }

    public function findByCustomCriteria(array $criteria): Collection
    {
        $query = $this->model->query();

        if (isset($criteria['department_id'])) {
            $query->where('department_id', $criteria['department_id']);
        }

        if (isset($criteria['is_active'])) {
            $query->where('is_active', $criteria['is_active']);
        }

        return $query->get();
    }
}

// Payment Gateway
abstract class PaymentGateway
{
    abstract public function charge(int $amount, string $currency): bool;
    abstract public function refund(string $transactionId, int $amount): bool;

    protected function logTransaction(string $type, int $amount): void
    {
        // Общая логика логирования
        Log::info("Payment {$type}: {$amount}");
    }
}

class StripeGateway extends PaymentGateway
{
    public function charge(int $amount, string $currency): bool
    {
        $this->logTransaction('charge', $amount);
        // Stripe API logic
        return true;
    }

    public function refund(string $transactionId, int $amount): bool
    {
        $this->logTransaction('refund', $amount);
        // Stripe API logic
        return true;
    }
}
```

**На собеседовании скажешь:**
> "abstract class — нельзя создать напрямую, только наследовать. Может содержать abstract методы (без реализации) — наследники обязаны реализовать. Использую для базовых классов с общей логикой, где часть методов реализуется в наследниках."

---

## Множественное наследование (НЕТ в PHP)

**Что это:**
PHP НЕ поддерживает множественное наследование (один класс не может наследовать от нескольких).

**Как работает:**
```php
class A {}
class B {}

class C extends A, B {}  // ❌ Syntax error

// Вместо множественного наследования используем:

// 1. Интерфейсы (можно реализовать несколько)
interface Flyable
{
    public function fly(): string;
}

interface Swimmable
{
    public function swim(): string;
}

class Duck implements Flyable, Swimmable
{
    public function fly(): string
    {
        return "Утка летит";
    }

    public function swim(): string
    {
        return "Утка плывёт";
    }
}

// 2. Трейты (можно использовать несколько)
trait Flyable
{
    public function fly(): string
    {
        return "Летит";
    }
}

trait Swimmable
{
    public function swim(): string
    {
        return "Плывёт";
    }
}

class Duck
{
    use Flyable, Swimmable;
}

$duck = new Duck();
echo $duck->fly();   // "Летит"
echo $duck->swim();  // "Плывёт"
```

**Когда использовать:**
Для композиции поведения используй **Трейты** (подробнее в теме 2.5).

**Пример из практики:**
```php
// Laravel Model с трейтами
class Post extends Model
{
    use HasFactory;      // Фабрики для тестов
    use SoftDeletes;     // Мягкое удаление
    use Notifiable;      // Уведомления
    use HasUuid;         // UUID вместо ID

    // Получаем методы из всех трейтов
}

// Множественное поведение через traits
trait Loggable
{
    public function log(string $message): void
    {
        Log::info($message);
    }
}

trait Cacheable
{
    public function cache(string $key, mixed $value): void
    {
        Cache::put($key, $value, 3600);
    }
}

class UserService
{
    use Loggable, Cacheable;

    public function process(User $user): void
    {
        $this->log("Processing user {$user->id}");
        $this->cache("user:{$user->id}", $user);
    }
}
```

**На собеседовании скажешь:**
> "PHP НЕ поддерживает множественное наследование. Вместо этого: интерфейсы (можно несколько) или трейты (можно несколько). Трейты — горизонтальное переиспользование кода без наследования."

---

## Резюме наследования

**Основное:**
- `extends` — наследование от одного класса
- Дочерний класс наследует свойства и методы родителя
- Переопределение методов (override) — изменить поведение родительского метода
- `parent::method()` — вызов метода родителя
- `parent::__construct()` — всегда вызывай, если у родителя есть конструктор
- `final class` — запрет наследования
- `final method` — запрет переопределения
- `abstract class` — нельзя создать, только наследовать
- `abstract method` — без реализации, наследники обязаны реализовать
- Множественное наследование НЕТ → используй Трейты или Интерфейсы

**Важно на собесе:**
- PHP — одиночное наследование (только один родитель)
- `abstract` методы обязательно реализовать в наследниках
- `final` использую для Value Objects и критичных методов
- Для композиции поведения — Трейты
- В Laravel: Model, Controller, Middleware наследуются от базовых классов

---

## Практические задания

### Задание 1: Базовый контроллер с общими методами

Создай базовый `Controller` с методами `success()` и `error()` для API ответов. Затем создай `UserController`, который наследует от `Controller`.

<details>
<summary>Решение</summary>

```php
abstract class Controller
{
    // Общие методы для всех контроллеров
    protected function success(mixed $data, string $message = 'Success', int $status = 200): array
    {
        return [
            'status' => 'success',
            'message' => $message,
            'data' => $data,
            'code' => $status,
        ];
    }

    protected function error(string $message, int $status = 400, ?array $errors = null): array
    {
        $response = [
            'status' => 'error',
            'message' => $message,
            'code' => $status,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return $response;
    }

    protected function paginate(array $items, int $total, int $page, int $perPage): array
    {
        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => (int) ceil($total / $perPage),
        ];
    }

    // Абстрактный метод — каждый контроллер реализует сам
    abstract protected function authorize(string $action): bool;
}

class UserController extends Controller
{
    public function index(): array
    {
        if (!$this->authorize('view')) {
            return $this->error('Unauthorized', 403);
        }

        $users = [
            ['id' => 1, 'name' => 'Иван'],
            ['id' => 2, 'name' => 'Пётр'],
        ];

        return $this->success($users, 'Users retrieved');
    }

    public function store(array $data): array
    {
        if (!$this->authorize('create')) {
            return $this->error('Unauthorized', 403);
        }

        // Валидация
        if (empty($data['name'])) {
            return $this->error('Validation failed', 422, [
                'name' => ['Name is required']
            ]);
        }

        $user = ['id' => 3, 'name' => $data['name']];
        return $this->success($user, 'User created', 201);
    }

    protected function authorize(string $action): bool
    {
        // Логика авторизации для пользователей
        return true;  // Упрощённо
    }
}

// Использование
$controller = new UserController();
print_r($controller->index());
// [
//   'status' => 'success',
//   'message' => 'Users retrieved',
//   'data' => [['id' => 1, 'name' => 'Иван'], ...]
// ]
```
</details>

### Задание 2: Иерархия моделей с общей логикой

Создай абстрактный класс `Model` с методами `save()`, `delete()`. Затем создай `Post` и `User` наследников.

<details>
<summary>Решение</summary>

```php
abstract class Model
{
    protected array $attributes = [];
    protected array $original = [];
    protected bool $exists = false;

    abstract protected static function getTable(): string;
    abstract protected static function getFillable(): array;

    public function __get(string $key): mixed
    {
        return $this->attributes[$key] ?? null;
    }

    public function __set(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function fill(array $data): static
    {
        $fillable = static::getFillable();

        foreach ($data as $key => $value) {
            if (in_array($key, $fillable)) {
                $this->attributes[$key] = $value;
            }
        }

        return $this;
    }

    public function save(): bool
    {
        $table = static::getTable();

        if ($this->exists) {
            echo "UPDATE {$table} SET ... WHERE id = {$this->id}\n";
        } else {
            echo "INSERT INTO {$table} (...) VALUES (...)\n";
            $this->exists = true;
        }

        $this->original = $this->attributes;
        return true;
    }

    public function delete(): bool
    {
        if (!$this->exists) {
            return false;
        }

        $table = static::getTable();
        echo "DELETE FROM {$table} WHERE id = {$this->id}\n";
        $this->exists = false;

        return true;
    }

    public static function find(int $id): ?static
    {
        $table = static::getTable();
        echo "SELECT * FROM {$table} WHERE id = {$id}\n";

        $instance = new static();
        $instance->attributes = ['id' => $id];
        $instance->exists = true;
        $instance->original = $instance->attributes;

        return $instance;
    }

    public function getDirty(): array
    {
        $dirty = [];

        foreach ($this->attributes as $key => $value) {
            if (!isset($this->original[$key]) || $this->original[$key] !== $value) {
                $dirty[$key] = $value;
            }
        }

        return $dirty;
    }
}

class Post extends Model
{
    protected static function getTable(): string
    {
        return 'posts';
    }

    protected static function getFillable(): array
    {
        return ['title', 'content', 'author_id'];
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}

class User extends Model
{
    protected static function getTable(): string
    {
        return 'users';
    }

    protected static function getFillable(): array
    {
        return ['name', 'email'];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}

// Использование
$post = new Post();
$post->fill(['title' => 'My Post', 'content' => 'Content']);
$post->save();  // INSERT INTO posts

$user = User::find(1);  // SELECT * FROM users WHERE id = 1
$user->name = 'Новое имя';
print_r($user->getDirty());  // ['name' => 'Новое имя']
$user->save();  // UPDATE users
```
</details>

### Задание 3: final класс и переопределение методов

Создай `Shape` с методом `calculateArea()` (можно переопределить) и `getColor()` (final, нельзя переопределить).

<details>
<summary>Решение</summary>

```php
abstract class Shape
{
    public function __construct(
        protected string $color,
    ) {}

    // final — нельзя переопределить в наследниках
    final public function getColor(): string
    {
        return $this->color;
    }

    final public function describe(): string
    {
        return sprintf(
            "%s %s (Area: %.2f, Perimeter: %.2f)",
            ucfirst($this->color),
            static::class,
            $this->calculateArea(),
            $this->calculatePerimeter()
        );
    }

    // Абстрактные методы — наследники ОБЯЗАНЫ реализовать
    abstract public function calculateArea(): float;
    abstract public function calculatePerimeter(): float;
}

class Circle extends Shape
{
    public function __construct(
        string $color,
        private float $radius,
    ) {
        parent::__construct($color);
    }

    public function calculateArea(): float
    {
        return pi() * $this->radius ** 2;
    }

    public function calculatePerimeter(): float
    {
        return 2 * pi() * $this->radius;
    }

    // ❌ Нельзя переопределить final метод
    // public function getColor(): string
    // {
    //     return "Circle color: {$this->color}";
    // }
}

class Rectangle extends Shape
{
    public function __construct(
        string $color,
        private float $width,
        private float $height,
    ) {
        parent::__construct($color);
    }

    public function calculateArea(): float
    {
        return $this->width * $this->height;
    }

    public function calculatePerimeter(): float
    {
        return 2 * ($this->width + $this->height);
    }

    public function getDimensions(): array
    {
        return [
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}

// final класс — нельзя наследовать
final class Square extends Rectangle
{
    public function __construct(string $color, float $size)
    {
        parent::__construct($color, $size, $size);
    }
}

// ❌ Нельзя наследовать от final класса
// class SmallSquare extends Square {}

// Использование
$circle = new Circle('red', 5);
echo $circle->describe();
// Red Circle (Area: 78.54, Perimeter: 31.42)

$rectangle = new Rectangle('blue', 4, 6);
echo $rectangle->describe();
// Blue Rectangle (Area: 24.00, Perimeter: 20.00)

$square = new Square('green', 5);
echo $square->describe();
// Green Square (Area: 25.00, Perimeter: 20.00)
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
