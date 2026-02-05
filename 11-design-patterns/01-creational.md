# 11.1 Порождающие паттерны (Creational Patterns)

## Краткое резюме

> **Creational Patterns** — паттерны для создания объектов. Абстрагируют процесс инстанцирования.
>
> **Основные:** Singleton (один экземпляр), Factory Method (создание по типу), Abstract Factory (семейства объектов), Builder (сложное создание), Prototype (клонирование).
>
> **Laravel примеры:** Service Container singleton, Model Factories, Query Builder.

---

## Содержание

- [Что это](#что-это)
- [Singleton](#1-singleton)
- [Factory Method](#2-factory-method)
- [Abstract Factory](#3-abstract-factory)
- [Builder](#4-builder)
- [Prototype](#5-prototype)
- [Сравнение](#сравнение)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Creational Patterns:**
Паттерны для создания объектов. Абстрагируют процесс инстанцирования.

**Зачем:**
- Гибкое создание объектов
- Скрыть сложность создания
- Переиспользование кода

**Основные паттерны:**
1. Singleton
2. Factory Method
3. Abstract Factory
4. Builder
5. Prototype

---

## 1. Singleton

**Что это:**
Гарантирует что класс имеет только один экземпляр и предоставляет глобальную точку доступа.

**Когда использовать:**
- Database connection
- Logger
- Configuration
- Cache manager

**Реализация:**

```php
class Database
{
    private static ?Database $instance = null;
    private PDO $connection;

    // Private constructor (нельзя создать извне)
    private function __construct()
    {
        $this->connection = new PDO(
            'mysql:host=localhost;dbname=mydb',
            'user',
            'password'
        );
    }

    // Private clone (нельзя клонировать)
    private function __clone() {}

    // Private unserialize (нельзя десериализовать)
    public function __wakeup()
    {
        throw new Exception("Cannot unserialize singleton");
    }

    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            self::$instance = new Database();
        }

        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->connection;
    }
}

// Использование
$db1 = Database::getInstance();
$db2 = Database::getInstance();

var_dump($db1 === $db2);  // true (тот же объект)
```

**Laravel Singleton:**

```php
// Service Provider
$this->app->singleton(PaymentGateway::class, function ($app) {
    return new StripeGateway(config('stripe.key'));
});

// Везде один и тот же экземпляр
$gateway1 = app(PaymentGateway::class);
$gateway2 = app(PaymentGateway::class);

var_dump($gateway1 === $gateway2);  // true
```

**Минусы Singleton:**
- ❌ Global state (тестирование сложнее)
- ❌ Tight coupling
- ❌ Multithreading issues

**Альтернатива: Dependency Injection**

```php
// Вместо Singleton
class OrderService
{
    public function __construct(
        private PaymentGateway $gateway  // DI вместо Singleton
    ) {}
}
```

---

## 2. Factory Method

**Что это:**
Определяет интерфейс для создания объектов, но позволяет подклассам решать какой класс инстанцировать.

**Когда использовать:**
- Неизвестен заранее тип создаваемого объекта
- Создание объектов делегируется подклассам

**Проблема без Factory:**

```php
// Плохо: if/switch в клиентском коде
$type = 'credit_card';

if ($type === 'credit_card') {
    $gateway = new CreditCardGateway();
} elseif ($type === 'paypal') {
    $gateway = new PayPalGateway();
} elseif ($type === 'crypto') {
    $gateway = new CryptoGateway();
}

$gateway->charge($amount);
```

**Решение: Factory Method**

```php
abstract class PaymentGatewayFactory
{
    abstract public function createGateway(): PaymentGateway;

    public function processPayment(int $amount): Payment
    {
        $gateway = $this->createGateway();
        return $gateway->charge($amount);
    }
}

class CreditCardGatewayFactory extends PaymentGatewayFactory
{
    public function createGateway(): PaymentGateway
    {
        return new CreditCardGateway();
    }
}

class PayPalGatewayFactory extends PaymentGatewayFactory
{
    public function createGateway(): PaymentGateway
    {
        return new PayPalGateway();
    }
}

// Использование
$factory = new CreditCardGatewayFactory();
$payment = $factory->processPayment(100);
```

**Простая Factory (не паттерн Gang of Four, но полезно):**

```php
class PaymentGatewayFactory
{
    public static function create(string $type): PaymentGateway
    {
        return match ($type) {
            'credit_card' => new CreditCardGateway(),
            'paypal' => new PayPalGateway(),
            'crypto' => new CryptoGateway(),
            default => throw new InvalidArgumentException("Unknown type: {$type}"),
        };
    }
}

// Использование
$gateway = PaymentGatewayFactory::create('credit_card');
$gateway->charge($amount);
```

**Laravel Factory для Models:**

```php
// database/factories/UserFactory.php
class UserFactory extends Factory
{
    public function definition()
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
        ];
    }

    public function admin()
    {
        return $this->state(fn (array $attributes) => [
            'is_admin' => true,
        ]);
    }
}

// Использование
$user = User::factory()->create();
$admin = User::factory()->admin()->create();
```

---

## 3. Abstract Factory

**Что это:**
Предоставляет интерфейс для создания семейств связанных объектов без указания конкретных классов.

**Когда использовать:**
- Нужно создавать семейства связанных объектов
- Система должна быть независима от способа создания объектов

**Пример: UI Components**

```php
// Abstract Factory
interface UIFactory
{
    public function createButton(): Button;
    public function createCheckbox(): Checkbox;
}

// Concrete Factories
class WindowsUIFactory implements UIFactory
{
    public function createButton(): Button
    {
        return new WindowsButton();
    }

    public function createCheckbox(): Checkbox
    {
        return new WindowsCheckbox();
    }
}

class MacUIFactory implements UIFactory
{
    public function createButton(): Button
    {
        return new MacButton();
    }

    public function createCheckbox(): Checkbox
    {
        return new MacCheckbox();
    }
}

// Products
interface Button
{
    public function render(): string;
}

class WindowsButton implements Button
{
    public function render(): string
    {
        return '<button class="windows">Click</button>';
    }
}

class MacButton implements Button
{
    public function render(): string
    {
        return '<button class="mac">Click</button>';
    }
}

// Client
class Application
{
    private Button $button;
    private Checkbox $checkbox;

    public function __construct(UIFactory $factory)
    {
        $this->button = $factory->createButton();
        $this->checkbox = $factory->createCheckbox();
    }

    public function render(): string
    {
        return $this->button->render() . $this->checkbox->render();
    }
}

// Использование
$os = 'windows';
$factory = $os === 'windows' ? new WindowsUIFactory() : new MacUIFactory();

$app = new Application($factory);
echo $app->render();
```

**Laravel Example: Notification Channels**

```php
interface NotificationFactory
{
    public function createEmailChannel(): EmailChannel;
    public function createSmsChannel(): SmsChannel;
}

class ProductionNotificationFactory implements NotificationFactory
{
    public function createEmailChannel(): EmailChannel
    {
        return new SmtpEmailChannel(config('mail.smtp'));
    }

    public function createSmsChannel(): SmsChannel
    {
        return new TwilioSmsChannel(config('services.twilio'));
    }
}

class TestingNotificationFactory implements NotificationFactory
{
    public function createEmailChannel(): EmailChannel
    {
        return new LogEmailChannel();  // Логировать вместо отправки
    }

    public function createSmsChannel(): SmsChannel
    {
        return new LogSmsChannel();
    }
}
```

---

## 4. Builder

**Что это:**
Отделяет конструирование сложного объекта от его представления. Позволяет создавать разные представления используя один и тот же процесс.

**Когда использовать:**
- Объект имеет много optional параметров
- Процесс создания сложный (несколько шагов)

**Проблема без Builder:**

```php
// Telescoping Constructor Anti-Pattern
class Pizza
{
    public function __construct(
        private string $size,
        private bool $cheese = false,
        private bool $pepperoni = false,
        private bool $bacon = false,
        private bool $mushrooms = false,
        private bool $olives = false
    ) {}
}

// Использование: сложно читать
$pizza = new Pizza('large', true, false, true, false, true);
```

**Решение: Builder**

```php
class Pizza
{
    private string $size;
    private bool $cheese = false;
    private bool $pepperoni = false;
    private bool $bacon = false;

    private function __construct() {}

    public static function builder(): PizzaBuilder
    {
        return new PizzaBuilder();
    }

    // Getters...
}

class PizzaBuilder
{
    private Pizza $pizza;

    public function __construct()
    {
        $this->pizza = new Pizza();
    }

    public function size(string $size): self
    {
        $this->pizza->size = $size;
        return $this;
    }

    public function withCheese(): self
    {
        $this->pizza->cheese = true;
        return $this;
    }

    public function withPepperoni(): self
    {
        $this->pizza->pepperoni = true;
        return $this;
    }

    public function withBacon(): self
    {
        $this->pizza->bacon = true;
        return $this;
    }

    public function build(): Pizza
    {
        return $this->pizza;
    }
}

// Использование: fluent, читаемо
$pizza = Pizza::builder()
    ->size('large')
    ->withCheese()
    ->withBacon()
    ->build();
```

**Laravel Query Builder:**

```php
// Laravel Query Builder = Builder Pattern!
$users = DB::table('users')
    ->where('active', true)
    ->where('age', '>', 18)
    ->orderBy('name')
    ->limit(10)
    ->get();

// Eloquent Builder
$posts = Post::query()
    ->with('author')
    ->where('published', true)
    ->latest()
    ->paginate(20);
```

**HTTP Request Builder:**

```php
$response = Http::withHeaders([
        'X-Api-Key' => 'secret',
    ])
    ->timeout(30)
    ->retry(3, 100)
    ->post('https://api.example.com/users', [
        'name' => 'John',
    ]);
```

---

## 5. Prototype

**Что это:**
Создание новых объектов путем копирования (клонирования) существующих.

**Когда использовать:**
- Создание объекта дорого (DB query, API call)
- Нужно создать много похожих объектов

**Реализация:**

```php
class Product
{
    public function __construct(
        public string $name,
        public float $price,
        public array $attributes = []
    ) {}

    public function __clone()
    {
        // Deep clone для массивов/объектов
        $this->attributes = array_map(
            fn($attr) => is_object($attr) ? clone $attr : $attr,
            $this->attributes
        );
    }
}

// Создать прототип
$prototype = new Product('Laptop', 1000, [
    'brand' => 'Dell',
    'warranty' => '2 years',
]);

// Клонировать и модифицировать
$product1 = clone $prototype;
$product1->name = 'Gaming Laptop';
$product1->price = 1500;

$product2 = clone $prototype;
$product2->name = 'Business Laptop';
$product2->price = 1200;
```

**Laravel Eloquent:**

```php
// Replicate = Prototype Pattern
$user = User::find(1);

$newUser = $user->replicate();
$newUser->email = 'newemail@example.com';
$newUser->save();

// Replicate с relationships
$post = Post::with('tags')->find(1);
$newPost = $post->replicate();
$newPost->push();  // Save with relationships
```

---

## Сравнение

| Pattern | Use Case | Laravel Example |
|---------|----------|-----------------|
| Singleton | Один экземпляр | Service Container singleton |
| Factory Method | Создание по типу | Model factories |
| Abstract Factory | Семейства объектов | Notification channels |
| Builder | Сложное создание | Query Builder, HTTP Builder |
| Prototype | Клонирование | Model replicate() |

---

## На собеседовании скажешь

> "Creational Patterns для создания объектов. Singleton: один экземпляр, Laravel singleton() в Container. Factory Method: создание по типу, простая factory через match. Abstract Factory: семейства связанных объектов. Builder: fluent interface для сложных объектов, Laravel Query Builder пример. Prototype: клонирование объектов, Eloquent replicate(). Factory и Builder наиболее популярны в Laravel. Singleton редко нужен (DI лучше). Builder для читаемого API с optional параметрами."

---

## Практические задания

### Задание 1: Реализуй Simple Factory

Создай `PaymentFactory` с методом `create()` который возвращает разные payment gateway по типу: `stripe`, `paypal`, `crypto`.

<details>
<summary>Решение</summary>

```php
interface PaymentGateway
{
    public function charge(int $amount): Payment;
}

class StripeGateway implements PaymentGateway
{
    public function charge(int $amount): Payment
    {
        // Stripe logic
        return new Payment('stripe', $amount);
    }
}

class PayPalGateway implements PaymentGateway
{
    public function charge(int $amount): Payment
    {
        // PayPal logic
        return new Payment('paypal', $amount);
    }
}

class PaymentFactory
{
    public static function create(string $type): PaymentGateway
    {
        return match ($type) {
            'stripe' => new StripeGateway(),
            'paypal' => new PayPalGateway(),
            'crypto' => new CryptoGateway(),
            default => throw new InvalidArgumentException("Unknown type: {$type}"),
        };
    }
}

// Использование
$gateway = PaymentFactory::create('stripe');
$payment = $gateway->charge(1000);
```
</details>

### Задание 2: Реализуй Builder Pattern

Создай `QueryBuilder` для построения SQL запросов с методами `select()`, `where()`, `orderBy()`, `limit()`.

<details>
<summary>Решение</summary>

```php
class QueryBuilder
{
    private string $table;
    private array $selects = ['*'];
    private array $wheres = [];
    private ?string $orderBy = null;
    private ?int $limit = null;

    public function __construct(string $table)
    {
        $this->table = $table;
    }

    public function select(array $columns): self
    {
        $this->selects = $columns;
        return $this;
    }

    public function where(string $column, string $operator, mixed $value): self
    {
        $this->wheres[] = [$column, $operator, $value];
        return $this;
    }

    public function orderBy(string $column, string $direction = 'ASC'): self
    {
        $this->orderBy = "{$column} {$direction}";
        return $this;
    }

    public function limit(int $limit): self
    {
        $this->limit = $limit;
        return $this;
    }

    public function toSql(): string
    {
        $sql = "SELECT " . implode(', ', $this->selects);
        $sql .= " FROM {$this->table}";

        if ($this->wheres) {
            $conditions = array_map(
                fn($w) => "{$w[0]} {$w[1]} '{$w[2]}'",
                $this->wheres
            );
            $sql .= " WHERE " . implode(' AND ', $conditions);
        }

        if ($this->orderBy) {
            $sql .= " ORDER BY {$this->orderBy}";
        }

        if ($this->limit) {
            $sql .= " LIMIT {$this->limit}";
        }

        return $sql;
    }
}

// Использование
$sql = (new QueryBuilder('users'))
    ->select(['name', 'email'])
    ->where('active', '=', 1)
    ->orderBy('created_at', 'DESC')
    ->limit(10)
    ->toSql();
```
</details>

### Задание 3: В чём проблема Singleton?

Почему Singleton считается антипаттерном? Какая альтернатива?

<details>
<summary>Решение</summary>

**Проблемы Singleton:**

1. **Global State** - глобальное изменяемое состояние усложняет тестирование
2. **Tight Coupling** - код жёстко завязан на конкретный класс
3. **Hidden Dependencies** - зависимости скрыты (не видны в конструкторе)
4. **Сложно тестировать** - нельзя подменить mock
5. **Multithreading issues** - проблемы в многопоточной среде

**Альтернатива: Dependency Injection**

```php
// Плохо: Singleton
class OrderService
{
    public function process(Order $order)
    {
        $gateway = PaymentGateway::getInstance();  // Скрытая зависимость
        $gateway->charge($order->total);
    }
}

// Хорошо: DI
class OrderService
{
    public function __construct(
        private PaymentGateway $gateway  // Явная зависимость
    ) {}

    public function process(Order $order)
    {
        $this->gateway->charge($order->total);
    }
}

// В Service Container
$this->app->singleton(PaymentGateway::class, StripeGateway::class);
```

**Когда Singleton допустим:**
- Логирование (простая write-only операция)
- Configuration (read-only данные)
- Connection pools (контролируемый shared resource)
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
