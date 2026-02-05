# 2.6 Магические методы

## Краткое резюме

> **Магические методы** — специальные методы с двумя подчёркиваниями (__), которые вызываются автоматически в определённых ситуациях.
>
> **Основные:** __construct (создание), __get/__set (доступ к свойствам), __call/__callStatic (вызов методов), __toString (преобразование в строку), __invoke (вызов как функции), __clone (клонирование).
>
> **Важно:** Eloquent использует __get/__set для $attributes, __call для scopes. Не злоупотреблять — усложняют отладку.

---

## Содержание

- [__construct и __destruct](#__construct-и-__destruct)
- [__get, __set, __isset, __unset](#__get-__set-__isset-__unset)
- [__call и __callStatic](#__call-и-__callstatic)
- [__toString](#__tostring)
- [__invoke](#__invoke)
- [__clone](#__clone)
- [__sleep и __wakeup](#__sleep-и-__wakeup)
- [Резюме](#резюме-магических-методов)
- [Практические задания](#практические-задания)

---

## __construct и __destruct

**Что это:**
`__construct` вызывается при создании объекта, `__destruct` — при уничтожении.

**Как работает:**
```php
class User
{
    public function __construct(
        private string $name,
    ) {
        echo "User создан: {$this->name}\n";
    }

    public function __destruct()
    {
        echo "User удалён: {$this->name}\n";
    }
}

$user = new User('Иван');  // "User создан: Иван"
unset($user);              // "User удалён: Иван"

// __destruct вызывается автоматически в конце скрипта
$user = new User('Пётр');
// Скрипт завершается → "User удалён: Пётр"
```

**Когда использовать:**
- `__construct` — инициализация, DI
- `__destruct` — очистка ресурсов (закрытие соединений, файлов)

**Пример из практики:**
```php
// Database connection
class Database
{
    private ?\PDO $connection = null;

    public function __construct(
        private string $host,
        private string $dbname,
    ) {
        $this->connection = new \PDO("mysql:host={$host};dbname={$dbname}");
    }

    public function __destruct()
    {
        $this->connection = null;  // Закрыть соединение
    }
}

// File handler
class FileLogger
{
    private $handle;

    public function __construct(string $filename)
    {
        $this->handle = fopen($filename, 'a');
    }

    public function log(string $message): void
    {
        fwrite($this->handle, $message . PHP_EOL);
    }

    public function __destruct()
    {
        if ($this->handle) {
            fclose($this->handle);  // Закрыть файл
        }
    }
}
```

**На собеседовании скажешь:**
> "__construct вызывается при создании объекта. __destruct — при уничтожении (unset или конец скрипта). Использую __destruct для очистки ресурсов (закрытие соединений, файлов)."

---

## __get, __set, __isset, __unset

**Что это:**
Перехват обращения к несуществующим или недоступным свойствам.

**Как работает:**
```php
class User
{
    private array $data = [];

    // Перехват ЧТЕНИЯ несуществующего свойства
    public function __get(string $name): mixed
    {
        return $this->data[$name] ?? null;
    }

    // Перехват ЗАПИСИ в несуществующее свойство
    public function __set(string $name, mixed $value): void
    {
        $this->data[$name] = $value;
    }

    // Перехват isset()
    public function __isset(string $name): bool
    {
        return isset($this->data[$name]);
    }

    // Перехват unset()
    public function __unset(string $name): void
    {
        unset($this->data[$name]);
    }
}

$user = new User();
$user->name = 'Иван';         // __set('name', 'Иван')
echo $user->name;             // __get('name') → "Иван"
var_dump(isset($user->name)); // __isset('name') → true
unset($user->name);           // __unset('name')
```

**Когда использовать:**
Для динамических свойств, прокси-объектов, ORM моделей.

**Пример из практики:**
```php
// Eloquent Model (упрощённо)
class Model
{
    protected array $attributes = [];

    public function __get(string $key): mixed
    {
        return $this->attributes[$key] ?? null;
    }

    public function __set(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function __isset(string $key): bool
    {
        return isset($this->attributes[$key]);
    }
}

$user = new User();
$user->name = 'Иван';
$user->email = 'ivan@mail.com';
echo $user->name;  // Читается из $attributes

// Lazy loading отношений
class Post extends Model
{
    protected array $relations = [];

    public function __get(string $key): mixed
    {
        // Если это свойство — вернуть
        if (isset($this->attributes[$key])) {
            return $this->attributes[$key];
        }

        // Если это отношение — загрузить
        if (method_exists($this, $key)) {
            return $this->relations[$key] ??= $this->$key()->get();
        }

        return null;
    }
}

$post = Post::find(1);
echo $post->title;   // Свойство (из $attributes)
echo $post->author->name;  // Отношение (lazy loading через __get)
```

**На собеседовании скажешь:**
> "__get перехватывает чтение несуществующего свойства, __set — запись, __isset — isset(), __unset — unset(). Eloquent использует для работы с $attributes и lazy loading отношений."

---

## __call и __callStatic

**Что это:**
Перехват вызова несуществующих методов (обычных и статических).

**Как работает:**
```php
class Magic
{
    // Перехват вызова несуществующего метода
    public function __call(string $method, array $args): mixed
    {
        echo "Вызван метод: {$method}\n";
        echo "Аргументы: " . implode(', ', $args) . "\n";
        return null;
    }

    // Перехват вызова несуществующего статического метода
    public static function __callStatic(string $method, array $args): mixed
    {
        echo "Вызван статический метод: {$method}\n";
        echo "Аргументы: " . implode(', ', $args) . "\n";
        return null;
    }
}

$obj = new Magic();
$obj->nonExistent('arg1', 'arg2');
// Вызван метод: nonExistent
// Аргументы: arg1, arg2

Magic::staticNonExistent('arg1', 'arg2');
// Вызван статический метод: staticNonExistent
// Аргументы: arg1, arg2
```

**Когда использовать:**
Для динамических методов, методов-маппёров, fluent API.

**Пример из практики:**
```php
// Query Builder (упрощённо)
class QueryBuilder
{
    protected array $wheres = [];

    // where('status', 'active') → whereStatus('active')
    public function __call(string $method, array $args): self
    {
        if (str_starts_with($method, 'where')) {
            $column = Str::snake(substr($method, 5));  // whereStatus → status
            $this->wheres[$column] = $args[0];
            return $this;
        }

        throw new \BadMethodCallException("Method {$method} does not exist");
    }

    public function get(): array
    {
        // SELECT * FROM table WHERE status = 'active'
        return [];
    }
}

$query = new QueryBuilder();
$users = $query->whereStatus('active')
               ->whereDepartmentId(5)
               ->get();

// Eloquent scopes
class User extends Model
{
    public function __call(string $method, array $parameters)
    {
        // scope + метод
        if (method_exists($this, 'scope' . ucfirst($method))) {
            return $this->{'scope' . ucfirst($method)}(...$parameters);
        }

        return parent::__call($method, $parameters);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}

User::active()->get();  // Вызовет scopeActive через __callStatic

// Laravel Facade
class Cache
{
    public static function __callStatic(string $method, array $args): mixed
    {
        $instance = app('cache');  // Получить из контейнера
        return $instance->$method(...$args);
    }
}

Cache::put('key', 'value', 3600);  // Через __callStatic
```

**На собеседовании скажешь:**
> "__call перехватывает вызов несуществующего метода, __callStatic — статического. Eloquent использует для scopes (whereActive), Query Builder для where* методов, Facade для проксирования вызовов."

---

## __toString

**Что это:**
Преобразование объекта в строку.

**Как работает:**
```php
class User
{
    public function __construct(
        private string $name,
        private string $email,
    ) {}

    public function __toString(): string
    {
        return "{$this->name} ({$this->email})";
    }
}

$user = new User('Иван', 'ivan@mail.com');
echo $user;  // "Иван (ivan@mail.com)" (вызовет __toString)

// Без __toString
$obj = new stdClass();
echo $obj;  // ❌ Error: Object of class stdClass could not be converted to string
```

**Когда использовать:**
Для удобного вывода объектов в строку, логирования, дебаггинга.

**Пример из практики:**
```php
// Value Object
class Money
{
    public function __construct(
        private int $amount,
        private string $currency,
    ) {}

    public function __toString(): string
    {
        $formatted = number_format($this->amount / 100, 2, '.', ' ');
        return "{$formatted} {$this->currency}";
    }
}

$price = new Money(199900, 'RUB');
echo "Цена: {$price}";  // "Цена: 1 999.00 RUB"

// Eloquent Model
class User extends Model
{
    public function __toString(): string
    {
        return $this->name;
    }
}

$user = User::find(1);
echo "Пользователь: {$user}";  // "Пользователь: Иван"

// Exception
class OrderException extends Exception
{
    public function __construct(
        string $message,
        private Order $order,
    ) {
        parent::__construct($message);
    }

    public function __toString(): string
    {
        return "OrderException: {$this->message} (Order ID: {$this->order->id})";
    }
}

try {
    throw new OrderException('Payment failed', $order);
} catch (OrderException $e) {
    echo $e;  // "OrderException: Payment failed (Order ID: 123)"
}
```

**На собеседовании скажешь:**
> "__toString преобразует объект в строку. Вызывается при echo, string cast, конкатенации. Использую для Value Objects (Money), моделей, exception. Удобно для логирования и вывода."

---

## __invoke

**Что это:**
Позволяет вызывать объект как функцию.

**Как работает:**
```php
class Multiplier
{
    public function __construct(
        private int $factor,
    ) {}

    public function __invoke(int $value): int
    {
        return $value * $this->factor;
    }
}

$double = new Multiplier(2);
echo $double(5);  // 10 (вызов объекта как функции)

$triple = new Multiplier(3);
echo $triple(5);  // 15

// Можно использовать как callback
$numbers = [1, 2, 3, 4, 5];
$doubled = array_map($double, $numbers);  // [2, 4, 6, 8, 10]
```

**Когда использовать:**
Для callable объектов, middleware, strategies, commands.

**Пример из практики:**
```php
// Laravel Middleware
class Authenticate
{
    public function __invoke($request, Closure $next)
    {
        if (!auth()->check()) {
            return redirect('/login');
        }

        return $next($request);
    }
}

// Route
Route::get('/dashboard', DashboardController::class)
    ->middleware(Authenticate::class);

// Strategy pattern
interface DiscountStrategy
{
    public function __invoke(int $price): int;
}

class PercentageDiscount implements DiscountStrategy
{
    public function __construct(private int $percent) {}

    public function __invoke(int $price): int
    {
        return (int) ($price * (1 - $this->percent / 100));
    }
}

class FixedDiscount implements DiscountStrategy
{
    public function __construct(private int $amount) {}

    public function __invoke(int $price): int
    {
        return max(0, $price - $this->amount);
    }
}

class PriceCalculator
{
    public function calculate(int $price, DiscountStrategy $discount): int
    {
        return $discount($price);  // Вызов объекта как функции
    }
}

$calculator = new PriceCalculator();
$price = 1000;

$finalPrice = $calculator->calculate($price, new PercentageDiscount(10));
// 900

$finalPrice = $calculator->calculate($price, new FixedDiscount(100));
// 900

// Command pattern
class CreateUserCommand
{
    public function __construct(
        private array $data,
    ) {}

    public function __invoke(UserRepository $repository): User
    {
        return $repository->create($this->data);
    }
}

$command = new CreateUserCommand(['name' => 'Иван', 'email' => 'ivan@mail.com']);
$user = $command(new UserRepository());  // Выполнить команду
```

**На собеседовании скажешь:**
> "__invoke позволяет вызывать объект как функцию. Объект становится callable. В Laravel middleware с __invoke, используется в Pipeline. Применяю для Strategy, Command patterns, callable объектов."

---

## __clone

**Что это:**
Вызывается при клонировании объекта через `clone`.

**Как работает:**
```php
class User
{
    public function __construct(
        public string $name,
        public Address $address,
    ) {}

    public function __clone()
    {
        // Глубокое клонирование (клонировать вложенные объекты)
        $this->address = clone $this->address;

        echo "Объект клонирован\n";
    }
}

class Address
{
    public function __construct(public string $city) {}
}

$user1 = new User('Иван', new Address('Москва'));
$user2 = clone $user1;  // Вызовет __clone

$user2->name = 'Пётр';
$user2->address->city = 'Санкт-Петербург';

echo $user1->name;  // "Иван"
echo $user1->address->city;  // "Москва" (не изменился, т.к. clone $this->address)

// Без __clone вложенные объекты НЕ клонируются
class UserBad
{
    public function __construct(
        public string $name,
        public Address $address,
    ) {}
}

$user1 = new UserBad('Иван', new Address('Москва'));
$user2 = clone $user1;

$user2->address->city = 'Санкт-Петербург';
echo $user1->address->city;  // "Санкт-Петербург" (изменился! Ссылка на тот же объект)
```

**Когда использовать:**
Для глубокого клонирования (копирование вложенных объектов), создания snapshot'ов.

**Пример из практики:**
```php
// Создание копии модели
class Post extends Model
{
    public function __clone()
    {
        $this->id = null;  // Сбросить ID (чтобы создать новую запись)
        $this->slug = null;
        $this->created_at = null;
        $this->updated_at = null;

        // Клонировать отношения
        $this->relations = [];
    }
}

$original = Post::find(1);
$duplicate = clone $original;
$duplicate->title = 'Копия: ' . $original->title;
$duplicate->save();  // Создаст новую запись (ID будет новый)

// Snapshot для сравнения изменений
class Order extends Model
{
    private ?Order $snapshot = null;

    public function createSnapshot(): void
    {
        $this->snapshot = clone $this;
    }

    public function getChanges(): array
    {
        if ($this->snapshot === null) {
            return [];
        }

        $changes = [];
        foreach ($this->attributes as $key => $value) {
            if ($this->snapshot->attributes[$key] !== $value) {
                $changes[$key] = [
                    'old' => $this->snapshot->attributes[$key],
                    'new' => $value,
                ];
            }
        }

        return $changes;
    }

    public function __clone()
    {
        // Глубокое клонирование attributes
        $this->attributes = $this->attributes;
    }
}

$order = Order::find(1);
$order->createSnapshot();

$order->status = 'paid';
$order->amount = 2000;

$changes = $order->getChanges();
// ['status' => ['old' => 'pending', 'new' => 'paid'], 'amount' => ['old' => 1000, 'new' => 2000]]
```

**На собеседовании скажешь:**
> "__clone вызывается при clone. По умолчанию clone делает shallow copy (вложенные объекты — ссылки). В __clone делаю глубокое клонирование: clone $this->nested. Использую для дублирования моделей, создания snapshot'ов."

---

## __sleep и __wakeup

**Что это:**
`__sleep` вызывается перед сериализацией, `__wakeup` — после десериализации.

**Как работает:**
```php
class User
{
    public string $name;
    public string $email;
    private $connection;  // Ресурс (не сериализуется)

    public function __construct(string $name, string $email)
    {
        $this->name = $name;
        $this->email = $email;
        $this->connection = fopen('connection.txt', 'w');
    }

    // Перед сериализацией (указать, что сериализовать)
    public function __sleep(): array
    {
        fclose($this->connection);  // Закрыть ресурс
        return ['name', 'email'];   // Сериализовать только эти поля
    }

    // После десериализации (восстановить состояние)
    public function __wakeup(): void
    {
        $this->connection = fopen('connection.txt', 'a');  // Переоткрыть
    }
}

$user = new User('Иван', 'ivan@mail.com');
$serialized = serialize($user);  // Вызовет __sleep

$restored = unserialize($serialized);  // Вызовет __wakeup
```

**Когда использовать:**
Для очистки ресурсов перед сериализацией, восстановления состояния после десериализации.

**Пример из практики:**
```php
// Кэширование объекта
class UserService
{
    private LoggerInterface $logger;
    private array $data;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
        $this->data = [];
    }

    public function __sleep(): array
    {
        // Не сериализовать logger (ресурс)
        return ['data'];
    }

    public function __wakeup(): void
    {
        // Восстановить logger из контейнера
        $this->logger = app(LoggerInterface::class);
    }
}

// Кэш
$service = new UserService($logger);
Cache::put('service', serialize($service), 3600);

// Восстановление
$cached = unserialize(Cache::get('service'));

// Laravel Queue (сериализация job)
class ProcessOrder implements ShouldQueue
{
    public function __construct(
        private Order $order,  // Сериализуется
        private LoggerInterface $logger,  // НЕ сериализуется
    ) {}

    public function __sleep(): array
    {
        return ['order'];  // Только order в очередь
    }

    public function __wakeup(): void
    {
        $this->logger = app(LoggerInterface::class);  // Восстановить
    }
}
```

**На собеседовании скажешь:**
> "__sleep вызывается перед serialize() — указываю, какие свойства сериализовать. __wakeup после unserialize() — восстанавливаю ресурсы (logger, connection). В Laravel Queue используется для сериализации jobs."

---

## Резюме магических методов

**Основные:**
- `__construct()` — конструктор (при создании)
- `__destruct()` — деструктор (при уничтожении)
- `__get($name)` — чтение несуществующего свойства
- `__set($name, $value)` — запись в несуществующее свойство
- `__isset($name)` — isset() на несуществующем свойстве
- `__unset($name)` — unset() на несуществующем свойстве
- `__call($method, $args)` — вызов несуществующего метода
- `__callStatic($method, $args)` — вызов несуществующего статического метода
- `__toString()` — преобразование в строку
- `__invoke()` — вызов объекта как функции (callable)
- `__clone()` — при клонировании (глубокое копирование)
- `__sleep()` — перед сериализацией (что сериализовать)
- `__wakeup()` — после десериализации (восстановить)

**Важно на собесе:**
- Eloquent использует __get/__set для $attributes, __call для scopes
- __invoke делает объект callable (Middleware, Strategy, Command)
- __clone для глубокого копирования вложенных объектов
- __sleep/__wakeup для сериализации (Laravel Queue)
- __toString для удобного вывода (Money, Exception)
- Не злоупотреблять — усложняют отладку

---

## Практические задания

### Задание 1: Динамическая модель с __get/__set/__isset/__unset

Создай класс `DynamicModel`, который хранит атрибуты в массиве и предоставляет доступ через магические методы.

<details>
<summary>Решение</summary>

```php
class DynamicModel
{
    protected array $attributes = [];
    protected array $casts = [];

    public function __get(string $key): mixed
    {
        if (!isset($this->attributes[$key])) {
            return null;
        }

        return $this->castAttribute($key, $this->attributes[$key]);
    }

    public function __set(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function __isset(string $key): bool
    {
        return isset($this->attributes[$key]);
    }

    public function __unset(string $key): void
    {
        unset($this->attributes[$key]);
    }

    protected function castAttribute(string $key, mixed $value): mixed
    {
        if (!isset($this->casts[$key])) {
            return $value;
        }

        return match($this->casts[$key]) {
            'int' => (int) $value,
            'string' => (string) $value,
            'bool' => (bool) $value,
            'array' => is_string($value) ? json_decode($value, true) : $value,
            'datetime' => new \DateTime($value),
            default => $value,
        };
    }

    public function toArray(): array
    {
        return $this->attributes;
    }
}

class User extends DynamicModel
{
    protected array $casts = [
        'id' => 'int',
        'is_active' => 'bool',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];
}

// Использование
$user = new User();
$user->name = 'Иван';
$user->email = 'ivan@mail.com';
$user->is_active = '1';  // Будет приведено к bool
$user->metadata = '{"key":"value"}';  // Будет приведено к array

echo $user->name;  // "Иван"
var_dump($user->is_active);  // bool(true)
print_r($user->metadata);  // ['key' => 'value']

var_dump(isset($user->name));  // true
unset($user->name);
var_dump(isset($user->name));  // false
```
</details>

### Задание 2: Fluent Builder с __call

Создай `QueryBuilder` с методами where* через __call (whereStatus, whereName и т.д.).

<details>
<summary>Решение</summary>

```php
class QueryBuilder
{
    protected array $wheres = [];
    protected array $orders = [];
    protected ?int $limit = null;

    public function __call(string $method, array $args): self
    {
        // whereStatus('active') -> where('status', 'active')
        if (str_starts_with($method, 'where')) {
            $column = $this->snakeCase(substr($method, 5));
            $this->wheres[$column] = $args[0];
            return $this;
        }

        // orderByName('asc') -> orderBy('name', 'asc')
        if (str_starts_with($method, 'orderBy')) {
            $column = $this->snakeCase(substr($method, 7));
            $this->orders[$column] = $args[0] ?? 'asc';
            return $this;
        }

        throw new \BadMethodCallException("Method {$method} does not exist");
    }

    public function where(string $column, mixed $value): self
    {
        $this->wheres[$column] = $value;
        return $this;
    }

    public function limit(int $limit): self
    {
        $this->limit = $limit;
        return $this;
    }

    public function toSql(): string
    {
        $sql = 'SELECT * FROM table';

        if (!empty($this->wheres)) {
            $conditions = [];
            foreach ($this->wheres as $column => $value) {
                $conditions[] = "{$column} = '{$value}'";
            }
            $sql .= ' WHERE ' . implode(' AND ', $conditions);
        }

        if (!empty($this->orders)) {
            $orders = [];
            foreach ($this->orders as $column => $direction) {
                $orders[] = "{$column} {$direction}";
            }
            $sql .= ' ORDER BY ' . implode(', ', $orders);
        }

        if ($this->limit !== null) {
            $sql .= " LIMIT {$this->limit}";
        }

        return $sql;
    }

    private function snakeCase(string $value): string
    {
        return strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $value));
    }
}

// Использование
$query = new QueryBuilder();
$sql = $query->whereStatus('active')
             ->whereDepartmentId(5)
             ->whereIsActive(true)
             ->orderByCreatedAt('desc')
             ->limit(10)
             ->toSql();

echo $sql;
// SELECT * FROM table WHERE status = 'active' AND department_id = '5' AND is_active = '1' ORDER BY created_at desc LIMIT 10
```
</details>

### Задание 3: Callable класс с __invoke для Middleware

Создай `AuthMiddleware` с __invoke, который проверяет авторизацию.

<details>
<summary>Решение</summary>

```php
interface MiddlewareInterface
{
    public function __invoke(array $request, callable $next): array;
}

class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ?int $userId = null,
    ) {}

    public function __invoke(array $request, callable $next): array
    {
        // Проверка авторизации
        if ($this->userId === null) {
            return [
                'status' => 401,
                'body' => ['error' => 'Unauthorized'],
            ];
        }

        // Добавляем user_id в request
        $request['user_id'] = $this->userId;

        // Передаём дальше
        return $next($request);
    }
}

class LogMiddleware implements MiddlewareInterface
{
    public function __invoke(array $request, callable $next): array
    {
        echo "[LOG] Request: " . ($request['path'] ?? '/') . "\n";

        $response = $next($request);

        echo "[LOG] Response: {$response['status']}\n";

        return $response;
    }
}

class RateLimitMiddleware implements MiddlewareInterface
{
    private static array $requests = [];
    private int $maxRequests = 5;

    public function __invoke(array $request, callable $next): array
    {
        $ip = $request['ip'] ?? '127.0.0.1';

        if (!isset(self::$requests[$ip])) {
            self::$requests[$ip] = 0;
        }

        self::$requests[$ip]++;

        if (self::$requests[$ip] > $this->maxRequests) {
            return [
                'status' => 429,
                'body' => ['error' => 'Too many requests'],
            ];
        }

        return $next($request);
    }
}

// Pipeline для middleware
class Pipeline
{
    private array $middleware = [];

    public function pipe(callable $middleware): self
    {
        $this->middleware[] = $middleware;
        return $this;
    }

    public function handle(array $request, callable $destination): array
    {
        $pipeline = array_reduce(
            array_reverse($this->middleware),
            function ($next, $middleware) {
                return fn($request) => $middleware($request, $next);
            },
            $destination
        );

        return $pipeline($request);
    }
}

// Использование
$pipeline = new Pipeline();
$pipeline->pipe(new LogMiddleware())
         ->pipe(new RateLimitMiddleware())
         ->pipe(new AuthMiddleware(userId: 123));

$request = ['path' => '/api/users', 'ip' => '192.168.1.1'];

$response = $pipeline->handle($request, function ($request) {
    // Финальный обработчик (контроллер)
    return [
        'status' => 200,
        'body' => ['message' => 'Success', 'user_id' => $request['user_id']],
    ];
});

print_r($response);
// [LOG] Request: /api/users
// [LOG] Response: 200
// ['status' => 200, 'body' => ['message' => 'Success', 'user_id' => 123]]
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
