# 6.8 Redis

## Краткое резюме

> **Redis** — in-memory key-value база данных для кеширования, очередей, сессий, real-time данных.
>
> **Структуры:** strings, hashes, lists, sets, sorted sets. Хранит данные в RAM (очень быстро).
>
> **Важно:** В Laravel: Cache::store('redis'), SESSION_DRIVER=redis, QUEUE_CONNECTION=redis. Leaderboards через sorted sets (zadd, zrevrange).

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
Redis — in-memory база данных (key-value store). Используется для кеширования, очередей, сессий, real-time данных.

**Основное:**
- Хранит данные в RAM (очень быстро)
- Key-value структура
- Поддерживает структуры: strings, lists, sets, hashes

---

## Как работает

**Установка и настройка:**

```bash
# Установить Redis
brew install redis  # macOS
apt-get install redis  # Ubuntu

# Запустить
redis-server

# Laravel подключение (.env)
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

**Базовые операции:**

```php
use Illuminate\Support\Facades\Redis;

// SET (установить значение)
Redis::set('user:1:name', 'John Doe');

// GET (получить значение)
$name = Redis::get('user:1:name');  // 'John Doe'

// SETEX (с TTL в секундах)
Redis::setex('temp:data', 3600, 'value');  // Истечёт через 1 час

// DEL (удалить)
Redis::del('user:1:name');

// EXISTS (проверить существование)
if (Redis::exists('user:1:name')) {
    // Ключ существует
}

// INCR / DECR (инкремент/декремент)
Redis::incr('page:views');  // +1
Redis::incrby('page:views', 10);  // +10
Redis::decr('page:views');  // -1
```

**Структуры данных:**

```php
// HASH (ассоциативный массив)
Redis::hset('user:1', 'name', 'John');
Redis::hset('user:1', 'email', 'john@example.com');
Redis::hget('user:1', 'name');  // 'John'
Redis::hgetall('user:1');  // ['name' => 'John', 'email' => '...']

// LIST (список)
Redis::rpush('queue', 'job1');  // Добавить в конец
Redis::rpush('queue', 'job2');
Redis::lpop('queue');  // Извлечь с начала ('job1')
Redis::lrange('queue', 0, -1);  // Все элементы

// SET (множество уникальных элементов)
Redis::sadd('tags', 'php');
Redis::sadd('tags', 'laravel');
Redis::sadd('tags', 'php');  // Дубль не добавится
Redis::smembers('tags');  // ['php', 'laravel']
Redis::sismember('tags', 'php');  // true

// SORTED SET (отсортированное множество)
Redis::zadd('leaderboard', 100, 'user1');
Redis::zadd('leaderboard', 250, 'user2');
Redis::zadd('leaderboard', 150, 'user3');
Redis::zrevrange('leaderboard', 0, 9);  // Топ 10 (по убыванию)
// ['user2', 'user3', 'user1']
```

---

## Когда использовать

**Используй Redis для:**
- Кеширование (часто читаемые данные)
- Сессии (быстрый доступ)
- Очереди (Jobs)
- Rate limiting
- Real-time данные (leaderboards, counters)
- Pub/Sub (Broadcasting)

**Не используй для:**
- Постоянное хранение (Redis in-memory, данные теряются при рестарте без persistence)
- Большие объёмы данных (ограничено RAM)
- Сложные запросы (нет SQL)

---

## Пример из практики

**Кеширование данных:**

```php
// Кешировать результат запроса
use Illuminate\Support\Facades\Cache;

$users = Cache::remember('users.all', 3600, function () {
    return User::all();
});

// С Redis драйвером (.env: CACHE_DRIVER=redis)
$users = Cache::store('redis')->remember('users.all', 3600, function () {
    return User::all();
});

// Тегированный кеш
$posts = Cache::tags(['posts', 'published'])->remember('posts.published', 3600, function () {
    return Post::where('published', true)->get();
});

// Сбросить тег
Cache::tags(['posts'])->flush();
```

**Rate Limiting:**

```php
use Illuminate\Support\Facades\RateLimiter;

// Ограничить попытки логина
if (RateLimiter::tooManyAttempts('login:' . $email, 5)) {
    $seconds = RateLimiter::availableIn('login:' . $email);
    throw new TooManyRequestsException("Try again in {$seconds} seconds");
}

RateLimiter::hit('login:' . $email, 60);  // +1 попытка, TTL 60 секунд

// После успешного логина
RateLimiter::clear('login:' . $email);

// API rate limiting
Route::middleware('throttle:60,1')->group(function () {
    // 60 запросов в минуту
});
```

**Session Storage:**

```php
// .env
SESSION_DRIVER=redis

// Сессии автоматически хранятся в Redis
session(['key' => 'value']);
$value = session('key');
```

**Queues (очереди):**

```php
// .env
QUEUE_CONNECTION=redis

// Job автоматически в Redis очередь
SendEmail::dispatch($user);

// Запустить worker
php artisan queue:work redis
```

**Counters (счётчики):**

```php
// Счётчик просмотров
class PostController extends Controller
{
    public function show(Post $post)
    {
        // Инкремент в Redis
        Redis::incr("post:{$post->id}:views");

        // Периодически синхронизировать с БД (в фоне)
        dispatch(new SyncPostViews($post));

        return view('posts.show', compact('post'));
    }

    public function getViews(Post $post): int
    {
        // Быстро из Redis
        return (int) Redis::get("post:{$post->id}:views") ?: 0;
    }
}

// Job для синхронизации
class SyncPostViews implements ShouldQueue
{
    public function handle(): void
    {
        $postIds = Post::pluck('id');

        foreach ($postIds as $postId) {
            $views = Redis::get("post:{$postId}:views");

            if ($views) {
                Post::where('id', $postId)->update(['views' => $views]);
            }
        }
    }
}
```

**Leaderboard (топ игроков):**

```php
class LeaderboardService
{
    public function addScore(User $user, int $score): void
    {
        // Добавить в sorted set
        Redis::zadd('leaderboard', $score, $user->id);
    }

    public function getTop(int $limit = 10): Collection
    {
        // Топ N по убыванию
        $userIds = Redis::zrevrange('leaderboard', 0, $limit - 1);

        return User::whereIn('id', $userIds)
            ->get()
            ->sortBy(function ($user) use ($userIds) {
                return array_search($user->id, $userIds);
            });
    }

    public function getUserRank(User $user): int
    {
        // Позиция пользователя (с конца)
        $rank = Redis::zrevrank('leaderboard', $user->id);

        return $rank !== null ? $rank + 1 : 0;
    }
}
```

**Lock (блокировка):**

```php
use Illuminate\Support\Facades\Cache;

// Получить блокировку
$lock = Cache::lock('process-orders', 10);  // 10 секунд

if ($lock->get()) {
    try {
        // Критическая секция (только один процесс)
        processOrders();
    } finally {
        $lock->release();
    }
} else {
    // Не удалось получить блокировку
    Log::info('Another process is already running');
}

// Или с автоматическим освобождением
Cache::lock('process-orders', 10)->block(5, function () {
    // Ждать до 5 секунд, затем выполнить
    processOrders();
});
```

**Pub/Sub (Broadcasting):**

```php
// Publisher
Redis::publish('notifications', json_encode([
    'message' => 'New order created',
    'order_id' => $order->id,
]));

// Subscriber (в отдельном процессе)
Redis::subscribe(['notifications'], function (string $message) {
    $data = json_decode($message, true);
    Log::info('Received notification', $data);
});
```

**Cache aside pattern:**

```php
class UserRepository
{
    public function find(int $id): ?User
    {
        // 1. Проверить кеш
        $cached = Redis::get("user:{$id}");

        if ($cached) {
            return unserialize($cached);
        }

        // 2. Загрузить из БД
        $user = User::find($id);

        if ($user) {
            // 3. Сохранить в кеш
            Redis::setex("user:{$id}", 3600, serialize($user));
        }

        return $user;
    }

    public function update(User $user): void
    {
        // 1. Обновить БД
        $user->save();

        // 2. Инвалидировать кеш
        Redis::del("user:{$user->id}");

        // Или обновить кеш
        Redis::setex("user:{$user->id}", 3600, serialize($user));
    }
}
```

---

## На собеседовании скажешь

> "Redis — in-memory key-value база для кеширования, очередей, сессий. Структуры: strings, hashes, lists, sets, sorted sets. В Laravel: Cache::store('redis'), SESSION_DRIVER=redis, QUEUE_CONNECTION=redis. Rate limiting через RateLimiter. Leaderboards через sorted sets (zadd, zrevrange). Lock через Cache::lock() для критических секций. Pub/Sub для real-time. Cache aside pattern: проверить кеш → загрузить из БД → сохранить в кеш."

---

## Практические задания

### Задание 1: Реализуй Rate Limiting для API

Ограничь API endpoint: максимум 10 запросов в минуту на IP. При превышении вернуть 429 ошибку.

<details>
<summary>Решение</summary>

```php
// Middleware для rate limiting
class RateLimitMiddleware
{
    public function handle(Request $request, Closure $next, int $maxAttempts = 10, int $decayMinutes = 1)
    {
        $key = $this->resolveRequestSignature($request);

        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json([
                'message' => 'Too many requests. Please try again later.',
                'retry_after' => $seconds,
            ], 429)->header('Retry-After', $seconds);
        }

        RateLimiter::hit($key, $decayMinutes * 60);

        $response = $next($request);

        return $this->addHeaders(
            $response,
            $maxAttempts,
            RateLimiter::remaining($key, $maxAttempts)
        );
    }

    protected function resolveRequestSignature(Request $request): string
    {
        return 'api:' . $request->ip();
    }

    protected function addHeaders($response, int $maxAttempts, int $remainingAttempts)
    {
        return $response->withHeaders([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => max(0, $remainingAttempts),
        ]);
    }
}

// Использование в routes
Route::middleware(['rate.limit:10,1'])->group(function () {
    Route::get('/api/posts', [PostController::class, 'index']);
});

// Или встроенный throttle middleware
Route::middleware('throttle:10,1')->group(function () {
    Route::get('/api/posts', [PostController::class, 'index']);
});

// Для авторизованных пользователей (по user_id)
Route::middleware('auth:sanctum', 'throttle:60,1')->group(function () {
    Route::post('/api/posts', [PostController::class, 'store']);
});

// В RouteServiceProvider для кастомного лимита
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});

// Разные лимиты для разных пользователей
RateLimiter::for('api', function (Request $request) {
    return $request->user()?->is_premium
        ? Limit::perMinute(1000)->by($request->user()->id)
        : Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});
```
</details>

### Задание 2: Реализуй Leaderboard (топ игроков)

Создай систему рейтинга игроков с возможностью получить топ-100 и позицию конкретного игрока.

<details>
<summary>Решение</summary>

```php
class LeaderboardService
{
    protected string $key = 'game:leaderboard';

    // Добавить/обновить счёт игрока
    public function updateScore(User $user, int $score): void
    {
        // zadd добавляет или обновляет score
        Redis::zadd($this->key, $score, $user->id);
    }

    // Увеличить счёт
    public function incrementScore(User $user, int $points): int
    {
        return Redis::zincrby($this->key, $points, $user->id);
    }

    // Получить топ N игроков
    public function getTop(int $limit = 100): Collection
    {
        // zrevrange возвращает от большего к меньшему
        $userIds = Redis::zrevrange($this->key, 0, $limit - 1, 'WITHSCORES');

        // $userIds = ['user1' => 1000, 'user2' => 950, ...]

        $users = User::whereIn('id', array_keys($userIds))->get()->keyBy('id');

        return collect($userIds)->map(function ($score, $userId) use ($users) {
            return [
                'user' => $users[$userId] ?? null,
                'score' => (int) $score,
                'rank' => Redis::zrevrank($this->key, $userId) + 1,
            ];
        })->values();
    }

    // Получить позицию игрока
    public function getUserRank(User $user): ?int
    {
        $rank = Redis::zrevrank($this->key, $user->id);

        return $rank !== null ? $rank + 1 : null;
    }

    // Получить счёт игрока
    public function getUserScore(User $user): int
    {
        return (int) Redis::zscore($this->key, $user->id) ?: 0;
    }

    // Получить игроков вокруг пользователя
    public function getSurroundingPlayers(User $user, int $range = 5): Collection
    {
        $userRank = $this->getUserRank($user);

        if (!$userRank) {
            return collect();
        }

        $start = max(0, $userRank - $range - 1);
        $end = $userRank + $range - 1;

        $userIds = Redis::zrevrange($this->key, $start, $end, 'WITHSCORES');

        $users = User::whereIn('id', array_keys($userIds))->get()->keyBy('id');

        return collect($userIds)->map(function ($score, $userId) use ($users) {
            return [
                'user' => $users[$userId] ?? null,
                'score' => (int) $score,
                'rank' => Redis::zrevrank($this->key, $userId) + 1,
            ];
        })->values();
    }

    // Очистить leaderboard
    public function clear(): void
    {
        Redis::del($this->key);
    }
}

// Использование
$leaderboard = new LeaderboardService();

// Обновить счёт
$leaderboard->updateScore($user, 1500);
$leaderboard->incrementScore($user, 100);

// Топ 10
$top10 = $leaderboard->getTop(10);

// Позиция игрока
$rank = $leaderboard->getUserRank($user);

// Игроки вокруг
$surrounding = $leaderboard->getSurroundingPlayers($user, 3);

// API endpoint
public function leaderboard()
{
    $leaderboard = new LeaderboardService();

    return response()->json([
        'top_100' => $leaderboard->getTop(100),
        'current_user' => [
            'rank' => $leaderboard->getUserRank(auth()->user()),
            'score' => $leaderboard->getUserScore(auth()->user()),
        ],
    ]);
}
```
</details>

### Задание 3: Реализуй Distributed Lock

Создай систему блокировок для предотвращения одновременного выполнения задачи несколькими процессами.

<details>
<summary>Решение</summary>

```php
// Базовое использование Cache::lock()
class OrderProcessor
{
    public function processOrder(Order $order): void
    {
        $lock = Cache::lock("order:{$order->id}:processing", 10);

        if ($lock->get()) {
            try {
                // Только один процесс выполнит этот код
                $this->doProcessing($order);
            } finally {
                $lock->release();
            }
        } else {
            Log::info("Order {$order->id} is already being processed");
        }
    }
}

// С автоматическим ожиданием
class EmailSender
{
    public function sendBulkEmails(Collection $users): void
    {
        Cache::lock('send-bulk-emails', 60)->block(5, function () use ($users) {
            // Ждать до 5 секунд получения блокировки
            // Если получили - выполнить, иначе throw LockTimeoutException
            foreach ($users as $user) {
                Mail::to($user)->send(new NewsletterEmail());
            }
        });
    }
}

// Продление блокировки (для долгих операций)
class DataImporter
{
    public function import(string $file): void
    {
        $lock = Cache::lock('data-import', 120);  // 2 минуты

        if ($lock->get()) {
            try {
                $lines = file($file);

                foreach ($lines as $line) {
                    $this->processLine($line);

                    // Продлить блокировку каждые 100 строк
                    if ($line % 100 === 0) {
                        $lock->get();  // Обновить TTL
                    }
                }
            } finally {
                $lock->release();
            }
        }
    }
}

// Кастомная реализация с Redis
class CustomLock
{
    protected string $key;
    protected int $timeout;
    protected ?string $owner = null;

    public function __construct(string $key, int $timeout = 10)
    {
        $this->key = "lock:{$key}";
        $this->timeout = $timeout;
    }

    public function acquire(): bool
    {
        $this->owner = Str::random(20);

        // SET NX EX - установить если не существует с TTL
        $acquired = Redis::set(
            $this->key,
            $this->owner,
            'EX',
            $this->timeout,
            'NX'
        );

        return $acquired === true;
    }

    public function release(): bool
    {
        // Удалить только если мы владелец (Lua script для атомарности)
        $script = <<<'LUA'
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        LUA;

        return Redis::eval($script, 1, $this->key, $this->owner) === 1;
    }

    public function forceRelease(): void
    {
        Redis::del($this->key);
    }
}

// Использование кастомного lock
$lock = new CustomLock('critical-section', 30);

if ($lock->acquire()) {
    try {
        // Критическая секция
        processCriticalTask();
    } finally {
        $lock->release();
    }
} else {
    Log::info('Could not acquire lock');
}

// Distributed lock для scheduled tasks
class ScheduledTaskLock
{
    public function handle(): void
    {
        $lock = Cache::lock('scheduled:daily-report', 3600);

        if ($lock->get()) {
            // Только один сервер выполнит эту задачу
            try {
                $this->generateDailyReport();
            } finally {
                $lock->release();
            }
        }
    }
}

// В Kernel.php
protected function schedule(Schedule $schedule): void
{
    $schedule->call(function () {
        Cache::lock('scheduled:cleanup', 3600)->get(function () {
            // Cleanup логика
        });
    })->daily();
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
