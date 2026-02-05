# 4.3 Service Providers

## Краткое резюме

> **Service Provider** — класс для регистрации сервисов в Service Container.
>
> **Методы:** `register()` для привязок в контейнере, `boot()` для всего остального (view composers, validators, observers).
>
> **Важно:** Deferred providers загружаются по требованию, `publishes()` для публикации ресурсов пакета.

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
Service Provider — место регистрации сервисов в Service Container. Все сервисы Laravel регистрируются через providers.

**Основные методы:**
- `register()` — регистрация привязок в контейнере
- `boot()` — выполняется после регистрации всех providers

---

## Как работает

**Структура Service Provider:**

```php
// app/Providers/AppServiceProvider.php
class AppServiceProvider extends ServiceProvider
{
    // register() — для регистрации в контейнере
    public function register(): void
    {
        // Только привязки в контейнере
        $this->app->singleton(PaymentService::class, function ($app) {
            return new PaymentService(
                config('services.payment.key')
            );
        });
    }

    // boot() — после регистрации всех providers
    public function boot(): void
    {
        // Здесь можно использовать другие сервисы
        View::composer('*', function ($view) {
            $view->with('appName', config('app.name'));
        });

        // Model observers
        User::observe(UserObserver::class);

        // Custom validation rules
        Validator::extend('phone', function ($attribute, $value) {
            return preg_match('/^\+7\d{10}$/', $value);
        });
    }
}
```

**Регистрация provider в config/app.php:**

```php
// config/app.php
'providers' => [
    // Framework providers
    Illuminate\Auth\AuthServiceProvider::class,
    Illuminate\Broadcasting\BroadcastServiceProvider::class,

    // Application providers
    App\Providers\AppServiceProvider::class,
    App\Providers\AuthServiceProvider::class,
    App\Providers\EventServiceProvider::class,
    App\Providers\PaymentServiceProvider::class,  // Кастомный
],
```

**Deferred Providers (отложенная загрузка):**

```php
// Загружается только когда нужен
class PaymentServiceProvider extends ServiceProvider
{
    // Отложенная загрузка
    protected $defer = true;  // Deprecated в Laravel 11+

    public function register(): void
    {
        $this->app->singleton(PaymentService::class, function () {
            return new PaymentService();
        });
    }

    // Что предоставляет
    public function provides(): array
    {
        return [PaymentService::class];
    }
}

// Laravel 11+ (без $defer)
class PaymentServiceProvider extends ServiceProvider implements DeferrableProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentService::class, function () {
            return new PaymentService();
        });
    }

    public function provides(): array
    {
        return [PaymentService::class];
    }
}
```

---

## Когда использовать

**Используй register() для:**
- Регистрации сервисов в контейнере
- Bind, singleton, instance
- Конфигурации без зависимостей от других сервисов

**Используй boot() для:**
- View composers
- Route macros
- Validation rules
- Event listeners
- Model observers
- Публикации ресурсов (config, migrations)

---

## Пример из практики

**Кастомный Payment Provider:**

```php
// app/Providers/PaymentServiceProvider.php
class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Регистрация интерфейса
        $this->app->bind(
            PaymentGateway::class,
            fn() => match (config('payment.driver')) {
                'stripe' => new StripeGateway(config('payment.stripe.key')),
                'paypal' => new PayPalGateway(config('payment.paypal.key')),
                default => throw new \Exception('Unknown payment driver')
            }
        );

        // Singleton для PaymentService
        $this->app->singleton(PaymentService::class, function ($app) {
            return new PaymentService(
                $app->make(PaymentGateway::class),
                $app->make('log')
            );
        });
    }

    public function boot(): void
    {
        // Публикация конфига
        $this->publishes([
            __DIR__.'/../../config/payment.php' => config_path('payment.php'),
        ], 'payment-config');

        // Event listener
        Event::listen(
            OrderCreated::class,
            ProcessPayment::class
        );
    }
}
```

**Route Service Provider:**

```php
// app/Providers/RouteServiceProvider.php
class RouteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Rate limiting
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Model binding с кастомной логикой
        Route::bind('post', function (string $value) {
            return Post::where('slug', $value)
                ->orWhere('id', $value)
                ->firstOrFail();
        });

        // Route макрос
        Route::macro('apiResource', function (string $name, string $controller) {
            Route::prefix($name)->group(function () use ($controller) {
                Route::get('/', [$controller, 'index']);
                Route::post('/', [$controller, 'store']);
                Route::get('/{id}', [$controller, 'show']);
                Route::put('/{id}', [$controller, 'update']);
                Route::delete('/{id}', [$controller, 'destroy']);
            });
        });
    }
}
```

**Event Service Provider:**

```php
// app/Providers/EventServiceProvider.php
class EventServiceProvider extends ServiceProvider
{
    // Регистрация listeners
    protected $listen = [
        OrderCreated::class => [
            SendOrderConfirmation::class,
            UpdateInventory::class,
            NotifyAdmin::class,
        ],

        UserRegistered::class => [
            SendWelcomeEmail::class,
        ],
    ];

    public function boot(): void
    {
        // Model events
        User::creating(function (User $user) {
            $user->uuid = Str::uuid();
        });

        // Subscriber
        Event::subscribe(OrderEventSubscriber::class);
    }

    // Автообнаружение listeners
    public function shouldDiscoverEvents(): bool
    {
        return true;
    }
}
```

**Package Service Provider (создание пакета):**

```php
// packages/analytics/src/AnalyticsServiceProvider.php
class AnalyticsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Merge конфига
        $this->mergeConfigFrom(
            __DIR__.'/../config/analytics.php',
            'analytics'
        );

        // Регистрация сервиса
        $this->app->singleton(Analytics::class, function ($app) {
            return new Analytics(config('analytics'));
        });

        // Алиас
        $this->app->alias(Analytics::class, 'analytics');
    }

    public function boot(): void
    {
        // Публикация конфига
        $this->publishes([
            __DIR__.'/../config/analytics.php' => config_path('analytics.php'),
        ], 'analytics-config');

        // Публикация views
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'analytics');
        $this->publishes([
            __DIR__.'/../resources/views' => resource_path('views/vendor/analytics'),
        ], 'analytics-views');

        // Публикация миграций
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');

        // Публикация routes
        $this->loadRoutesFrom(__DIR__.'/../routes/web.php');

        // Commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                AnalyticsCommand::class,
            ]);
        }
    }
}
```

**Authorization Service Provider:**

```php
// app/Providers/AuthServiceProvider.php
class AuthServiceProvider extends ServiceProvider
{
    // Политики
    protected $policies = [
        Post::class => PostPolicy::class,
        Comment::class => CommentPolicy::class,
    ];

    public function boot(): void
    {
        // Gates
        Gate::define('view-admin', function (User $user) {
            return $user->isAdmin();
        });

        Gate::define('edit-post', function (User $user, Post $post) {
            return $user->id === $post->user_id;
        });

        // Passport/Sanctum routes
        // Passport::routes();
    }
}
```

**Database Service Provider (макросы):**

```php
// app/Providers/DatabaseServiceProvider.php
class DatabaseServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Query Builder макрос
        Builder::macro('whereLike', function (string $column, string $value) {
            return $this->where($column, 'LIKE', "%{$value}%");
        });

        // Collection макрос
        Collection::macro('toUpper', function () {
            return $this->map(fn($value) => strtoupper($value));
        });

        // Использование
        // User::whereLike('name', 'John')->get();
        // collect(['a', 'b'])->toUpper(); // ['A', 'B']
    }
}
```

**Команда создания provider:**

```bash
# Создать provider
php artisan make:provider PaymentServiceProvider

# Зарегистрировать в config/app.php автоматически (Laravel 11+)
# или добавить вручную
```

---

## На собеседовании скажешь

> "Service Provider регистрирует сервисы в контейнере. register() только для привязок (bind, singleton), boot() для всего остального (view composers, validators, observers). Deferred providers грузятся по требованию. publishes() для публикации ресурсов пакета. Все providers регистрируются в config/app.php."

---

## Практические задания

### Задание 1: Создай кастомный Service Provider

Создай `AnalyticsServiceProvider` для регистрации `AnalyticsService`, который отправляет события в Google Analytics.

<details>
<summary>Решение</summary>

```php
// 1. Создать provider
// php artisan make:provider AnalyticsServiceProvider

// 2. Реализация (app/Providers/AnalyticsServiceProvider.php)
namespace App\Providers;

use App\Services\AnalyticsService;
use Illuminate\Support\ServiceProvider;

class AnalyticsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Singleton для AnalyticsService
        $this->app->singleton(AnalyticsService::class, function ($app) {
            return new AnalyticsService(
                apiKey: config('services.analytics.key'),
                enabled: config('services.analytics.enabled', false)
            );
        });

        // Алиас для удобства
        $this->app->alias(AnalyticsService::class, 'analytics');

        // Merge конфига (если пакет)
        $this->mergeConfigFrom(
            __DIR__.'/../../config/analytics.php',
            'analytics'
        );
    }

    public function boot(): void
    {
        // Публикация конфига
        $this->publishes([
            __DIR__.'/../../config/analytics.php' => config_path('analytics.php'),
        ], 'analytics-config');

        // Макрос для Collection
        \Illuminate\Support\Collection::macro('track', function (string $event) {
            app(AnalyticsService::class)->track($event, [
                'count' => $this->count(),
            ]);
            return $this;
        });

        // Event listener
        \Event::listen(
            \App\Events\OrderCreated::class,
            function ($event) {
                app('analytics')->track('order_created', [
                    'order_id' => $event->order->id,
                    'total' => $event->order->total,
                ]);
            }
        );
    }
}

// 3. Service (app/Services/AnalyticsService.php)
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyticsService
{
    public function __construct(
        private string $apiKey,
        private bool $enabled
    ) {}

    public function track(string $event, array $data = []): void
    {
        if (!$this->enabled) {
            return;
        }

        try {
            Http::post('https://analytics.google.com/api/track', [
                'api_key' => $this->apiKey,
                'event' => $event,
                'data' => $data,
            ]);

            Log::info("Analytics event tracked: {$event}");
        } catch (\Exception $e) {
            Log::error("Analytics tracking failed: {$e->getMessage()}");
        }
    }
}

// 4. Config (config/analytics.php)
return [
    'key' => env('ANALYTICS_KEY'),
    'enabled' => env('ANALYTICS_ENABLED', false),
];

// 5. Зарегистрировать (config/app.php)
'providers' => [
    // ...
    App\Providers\AnalyticsServiceProvider::class,
],

// 6. Использование
use App\Services\AnalyticsService;

class OrderController extends Controller
{
    public function __construct(
        private AnalyticsService $analytics
    ) {}

    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        // Трекинг
        $this->analytics->track('order_created', [
            'order_id' => $order->id,
            'total' => $order->total,
        ]);

        return new OrderResource($order);
    }
}

// Или через алиас
app('analytics')->track('page_view', ['url' => request()->url()]);

// Или через макрос
$orders = Order::all()->track('orders_fetched');
```
</details>

### Задание 2: register() vs boot()

В чём разница? Когда что использовать?

<details>
<summary>Решение</summary>

```php
// ✅ register() — ТОЛЬКО для регистрации в контейнере
// - Вызывается ПЕРВЫМ для ВСЕХ providers
// - НЕ используй другие сервисы (они могут быть не зарегистрированы)
// - Только bind(), singleton(), instance()

class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // ✅ МОЖНО
        $this->app->singleton(PaymentService::class, function ($app) {
            return new PaymentService(
                config('payment.driver')  // Config доступен
            );
        });

        // ✅ МОЖНО
        $this->app->bind(PaymentGateway::class, StripeGateway::class);

        // ✅ МОЖНО
        $this->mergeConfigFrom(__DIR__.'/../../config/payment.php', 'payment');

        // ❌ НЕЛЬЗЯ — другой сервис может быть не зарегистрирован
        $logger = app(LoggerInterface::class);  // Ошибка!

        // ❌ НЕЛЬЗЯ — View ещё не готов
        View::composer('*', function ($view) {});  // Ошибка!

        // ❌ НЕЛЬЗЯ — DB может быть не готова
        User::observe(UserObserver::class);  // Ошибка!
    }
}

// ✅ boot() — для всего остального
// - Вызывается ПОСЛЕ регистрации ВСЕХ providers
// - Можно использовать ЛЮБЫЕ сервисы из контейнера
// - View composers, validators, observers, macros, event listeners

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // ✅ View Composers (доступен View)
        View::composer('layouts.app', function ($view) {
            $view->with('appName', config('app.name'));
        });

        // ✅ Model Observers (доступен Eloquent)
        User::observe(UserObserver::class);

        // ✅ Validation Rules (доступен Validator)
        Validator::extend('phone', function ($attribute, $value) {
            return preg_match('/^\+7\d{10}$/', $value);
        });

        // ✅ Route Macros (доступен Router)
        Route::macro('apiResource', function (string $name, string $controller) {
            // ...
        });

        // ✅ Collection Macros
        Collection::macro('toUpper', function () {
            return $this->map(fn($v) => strtoupper($v));
        });

        // ✅ Event Listeners (доступен Event)
        Event::listen(OrderCreated::class, SendOrderConfirmation::class);

        // ✅ Публикация ресурсов
        $this->publishes([
            __DIR__.'/../../config/payment.php' => config_path('payment.php'),
        ], 'payment-config');

        // ✅ Загрузка миграций
        $this->loadMigrationsFrom(__DIR__.'/../../database/migrations');

        // ✅ Загрузка routes
        $this->loadRoutesFrom(__DIR__.'/../../routes/api.php');

        // ✅ Использование других сервисов
        $logger = app(LoggerInterface::class);  // OK!
        $logger->info('AppServiceProvider booted');
    }
}

// Пример ОШИБКИ
class BadServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // ❌ ПЛОХО: используем DB в register()
        $this->app->singleton(SettingsService::class, function ($app) {
            $settings = DB::table('settings')->first();  // Может не работать!
            return new SettingsService($settings);
        });
    }

    // ✅ ПРАВИЛЬНО: используем DB в boot()
    public function boot(): void
    {
        $this->app->singleton(SettingsService::class, function ($app) {
            $settings = DB::table('settings')->first();  // Работает!
            return new SettingsService($settings);
        });
    }
}
```

**Правило:**
- **register()** → только **bind(), singleton(), instance()**
- **boot()** → всё остальное (view, validators, observers, events, macros)
</details>

### Задание 3: Deferred Provider

Создай Deferred Provider для медленного сервиса (например, API клиент), который загружается только когда нужен.

<details>
<summary>Решение</summary>

```php
// Laravel 10 и ниже
namespace App\Providers;

use App\Services\SlowApiClient;
use Illuminate\Support\ServiceProvider;

class SlowApiServiceProvider extends ServiceProvider
{
    // Отложенная загрузка
    protected $defer = true;

    public function register(): void
    {
        $this->app->singleton(SlowApiClient::class, function ($app) {
            // Медленная инициализация (5 секунд)
            sleep(5);

            return new SlowApiClient(
                apiKey: config('services.slow_api.key'),
                baseUrl: config('services.slow_api.url')
            );
        });
    }

    // Что предоставляет (когда загружать)
    public function provides(): array
    {
        return [SlowApiClient::class];
    }
}

// Laravel 11+
namespace App\Providers;

use App\Services\SlowApiClient;
use Illuminate\Contracts\Support\DeferrableProvider;
use Illuminate\Support\ServiceProvider;

class SlowApiServiceProvider extends ServiceProvider implements DeferrableProvider
{
    public function register(): void
    {
        $this->app->singleton(SlowApiClient::class, function ($app) {
            return new SlowApiClient(
                apiKey: config('services.slow_api.key'),
                baseUrl: config('services.slow_api.url')
            );
        });
    }

    public function provides(): array
    {
        return [SlowApiClient::class];
    }
}

// Регистрация (config/app.php)
'providers' => [
    // ...
    App\Providers\SlowApiServiceProvider::class,
],

// Использование
class ReportController extends Controller
{
    // Provider загрузится ТОЛЬКО при вызове этого контроллера
    public function __construct(
        private SlowApiClient $apiClient
    ) {}

    public function generate()
    {
        $data = $this->apiClient->fetchData();
        // ...
    }
}

// Другие контроллеры НЕ загрузят SlowApiClient
class UserController extends Controller
{
    public function index()
    {
        // SlowApiServiceProvider НЕ загружен (быстрее!)
        return User::all();
    }
}

// Service
namespace App\Services;

class SlowApiClient
{
    public function __construct(
        private string $apiKey,
        private string $baseUrl
    ) {
        // Медленная инициализация
        // Загрузка сертификатов, подключение к API и т.д.
    }

    public function fetchData(): array
    {
        // API запрос
        return [];
    }
}
```

**Когда использовать Deferred Providers:**
- Медленные сервисы (API клиенты, сложная инициализация)
- Сервисы, которые используются редко
- Пакеты с тяжёлыми зависимостями

**Плюсы:**
- Ускоряет загрузку приложения
- Экономит память

**Минусы:**
- Не работает для сервисов, нужных в boot() других providers
- Не подходит для глобальных сервисов (Logger, Cache)

```php
// Проверка: когда загружается provider
Route::get('/test', function () {
    // SlowApiServiceProvider ещё НЕ загружен

    app(SlowApiClient::class);  // Сейчас загрузится (5 секунд)

    // SlowApiServiceProvider загружен

    return 'OK';
});
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
