# 5.7 API Resources

## Что это

**Что это:**
API Resources — слой трансформации моделей в JSON. Контролируют, какие данные и в каком формате возвращать в API.

**Основное:**
- Resource — для одной модели
- ResourceCollection — для коллекций
- Скрывают внутреннюю структуру БД

---

## Как работает

**Создание Resource:**

```bash
# Resource для одной модели
php artisan make:resource UserResource

# Resource для коллекции
php artisan make:resource UserCollection
```

**Базовый Resource:**

```php
namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
```

**Использование в контроллере:**

```php
use App\Http\Resources\UserResource;

class UserController extends Controller
{
    public function show(User $user)
    {
        return new UserResource($user);
    }

    public function index()
    {
        $users = User::paginate(20);

        return UserResource::collection($users);
    }
}
```

**Resource с relationships:**

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'body' => $this->body,
            'created_at' => $this->created_at->toISOString(),

            // Всегда загружать автора
            'author' => new UserResource($this->whenLoaded('user')),

            // Условно загружать комментарии
            'comments' => CommentResource::collection($this->whenLoaded('comments')),

            // Условное поле
            'is_editable' => $this->when(
                $request->user()?->can('update', $this->resource),
                true
            ),
        ];
    }
}

// В контроллере с eager loading
public function show(Post $post)
{
    return new PostResource($post->load(['user', 'comments']));
}
```

**ResourceCollection:**

```php
namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class PostCollection extends ResourceCollection
{
    // Обернуть в data
    public $collects = PostResource::class;

    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            'meta' => [
                'total' => $this->total(),
                'current_page' => $this->currentPage(),
                'per_page' => $this->perPage(),
            ],
        ];
    }

    // Добавить дополнительные данные
    public function with(Request $request): array
    {
        return [
            'success' => true,
            'message' => 'Posts retrieved successfully',
        ];
    }
}

// Использование
public function index()
{
    $posts = Post::with('user')->paginate(20);

    return new PostCollection($posts);
}
```

---

## Когда использовать

**Используй API Resources когда:**
- API endpoints
- Нужно скрыть поля модели
- Трансформация данных
- Условные поля

**Не используй когда:**
- Внутренние запросы (между сервисами)
- Простой CRUD без трансформации

---

## Пример из практики

**Комплексный Resource с условной логикой:**

```php
namespace App\Http\Resources;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status,
            'total' => $this->total,

            // Форматирование даты
            'created_at' => $this->created_at->toISOString(),
            'created_at_human' => $this->created_at->diffForHumans(),

            // Вложенные ресурсы
            'user' => new UserResource($this->whenLoaded('user')),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),

            // Условные поля (только для владельца или админа)
            $this->mergeWhen($this->isViewableBy($request->user()), [
                'payment_method' => $this->payment_method,
                'billing_address' => $this->billing_address,
                'shipping_address' => $this->shipping_address,
            ]),

            // Условное поле
            'can_cancel' => $this->when(
                $request->user()?->can('cancel', $this->resource),
                true
            ),

            // Computed поле
            'is_shipped' => $this->status === 'shipped',

            // Pivot данные
            'pivot' => $this->whenPivotLoaded('order_product', function () {
                return [
                    'quantity' => $this->pivot->quantity,
                    'price' => $this->pivot->price,
                ];
            }),
        ];
    }

    // Дополнительные мета-данные
    public function with(Request $request): array
    {
        return [
            'links' => [
                'self' => route('orders.show', $this->id),
                'user' => route('users.show', $this->user_id),
            ],
        ];
    }

    private function isViewableBy(?User $user): bool
    {
        return $user && ($user->id === $this->user_id || $user->isAdmin());
    }
}
```

**Nested Resources:**

```php
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_url,

            // Вложенные коллекции
            'posts' => PostResource::collection($this->whenLoaded('posts')),
            'orders' => OrderResource::collection($this->whenLoaded('orders')),

            // Счётчики
            'posts_count' => $this->when(
                $this->posts_count !== null,
                $this->posts_count
            ),

            // Последний пост
            'latest_post' => new PostResource($this->whenLoaded('latestPost')),
        ];
    }
}

// Контроллер
public function show(User $user)
{
    return new UserResource(
        $user->load(['posts', 'latestPost'])
            ->loadCount('posts')
    );
}
```

**Conditional Attributes:**

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,

            // Показать body только для авторизованных
            'body' => $this->when($request->user(), $this->body),

            // Показать только для админов
            $this->mergeWhen($request->user()?->isAdmin(), [
                'views_count' => $this->views,
                'ip_address' => $this->ip_address,
            ]),

            // Показать draft только для автора
            'draft' => $this->when(
                $request->user()?->id === $this->user_id,
                $this->draft
            ),
        ];
    }
}
```

**Resource с параметрами:**

```php
class PostResource extends JsonResource
{
    // Передать параметры через конструктор
    public function __construct($resource, private bool $detailed = false)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
        ];

        // Детальная версия
        if ($this->detailed) {
            $data['body'] = $this->body;
            $data['meta_description'] = $this->meta_description;
            $data['comments'] = CommentResource::collection($this->whenLoaded('comments'));
        }

        return $data;
    }
}

// Использование
return new PostResource($post, detailed: true);
```

**Additional Data in Collections:**

```php
class PostCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            'meta' => [
                'total' => $this->total(),
                'per_page' => $this->perPage(),
                'current_page' => $this->currentPage(),
                'last_page' => $this->lastPage(),
            ],
            'links' => [
                'first' => $this->url(1),
                'last' => $this->url($this->lastPage()),
                'prev' => $this->previousPageUrl(),
                'next' => $this->nextPageUrl(),
            ],
        ];
    }

    public function with(Request $request): array
    {
        return [
            'success' => true,
            'filters' => [
                'category' => $request->input('category'),
                'search' => $request->input('search'),
            ],
        ];
    }
}
```

**Wrapping and Unwrapping:**

```php
// Изменить обёртку (по умолчанию 'data')
class PostResource extends JsonResource
{
    public static $wrap = 'post';  // Обернуть в 'post'
}

// Или отключить обёртку
class PostResource extends JsonResource
{
    public static $wrap = null;
}

// Или глобально в AppServiceProvider
use Illuminate\Http\Resources\Json\JsonResource;

public function boot(): void
{
    JsonResource::withoutWrapping();  // Отключить для всех
}
```

**Pagination Meta:**

```php
class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with('user')->paginate(20);

        return PostResource::collection($posts);
    }
}

// Вернёт:
{
    "data": [...],
    "links": {
        "first": "http://example.com/api/posts?page=1",
        "last": "http://example.com/api/posts?page=10",
        "prev": null,
        "next": "http://example.com/api/posts?page=2"
    },
    "meta": {
        "current_page": 1,
        "from": 1,
        "last_page": 10,
        "per_page": 20,
        "to": 20,
        "total": 200
    }
}
```

**Response Headers:**

```php
class UserResource extends JsonResource
{
    public function withResponse(Request $request, $response): void
    {
        $response->header('X-User-ID', $this->id);
        $response->header('X-Resource-Type', 'user');
    }
}
```

---

## На собеседовании скажешь

> "API Resources трансформируют модели в JSON. Resource для одной модели, ResourceCollection для коллекций. toArray() определяет структуру. whenLoaded() для relationships (избегает N+1). when() для условных полей. mergeWhen() для группы полей. ResourceCollection::collection() для пагинации. with() для дополнительных мета-данных. withoutWrapping() отключает обёртку data. Использую для API endpoints, скрытия полей, трансформации данных."
