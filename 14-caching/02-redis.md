# 14.2 Redis Cache

## Краткое резюме

> **Redis** — in-memory key-value store с rich data structures (strings, hashes, lists, sets, sorted sets).
>
> Laravel: `Cache::store('redis')->remember()`. Data structures: **hashes** (objects), **lists** (queues), **sets** (tags, online users), **sorted sets** (leaderboards). **Pipeline** для batch operations, **Transactions** (MULTI/EXEC), **Lua scripts** для atomic operations.
>
> Use cases: cache, sessions, rate limiting, distributed locks, leaderboards, pub/sub, queues. Persistence: RDB (snapshots), AOF (logs).

---

## Содержание

- [Что это](#что-это)
- [Установка](#установка)
- [Базовое использование](#базовое-использование)
- [Data Structures](#data-structures)
- [Pipeline](#pipeline-batch-operations)
- [Transactions](#transactions)
- [Cache Patterns](#cache-patterns)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Redis:**
In-memory key-value store. Используется как cache, message broker, session store, leaderboard, и многое другое.

**Зачем:**
- Очень быстрый (in-memory)
- Rich data structures (strings, lists, sets, hashes, sorted sets)
- Persistence (optional)
- Pub/Sub
- Transactions
- Lua scripting

---

## Установка

**Docker:**

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Laravel config:**

```php
// config/database.php
'redis' => [
    'client' => 'phpredis',  // или 'predis'
    'default' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 0,
    ],
    'cache' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 1,  // Отдельная БД для cache
    ],
],
```

---

## Базовое использование

**Laravel Cache:**

```php
// Put (set with TTL)
Cache::store('redis')->put('key', 'value', 3600);

// Get
$value = Cache::store('redis')->get('key');

// Remember (get or set)
$users = Cache::store('redis')->remember('users', 3600, function () {
    return User::all();
});

// Forget (delete)
Cache::store('redis')->forget('key');

// Flush (delete all)
Cache::store('redis')->flush();
```

---

## Data Structures

### 1. Strings

**Базовые операции:**

```php
// Set
Redis::set('user:1:name', 'John');

// Get
$name = Redis::get('user:1:name');  // "John"

// Set with expiration
Redis::setex('session:abc', 3600, json_encode($data));

// Increment
Redis::incr('page_views');  // 1
Redis::incr('page_views');  // 2

// Decrement
Redis::decr('stock');
```

---

### 2. Hashes (для объектов)

```php
// Set hash fields
Redis::hset('user:1', 'name', 'John');
Redis::hset('user:1', 'email', 'john@example.com');

// Or batch
Redis::hmset('user:1', [
    'name' => 'John',
    'email' => 'john@example.com',
    'age' => 30,
]);

// Get field
$name = Redis::hget('user:1', 'name');  // "John"

// Get all
$user = Redis::hgetall('user:1');
// ['name' => 'John', 'email' => 'john@example.com', 'age' => '30']

// Increment field
Redis::hincrby('user:1', 'age', 1);  // 31
```

---

### 3. Lists (для очередей)

```php
// Push to list
Redis::lpush('queue', 'task1');
Redis::lpush('queue', 'task2');  // ['task2', 'task1']

// Pop from list
$task = Redis::lpop('queue');  // 'task2'

// Blocking pop (wait for item)
$task = Redis::blpop('queue', 5);  // Wait 5 seconds

// Get range
$tasks = Redis::lrange('queue', 0, -1);  // All items

// List length
$count = Redis::llen('queue');
```

**Use case: Job Queue**

```php
// Producer
Redis::rpush('jobs:default', json_encode([
    'class' => SendEmailJob::class,
    'data' => ['user_id' => 1],
]));

// Consumer
while (true) {
    $job = Redis::blpop('jobs:default', 5);
    if ($job) {
        $this->process(json_decode($job[1], true));
    }
}
```

---

### 4. Sets (уникальные элементы)

```php
// Add to set
Redis::sadd('online_users', 1);
Redis::sadd('online_users', 2);
Redis::sadd('online_users', 1);  // Дубликат игнорируется

// Get members
$users = Redis::smembers('online_users');  // [1, 2]

// Check membership
$isOnline = Redis::sismember('online_users', 1);  // true

// Remove
Redis::srem('online_users', 1);

// Count
$count = Redis::scard('online_users');

// Set operations
Redis::sadd('set1', 1, 2, 3);
Redis::sadd('set2', 2, 3, 4);

$intersection = Redis::sinter('set1', 'set2');  // [2, 3]
$union = Redis::sunion('set1', 'set2');  // [1, 2, 3, 4]
$diff = Redis::sdiff('set1', 'set2');  // [1]
```

**Use case: Tags**

```php
// Add tags to post
Redis::sadd('post:1:tags', 'php', 'laravel', 'redis');

// Get posts by tag
Redis::sadd('tag:php:posts', 1, 2, 3);
Redis::sadd('tag:laravel:posts', 1, 4);

$posts = Redis::sinter('tag:php:posts', 'tag:laravel:posts');  // [1]
```

---

### 5. Sorted Sets (для leaderboards)

```php
// Add with score
Redis::zadd('leaderboard', 100, 'player1');
Redis::zadd('leaderboard', 200, 'player2');
Redis::zadd('leaderboard', 150, 'player3');

// Get top N (highest scores)
$top = Redis::zrevrange('leaderboard', 0, 9);  // Top 10
// ['player2', 'player3', 'player1']

// Get rank (0-based)
$rank = Redis::zrevrank('leaderboard', 'player2');  // 0 (first)

// Get score
$score = Redis::zscore('leaderboard', 'player1');  // 100

// Increment score
Redis::zincrby('leaderboard', 10, 'player1');  // 110

// Count
$count = Redis::zcard('leaderboard');

// Get range by score
$players = Redis::zrangebyscore('leaderboard', 100, 200);
```

**Use case: Leaderboard**

```php
class LeaderboardService
{
    public function addScore(int $userId, int $score): void
    {
        Redis::zincrby('leaderboard', $score, $userId);
    }

    public function getTop(int $limit = 10): array
    {
        return Redis::zrevrange('leaderboard', 0, $limit - 1, 'WITHSCORES');
    }

    public function getUserRank(int $userId): ?int
    {
        $rank = Redis::zrevrank('leaderboard', $userId);
        return $rank !== false ? $rank + 1 : null;  // 1-based
    }

    public function getUserScore(int $userId): int
    {
        return (int) Redis::zscore('leaderboard', $userId);
    }
}
```

---

## Expiration (TTL)

```php
// Set with TTL
Redis::setex('key', 60, 'value');  // 60 seconds

// Set TTL on existing key
Redis::expire('key', 60);

// Get TTL
$ttl = Redis::ttl('key');  // seconds left

// Remove TTL (persist forever)
Redis::persist('key');
```

---

## Pipeline (batch operations)

**Проблема: N network round-trips**

```php
// Медленно: 100 round-trips
for ($i = 0; $i < 100; $i++) {
    Redis::set("key:{$i}", $i);
}
```

**Решение: Pipeline**

```php
// Быстро: 1 round-trip
Redis::pipeline(function ($pipe) {
    for ($i = 0; $i < 100; $i++) {
        $pipe->set("key:{$i}", $i);
    }
});
```

---

## Transactions

```php
Redis::multi();
Redis::set('key1', 'value1');
Redis::set('key2', 'value2');
Redis::incr('counter');
Redis::exec();

// Все команды выполняются атомарно
```

**Watch (optimistic locking):**

```php
Redis::watch('balance');

$balance = Redis::get('balance');

if ($balance >= 100) {
    Redis::multi();
    Redis::decrby('balance', 100);
    Redis::incrby('points', 10);
    $result = Redis::exec();

    if ($result === null) {
        // Transaction failed (balance changed)
    }
} else {
    Redis::unwatch();
}
```

---

## Lua Scripts (atomic operations)

```php
$script = <<<'LUA'
local current = redis.call('get', KEYS[1])
if tonumber(current) >= tonumber(ARGV[1]) then
    redis.call('decrby', KEYS[1], ARGV[1])
    return 1
else
    return 0
end
LUA;

$result = Redis::eval($script, 1, 'balance', 100);

if ($result === 1) {
    // Success
} else {
    // Insufficient balance
}
```

---

## Cache Patterns

### 1. Cache User Data

```php
class UserRepository
{
    public function find(int $id): ?User
    {
        return Redis::remember("user:{$id}", 3600, function () use ($id) {
            return User::find($id);
        });
    }

    public function save(User $user): void
    {
        $user->save();

        // Invalidate cache
        Redis::forget("user:{$user->id}");
    }
}
```

---

### 2. Rate Limiting

```php
class RateLimiter
{
    public function attempt(string $key, int $maxAttempts, int $decaySeconds): bool
    {
        $attempts = Redis::get($key) ?? 0;

        if ($attempts >= $maxAttempts) {
            return false;  // Rate limited
        }

        if ($attempts === 0) {
            Redis::setex($key, $decaySeconds, 1);
        } else {
            Redis::incr($key);
        }

        return true;
    }
}

// Использование
if (!$rateLimiter->attempt("login:{$ip}", 5, 60)) {
    return response('Too many attempts', 429);
}
```

---

### 3. Session Storage

```php
// config/session.php
'driver' => 'redis',
'connection' => 'default',
```

---

### 4. Distributed Lock

```php
$lock = Cache::lock('process_orders', 10);  // 10 seconds

if ($lock->get()) {
    try {
        // Critical section
        $this->processOrders();
    } finally {
        $lock->release();
    }
} else {
    // Could not acquire lock
}
```

---

## Persistence

**RDB (snapshot):**

```ini
# redis.conf
save 900 1     # After 900s if 1 key changed
save 300 10    # After 300s if 10 keys changed
save 60 10000  # After 60s if 10000 keys changed
```

**AOF (append-only file):**

```ini
# redis.conf
appendonly yes
appendfsync everysec  # or always/no
```

---

## Monitoring

**Redis CLI:**

```bash
# Info
redis-cli info

# Memory usage
redis-cli info memory

# Keys count
redis-cli dbsize

# Monitor commands
redis-cli monitor

# Slow log
redis-cli slowlog get 10
```

**Laravel:**

```php
// Get info
$info = Redis::info();

// Get memory
$memory = Redis::info('memory');

// Get keys count
$count = Redis::dbsize();
```

---

## Best Practices

```
✓ Отдельные Redis databases для разных целей (cache, sessions, queues)
✓ Namespace keys (user:1:name)
✓ TTL для всех cache keys
✓ Pipeline для batch operations
✓ Lua scripts для atomic operations
✓ Monitor memory usage (eviction policy)
✓ Persistence для критичных данных
✓ Redis Sentinel/Cluster для HA
✓ НЕ хранить огромные values (< 1MB)
```

---

## На собеседовании скажешь

> "Redis — in-memory key-value store, очень быстрый. Data structures: strings (counters), hashes (objects), lists (queues), sets (tags, online users), sorted sets (leaderboards). Laravel Cache::remember для caching. Pipeline для batch operations (reduce round-trips). Transactions для atomic operations. Lua scripts для сложной atomic логики. Use cases: cache, sessions, rate limiting, distributed locks, leaderboards, queues. Persistence: RDB snapshots, AOF logs. Best practices: namespace keys, TTL, monitoring memory, eviction policy."

---

## Практические задания

### Задание 1: Leaderboard с Sorted Sets

Реализуй сервис для игрового leaderboard с использованием Redis Sorted Sets. Должны быть методы: добавить очки, получить топ-10, получить ранг игрока.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\Redis;

class LeaderboardService
{
    private const LEADERBOARD_KEY = 'game:leaderboard';

    /**
     * Добавить очки игроку
     */
    public function addScore(int $userId, int $score): void
    {
        // Инкрементировать score в sorted set
        Redis::zincrby(self::LEADERBOARD_KEY, $score, $userId);
    }

    /**
     * Установить абсолютное значение очков
     */
    public function setScore(int $userId, int $score): void
    {
        Redis::zadd(self::LEADERBOARD_KEY, $score, $userId);
    }

    /**
     * Получить топ N игроков
     */
    public function getTop(int $limit = 10): array
    {
        // ZREVRANGE - от большего к меньшему, WITHSCORES - включить scores
        $data = Redis::zrevrange(self::LEADERBOARD_KEY, 0, $limit - 1, 'WITHSCORES');

        $result = [];
        $rank = 1;

        foreach ($data as $userId => $score) {
            $result[] = [
                'rank' => $rank++,
                'user_id' => (int) $userId,
                'score' => (int) $score,
            ];
        }

        return $result;
    }

    /**
     * Получить ранг игрока (1-based)
     */
    public function getUserRank(int $userId): ?int
    {
        // ZREVRANK - 0-based rank
        $rank = Redis::zrevrank(self::LEADERBOARD_KEY, $userId);

        return $rank !== false ? $rank + 1 : null; // 1-based
    }

    /**
     * Получить очки игрока
     */
    public function getUserScore(int $userId): int
    {
        return (int) Redis::zscore(self::LEADERBOARD_KEY, $userId) ?? 0;
    }

    /**
     * Получить информацию об игроке (ранг + очки)
     */
    public function getUserInfo(int $userId): ?array
    {
        $score = $this->getUserScore($userId);

        if ($score === 0) {
            return null;
        }

        return [
            'user_id' => $userId,
            'rank' => $this->getUserRank($userId),
            'score' => $score,
        ];
    }

    /**
     * Получить игроков в диапазоне рангов
     */
    public function getRange(int $start, int $end): array
    {
        // 0-based
        $data = Redis::zrevrange(
            self::LEADERBOARD_KEY,
            $start - 1,
            $end - 1,
            'WITHSCORES'
        );

        $result = [];
        $rank = $start;

        foreach ($data as $userId => $score) {
            $result[] = [
                'rank' => $rank++,
                'user_id' => (int) $userId,
                'score' => (int) $score,
            ];
        }

        return $result;
    }

    /**
     * Удалить игрока из leaderboard
     */
    public function removeUser(int $userId): void
    {
        Redis::zrem(self::LEADERBOARD_KEY, $userId);
    }

    /**
     * Сбросить весь leaderboard
     */
    public function reset(): void
    {
        Redis::del(self::LEADERBOARD_KEY);
    }
}

// Использование в контроллере
class LeaderboardController extends Controller
{
    public function addScore(Request $request, LeaderboardService $leaderboard)
    {
        $validated = $request->validate([
            'score' => 'required|integer|min:0',
        ]);

        $leaderboard->addScore($request->user()->id, $validated['score']);

        return response()->json([
            'message' => 'Score added',
            'user_info' => $leaderboard->getUserInfo($request->user()->id),
        ]);
    }

    public function top(LeaderboardService $leaderboard)
    {
        return response()->json([
            'leaderboard' => $leaderboard->getTop(10),
        ]);
    }

    public function myRank(Request $request, LeaderboardService $leaderboard)
    {
        return response()->json(
            $leaderboard->getUserInfo($request->user()->id)
        );
    }
}
```
</details>

### Задание 2: Rate Limiting с Redis

Создай middleware для rate limiting используя Redis. Ограничение: 60 запросов в минуту на IP адрес.

<details>
<summary>Решение</summary>

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class RateLimitMiddleware
{
    private const MAX_ATTEMPTS = 60;
    private const DECAY_SECONDS = 60;

    public function handle(Request $request, Closure $next)
    {
        $key = $this->resolveRequestSignature($request);

        if ($this->tooManyAttempts($key)) {
            $retryAfter = $this->availableIn($key);

            return response()->json([
                'message' => 'Too many requests',
                'retry_after' => $retryAfter,
            ], 429)->header('Retry-After', $retryAfter);
        }

        $this->hit($key);

        $response = $next($request);

        return $this->addHeaders($response, $key);
    }

    /**
     * Получить уникальный ключ для запроса
     */
    protected function resolveRequestSignature(Request $request): string
    {
        $route = $request->route() ? $request->route()->getName() : $request->path();

        return sprintf(
            'rate_limit:%s:%s',
            $request->ip(),
            $route
        );
    }

    /**
     * Проверить превышен ли лимит
     */
    protected function tooManyAttempts(string $key): bool
    {
        return $this->attempts($key) >= self::MAX_ATTEMPTS;
    }

    /**
     * Получить количество попыток
     */
    protected function attempts(string $key): int
    {
        return (int) Redis::get($key) ?? 0;
    }

    /**
     * Инкрементировать счетчик
     */
    protected function hit(string $key): void
    {
        $attempts = Redis::get($key);

        if ($attempts === null) {
            // Первый запрос - установить TTL
            Redis::setex($key, self::DECAY_SECONDS, 1);
        } else {
            // Инкрементировать
            Redis::incr($key);
        }
    }

    /**
     * Через сколько секунд можно снова делать запросы
     */
    protected function availableIn(string $key): int
    {
        return Redis::ttl($key);
    }

    /**
     * Добавить headers с информацией о лимите
     */
    protected function addHeaders($response, string $key)
    {
        $attempts = $this->attempts($key);
        $remaining = max(0, self::MAX_ATTEMPTS - $attempts);

        return $response
            ->header('X-RateLimit-Limit', self::MAX_ATTEMPTS)
            ->header('X-RateLimit-Remaining', $remaining)
            ->header('X-RateLimit-Reset', now()->addSeconds($this->availableIn($key))->timestamp);
    }
}

// Регистрация в Kernel.php
protected $middlewareAliases = [
    'throttle.custom' => \App\Http\Middleware\RateLimitMiddleware::class,
];

// Использование в routes
Route::middleware('throttle.custom')->group(function () {
    Route::get('/api/posts', [PostController::class, 'index']);
});

// Продвинутая версия с разными лимитами
class FlexibleRateLimiter
{
    public function handle(Request $request, Closure $next, int $maxAttempts = 60, int $decaySeconds = 60)
    {
        $key = $this->resolveRequestSignature($request);

        // Sliding window algorithm
        $now = time();
        $windowStart = $now - $decaySeconds;

        // Удалить старые записи
        Redis::zremrangebyscore($key, 0, $windowStart);

        // Подсчитать текущие запросы в окне
        $currentAttempts = Redis::zcard($key);

        if ($currentAttempts >= $maxAttempts) {
            return response()->json([
                'message' => 'Too many requests',
            ], 429);
        }

        // Добавить текущий запрос
        Redis::zadd($key, $now, $now . ':' . uniqid());

        // Установить TTL на ключ
        Redis::expire($key, $decaySeconds);

        return $next($request);
    }
}
```
</details>

### Задание 3: Distributed Lock для критической секции

Реализуй сервис для обработки платежей с distributed lock чтобы избежать двойного списания.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    /**
     * Обработать платеж с distributed lock
     */
    public function processPayment(Order $order, array $paymentData): Payment
    {
        $lockKey = "payment:order:{$order->id}";

        // Получить lock на 10 секунд, ждать до 5 секунд
        $lock = Cache::lock($lockKey, 10);

        if (!$lock->get()) {
            throw new \Exception('Payment is already being processed');
        }

        try {
            // Критическая секция
            $payment = $this->processPaymentInternal($order, $paymentData);

            return $payment;
        } finally {
            // Обязательно освободить lock
            $lock->release();
        }
    }

    /**
     * Альтернатива с block() - автоматически ждать lock
     */
    public function processPaymentWithBlock(Order $order, array $paymentData): Payment
    {
        $lockKey = "payment:order:{$order->id}";

        return Cache::lock($lockKey, 10)->block(5, function () use ($order, $paymentData) {
            return $this->processPaymentInternal($order, $paymentData);
        });
    }

    private function processPaymentInternal(Order $order, array $paymentData): Payment
    {
        // Проверить что заказ еще не оплачен
        if ($order->status === 'paid') {
            throw new \Exception('Order is already paid');
        }

        return DB::transaction(function () use ($order, $paymentData) {
            // Создать платеж
            $payment = Payment::create([
                'order_id' => $order->id,
                'amount' => $order->total,
                'method' => $paymentData['method'],
                'status' => 'processing',
            ]);

            // Обратиться к платежному шлюзу
            $result = $this->chargePaymentGateway($paymentData);

            if ($result['success']) {
                $payment->update([
                    'status' => 'completed',
                    'transaction_id' => $result['transaction_id'],
                ]);

                $order->update(['status' => 'paid']);
            } else {
                $payment->update(['status' => 'failed']);
                throw new \Exception('Payment failed: ' . $result['error']);
            }

            return $payment;
        });
    }

    private function chargePaymentGateway(array $paymentData): array
    {
        // Симуляция обращения к платежному шлюзу
        sleep(1);

        return [
            'success' => true,
            'transaction_id' => 'txn_' . uniqid(),
        ];
    }
}

// Использование в контроллере
class PaymentController extends Controller
{
    public function process(Request $request, Order $order, PaymentService $paymentService)
    {
        $validated = $request->validate([
            'method' => 'required|in:card,paypal',
            'card_number' => 'required_if:method,card',
            'cvv' => 'required_if:method,card',
        ]);

        try {
            $payment = $paymentService->processPayment($order, $validated);

            return response()->json([
                'message' => 'Payment processed successfully',
                'payment' => $payment,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}

// Custom Lock Implementation
class RedisLock
{
    private string $key;
    private int $seconds;
    private ?string $owner = null;

    public function __construct(string $key, int $seconds)
    {
        $this->key = $key;
        $this->seconds = $seconds;
    }

    public function acquire(): bool
    {
        $this->owner = uniqid();

        // SET key owner NX EX seconds
        // NX - только если не существует
        // EX - expiration
        $result = Redis::set(
            $this->key,
            $this->owner,
            'EX',
            $this->seconds,
            'NX'
        );

        return $result === true;
    }

    public function release(): bool
    {
        // Lua script для atomic check-and-delete
        $script = <<<'LUA'
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
LUA;

        return Redis::eval($script, 1, $this->key, $this->owner) === 1;
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
