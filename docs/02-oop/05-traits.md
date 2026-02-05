# 2.5 Трейты (Traits)

## Краткое резюме

> **Trait** — механизм горизонтального переиспользования кода без наследования. Трейт — набор методов, которые можно "вставить" в класс.
>
> **Ключевые концепции:** use (подключение), множественные трейты, разрешение конфликтов (insteadof, as), изменение видимости, абстрактные методы в трейтах.
>
> **Важно:** Решают проблему множественного наследования через композицию. Laravel использует HasFactory, SoftDeletes, Notifiable.

---

## Содержание

- [Что такое трейт](#что-такое-трейт)
- [Несколько трейтов](#несколько-трейтов)
- [Конфликт имён методов](#конфликт-имён-методов)
- [Изменение видимости методов](#изменение-видимости-методов)
- [Трейты с абстрактными методами](#трейты-с-абстрактными-методами)
- [Трейты со свойствами](#трейты-со-свойствами)
- [Трейты в трейтах](#трейты-в-трейтах)
- [Резюме](#резюме-трейтов)
- [Практические задания](#практические-задания)

---

## Что такое трейт

**Что это:**
Механизм горизонтального переиспользования кода. Трейт — это набор методов, которые можно "вставить" в класс.

**Как работает:**
```php
trait Loggable
{
    public function log(string $message): void
    {
        echo "[LOG] {$message}\n";
    }
}

trait Timestampable
{
    public function createdAt(): string
    {
        return date('Y-m-d H:i:s');
    }
}

class User
{
    use Loggable, Timestampable;

    public function register(): void
    {
        $this->log('User registered');
        echo "Created at: " . $this->createdAt();
    }
}

$user = new User();
$user->register();
// [LOG] User registered
// Created at: 2024-01-15 10:30:00
```

**Когда использовать:**
Когда нужно переиспользовать методы в разных классах без наследования.

**Пример из практики:**
```php
// Laravel Model traits
class Post extends Model
{
    use HasFactory;      // Фабрики для тестов
    use SoftDeletes;     // Мягкое удаление
    use Notifiable;      // Уведомления

    // Получаем методы из всех трейтов:
    // - factory()
    // - trashed(), restore(), forceDelete()
    // - notify()
}

// Собственный trait
trait Sluggable
{
    public static function bootSluggable(): void
    {
        static::creating(function ($model) {
            if (empty($model->slug)) {
                $model->slug = Str::slug($model->title);
            }
        });
    }
}

class Post extends Model
{
    use Sluggable;

    // При создании автоматически создастся slug из title
}

$post = Post::create(['title' => 'My Post']);
echo $post->slug;  // "my-post"
```

**На собеседовании скажешь:**
> "Trait — механизм горизонтального переиспользования кода. use Trait в классе добавляет методы трейта. Решает проблему множественного наследования. В Laravel модели используют HasFactory, SoftDeletes, Notifiable."

---

## Несколько трейтов

**Что это:**
Класс может использовать несколько трейтов одновременно.

**Как работает:**
```php
trait Loggable
{
    public function log(string $message): void
    {
        Log::info($message);
    }
}

trait Cacheable
{
    public function cache(string $key, mixed $value, int $ttl = 3600): void
    {
        Cache::put($key, $value, $ttl);
    }

    public function getCached(string $key): mixed
    {
        return Cache::get($key);
    }
}

trait Notifiable
{
    public function notify(string $message): void
    {
        // Отправка уведомления
    }
}

class UserService
{
    use Loggable, Cacheable, Notifiable;

    public function process(User $user): void
    {
        $this->log("Processing user {$user->id}");
        $this->cache("user:{$user->id}", $user);
        $this->notify("User processed");
    }
}
```

**Когда использовать:**
Для композиции поведения из нескольких источников.

**Пример из практики:**
```php
// API Controller с несколькими traits
trait ApiResponse
{
    protected function success(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $data], $status);
    }

    protected function error(string $message, int $status = 400): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $message], $status);
    }
}

trait ValidatesRequests
{
    protected function validateOrFail(array $data, array $rules): array
    {
        return Validator::make($data, $rules)->validate();
    }
}

trait AuthorizesRequests
{
    protected function authorizeOrFail(string $ability, mixed $model): void
    {
        if (!Gate::allows($ability, $model)) {
            abort(403);
        }
    }
}

class PostController extends Controller
{
    use ApiResponse, ValidatesRequests, AuthorizesRequests;

    public function update(Request $request, Post $post)
    {
        $this->authorizeOrFail('update', $post);

        $validated = $this->validateOrFail($request->all(), [
            'title' => 'required|max:255',
            'content' => 'required',
        ]);

        $post->update($validated);

        return $this->success($post);
    }
}
```

**На собеседовании скажешь:**
> "Класс может использовать несколько трейтов через запятую: use A, B, C. Каждый трейт добавляет свои методы. Использую для композиции поведения: ApiResponse + ValidatesRequests + AuthorizesRequests."

---

## Конфликт имён методов

**Что это:**
Если два трейта имеют метод с одинаковым именем — конфликт.

**Как работает:**
```php
trait A
{
    public function greet(): string
    {
        return "Hello from A";
    }
}

trait B
{
    public function greet(): string
    {
        return "Hello from B";
    }
}

class MyClass
{
    use A, B;  // ❌ Fatal error: Trait method greet has not been applied

    // Решение 1: insteadof (выбрать один метод)
    use A, B {
        A::greet insteadof B;  // Использовать метод из A
    }

    // Решение 2: as (создать алиас)
    use A, B {
        A::greet insteadof B;
        B::greet as greetFromB;  // Алиас для метода из B
    }
}

$obj = new MyClass();
echo $obj->greet();         // "Hello from A"
echo $obj->greetFromB();    // "Hello from B"
```

**Когда использовать:**
Для разрешения конфликтов имён при использовании нескольких трейтов.

**Пример из практики:**
```php
trait JsonResponseTrait
{
    protected function respond(mixed $data): JsonResponse
    {
        return response()->json($data);
    }
}

trait XmlResponseTrait
{
    protected function respond(mixed $data): Response
    {
        return response($data)->header('Content-Type', 'application/xml');
    }
}

class ApiController extends Controller
{
    use JsonResponseTrait, XmlResponseTrait {
        JsonResponseTrait::respond insteadof XmlResponseTrait;
        XmlResponseTrait::respond as respondXml;
    }

    public function index()
    {
        $data = ['users' => User::all()];

        if (request()->wantsJson()) {
            return $this->respond($data);  // JSON
        }

        return $this->respondXml($data);  // XML
    }
}
```

**На собеседовании скажешь:**
> "При конфликте имён использую insteadof (выбрать один метод) или as (создать алиас). insteadof A::method исключает метод из другого трейта. as создаёт алиас с другим именем."

---

## Изменение видимости методов

**Что это:**
Можно изменить видимость (public/protected/private) метода трейта через `as`.

**Как работает:**
```php
trait Loggable
{
    public function log(string $message): void
    {
        echo "[LOG] {$message}\n";
    }
}

class Service
{
    use Loggable {
        log as protected;  // Изменить на protected
    }

    public function process(): void
    {
        $this->log('Processing');  // ✅ OK внутри класса
    }
}

$service = new Service();
$service->log('Test');  // ❌ Error: protected method

// Или создать алиас с другой видимостью
class Service2
{
    use Loggable {
        log as protected internalLog;  // protected с алиасом
    }

    public function process(): void
    {
        $this->internalLog('Processing');
    }
}
```

**Когда использовать:**
Для контроля доступа к методам трейта извне класса.

**Пример из практики:**
```php
trait HasApiToken
{
    public function generateToken(): string
    {
        return Str::random(64);
    }

    public function validateToken(string $token): bool
    {
        return $this->api_token === $token;
    }
}

class User extends Model
{
    use HasApiToken {
        generateToken as private;  // Только внутри класса
    }

    public function refreshToken(): void
    {
        $this->api_token = $this->generateToken();  // ✅ OK
        $this->save();
    }
}

$user = User::find(1);
$user->refreshToken();  // ✅ OK (public метод)
$user->generateToken();  // ❌ Error (private)
```

**На собеседовании скажешь:**
> "Через as можно изменить видимость метода трейта: use Trait { method as private }. Использую для сокрытия внутренних методов трейта, оставляя только публичный API класса."

---

## Трейты с абстрактными методами

**Что это:**
Трейт может объявить абстрактный метод — класс обязан его реализовать.

**Как работает:**
```php
trait Cacheable
{
    // Абстрактный метод (класс обязан реализовать)
    abstract protected function getCacheKey(): string;

    public function cache(mixed $value): void
    {
        $key = $this->getCacheKey();  // Использует метод класса
        Cache::put($key, $value, 3600);
    }

    public function getCached(): mixed
    {
        $key = $this->getCacheKey();
        return Cache::get($key);
    }
}

class UserService
{
    use Cacheable;

    private int $userId;

    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }

    // ОБЯЗАТЕЛЬНО реализовать
    protected function getCacheKey(): string
    {
        return "user:{$this->userId}";
    }

    public function getUser(): User
    {
        return $this->getCached() ?? User::find($this->userId);
    }
}
```

**Когда использовать:**
Когда трейт нужны данные из класса, но реализация зависит от конкретного класса.

**Пример из практики:**
```php
trait Sluggable
{
    // Класс должен указать, из какого поля генерить slug
    abstract protected function getSlugSource(): string;

    public static function bootSluggable(): void
    {
        static::creating(function ($model) {
            if (empty($model->slug)) {
                $source = $model->getSlugSource();
                $model->slug = Str::slug($model->{$source});
            }
        });
    }
}

class Post extends Model
{
    use Sluggable;

    protected function getSlugSource(): string
    {
        return 'title';  // Slug из title
    }
}

class Category extends Model
{
    use Sluggable;

    protected function getSlugSource(): string
    {
        return 'name';  // Slug из name
    }
}

// Reposit pattern
trait HasRepository
{
    abstract protected function getModel(): string;  // Класс модели

    public function find(int $id): ?Model
    {
        return $this->getModel()::find($id);
    }

    public function all(): Collection
    {
        return $this->getModel()::all();
    }
}

class UserRepository
{
    use HasRepository;

    protected function getModel(): string
    {
        return User::class;
    }
}
```

**На собеседовании скажешь:**
> "Трейт может объявить abstract метод — класс обязан реализовать. Использую, когда трейту нужны данные из класса (getCacheKey, getSlugSource). Трейт использует абстрактный метод, класс предоставляет реализацию."

---

## Трейты со свойствами

**Что это:**
Трейт может содержать свойства (добавляются в класс).

**Как работает:**
```php
trait Timestampable
{
    protected ?string $createdAt = null;
    protected ?string $updatedAt = null;

    public function setCreatedAt(): void
    {
        $this->createdAt = date('Y-m-d H:i:s');
    }

    public function setUpdatedAt(): void
    {
        $this->updatedAt = date('Y-m-d H:i:s');
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
}

class User
{
    use Timestampable;

    // Свойства $createdAt и $updatedAt добавлены в класс
}

$user = new User();
$user->setCreatedAt();
echo $user->getCreatedAt();  // "2024-01-15 10:30:00"

// ⚠️ Нельзя переопределить свойство с другим типом/видимостью
class Post
{
    use Timestampable;

    public string $createdAt;  // ❌ Fatal error: Cannot redeclare property
}
```

**Когда использовать:**
Для добавления состояния (свойств) вместе с поведением (методами).

**Пример из практики:**
```php
trait HasUuid
{
    protected static function bootHasUuid(): void
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';  // Использовать UUID вместо ID в роутах
    }
}

class Post extends Model
{
    use HasUuid;

    // В миграции: $table->uuid('uuid')->unique();
}

// Route: /posts/{post}
// Вместо /posts/1 будет /posts/550e8400-e29b-41d4-a716-446655440000

// Soft Deletes trait
trait SoftDeletes
{
    protected ?Carbon $deleted_at = null;

    public function delete(): void
    {
        $this->deleted_at = now();
        $this->save();
    }

    public function restore(): void
    {
        $this->deleted_at = null;
        $this->save();
    }

    public function trashed(): bool
    {
        return $this->deleted_at !== null;
    }
}
```

**На собеседовании скажешь:**
> "Трейт может содержать свойства — добавляются в класс. Нельзя переопределить свойство трейта. В Laravel SoftDeletes добавляет $deleted_at, HasUuid добавляет методы для работы с UUID."

---

## Трейты в трейтах

**Что это:**
Трейт может использовать другие трейты.

**Как работает:**
```php
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

trait ServiceHelpers
{
    use Loggable, Cacheable;  // Трейт использует другие трейты

    public function process(string $key, mixed $data): void
    {
        $this->log("Processing {$key}");
        $this->cache($key, $data);
    }
}

class UserService
{
    use ServiceHelpers;  // Получаем методы из всех трейтов

    public function store(User $user): void
    {
        $this->process("user:{$user->id}", $user);
    }
}
```

**Когда использовать:**
Для создания составных трейтов из базовых.

**Пример из практики:**
```php
// Базовые трейты
trait HasSlug
{
    public function generateSlug(string $source): string
    {
        return Str::slug($source);
    }
}

trait HasTimestamps
{
    public function touchTimestamps(): void
    {
        $this->updated_at = now();
    }
}

trait HasUuid
{
    public function generateUuid(): string
    {
        return (string) Str::uuid();
    }
}

// Составной трейт
trait BlogModelHelpers
{
    use HasSlug, HasTimestamps, HasUuid;

    public function prepareForSave(string $title): void
    {
        $this->uuid = $this->generateUuid();
        $this->slug = $this->generateSlug($title);
        $this->touchTimestamps();
    }
}

class Post extends Model
{
    use BlogModelHelpers;  // Получаем всё из BlogModelHelpers

    public function save(array $options = [])
    {
        $this->prepareForSave($this->title);
        return parent::save($options);
    }
}
```

**На собеседовании скажешь:**
> "Трейт может использовать другие трейты через use. Использую для создания составных трейтов из базовых. Класс, использующий составной трейт, получает методы из всех вложенных трейтов."

---

## Резюме трейтов

**Основное:**
- Trait — механизм горизонтального переиспользования кода
- `use Trait` в классе добавляет методы трейта
- Можно использовать несколько трейтов: `use A, B, C`
- Конфликт имён: `insteadof` (выбрать) или `as` (алиас)
- Изменение видимости: `use Trait { method as private }`
- Трейты могут иметь abstract методы (класс обязан реализовать)
- Трейты могут содержать свойства (добавляются в класс)
- Трейты могут использовать другие трейты

**Важно на собесе:**
- Решают проблему множественного наследования через композицию
- В Laravel: HasFactory, SoftDeletes, Notifiable, HasUuid
- Трейты добавляют код в класс (copy-paste на уровне компиляции)
- abstract метод в трейте — класс обязан реализовать
- Изменение видимости полезно для скрытия внутренних методов
- Трейты != интерфейсы (trait — реализация, interface — контракт)

---

## Практические задания

### Задание 1: Создай Sluggable trait для моделей

Трейт должен автоматически генерировать slug из указанного поля при создании модели.

<details>
<summary>Решение</summary>

```php
trait Sluggable
{
    // Абстрактный метод — класс обязан реализовать
    abstract protected function getSlugSource(): string;

    // Опциональный метод для кастомизации
    protected function getSlugColumn(): string
    {
        return 'slug';
    }

    protected function generateSlug(string $value): string
    {
        // Транслитерация + замена пробелов на дефисы
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $value), '-'));

        // Проверка уникальности
        $original = $slug;
        $count = 1;

        while ($this->slugExists($slug)) {
            $slug = "{$original}-{$count}";
            $count++;
        }

        return $slug;
    }

    protected function slugExists(string $slug): bool
    {
        // Упрощённая проверка (в реальности — запрос к БД)
        static $used = [];

        if (in_array($slug, $used)) {
            return true;
        }

        $used[] = $slug;
        return false;
    }

    public function setSlugFromSource(): void
    {
        $source = $this->getSlugSource();
        $column = $this->getSlugColumn();

        if (empty($this->$column) && !empty($this->$source)) {
            $this->$column = $this->generateSlug($this->$source);
        }
    }

    // Boot метод (вызывается при инициализации модели)
    public static function bootSluggable(): void
    {
        static::creating(function ($model) {
            $model->setSlugFromSource();
        });

        static::updating(function ($model) {
            // Опционально: обновлять slug при обновлении source поля
            if ($model->isDirty($model->getSlugSource())) {
                $model->setSlugFromSource();
            }
        });
    }
}

// Базовая модель (упрощённо)
class Model
{
    protected array $attributes = [];

    public function __get($key)
    {
        return $this->attributes[$key] ?? null;
    }

    public function __set($key, $value)
    {
        $this->attributes[$key] = $value;
    }

    public static function creating($callback)
    {
        // Симуляция события creating
        static::$callbacks['creating'][] = $callback;
    }

    public static function updating($callback)
    {
        static::$callbacks['updating'][] = $callback;
    }

    protected static $callbacks = ['creating' => [], 'updating' => []];

    public function save()
    {
        foreach (static::$callbacks['creating'] as $callback) {
            $callback($this);
        }
        echo "Saved: {$this->title} -> {$this->slug}\n";
    }

    public function isDirty($key)
    {
        return true; // Упрощённо
    }
}

// Использование в модели Post
class Post extends Model
{
    use Sluggable;

    protected function getSlugSource(): string
    {
        return 'title';  // Генерировать slug из title
    }
}

// Использование в модели Category
class Category extends Model
{
    use Sluggable;

    protected function getSlugSource(): string
    {
        return 'name';  // Генерировать slug из name
    }

    protected function getSlugColumn(): string
    {
        return 'category_slug';  // Кастомное имя колонки
    }
}

// Использование
Post::bootSluggable();

$post = new Post();
$post->title = 'My Awesome Post';
$post->save();  // slug: my-awesome-post

$post2 = new Post();
$post2->title = 'My Awesome Post';
$post2->save();  // slug: my-awesome-post-1
```
</details>

### Задание 2: Разрешение конфликтов трейтов

Создай два трейта `JsonResponse` и `XmlResponse` с методом `respond()`. Используй оба в контроллере, разреши конфликт.

<details>
<summary>Решение</summary>

```php
trait JsonResponse
{
    protected function respond(array $data, int $status = 200): array
    {
        return [
            'format' => 'json',
            'data' => json_encode($data),
            'status' => $status,
            'content_type' => 'application/json',
        ];
    }

    protected function success($data): array
    {
        return $this->respond(['status' => 'success', 'data' => $data]);
    }

    protected function error(string $message, int $status = 400): array
    {
        return $this->respond(['status' => 'error', 'message' => $message], $status);
    }
}

trait XmlResponse
{
    protected function respond(array $data, int $status = 200): array
    {
        $xml = $this->arrayToXml($data);

        return [
            'format' => 'xml',
            'data' => $xml,
            'status' => $status,
            'content_type' => 'application/xml',
        ];
    }

    protected function arrayToXml(array $data, string $root = 'response'): string
    {
        $xml = "<?xml version='1.0'?><{$root}>";

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $xml .= "<{$key}>" . $this->arrayToXml($value, '') . "</{$key}>";
            } else {
                $xml .= "<{$key}>{$value}</{$key}>";
            }
        }

        $xml .= "</{$root}>";
        return $xml;
    }
}

class ApiController
{
    use JsonResponse, XmlResponse {
        // Разрешение конфликта метода respond()
        JsonResponse::respond insteadof XmlResponse;  // По умолчанию JSON
        XmlResponse::respond as respondXml;           // XML через алиас
    }

    public function index(string $format = 'json'): array
    {
        $data = [
            'users' => [
                ['id' => 1, 'name' => 'Иван'],
                ['id' => 2, 'name' => 'Пётр'],
            ],
        ];

        if ($format === 'xml') {
            return $this->respondXml($data);
        }

        return $this->respond($data);
    }

    public function show(int $id, string $format = 'json'): array
    {
        $user = ['id' => $id, 'name' => 'Иван'];

        if ($format === 'xml') {
            return $this->respondXml(['user' => $user]);
        }

        return $this->success($user);  // Использует JsonResponse::success
    }
}

// Использование
$controller = new ApiController();

print_r($controller->index('json'));
// ['format' => 'json', 'data' => '{"users":[...]}', ...]

print_r($controller->index('xml'));
// ['format' => 'xml', 'data' => '<?xml version="1.0"?><response>...', ...]

print_r($controller->show(1, 'json'));
// ['format' => 'json', 'data' => '{"status":"success","data":{...}}', ...]
```
</details>

### Задание 3: Trait с абстрактными методами и свойствами

Создай `Cacheable` трейт, который требует от класса метод `getCacheKey()` и добавляет кэширование.

<details>
<summary>Решение</summary>

```php
trait Cacheable
{
    protected array $cache = [];
    protected int $defaultTtl = 3600;

    // Абстрактный метод — класс ОБЯЗАН реализовать
    abstract protected function getCacheKey(): string;

    // Опциональный метод — можно переопределить
    protected function getCacheTtl(): int
    {
        return $this->defaultTtl;
    }

    protected function getCachePrefix(): string
    {
        return strtolower(basename(str_replace('\\', '/', static::class)));
    }

    public function remember(callable $callback): mixed
    {
        $key = $this->buildCacheKey();

        if ($this->has($key)) {
            return $this->get($key);
        }

        $value = $callback();
        $this->put($key, $value, $this->getCacheTtl());

        return $value;
    }

    public function put(string $key, mixed $value, int $ttl): void
    {
        $this->cache[$key] = [
            'value' => $value,
            'expires_at' => time() + $ttl,
        ];
    }

    public function get(string $key): mixed
    {
        if (!$this->has($key)) {
            return null;
        }

        return $this->cache[$key]['value'];
    }

    public function has(string $key): bool
    {
        if (!isset($this->cache[$key])) {
            return false;
        }

        if ($this->cache[$key]['expires_at'] < time()) {
            unset($this->cache[$key]);
            return false;
        }

        return true;
    }

    public function forget(string $key): bool
    {
        if (isset($this->cache[$key])) {
            unset($this->cache[$key]);
            return true;
        }

        return false;
    }

    public function flush(): void
    {
        $this->cache = [];
    }

    protected function buildCacheKey(): string
    {
        $prefix = $this->getCachePrefix();
        $key = $this->getCacheKey();

        return "{$prefix}:{$key}";
    }
}

// Сервис для пользователей
class UserService
{
    use Cacheable;

    private int $userId;

    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }

    // ОБЯЗАТЕЛЬНАЯ реализация абстрактного метода
    protected function getCacheKey(): string
    {
        return "user:{$this->userId}";
    }

    // Переопределяем TTL
    protected function getCacheTtl(): int
    {
        return 7200;  // 2 часа
    }

    public function getUser(): array
    {
        return $this->remember(function () {
            // Дорогая операция (БД запрос)
            echo "Fetching user {$this->userId} from database...\n";

            return [
                'id' => $this->userId,
                'name' => 'User ' . $this->userId,
                'email' => "user{$this->userId}@example.com",
            ];
        });
    }
}

// Сервис для постов
class PostRepository
{
    use Cacheable;

    private string $slug;

    public function __construct(string $slug)
    {
        $this->slug = $slug;
    }

    protected function getCacheKey(): string
    {
        return "post:{$this->slug}";
    }

    protected function getCacheTtl(): int
    {
        return 3600;  // 1 час
    }

    public function findBySlug(): array
    {
        return $this->remember(function () {
            echo "Fetching post {$this->slug} from database...\n";

            return [
                'id' => rand(1, 100),
                'slug' => $this->slug,
                'title' => ucwords(str_replace('-', ' ', $this->slug)),
            ];
        });
    }
}

// Использование
$userService = new UserService(1);

$user = $userService->getUser();
// Fetching user 1 from database...
print_r($user);

$user = $userService->getUser();  // Из кэша (не выведет "Fetching...")
print_r($user);

$postRepo = new PostRepository('my-awesome-post');

$post = $postRepo->findBySlug();
// Fetching post my-awesome-post from database...

$post = $postRepo->findBySlug();  // Из кэша
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
