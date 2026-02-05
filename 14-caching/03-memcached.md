# 14.3 Memcached

## Краткое резюме

> **Memcached** — распределённый in-memory cache для простого key-value хранения. Быстрее Redis, но без data structures, persistence, transactions.
>
> Multi-server setup с **consistent hashing** для horizontal scaling. Eviction: **LRU** (Least Recently Used) автоматически. Laravel: `Cache::store('memcached')->remember()`.
>
> **Redis vs Memcached:** Redis для data structures/persistence/pub-sub, Memcached для максимальной скорости простого cache. Обычно в Laravel используется Redis (больше функций).

---

## Содержание

- [Что это](#что-это)
- [Когда использовать Memcached](#когда-использовать-memcached)
- [Установка](#установка)
- [Базовое использование](#базовое-использование)
- [Multi-Server Setup](#multi-server-setup)
- [Stats & Monitoring](#stats--monitoring)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Memcached:**
Распределённый in-memory cache. Проще и быстрее Redis, но только key-value (без data structures).

**Redis vs Memcached:**

| Критерий | Redis | Memcached |
|----------|-------|-----------|
| Data structures | ✅ Да (lists, sets, hashes) | ❌ Только strings |
| Persistence | ✅ RDB, AOF | ❌ Нет |
| Replication | ✅ Да | ❌ Нет (только client-side) |
| Transactions | ✅ Да | ❌ Нет |
| Pub/Sub | ✅ Да | ❌ Нет |
| Скорость | Очень быстрый | Чуть быстрее |
| Memory efficiency | Хорошая | Отличная |
| Use case | Cache + больше | Только cache |

---

## Когда использовать Memcached

**Memcached для:**
- ✅ Простой key-value cache
- ✅ Максимальная скорость
- ✅ Horizontal scaling (multi-server)
- ✅ Меньше memory overhead

**Redis для:**
- ✅ Data structures (lists, sets, sorted sets)
- ✅ Persistence
- ✅ Pub/Sub
- ✅ Transactions
- ✅ Сложная логика

---

## Установка

**Docker:**

```bash
docker run -d --name memcached -p 11211:11211 memcached:alpine
```

**Laravel config:**

```php
// .env
CACHE_DRIVER=memcached
MEMCACHED_HOST=127.0.0.1

// config/cache.php
'memcached' => [
    'driver' => 'memcached',
    'servers' => [
        [
            'host' => env('MEMCACHED_HOST', '127.0.0.1'),
            'port' => env('MEMCACHED_PORT', 11211),
            'weight' => 100,
        ],
    ],
],
```

---

## Базовое использование

```php
// Put
Cache::store('memcached')->put('key', 'value', 3600);

// Get
$value = Cache::store('memcached')->get('key');

// Remember
$users = Cache::store('memcached')->remember('users', 3600, function () {
    return User::all();
});

// Forget
Cache::store('memcached')->forget('key');

// Flush
Cache::store('memcached')->flush();

// Increment/Decrement
Cache::store('memcached')->increment('counter');
Cache::store('memcached')->decrement('counter');
```

---

## Multi-Server Setup

**Consistent Hashing для распределения:**

```php
// config/cache.php
'memcached' => [
    'driver' => 'memcached',
    'persistent_id' => 'memcached_pool_id',
    'sasl' => [
        env('MEMCACHED_USERNAME'),
        env('MEMCACHED_PASSWORD'),
    ],
    'options' => [
        // Libmemcached options
    ],
    'servers' => [
        [
            'host' => '10.0.0.1',
            'port' => 11211,
            'weight' => 100,
        ],
        [
            'host' => '10.0.0.2',
            'port' => 11211,
            'weight' => 100,
        ],
        [
            'host' => '10.0.0.3',
            'port' => 11211,
            'weight' => 100,
        ],
    ],
],
```

**Consistent Hashing:**
- Ключи распределяются по серверам
- Добавление/удаление сервера минимально влияет на распределение

---

## Eviction Policy

**Memcached использует LRU (Least Recently Used):**

```
Memory full → удалить least recently used keys
```

**Laravel: нет контроля над eviction (automatic).**

---

## Cache Stampede Protection

**Проблема: cache miss → все requests к БД**

**Решение: Lock**

```php
$users = Cache::lock('users_list')->get(function () {
    return Cache::remember('users', 3600, function () {
        return User::all();
    });
});
```

---

## Distributed Caching Pattern

**Scenario: 3 web servers + 3 Memcached servers**

```
Web Server 1 ──┐
Web Server 2 ──┼──→ Memcached Cluster ──┬──→ Server 1
Web Server 3 ──┘                        ├──→ Server 2
                                        └──→ Server 3
```

**Consistent Hashing автоматически распределяет:**

```php
// На Web Server 1
Cache::put('user:1', $user, 3600);
// → Memcached Server 2 (consistent hash)

// На Web Server 2
Cache::get('user:1');
// → Memcached Server 2 (тот же сервер!)
```

---

## Stats & Monitoring

**Memcached stats:**

```bash
# Connect
telnet localhost 11211

# Stats
stats

# Items
stats items

# Slabs
stats slabs
```

**Laravel:**

```php
// Laravel нет built-in stats для Memcached
// Используй клиент напрямую

$memcached = Cache::store('memcached')->getMemcached();
$stats = $memcached->getStats();

foreach ($stats as $server => $stat) {
    echo "Server: {$server}\n";
    echo "Memory: {$stat['bytes']} / {$stat['limit_maxbytes']}\n";
    echo "Items: {$stat['curr_items']}\n";
    echo "Hits: {$stat['get_hits']}\n";
    echo "Misses: {$stat['get_misses']}\n";
}
```

---

## Cache Key Namespacing

**Проблема: разные приложения → conflicts**

```php
// App 1
Cache::put('user:1', $user1);

// App 2
Cache::put('user:1', $user2);  // Конфликт!
```

**Решение: Prefix**

```php
// config/cache.php
'memcached' => [
    'driver' => 'memcached',
    'prefix' => env('CACHE_PREFIX', 'myapp'),  // myapp:user:1
],
```

---

## Serialization

**Memcached автоматически serializes:**

```php
// Laravel использует serialize/unserialize
Cache::put('user', $user, 3600);  // serialize($user)
$user = Cache::get('user');       // unserialize(...)

// Можно изменить serializer
$memcached->setOption(Memcached::OPT_SERIALIZER, Memcached::SERIALIZER_JSON);
```

---

## Session Storage

```php
// config/session.php
'driver' => 'memcached',
'connection' => 'default',
```

**Преимущества:**
- ✅ Сессии доступны на всех web servers
- ✅ Быстро (in-memory)
- ✅ Auto-expiration

**Недостатки:**
- ❌ Session может быть evicted (при нехватке памяти)

---

## Best Practices

```
✓ Multi-server для high availability
✓ Consistent hashing для распределения
✓ Prefix для namespacing
✓ Monitoring: hit rate, memory usage
✓ TTL для всех keys
✓ Не хранить критичные данные (может быть evicted)
✓ Cache только read-heavy данные
✓ Для персистентности используй Redis
```

---

## Memcached vs Redis для Laravel

**Memcached если:**
- Нужен только простой key-value cache
- Максимальная скорость критична
- Multi-server setup

**Redis если:**
- Нужны data structures (lists, sets, hashes, sorted sets)
- Нужен Pub/Sub (Laravel Broadcasting)
- Нужна Persistence
- Нужны Queues
- Нужны Transactions

**Обычно в Laravel проектах используется Redis** (больше функций, примерно такая же скорость).

---

## Migration: Memcached → Redis

```php
// Было (Memcached)
Cache::store('memcached')->put('key', 'value', 3600);

// Стало (Redis)
Cache::store('redis')->put('key', 'value', 3600);

// Или изменить driver
CACHE_DRIVER=redis  # .env
```

**Разница минимальная для простого cache.**

---

## На собеседовании скажешь

> "Memcached — распределённый in-memory cache, проще и немного быстрее Redis. Только key-value (нет data structures, persistence, pub/sub). Multi-server с consistent hashing для horizontal scaling. Eviction: LRU автоматически. Use case: простой cache, максимальная скорость, distributed setup. Redis обычно предпочтительнее для Laravel (data structures, pub/sub, queues, persistence). Memcached хорош когда нужен только key-value cache с multi-server. Best practices: prefix для namespacing, monitoring hit rate, TTL, не хранить критичные данные."

---

## Практические задания

### Задание 1: Multi-Server Memcached Setup

Настрой Laravel приложение для работы с 3 Memcached серверами. Реализуй сервис для мониторинга статистики всех серверов.

<details>
<summary>Решение</summary>

```php
// config/cache.php
'memcached' => [
    'driver' => 'memcached',
    'persistent_id' => 'memcached_pool',
    'options' => [
        // Использовать consistent hashing
        Memcached::OPT_DISTRIBUTION => Memcached::DISTRIBUTION_CONSISTENT,
        Memcached::OPT_LIBKETAMA_COMPATIBLE => true,
    ],
    'servers' => [
        [
            'host' => env('MEMCACHED_HOST_1', '10.0.0.1'),
            'port' => env('MEMCACHED_PORT_1', 11211),
            'weight' => 100,
        ],
        [
            'host' => env('MEMCACHED_HOST_2', '10.0.0.2'),
            'port' => env('MEMCACHED_PORT_2', 11211),
            'weight' => 100,
        ],
        [
            'host' => env('MEMCACHED_HOST_3', '10.0.0.3'),
            'port' => env('MEMCACHED_PORT_3', 11211),
            'weight' => 100,
        ],
    ],
],

// Сервис для мониторинга
namespace App\Services;

use Illuminate\Support\Facades\Cache;

class MemcachedMonitoringService
{
    public function getStats(): array
    {
        $memcached = Cache::store('memcached')->getMemcached();
        $stats = $memcached->getStats();

        $result = [];

        foreach ($stats as $server => $stat) {
            if ($stat === false) {
                $result[$server] = ['status' => 'offline'];
                continue;
            }

            $result[$server] = [
                'status' => 'online',
                'uptime' => $stat['uptime'],
                'memory' => [
                    'bytes' => $stat['bytes'],
                    'limit_maxbytes' => $stat['limit_maxbytes'],
                    'usage_percent' => round(($stat['bytes'] / $stat['limit_maxbytes']) * 100, 2),
                ],
                'items' => [
                    'current' => $stat['curr_items'],
                    'total' => $stat['total_items'],
                ],
                'operations' => [
                    'get_hits' => $stat['get_hits'],
                    'get_misses' => $stat['get_misses'],
                    'hit_rate' => $this->calculateHitRate($stat),
                ],
                'connections' => [
                    'current' => $stat['curr_connections'],
                    'total' => $stat['total_connections'],
                ],
                'evictions' => $stat['evictions'],
            ];
        }

        return $result;
    }

    private function calculateHitRate(array $stat): float
    {
        $total = $stat['get_hits'] + $stat['get_misses'];

        if ($total === 0) {
            return 0;
        }

        return round(($stat['get_hits'] / $total) * 100, 2);
    }

    public function getAggregatedStats(): array
    {
        $stats = $this->getStats();

        $totalMemory = 0;
        $totalUsedMemory = 0;
        $totalItems = 0;
        $totalHits = 0;
        $totalMisses = 0;
        $totalEvictions = 0;
        $serversOnline = 0;

        foreach ($stats as $server => $stat) {
            if ($stat['status'] === 'offline') {
                continue;
            }

            $serversOnline++;
            $totalMemory += $stat['memory']['limit_maxbytes'];
            $totalUsedMemory += $stat['memory']['bytes'];
            $totalItems += $stat['items']['current'];
            $totalHits += $stat['operations']['get_hits'];
            $totalMisses += $stat['operations']['get_misses'];
            $totalEvictions += $stat['evictions'];
        }

        return [
            'servers_total' => count($stats),
            'servers_online' => $serversOnline,
            'memory_total_mb' => round($totalMemory / 1024 / 1024, 2),
            'memory_used_mb' => round($totalUsedMemory / 1024 / 1024, 2),
            'memory_usage_percent' => $totalMemory > 0
                ? round(($totalUsedMemory / $totalMemory) * 100, 2)
                : 0,
            'items_total' => $totalItems,
            'hit_rate' => ($totalHits + $totalMisses) > 0
                ? round(($totalHits / ($totalHits + $totalMisses)) * 100, 2)
                : 0,
            'evictions_total' => $totalEvictions,
        ];
    }
}

// Контроллер
class MemcachedStatsController extends Controller
{
    public function index(MemcachedMonitoringService $service)
    {
        return response()->json([
            'servers' => $service->getStats(),
            'aggregated' => $service->getAggregatedStats(),
        ]);
    }
}

// Command для мониторинга
class MonitorMemcachedCommand extends Command
{
    protected $signature = 'memcached:monitor';
    protected $description = 'Monitor Memcached servers';

    public function handle(MemcachedMonitoringService $service)
    {
        $stats = $service->getStats();

        $this->info('Memcached Servers Status:');
        $this->newLine();

        foreach ($stats as $server => $stat) {
            $this->line("Server: {$server}");

            if ($stat['status'] === 'offline') {
                $this->error('  Status: OFFLINE');
                $this->newLine();
                continue;
            }

            $this->info('  Status: ONLINE');
            $this->line("  Memory: {$stat['memory']['usage_percent']}%");
            $this->line("  Items: {$stat['items']['current']}");
            $this->line("  Hit Rate: {$stat['operations']['hit_rate']}%");
            $this->line("  Evictions: {$stat['evictions']}");
            $this->newLine();
        }

        $aggregated = $service->getAggregatedStats();
        $this->info('Aggregated Stats:');
        $this->line("  Servers Online: {$aggregated['servers_online']}/{$aggregated['servers_total']}");
        $this->line("  Memory Usage: {$aggregated['memory_usage_percent']}%");
        $this->line("  Total Items: {$aggregated['items_total']}");
        $this->line("  Hit Rate: {$aggregated['hit_rate']}%");
    }
}
```
</details>

### Задание 2: Cache Stampede Protection для Memcached

Реализуй защиту от Cache Stampede для Memcached используя probabilistic early expiration.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\Cache;

class MemcachedStampedeProtection
{
    /**
     * Cache с защитой от stampede
     *
     * @param string $key Ключ cache
     * @param int $ttl TTL в секундах
     * @param callable $callback Функция для получения данных
     * @param float $beta Коэффициент early expiration (обычно 1.0)
     * @return mixed
     */
    public function remember(string $key, int $ttl, callable $callback, float $beta = 1.0)
    {
        $cacheKey = "stampede:{$key}";
        $expiryKey = "stampede:{$key}:expiry";

        $value = Cache::store('memcached')->get($cacheKey);
        $expiry = Cache::store('memcached')->get($expiryKey);

        if ($value !== null && $expiry !== null) {
            $now = time();
            $timeLeft = $expiry - $now;

            // Probabilistic early expiration
            // δ (delta) - время на пересчет (используем 1 сек)
            $delta = 1;
            $xfetch = $delta * $beta * log(mt_rand() / mt_getrandmax());

            // Если probability говорит что пора обновить
            if ($timeLeft - $xfetch <= 0) {
                // Устанавливаем временный lock
                $lockKey = "stampede:{$key}:lock";

                if ($this->acquireLock($lockKey, 10)) {
                    try {
                        // Пересчитать значение
                        $newValue = $callback();

                        Cache::store('memcached')->put($cacheKey, $newValue, $ttl);
                        Cache::store('memcached')->put($expiryKey, time() + $ttl, $ttl);

                        return $newValue;
                    } finally {
                        $this->releaseLock($lockKey);
                    }
                }
            }

            return $value;
        }

        // Cache miss - получить lock
        $lockKey = "stampede:{$key}:lock";

        if ($this->acquireLock($lockKey, 10)) {
            try {
                // Double-check
                $value = Cache::store('memcached')->get($cacheKey);
                if ($value !== null) {
                    return $value;
                }

                // Вычислить значение
                $value = $callback();

                Cache::store('memcached')->put($cacheKey, $value, $ttl);
                Cache::store('memcached')->put($expiryKey, time() + $ttl, $ttl);

                return $value;
            } finally {
                $this->releaseLock($lockKey);
            }
        }

        // Не смогли получить lock - ждем и пытаемся получить из cache
        usleep(100000); // 100ms

        $value = Cache::store('memcached')->get($cacheKey);

        return $value ?? $callback();
    }

    private function acquireLock(string $key, int $seconds): bool
    {
        return Cache::store('memcached')->add($key, 1, $seconds);
    }

    private function releaseLock(string $key): void
    {
        Cache::store('memcached')->forget($key);
    }
}

// Использование
$cache = new MemcachedStampedeProtection();

$users = $cache->remember('users_list', 3600, function () {
    // Дорогой запрос
    return User::with('roles', 'permissions')->get();
}, beta: 1.0);

// Альтернатива: простой Lock-based подход
class SimpleStampedeProtection
{
    public function remember(string $key, int $ttl, callable $callback)
    {
        $value = Cache::store('memcached')->get($key);

        if ($value !== null) {
            return $value;
        }

        // Попытаться получить lock
        $lockKey = "{$key}:lock";

        if (Cache::store('memcached')->add($lockKey, 1, 10)) {
            try {
                // Double-check
                $value = Cache::store('memcached')->get($key);
                if ($value !== null) {
                    return $value;
                }

                // Вычислить
                $value = $callback();
                Cache::store('memcached')->put($key, $value, $ttl);

                return $value;
            } finally {
                Cache::store('memcached')->forget($lockKey);
            }
        }

        // Ждать и повторить
        $attempts = 0;
        while ($attempts < 50) { // max 5 секунд
            usleep(100000); // 100ms

            $value = Cache::store('memcached')->get($key);
            if ($value !== null) {
                return $value;
            }

            $attempts++;
        }

        // Fallback - вычислить без cache
        return $callback();
    }
}
```
</details>

### Задание 3: Session Storage с Memcached и Monitoring

Настрой session storage через Memcached и создай middleware для мониторинга session hit rate.

<details>
<summary>Решение</summary>

```php
// config/session.php
'driver' => env('SESSION_DRIVER', 'memcached'),
'connection' => env('SESSION_CONNECTION', 'default'),
'store' => env('SESSION_STORE', null),

// Middleware для мониторинга sessions
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SessionMonitoring
{
    public function handle(Request $request, Closure $next)
    {
        $startTime = microtime(true);
        $sessionId = $request->session()->getId();

        // Инкрементировать счетчик запросов
        $this->incrementSessionRequests($sessionId);

        $response = $next($request);

        $duration = microtime(true) - $startTime;

        // Логировать метрики
        $this->logSessionMetrics($sessionId, $duration);

        return $response;
    }

    private function incrementSessionRequests(string $sessionId): void
    {
        $key = "session:metrics:{$sessionId}:requests";
        Cache::increment($key);
        Cache::expire($key, 3600); // 1 hour
    }

    private function logSessionMetrics(string $sessionId, float $duration): void
    {
        $metricsKey = "session:metrics:{$sessionId}:response_times";

        $metrics = Cache::get($metricsKey, []);
        $metrics[] = $duration;

        // Хранить только последние 100 запросов
        if (count($metrics) > 100) {
            array_shift($metrics);
        }

        Cache::put($metricsKey, $metrics, 3600);
    }
}

// Сервис для анализа session метрик
namespace App\Services;

class SessionAnalyticsService
{
    public function getSessionMetrics(string $sessionId): array
    {
        $requestsKey = "session:metrics:{$sessionId}:requests";
        $responseTimesKey = "session:metrics:{$sessionId}:response_times";

        $requests = Cache::get($requestsKey, 0);
        $responseTimes = Cache::get($responseTimesKey, []);

        return [
            'session_id' => $sessionId,
            'total_requests' => $requests,
            'avg_response_time' => $this->calculateAverage($responseTimes),
            'min_response_time' => !empty($responseTimes) ? min($responseTimes) : 0,
            'max_response_time' => !empty($responseTimes) ? max($responseTimes) : 0,
        ];
    }

    public function getActiveSessionsCount(): int
    {
        // Это требует кастомной реализации
        // Memcached не поддерживает получение всех ключей
        // Нужно отдельно tracking активных сессий
        return Cache::get('active_sessions_count', 0);
    }

    private function calculateAverage(array $values): float
    {
        if (empty($values)) {
            return 0;
        }

        return round(array_sum($values) / count($values), 4);
    }
}

// Tracker активных сессий
namespace App\Http\Middleware;

class TrackActiveSessions
{
    public function handle(Request $request, Closure $next)
    {
        $sessionId = $request->session()->getId();
        $activeSessionsKey = 'active_sessions';

        // Добавить сессию в set активных (используем отдельный Redis для этого)
        Cache::store('redis')->put(
            "{$activeSessionsKey}:{$sessionId}",
            now()->timestamp,
            1800 // 30 минут
        );

        // Обновить счетчик
        $this->updateActiveSessionsCount();

        return $next($request);
    }

    private function updateActiveSessionsCount(): void
    {
        // Подсчитать активные сессии
        // Примечание: для production лучше использовать Redis Sets
        $pattern = 'active_sessions:*';
        $keys = Cache::store('redis')->keys($pattern);

        Cache::put('active_sessions_count', count($keys), 60);
    }
}

// Dashboard controller
class SessionDashboardController extends Controller
{
    public function index(Request $request, SessionAnalyticsService $analytics)
    {
        $sessionMetrics = $analytics->getSessionMetrics(
            $request->session()->getId()
        );

        $activeSessionsCount = $analytics->getActiveSessionsCount();

        return view('dashboard.sessions', [
            'session_metrics' => $sessionMetrics,
            'active_sessions_count' => $activeSessionsCount,
        ]);
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
