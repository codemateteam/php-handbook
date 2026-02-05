# 9.4 Rate Limiting

## Краткое резюме

> **Rate Limiting** — ограничение количества запросов от пользователя/IP за промежуток времени для защиты от злоупотребления API.
>
> **Laravel:** `throttle` middleware (throttle:60,1 = 60 запросов в минуту), `RateLimiter::for()` для кастомных лимитов.
>
> **Важно:** Разные лимиты для чтения/записи, премиум пользователей. Redis для distributed systems.

---

## Содержание

- [Что это](#что-это)
- [Базовое использование](#базовое-использование)
- [Кастомные лимиты](#кастомные-лимиты)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Rate Limiting — ограничение количества запросов от пользователя/IP за промежуток времени. Защита от злоупотребления API.

**Зачем:**
- Защита от DDoS
- Контроль нагрузки
- Честное использование ресурсов
- Монетизация (разные лимиты для тарифов)

---

## Базовое использование

**Простой Rate Limiting:**

```php
// routes/api.php
Route::middleware('throttle:60,1')->group(function () {
    Route::apiResource('posts', PostController::class);
});
// 60 запросов в 1 минуту
```

**По пользователю:**

```php
Route::middleware('throttle:100,1,user')->group(function () {
    // 100 запросов в минуту ПО ПОЛЬЗОВАТЕЛЮ
});
```

**Headers в ответе:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 45
```

---

## Кастомные лимиты

**RouteServiceProvider:**

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });

    RateLimiter::for('uploads', function (Request $request) {
        return $request->user()->isPremium()
            ? Limit::none()
            : Limit::perMinute(10);
    });

    RateLimiter::for('login', function (Request $request) {
        return Limit::perMinute(5)->by($request->ip());
    });
}
```

**Использование:**

```php
Route::middleware('throttle:api')->group(function () {
    // Кастомный лимит 'api'
});

Route::middleware('throttle:login')->post('/login', ...);
Route::middleware('throttle:uploads')->post('/upload', ...);
```

**Множественные лимиты:**

```php
RateLimiter::for('strict', function (Request $request) {
    return [
        Limit::perMinute(100),
        Limit::perDay(1000),
    ];
});
```

---

## Когда использовать

| Endpoint | Рекомендуемый лимит | Причина |
|----------|-------------------|---------|
| Login/Register | 5-10/минута | Защита от brute-force |
| Read операции | 100-1000/минута | Частые запросы допустимы |
| Write операции | 30-60/минута | Защита БД |
| File Upload | 10-20/час | Дорогие операции |
| Email/SMS | 5-10/час | Внешние сервисы |

---

## Пример из практики

### Разные лимиты для разных операций

```php
RateLimiter::for('api-read', function (Request $request) {
    return $request->user()?->isPremium()
        ? Limit::perMinute(1000)
        : Limit::perMinute(100);
});

RateLimiter::for('api-write', function (Request $request) {
    return Limit::perMinute(30)->by($request->user()?->id ?: $request->ip());
});

// routes/api.php
Route::middleware('throttle:api-read')->get('/posts', [PostController::class, 'index']);
Route::middleware('throttle:api-write')->post('/posts', [PostController::class, 'store']);
```

### Response с информацией о лимитах

```php
class RateLimitMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $limiter = app(RateLimiter::class);
        $key = $request->user()?->id ?: $request->ip();

        $response->headers->set('X-RateLimit-Limit', 60);
        $response->headers->set('X-RateLimit-Remaining',
            $limiter->remaining($key, 60)
        );

        return $response;
    }
}
```

### Redis для распределённых систем

```php
// .env
CACHE_DRIVER=redis

// Rate limiting автоматически использует Redis
// Работает корректно на нескольких серверах
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Rate Limiting ограничивает количество запросов за период времени
- Защита от злоупотребления и DDoS

**Laravel использование:**
- `throttle:60,1` middleware (60 запросов в минуту)
- `RateLimiter::for()` для кастомных лимитов
- `Limit::perMinute()`, `Limit::perDay()`
- `by()` для группировки (user_id или IP)

**Headers:**
- `X-RateLimit-Limit` — максимум запросов
- `X-RateLimit-Remaining` — осталось запросов
- `Retry-After` — через сколько повторить

**Распределённые системы:**
- Redis для shared state между серверами
- Важно для load-balanced приложений

**Best practices:**
- Разные лимиты для чтения/записи
- Stricter лимиты для login/register
- Premium пользователи = выше лимиты

---

## Практические задания

### Задание 1: Настрой Rate Limiting с тарифами

Создай систему с 3 тарифами: Free (100 req/min), Pro (500 req/min), Enterprise (unlimited).

<details>
<summary>Решение</summary>

```php
// app/Providers/RouteServiceProvider.php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    RateLimiter::for('api', function (Request $request) {
        $user = $request->user();

        if (!$user) {
            return Limit::perMinute(10)->by($request->ip());
        }

        return match($user->plan) {
            'enterprise' => Limit::none(),
            'pro' => Limit::perMinute(500)->by($user->id),
            'free' => Limit::perMinute(100)->by($user->id),
            default => Limit::perMinute(100)->by($user->id),
        };
    });
}

// routes/api.php
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::apiResource('posts', PostController::class);
});

// User Model
class User extends Authenticatable
{
    public function plan(): string
    {
        return $this->subscription?->plan ?? 'free';
    }

    public function isPremium(): bool
    {
        return in_array($this->plan(), ['pro', 'enterprise']);
    }
}
```
</details>

### Задание 2: Кастомный response при превышении лимита

Создай middleware который возвращает JSON с информацией когда можно повторить запрос.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/CustomThrottleResponse.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class CustomThrottleResponse
{
    public function handle(Request $request, Closure $next, string $limiter = 'api')
    {
        $key = $this->resolveRequestSignature($request);

        if (RateLimiter::tooManyAttempts($key, $maxAttempts = 60)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json([
                'error' => 'Too Many Requests',
                'message' => "Rate limit exceeded. Try again in {$seconds} seconds.",
                'retry_after' => $seconds,
                'limit' => $maxAttempts,
            ], 429)->header('Retry-After', $seconds);
        }

        RateLimiter::hit($key, 60);

        $response = $next($request);

        $response->headers->set('X-RateLimit-Limit', $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining',
            RateLimiter::remaining($key, $maxAttempts)
        );

        return $response;
    }

    protected function resolveRequestSignature(Request $request): string
    {
        return sha1(
            $request->user()?->id ?? $request->ip()
        );
    }
}

// app/Http/Kernel.php
protected $middlewareAliases = [
    'throttle.custom' => \App\Http\Middleware\CustomThrottleResponse::class,
];

// routes/api.php
Route::middleware('throttle.custom')->group(function () {
    Route::apiResource('posts', PostController::class);
});
```
</details>

### Задание 3: Dynamic Rate Limiting по endpoint'ам

Разные лимиты для разных операций: чтение (100/min), создание (20/min), удаление (10/min).

<details>
<summary>Решение</summary>

```php
// app/Providers/RouteServiceProvider.php
public function boot(): void
{
    // Read operations
    RateLimiter::for('api-read', function (Request $request) {
        return Limit::perMinute(100)->by(
            $request->user()?->id ?: $request->ip()
        );
    });

    // Write operations
    RateLimiter::for('api-create', function (Request $request) {
        return Limit::perMinute(20)->by(
            $request->user()?->id ?: $request->ip()
        );
    });

    // Delete operations
    RateLimiter::for('api-delete', function (Request $request) {
        return Limit::perMinute(10)->by(
            $request->user()?->id ?: $request->ip()
        );
    });

    // Login protection
    RateLimiter::for('login', function (Request $request) {
        return Limit::perMinute(5)->by($request->ip());
    });
}

// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    // Read
    Route::middleware('throttle:api-read')->group(function () {
        Route::get('/posts', [PostController::class, 'index']);
        Route::get('/posts/{post}', [PostController::class, 'show']);
    });

    // Create
    Route::middleware('throttle:api-create')->group(function () {
        Route::post('/posts', [PostController::class, 'store']);
    });

    // Delete
    Route::middleware('throttle:api-delete')->group(function () {
        Route::delete('/posts/{post}', [PostController::class, 'destroy']);
    });
});

// Login
Route::middleware('throttle:login')->post('/login', [AuthController::class, 'login']);

// Monitoring в Controller
class PostController extends Controller
{
    public function store(Request $request)
    {
        $limiter = app(RateLimiter::class);
        $key = 'api-create:' . ($request->user()?->id ?: $request->ip());

        Log::info('Rate limit check', [
            'key' => $key,
            'remaining' => $limiter->remaining($key, 20),
            'user_id' => $request->user()?->id,
        ]);

        // ... создание поста
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
