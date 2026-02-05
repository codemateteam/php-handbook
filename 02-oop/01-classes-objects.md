# 2.1 Классы и объекты

## Краткое резюме

> **Классы и объекты** — основа ООП в PHP. Класс — шаблон с данными (свойства) и поведением (методы). Объект — экземпляр класса.
>
> **Ключевые концепции:** __construct (конструктор), модификаторы доступа (public/protected/private), статические элементы (static), константы класса (const).
>
> **Важно:** PHP 8.0+ Constructor Property Promotion. Объекты передаются по ссылке. $this (объект), self (статика), parent (родитель).

---

## Содержание

- [Объявление класса](#объявление-класса)
- [Конструктор (__construct)](#конструктор-__construct)
- [Модификаторы доступа](#модификаторы-доступа-public-private-protected)
- [$this vs self vs parent](#this-vs-self-vs-parent)
- [Статические свойства и методы](#статические-свойства-и-методы)
- [Константы класса](#константы-класса)
- [Передача объектов](#передача-объектов-по-ссылке)
- [Резюме](#резюме-классов-и-объектов)
- [Практические задания](#практические-задания)

---

## Объявление класса

**Что это:**
Класс — это шаблон для создания объектов с данными (свойства) и поведением (методы).

**Как работает:**
```php
class User
{
    // Свойства (properties)
    public string $name;
    public string $email;
    private int $age;

    // Метод
    public function greet(): string
    {
        return "Привет, {$this->name}!";
    }

    public function getAge(): int
    {
        return $this->age;
    }

    public function setAge(int $age): void
    {
        if ($age < 0) {
            throw new \InvalidArgumentException('Возраст не может быть отрицательным');
        }
        $this->age = $age;
    }
}

// Создание объекта
$user = new User();
$user->name = 'Иван';
$user->email = 'ivan@mail.com';
$user->setAge(25);

echo $user->greet();  // "Привет, Иван!"
```

**Когда использовать:**
Для моделирования сущностей (User, Post, Order), сервисов (PaymentService), value objects (Money, Email).

**Пример из практики:**
```php
// Eloquent модель
class Post extends Model
{
    protected $fillable = ['title', 'content', 'author_id'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}

// Использование
$post = Post::find(1);
echo $post->title;
echo $post->author->name;

if ($post->isPublished()) {
    // ...
}
```

**На собеседовании скажешь:**
> "Класс — шаблон для объектов. Содержит свойства (данные) и методы (поведение). $this ссылается на текущий объект. В Laravel модели (User, Post) наследуются от Model."

---

## Конструктор (__construct)

**Что это:**
Метод, который вызывается автоматически при создании объекта.

**Как работает:**
```php
class User
{
    private string $name;
    private string $email;

    public function __construct(string $name, string $email)
    {
        $this->name = $name;
        $this->email = $email;
    }

    public function getName(): string
    {
        return $this->name;
    }
}

$user = new User('Иван', 'ivan@mail.com');
echo $user->getName();  // "Иван"

// Constructor Property Promotion (PHP 8.0+)
class User
{
    public function __construct(
        private string $name,
        private string $email,
    ) {}

    public function getName(): string
    {
        return $this->name;
    }
}

// Короче и читаемее!
```

**Когда использовать:**
Для инициализации обязательных свойств, внедрения зависимостей.

**Пример из практики:**
```php
// Service с Dependency Injection
class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private PaymentGateway $gateway,
        private NotificationService $notifications,
    ) {}

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);
        $this->gateway->charge($order->amount);
        $this->notifications->send($order->user, 'Заказ создан');

        return $order;
    }
}

// Laravel Service Container автоматически внедрит зависимости
$orderService = app(OrderService::class);

// Value Object
class Money
{
    public function __construct(
        private int $amount,
        private string $currency = 'RUB',
    ) {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Сумма не может быть отрицательной');
        }
    }

    public function add(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new \Exception('Валюты не совпадают');
        }

        return new Money($this->amount + $other->amount, $this->currency);
    }
}

$price = new Money(1000, 'RUB');
$discount = new Money(100, 'RUB');
$total = $price->add($discount);
```

**На собеседовании скажешь:**
> "__construct вызывается при создании объекта. PHP 8.0 добавил Constructor Property Promotion — короткий синтаксис (private string $name в параметрах). Использую для DI и инициализации обязательных свойств."

---

## Модификаторы доступа (public, private, protected)

**Что это:**
Ключевые слова, определяющие видимость свойств и методов.

**Как работает:**
```php
class User
{
    public string $name;          // Доступно везде
    protected string $email;      // Доступно в классе и наследниках
    private int $age;             // Доступно ТОЛЬКО в этом классе

    public function getEmail(): string  // public метод
    {
        return $this->email;
    }

    protected function validateAge(int $age): bool  // protected метод
    {
        return $age >= 0 && $age <= 150;
    }

    private function log(string $message): void  // private метод
    {
        // Внутренняя логика
    }
}

$user = new User();
$user->name = 'Иван';              // ✅ OK (public)
$user->email = 'ivan@mail.com';    // ❌ Error (protected)
$user->age = 25;                   // ❌ Error (private)

echo $user->getEmail();            // ✅ OK (public метод)
```

**Когда использовать:**
- `public` — для API класса (публичные методы)
- `protected` — для методов, которые нужны наследникам
- `private` — для внутренней реализации (инкапсуляция)

**Пример из практики:**
```php
class Model
{
    protected array $attributes = [];  // Доступно в наследниках

    public function __get(string $key): mixed
    {
        return $this->attributes[$key] ?? null;
    }

    public function __set(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    protected function performInsert(): bool  // Используется в наследниках
    {
        // Логика вставки в БД
    }

    private function cleanAttributes(): void  // Только для Model
    {
        // Внутренняя очистка
    }
}

class User extends Model
{
    public function save(): bool
    {
        return $this->performInsert();  // ✅ OK (protected)
    }
}

// Payment Service
class PaymentService
{
    private const API_KEY = 'secret';  // private константа

    public function charge(int $amount): bool
    {
        return $this->sendRequest($amount);
    }

    private function sendRequest(int $amount): bool  // Внутренняя реализация
    {
        // Используем self::API_KEY
        // Клиент класса не должен знать про этот метод
    }
}
```

**На собеседовании скажешь:**
> "public — доступно везде, protected — в классе и наследниках, private — только в текущем классе. Инкапсуляция: скрываю внутреннюю реализацию (private), открываю API (public), даю доступ наследникам (protected)."

---

## $this vs self vs parent

**Что это:**
Ключевые слова для обращения к контексту.

**Как работает:**
```php
class User
{
    private string $name;
    private static int $count = 0;

    public function __construct(string $name)
    {
        $this->name = $name;       // $this — текущий объект
        self::$count++;            // self — текущий класс (для статики)
    }

    public function getName(): string
    {
        return $this->name;        // $this для свойств объекта
    }

    public static function getCount(): int
    {
        return self::$count;       // self для статических свойств
    }
}

// parent — родительский класс
class Admin extends User
{
    public function __construct(string $name)
    {
        parent::__construct($name);  // Вызов конструктора родителя
        // Дополнительная логика
    }

    public function greet(): string
    {
        return "Admin: " . $this->getName();  // $this для методов объекта
    }
}

$user = new User('Иван');
echo $user->getName();      // "Иван" ($this)
echo User::getCount();      // 1 (self)

$admin = new Admin('Пётр');
echo Admin::getCount();     // 2 (self)
```

**Когда использовать:**
- `$this` — для обращения к свойствам и методам **объекта**
- `self` — для обращения к статическим свойствам и методам **текущего класса**
- `parent` — для вызова методов **родительского класса**

**Пример из практики:**
```php
// Eloquent Model
class Post extends Model
{
    protected static function boot()
    {
        parent::boot();  // Вызов родительского метода

        static::creating(function ($post) {
            $post->slug = Str::slug($post->title);
        });
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class);  // $this для объекта
    }

    public static function published(): Builder
    {
        return self::where('status', 'published');  // self для статики
    }
}

// Service
class CacheService
{
    private const DEFAULT_TTL = 3600;

    public function remember(string $key, callable $callback): mixed
    {
        if ($value = $this->get($key)) {
            return $value;
        }

        $value = $callback();
        $this->put($key, $value, self::DEFAULT_TTL);  // self для константы

        return $value;
    }

    private function get(string $key): mixed
    {
        return cache()->get($key);
    }

    private function put(string $key, mixed $value, int $ttl): void
    {
        cache()->put($key, $value, $ttl);
    }
}
```

**На собеседовании скажешь:**
> "$this для обращения к объекту (свойства, методы). self для статических элементов текущего класса. parent для вызова методов родителя. В наследовании parent::__construct() вызывает конструктор родителя."

---

## Статические свойства и методы

**Что это:**
Элементы класса, которые принадлежат классу, а не объекту.

**Как работает:**
```php
class Database
{
    private static ?Database $instance = null;  // Статическое свойство

    private function __construct() {}  // private конструктор

    public static function getInstance(): Database  // Статический метод
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function query(string $sql): array
    {
        // Выполнение запроса
        return [];
    }
}

// Использование без создания объекта
$db = Database::getInstance();
$users = $db->query('SELECT * FROM users');

// Счётчик объектов
class User
{
    private static int $count = 0;

    public function __construct()
    {
        self::$count++;
    }

    public static function getCount(): int
    {
        return self::$count;
    }
}

$user1 = new User();
$user2 = new User();
echo User::getCount();  // 2
```

**Когда использовать:**
Для утилит, фабрик, синглтонов, счётчиков, констант класса.

**Пример из практики:**
```php
// Helper класс
class Str
{
    public static function slug(string $title): string
    {
        return strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title));
    }

    public static function random(int $length = 16): string
    {
        return bin2hex(random_bytes($length / 2));
    }
}

$slug = Str::slug('Hello World');  // "hello-world"
$token = Str::random(32);

// Laravel использует это повсеместно
use Illuminate\Support\Str;
$slug = Str::slug('My Post Title');

// Eloquent scope (статический вызов)
class Post extends Model
{
    public static function published(): Builder
    {
        return self::where('status', 'published');
    }
}

$posts = Post::published()->get();

// Config
class Config
{
    private static array $settings = [];

    public static function set(string $key, mixed $value): void
    {
        self::$settings[$key] = $value;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::$settings[$key] ?? $default;
    }
}

Config::set('app.name', 'My App');
echo Config::get('app.name');
```

**На собеседовании скажешь:**
> "Статические элементы принадлежат классу, не объекту. Вызываются через ::. Использую для утилит (Str::slug), фабрик, синглтонов. В Laravel много статических методов (Str, Arr, DB)."

---

## Константы класса

**Что это:**
Неизменяемые значения, принадлежащие классу.

**Как работает:**
```php
class Order
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_SHIPPED = 'shipped';
    public const STATUS_DELIVERED = 'delivered';

    private string $status;

    public function __construct()
    {
        $this->status = self::STATUS_PENDING;
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function markAsPaid(): void
    {
        $this->status = self::STATUS_PAID;
    }
}

// Использование
$order = new Order();
if ($order->isPaid()) {
    // ...
}

// Доступ извне
if ($order->status === Order::STATUS_PAID) {
    // ...
}

// Модификаторы доступа (PHP 7.1+)
class Config
{
    public const PUBLIC_KEY = 'public';      // Доступна везде
    protected const PROTECTED_KEY = 'prot';  // Доступна в наследниках
    private const PRIVATE_KEY = 'private';   // Только в этом классе
}
```

**Когда использовать:**
Для статусов, типов, режимов, конфигурационных значений.

**Пример из практики:**
```php
// Статусы пользователя
class User extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_BLOCKED = 'blocked';

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function block(): void
    {
        $this->update(['status' => self::STATUS_BLOCKED]);
    }
}

// Роли
class Role
{
    public const ADMIN = 'admin';
    public const EDITOR = 'editor';
    public const VIEWER = 'viewer';
}

if ($user->role === Role::ADMIN) {
    // Админ
}

// HTTP коды
class Response
{
    public const HTTP_OK = 200;
    public const HTTP_CREATED = 201;
    public const HTTP_BAD_REQUEST = 400;
    public const HTTP_UNAUTHORIZED = 401;
    public const HTTP_FORBIDDEN = 403;
    public const HTTP_NOT_FOUND = 404;
    public const HTTP_SERVER_ERROR = 500;
}

return response()->json($data, Response::HTTP_OK);

// Laravel uses Enums (PHP 8.1+) instead
enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
}

$order->status = OrderStatus::Paid;
```

**На собеседовании скажешь:**
> "Константы класса — неизменяемые значения через const. Доступ через self:: внутри класса, ClassName:: снаружи. Использую для статусов, типов, HTTP кодов. PHP 8.1 добавил Enum — лучше для статусов."

---

## Передача объектов (по ссылке)

**Что это:**
Объекты в PHP передаются по ссылке на значение (не копируются).

**Как работает:**
```php
class User
{
    public string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }
}

function changeName(User $user): void
{
    $user->name = 'Новое имя';  // Изменяет оригинал!
}

$user = new User('Иван');
changeName($user);
echo $user->name;  // "Новое имя" (изменился)

// Копирование объекта (clone)
$user1 = new User('Иван');
$user2 = $user1;  // Не копия! Обе переменные ссылаются на один объект

$user2->name = 'Пётр';
echo $user1->name;  // "Пётр" (изменился!)

// Реальная копия через clone
$user1 = new User('Иван');
$user2 = clone $user1;  // Копия

$user2->name = 'Пётр';
echo $user1->name;  // "Иван" (не изменился)
echo $user2->name;  // "Пётр"
```

**Когда использовать:**
Важно понимать, что изменение свойств объекта в функции влияет на оригинал. Для копии использовать `clone`.

**Пример из практики:**
```php
// Service method изменяет объект
class UserService
{
    public function activate(User $user): void
    {
        $user->is_active = true;
        $user->activated_at = now();
        $user->save();  // Eloquent сохранит изменения
    }
}

$user = User::find(1);
$service->activate($user);
// $user теперь активен (объект изменился)

// Иммутабельные объекты (Value Objects)
class Money
{
    public function __construct(
        private int $amount,
        private string $currency,
    ) {}

    public function add(Money $other): Money
    {
        // Возвращает НОВЫЙ объект, не изменяет текущий
        return new Money(
            $this->amount + $other->amount,
            $this->currency
        );
    }
}

$price = new Money(1000, 'RUB');
$total = $price->add(new Money(500, 'RUB'));
// $price не изменился (1000)
// $total — новый объект (1500)

// Клонирование для истории изменений
$order = Order::find(1);
$oldOrder = clone $order;  // Сохранить snapshot

$order->status = 'paid';
$order->save();

// Можем сравнить с $oldOrder
```

**На собеседовании скажешь:**
> "Объекты передаются по ссылке: изменение свойств в функции влияет на оригинал. Для копии использую clone. Value Objects делаю иммутабельными (методы возвращают новый объект)."

---

## Резюме классов и объектов

**Основное:**
- Класс — шаблон, объект — экземпляр класса
- `__construct` — конструктор (PHP 8.0: Constructor Property Promotion)
- Модификаторы: `public` (везде), `protected` (наследники), `private` (только класс)
- `$this` (объект), `self` (статика текущего класса), `parent` (родитель)
- Статические элементы принадлежат классу: `static $property`, `public static function()`
- Константы класса: `public const STATUS = 'active'`
- Объекты передаются по ссылке (изменения влияют на оригинал)

**Важно на собесе:**
- PHP 8.0: Constructor Property Promotion (`private string $name` в параметрах)
- Объекты не копируются при присваивании (нужен `clone`)
- `self::` для статики, `$this->` для объекта
- Инкапсуляция: скрываю реализацию (private), открываю API (public)
- Value Objects делаю иммутабельными

---

## Практические задания

### Задание 1: Создай Value Object Money

Создай класс `Money` с amount и currency. Добавь метод `add()`, который складывает две суммы (только одинаковые валюты). Сделай класс иммутабельным.

<details>
<summary>Решение</summary>

```php
final class Money
{
    public function __construct(
        private int $amount,        // В копейках
        private string $currency = 'RUB',
    ) {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }
    }

    public function getAmount(): int
    {
        return $this->amount;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    // Иммутабельный метод (возвращает новый объект)
    public function add(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException('Currency mismatch');
        }

        return new Money($this->amount + $other->amount, $this->currency);
    }

    public function subtract(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException('Currency mismatch');
        }

        return new Money($this->amount - $other->amount, $this->currency);
    }

    public function format(): string
    {
        $formatted = number_format($this->amount / 100, 2, '.', ' ');
        return "{$formatted} {$this->currency}";
    }

    public function __toString(): string
    {
        return $this->format();
    }
}

// Использование
$price = new Money(199900, 'RUB');        // 1999.00 RUB
$discount = new Money(10000, 'RUB');      // 100.00 RUB
$total = $price->subtract($discount);     // 1899.00 RUB

echo "Цена: {$price}";                    // Цена: 1 999.00 RUB
echo "Скидка: {$discount}";               // Скидка: 100.00 RUB
echo "Итого: {$total}";                   // Итого: 1 899.00 RUB

// $price не изменился (иммутабельность)
echo $price->getAmount();                 // 199900
```
</details>

### Задание 2: Singleton Pattern

Реализуй Singleton для класса `Database` — только один экземпляр может существовать.

<details>
<summary>Решение</summary>

```php
class Database
{
    private static ?Database $instance = null;
    private \PDO $connection;

    // private конструктор — нельзя создать через new
    private function __construct(
        private string $host = 'localhost',
        private string $dbname = 'test',
        private string $username = 'root',
        private string $password = '',
    ) {
        $dsn = "mysql:host={$this->host};dbname={$this->dbname};charset=utf8mb4";
        $this->connection = new \PDO($dsn, $this->username, $this->password, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
    }

    // Запретить клонирование
    private function __clone() {}

    // Запретить unserialize
    public function __wakeup()
    {
        throw new \Exception("Cannot unserialize singleton");
    }

    // Единственный способ получить экземпляр
    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function query(string $sql, array $params = []): array
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function execute(string $sql, array $params = []): bool
    {
        $stmt = $this->connection->prepare($sql);
        return $stmt->execute($params);
    }
}

// Использование
$db = Database::getInstance();
$users = $db->query('SELECT * FROM users WHERE id = ?', [1]);

// $db2 будет той же самой инстанцией
$db2 = Database::getInstance();
var_dump($db === $db2);  // true

// new Database();  // ❌ Error: Constructor is private
```
</details>

### Задание 3: Счётчик объектов

Создай класс `User`, который подсчитывает, сколько объектов было создано. Добавь статический метод `getCount()`.

<details>
<summary>Решение</summary>

```php
class User
{
    private static int $count = 0;
    private static array $instances = [];

    public function __construct(
        private string $name,
        private string $email,
    ) {
        self::$count++;
        self::$instances[] = $this;
    }

    public function __destruct()
    {
        self::$count--;
    }

    public static function getCount(): int
    {
        return self::$count;
    }

    public static function getTotalCreated(): int
    {
        return count(self::$instances);
    }

    public static function getAllInstances(): array
    {
        return self::$instances;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }
}

// Использование
echo "Count: " . User::getCount();  // 0

$user1 = new User('Иван', 'ivan@mail.com');
$user2 = new User('Пётр', 'petr@mail.com');
$user3 = new User('Анна', 'anna@mail.com');

echo "Active: " . User::getCount();          // 3
echo "Total created: " . User::getTotalCreated();  // 3

unset($user2);
echo "Active after unset: " . User::getCount();  // 2
echo "Total created: " . User::getTotalCreated();  // 3 (не изменилось)

// Получить все экземпляры
foreach (User::getAllInstances() as $user) {
    echo $user->getName() . "\n";
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
