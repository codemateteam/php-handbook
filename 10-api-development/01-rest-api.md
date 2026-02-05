# 9.1 REST API

## Краткое резюме

> **REST API** — архитектурный стиль для создания веб-сервисов через HTTP.
>
> **Основное:** GET (чтение), POST (создание), PUT/PATCH (обновление), DELETE (удаление). Stateless, ресурсы через URI.
>
> **Laravel:** `Route::apiResource()`, API Resources для трансформации, HTTP status codes (200, 201, 204, 404, 422).

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
REST (Representational State Transfer) — архитектурный стиль для создания API. Использует HTTP методы для операций над ресурсами.

**Принципы REST:**
- Stateless (без состояния)
- Единообразие интерфейса
- Ресурсы через URI
- HTTP методы (GET, POST, PUT, DELETE)

---

## Как работает

**HTTP методы:**

```
GET     /api/posts           # Список постов
GET     /api/posts/1         # Один пост
POST    /api/posts           # Создать пост
PUT     /api/posts/1         # Обновить пост (полностью)
PATCH   /api/posts/1         # Обновить пост (частично)
DELETE  /api/posts/1         # Удалить пост
```

**Laravel API Routes:**

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    // RESTful resource
    Route::apiResource('posts', PostController::class);

    // Эквивалентно:
    // Route::get('/posts', [PostController::class, 'index']);
    // Route::post('/posts', [PostController::class, 'store']);
    // Route::get('/posts/{post}', [PostController::class, 'show']);
    // Route::put('/posts/{post}', [PostController::class, 'update']);
    // Route::delete('/posts/{post}', [PostController::class, 'destroy']);
});
```

**API Controller:**

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\{StorePostRequest, UpdatePostRequest};
use App\Http\Resources\PostResource;
use App\Models\Post;

class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with('user')->paginate(20);

        return PostResource::collection($posts);
    }

    public function store(StorePostRequest $request)
    {
        $post = Post::create([
            'user_id' => $request->user()->id,
            ...$request->validated(),
        ]);

        return new PostResource($post);
    }

    public function show(Post $post)
    {
        return new PostResource($post->load('user', 'comments'));
    }

    public function update(UpdatePostRequest $request, Post $post)
    {
        $this->authorize('update', $post);

        $post->update($request->validated());

        return new PostResource($post);
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);

        $post->delete();

        return response()->noContent();
    }
}
```

**HTTP Status Codes:**

```php
200 OK                  // Успешный GET, PUT, PATCH
201 Created             // Успешный POST
204 No Content          // Успешный DELETE
400 Bad Request         // Неверный запрос
401 Unauthorized        // Не авторизован
403 Forbidden           // Нет прав
404 Not Found           // Не найдено
422 Unprocessable       // Ошибка валидации
500 Internal Error      // Ошибка сервера

// Примеры
return response()->json($data, 200);
return response()->json($post, 201);
return response()->noContent();  // 204
return response()->json(['error' => 'Not found'], 404);
```

---

## Когда использовать

**REST для:**
- CRUD операции
- Публичные API
- Стандартные веб-сервисы

**Не REST (GraphQL) для:**
- Сложные запросы данных
- Много вложенных ресурсов
- Гибкость в выборе полей

---

## Пример из практики

**Полноценный REST API:**

```php
// routes/api.php
Route::prefix('v1')->group(function () {
    // Публичные endpoints
    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/posts/{post}', [PostController::class, 'show']);

    // Аутентификация
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    // Защищённые endpoints
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // CRUD для постов
        Route::apiResource('posts', PostController::class)
            ->except(['index', 'show']);

        // Nested resources
        Route::apiResource('posts.comments', CommentController::class)
            ->shallow();
    });
});
```

**API Resource (трансформация ответа):**

```php
// app/Http/Resources/PostResource.php
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'body' => $this->when($request->user(), $this->body),
            'published_at' => $this->published_at?->toISOString(),

            // Relationships
            'author' => new UserResource($this->whenLoaded('user')),
            'comments' => CommentResource::collection($this->whenLoaded('comments')),

            // Computed
            'comments_count' => $this->when(
                $this->comments_count !== null,
                $this->comments_count
            ),

            // Links
            'links' => [
                'self' => route('posts.show', $this->id),
            ],
        ];
    }
}
```

**Фильтрация и сортировка:**

```php
class PostController extends Controller
{
    public function index(Request $request)
    {
        $query = Post::query();

        // Фильтрация
        if ($request->filled('category')) {
            $query->where('category_id', $request->category);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', "%{$request->search}%");
        }

        if ($request->filled('published')) {
            $query->where('published', $request->boolean('published'));
        }

        // Сортировка
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');

        $allowedSort = ['id', 'title', 'created_at', 'views'];
        if (in_array($sortBy, $allowedSort)) {
            $query->orderBy($sortBy, $sortOrder);
        }

        // Пагинация
        $perPage = $request->input('per_page', 20);
        $posts = $query->paginate($perPage);

        return PostResource::collection($posts);
    }
}

// Примеры запросов:
// GET /api/posts?category=1&search=laravel&sort_by=title&sort_order=asc&per_page=50
```

**Вложенные ресурсы (nested):**

```php
// routes/api.php
Route::apiResource('posts.comments', CommentController::class);

// Генерирует:
// GET    /posts/{post}/comments
// POST   /posts/{post}/comments
// GET    /posts/{post}/comments/{comment}
// PUT    /posts/{post}/comments/{comment}
// DELETE /posts/{post}/comments/{comment}

// Controller
class CommentController extends Controller
{
    public function index(Post $post)
    {
        $comments = $post->comments()->with('user')->paginate(20);

        return CommentResource::collection($comments);
    }

    public function store(Request $request, Post $post)
    {
        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        return new CommentResource($comment);
    }
}
```

**Error Handling:**

```php
// app/Exceptions/Handler.php
public function render($request, Throwable $exception)
{
    if ($request->is('api/*')) {
        if ($exception instanceof ModelNotFoundException) {
            return response()->json([
                'message' => 'Resource not found'
            ], 404);
        }

        if ($exception instanceof ValidationException) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $exception->errors(),
            ], 422);
        }

        if ($exception instanceof AuthorizationException) {
            return response()->json([
                'message' => 'Forbidden'
            ], 403);
        }

        return response()->json([
            'message' => 'Internal server error',
            'error' => app()->environment('local') ? $exception->getMessage() : null,
        ], 500);
    }

    return parent::render($request, $exception);
}
```

**HATEOAS (Hypermedia):**

```php
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,

            // HATEOAS links
            '_links' => [
                'self' => [
                    'href' => route('posts.show', $this->id),
                ],
                'author' => [
                    'href' => route('users.show', $this->user_id),
                ],
                'comments' => [
                    'href' => route('posts.comments.index', $this->id),
                ],
                'edit' => $this->when(
                    $request->user()?->can('update', $this->resource),
                    ['href' => route('posts.update', $this->id)]
                ),
            ],
        ];
    }
}
```

**Versioning:**

```php
// routes/api.php
Route::prefix('v1')->namespace('Api\V1')->group(function () {
    Route::apiResource('posts', PostController::class);
});

Route::prefix('v2')->namespace('Api\V2')->group(function () {
    Route::apiResource('posts', PostController::class);
});

// Controllers в разных namespace
// App\Http\Controllers\Api\V1\PostController
// App\Http\Controllers\Api\V2\PostController
```

---

## На собеседовании скажешь

> "REST использует HTTP методы: GET (чтение), POST (создание), PUT/PATCH (обновление), DELETE (удаление). Stateless — каждый запрос независим. Status codes: 200 OK, 201 Created, 204 No Content, 404 Not Found, 422 Validation. Laravel: apiResource для CRUD, Route Model Binding, API Resources для трансформации. Фильтрация через query params. Nested resources для связей (posts/{post}/comments). HATEOAS — ссылки в ответе. Versioning через /v1, /v2."

---

## Практические задания

### Задание 1: Создай RESTful API для блога

Создай API endpoints для работы с постами: получение списка, создание, обновление, удаление. Добавь пагинацию и фильтрацию по категориям.

<details>
<summary>Решение</summary>

```php
// routes/api.php
Route::prefix('v1')->group(function () {
    Route::middleware('auth:sanctum')->group(function () {
        Route::apiResource('posts', PostController::class);
    });

    // Публичные endpoints
    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/posts/{post}', [PostController::class, 'show']);
});

// app/Http/Controllers/Api/PostController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\{StorePostRequest, UpdatePostRequest};
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index(Request $request)
    {
        $query = Post::query()->with('user', 'category');

        // Фильтрация по категории
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Поиск
        if ($request->filled('search')) {
            $query->where('title', 'like', "%{$request->search}%");
        }

        // Сортировка
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');

        $query->orderBy($sortBy, $sortOrder);

        // Пагинация
        $posts = $query->paginate($request->input('per_page', 15));

        return PostResource::collection($posts);
    }

    public function store(StorePostRequest $request)
    {
        $post = Post::create([
            'user_id' => $request->user()->id,
            ...$request->validated(),
        ]);

        return new PostResource($post);
    }

    public function show(Post $post)
    {
        return new PostResource($post->load('user', 'category', 'comments'));
    }

    public function update(UpdatePostRequest $request, Post $post)
    {
        $this->authorize('update', $post);

        $post->update($request->validated());

        return new PostResource($post);
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);

        $post->delete();

        return response()->noContent();
    }
}

// app/Http/Resources/PostResource.php
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'published_at' => $this->published_at?->toISOString(),
            'author' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'category' => [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ],
            'comments_count' => $this->whenCounted('comments'),
        ];
    }
}
```

</details>

### Задание 2: Добавь вложенные комментарии

Создай endpoints для работы с комментариями к постам: `/api/posts/{post}/comments`. Реализуй создание, получение списка и удаление комментариев.

<details>
<summary>Решение</summary>

```php
// routes/api.php
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::apiResource('posts.comments', CommentController::class)
        ->except(['update', 'show']);
});

// Публичный endpoint для просмотра
Route::get('/v1/posts/{post}/comments', [CommentController::class, 'index']);

// app/Http/Controllers/Api/CommentController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCommentRequest;
use App\Http\Resources\CommentResource;
use App\Models\{Post, Comment};

class CommentController extends Controller
{
    public function index(Post $post)
    {
        $comments = $post->comments()
            ->with('user')
            ->latest()
            ->paginate(20);

        return CommentResource::collection($comments);
    }

    public function store(StoreCommentRequest $request, Post $post)
    {
        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        return new CommentResource($comment);
    }

    public function destroy(Post $post, Comment $comment)
    {
        $this->authorize('delete', $comment);

        // Проверка что комментарий принадлежит посту
        if ($comment->post_id !== $post->id) {
            return response()->json(['message' => 'Comment not found'], 404);
        }

        $comment->delete();

        return response()->noContent();
    }
}

// app/Http/Resources/CommentResource.php
class CommentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'created_at' => $this->created_at->toISOString(),
            'author' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
        ];
    }
}
```

</details>

### Задание 3: Реализуй обработку ошибок

Создай единую обработку ошибок для всех API endpoints. Верни правильные status codes и структурированные ошибки.

<details>
<summary>Решение</summary>

```php
// app/Exceptions/Handler.php
namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $exception)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            return $this->handleApiException($request, $exception);
        }

        return parent::render($request, $exception);
    }

    protected function handleApiException($request, Throwable $exception)
    {
        if ($exception instanceof ValidationException) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $exception->errors(),
            ], 422);
        }

        if ($exception instanceof ModelNotFoundException) {
            return response()->json([
                'message' => 'Resource not found',
            ], 404);
        }

        if ($exception instanceof NotFoundHttpException) {
            return response()->json([
                'message' => 'Endpoint not found',
            ], 404);
        }

        if ($exception instanceof AuthenticationException) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        if ($exception instanceof AuthorizationException) {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        // Общая ошибка сервера
        return response()->json([
            'message' => 'Internal server error',
            'error' => app()->environment('local') ? $exception->getMessage() : null,
            'trace' => app()->environment('local') ? $exception->getTraceAsString() : null,
        ], 500);
    }
}

// app/Http/Middleware/ForceJsonResponse.php
namespace App\Http\Middleware;

use Closure;

class ForceJsonResponse
{
    public function handle($request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}

// Зарегистрировать middleware в app/Http/Kernel.php
protected $middlewareGroups = [
    'api' => [
        \App\Http\Middleware\ForceJsonResponse::class,
        // ...
    ],
];
```

</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
