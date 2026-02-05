# 4.5 Маршрутизация (Routing)

## Краткое резюме

> **Routing** — система маршрутизации Laravel, связывающая URL с контроллерами/замыканиями.
>
> **Файлы:** routes/web.php (с сессиями, CSRF) и routes/api.php (stateless, throttle).
>
> **Важно:** Route Model Binding, Resource routes для CRUD, группы с prefix/middleware/name, rate limiting.

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
Система маршрутизации Laravel связывает URL с контроллерами/замыканиями. Поддерживает REST, параметры, middleware, группы.

**Основные файлы:**
- `routes/web.php` — веб-маршруты (с сессиями, CSRF)
- `routes/api.php` — API маршруты (без сессий, с throttle)

---

## Как работает

**Базовый синтаксис:**

```php
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// GET запрос
Route::get('/users', [UserController::class, 'index']);

// POST запрос
Route::post('/users', [UserController::class, 'store']);

// PUT/PATCH запрос
Route::put('/users/{id}', [UserController::class, 'update']);
Route::patch('/users/{id}', [UserController::class, 'update']);

// DELETE запрос
Route::delete('/users/{id}', [UserController::class, 'destroy']);

// Несколько методов
Route::match(['get', 'post'], '/form', [FormController::class, 'handle']);

// Любой метод
Route::any('/debug', [DebugController::class, 'index']);

// Closure (без контроллера)
Route::get('/hello', function () {
    return 'Hello World';
});
```

**Параметры маршрута:**

```php
// Обязательный параметр
Route::get('/users/{id}', [UserController::class, 'show']);

// Необязательный параметр
Route::get('/users/{id?}', [UserController::class, 'show']);

// Regex constraint
Route::get('/users/{id}', [UserController::class, 'show'])
    ->where('id', '[0-9]+');

Route::get('/posts/{slug}', [PostController::class, 'show'])
    ->where('slug', '[a-z0-9-]+');

// Несколько constraints
Route::get('/users/{id}/posts/{postId}', [PostController::class, 'show'])
    ->where(['id' => '[0-9]+', 'postId' => '[0-9]+']);

// Глобальные constraints (в RouteServiceProvider)
Route::pattern('id', '[0-9]+');
```

**Именованные маршруты:**

```php
// Определение
Route::get('/users/{id}', [UserController::class, 'show'])
    ->name('users.show');

// Использование
$url = route('users.show', ['id' => 1]);  // /users/1
return redirect()->route('users.show', ['id' => 1]);

// В Blade
<a href="{{ route('users.show', $user) }}">View User</a>
```

**Route Model Binding:**

```php
// Автоматическая привязка (по id)
Route::get('/users/{user}', function (User $user) {
    return $user->email;  // Laravel автоматически найдёт User::find($id)
});

// По другому полю (slug)
Route::get('/posts/{post:slug}', function (Post $post) {
    return $post->title;  // Post::where('slug', $slug)->firstOrFail()
});

// Кастомная логика (в RouteServiceProvider)
Route::bind('post', function (string $value) {
    return Post::where('slug', $value)
        ->orWhere('id', $value)
        ->firstOrFail();
});
```

**Группы маршрутов:**

```php
// Prefix
Route::prefix('admin')->group(function () {
    Route::get('/users', [AdminUserController::class, 'index']);
    Route::get('/posts', [AdminPostController::class, 'index']);
});
// /admin/users, /admin/posts

// Middleware
Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// Name prefix
Route::name('admin.')->group(function () {
    Route::get('/users', [AdminUserController::class, 'index'])
        ->name('users.index');  // admin.users.index
});

// Комбинация
Route::prefix('api')
    ->middleware('auth:sanctum')
    ->name('api.')
    ->group(function () {
        Route::get('/users', [UserController::class, 'index'])
            ->name('users.index');  // api.users.index → /api/users
    });
```

**Resource Routes:**

```php
// RESTful маршруты
Route::resource('posts', PostController::class);

// Генерирует:
// GET    /posts              index
// GET    /posts/create       create
// POST   /posts              store
// GET    /posts/{post}       show
// GET    /posts/{post}/edit  edit
// PUT    /posts/{post}       update
// DELETE /posts/{post}       destroy

// Только некоторые действия
Route::resource('posts', PostController::class)
    ->only(['index', 'show']);

Route::resource('posts', PostController::class)
    ->except(['create', 'edit']);

// API resource (без create/edit)
Route::apiResource('posts', PostController::class);
// Генерирует только: index, store, show, update, destroy
```

---

## Когда использовать

**web.php vs api.php:**

| web.php | api.php |
|---------|---------|
| Сессии, CSRF | Без сессий |
| Cookies | Stateless |
| Для веб-приложений | Для API |
| Middleware: web | Middleware: api |

**Resource routes:**
- ✅ Используй для стандартных CRUD
- ❌ Не используй для нестандартных действий (добавь отдельные маршруты)

---

## Пример из практики

**RESTful API маршруты:**

```php
// routes/api.php
use App\Http\Controllers\Api\{
    AuthController,
    ProductController,
    OrderController,
};

// Публичные маршруты
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Защищённые маршруты
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Products API
    Route::apiResource('products', ProductController::class);

    // Orders API
    Route::prefix('orders')->name('orders.')->group(function () {
        Route::get('/', [OrderController::class, 'index'])->name('index');
        Route::post('/', [OrderController::class, 'store'])->name('store');
        Route::get('/{order}', [OrderController::class, 'show'])->name('show');
        Route::post('/{order}/cancel', [OrderController::class, 'cancel'])->name('cancel');
    });
});
```

**Admin панель с префиксом:**

```php
// routes/web.php
Route::prefix('admin')
    ->middleware(['auth', 'admin'])
    ->name('admin.')
    ->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index'])
            ->name('dashboard');

        Route::resource('users', AdminUserController::class);
        Route::resource('posts', AdminPostController::class);

        // Кастомные действия
        Route::post('/users/{user}/ban', [AdminUserController::class, 'ban'])
            ->name('users.ban');

        Route::post('/posts/{post}/publish', [AdminPostController::class, 'publish'])
            ->name('posts.publish');
    });

// URLs:
// /admin/dashboard → admin.dashboard
// /admin/users → admin.users.index
// /admin/users/5/ban → admin.users.ban
```

**Route Model Binding с кастомной логикой:**

```php
// app/Providers/RouteServiceProvider.php
public function boot(): void
{
    // Привязка User по uuid
    Route::bind('user', function (string $value) {
        return User::where('uuid', $value)->firstOrFail();
    });

    // Привязка Post по slug или id
    Route::bind('post', function (string $value) {
        return Post::where('slug', $value)
            ->orWhere('id', $value)
            ->firstOrFail();
    });
}

// Использование
Route::get('/users/{user}', [UserController::class, 'show']);
// /users/550e8400-e29b-41d4-a716-446655440000

Route::get('/posts/{post}', [PostController::class, 'show']);
// /posts/my-first-post или /posts/123
```

**Subdomain routing:**

```php
// Поддомены
Route::domain('{account}.myapp.com')->group(function () {
    Route::get('/dashboard', function (string $account) {
        return "Dashboard for {$account}";
    });
});

// tenant1.myapp.com/dashboard → "Dashboard for tenant1"
```

**Rate Limiting:**

```php
// app/Providers/RouteServiceProvider.php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    // API rate limit
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
    });

    // Custom limiter
    RateLimiter::for('uploads', function (Request $request) {
        return $request->user()->isPremium()
            ? Limit::none()
            : Limit::perMinute(10);
    });
}

// Использование
Route::middleware('throttle:api')->group(function () {
    Route::apiResource('products', ProductController::class);
});

Route::post('/upload', [UploadController::class, 'store'])
    ->middleware('throttle:uploads');
```

**Fallback route:**

```php
// Обработка 404
Route::fallback(function () {
    return response()->json(['error' => 'Not Found'], 404);
});
```

**Redirect routes:**

```php
// Редирект
Route::redirect('/old-url', '/new-url', 301);

// Permanent redirect
Route::permanentRedirect('/old-url', '/new-url');
```

**View routes (без контроллера):**

```php
// Просто вернуть view
Route::view('/about', 'pages.about');

// С данными
Route::view('/welcome', 'welcome', ['name' => 'Laravel']);
```

---

## На собеседовании скажешь

> "Маршруты в routes/web.php (с CSRF, сессиями) и routes/api.php (stateless). Route Model Binding автоматически находит модель по id или другому полю. Resource routes для CRUD (apiResource без create/edit). Группы с prefix, middleware, name. Rate limiting через RateLimiter::for(). Именованные маршруты для route() helper."

---

## Практические задания

### Задание 1: Настрой API маршруты с версионированием

Создай API маршруты для `Product` с версионированием v1 и v2. V1 использует стандартный CRUD, V2 добавляет кастомное действие `publish`.

<details>
<summary>Решение</summary>

```php
// routes/api.php
use App\Http\Controllers\Api\V1\ProductController as ProductV1Controller;
use App\Http\Controllers\Api\V2\ProductController as ProductV2Controller;

// API V1
Route::prefix('v1')
    ->middleware('auth:sanctum')
    ->name('api.v1.')
    ->group(function () {
        Route::apiResource('products', ProductV1Controller::class);
    });

// API V2
Route::prefix('v2')
    ->middleware('auth:sanctum')
    ->name('api.v2.')
    ->group(function () {
        Route::apiResource('products', ProductV2Controller::class);

        // Кастомное действие
        Route::post('products/{product}/publish', [ProductV2Controller::class, 'publish'])
            ->name('products.publish');
    });

// Генерирует:
// POST /api/v1/products → api.v1.products.store
// GET  /api/v1/products → api.v1.products.index
// POST /api/v2/products/{product}/publish → api.v2.products.publish
```
</details>

### Задание 2: Реализуй subdomain routing для мультитенантности

Настрой маршруты для tenant-приложения, где каждый клиент имеет свой поддомен (tenant1.app.com, tenant2.app.com).

<details>
<summary>Решение</summary>

```php
// routes/web.php
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\UserController;

// Tenant subdomain
Route::domain('{tenant}.myapp.com')
    ->middleware(['web', 'identify.tenant'])
    ->name('tenant.')
    ->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index'])
            ->name('dashboard');

        Route::resource('users', UserController::class);
    });

// app/Http/Middleware/IdentifyTenant.php
class IdentifyTenant
{
    public function handle(Request $request, Closure $next)
    {
        $subdomain = $request->route('tenant');

        $tenant = Tenant::where('subdomain', $subdomain)->firstOrFail();

        // Установить текущего tenant
        app()->instance('current.tenant', $tenant);

        return $next($request);
    }
}

// Использование:
// tenant1.myapp.com/dashboard → tenant.dashboard
// tenant1.myapp.com/users → tenant.users.index
```
</details>

### Задание 3: Настрой Rate Limiting с разными лимитами

Создай rate limiting для API: обычные пользователи — 60 запросов/мин, premium — без лимитов, гости — 10 запросов/мин.

<details>
<summary>Решение</summary>

```php
// app/Providers/RouteServiceProvider.php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;

public function boot(): void
{
    // API rate limiter
    RateLimiter::for('api', function (Request $request) {
        if (!$request->user()) {
            // Гости: 10/мин по IP
            return Limit::perMinute(10)->by($request->ip());
        }

        if ($request->user()->isPremium()) {
            // Premium: без лимитов
            return Limit::none();
        }

        // Обычные пользователи: 60/мин
        return Limit::perMinute(60)->by($request->user()->id);
    });

    // Upload limiter
    RateLimiter::for('uploads', function (Request $request) {
        return $request->user()?->isPremium()
            ? Limit::perHour(1000)
            : Limit::perHour(10);
    });
}

// routes/api.php
Route::middleware('throttle:api')->group(function () {
    Route::apiResource('products', ProductController::class);
});

Route::post('/upload', [UploadController::class, 'store'])
    ->middleware(['auth:sanctum', 'throttle:uploads']);
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
