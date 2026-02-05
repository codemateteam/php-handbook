# 10.8 Dependency Injection (DI)

## Краткое резюме

> **Dependency Injection** — передача зависимостей извне, а не создание их внутри класса.
>
> **Типы:** Constructor (обязательные), Setter (опциональные), Method (в метод).
>
> **Важно:** Laravel Service Container автоматически делает инъекцию через type-hinting. Плюсы: тестируемость, слабая связанность.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Типы инъекций](#типы-инъекций)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Dependency Injection — передача зависимостей извне, а не создание их внутри класса.

**Типы:**
- Constructor Injection (через конструктор)
- Setter Injection (через setter)
- Method Injection (через метод)

---

## Как работает

**❌ Без DI (плохо):**

```php
class OrderService
{
    private OrderRepository $repository;
    private MailService $mailService;

    public function __construct()
    {
        // Создаём зависимости внутри — жёсткая связь
        $this->repository = new MySQLOrderRepository();
        $this->mailService = new MailService();
    }

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);
        $this->mailService->sendConfirmation($order);

        return $order;
    }
}

// Проблема: нельзя протестировать, нельзя сменить реализацию
```

**✅ С DI (хорошо):**

```php
// Constructor Injection
class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private MailService $mailService
    ) {}

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);
        $this->mailService->sendConfirmation($order);

        return $order;
    }
}

// Использование
$repository = new MySQLOrderRepository();
$mailService = new MailService();
$service = new OrderService($repository, $mailService);
```

**Service Container (Laravel):**

```php
// app/Providers/AppServiceProvider.php
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind интерфейса к реализации
        $this->app->bind(
            OrderRepository::class,
            MySQLOrderRepository::class
        );

        // Singleton
        $this->app->singleton(MailService::class, function ($app) {
            return new MailService(config('mail.driver'));
        });

        // Contextual binding
        $this->app->when(OrderService::class)
            ->needs(OrderRepository::class)
            ->give(MySQLOrderRepository::class);
    }
}

// Controller — автоматическая инъекция
class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {}

    public function store(Request $request)
    {
        $order = $this->orderService->create($request->all());

        return response()->json($order);
    }
}
```

---

## Типы инъекций

**Constructor Injection (лучший):**

```php
class UserService
{
    // Зависимости обязательны
    public function __construct(
        private UserRepository $repository,
        private CacheService $cache
    ) {}
}
```

**Setter Injection:**

```php
class UserService
{
    private ?LoggerInterface $logger = null;

    // Зависимость опциональна
    public function setLogger(LoggerInterface $logger): void
    {
        $this->logger = $logger;
    }

    public function create(array $data): User
    {
        $user = $this->repository->create($data);

        $this->logger?->info("User created: {$user->id}");

        return $user;
    }
}
```

**Method Injection:**

```php
class OrderController extends Controller
{
    // Инъекция в конкретный метод
    public function store(
        Request $request,
        OrderService $service  // Method injection
    ) {
        return $service->create($request->all());
    }
}
```

---

## Когда использовать

**DI для:**
- Тестируемость (mock зависимостей)
- Слабая связанность
- Смена реализаций

**Constructor vs Setter:**
- Constructor — для обязательных зависимостей
- Setter — для опциональных

---

## Пример из практики

**Интерфейсы для DI:**

```php
// app/Contracts/PaymentGateway.php
interface PaymentGateway
{
    public function charge(float $amount): bool;
}

class StripePayment implements PaymentGateway
{
    public function charge(float $amount): bool
    {
        // Stripe API
        return true;
    }
}

class PayPalPayment implements PaymentGateway
{
    public function charge(float $amount): bool
    {
        // PayPal API
        return true;
    }
}

// Service Provider
$this->app->bind(PaymentGateway::class, function ($app) {
    return match (config('payment.default')) {
        'stripe' => new StripePayment(),
        'paypal' => new PayPalPayment(),
    };
});

// Service
class OrderService
{
    public function __construct(
        private PaymentGateway $payment  // Интерфейс, не класс
    ) {}

    public function pay(Order $order): bool
    {
        return $this->payment->charge($order->total);
    }
}
```

**Mock для тестов:**

```php
// tests/Feature/OrderServiceTest.php
class OrderServiceTest extends TestCase
{
    public function test_creates_order(): void
    {
        // Mock зависимостей
        $repository = Mockery::mock(OrderRepository::class);
        $repository->shouldReceive('create')
            ->once()
            ->andReturn(new Order(['id' => 1]));

        $mailService = Mockery::mock(MailService::class);
        $mailService->shouldReceive('sendConfirmation')
            ->once();

        // Инъекция mock объектов
        $service = new OrderService($repository, $mailService);

        $order = $service->create(['total' => 100]);

        $this->assertEquals(1, $order->id);
    }
}
```

**Facade vs DI:**

```php
// ❌ Facade — трудно тестировать
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create($data);
        Mail::send(new OrderConfirmation($order));  // Facade

        return $order;
    }
}

// ✅ DI — легко тестировать
class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private MailService $mailService
    ) {}

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);
        $this->mailService->send(new OrderConfirmation($order));

        return $order;
    }
}
```

---

## На собеседовании скажешь

> "Dependency Injection передаёт зависимости извне, не создаёт внутри. Constructor Injection для обязательных, Setter для опциональных. Laravel Service Container делает автоматическую инъекцию через type-hinting. Bind интерфейса к реализации в ServiceProvider. Плюсы: тестируемость (mock), слабая связанность, гибкость. Contextual binding для разных реализаций. Facade vs DI: DI лучше для тестов."

---

## Практические задания

### Задание 1: Реализуй Contextual Binding

У тебя есть два сервиса которым нужны разные реализации `CacheInterface`. Настрой contextual binding.

<details>
<summary>Решение</summary>

```php
// app/Contracts/CacheInterface.php
interface CacheInterface
{
    public function get(string $key): mixed;
    public function put(string $key, mixed $value, int $ttl): void;
}

// app/Services/Cache/RedisCache.php
class RedisCache implements CacheInterface
{
    public function get(string $key): mixed
    {
        return Redis::get($key);
    }

    public function put(string $key, mixed $value, int $ttl): void
    {
        Redis::setex($key, $ttl, serialize($value));
    }
}

// app/Services/Cache/MemcachedCache.php
class MemcachedCache implements CacheInterface
{
    public function get(string $key): mixed
    {
        return Memcached::get($key);
    }

    public function put(string $key, mixed $value, int $ttl): void
    {
        Memcached::set($key, $value, $ttl);
    }
}

// app/Services/UserService.php (нужен Redis)
class UserService
{
    public function __construct(
        private CacheInterface $cache
    ) {}
}

// app/Services/ProductService.php (нужен Memcached)
class ProductService
{
    public function __construct(
        private CacheInterface $cache
    ) {}
}

// app/Providers/AppServiceProvider.php
public function register(): void
{
    // Contextual binding для UserService
    $this->app->when(UserService::class)
        ->needs(CacheInterface::class)
        ->give(RedisCache::class);

    // Contextual binding для ProductService
    $this->app->when(ProductService::class)
        ->needs(CacheInterface::class)
        ->give(MemcachedCache::class);

    // Или через closure
    $this->app->when(UserService::class)
        ->needs(CacheInterface::class)
        ->give(function ($app) {
            return new RedisCache(
                $app->make('redis')->connection('users')
            );
        });
}
```
</details>

### Задание 2: Замени static Facade на DI

Рефактори код с Facade на Dependency Injection для лучшей тестируемости.

```php
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create($data);

        Mail::to($order->user->email)->send(new OrderConfirmation($order));
        Cache::forget('orders.latest');
        Log::info("Order {$order->id} created");

        return $order;
    }
}
```

<details>
<summary>Решение</summary>

```php
// Создаём интерфейсы/классы для зависимостей

// app/Services/MailService.php
class MailService
{
    public function sendOrderConfirmation(Order $order): void
    {
        Mail::to($order->user->email)->send(
            new OrderConfirmation($order)
        );
    }
}

// app/Services/CacheService.php
class CacheService
{
    public function forgetOrders(): void
    {
        Cache::forget('orders.latest');
    }
}

// app/Services/LoggerService.php
class LoggerService
{
    public function logOrderCreated(int $orderId): void
    {
        Log::info("Order {$orderId} created");
    }
}

// Рефакторинг OrderService
class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private MailService $mailService,
        private CacheService $cacheService,
        private LoggerService $logger
    ) {}

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);

        $this->mailService->sendOrderConfirmation($order);
        $this->cacheService->forgetOrders();
        $this->logger->logOrderCreated($order->id);

        return $order;
    }
}

// Тест с mocks
class OrderServiceTest extends TestCase
{
    public function test_creates_order_and_sends_notification(): void
    {
        $repository = Mockery::mock(OrderRepository::class);
        $repository->shouldReceive('create')
            ->once()
            ->andReturn(new Order(['id' => 1]));

        $mailService = Mockery::mock(MailService::class);
        $mailService->shouldReceive('sendOrderConfirmation')
            ->once();

        $cacheService = Mockery::mock(CacheService::class);
        $cacheService->shouldReceive('forgetOrders')
            ->once();

        $logger = Mockery::mock(LoggerService::class);
        $logger->shouldReceive('logOrderCreated')
            ->once()
            ->with(1);

        $service = new OrderService(
            $repository,
            $mailService,
            $cacheService,
            $logger
        );

        $order = $service->create(['total' => 100]);

        $this->assertEquals(1, $order->id);
    }
}
```
</details>

### Задание 3: Реализуй Service Provider с binding

Создай `PaymentServiceProvider` который регистрирует разные Payment Gateways.

<details>
<summary>Решение</summary>

```php
// app/Contracts/PaymentGatewayInterface.php
interface PaymentGatewayInterface
{
    public function charge(float $amount, array $details): bool;
    public function refund(string $transactionId): bool;
}

// app/Services/Payment/StripePayment.php
class StripePayment implements PaymentGatewayInterface
{
    public function __construct(
        private string $apiKey
    ) {}

    public function charge(float $amount, array $details): bool
    {
        // Stripe charge logic
        return true;
    }

    public function refund(string $transactionId): bool
    {
        // Stripe refund logic
        return true;
    }
}

// app/Services/Payment/PayPalPayment.php
class PayPalPayment implements PaymentGatewayInterface
{
    public function __construct(
        private string $clientId,
        private string $secret
    ) {}

    public function charge(float $amount, array $details): bool
    {
        // PayPal charge logic
        return true;
    }

    public function refund(string $transactionId): bool
    {
        // PayPal refund logic
        return true;
    }
}

// app/Providers/PaymentServiceProvider.php
namespace App\Providers;

use App\Contracts\PaymentGatewayInterface;
use App\Services\Payment\StripePayment;
use App\Services\Payment\PayPalPayment;
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Singleton для Stripe
        $this->app->singleton(StripePayment::class, function ($app) {
            return new StripePayment(
                apiKey: config('services.stripe.secret')
            );
        });

        // Singleton для PayPal
        $this->app->singleton(PayPalPayment::class, function ($app) {
            return new PayPalPayment(
                clientId: config('services.paypal.client_id'),
                secret: config('services.paypal.secret')
            );
        });

        // Default binding
        $this->app->bind(
            PaymentGatewayInterface::class,
            function ($app) {
                return match (config('payment.default_gateway')) {
                    'stripe' => $app->make(StripePayment::class),
                    'paypal' => $app->make(PayPalPayment::class),
                    default => $app->make(StripePayment::class),
                };
            }
        );

        // Именованные binding
        $this->app->bind('payment.stripe', StripePayment::class);
        $this->app->bind('payment.paypal', PayPalPayment::class);
    }

    public function boot(): void
    {
        // Boot logic if needed
    }
}

// config/app.php - добавить provider
'providers' => [
    // ...
    App\Providers\PaymentServiceProvider::class,
],

// Использование
class OrderController extends Controller
{
    public function __construct(
        private PaymentGatewayInterface $payment
    ) {}

    public function pay(Request $request)
    {
        $success = $this->payment->charge(
            $request->amount,
            $request->payment_details
        );

        return $success
            ? response()->json(['message' => 'Payment successful'])
            : response()->json(['message' => 'Payment failed'], 400);
    }
}

// Использование конкретного gateway
$stripeGateway = app('payment.stripe');
$paypalGateway = app('payment.paypal');
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
