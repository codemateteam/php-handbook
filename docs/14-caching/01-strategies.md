# 14.1 Стратегии кэширования

## Краткое резюме

> **Caching** — хранение данных в быстром хранилище (in-memory) для уменьшения latency и нагрузки на БД.
>
> Стратегии: **Cache-Aside** (lazy loading, `Cache::remember`), **Read/Write-Through** (cache управляет БД), **Write-Behind** (async запись в БД), **Refresh-Ahead** (обновление до expiration).
>
> Invalidation: **TTL** (auto-expire), **Manual** (forget при изменении), **Cache Tags** (группировка), **Event-based**. Проблемы: **Thundering Herd** (Lock или probabilistic expiration), stale data, cache pollution.

---

## Содержание

- [Что это](#что-это)
- [Типы кэширования](#типы-кэширования)
- [Стратегии кэширования](#стратегии-кэширования)
- [Cache Invalidation](#cache-invalidation)
- [Thundering Herd Problem](#thundering-herd-problem)
- [Cache Warming](#cache-warming)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Caching:**
Хранение часто используемых данных в быстром хранилище для уменьшения latency и нагрузки на БД.

**Trade-off:**
- ✅ Быстрее (in-memory vs disk)
- ✅ Меньше нагрузка на БД
- ❌ Stale data (могут быть устаревшие данные)
- ❌ Memory usage
- ❌ Cache invalidation сложность

---

## Типы кэширования

### 1. Application-Level Cache

**Laravel Cache:**

```php
// Кэшировать на 1 час
$users = Cache::remember('users', 3600, function () {
    return User::all();
});
```

---

### 2. Database Query Cache

**MySQL Query Cache (deprecated в MySQL 8.0):**

```sql
SELECT SQL_CACHE * FROM users;
```

**Laravel: кэш результатов:**

```php
$users = Cache::remember('users_list', 3600, function () {
    return DB::table('users')->get();
});
```

---

### 3. HTTP Cache (Browser, CDN, Proxy)

```php
// Laravel Response Cache
return response($content)
    ->header('Cache-Control', 'public, max-age=3600');
```

---

### 4. OPcache (PHP bytecode cache)

```ini
; php.ini
opcache.enable=1
opcache.memory_consumption=128
```

---

## Стратегии кэширования

### 1. Cache-Aside (Lazy Loading)

**Алгоритм:**

```
1. Проверить cache
2. Если HIT → вернуть
3. Если MISS → запросить БД
4. Положить в cache
5. Вернуть данные
```

**Laravel:**

```php
$user = Cache::remember("user:{$id}", 3600, function () use ($id) {
    return User::find($id);
});
```

**Плюсы:**
- ✅ Простая реализация
- ✅ Кэш заполняется по мере необходимости

**Минусы:**
- ❌ Первый запрос медленный (cache miss)
- ❌ Thundering herd problem

---

### 2. Read-Through Cache

**Алгоритм:**

```
1. Приложение запрашивает cache
2. Cache сам запрашивает БД если miss
3. Cache возвращает данные
```

**Реализация:**

```php
class UserRepository
{
    public function find(int $id): ?User
    {
        $cacheKey = "user:{$id}";

        // Read-through: cache управляет загрузкой
        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $user = User::find($id);

        if ($user) {
            Cache::put($cacheKey, $user, 3600);
        }

        return $user;
    }
}
```

**Плюсы:**
- ✅ Абстракция (приложение не знает о cache miss)

**Минусы:**
- ❌ Первый запрос медленный

---

### 3. Write-Through Cache

**Алгоритм:**

```
1. Приложение пишет в cache
2. Cache синхронно пишет в БД
3. Возвращает success
```

**Реализация:**

```php
class UserRepository
{
    public function save(User $user): void
    {
        // Write-through: пишем в cache и БД одновременно
        $user->save();  // БД

        Cache::put("user:{$user->id}", $user, 3600);  // Cache
    }
}
```

**Плюсы:**
- ✅ Cache всегда свежий
- ✅ Consistency

**Минусы:**
- ❌ Медленнее (2 операции)
- ❌ Cache pollution (кэшируется всё, даже редко используемое)

---

### 4. Write-Behind (Write-Back) Cache

**Алгоритм:**

```
1. Приложение пишет в cache
2. Cache возвращает success (быстро)
3. Cache асинхронно пишет в БД (позже)
```

**Реализация:**

```php
class UserRepository
{
    public function save(User $user): void
    {
        // Write-behind: пишем в cache сразу
        Cache::put("user:{$user->id}", $user, 3600);

        // БД асинхронно (job)
        SaveUserToDatabaseJob::dispatch($user);
    }
}
```

**Плюсы:**
- ✅ Очень быстро (write в memory)
- ✅ Меньше нагрузка на БД (batch writes)

**Минусы:**
- ❌ Риск data loss (если cache упал до записи в БД)
- ❌ Eventual consistency

---

### 5. Refresh-Ahead

**Алгоритм:**

```
1. Cache автоматически обновляет данные ДО истечения TTL
2. Нет cache miss
```

**Реализация:**

```php
class RefreshAheadCache
{
    public function get(string $key, int $ttl, callable $callback)
    {
        $value = Cache::get($key);
        $expiresAt = Cache::get("{$key}:expires_at");

        // Обновить заранее (80% от TTL)
        if ($expiresAt && now()->timestamp > ($expiresAt - $ttl * 0.2)) {
            // Асинхронно обновить
            RefreshCacheJob::dispatch($key, $callback);
        }

        // Если cache miss
        if ($value === null) {
            $value = $callback();
            Cache::put($key, $value, $ttl);
            Cache::put("{$key}:expires_at", now()->timestamp + $ttl, $ttl);
        }

        return $value;
    }
}
```

**Плюсы:**
- ✅ Нет cache miss (всегда fresh)
- ✅ Low latency

**Минусы:**
- ❌ Может обновлять неиспользуемые данные

---

## Cache Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things" — Phil Karlton

### 1. TTL (Time To Live)

**Простой подход:**

```php
Cache::put('users', $users, 3600);  // 1 hour

// Автоматически удалится через 1 час
```

**Плюсы:**
- ✅ Просто
- ✅ Нет stale data надолго

**Минусы:**
- ❌ Может быть stale до истечения TTL

---

### 2. Manual Invalidation

**При изменении данных:**

```php
class User extends Model
{
    protected static function booted()
    {
        static::updated(function ($user) {
            // Invalidate cache
            Cache::forget("user:{$user->id}");
            Cache::forget('users_list');
        });

        static::deleted(function ($user) {
            Cache::forget("user:{$user->id}");
            Cache::forget('users_list');
        });
    }
}
```

**Плюсы:**
- ✅ Всегда свежие данные

**Минусы:**
- ❌ Нужно помнить invalidate во всех местах

---

### 3. Cache Tags (Laravel)

**Группировка cache keys:**

```php
// Кэшировать с тэгами
Cache::tags(['users', 'admins'])->put('admin_users', $users, 3600);

// Invalidate всё с тэгом 'users'
Cache::tags(['users'])->flush();
```

**Use case:**

```php
class UserService
{
    public function getAllUsers()
    {
        return Cache::tags(['users'])->remember('users_list', 3600, function () {
            return User::all();
        });
    }

    public function getAdminUsers()
    {
        return Cache::tags(['users', 'admins'])->remember('admin_users', 3600, function () {
            return User::where('is_admin', true)->get();
        });
    }

    public function updateUser(User $user)
    {
        $user->save();

        // Invalidate все кэши связанные с users
        Cache::tags(['users'])->flush();
    }
}
```

---

### 4. Event-Based Invalidation

```php
// Event
class UserUpdated
{
    public function __construct(public User $user) {}
}

// Listener
class InvalidateUserCache
{
    public function handle(UserUpdated $event)
    {
        Cache::forget("user:{$event->user->id}");
        Cache::tags(['users'])->flush();
    }
}

// Model
class User extends Model
{
    protected $dispatchesEvents = [
        'updated' => UserUpdated::class,
    ];
}
```

---

## Thundering Herd Problem

**Проблема:**

```
Cache expires
    ↓
1000 requests одновременно
    ↓
1000 queries к БД (перегрузка!)
```

**Решение 1: Lock (Laravel)**

```php
$users = Cache::lock('users_list')->get(function () {
    // Только 1 процесс выполняет
    return Cache::remember('users_list', 3600, function () {
        return User::all();
    });
});
```

**Решение 2: Probabilistic Early Expiration**

```php
function cacheWithProbabilisticExpiration($key, $ttl, $callback)
{
    $value = Cache::get($key);
    $expiresAt = Cache::get("{$key}:expires");

    if ($value && $expiresAt) {
        $now = time();
        $timeLeft = $expiresAt - $now;

        // Вероятность обновления растёт при приближении к expiration
        $probability = 1 - ($timeLeft / $ttl);

        if (rand(0, 100) / 100 < $probability) {
            // Обновить заранее
            $value = $callback();
            Cache::put($key, $value, $ttl);
            Cache::put("{$key}:expires", $now + $ttl, $ttl);
        }
    } else {
        $value = $callback();
        Cache::put($key, $value, $ttl);
        Cache::put("{$key}:expires", time() + $ttl, $ttl);
    }

    return $value;
}
```

---

## Cache Warming

**Предварительное заполнение cache:**

```php
class WarmCacheCommand extends Command
{
    public function handle()
    {
        // Warm популярные данные
        Cache::put('popular_products', Product::popular()->get(), 3600);
        Cache::put('categories', Category::all(), 3600);
        Cache::put('featured_posts', Post::featured()->get(), 3600);

        $this->info('Cache warmed successfully');
    }
}

// Scheduler: warm cache каждый час
$schedule->command('cache:warm')->hourly();
```

---

## Cache Levels (многоуровневый кэш)

```php
class MultiLevelCache
{
    public function get(string $key)
    {
        // L1: In-memory (APCu)
        if (apcu_exists($key)) {
            return apcu_fetch($key);
        }

        // L2: Redis
        if (Cache::has($key)) {
            $value = Cache::get($key);
            apcu_store($key, $value, 60);  // L1 cache
            return $value;
        }

        // L3: Database
        $value = DB::table('data')->find($key);
        Cache::put($key, $value, 3600);  // L2
        apcu_store($key, $value, 60);     // L1

        return $value;
    }
}
```

---

## Best Practices

```
✓ Cache что дорого вычислять (DB queries, API calls)
✓ TTL разумный (не слишком долго, не слишком коротко)
✓ Cache Tags для группировки
✓ Event-based invalidation
✓ Lock для thundering herd
✓ Monitoring: cache hit rate, memory usage
✓ Cache Warming для популярных данных
✓ Версионирование cache keys при изменении структуры
✓ НЕ кэшировать персональные данные (security)
```

---

## На собеседовании скажешь

> "Кэширование — хранение данных в быстром хранилище. Стратегии: Cache-Aside (lazy loading, Laravel remember), Read/Write-Through (cache управляет БД), Write-Behind (async write в БД), Refresh-Ahead (обновление до expiration). Invalidation: TTL, manual (observers), Cache Tags (группировка), event-based. Thundering Herd: Lock или probabilistic early expiration. Cache Warming: pre-populate популярные данные. Multi-level: L1 (APCu), L2 (Redis), L3 (DB). Best practices: cache дорогие операции, Tags, monitoring hit rate, не кэшировать персональные данные."

---

## Практические задания

### Задание 1: Реализовать Cache-Aside с защитой от Thundering Herd

Создай метод `getCachedUsers()` который использует Cache-Aside стратегию и защиту от Thundering Herd через Lock.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

class UserCacheService
{
    public function getCachedUsers(): Collection
    {
        $cacheKey = 'users_list';
        $lockKey = 'users_list_lock';

        // Попытаться получить из cache
        if ($users = Cache::get($cacheKey)) {
            return $users;
        }

        // Защита от Thundering Herd через Lock
        return Cache::lock($lockKey, 10)->block(5, function () use ($cacheKey) {
            // Double-check: может другой процесс уже положил в cache
            if ($users = Cache::get($cacheKey)) {
                return $users;
            }

            // Загрузить из БД
            $users = User::active()->get();

            // Положить в cache на 1 час
            Cache::put($cacheKey, $users, 3600);

            return $users;
        });
    }

    // Invalidation при изменении
    public function invalidateCache(): void
    {
        Cache::forget('users_list');
    }
}

// В модели User
class User extends Model
{
    protected static function booted()
    {
        static::saved(function () {
            app(UserCacheService::class)->invalidateCache();
        });

        static::deleted(function () {
            app(UserCacheService::class)->invalidateCache();
        });
    }
}

// Использование
$users = app(UserCacheService::class)->getCachedUsers();
```
</details>

### Задание 2: Write-Through Cache с Event-Based Invalidation

Реализуй UserRepository с Write-Through стратегией и event-based invalidation через Cache Tags.

<details>
<summary>Решение</summary>

```php
namespace App\Repositories;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

class UserRepository
{
    private const CACHE_TTL = 3600; // 1 hour
    private const TAG = 'users';

    public function find(int $id): ?User
    {
        // Read-Through: cache управляет загрузкой
        return Cache::tags([self::TAG])->remember(
            "user:{$id}",
            self::CACHE_TTL,
            fn() => User::find($id)
        );
    }

    public function all(): Collection
    {
        return Cache::tags([self::TAG])->remember(
            'users:all',
            self::CACHE_TTL,
            fn() => User::all()
        );
    }

    public function getAdmins(): Collection
    {
        return Cache::tags([self::TAG, 'admins'])->remember(
            'users:admins',
            self::CACHE_TTL,
            fn() => User::where('is_admin', true)->get()
        );
    }

    // Write-Through: пишем в БД и cache одновременно
    public function save(User $user): User
    {
        $user->save();

        // Обновить cache
        Cache::tags([self::TAG])->put(
            "user:{$user->id}",
            $user,
            self::CACHE_TTL
        );

        // Invalidate списки
        Cache::tags([self::TAG])->forget('users:all');

        if ($user->is_admin) {
            Cache::tags(['admins'])->flush();
        }

        return $user;
    }

    public function delete(User $user): bool
    {
        $id = $user->id;
        $result = $user->delete();

        // Invalidate cache
        Cache::tags([self::TAG])->forget("user:{$id}");
        Cache::tags([self::TAG])->flush(); // Очистить все связанные

        return $result;
    }

    // Flush всё связанное с пользователями
    public function flushCache(): void
    {
        Cache::tags([self::TAG])->flush();
    }
}

// Использование в контроллере
public function index(UserRepository $repository)
{
    return $repository->all();
}

public function store(Request $request, UserRepository $repository)
{
    $user = new User($request->validated());
    return $repository->save($user);
}
```
</details>

### Задание 3: Probabilistic Early Expiration для предотвращения Cache Miss

Реализуй метод который использует probabilistic early expiration для обновления cache до истечения TTL.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\Cache;

class ProbabilisticCache
{
    /**
     * Получить из cache с probabilistic early expiration
     *
     * @param string $key Ключ cache
     * @param int $ttl TTL в секундах
     * @param callable $callback Функция загрузки данных
     * @param float $beta Коэффициент (обычно 1.0)
     * @return mixed
     */
    public function remember(string $key, int $ttl, callable $callback, float $beta = 1.0)
    {
        $value = Cache::get($key);
        $expiresAt = Cache::get("{$key}:expires");

        if ($value !== null && $expiresAt !== null) {
            $now = time();
            $timeLeft = $expiresAt - $now;

            // Probabilistic early expiration formula
            // probability = β * log(rand(0,1)) * δ
            // δ (delta) = time to recompute
            $delta = 1; // Предполагаем 1 секунду на recompute

            $probability = -$beta * log(mt_rand() / mt_getrandmax()) * $delta;

            // Обновить заранее если probability > time left
            if ($probability >= $timeLeft) {
                // Асинхронно обновить cache
                dispatch(function () use ($key, $ttl, $callback) {
                    $newValue = $callback();
                    Cache::put($key, $newValue, $ttl);
                    Cache::put("{$key}:expires", time() + $ttl, $ttl);
                })->afterResponse();
            }

            return $value;
        }

        // Cache miss: загрузить и сохранить
        $value = $callback();
        Cache::put($key, $value, $ttl);
        Cache::put("{$key}:expires", time() + $ttl, $ttl);

        return $value;
    }
}

// Использование
$cache = new ProbabilisticCache();

$popularPosts = $cache->remember('popular_posts', 3600, function () {
    return Post::popular()->limit(10)->get();
}, beta: 1.0);

// Альтернатива: Refresh-Ahead
class RefreshAheadCache
{
    public function remember(string $key, int $ttl, callable $callback)
    {
        $value = Cache::get($key);
        $expiresAt = Cache::get("{$key}:expires_at");

        // Обновить заранее (при 80% от TTL)
        if ($expiresAt && now()->timestamp > ($expiresAt - $ttl * 0.2)) {
            // Асинхронно обновить
            dispatch(function () use ($key, $ttl, $callback) {
                $newValue = $callback();
                Cache::put($key, $newValue, $ttl);
                Cache::put("{$key}:expires_at", now()->timestamp + $ttl, $ttl);
            })->afterResponse();
        }

        // Cache miss
        if ($value === null) {
            $value = $callback();
            Cache::put($key, $value, $ttl);
            Cache::put("{$key}:expires_at", now()->timestamp + $ttl, $ttl);
        }

        return $value;
    }
}

// Использование Refresh-Ahead
$cache = new RefreshAheadCache();
$stats = $cache->remember('dashboard_stats', 300, function () {
    return [
        'users' => User::count(),
        'orders' => Order::count(),
        'revenue' => Order::sum('total'),
    ];
});
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
