# 6.9 Кеширование

## Краткое резюме

> **Кеширование** — сохранение часто используемых данных для быстрого доступа. Уменьшает нагрузку на БД и ускоряет приложение.
>
> **Драйверы:** file, database, redis (рекомендуется), memcached, array.
>
> **Важно:** Cache::remember() — если нет в кеше, выполнить callback и сохранить. Tags для группировки. Инвалидация через observers.

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
Кеширование — сохранение часто используемых данных для быстрого доступа. Уменьшает нагрузку на БД и ускоряет приложение.

**Драйверы кеша в Laravel:**
- file — файлы (по умолчанию)
- database — таблица БД
- redis — Redis (рекомендуется)
- memcached — Memcached
- array — в памяти (для тестов)

---

## Как работает

**Базовые операции:**

```php
use Illuminate\Support\Facades\Cache;

// Сохранить навсегда
Cache::put('key', 'value');

// Сохранить с TTL (секунды)
Cache::put('key', 'value', 3600);  // 1 час

// Или через now()
Cache::put('key', 'value', now()->addMinutes(60));

// Получить
$value = Cache::get('key');

// С дефолтом
$value = Cache::get('key', 'default');

// С Closure
$value = Cache::get('key', function () {
    return 'default value';
});

// Проверить существование
if (Cache::has('key')) {
    // Ключ существует
}

// Удалить
Cache::forget('key');

// Очистить весь кеш
Cache::flush();
```

**Remember (кеширование с callback):**

```php
// Если есть в кеше — вернёт, если нет — выполнит callback и сохранит
$users = Cache::remember('users.all', 3600, function () {
    return User::all();
});

// Remember forever
$settings = Cache::rememberForever('settings', function () {
    return Setting::pluck('value', 'key');
});

// Pull (получить и удалить)
$value = Cache::pull('key');
```

**Increment / Decrement:**

```php
// Инкремент
Cache::increment('page:views');  // +1
Cache::increment('page:views', 5);  // +5

// Декремент
Cache::decrement('page:views');  // -1
Cache::decrement('page:views', 3);  // -3
```

**Tags (группировка кеша):**

```php
// Сохранить с тегами (только Redis/Memcached)
Cache::tags(['people', 'artists'])->put('John', 'Artist', 600);
Cache::tags(['people', 'authors'])->put('Jane', 'Author', 600);

// Получить
$value = Cache::tags(['people', 'artists'])->get('John');

// Удалить все с тегом
Cache::tags(['people'])->flush();  // Удалит John и Jane
Cache::tags(['artists'])->flush();  // Удалит только John
```

---

## Когда использовать

**Кешируй когда:**
- Данные читаются часто, меняются редко
- Дорогие вычисления (сложные запросы, API)
- Статичные данные (настройки, конфиг)

**Не кешируй когда:**
- Данные часто меняются
- Персональные данные (могут устареть)
- Критичная актуальность

---

## Пример из практики

**Кеширование запросов:**

```php
// Список постов
$posts = Cache::remember('posts.published', 3600, function () {
    return Post::where('published', true)
        ->with('user', 'category')
        ->latest()
        ->get();
});

// Инвалидация при изменении
class Post extends Model
{
    protected static function booted(): void
    {
        static::saved(function () {
            Cache::forget('posts.published');
        });

        static::deleted(function () {
            Cache::forget('posts.published');
        });
    }
}
```

**Кеширование с тегами:**

```php
// Кеш с тегами
$post = Cache::tags(['posts', 'post:' . $id])->remember("post:{$id}", 3600, function () use ($id) {
    return Post::with('user', 'comments')->find($id);
});

// Инвалидация всех постов
Cache::tags(['posts'])->flush();

// Инвалидация конкретного поста
Cache::tags(['post:' . $id])->flush();

// Observer для автоматической инвалидации
class PostObserver
{
    public function saved(Post $post): void
    {
        Cache::tags(['posts', 'post:' . $post->id])->flush();
    }

    public function deleted(Post $post): void
    {
        Cache::tags(['posts', 'post:' . $post->id])->flush();
    }
}
```

**View caching:**

```php
// Кешировать view
public function show(Post $post)
{
    $html = Cache::remember("views.post.{$post->id}", 3600, function () use ($post) {
        return view('posts.show', compact('post'))->render();
    });

    return $html;
}

// Или через Response cache middleware
Route::get('/posts/{post}', [PostController::class, 'show'])
    ->middleware('cache.response:3600');
```

**Model attribute caching:**

```php
class User extends Model
{
    // Кешировать computed attribute
    public function getFullNameAttribute(): string
    {
        return Cache::remember("user:{$this->id}:full_name", 3600, function () {
            return "{$this->first_name} {$this->last_name}";
        });
    }

    // Кешировать relationship count
    public function getPostsCountAttribute(): int
    {
        return Cache::remember("user:{$this->id}:posts_count", 3600, function () {
            return $this->posts()->count();
        });
    }
}
```

**Cache warming (прогрев кеша):**

```php
// Команда для прогрева кеша
class WarmCache extends Command
{
    public function handle(): void
    {
        // Прогреть популярные данные
        Cache::remember('settings', 3600, fn() => Setting::all());
        Cache::remember('users.top', 3600, fn() => User::withCount('posts')->orderBy('posts_count', 'desc')->limit(100)->get());
        Cache::remember('posts.popular', 3600, fn() => Post::orderBy('views', 'desc')->limit(50)->get());

        $this->info('Cache warmed successfully');
    }
}

// Запускать после deploy
php artisan cache:warm
```

**Cache aside pattern (read-through):**

```php
class UserRepository
{
    public function find(int $id): ?User
    {
        return Cache::remember("user:{$id}", 3600, function () use ($id) {
            return User::find($id);
        });
    }

    public function update(User $user): void
    {
        $user->save();

        // Инвалидировать кеш
        Cache::forget("user:{$user->id}");
    }
}
```

**Write-through cache:**

```php
class UserRepository
{
    public function update(User $user): void
    {
        // 1. Обновить БД
        $user->save();

        // 2. Обновить кеш
        Cache::put("user:{$user->id}", $user, 3600);
    }
}
```

**Cache lock (предотвратить cache stampede):**

```php
$post = Cache::remember("post:{$id}", 3600, function () use ($id) {
    // Если кеш истёк и много запросов одновременно,
    // все будут запрашивать БД (cache stampede)

    return Post::find($id);
});

// Решение: Lock
$post = Cache::flexible("post:{$id}", [3600, 600], function () use ($id) {
    // 3600 — TTL, 600 — grace period
    // При истечении первый запрос обновит кеш,
    // остальные получат старый кеш на grace period
    return Post::find($id);
});
```

**Мониторинг кеша:**

```php
// Laravel Telescope автоматически логирует кеш операции

// Метрики
class CacheMetrics
{
    public static function trackHit(string $key): void
    {
        Redis::incr("cache:hits:{$key}");
    }

    public static function trackMiss(string $key): void
    {
        Redis::incr("cache:misses:{$key}");
    }

    public static function getHitRate(string $key): float
    {
        $hits = Redis::get("cache:hits:{$key}") ?: 0;
        $misses = Redis::get("cache:misses:{$key}") ?: 0;
        $total = $hits + $misses;

        return $total > 0 ? ($hits / $total) * 100 : 0;
    }
}
```

**Cache strategies:**

```php
// 1. Cache aside (lazy loading)
$user = Cache::get("user:{$id}");
if (!$user) {
    $user = User::find($id);
    Cache::put("user:{$id}", $user, 3600);
}

// 2. Read-through (через helper)
$user = Cache::remember("user:{$id}", 3600, fn() => User::find($id));

// 3. Write-through (обновление кеша при записи)
$user->save();
Cache::put("user:{$user->id}", $user, 3600);

// 4. Write-behind (отложенная запись в БД)
Cache::put("user:{$id}", $user, 3600);
dispatch(new SyncUserToDatabase($user));
```

---

## На собеседовании скажешь

> "Кеширование ускоряет приложение и снижает нагрузку на БД. Драйверы: file, database, redis (лучший). Cache::remember() — если нет в кеше, выполнить callback и сохранить. Tags для группировки (Cache::tags(['posts'])->flush()). Инвалидация через observers (saved, deleted). Cache aside pattern — проверить кеш → загрузить из БД → сохранить. Write-through — обновить БД и кеш. Cache stampede решается через flexible() или lock. Hit rate для мониторинга эффективности. Прогрев кеша после deploy."

---

## Практические задания

### Задание 1: Реализуй кеширование с автоинвалидацией

Кешируй список постов блога. При создании/обновлении/удалении поста автоматически очищай кеш.

<details>
<summary>Решение</summary>

```php
// Repository с кешированием
class PostRepository
{
    protected int $cacheTtl = 3600; // 1 час

    public function getPublished(): Collection
    {
        return Cache::tags(['posts'])->remember('posts.published', $this->cacheTtl, function () {
            return Post::where('published', true)
                ->with('user', 'category')
                ->latest()
                ->get();
        });
    }

    public function find(int $id): ?Post
    {
        return Cache::tags(['posts', "post:{$id}"])->remember("post:{$id}", $this->cacheTtl, function () use ($id) {
            return Post::with('user', 'category', 'tags')->find($id);
        });
    }

    public function invalidatePost(Post $post): void
    {
        Cache::tags(['posts', "post:{$post->id}"])->flush();
    }

    public function invalidateAll(): void
    {
        Cache::tags(['posts'])->flush();
    }
}

// Observer для автоматической инвалидации
class PostObserver
{
    public function __construct(protected PostRepository $repository)
    {
    }

    public function created(Post $post): void
    {
        $this->repository->invalidateAll();
    }

    public function updated(Post $post): void
    {
        $this->repository->invalidatePost($post);
    }

    public function deleted(Post $post): void
    {
        $this->repository->invalidatePost($post);
    }

    public function restored(Post $post): void
    {
        $this->repository->invalidateAll();
    }
}

// Регистрация Observer
class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Post::observe(PostObserver::class);
    }
}

// Альтернатива: Model Events
class Post extends Model
{
    protected static function booted(): void
    {
        static::saved(function (Post $post) {
            Cache::tags(['posts', "post:{$post->id}"])->flush();
        });

        static::deleted(function (Post $post) {
            Cache::tags(['posts', "post:{$post->id}"])->flush();
        });
    }
}

// Использование в контроллере
class PostController extends Controller
{
    public function __construct(protected PostRepository $repository)
    {
    }

    public function index()
    {
        $posts = $this->repository->getPublished();
        return view('posts.index', compact('posts'));
    }

    public function show(int $id)
    {
        $post = $this->repository->find($id);
        return view('posts.show', compact('post'));
    }
}
```
</details>

### Задание 2: Предотврати Cache Stampede

1000 запросов одновременно обращаются к кешу, который только что истёк. Все 1000 запросов идут в БД. Как предотвратить?

<details>
<summary>Решение</summary>

```php
// ❌ Проблема: Cache Stampede (Dog-Piling)
// Кеш истёк → все запросы одновременно идут в БД

$posts = Cache::remember('posts', 3600, function () {
    // Если 1000 запросов пришли одновременно после истечения кеша,
    // все выполнят этот тяжёлый запрос
    return Post::with('user', 'category')->get();
});

// ✅ Решение 1: Lock (только первый обновит кеш)
public function getPosts(): Collection
{
    $posts = Cache::get('posts');

    if ($posts !== null) {
        return $posts;
    }

    // Попытаться получить блокировку
    $lock = Cache::lock('posts:refresh', 10);

    if ($lock->get()) {
        try {
            // Только первый запрос выполнит запрос к БД
            $posts = Post::with('user', 'category')->get();
            Cache::put('posts', $posts, 3600);
            return $posts;
        } finally {
            $lock->release();
        }
    } else {
        // Другие запросы ждут и пытаются получить из кеша
        sleep(1);
        return Cache::get('posts') ?? collect();
    }
}

// ✅ Решение 2: flexible() (grace period)
$posts = Cache::flexible('posts', [3600, 600], function () {
    // 3600 - основной TTL
    // 600 - grace period (10 минут)

    // После истечения основного TTL:
    // - Первый запрос обновит кеш
    // - Остальные получат старый кеш из grace period
    return Post::with('user', 'category')->get();
});

// ✅ Решение 3: Вероятностное обновление (probabilistic early expiration)
class CacheService
{
    public function remember(string $key, int $ttl, Closure $callback, float $beta = 1.0)
    {
        $cached = Cache::get($key);

        if ($cached !== null) {
            $expiresAt = Cache::get("{$key}:expires_at");

            if ($expiresAt) {
                $now = time();
                $timeToExpire = $expiresAt - $now;

                // Вероятность обновления растёт по мере приближения к истечению
                $probability = $beta * log(mt_rand() / mt_getrandmax());

                if ($timeToExpire < $probability) {
                    // Обновить досрочно
                    return $this->refreshCache($key, $ttl, $callback);
                }
            }

            return $cached;
        }

        return $this->refreshCache($key, $ttl, $callback);
    }

    protected function refreshCache(string $key, int $ttl, Closure $callback)
    {
        $lock = Cache::lock("{$key}:lock", 5);

        if ($lock->get()) {
            try {
                $value = $callback();
                Cache::put($key, $value, $ttl);
                Cache::put("{$key}:expires_at", time() + $ttl, $ttl);
                return $value;
            } finally {
                $lock->release();
            }
        }

        // Если не получили lock, вернуть старый кеш
        return Cache::get($key);
    }
}

// ✅ Решение 4: Фоновое обновление (scheduled task)
class WarmCacheCommand extends Command
{
    public function handle(): void
    {
        // Обновлять кеш каждый час, не дожидаясь истечения
        $posts = Post::with('user', 'category')->get();
        Cache::put('posts', $posts, 3600);

        $this->info('Cache warmed successfully');
    }
}

// В Kernel.php
protected function schedule(Schedule $schedule): void
{
    // Обновлять за 5 минут до истечения
    $schedule->command('cache:warm')->everyFiftyFiveMinutes();
}

// ✅ Решение 5: Stale-While-Revalidate
class StaleWhileRevalidate
{
    public function get(string $key, int $ttl, int $staleTime, Closure $callback)
    {
        $value = Cache::get($key);
        $expiresAt = Cache::get("{$key}:expires_at");

        $now = time();

        // Если кеш свежий, вернуть
        if ($value && $expiresAt && $expiresAt > $now) {
            return $value;
        }

        // Если кеш устаревший, но в stale периоде
        $staleExpiresAt = Cache::get("{$key}:stale_expires_at");

        if ($value && $staleExpiresAt && $staleExpiresAt > $now) {
            // Вернуть устаревший кеш
            // Асинхронно обновить в фоне
            dispatch(function () use ($key, $ttl, $staleTime, $callback) {
                $this->refresh($key, $ttl, $staleTime, $callback);
            })->afterResponse();

            return $value;
        }

        // Кеш полностью истёк, обновить синхронно
        return $this->refresh($key, $ttl, $staleTime, $callback);
    }

    protected function refresh(string $key, int $ttl, int $staleTime, Closure $callback)
    {
        $value = $callback();
        $now = time();

        Cache::put($key, $value, $ttl + $staleTime);
        Cache::put("{$key}:expires_at", $now + $ttl, $ttl + $staleTime);
        Cache::put("{$key}:stale_expires_at", $now + $ttl + $staleTime, $ttl + $staleTime);

        return $value;
    }
}
```
</details>

### Задание 3: Многоуровневое кеширование

Реализуй двухуровневый кеш: L1 (array в памяти процесса) + L2 (Redis).

<details>
<summary>Решение</summary>

```php
// Двухуровневый кеш для одного request
class TwoLevelCache
{
    protected array $localCache = [];

    public function remember(string $key, int $ttl, Closure $callback)
    {
        // L1: Проверить local cache (array в памяти)
        if (isset($this->localCache[$key])) {
            return $this->localCache[$key];
        }

        // L2: Проверить Redis
        $value = Cache::remember($key, $ttl, $callback);

        // Сохранить в L1
        $this->localCache[$key] = $value;

        return $value;
    }

    public function forget(string $key): void
    {
        unset($this->localCache[$key]);
        Cache::forget($key);
    }

    public function flush(): void
    {
        $this->localCache = [];
        Cache::flush();
    }
}

// Использование
class PostRepository
{
    public function __construct(protected TwoLevelCache $cache)
    {
    }

    public function find(int $id): ?Post
    {
        return $this->cache->remember("post:{$id}", 3600, function () use ($id) {
            return Post::find($id);
        });
    }
}

// Регистрация в Service Container
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TwoLevelCache::class);
    }
}

// Более продвинутая версия с TTL для L1
class AdvancedTwoLevelCache
{
    protected array $localCache = [];
    protected array $expiresAt = [];
    protected int $localTtl = 60; // L1 cache 60 секунд

    public function remember(string $key, int $ttl, Closure $callback)
    {
        // L1: Проверить local cache
        if ($this->hasValidLocalCache($key)) {
            return $this->localCache[$key];
        }

        // L2: Redis cache
        $value = Cache::remember($key, $ttl, $callback);

        // Сохранить в L1
        $this->storeInLocalCache($key, $value);

        return $value;
    }

    protected function hasValidLocalCache(string $key): bool
    {
        return isset($this->localCache[$key])
            && isset($this->expiresAt[$key])
            && $this->expiresAt[$key] > time();
    }

    protected function storeInLocalCache(string $key, $value): void
    {
        $this->localCache[$key] = $value;
        $this->expiresAt[$key] = time() + $this->localTtl;
    }

    public function forget(string $key): void
    {
        unset($this->localCache[$key], $this->expiresAt[$key]);
        Cache::forget($key);
    }
}

// Middleware для очистки L1 кеша между requests (если используете octane)
class ClearLocalCacheMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Очистить L1 кеш после каждого запроса
        app(TwoLevelCache::class)->flush();

        return $response;
    }
}

// Пример использования в реальном приложении
class UserService
{
    public function __construct(protected TwoLevelCache $cache)
    {
    }

    public function getUser(int $id): ?User
    {
        // При 1000 вызовов в одном request:
        // - Первый: Redis запрос
        // - Остальные 999: из array (мгновенно)
        return $this->cache->remember("user:{$id}", 3600, function () use ($id) {
            return User::find($id);
        });
    }

    public function getManyUsers(array $ids): Collection
    {
        return collect($ids)->map(function ($id) {
            return $this->getUser($id); // L1 кеш предотвратит дубли
        })->filter();
    }
}

// Тест производительности
// Без L1: 1000 вызовов = 1000 Redis запросов (~100ms)
// С L1: 1000 вызовов = 1 Redis запрос + 999 array lookups (~5ms)
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
