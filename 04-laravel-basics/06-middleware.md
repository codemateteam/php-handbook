# 4.6 Middleware

## Краткое резюме

> **Middleware** — фильтры HTTP запросов, выполняются до/после контроллера.
>
> **Типы:** Before (перед контроллером), After (после), Terminable (после отправки ответа).
>
> **Важно:** Регистрация в Kernel.php (глобальные, группы, алиасы), параметры через middleware('role:admin'), цепочка middleware pipeline.

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
Middleware — фильтры HTTP запросов. Выполняются до/после контроллера. Используются для аутентификации, логирования, CORS, и т.д.

**Основное:**
- Обрабатывают запрос перед контроллером
- Могут изменять Request/Response
- Цепочка middleware (middleware pipeline)

---

## Как работает

**Структура middleware:**

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckAge
{
    // Выполняется ПЕРЕД контроллером
    public function handle(Request $request, Closure $next)
    {
        // Проверка до контроллера
        if ($request->age < 18) {
            return redirect('home');
        }

        // Передать дальше
        return $next($request);
    }
}
```

**After Middleware (после контроллера):**

```php
class LogResponse
{
    public function handle(Request $request, Closure $next)
{
        // Сначала выполнить контроллер
        $response = $next($request);

        // Обработка после контроллера
        Log::info('Response', [
            'status' => $response->status(),
            'content' => $response->getContent(),
        ]);

        return $response;
    }
}
```

**Параметры middleware:**

```php
class CheckRole
{
    public function handle(Request $request, Closure $next, string $role)
    {
        if (!$request->user()->hasRole($role)) {
            abort(403);
        }

        return $next($request);
    }
}

// Использование
Route::get('/admin', [AdminController::class, 'index'])
    ->middleware('role:admin');
```

**Регистрация middleware:**

```php
// app/Http/Kernel.php
class Kernel extends HttpKernel
{
    // Глобальные middleware (выполняются для ВСЕХ запросов)
    protected $middleware = [
        \App\Http\Middleware\TrustProxies::class,
        \Illuminate\Http\Middleware\HandleCors::class,
    ];

    // Middleware группы
    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \App\Http\Middleware\VerifyCsrfToken::class,
        ],

        'api' => [
            'throttle:60,1',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];

    // Алиасы middleware (для использования в маршрутах)
    protected $middlewareAliases = [
        'auth' => \App\Http\Middleware\Authenticate::class,
        'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
        'role' => \App\Http\Middleware\CheckRole::class,
    ];
}
```

**Применение middleware:**

```php
// В маршруте
Route::get('/profile', [ProfileController::class, 'show'])
    ->middleware('auth');

Route::get('/admin', [AdminController::class, 'index'])
    ->middleware(['auth', 'role:admin']);

// В группе
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// В контроллере (конструктор)
class UserController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
        $this->middleware('role:admin')->only(['destroy']);
        $this->middleware('guest')->except(['logout']);
    }
}
```

---

## Когда использовать

**Используй middleware для:**
- Аутентификация (auth, guest)
- Авторизация (роли, права)
- Rate limiting
- CORS
- Логирование
- Кеширование ответов
- Модификация запроса/ответа

**Не используй для:**
- Бизнес-логика (это в сервисах)
- Работа с БД напрямую (только проверки)

---

## Пример из практики

**Проверка роли:**

```php
// app/Http/Middleware/CheckRole.php
class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        if (!$request->user()) {
            abort(401);
        }

        if (!$request->user()->hasAnyRole($roles)) {
            abort(403, 'Access denied');
        }

        return $next($request);
    }
}

// Регистрация в Kernel.php
protected $middlewareAliases = [
    'role' => \App\Http\Middleware\CheckRole::class,
];

// Использование
Route::middleware('role:admin,moderator')->group(function () {
    Route::get('/admin/users', [UserController::class, 'index']);
});
```

**API Token Authentication:**

```php
// app/Http/Middleware/ApiToken.php
class ApiToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-API-Token');

        if (!$token || !$this->isValidToken($token)) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        // Добавить пользователя в request
        $request->merge(['api_user' => $this->getUserByToken($token)]);

        return $next($request);
    }

    private function isValidToken(string $token): bool
    {
        return ApiToken::where('token', $token)
            ->where('expires_at', '>', now())
            ->exists();
    }
}
```

**CORS Middleware (кастомный):**

```php
// app/Http/Middleware/Cors.php
class Cors
{
    public function handle(Request $request, Closure $next)
    {
        // Preflight запрос (OPTIONS)
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }

        // Обычный запрос
        $response = $next($request);

        return $response
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
}
```

**Логирование запросов:**

```php
// app/Http/Middleware/LogRequests.php
class LogRequests
{
    public function handle(Request $request, Closure $next)
    {
        $startTime = microtime(true);

        // Выполнить запрос
        $response = $next($request);

        // Время выполнения
        $duration = microtime(true) - $startTime;

        // Логировать
        Log::info('Request processed', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_id' => $request->user()?->id,
            'status' => $response->status(),
            'duration' => round($duration * 1000, 2) . 'ms',
        ]);

        return $response;
    }
}
```

**Force JSON Response (для API):**

```php
// app/Http/Middleware/ForceJsonResponse.php
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next)
    {
        // Добавить Accept: application/json
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}

// Применить ко всем API маршрутам
// app/Http/Kernel.php
protected $middlewareGroups = [
    'api' => [
        \App\Http\Middleware\ForceJsonResponse::class,
        'throttle:60,1',
    ],
];
```

**Tenant Middleware (мультитенантность):**

```php
// app/Http/Middleware/IdentifyTenant.php
class IdentifyTenant
{
    public function handle(Request $request, Closure $next)
    {
        // Определить tenant по поддомену
        $subdomain = explode('.', $request->getHost())[0];

        $tenant = Tenant::where('subdomain', $subdomain)->firstOrFail();

        // Установить соединение с БД tenant
        config([
            'database.connections.tenant.database' => "tenant_{$tenant->id}",
        ]);

        DB::purge('tenant');
        DB::reconnect('tenant');

        // Сохранить в request
        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }
}
```

**Cache Response Middleware:**

```php
// app/Http/Middleware/CacheResponse.php
class CacheResponse
{
    public function handle(Request $request, Closure $next, int $ttl = 3600)
    {
        // Только для GET запросов
        if ($request->method() !== 'GET') {
            return $next($request);
        }

        $key = 'response:' . md5($request->fullUrl());

        // Проверить кеш
        if ($cached = Cache::get($key)) {
            return response($cached['content'], $cached['status'])
                ->withHeaders($cached['headers']);
        }

        // Выполнить запрос
        $response = $next($request);

        // Кешировать только успешные ответы
        if ($response->status() === 200) {
            Cache::put($key, [
                'content' => $response->getContent(),
                'status' => $response->status(),
                'headers' => $response->headers->all(),
            ], $ttl);
        }

        return $response;
    }
}

// Использование
Route::get('/products', [ProductController::class, 'index'])
    ->middleware('cache:600');  // 10 минут
```

**Команда создания middleware:**

```bash
# Создать middleware
php artisan make:middleware CheckAge

# Middleware будет создан в app/Http/Middleware/CheckAge.php
```

**Terminable Middleware (выполнение после отправки ответа):**

```php
class TerminableMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        return $next($request);
    }

    // Выполнится ПОСЛЕ отправки ответа клиенту
    public function terminate(Request $request, $response)
    {
        // Тяжёлые операции (не блокируют ответ)
        Log::info('Response sent to client');

        // Аналитика
        Analytics::track($request, $response);
    }
}
```

---

## На собеседовании скажешь

> "Middleware обрабатывает запрос до/после контроллера. handle($request, $next) — основной метод. Глобальные в $middleware, группы в $middlewareGroups, алиасы в $middlewareAliases. Применяются через ->middleware() в маршрутах или в конструкторе контроллера. Параметры через middleware('role:admin'). Terminable middleware с terminate() выполняется после отправки ответа. Использую для auth, роли, rate limiting, логирования, CORS."

---

## Практические задания

### Задание 1: Создай middleware для проверки подписки

Пользователь должен иметь активную подписку для доступа к премиум-функциям. Если подписка истекла, вернуть 403.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/CheckSubscription.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function handle(Request $request, Closure $next, string $plan = null)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Проверка активности подписки
        if (!$user->hasActiveSubscription()) {
            return response()->json([
                'error' => 'Subscription required',
                'message' => 'Please upgrade to access this feature'
            ], 403);
        }

        // Проверка конкретного плана (если указан)
        if ($plan && !$user->hasSubscription($plan)) {
            return response()->json([
                'error' => 'Plan upgrade required',
                'message' => "This feature requires {$plan} plan"
            ], 403);
        }

        return $next($request);
    }
}

// Регистрация в app/Http/Kernel.php
protected $middlewareAliases = [
    'subscription' => \App\Http\Middleware\CheckSubscription::class,
];

// Использование
Route::middleware(['auth:sanctum', 'subscription'])->group(function () {
    Route::get('/premium/features', [PremiumController::class, 'index']);
});

Route::middleware(['auth:sanctum', 'subscription:pro'])->group(function () {
    Route::get('/pro/analytics', [AnalyticsController::class, 'index']);
});
```
</details>

### Задание 2: Реализуй Terminable Middleware для аналитики

Создай middleware, который логирует запросы в аналитику ПОСЛЕ отправки ответа клиенту (чтобы не замедлять response).

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/TrackAnalytics.php
namespace App\Http\Middleware;

use App\Services\AnalyticsService;
use Closure;
use Illuminate\Http\Request;

class TrackAnalytics
{
    public function __construct(
        private AnalyticsService $analytics
    ) {}

    public function handle(Request $request, Closure $next)
    {
        // Before: сохранить время начала
        $request->attributes->set('start_time', microtime(true));

        return $next($request);
    }

    // Выполняется ПОСЛЕ отправки ответа клиенту
    public function terminate(Request $request, $response)
    {
        // Время выполнения
        $duration = microtime(true) - $request->attributes->get('start_time');

        // Отправить в аналитику (не блокирует ответ)
        $this->analytics->track([
            'user_id' => $request->user()?->id,
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'status' => $response->status(),
            'duration' => round($duration * 1000, 2), // мс
            'timestamp' => now(),
        ]);
    }
}

// Регистрация в Kernel.php (глобально)
protected $middleware = [
    \App\Http\Middleware\TrackAnalytics::class,
];

// app/Services/AnalyticsService.php
class AnalyticsService
{
    public function track(array $data): void
    {
        // Отправить в очередь для асинхронной обработки
        dispatch(new TrackAnalyticsJob($data));
    }
}
```
</details>

### Задание 3: Настрой CORS middleware с белым списком доменов

Создай CORS middleware, который разрешает запросы только с доверенных доменов из конфига.

<details>
<summary>Решение</summary>

```php
// config/cors.php
return [
    'allowed_origins' => [
        'https://myapp.com',
        'https://admin.myapp.com',
        'http://localhost:3000', // Dev
    ],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],

    'exposed_headers' => ['X-Total-Count'],

    'max_age' => 86400, // 24 часа
];

// app/Http/Middleware/Cors.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Cors
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->header('Origin');
        $allowedOrigins = config('cors.allowed_origins');

        // Проверить origin
        if (!in_array($origin, $allowedOrigins)) {
            if ($request->isMethod('OPTIONS')) {
                return response('', 403);
            }
        }

        // Preflight запрос
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Methods', implode(', ', config('cors.allowed_methods')))
                ->header('Access-Control-Allow-Headers', implode(', ', config('cors.allowed_headers')))
                ->header('Access-Control-Max-Age', config('cors.max_age'));
        }

        // Обычный запрос
        $response = $next($request);

        return $response
            ->header('Access-Control-Allow-Origin', $origin)
            ->header('Access-Control-Allow-Methods', implode(', ', config('cors.allowed_methods')))
            ->header('Access-Control-Allow-Headers', implode(', ', config('cors.allowed_headers')))
            ->header('Access-Control-Expose-Headers', implode(', ', config('cors.exposed_headers')));
    }
}

// Регистрация для API
protected $middlewareGroups = [
    'api' => [
        \App\Http\Middleware\Cors::class,
        'throttle:api',
    ],
];
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
