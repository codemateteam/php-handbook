# 16.2 System Design

## Подход к System Design

**Процесс:**

```
1. Уточнить требования (5-10 мин)
2. High-level архитектура (10-15 мин)
3. Детальный дизайн (15-20 мин)
4. Масштабирование (10 мин)
5. Trade-offs обсуждение (5 мин)
```

---

## Задача 1: URL Shortener (типа bit.ly)

**1. Требования:**

```
Functional:
- Сократить длинный URL в короткий
- Redirect с короткого на длинный
- Custom aliases (опционально)
- Analytics (опционально)

Non-functional:
- 100M URLs в месяц
- Low latency (< 100ms)
- High availability (99.9%)
- URL живёт вечно (no expiration)
```

**2. Расчёты:**

```
Пользователи:
- 100M новых URLs / месяц
- 3M URLs / день
- ~35 URLs / секунду

Чтение vs Запись:
- 100:1 ratio (больше читают)
- 3500 reads / секунду

Хранилище:
- Средний URL: 500 bytes
- 100M * 500 bytes = 50 GB / месяц
- 50 GB * 12 = 600 GB / год
- За 5 лет: 3 TB
```

**3. API Design:**

```php
// Создать короткий URL
POST /api/shorten
Body: {
    "long_url": "https://example.com/very/long/url",
    "custom_alias": "my-link" // optional
}
Response: {
    "short_url": "https://short.ly/abc123",
    "long_url": "https://example.com/very/long/url"
}

// Redirect
GET /{short_code}
Response: 302 Redirect to long_url
```

**4. Database Schema:**

```sql
CREATE TABLE urls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP,
    INDEX idx_short_code (short_code)
);

CREATE TABLE clicks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    url_id BIGINT,
    clicked_at TIMESTAMP,
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    INDEX idx_url_id (url_id),
    INDEX idx_clicked_at (clicked_at)
);
```

**5. Генерация short code:**

```php
// Вариант 1: Base62 encoding ID
function encodeBase62(int $id): string
{
    $chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $base = strlen($chars);
    $short = '';

    while ($id > 0) {
        $short = $chars[$id % $base] . $short;
        $id = floor($id / $base);
    }

    return $short ?: '0';
}

// ID 12345 → "3D7"

// Вариант 2: Random + collision check
function generateShortCode(): string
{
    do {
        $code = substr(md5(uniqid()), 0, 6);
    } while (DB::table('urls')->where('short_code', $code)->exists());

    return $code;
}
```

**6. High-Level Architecture:**

```
Users
  ↓
Load Balancer (Nginx)
  ↓
App Servers (PHP-FPM)
  ↓
Cache (Redis) → Database (MySQL)
  ↓
Analytics (Queue → ClickHouse)
```

**7. Масштабирование:**

```
- Cache Redis: кешировать популярные URLs (80/20 rule)
- Database: sharding по short_code range
- Read replicas для чтения
- CDN для статики
- Rate limiting для защиты
```

---

## Задача 2: Instagram Feed

**1. Требования:**

```
Functional:
- Показать feed (posts от followed users)
- Pagination
- Refresh feed
- Like/comment

Non-functional:
- 500M daily active users
- Average 20 follows per user
- Average 2 posts per day per user
```

**2. API:**

```php
// Получить feed
GET /api/feed?page=1&per_page=20
Response: {
    "posts": [
        {
            "id": 123,
            "user": {...},
            "image_url": "...",
            "caption": "...",
            "likes_count": 100,
            "created_at": "..."
        }
    ],
    "next_page": 2
}
```

**3. Database Schema:**

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE
);

CREATE TABLE follows (
    follower_id BIGINT,
    following_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    INDEX idx_follower (follower_id)
);

CREATE TABLE posts (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    image_url VARCHAR(500),
    caption TEXT,
    created_at TIMESTAMP,
    INDEX idx_user_created (user_id, created_at)
);
```

**4. Feed Generation:**

**Approach 1: Pull (compute on read)**

```php
// ❌ Медленно при большом количестве follows
function getFeed(User $user)
{
    $followingIds = $user->following()->pluck('id');

    return Post::whereIn('user_id', $followingIds)
        ->orderBy('created_at', 'desc')
        ->limit(20)
        ->get();
}
```

**Approach 2: Push (pre-compute)**

```php
// Когда user создаёт post
class PostCreated
{
    public function handle(Post $post)
    {
        $followerIds = $post->user->followers()->pluck('id');

        foreach ($followerIds as $followerId) {
            // Добавить в pre-computed feed
            Redis::zadd("feed:$followerId", $post->created_at->timestamp, $post->id);
        }
    }
}

// Чтение feed
function getFeed(User $user)
{
    $postIds = Redis::zrevrange("feed:{$user->id}", 0, 19);
    return Post::whereIn('id', $postIds)->get();
}
```

**Hybrid approach (Instagram реально использует):**

```
- Push для users с малым количеством followers (< 1M)
- Pull для celebrities с большим количеством followers
- Pre-compute только recent posts (last 3 days)
```

---

## Задача 3: Rate Limiter

**1. Требования:**

```
- Ограничить пользователя до N requests в период
- Разные limits для разных endpoints
- Вернуть 429 Too Many Requests
```

**2. Алгоритмы:**

**Fixed Window:**

```php
function checkRateLimit(string $userId, int $limit): bool
{
    $key = "rate_limit:$userId:" . date('Y-m-d-H');
    $count = Redis::incr($key);

    if ($count === 1) {
        Redis::expire($key, 3600); // 1 hour
    }

    return $count <= $limit;
}

// Проблема: burst в начале окна
```

**Sliding Window Log:**

```php
function checkRateLimitSliding(string $userId, int $limit, int $window): bool
{
    $key = "rate_limit:$userId";
    $now = microtime(true);
    $cutoff = $now - $window;

    // Удалить старые
    Redis::zremrangebyscore($key, 0, $cutoff);

    // Подсчитать текущие
    $count = Redis::zcard($key);

    if ($count < $limit) {
        Redis::zadd($key, $now, $now);
        Redis::expire($key, $window);
        return true;
    }

    return false;
}
```

**Token Bucket:**

```php
class TokenBucket
{
    private int $capacity;
    private float $refillRate; // tokens per second

    public function allowRequest(string $userId): bool
    {
        $key = "token_bucket:$userId";
        $now = microtime(true);

        $data = Redis::get($key);
        if ($data) {
            [$tokens, $lastRefill] = json_decode($data);
        } else {
            $tokens = $this->capacity;
            $lastRefill = $now;
        }

        // Refill tokens
        $elapsed = $now - $lastRefill;
        $tokens = min($this->capacity, $tokens + $elapsed * $this->refillRate);

        if ($tokens >= 1) {
            $tokens -= 1;
            Redis::setex($key, 3600, json_encode([$tokens, $now]));
            return true;
        }

        return false;
    }
}
```

---

## Задача 4: Chat System

**1. Требования:**

```
- 1-on-1 chat
- Group chat
- Real-time delivery
- Message history
- Online/offline status
```

**2. Architecture:**

```
Users → WebSocket Server → Message Queue → Database
                         → Notification Service
```

**3. Database Schema:**

```sql
CREATE TABLE conversations (
    id BIGINT PRIMARY KEY,
    type ENUM('direct', 'group'),
    created_at TIMESTAMP
);

CREATE TABLE conversation_members (
    conversation_id BIGINT,
    user_id BIGINT,
    joined_at TIMESTAMP,
    last_read_message_id BIGINT,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id BIGINT PRIMARY KEY,
    conversation_id BIGINT,
    user_id BIGINT,
    content TEXT,
    created_at TIMESTAMP,
    INDEX idx_conversation (conversation_id, created_at)
);
```

**4. WebSocket Implementation:**

```php
// Laravel Reverb / Pusher
class MessageSent implements ShouldBroadcast
{
    public function __construct(
        public Message $message
    ) {}

    public function broadcastOn()
    {
        return new PrivateChannel("conversation.{$this->message->conversation_id}");
    }
}

// Frontend
Echo.private(`conversation.${conversationId}`)
    .listen('MessageSent', (e) => {
        appendMessage(e.message);
    });
```

---

## Общие компоненты

**Load Balancer:**
```
Nginx/HAProxy
- Round-robin
- Least connections
- Health checks
```

**Cache:**
```
Redis/Memcached
- Session storage
- Query results
- Rate limiting
```

**Database:**
```
- Read replicas
- Sharding
- Indexes
```

**Queue:**
```
Redis/RabbitMQ/SQS
- Async processing
- Email sending
- Notifications
```

**CDN:**
```
CloudFlare/CloudFront
- Static files
- Images
- Videos
```

---

## Trade-offs

**SQL vs NoSQL:**

```
SQL (MySQL, PostgreSQL):
✓ ACID transactions
✓ Relationships (JOIN)
✓ Strong consistency
❌ Vertical scaling

NoSQL (MongoDB, DynamoDB):
✓ Horizontal scaling
✓ Flexible schema
✓ High throughput
❌ Eventual consistency
❌ No complex queries
```

**Caching:**

```
✓ Fast reads
✓ Reduce DB load
❌ Stale data
❌ Cache invalidation complexity
```

---

## На собеседовании скажешь

> "System Design процесс: уточнить требования, расчёты (QPS, storage), API design, database schema, high-level архитектура, масштабирование. URL Shortener: Base62 encoding, Redis cache, sharding. Instagram Feed: push vs pull, hybrid approach. Rate Limiter: Fixed Window, Sliding Window, Token Bucket. Chat: WebSocket, queue, sharding по conversation_id. Компоненты: Load Balancer, Cache (Redis), DB (replicas, sharding), Queue, CDN. Trade-offs: SQL vs NoSQL, cache vs consistency."

