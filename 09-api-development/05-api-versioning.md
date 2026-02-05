# 9.5 API Versioning

## Краткое резюме

> **API Versioning** — управление версиями API для изменений без поломки старых клиентов.
>
> **Методы:** URI (/api/v1), Header (Accept: application/vnd.api.v1+json), Query (?version=1).
>
> **Новая версия при:** breaking changes, изменение структуры, удаление полей.

---

## Содержание

- [Что это](#что-это)
- [Методы версионирования](#методы-версионирования)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
API Versioning — управление версиями API. Позволяет изменять API без поломки старых клиентов.

**Зачем:**
- Обратная совместимость
- Поэтапная миграция клиентов
- Безопасные изменения API

---

## Методы версионирования

### 1. URI Versioning (популярный)

```php
// routes/api.php
Route::prefix('v1')->namespace('Api\V1')->group(function () {
    Route::apiResource('posts', PostController::class);
});

Route::prefix('v2')->namespace('Api\V2')->group(function () {
    Route::apiResource('posts', PostController::class);
});

// Структура
// app/Http/Controllers/Api/V1/PostController.php
// app/Http/Controllers/Api/V2/PostController.php
// app/Http/Resources/V1/PostResource.php
// app/Http/Resources/V2/PostResource.php
```

**Плюсы:**
- Просто и понятно
- Видно в URL
- Легко тестировать

**Минусы:**
- Дублирование кода
- URL загрязняется

### 2. Header Versioning

```php
// Middleware
class ApiVersionMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $version = $request->header('Api-Version', 'v1');
        $request->attributes->set('api_version', $version);

        return $next($request);
    }
}

// Controller
class PostController extends Controller
{
    public function index(Request $request)
    {
        $version = $request->attributes->get('api_version');

        return $version === 'v2'
            ? V2\PostResource::collection(Post::all())
            : V1\PostResource::collection(Post::all());
    }
}
```

**Плюсы:**
- Чистые URL
- RESTful

**Минусы:**
- Сложнее тестировать
- Клиенты должны знать о header

### 3. Query Parameter

```php
Route::get('/posts', function (Request $request) {
    $version = $request->query('version', 'v1');

    return match($version) {
        'v2' => V2\PostResource::collection(Post::all()),
        default => V1\PostResource::collection(Post::all()),
    };
});
```

**Плюсы:**
- Легко тестировать

**Минусы:**
- Не RESTful
- Query параметры для других целей

---

## Когда использовать

### Новая версия нужна при:

| Изменение | Новая версия? | Пример |
|-----------|--------------|--------|
| Breaking changes | ✅ Да | Переименование поля `content` → `body` |
| Изменение структуры | ✅ Да | Вложенный объект → плоская структура |
| Удаление полей | ✅ Да | Убрали поле `deprecated_field` |
| Изменение типов | ✅ Да | `string` → `integer` |
| Добавление полей | ❌ Нет | Добавили `author` (backwards compatible) |
| Новые endpoints | ❌ Нет | POST /posts/{id}/publish |
| Bug fixes | ❌ Нет | Исправление логики |

---

## Пример из практики

### Разные Resources для версий

```php
// V1: старая структура
namespace App\Http\Resources\V1;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content' => $this->body,  // Старое название поля
            'created' => $this->created_at->toDateTimeString(),
        ];
    }
}

// V2: новая структура
namespace App\Http\Resources\V2;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,  // Новое название
            'author' => new UserResource($this->whenLoaded('user')),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
```

### Deprecation Warnings

```php
// V1 Controller (deprecated)
namespace App\Http\Controllers\Api\V1;

class PostController extends Controller
{
    public function index()
    {
        return V1\PostResource::collection(Post::all())
            ->response()
            ->header('X-API-Warn', 'V1 is deprecated. Migrate to V2 by 2024-12-31.')
            ->header('X-API-Deprecation-Date', '2024-12-31')
            ->header('X-API-Sunset-Date', '2025-03-31');
    }
}
```

### Shared Code между версиями

```php
// app/Services/PostService.php
class PostService
{
    public function getAllPosts()
    {
        return Post::with('user')->get();
    }
}

// V1 Controller
class PostController extends Controller
{
    public function __construct(private PostService $service) {}

    public function index()
    {
        $posts = $this->service->getAllPosts();
        return V1\PostResource::collection($posts);
    }
}

// V2 Controller
class PostController extends Controller
{
    public function __construct(private PostService $service) {}

    public function index()
    {
        $posts = $this->service->getAllPosts();
        return V2\PostResource::collection($posts);
    }
}
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- API Versioning предотвращает breaking changes для старых клиентов
- Позволяет эволюционировать API без поломок

**Методы:**
- URI versioning (/api/v1, /api/v2) — самый популярный
- Header versioning (Accept: application/vnd.api.v1+json)
- Query parameter (?version=1)

**Когда новая версия:**
- Breaking changes (переименование, удаление полей)
- Изменение структуры ответа
- Изменение типов данных

**Backwards compatible изменения (без новой версии):**
- Добавление новых полей
- Новые endpoints
- Bug fixes

**Best practices:**
- Разные Controllers/Resources для версий
- Deprecation warnings через headers
- Semantic versioning (v1, v2, v3)
- Поддержка старых версий ограниченное время
- Shared Services для бизнес-логики

---

## Практические задания

### Задание 1: Создай v2 с breaking change

У тебя есть V1 API с полем `user_name`. В V2 нужно разделить на `first_name` и `last_name`.

<details>
<summary>Решение</summary>

```php
// V1 Resource (старая структура)
namespace App\Http\Resources\V1;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_name' => $this->name,  // Одно поле
            'email' => $this->email,
        ];
    }
}

// V2 Resource (новая структура)
namespace App\Http\Resources\V2;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Парсим name на first_name и last_name
        [$firstName, $lastName] = $this->parseFullName($this->name);

        return [
            'id' => $this->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $this->email,
        ];
    }

    private function parseFullName(string $fullName): array
    {
        $parts = explode(' ', $fullName, 2);
        return [
            $parts[0] ?? '',
            $parts[1] ?? '',
        ];
    }
}

// Migration для БД (если нужно сохранить в БД)
Schema::table('users', function (Blueprint $table) {
    $table->string('first_name')->nullable();
    $table->string('last_name')->nullable();
});

// После миграции данных
DB::table('users')->get()->each(function ($user) {
    [$firstName, $lastName] = explode(' ', $user->name, 2);
    DB::table('users')->where('id', $user->id)->update([
        'first_name' => $firstName,
        'last_name' => $lastName ?? '',
    ]);
});

// routes/api.php
Route::prefix('v1')->group(function () {
    Route::get('/users', [V1\UserController::class, 'index']);
});

Route::prefix('v2')->group(function () {
    Route::get('/users', [V2\UserController::class, 'index']);
});
```
</details>

### Задание 2: Deprecation Strategy

Создай систему предупреждений о deprecation для V1 API.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/ApiDeprecationWarning.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ApiDeprecationWarning
{
    // Конфигурация версий
    private array $deprecations = [
        'v1' => [
            'deprecated_at' => '2024-01-01',
            'sunset_at' => '2024-06-01',
            'message' => 'API v1 is deprecated. Please migrate to v2.',
            'migration_url' => 'https://docs.example.com/api/v2-migration',
        ],
    ];

    public function handle(Request $request, Closure $next, string $version)
    {
        $response = $next($request);

        if (isset($this->deprecations[$version])) {
            $deprecation = $this->deprecations[$version];

            $response->headers->set('X-API-Deprecated', 'true');
            $response->headers->set('X-API-Deprecation-Date', $deprecation['deprecated_at']);
            $response->headers->set('X-API-Sunset-Date', $deprecation['sunset_at']);
            $response->headers->set('X-API-Deprecation-Info', $deprecation['migration_url']);

            $response->headers->set('Warning',
                sprintf('299 - "%s"', $deprecation['message'])
            );

            // Логирование использования deprecated API
            \Log::warning('Deprecated API usage', [
                'version' => $version,
                'endpoint' => $request->path(),
                'user_id' => $request->user()?->id,
                'ip' => $request->ip(),
            ]);
        }

        return $response;
    }
}

// app/Http/Kernel.php
protected $middlewareAliases = [
    'api.deprecation' => \App\Http\Middleware\ApiDeprecationWarning::class,
];

// routes/api.php
Route::prefix('v1')
    ->middleware('api.deprecation:v1')
    ->group(function () {
        Route::apiResource('posts', V1\PostController::class);
    });

Route::prefix('v2')->group(function () {
    Route::apiResource('posts', V2\PostController::class);
});

// Scheduled Command для отслеживания
namespace App\Console\Commands;

class CheckDeprecatedApiUsage extends Command
{
    protected $signature = 'api:check-deprecated-usage';

    public function handle()
    {
        // Анализ логов за последнюю неделю
        $usage = DB::table('api_logs')
            ->where('version', 'v1')
            ->where('created_at', '>=', now()->subWeek())
            ->groupBy('user_id')
            ->selectRaw('user_id, count(*) as requests_count')
            ->get();

        // Уведомление пользователей
        foreach ($usage as $record) {
            $user = User::find($record->user_id);
            if ($user) {
                Mail::to($user)->send(
                    new ApiDeprecationNotification('v1', '2024-06-01')
                );
            }
        }

        $this->info("Sent deprecation notices to {$usage->count()} users");
    }
}
```
</details>

### Задание 3: Версионирование через Header

Реализуй Header-based versioning с fallback на v1.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/ApiVersionResolver.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ApiVersionResolver
{
    private const DEFAULT_VERSION = 'v1';
    private const SUPPORTED_VERSIONS = ['v1', 'v2'];

    public function handle(Request $request, Closure $next)
    {
        $version = $this->resolveVersion($request);

        if (!in_array($version, self::SUPPORTED_VERSIONS)) {
            return response()->json([
                'error' => 'Unsupported API version',
                'supported_versions' => self::SUPPORTED_VERSIONS,
            ], 400);
        }

        $request->attributes->set('api_version', $version);
        $request->headers->set('X-API-Version', $version);

        return $next($request);
    }

    private function resolveVersion(Request $request): string
    {
        // 1. Проверяем Accept header
        $accept = $request->header('Accept');
        if (preg_match('/application\/vnd\.api\.(v\d+)\+json/', $accept, $matches)) {
            return $matches[1];
        }

        // 2. Проверяем custom header
        if ($version = $request->header('Api-Version')) {
            return $version;
        }

        // 3. Fallback на default
        return self::DEFAULT_VERSION;
    }
}

// Base Controller
namespace App\Http\Controllers\Api;

abstract class ApiController extends Controller
{
    protected function getApiVersion(Request $request): string
    {
        return $request->attributes->get('api_version', 'v1');
    }

    protected function resourceForVersion(Request $request, $data, array $resources)
    {
        $version = $this->getApiVersion($request);
        $resourceClass = $resources[$version] ?? $resources['v1'];

        return is_array($data) || $data instanceof \Illuminate\Support\Collection
            ? $resourceClass::collection($data)
            : new $resourceClass($data);
    }
}

// Unified Controller
namespace App\Http\Controllers\Api;

use App\Models\Post;

class PostController extends ApiController
{
    public function index(Request $request)
    {
        $posts = Post::with('user')->paginate(20);

        return $this->resourceForVersion($request, $posts, [
            'v1' => \App\Http\Resources\V1\PostResource::class,
            'v2' => \App\Http\Resources\V2\PostResource::class,
        ]);
    }

    public function show(Request $request, Post $post)
    {
        return $this->resourceForVersion($request, $post, [
            'v1' => \App\Http\Resources\V1\PostResource::class,
            'v2' => \App\Http\Resources\V2\PostResource::class,
        ]);
    }
}

// routes/api.php
Route::middleware('api.version')->group(function () {
    Route::apiResource('posts', PostController::class);
});

// Тестирование
// curl -H "Accept: application/vnd.api.v1+json" http://api.example.com/posts
// curl -H "Api-Version: v2" http://api.example.com/posts
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
