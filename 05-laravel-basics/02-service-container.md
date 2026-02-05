# 4.2 Service Container

## Краткое резюме

> **Service Container** — IoC контейнер для управления зависимостями в Laravel.
>
> **Регистрация:** `bind()` (новый экземпляр), `singleton()` (один на запрос), `instance()` (существующий объект).
>
> **Важно:** Автоматическая инъекция через конструктор, интерфейсы связываются с реализациями.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Service Container (IoC контейнер) — ядро Laravel для управления зависимостями. Автоматически создаёт объекты и внедряет их зависимости.

**Основное:**
- Регистрация сервисов (`bind`, `singleton`)
- Разрешение зависимостей (автоматическая инъекция)
- Dependency Injection через конструктор

---

## Как работает

**Регистрация сервисов:**

```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    // bind — каждый раз новый экземпляр
    $this->app->bind(PaymentGateway::class, StripeGateway::class);

    // singleton — один экземпляр на весь запрос
    $this->app->singleton(CacheService::class, function ($app) {
        return new CacheService(
            $app->make('cache.store')
        );
    });

    // instance — использовать уже существующий объект
    $logger = new Logger('app');
    $this->app->instance(Logger::class, $logger);
}
```

**Разрешение зависимостей:**

```php
// 1. Через конструктор (автоматически)
class OrderController extends Controller
{
    // Laravel автоматически создаст OrderService
    public function __construct(
        private OrderService $orderService
    ) {}
}

// 2. Через app() helper
$service = app(OrderService::class);

// 3. Через resolve()
$service = resolve(OrderService::class);

// 4. Через make()
$service = app()->make(OrderService::class);

// 5. Через фасад
use Illuminate\Support\Facades\App;
$service = App::make(OrderService::class);
```

**Contextual Binding (контекстная привязка):**

```php
// Разные реализации для разных классов
public function register(): void
{
    // OrderService получит StripeGateway
    $this->app->when(OrderService::class)
        ->needs(PaymentGateway::class)
        ->give(StripeGateway::class);

    // RefundService получит PayPalGateway
    $this->app->when(RefundService::class)
        ->needs(PaymentGateway::class)
        ->give(PayPalGateway::class);
}
```

**Binding Interfaces:**

```php
// Интерфейс
interface PaymentGateway
{
    public function charge(int $amount): bool;
}

// Реализация
class StripeGateway implements PaymentGateway
{
    public function charge(int $amount): bool
    {
        // Stripe API
    }
}

// Регистрация
public function register(): void
{
    $this->app->bind(
        PaymentGateway::class,
        StripeGateway::class
    );
}

// Использование
class OrderService
{
    // Автоматически получит StripeGateway
    public function __construct(
        private PaymentGateway $gateway
    ) {}
}
```

---

## Когда использовать

**Используй когда:**
- Нужна подмена реализаций (интерфейсы)
- Тестирование (mock зависимостей)
- Singleton сервисы (например, логгер)
- Сложная инициализация объектов

**Не используй когда:**
- Простые value objects без зависимостей
- DTO (Data Transfer Objects)
- Eloquent модели (они сами создаются)

---

## Пример из практики

**Типичный пример с интерфейсами:**

```php
// 1. Интерфейс (app/Contracts/NotificationService.php)
interface NotificationService
{
    public function send(User $user, string $message): void;
}

// 2. Реализации
class EmailNotificationService implements NotificationService
{
    public function __construct(
        private Mailer $mailer
    ) {}

    public function send(User $user, string $message): void
    {
        $this->mailer->to($user->email)->send(new Notification($message));
    }
}

class SmsNotificationService implements NotificationService
{
    public function __construct(
        private SmsGateway $gateway
    ) {}

    public function send(User $user, string $message): void
    {
        $this->gateway->send($user->phone, $message);
    }
}

// 3. Регистрация (app/Providers/AppServiceProvider.php)
public function register(): void
{
    // Выбор реализации по конфигу
    $this->app->bind(
        NotificationService::class,
        config('notifications.driver') === 'sms'
            ? SmsNotificationService::class
            : EmailNotificationService::class
    );
}

// 4. Использование
class OrderService
{
    public function __construct(
        private NotificationService $notificationService
    ) {}

    public function create(User $user, array $data): Order
    {
        $order = Order::create($data);

        // Отправит через Email или SMS в зависимости от конфига
        $this->notificationService->send(
            $user,
            "Заказ #{$order->id} создан"
        );

        return $order;
    }
}
```

**Singleton для дорогих операций:**

```php
// Service Provider
public function register(): void
{
    // Один экземпляр на весь запрос
    $this->app->singleton(ElasticsearchClient::class, function ($app) {
        return new ElasticsearchClient(
            config('services.elasticsearch.host')
        );
    });
}

// Использование в разных контроллерах
class ProductController
{
    public function __construct(
        private ElasticsearchClient $elasticsearch
    ) {}

    public function search(Request $request)
    {
        // Используется тот же экземпляр, что и в UserController
        return $this->elasticsearch->search($request->query('q'));
    }
}
```

**Contextual Binding для разных реализаций:**

```php
// Service Provider
public function register(): void
{
    // ProductService использует ProductCache
    $this->app->when(ProductService::class)
        ->needs(CacheRepository::class)
        ->give(function ($app) {
            return new ProductCache(
                $app->make('cache.store'),
                ttl: 3600
            );
        });

    // UserService использует UserCache
    $this->app->when(UserService::class)
        ->needs(CacheRepository::class)
        ->give(function ($app) {
            return new UserCache(
                $app->make('cache.store'),
                ttl: 600
            );
        });
}
```

**Tagged Services (группировка):**

```php
// Регистрация с тегами
public function register(): void
{
    $this->app->bind(StripePayment::class);
    $this->app->bind(PayPalPayment::class);
    $this->app->bind(YandexPayment::class);

    $this->app->tag([
        StripePayment::class,
        PayPalPayment::class,
        YandexPayment::class,
    ], 'payment.gateways');
}

// Использование всех сервисов с тегом
class PaymentRouter
{
    private array $gateways;

    public function __construct()
    {
        // Получить все сервисы с тегом
        $this->gateways = app()->tagged('payment.gateways');
    }

    public function route(string $method): PaymentGateway
    {
        foreach ($this->gateways as $gateway) {
            if ($gateway->supports($method)) {
                return $gateway;
            }
        }

        throw new UnsupportedPaymentException();
    }
}
```

**Extending (расширение связанных сервисов):**

```php
// Изменить существующую регистрацию
public function register(): void
{
    $this->app->extend(PaymentService::class, function ($service, $app) {
        // Добавить логирование
        return new PaymentServiceWithLogging(
            $service,
            $app->make(Logger::class)
        );
    });
}
```

**Тестирование с mock:**

```php
// tests/Feature/OrderTest.php
public function test_order_creation_sends_notification()
{
    // Mock NotificationService
    $notificationMock = Mockery::mock(NotificationService::class);
    $notificationMock->shouldReceive('send')
        ->once()
        ->with(Mockery::type(User::class), Mockery::type('string'));

    // Подменить в контейнере
    $this->app->instance(NotificationService::class, $notificationMock);

    // Тест
    $user = User::factory()->create();
    $response = $this->actingAs($user)->postJson('/api/orders', [
        'product_id' => 1,
        'quantity' => 2,
    ]);

    $response->assertStatus(201);
}
```

---

## На собеседовании скажешь

> "Service Container — IoC контейнер для DI в Laravel. bind() создаёт новый экземпляр каждый раз, singleton() — один на запрос. Автоматическая инъекция через конструктор. Регистрирую в Service Providers. Интерфейсы связываю с реализациями через bind(Interface::class, Implementation::class). Contextual binding для разных реализаций. В тестах подменяю через app()->instance()."

---

## Практические задания

### Задание 1: Настрой Contextual Binding

У тебя есть два сервиса: `EmailService` и `SmsService`. Оба реализуют `NotificationInterface`. `OrderService` должен использовать Email, а `UserService` — SMS. Настрой контейнер.

<details>
<summary>Решение</summary>

```php
// 1. Интерфейс (app/Contracts/NotificationInterface.php)
interface NotificationInterface
{
    public function send(string $message): void;
}

// 2. Реализации
class EmailService implements NotificationInterface
{
    public function send(string $message): void
    {
        Mail::raw($message, function ($mail) {
            $mail->to('user@example.com');
        });
    }
}

class SmsService implements NotificationInterface
{
    public function send(string $message): void
    {
        // SMS gateway API
    }
}

// 3. Service Provider (app/Providers/AppServiceProvider.php)
public function register(): void
{
    // OrderService получит EmailService
    $this->app->when(OrderService::class)
        ->needs(NotificationInterface::class)
        ->give(EmailService::class);

    // UserService получит SmsService
    $this->app->when(UserService::class)
        ->needs(NotificationInterface::class)
        ->give(SmsService::class);
}

// 4. Использование
class OrderService
{
    public function __construct(
        private NotificationInterface $notification
    ) {}

    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Отправит через Email
        $this->notification->send("Order #{$order->id} created");

        return $order;
    }
}

class UserService
{
    public function __construct(
        private NotificationInterface $notification
    ) {}

    public function register(array $data): User
    {
        $user = User::create($data);

        // Отправит через SMS
        $this->notification->send("Welcome {$user->name}!");

        return $user;
    }
}
```
</details>

### Задание 2: Singleton vs Bind

Когда использовать `singleton()`, а когда `bind()`? Приведи примеры.

<details>
<summary>Решение</summary>

```php
// ✅ SINGLETON — один экземпляр на весь запрос
// Используй для:
// - Дорогих операций (DB подключения, HTTP клиенты)
// - Stateful сервисов (кеш, логгер)
// - Сервисов без изменяемого состояния

public function register(): void
{
    // 1. Database Connection
    $this->app->singleton(DatabaseConnection::class, function ($app) {
        return new DatabaseConnection(
            config('database.host'),
            config('database.port')
        );
    });

    // 2. Logger (stateful)
    $this->app->singleton(Logger::class, function ($app) {
        return new Logger(storage_path('logs/app.log'));
    });

    // 3. HTTP Client
    $this->app->singleton(HttpClient::class, function ($app) {
        return new HttpClient([
            'base_uri' => config('services.api.base_url'),
            'timeout' => 30,
        ]);
    });

    // 4. Cache Service
    $this->app->singleton(CacheService::class, function ($app) {
        return new CacheService($app->make('cache.store'));
    });
}

// ✅ BIND — новый экземпляр каждый раз
// Используй для:
// - Stateless сервисов
// - Value Objects
// - Сервисов с изменяемым состоянием

public function register(): void
{
    // 1. Order Calculator (каждый расчёт — новый объект)
    $this->app->bind(OrderCalculator::class, function ($app) {
        return new OrderCalculator(
            taxRate: config('shop.tax_rate')
        );
    });

    // 2. PDF Generator (новый файл каждый раз)
    $this->app->bind(PdfGenerator::class, function ($app) {
        return new PdfGenerator();
    });

    // 3. Payment Processor (новая транзакция)
    $this->app->bind(PaymentProcessor::class, function ($app) {
        return new PaymentProcessor(
            $app->make(PaymentGateway::class)
        );
    });
}

// Пример проблемы с bind вместо singleton
class OrderService
{
    public function __construct(
        private DatabaseConnection $db  // ❌ Каждый раз новое подключение!
    ) {}
}

// Если зарегистрирован через bind():
$service1 = app(OrderService::class);  // Создаст DB connection #1
$service2 = app(OrderService::class);  // Создаст DB connection #2 (плохо!)

// Если зарегистрирован через singleton():
$service1 = app(OrderService::class);  // Создаст DB connection #1
$service2 = app(OrderService::class);  // Использует DB connection #1 (хорошо!)
```

**Правило:**
- **singleton()** — если сервис **дорогой** или **stateful**
- **bind()** — если сервис **дешёвый** и **stateless**
</details>

### Задание 3: Mock сервис в тесте

Тебе нужно протестировать `OrderService`, но не вызывать реальный `PaymentGateway`. Как подменить?

<details>
<summary>Решение</summary>

```php
// Service (app/Services/OrderService.php)
class OrderService
{
    public function __construct(
        private PaymentGateway $paymentGateway
    ) {}

    public function create(User $user, array $data): Order
    {
        $order = Order::create([
            'user_id' => $user->id,
            'total' => $data['total'],
        ]);

        // Оплата через gateway
        $this->paymentGateway->charge($order->total);

        return $order;
    }
}

// Test (tests/Feature/OrderServiceTest.php)
use Mockery;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    public function test_order_creation_charges_payment()
    {
        // 1. Создать mock PaymentGateway
        $paymentMock = Mockery::mock(PaymentGateway::class);

        // 2. Настроить ожидания
        $paymentMock->shouldReceive('charge')
            ->once()
            ->with(1000)
            ->andReturn(true);

        // 3. Подменить в контейнере
        $this->app->instance(PaymentGateway::class, $paymentMock);

        // 4. Тест
        $user = User::factory()->create();
        $service = app(OrderService::class);  // Получит наш mock

        $order = $service->create($user, ['total' => 1000]);

        // 5. Проверки
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'user_id' => $user->id,
            'total' => 1000,
        ]);
    }

    public function test_payment_failure_throws_exception()
    {
        // Mock с исключением
        $paymentMock = Mockery::mock(PaymentGateway::class);
        $paymentMock->shouldReceive('charge')
            ->once()
            ->andThrow(new PaymentException('Card declined'));

        $this->app->instance(PaymentGateway::class, $paymentMock);

        // Ожидаем исключение
        $this->expectException(PaymentException::class);
        $this->expectExceptionMessage('Card declined');

        $user = User::factory()->create();
        $service = app(OrderService::class);
        $service->create($user, ['total' => 1000]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}

// Альтернатива: Laravel Mock (без Mockery)
class OrderServiceTest extends TestCase
{
    public function test_with_laravel_mock()
    {
        // Создать mock
        $paymentMock = $this->createMock(PaymentGateway::class);

        // Настроить ожидания
        $paymentMock->expects($this->once())
            ->method('charge')
            ->with(1000)
            ->willReturn(true);

        // Подменить
        $this->app->instance(PaymentGateway::class, $paymentMock);

        // Тест
        $user = User::factory()->create();
        $service = app(OrderService::class);
        $order = $service->create($user, ['total' => 1000]);

        $this->assertEquals(1000, $order->total);
    }
}
```

**Способы подмены:**
1. **app()->instance()** — подменить любой класс
2. **Mockery::mock()** — мощный mock framework
3. **createMock()** — встроенный PHPUnit mock
4. **bind()** в тесте — временная регистрация

```php
// Способ 4: Временная регистрация
public function test_with_fake_implementation()
{
    // Fake реализация
    $this->app->bind(PaymentGateway::class, function () {
        return new class implements PaymentGateway {
            public function charge(int $amount): bool
            {
                return true;  // Всегда успешно
            }
        };
    });

    // Тест
    $service = app(OrderService::class);
    // ...
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
