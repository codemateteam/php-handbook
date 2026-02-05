# 13.1 Caching

## Краткое резюме

> **Caching** — сохранение результатов вычислений для повторного использования. Ускоряет приложение в разы.
>
> **Типы:** Application cache (данные), Route/Config/View cache, OPcache (PHP bytecode), Redis (sessions, queue).
>
> **Команды:** `Cache::remember`, `Cache::tags`, `php artisan optimize`, `Cache::forget` для инвалидации.

---

## Содержание

- [Что это](#что-это)
- [Application Cache](#application-cache)
- [Кеширование запросов](#кеширование-запросов)
- [Инвалидация кеша](#инвалидация-кеша)
- [Laravel Cache Commands](#laravel-cache-commands)
- [Redis](#redis)
- [HTTP Cache](#http-cache)
- [Практические примеры](#практические-примеры)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Кеширование — сохранение результатов вычислений для повторного использования. Ускоряет приложение.

**Типы кеша:**
- Application cache (данные)
- Route cache
- Config cache
- View cache
- OPcache (PHP bytecode)

---

## Application Cache

**Базовое использование:**

```php
use Illuminate\Support\Facades\Cache;

// Получить из кеша
$value = Cache::get('key');

// С default значением
$value = Cache::get('key', 'default');

// Сохранить на 60 секунд
Cache::put('key', 'value', 60);

// Сохранить навсегда
Cache::forever('key', 'value');

// Удалить
Cache::forget('key');

// Проверить существование
if (Cache::has('key')) {
    // ...
}
```

**Cache::remember:**

```php
// Получить или вычислить и закешировать
$users = Cache::remember('users.all', 3600, function () {
    return User::all();
});

// Forever
$settings = Cache::rememberForever('settings', function () {
    return Setting::all()->pluck('value', 'key');
});
```

**Tagging (для Redis/Memcached):**

```php
// Сохранить с тегами
Cache::tags(['users', 'posts'])->put('john', $user, 600);

// Получить
$user = Cache::tags(['users', 'posts'])->get('john');

// Очистить все с тегом
Cache::tags(['users'])->flush();
```

---

## Кеширование запросов

**Eloquent:**

```php
// ❌ ПЛОХО: запрос на каждый вызов
public function getUsers()
{
    return User::all();
}

// ✅ ХОРОШО: закешировать
public function getUsers()
{
    return Cache::remember('users.all', 3600, function () {
        return User::all();
    });
}
```

**Query Builder:**

```php
$posts = Cache::remember('posts.published', 3600, function () {
    return DB::table('posts')
        ->where('published', true)
        ->orderBy('created_at', 'desc')
        ->limit(10)
        ->get();
});
```

**Кеш для конкретного пользователя:**

```php
public function getUserOrders(User $user)
{
    return Cache::remember("user.{$user->id}.orders", 3600, function () use ($user) {
        return $user->orders()->with('items')->get();
    });
}
```

---

## Инвалидация кеша

**Model Observer:**

```php
// app/Observers/UserObserver.php
class UserObserver
{
    public function created(User $user)
    {
        Cache::forget('users.all');
        Cache::forget('users.count');
    }

    public function updated(User $user)
    {
        Cache::forget("user.{$user->id}");
        Cache::forget('users.all');
    }

    public function deleted(User $user)
    {
        Cache::forget("user.{$user->id}");
        Cache::forget('users.all');
        Cache::forget('users.count');
    }
}
```

**События:**

```php
// app/Listeners/ClearUserCache.php
class ClearUserCache
{
    public function handle(UserUpdated $event)
    {
        Cache::tags(['users'])->flush();
    }
}
```

---

## Laravel Cache Commands

**Route cache:**

```bash
# Кешировать routes (только для closure-free routes)
php artisan route:cache

# Очистить
php artisan route:clear
```

**Config cache:**

```bash
# Кешировать конфиг (нельзя использовать env() в коде!)
php artisan config:cache

# Очистить
php artisan config:clear
```

**View cache:**

```bash
# Прекомпилировать Blade views
php artisan view:cache

# Очистить
php artisan view:clear
```

**Event cache:**

```bash
# Кешировать event listeners
php artisan event:cache

# Очистить
php artisan event:clear
```

**Оптимизация для production:**

```bash
# Всё в одной команде
php artisan optimize

# Включает:
# - config:cache
# - route:cache
# - view:cache

# Очистить всё
php artisan optimize:clear
```

---

## Redis

**Конфигурация (.env):**

```
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

**Использование:**

```php
use Illuminate\Support\Facades\Redis;

// Базовые операции
Redis::set('name', 'John');
$name = Redis::get('name');

// Expire
Redis::setex('key', 60, 'value');

// Lists
Redis::lpush('queue', 'task1');
Redis::rpush('queue', 'task2');
$task = Redis::lpop('queue');

// Sets
Redis::sadd('users:online', $userId);
Redis::srem('users:online', $userId);
$online = Redis::smembers('users:online');

// Sorted Sets (для leaderboards)
Redis::zadd('scores', $score, $userId);
$top = Redis::zrevrange('scores', 0, 9);  // Top 10
```

---

## HTTP Cache

**Response caching:**

```php
// Cache response на 60 секунд
Route::get('/posts', function () {
    return Cache::remember('posts.all', 60, function () {
        return Post::all();
    });
});

// ETags
public function show(Post $post)
{
    $etag = md5($post->updated_at);

    if ($request->header('If-None-Match') === $etag) {
        return response()->noContent(304);
    }

    return response()->json($post)
        ->header('ETag', $etag)
        ->header('Cache-Control', 'max-age=3600');
}
```

**Middleware:**

```php
// app/Http/Middleware/CacheResponse.php
public function handle($request, Closure $next)
{
    $key = 'response.' . md5($request->url());

    if (Cache::has($key)) {
        return response(Cache::get($key))
            ->header('X-Cache', 'HIT');
    }

    $response = $next($request);

    Cache::put($key, $response->getContent(), 3600);

    return $response->header('X-Cache', 'MISS');
}
```

---

## Практические примеры

**Кеш для dashboard:**

```php
public function dashboard()
{
    $data = Cache::remember('dashboard.stats', 600, function () {
        return [
            'users_count' => User::count(),
            'orders_today' => Order::whereDate('created_at', today())->count(),
            'revenue_today' => Order::whereDate('created_at', today())->sum('total'),
            'popular_products' => Product::withCount('orders')
                ->orderBy('orders_count', 'desc')
                ->limit(5)
                ->get(),
        ];
    });

    return view('dashboard', $data);
}
```

**Кеш с автоинвалидацией:**

```php
// app/Services/CachedUserService.php
class CachedUserService
{
    public function getUser(int $id): ?User
    {
        return Cache::remember("user.$id", 3600, function () use ($id) {
            return User::with('profile', 'roles')->find($id);
        });
    }

    public function updateUser(int $id, array $data): User
    {
        $user = User::findOrFail($id);
        $user->update($data);

        // Инвалидировать кеш
        Cache::forget("user.$id");

        return $user;
    }
}
```

**Leaderboard с Redis:**

```php
class LeaderboardService
{
    public function addScore(int $userId, int $score): void
    {
        Redis::zadd('leaderboard', $score, $userId);
    }

    public function getTop(int $limit = 10): array
    {
        return Cache::remember("leaderboard.top.$limit", 60, function () use ($limit) {
            $userIds = Redis::zrevrange('leaderboard', 0, $limit - 1, 'WITHSCORES');

            $users = User::whereIn('id', array_keys($userIds))->get()->keyBy('id');

            return collect($userIds)->map(function ($score, $userId) use ($users) {
                return [
                    'user' => $users[$userId],
                    'score' => $score,
                ];
            })->values();
        });
    }
}
```

---

## На собеседовании скажешь

> "Кеширование ускоряет приложение. Cache::remember для данных, инвалидация через Model Observer или события. Laravel cache commands: route:cache, config:cache, view:cache, optimize. Redis для сессий, queue, cache. Tagging для группового удаления. HTTP cache с ETags. Cache::tags для группировки. Кешировать тяжёлые запросы (JOIN, COUNT, агрегаты). Инвалидация при изменении данных."

---

## Практические задания

### Задание 1: Кеширование с автоинвалидацией

Реализуй кеширование списка популярных продуктов (с количеством заказов > 10), которое автоматически инвалидируется при создании нового заказа.

<details>
<summary>Решение</summary>

```php
// app/Services/ProductService.php
class ProductService
{
    public function getPopularProducts()
    {
        return Cache::remember('products.popular', 3600, function () {
            return Product::withCount('orders')
                ->having('orders_count', '>', 10)
                ->orderBy('orders_count', 'desc')
                ->limit(10)
                ->get();
        });
    }

    public function invalidatePopularCache(): void
    {
        Cache::forget('products.popular');
    }
}

// app/Observers/OrderObserver.php
class OrderObserver
{
    public function __construct(private ProductService $productService) {}

    public function created(Order $order)
    {
        // Инвалидировать кеш популярных продуктов
        $this->productService->invalidatePopularCache();
    }
}

// app/Providers/AppServiceProvider.php
public function boot()
{
    Order::observe(OrderObserver::class);
}
```
</details>

### Задание 2: Cache Tags для группового удаления

Реализуй кеширование постов пользователя с использованием tags. При обновлении пользователя или создании нового поста — очистить все связанные кеши.

<details>
<summary>Решение</summary>

```php
// app/Services/PostService.php
class PostService
{
    public function getUserPosts(int $userId)
    {
        return Cache::tags(['users', "user:$userId", 'posts'])
            ->remember("user.$userId.posts", 3600, function () use ($userId) {
                return Post::where('user_id', $userId)
                    ->with('category')
                    ->orderBy('created_at', 'desc')
                    ->get();
            });
    }

    public function getPost(int $postId)
    {
        $post = Post::find($postId);

        return Cache::tags(['posts', "user:{$post->user_id}", "post:$postId"])
            ->remember("post.$postId", 3600, function () use ($post) {
                return $post->load('user', 'comments');
            });
    }
}

// app/Observers/UserObserver.php
class UserObserver
{
    public function updated(User $user)
    {
        // Очистить все кеши связанные с пользователем
        Cache::tags(["user:{$user->id}"])->flush();
    }
}

// app/Observers/PostObserver.php
class PostObserver
{
    public function created(Post $post)
    {
        // Очистить кеш постов пользователя
        Cache::tags(["user:{$post->user_id}"])->flush();
    }

    public function updated(Post $post)
    {
        // Очистить кеш конкретного поста
        Cache::tags(["post:{$post->id}"])->flush();
    }
}
```
</details>

### Задание 3: Redis для Leaderboard

Реализуй систему рейтинга игроков используя Redis Sorted Sets. Добавь методы для добавления очков и получения топ-10.

<details>
<summary>Решение</summary>

```php
// app/Services/LeaderboardService.php
use Illuminate\Support\Facades\Redis;

class LeaderboardService
{
    private const LEADERBOARD_KEY = 'game:leaderboard';
    private const CACHE_TTL = 60; // 1 минута

    public function addScore(int $userId, int $score): void
    {
        // Добавить или обновить score
        Redis::zadd(self::LEADERBOARD_KEY, $score, $userId);

        // Инвалидировать кеш топа
        Cache::forget('leaderboard.top.10');
        Cache::forget('leaderboard.top.100');
    }

    public function incrementScore(int $userId, int $points): int
    {
        Redis::zincrby(self::LEADERBOARD_KEY, $points, $userId);

        Cache::forget('leaderboard.top.10');

        return $this->getScore($userId);
    }

    public function getScore(int $userId): int
    {
        return (int) Redis::zscore(self::LEADERBOARD_KEY, $userId);
    }

    public function getTop(int $limit = 10): array
    {
        return Cache::remember("leaderboard.top.$limit", self::CACHE_TTL, function () use ($limit) {
            // Получить топ игроков с scores
            $userIds = Redis::zrevrange(
                self::LEADERBOARD_KEY,
                0,
                $limit - 1,
                'WITHSCORES'
            );

            // Преобразовать в массив [user_id => score]
            $scores = [];
            for ($i = 0; $i < count($userIds); $i += 2) {
                $scores[$userIds[$i]] = (int) $userIds[$i + 1];
            }

            // Загрузить пользователей
            $users = User::whereIn('id', array_keys($scores))->get()->keyBy('id');

            // Сформировать результат
            return collect($scores)->map(function ($score, $userId) use ($users) {
                return [
                    'user' => $users[$userId] ?? null,
                    'score' => $score,
                    'rank' => $this->getRank($userId),
                ];
            })->values()->toArray();
        });
    }

    public function getRank(int $userId): int
    {
        // Позиция в рейтинге (0-based → 1-based)
        $rank = Redis::zrevrank(self::LEADERBOARD_KEY, $userId);

        return $rank !== null ? $rank + 1 : 0;
    }

    public function getUserRankWithNeighbors(int $userId, int $range = 2): array
    {
        $rank = $this->getRank($userId);

        if ($rank === 0) {
            return [];
        }

        $start = max(0, $rank - $range - 1);
        $end = $rank + $range - 1;

        $userIds = Redis::zrevrange(
            self::LEADERBOARD_KEY,
            $start,
            $end,
            'WITHSCORES'
        );

        // Аналогично getTop
        // ...
    }
}

// Использование
$leaderboard = new LeaderboardService();

// Добавить очки
$leaderboard->addScore(1, 100);
$leaderboard->incrementScore(1, 50); // Теперь 150

// Получить топ
$top10 = $leaderboard->getTop(10);

// Получить позицию игрока
$rank = $leaderboard->getRank(1); // 5
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
