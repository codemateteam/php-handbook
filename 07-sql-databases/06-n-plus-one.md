# 6.6 N+1 проблема

## Краткое резюме

> **N+1 проблема** — 1 запрос для списка + N запросов для каждого элемента. Частая проблема производительности.
>
> **Решение:** Eager Loading через `with()`. Для вложенных: `with('posts.comments')`. Для счётчиков: `withCount('posts')`.
>
> **Важно:** `preventLazyLoading()` в development детектирует N+1. Laravel Debugbar/Telescope для мониторинга.

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
N+1 — частая проблема производительности, когда выполняется 1 запрос для получения списка + N запросов для каждого элемента.

**Пример:**
- 1 запрос: получить всех пользователей
- N запросов: получить посты каждого пользователя

---

## Как работает

**❌ Проблема N+1:**

```php
// 1 запрос: получить пользователей
$users = User::all();  // SELECT * FROM users

// N запросов: для каждого пользователя получить посты
foreach ($users as $user) {
    echo $user->posts->count();  // SELECT * FROM posts WHERE user_id = 1
                                 // SELECT * FROM posts WHERE user_id = 2
                                 // SELECT * FROM posts WHERE user_id = 3
                                 // ...
}

// Итого: 1 + N запросов (если 100 пользователей = 101 запрос!)
```

**✅ Решение: Eager Loading:**

```php
// 2 запроса: пользователи + все их посты
$users = User::with('posts')->get();
// SELECT * FROM users
// SELECT * FROM posts WHERE user_id IN (1, 2, 3, ...)

foreach ($users as $user) {
    echo $user->posts->count();  // Без запросов (уже загружены)
}

// Итого: 2 запроса (независимо от количества пользователей)
```

---

## Когда использовать

**Используй Eager Loading когда:**
- Итерация по коллекции с доступом к relationships
- Выводишь список с вложенными данными

**Не используй когда:**
- Relationship не всегда нужен
- Conditional loading (загрузка по условию)

---

## Пример из практики

**Nested Eager Loading:**

```php
// ❌ N+1 на трёх уровнях
$users = User::all();

foreach ($users as $user) {
    foreach ($user->posts as $post) {  // N запросов
        foreach ($post->comments as $comment) {  // N * M запросов
            echo $comment->body;
        }
    }
}

// ✅ Вложенный Eager Loading
$users = User::with(['posts.comments'])->get();
// SELECT * FROM users
// SELECT * FROM posts WHERE user_id IN (...)
// SELECT * FROM comments WHERE post_id IN (...)
```

**Conditional Eager Loading:**

```php
// Загрузить только опубликованные посты
$users = User::with(['posts' => function ($query) {
    $query->where('published', true)
          ->orderBy('created_at', 'desc')
          ->limit(5);
}])->get();
```

**Lazy Eager Loading (загрузка после):**

```php
$users = User::all();

// Позже понадобились посты
if ($needPosts) {
    $users->load('posts');  // Догрузить
}

// Загрузить только если не загружены
$users->loadMissing('posts');
```

**Counting Related Models:**

```php
// ❌ N+1 (для каждого пользователя COUNT запрос)
$users = User::all();

foreach ($users as $user) {
    echo $user->posts()->count();  // SELECT COUNT(*) FROM posts WHERE user_id = 1
}

// ✅ withCount (1 запрос с LEFT JOIN и COUNT)
$users = User::withCount('posts')->get();

foreach ($users as $user) {
    echo $user->posts_count;  // Без запросов
}
```

**Exists Queries:**

```php
// ❌ N+1
$users = User::all();

foreach ($users as $user) {
    if ($user->posts()->exists()) {  // SELECT EXISTS(...)
        echo "Has posts";
    }
}

// ✅ whereHas (1 запрос)
$users = User::whereHas('posts')->get();

// Или с условием
$users = User::whereHas('posts', function ($query) {
    $query->where('published', true);
})->get();
```

**Polymorphic Relations:**

```php
// ❌ N+1 с morphTo
$comments = Comment::all();

foreach ($comments as $comment) {
    echo $comment->commentable->title;  // N запросов к разным таблицам
}

// ✅ with на polymorphic
$comments = Comment::with('commentable')->get();
```

**BelongsToMany with Pivot:**

```php
// ❌ N+1 на pivot данные
$users = User::all();

foreach ($users as $user) {
    foreach ($user->roles as $role) {
        echo $role->pivot->expires_at;  // Pivot уже загружен, OK
    }
}

// ✅ Eager load с pivot
$users = User::with(['roles' => function ($query) {
    $query->withPivot('expires_at', 'is_active');
}])->get();
```

**API Resource с Relationships:**

```php
// ❌ N+1 в Resource
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'author' => new UserResource($this->user),  // N запросов
            'comments_count' => $this->comments()->count(),  // N запросов
        ];
    }
}

// Controller
public function index()
{
    $posts = Post::paginate(20);
    return PostResource::collection($posts);  // N+1!
}

// ✅ Eager load в контроллере
public function index()
{
    $posts = Post::with('user')
        ->withCount('comments')
        ->paginate(20);

    return PostResource::collection($posts);
}

// Resource
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'author' => new UserResource($this->whenLoaded('user')),
            'comments_count' => $this->when(
                $this->comments_count !== null,
                $this->comments_count
            ),
        ];
    }
}
```

**Debugging N+1:**

```php
// 1. Laravel Debugbar
// Показывает все запросы и дубликаты

// 2. Telescope
// Queries tab показывает все запросы

// 3. QueryLog
DB::enableQueryLog();

User::all()->each(function ($user) {
    echo $user->posts->count();
});

dd(DB::getQueryLog());

// 4. Package: beyondcode/laravel-query-detector
// Автоматически детектирует N+1 в development

// 5. Prevent Lazy Loading (Laravel 8.43+)
// В AppServiceProvider
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::preventLazyLoading(! app()->isProduction());
}

// Теперь lazy loading выкинет исключение
```

**Global Scopes для Eager Loading:**

```php
// Автоматически загружать relationship
class Post extends Model
{
    protected $with = ['user', 'category'];

    // Теперь Post::all() автоматически загрузит user и category
}

// Отключить для конкретного запроса
$posts = Post::without('user')->get();
```

**Subquery Select (альтернатива withCount):**

```php
// Добавить подзапрос в SELECT
$users = User::select([
    'users.*',
    'posts_count' => Post::selectRaw('COUNT(*)')
        ->whereColumn('posts.user_id', 'users.id')
])->get();

// Эквивалентно withCount, но больше контроля
$users = User::addSelect([
    'latest_post_created_at' => Post::select('created_at')
        ->whereColumn('posts.user_id', 'users.id')
        ->latest()
        ->limit(1)
])->get();
```

---

## На собеседовании скажешь

> "N+1 проблема — 1 запрос для списка + N запросов для каждого элемента. Решение: Eager Loading через with(). with('posts.comments') для вложенных. withCount('posts') для счётчиков без загрузки данных. whereHas() для фильтрации по relationship. lazy() для загрузки после. preventLazyLoading() в development детектирует N+1. Laravel Debugbar/Telescope для мониторинга. whenLoaded() в API Resources для условной загрузки."

---

## Практические задания

### Задание 1: Найди и исправь N+1

Что не так с этим кодом? Сколько запросов выполнится?

```php
public function index()
{
    $posts = Post::where('published', true)->get();

    return view('posts.index', compact('posts'));
}

// Blade view
@foreach ($posts as $post)
    <h2>{{ $post->title }}</h2>
    <p>Автор: {{ $post->user->name }}</p>
    <p>Категория: {{ $post->category->name }}</p>
    <p>Комментариев: {{ $post->comments->count() }}</p>
@endforeach
```

<details>
<summary>Решение</summary>

```php
// ❌ Проблема: 1 + 3N запросов
// 1 запрос: SELECT * FROM posts WHERE published = 1
// N запросов: SELECT * FROM users WHERE id = ? (для каждого поста)
// N запросов: SELECT * FROM categories WHERE id = ? (для каждого поста)
// N запросов: SELECT * FROM comments WHERE post_id = ? (для каждого поста)

// Если 100 постов = 1 + 300 = 301 запрос!

// ✅ Решение: Eager Loading
public function index()
{
    $posts = Post::where('published', true)
        ->with(['user', 'category'])  // Загрузить user и category
        ->withCount('comments')  // Подсчитать комментарии
        ->get();

    return view('posts.index', compact('posts'));
}

// Теперь всего 4 запроса:
// 1. SELECT * FROM posts WHERE published = 1
// 2. SELECT * FROM users WHERE id IN (...)
// 3. SELECT * FROM categories WHERE id IN (...)
// 4. SELECT post_id, COUNT(*) FROM comments WHERE post_id IN (...) GROUP BY post_id

// В Blade
@foreach ($posts as $post)
    <h2>{{ $post->title }}</h2>
    <p>Автор: {{ $post->user->name }}</p>
    <p>Категория: {{ $post->category->name }}</p>
    <p>Комментариев: {{ $post->comments_count }}</p>  {{-- Из withCount --}}
@endforeach
```
</details>

### Задание 2: API Resource с N+1

Исправь N+1 проблему в API эндпоинте.

```php
class PostController extends Controller
{
    public function index()
    {
        $posts = Post::paginate(20);
        return PostResource::collection($posts);
    }
}

class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'author' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'category' => $this->category->name,
            'comments_count' => $this->comments()->count(),
            'likes_count' => $this->likes()->count(),
            'tags' => $this->tags->pluck('name'),
        ];
    }
}
```

<details>
<summary>Решение</summary>

```php
// ✅ Исправленный контроллер
class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with(['user', 'category', 'tags'])
            ->withCount(['comments', 'likes'])
            ->paginate(20);

        return PostResource::collection($posts);
    }
}

// ✅ Исправленный Resource с whenLoaded
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,

            // whenLoaded предотвращает N+1 если relationship не загружен
            'author' => $this->whenLoaded('user', function () {
                return [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                ];
            }),

            'category' => $this->whenLoaded('category', fn() => $this->category->name),

            // Используем withCount (не вызываем count() в Resource)
            'comments_count' => $this->when(
                isset($this->comments_count),
                $this->comments_count
            ),

            'likes_count' => $this->when(
                isset($this->likes_count),
                $this->likes_count
            ),

            'tags' => $this->whenLoaded('tags', function () {
                return $this->tags->pluck('name');
            }),
        ];
    }
}

// Альтернатива: отдельный Resource для User
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'author' => new UserResource($this->whenLoaded('user')),
            'category' => $this->whenLoaded('category', fn() => $this->category->name),
            'comments_count' => $this->comments_count ?? 0,
            'likes_count' => $this->likes_count ?? 0,
            'tags' => TagResource::collection($this->whenLoaded('tags')),
        ];
    }
}
```
</details>

### Задание 3: Вложенные relationships

Оптимизируй загрузку: пользователи → посты → комментарии → автор комментария.

```php
$users = User::all();

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        foreach ($post->comments as $comment) {
            echo $comment->user->name;
        }
    }
}
```

<details>
<summary>Решение</summary>

```php
// ❌ Проблема: Вложенный N+1
// 1 запрос: users
// N запросов: posts для каждого user
// N*M запросов: comments для каждого post
// N*M*K запросов: user для каждого comment
// Если 10 users, 100 posts, 1000 comments = тысячи запросов!

// ✅ Решение 1: Nested Eager Loading
$users = User::with(['posts.comments.user'])->get();

// Всего 4 запроса:
// 1. SELECT * FROM users
// 2. SELECT * FROM posts WHERE user_id IN (...)
// 3. SELECT * FROM comments WHERE post_id IN (...)
// 4. SELECT * FROM users WHERE id IN (...) -- для авторов комментариев

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        foreach ($post->comments as $comment) {
            echo $comment->user->name;  // Без запросов
        }
    }
}

// ✅ Решение 2: С условиями
$users = User::with([
    'posts' => function ($query) {
        $query->where('published', true)
              ->latest()
              ->limit(5);
    },
    'posts.comments' => function ($query) {
        $query->latest()->limit(10);
    },
    'posts.comments.user:id,name'  // Загрузить только id и name
])->get();

// ✅ Решение 3: Lazy Eager Loading (если забыли загрузить)
$users = User::all();

// Позже понадобились вложенные данные
$users->load(['posts.comments.user']);

// ✅ Решение 4: Только счётчики (без загрузки данных)
$users = User::withCount([
    'posts',
    'posts as published_posts_count' => function ($query) {
        $query->where('published', true);
    }
])->get();

foreach ($users as $user) {
    echo "{$user->name}: {$user->posts_count} постов";
}

// ✅ Решение 5: preventLazyLoading для детекции N+1
// В AppServiceProvider::boot()
use Illuminate\Database\Eloquent\Model;

Model::preventLazyLoading(! app()->isProduction());

// Теперь при lazy loading будет исключение в development
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
