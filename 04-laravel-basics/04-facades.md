# 4.4 Facades

## Краткое резюме

> **Facades** — статический интерфейс к сервисам из Service Container.
>
> **Пример:** `Cache::get()` вместо `app('cache')->get()`. Используется `__callStatic()` для вызова методов.
>
> **Важно:** Можно mock-ать в тестах, Real-time Facades через `Facades\App\Services\ServiceName`.

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
Facades — статический интерфейс к классам в Service Container. Выглядят как статические методы, но работают через контейнер.

**Основное:**
- `Cache::get()` вместо `app('cache')->get()`
- Статический синтаксис, динамическое связывание
- Testable (можно mock-ать)

---

## Как работает

**Внутреннее устройство:**

```php
// Facade класс
use Illuminate\Support\Facades\Facade;

class Cache extends Facade
{
    // Ключ в контейнере
    protected static function getFacadeAccessor()
    {
        return 'cache';
    }
}

// Использование
Cache::get('key');  // Эквивалентно app('cache')->get('key')
```

**Magic method __callStatic:**

```php
// Внутри Facade класса
public static function __callStatic($method, $args)
{
    $instance = static::getFacadeRoot();  // Получить из контейнера

    return $instance->$method(...$args);  // Вызвать метод
}
```

**Популярные Facades:**

```php
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;

// Database
DB::table('users')->where('active', 1)->get();

// Cache
Cache::remember('users', 3600, fn() => User::all());

// Logs
Log::info('User registered', ['user_id' => $user->id]);

// Storage
Storage::disk('s3')->put('file.txt', 'content');

// Mail
Mail::to($user)->send(new Welcome($user));
```

**Real-time Facades (автоматические):**

```php
// Обычный класс (БЕЗ Facade)
namespace App\Services;

class PaymentService
{
    public function charge(int $amount): bool
    {
        // Logic
    }
}

// Использование через Real-time Facade
use Facades\App\Services\PaymentService;

PaymentService::charge(1000);  // Автоматически создаётся facade
```

---

## Когда использовать

**Плюсы:**
- ✅ Короткий синтаксис
- ✅ Testable (можно mock)
- ✅ IDE autocompletion (с laravel-ide-helper)

**Минусы:**
- ❌ Скрывает зависимости (не видны в конструкторе)
- ❌ Сложнее тестировать (нужны специальные методы)
- ❌ Статические вызовы выглядят как глобальное состояние

**Когда использовать:**
- Routes, migrations, seeders (короткий код)
- Controllers (если не злоупотреблять)

**Когда НЕ использовать:**
- Services (лучше DI через конструктор)
- Тесты (mock facades сложнее)

---

## Пример из практики

**Использование в контроллере:**

```php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProductController extends Controller
{
    public function index()
    {
        // Cache facade
        $products = Cache::remember('products.all', 3600, function () {
            Log::info('Loading products from database');
            return Product::all();
        });

        return view('products.index', compact('products'));
    }

    public function store(Request $request)
    {
        $product = Product::create($request->validated());

        // Cache очистка
        Cache::forget('products.all');

        // Log
        Log::info('Product created', ['id' => $product->id]);

        return redirect()->route('products.show', $product);
    }
}
```

**Создание кастомного Facade:**

```php
// 1. Сервис (app/Services/PaymentService.php)
namespace App\Services;

class PaymentService
{
    public function charge(User $user, int $amount): bool
    {
        // Payment logic
        return true;
    }

    public function refund(Order $order): bool
    {
        // Refund logic
        return true;
    }
}

// 2. Регистрация в Service Provider
public function register(): void
{
    $this->app->singleton('payment', function ($app) {
        return new PaymentService();
    });
}

// 3. Facade класс (app/Facades/Payment.php)
namespace App\Facades;

use Illuminate\Support\Facades\Facade;

class Payment extends Facade
{
    protected static function getFacadeAccessor()
    {
        return 'payment';  // Ключ в контейнере
    }
}

// 4. Использование
use App\Facades\Payment;

Payment::charge($user, 1000);
Payment::refund($order);
```

**Real-time Facades:**

```php
// Сервис (app/Services/NotificationService.php)
namespace App\Services;

class NotificationService
{
    public function send(User $user, string $message): void
    {
        // Send notification
    }
}

// Использование БЕЗ создания Facade класса
use Facades\App\Services\NotificationService;

// Laravel автоматически создаст facade
NotificationService::send($user, 'Hello');
```

**Мок-тестирование Facades:**

```php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

public function test_product_creation_clears_cache()
{
    // Mock Cache facade
    Cache::shouldReceive('forget')
        ->once()
        ->with('products.all');

    $response = $this->postJson('/api/products', [
        'name' => 'Test Product',
    ]);

    $response->assertStatus(201);
}

public function test_order_confirmation_email_sent()
{
    // Fake Mail (не отправляет реально)
    Mail::fake();

    $user = User::factory()->create();
    $order = Order::factory()->create(['user_id' => $user->id]);

    // Trigger event
    event(new OrderCreated($order));

    // Assert email sent
    Mail::assertSent(OrderConfirmation::class, function ($mail) use ($user) {
        return $mail->hasTo($user->email);
    });
}
```

**Facade vs Dependency Injection:**

```php
// ❌ ПЛОХО: Facade в сервисе (скрывает зависимости)
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Скрытая зависимость
        Cache::forget('orders');
        Log::info('Order created');

        return $order;
    }
}

// ✅ ХОРОШО: DI (явные зависимости)
class OrderService
{
    public function __construct(
        private CacheRepository $cache,
        private LoggerInterface $logger
    ) {}

    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Явные зависимости (видны в конструкторе)
        $this->cache->forget('orders');
        $this->logger->info('Order created');

        return $order;
    }
}

// ✅ OK: Facade в контроллере (для коротких операций)
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        Cache::forget('orders');
        Log::info('Order created');

        return new OrderResource($order);
    }
}
```

**Facade с алиасом:**

```php
// config/app.php
'aliases' => [
    'Cache' => Illuminate\Support\Facades\Cache::class,
    'DB' => Illuminate\Support\Facades\DB::class,
    'Payment' => App\Facades\Payment::class,  // Кастомный
],

// Теперь можно использовать без use
Cache::get('key');
Payment::charge($user, 1000);
```

**IDE autocompletion:**

```bash
# Установить laravel-ide-helper
composer require --dev barryvdh/laravel-ide-helper

# Сгенерировать аннотации
php artisan ide-helper:generate

# Теперь IDE знает о методах Facades
Cache::get('key');  // IDE подсказывает методы
```

---

## На собеседовании скажешь

> "Facades — статический интерфейс к сервисам из контейнера. Cache::get() вместо app('cache')->get(). Внутри используется __callStatic() для вызова методов. Можно mock-ать в тестах (Cache::shouldReceive()). Real-time Facades создаются автоматически через namespace Facades\App\Services\ServiceName. Не злоупотребляю в сервисах — предпочитаю DI через конструктор для явных зависимостей."

---

## Практические задания

### Задание 1: Создай кастомный Facade

Создай Facade для `SettingsService`, который загружает настройки из БД.

<details>
<summary>Решение</summary>

```php
// 1. Service (app/Services/SettingsService.php)
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SettingsService
{
    public function get(string $key, mixed $default = null): mixed
    {
        return Cache::remember("settings.{$key}", 3600, function () use ($key, $default) {
            $setting = DB::table('settings')
                ->where('key', $key)
                ->first();

            return $setting?->value ?? $default;
        });
    }

    public function set(string $key, mixed $value): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => $key],
            ['value' => $value, 'updated_at' => now()]
        );

        Cache::forget("settings.{$key}");
    }

    public function all(): array
    {
        return Cache::remember('settings.all', 3600, function () {
            return DB::table('settings')
                ->pluck('value', 'key')
                ->toArray();
        });
    }
}

// 2. Service Provider (app/Providers/SettingsServiceProvider.php)
namespace App\Providers;

use App\Services\SettingsService;
use Illuminate\Support\ServiceProvider;

class SettingsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Регистрация с ключом 'settings'
        $this->app->singleton('settings', function ($app) {
            return new SettingsService();
        });
    }
}

// 3. Facade класс (app/Facades/Settings.php)
namespace App\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static mixed get(string $key, mixed $default = null)
 * @method static void set(string $key, mixed $value)
 * @method static array all()
 *
 * @see \App\Services\SettingsService
 */
class Settings extends Facade
{
    protected static function getFacadeAccessor()
    {
        return 'settings';  // Ключ в контейнере
    }
}

// 4. Регистрация provider (config/app.php)
'providers' => [
    // ...
    App\Providers\SettingsServiceProvider::class,
],

// 5. Регистрация alias (config/app.php) - опционально
'aliases' => [
    // ...
    'Settings' => App\Facades\Settings::class,
],

// 6. Использование
use App\Facades\Settings;

// В контроллере
class HomeController extends Controller
{
    public function index()
    {
        $siteName = Settings::get('site_name', 'My Site');
        $maintenance = Settings::get('maintenance_mode', false);

        return view('home', compact('siteName', 'maintenance'));
    }
}

// В Blade
{{ Settings::get('site_name') }}

// Установить значение
Settings::set('site_name', 'New Site Name');

// Все настройки
$allSettings = Settings::all();
```

**PHPDoc для IDE autocompletion:**
```php
/**
 * @method static mixed get(string $key, mixed $default = null)
 * @method static void set(string $key, mixed $value)
 * @method static array all()
 *
 * @see \App\Services\SettingsService
 */
```
</details>

### Задание 2: Facade vs Dependency Injection

Когда использовать Facade, а когда DI? Исправь код.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: Facade в Service (скрывает зависимости)
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Скрытые зависимости (не видны в конструкторе)
        Cache::forget('orders.all');
        Log::info('Order created', ['id' => $order->id]);
        Mail::to($order->user)->send(new OrderConfirmation($order));

        return $order;
    }

    // Проблемы:
    // 1. Сложно тестировать (нужен Mockery)
    // 2. Скрытые зависимости (не ясно, что использует)
    // 3. Нельзя подменить в тестах без специальных методов
}

// ✅ ХОРОШО: DI в Service (явные зависимости)
namespace App\Services;

use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Contracts\Mail\Mailer;
use Psr\Log\LoggerInterface;

class OrderService
{
    // Явные зависимости (видны в конструкторе)
    public function __construct(
        private CacheRepository $cache,
        private LoggerInterface $logger,
        private Mailer $mailer
    ) {}

    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Те же действия, но через DI
        $this->cache->forget('orders.all');
        $this->logger->info('Order created', ['id' => $order->id]);
        $this->mailer->to($order->user)->send(new OrderConfirmation($order));

        return $order;
    }

    // Плюсы:
    // 1. Легко тестировать (mock в конструкторе)
    // 2. Явные зависимости (видно, что использует)
    // 3. Подмена в контейнере или в тесте
}

// ✅ OK: Facade в Controller (короткие операции)
namespace App\Http\Controllers;

use App\Facades\Settings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService  // Service через DI
    ) {}

    public function store(Request $request)
    {
        // Facade для простых операций в контроллере — OK
        Cache::forget('orders.all');
        Log::info('Order creation started');

        $order = $this->orderService->create($request->validated());

        return new OrderResource($order);
    }

    public function index()
    {
        $perPage = Settings::get('orders_per_page', 15);

        return OrderResource::collection(
            Order::paginate($perPage)
        );
    }
}

// ✅ ОТЛИЧНО: Facade в Routes, Migrations, Seeders
// routes/api.php
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);
});

// database/seeders/UserSeeder.php
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
        ]);
    }
}

// database/migrations/xxx_create_orders_table.php
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

Schema::create('orders', function (Blueprint $table) {
    $table->id();
    // ...
});
```

**Правило:**
- **Services** → DI через конструктор (явные зависимости)
- **Controllers** → Facade OK для простых операций
- **Routes, Migrations, Seeders** → Facade (короткий код)
- **Tests** → DI или Mockery для Facades

**Тестирование:**
```php
// Service с DI — легко тестировать
class OrderServiceTest extends TestCase
{
    public function test_order_creation()
    {
        // Mock через конструктор
        $cacheMock = $this->createMock(CacheRepository::class);
        $loggerMock = $this->createMock(LoggerInterface::class);
        $mailerMock = $this->createMock(Mailer::class);

        $cacheMock->expects($this->once())->method('forget');
        $loggerMock->expects($this->once())->method('info');
        $mailerMock->expects($this->once())->method('to');

        $service = new OrderService($cacheMock, $loggerMock, $mailerMock);
        $order = $service->create(['total' => 1000]);

        $this->assertEquals(1000, $order->total);
    }
}

// Facade — нужен Mockery
class OrderServiceWithFacadeTest extends TestCase
{
    public function test_order_creation()
    {
        Cache::shouldReceive('forget')->once();
        Log::shouldReceive('info')->once();
        Mail::shouldReceive('to')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once();

        $service = new OrderService();
        $order = $service->create(['total' => 1000]);

        $this->assertEquals(1000, $order->total);
    }
}
```
</details>

### Задание 3: Real-time Facade

Используй Real-time Facade для `PaymentService` без создания Facade класса.

<details>
<summary>Решение</summary>

```php
// 1. Service (app/Services/PaymentService.php)
namespace App\Services;

class PaymentService
{
    public function __construct(
        private string $apiKey
    ) {}

    public function charge(int $amount): bool
    {
        // Payment API call
        return true;
    }

    public function refund(string $transactionId): bool
    {
        // Refund API call
        return true;
    }

    public function getBalance(): int
    {
        // Get balance
        return 10000;
    }
}

// 2. Регистрация в контейнере (app/Providers/AppServiceProvider.php)
public function register(): void
{
    $this->app->singleton(PaymentService::class, function ($app) {
        return new PaymentService(
            apiKey: config('services.payment.key')
        );
    });
}

// 3. Использование Real-time Facade (БЕЗ создания Facade класса!)
namespace App\Http\Controllers;

// Добавить префикс Facades\ к namespace
use Facades\App\Services\PaymentService;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        // Использовать как статические методы
        $charged = PaymentService::charge($request->amount);

        if ($charged) {
            $order = Order::create($request->validated());
            return new OrderResource($order);
        }

        return response()->json(['error' => 'Payment failed'], 400);
    }

    public function refund(Order $order)
    {
        $refunded = PaymentService::refund($order->transaction_id);

        if ($refunded) {
            $order->update(['status' => 'refunded']);
            return response()->json(['message' => 'Refunded']);
        }

        return response()->json(['error' => 'Refund failed'], 400);
    }

    public function balance()
    {
        $balance = PaymentService::getBalance();

        return response()->json(['balance' => $balance]);
    }
}

// 4. В Blade
@php
    use Facades\App\Services\PaymentService;
@endphp

<div>Balance: {{ PaymentService::getBalance() }}</div>

// 5. Тестирование Real-time Facade
use Facades\App\Services\PaymentService;

class OrderControllerTest extends TestCase
{
    public function test_order_creation_charges_payment()
    {
        // Mock Real-time Facade
        PaymentService::shouldReceive('charge')
            ->once()
            ->with(1000)
            ->andReturn(true);

        $response = $this->postJson('/api/orders', [
            'amount' => 1000,
            'product_id' => 1,
        ]);

        $response->assertStatus(201);
    }

    public function test_refund()
    {
        PaymentService::shouldReceive('refund')
            ->once()
            ->with('txn_123')
            ->andReturn(true);

        $order = Order::factory()->create(['transaction_id' => 'txn_123']);

        $response = $this->postJson("/api/orders/{$order->id}/refund");

        $response->assertStatus(200);
    }
}
```

**Как работает Real-time Facade:**
```php
// Обычный вызов
use App\Services\PaymentService;
app(PaymentService::class)->charge(1000);

// Real-time Facade (автоматически)
use Facades\App\Services\PaymentService;
PaymentService::charge(1000);

// Laravel автоматически создаёт Facade класс:
namespace Facades\App\Services;

class PaymentService extends \Illuminate\Support\Facades\Facade
{
    protected static function getFacadeAccessor()
    {
        return \App\Services\PaymentService::class;
    }
}
```

**Плюсы Real-time Facades:**
- Не нужно создавать Facade класс
- Короткий синтаксис
- Работает с любым классом

**Минусы:**
- Не все знают про эту фичу
- IDE может не подсказывать методы (нужен laravel-ide-helper)
- Скрывает зависимости (как обычные Facades)

**Когда использовать:**
- В контроллерах для коротких операций
- В Blade шаблонах
- Когда не хочется создавать Facade класс
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
