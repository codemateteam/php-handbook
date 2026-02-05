# 5.1 Eloquent Relationships

## Краткое резюме

> **Eloquent Relationships** — способ связывать модели между собой без SQL JOIN.
>
> **Типы:** hasOne/belongsTo (1:1), hasMany/belongsTo (1:N), belongsToMany (N:N), hasManyThrough (через промежуточную), morphTo/morphMany (полиморфные).
>
> **Важно:** Eager loading через `with()` решает N+1 проблему.

---

## Содержание

- [Что это](#что-это)
- [Типы связей](#типы-связей)
- [Eager Loading](#eager-loading-n1-проблема)
- [Has/WhereHas запросы](#exists-queries-проверка-наличия)
- [WithCount](#counting-related-models)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Relationships (связи) в Eloquent — способ связывать модели между собой. Заменяют SQL JOIN и упрощают работу со связанными данными.

**Типы связей:**
- One to One (1:1) — hasOne / belongsTo
- One to Many (1:N) — hasMany / belongsTo
- Many to Many (N:N) — belongsToMany
- Has Many Through — hasManyThrough
- Polymorphic — morphTo / morphMany

---

## Типы связей

### One to One (hasOne / belongsTo)

```php
// User имеет один Profile
class User extends Model
{
    public function profile()
    {
        return $this->hasOne(Profile::class);
    }
}

// Profile принадлежит User
class Profile extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

// Использование
$user = User::find(1);
$profile = $user->profile;  // SELECT * FROM profiles WHERE user_id = 1

$profile = Profile::find(1);
$user = $profile->user;  // SELECT * FROM users WHERE id = $profile->user_id
```

### One to Many (hasMany / belongsTo)

```php
// User имеет много Posts
class User extends Model
{
    public function posts()
    {
        return $this->hasMany(Post::class);
    }
}

// Post принадлежит User
class Post extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

// Использование
$user = User::find(1);
$posts = $user->posts;  // SELECT * FROM posts WHERE user_id = 1

foreach ($user->posts as $post) {
    echo $post->title;
}

// Создать пост для пользователя
$user->posts()->create([
    'title' => 'New Post',
    'body' => 'Content',
]);
```

### Many to Many (belongsToMany)

```php
// User имеет много Roles, Role имеет много Users
// Промежуточная таблица: role_user (user_id, role_id)

class User extends Model
{
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }
}

class Role extends Model
{
    public function users()
    {
        return $this->belongsToMany(User::class);
    }
}

// Использование
$user = User::find(1);
$roles = $user->roles;  // JOIN через role_user

// Прикрепить роль
$user->roles()->attach($roleId);
$user->roles()->attach([1, 2, 3]);

// Открепить роль
$user->roles()->detach($roleId);
$user->roles()->detach();  // Открепить все

// Синхронизировать (удалить старые, добавить новые)
$user->roles()->sync([1, 2, 3]);

// Toggle (прикрепить если нет, открепить если есть)
$user->roles()->toggle([1, 2]);
```

### Pivot таблица с доп. полями

```php
class User extends Model
{
    public function roles()
    {
        return $this->belongsToMany(Role::class)
            ->withPivot('expires_at', 'is_active')  // Дополнительные поля
            ->withTimestamps();  // created_at, updated_at в pivot
    }
}

// Использование
foreach ($user->roles as $role) {
    echo $role->pivot->expires_at;
    echo $role->pivot->is_active;
}

// Создать с pivot полями
$user->roles()->attach($roleId, [
    'expires_at' => now()->addYear(),
    'is_active' => true,
]);
```

### Has Many Through

```php
// Country -> User -> Post
// Получить все посты страны через пользователей

class Country extends Model
{
    public function posts()
    {
        return $this->hasManyThrough(
            Post::class,      // Финальная модель
            User::class,      // Промежуточная модель
            'country_id',     // FK на countries в users
            'user_id',        // FK на users в posts
            'id',             // PK countries
            'id'              // PK users
        );
    }
}

// Использование
$country = Country::find(1);
$posts = $country->posts;  // Все посты пользователей этой страны
```

### Polymorphic Relations (полиморфные)

```php
// Комментарии для Post и Video
// Таблица comments: id, commentable_id, commentable_type, body

class Comment extends Model
{
    public function commentable()
    {
        return $this->morphTo();
    }
}

class Post extends Model
{
    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}

class Video extends Model
{
    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}

// Использование
$post = Post::find(1);
$comments = $post->comments;

$post->comments()->create([
    'body' => 'Great post!',
]);

$comment = Comment::find(1);
$commentable = $comment->commentable;  // Post или Video
```

---

## Когда использовать

| Связь | Пример | Когда использовать |
|-------|--------|-------------------|
| **hasOne / belongsTo** | User → Profile | Один к одному |
| **hasMany / belongsTo** | User → Posts | Один ко многим |
| **belongsToMany** | User ↔ Roles | Многие ко многим |
| **hasManyThrough** | Country → Posts (через Users) | Через промежуточную модель |
| **Polymorphic** | Comments для разных моделей | Универсальная связь |

---

## Eager Loading (N+1 проблема)

### Проблема N+1

```php
// ❌ ПЛОХО: N+1 запросов
$users = User::all();  // 1 запрос

foreach ($users as $user) {
    echo $user->profile->bio;  // N запросов
}

// ✅ ХОРОШО: 2 запроса
$users = User::with('profile')->get();  // 2 запроса (users + profiles)

foreach ($users as $user) {
    echo $user->profile->bio;  // Без запросов
}
```

### Вложенный Eager Loading

```php
// Вложенный eager loading
$users = User::with(['posts.comments.user'])->get();

// Условный eager loading
$users = User::with(['posts' => function ($query) {
    $query->where('published', true)->orderBy('created_at', 'desc');
}])->get();
```

### Lazy Eager Loading

```php
$users = User::all();

// Загрузить отношения после
$users->load('posts');
$users->load(['posts.comments']);

// Загрузить только если не загружены
$users->loadMissing('posts');
```

---

## Exists Queries (проверка наличия)

```php
// Пользователи с постами
$users = User::has('posts')->get();

// Пользователи с более чем 3 постами
$users = User::has('posts', '>', 3)->get();

// Пользователи с опубликованными постами
$users = User::whereHas('posts', function ($query) {
    $query->where('published', true);
})->get();

// Пользователи БЕЗ постов
$users = User::doesntHave('posts')->get();
```

---

## Counting Related Models

```php
// Подсчёт постов для каждого пользователя (1 запрос)
$users = User::withCount('posts')->get();

foreach ($users as $user) {
    echo $user->posts_count;  // Без дополнительных запросов
}

// С условием
$users = User::withCount(['posts' => function ($query) {
    $query->where('published', true);
}])->get();

// Несколько счётчиков
$users = User::withCount(['posts', 'comments', 'likes'])->get();
```

---

## Пример из практики

### E-commerce отношения

```php
// User hasMany Orders
class User extends Model
{
    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function latestOrder()
    {
        return $this->hasOne(Order::class)->latestOfMany();
    }

    public function oldestOrder()
    {
        return $this->hasOne(Order::class)->oldestOfMany();
    }
}

// Order belongsTo User, hasMany OrderItems
class Order extends Model
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function products()
    {
        return $this->hasManyThrough(
            Product::class,
            OrderItem::class,
            'order_id',
            'id',
            'id',
            'product_id'
        );
    }
}

// OrderItem belongsTo Order, belongsTo Product
class OrderItem extends Model
{
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

// Product belongsToMany Categories
class Product extends Model
{
    public function categories()
    {
        return $this->belongsToMany(Category::class)
            ->withTimestamps();
    }
}

// Использование
$user = User::with(['orders.items.product'])->find(1);

foreach ($user->orders as $order) {
    foreach ($order->items as $item) {
        echo "{$item->product->name}: {$item->quantity}";
    }
}
```

### Polymorphic Comments

```php
// Comment для Post, Video, Product
class Comment extends Model
{
    public function commentable()
    {
        return $this->morphTo();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

trait HasComments
{
    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}

class Post extends Model
{
    use HasComments;
}

class Video extends Model
{
    use HasComments;
}

// Использование
$post = Post::find(1);
$post->comments()->create([
    'user_id' => auth()->id(),
    'body' => 'Great post!',
]);

// Получить все комментарии с пользователем
$comments = $post->comments()->with('user')->get();
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Типы связей:**
- hasOne/belongsTo (1:1) — User → Profile
- hasMany/belongsTo (1:N) — User → Posts
- belongsToMany (N:N) — User ↔ Roles (через pivot таблицу)
- hasManyThrough — Country → Posts через Users
- Polymorphic — универсальные связи (Comments для разных моделей)

**Eager Loading:**
- `with()` загружает связи заранее (решает N+1 проблему)
- `load()` загружает после получения модели
- Вложенный: `with(['posts.comments.user'])`

**Работа с Many to Many:**
- `attach()` — прикрепить
- `detach()` — открепить
- `sync()` — синхронизировать
- `withPivot()` — дополнительные поля в pivot

**Запросы:**
- `has()` / `whereHas()` — фильтрация по наличию связей
- `withCount()` — подсчёт без загрузки
- `doesntHave()` — отсутствие связей

---

## Практические задания

### Задание 1: Настрой belongsToMany с pivot

У тебя есть `User` и `Project`. Пользователь может быть в нескольких проектах с ролью (`role`) и датой присоединения (`joined_at`). Настрой связь.

<details>
<summary>Решение</summary>

```php
// Migration: create_project_user_table
Schema::create('project_user', function (Blueprint $table) {
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->foreignId('project_id')->constrained()->onDelete('cascade');
    $table->string('role')->default('member');
    $table->timestamp('joined_at')->useCurrent();
    $table->timestamps();

    $table->primary(['user_id', 'project_id']);
});

// User Model
class User extends Model
{
    public function projects()
    {
        return $this->belongsToMany(Project::class)
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }
}

// Project Model
class Project extends Model
{
    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role', 'joined_at')
            ->withTimestamps();
    }
}

// Использование
$user->projects()->attach($projectId, [
    'role' => 'admin',
    'joined_at' => now(),
]);

foreach ($user->projects as $project) {
    echo "{$project->name}: {$project->pivot->role}";
}
```
</details>

### Задание 2: Исправь N+1 проблему

Что не так в этом коде? Исправь.

```php
$users = User::all();

return response()->json([
    'data' => $users->map(fn($user) => [
        'name' => $user->name,
        'posts_count' => $user->posts->count(),
        'latest_post' => $user->posts->sortByDesc('created_at')->first()?->title,
    ]),
]);
```

<details>
<summary>Решение</summary>

```php
// Проблема: N+1 запросов для posts

// Решение
$users = User::withCount('posts')
    ->with(['posts' => function ($query) {
        $query->latest()->limit(1);
    }])
    ->get();

return response()->json([
    'data' => $users->map(fn($user) => [
        'name' => $user->name,
        'posts_count' => $user->posts_count,  // Из withCount
        'latest_post' => $user->posts->first()?->title,  // Из with
    ]),
]);
```
</details>

### Задание 3: Реализуй Polymorphic связь

Создай `Image` модель которая может быть прикреплена к `Post`, `User`, `Product`. Реализуй связь.

<details>
<summary>Решение</summary>

```php
// Migration: create_images_table
Schema::create('images', function (Blueprint $table) {
    $table->id();
    $table->string('url');
    $table->morphs('imageable');  // imageable_id, imageable_type
    $table->timestamps();
});

// Image Model
class Image extends Model
{
    protected $fillable = ['url'];

    public function imageable()
    {
        return $this->morphTo();
    }
}

// Trait для переиспользования
trait HasImages
{
    public function images()
    {
        return $this->morphMany(Image::class, 'imageable');
    }

    public function image()
    {
        return $this->morphOne(Image::class, 'imageable');
    }
}

// Models
class Post extends Model
{
    use HasImages;
}

class User extends Model
{
    use HasImages;
}

class Product extends Model
{
    use HasImages;
}

// Использование
$post = Post::find(1);
$post->images()->create(['url' => 'https://example.com/image.jpg']);

$images = $post->images;  // Все изображения поста

// Получить все изображения с их владельцами
$images = Image::with('imageable')->get();

foreach ($images as $image) {
    $owner = $image->imageable;  // Post, User или Product
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
