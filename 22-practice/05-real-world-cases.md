# 16.5 Real-World Cases

## Реальные кейсы с собеседований

### Кейс 1: E-commerce Flash Sale

**Задача:**

```
Магазин запускает flash sale: 100 товаров по скидке
за 1 час. 10,000 пользователей одновременно пытаются купить.

Проблемы:
- Overselling (продали больше чем было)
- Race conditions
- Медленная работа сайта
- Сервер падает от нагрузки

Как бы ты решил эту задачу?
```

**Решение:**

**1. Предотвратить overselling:**

```php
// Pessimistic locking
DB::transaction(function () use ($productId) {
    $product = Product::where('id', $productId)
        ->lockForUpdate()  // SELECT ... FOR UPDATE
        ->first();

    if ($product->stock <= 0) {
        throw new OutOfStockException();
    }

    Order::create([...]);
    $product->decrement('stock');
});

// Или Redis atomic operations
Redis::watch("product:$productId:stock");

$stock = Redis::get("product:$productId:stock");
if ($stock > 0) {
    Redis::multi();
    Redis::decr("product:$productId:stock");
    Redis::exec();
} else {
    throw new OutOfStockException();
}
```

**2. Queue для checkout:**

```php
// Не обрабатывать checkout синхронно
Route::post('/checkout', function (Request $request) {
    // Быстро добавить в queue
    ProcessCheckout::dispatch($request->all());

    return response()->json([
        'message' => 'Your order is being processed',
        'queue_position' => Queue::size('checkouts') + 1
    ]);
});

// Job обработает асинхронно
class ProcessCheckout implements ShouldQueue
{
    public function handle()
    {
        // Проверить stock
        // Создать заказ
        // Оплата
        // Email
    }
}
```

**3. Кеширование:**

```php
// Product страница
Route::get('/product/{id}', function ($id) {
    return Cache::remember("product.$id", 300, function () use ($id) {
        return Product::with('category')->find($id);
    });
});

// Stock через Redis
$stock = Redis::get("product:$id:stock");
```

**4. Rate limiting:**

```php
// Ограничить requests per user
Route::middleware(['throttle:10,1'])->group(function () {
    Route::post('/checkout', [CheckoutController::class, 'store']);
});

// 10 requests в минуту
```

**5. CDN для статики:**

```
CloudFlare / CloudFront кеширует:
- Изображения товаров
- CSS/JS
- Product pages (stale-while-revalidate)
```

**6. Horizontal scaling:**

```
Load Balancer
├─ App Server 1
├─ App Server 2
├─ App Server 3
└─ ...

Shared:
- Redis (sessions, cache, queue)
- Database (read replicas)
```

---

### Кейс 2: Social Media Feed Performance

**Задача:**

```
Instagram-like приложение. Feed загружается 5+ секунд
для пользователей с большим количеством follows.

User follows 1000 человек
Нужно показать последние 20 постов

Как оптимизировать?
```

**Решение:**

**1. Проблема (Pull model):**

```php
// ❌ Медленно
function getFeed(User $user)
{
    $followingIds = $user->following()->pluck('id'); // 1000 IDs

    return Post::whereIn('user_id', $followingIds)
        ->with('user', 'likes', 'comments')
        ->orderBy('created_at', 'desc')
        ->limit(20)
        ->get();
    // Query сканирует миллионы постов
}
```

**2. Push model (pre-compute feed):**

```php
// Когда user создаёт post
class PostCreated
{
    public function handle(Post $post)
    {
        $followerIds = $post->user->followers()->pluck('id');

        // Push в pre-computed feeds
        foreach ($followerIds->chunk(1000) as $chunk) {
            PushPostToFeeds::dispatch($post->id, $chunk);
        }
    }
}

class PushPostToFeeds implements ShouldQueue
{
    public function handle()
    {
        foreach ($this->followerIds as $followerId) {
            Redis::zadd(
                "feed:$followerId",
                $this->post->created_at->timestamp,
                $this->post->id
            );

            // Keep only last 1000
            Redis::zremrangebyrank("feed:$followerId", 0, -1001);
        }
    }
}

// Чтение feed
function getFeed(User $user)
{
    $postIds = Redis::zrevrange("feed:{$user->id}", 0, 19);

    return Post::whereIn('id', $postIds)
        ->with('user')
        ->get()
        ->sortByDesc('created_at');
}
// Очень быстро!
```

**3. Hybrid для celebrities:**

```php
function getFeed(User $user)
{
    // Pre-computed feed для обычных users
    $preComputedIds = Redis::zrevrange("feed:{$user->id}", 0, 19);

    // Live query для celebrities
    $celebrityIds = $user->following()
        ->where('followers_count', '>', 1000000)
        ->pluck('id');

    $liveIds = Post::whereIn('user_id', $celebrityIds)
        ->where('created_at', '>', now()->subDays(3))
        ->pluck('id');

    // Merge и sort
    $allIds = collect($preComputedIds)->merge($liveIds)
        ->unique()
        ->take(20);

    return Post::whereIn('id', $allIds)->get();
}
```

**4. Кеширование:**

```php
// User feed на 5 минут
Route::get('/api/feed', function () {
    $userId = auth()->id();

    return Cache::remember("feed:$userId", 300, function () use ($userId) {
        return getFeed(User::find($userId));
    });
});
```

---

### Кейс 3: Payment Gateway Timeout

**Задача:**

```
Интеграция с платёжным gateway (Stripe).
Иногда request timeout (30+ секунд).

Пользователь ждёт, потом получает 504 Gateway Timeout.
Но деньги могут быть списаны!

Как обработать?
```

**Решение:**

**1. Асинхронная обработка:**

```php
// ❌ Синхронно (плохо)
public function checkout(Request $request)
{
    $charge = Stripe::charges()->create([...]); // Может зависнуть
    return redirect('/success');
}

// ✅ Асинхронно (хорошо)
public function checkout(Request $request)
{
    $order = Order::create([...]);

    ProcessPayment::dispatch($order);

    return response()->json([
        'message' => 'Payment is being processed',
        'order_id' => $order->id,
        'status_url' => "/orders/{$order->id}/status"
    ]);
}

class ProcessPayment implements ShouldQueue
{
    public $tries = 3;
    public $timeout = 60;

    public function handle()
    {
        try {
            $charge = Stripe::charges()->create([...]);

            $this->order->update([
                'status' => 'paid',
                'stripe_charge_id' => $charge->id
            ]);
        } catch (\Stripe\Exception\ApiConnectionException $e) {
            // Retry автоматически
            throw $e;
        }
    }
}
```

**2. Webhook для confirmation:**

```php
// Stripe webhook
Route::post('/webhooks/stripe', function (Request $request) {
    $event = $request->all();

    if ($event['type'] === 'charge.succeeded') {
        $chargeId = $event['data']['object']['id'];

        Order::where('stripe_charge_id', $chargeId)
            ->update(['status' => 'paid']);
    }

    return response('OK');
});
```

**3. Idempotency key:**

```php
// Предотвратить duplicate charges
$idempotencyKey = "order-{$order->id}-" . now()->timestamp;

$charge = Stripe::charges()->create([
    'amount' => $order->total * 100,
    'currency' => 'usd',
    'source' => $token,
], [
    'idempotency_key' => $idempotencyKey
]);

// Повторный request с тем же key не создаст новый charge
```

**4. Timeout настройки:**

```php
// Client timeout
$stripe = new \Stripe\StripeClient([
    'api_key' => config('stripe.secret'),
    'timeout' => 10, // 10 секунд
    'connect_timeout' => 5,
]);

// Server timeout (nginx)
// location /checkout {
//     proxy_read_timeout 30s;
//     proxy_connect_timeout 10s;
// }
```

---

### Кейс 4: Database Migration Zero-Downtime

**Задача:**

```
Нужно переименовать колонку в production без downtime:
users.name → users.full_name

Проблема:
- Старая версия кода читает `name`
- Новая версия кода читает `full_name`
- Развёртывание происходит постепенно (rolling update)

Как сделать?
```

**Решение (Expand-Contract):**

**Phase 1: Expand (добавить новую колонку):**

```php
// Migration 1
Schema::table('users', function (Blueprint $table) {
    $table->string('full_name')->nullable()->after('name');
});

// Копировать данные
DB::table('users')->update([
    'full_name' => DB::raw('name')
]);
```

**Phase 2: Dual Write (писать в обе):**

```php
// v1.1 код (читает name, пишет в обе)
class User extends Model
{
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($user) {
            $user->full_name = $user->name;
        });
    }
}

// Deploy v1.1
// Теперь обе колонки синхронизированы
```

**Phase 3: Switch Read (читать из новой):**

```php
// v1.2 код (читает full_name, пишет в обе)
class User extends Model
{
    protected $appends = ['name'];

    // Accessor для backward compatibility
    public function getNameAttribute()
    {
        return $this->full_name;
    }

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($user) {
            // Sync обе колонки
            if (isset($user->attributes['full_name'])) {
                $user->name = $user->full_name;
            } else if (isset($user->attributes['name'])) {
                $user->full_name = $user->name;
            }
        });
    }
}

// Deploy v1.2
```

**Phase 4: Contract (удалить старую):**

```php
// v1.3 код (только full_name)
class User extends Model
{
    // Убрать accessor, убрать boot
}

// Migration 2
Schema::table('users', function (Blueprint $table) {
    $table->dropColumn('name');
});

// Deploy v1.3
```

**Timeline:**

```
Week 1: Phase 1 (expand)
Week 2: Phase 2 (dual write) + deploy
Week 3: Monitor, verify data
Week 4: Phase 3 (switch read) + deploy
Week 5: Monitor
Week 6: Phase 4 (contract) + deploy
```

---

### Кейс 5: Legacy Code Refactoring

**Задача:**

```
Унаследовал проект:
- 1 файл 5000 строк (God Class)
- Нет тестов
- Нет документации
- Production работает, но нужно добавить новую функцию

С чего начать?
```

**Решение:**

**1. Понять что делает код:**

```
- Запустить локально
- Протестировать вручную основные сценарии
- Нарисовать диаграмму flow
- Найти entry points
```

**2. Добавить тесты (Characterization Tests):**

```php
// Тесты для существующего поведения
public function test_user_can_login()
{
    $response = $this->post('/login', [
        'email' => 'test@example.com',
        'password' => 'password'
    ]);

    $response->assertRedirect('/dashboard');
}

// Покрыть тестами критичные пути
// - Регистрация
// - Логин
// - Checkout
// - etc
```

**3. Рефакторинг постепенно:**

```php
// Было: 1 класс 5000 строк
class LegacyController
{
    public function checkout() { /* 500 строк */ }
    public function processPayment() { /* 300 строк */ }
    // ...
}

// Шаг 1: Extract Method
class LegacyController
{
    public function checkout()
    {
        $this->validateCart();
        $this->calculateTotal();
        $this->processPayment();
        $this->sendEmail();
    }

    private function validateCart() { /* ... */ }
    private function calculateTotal() { /* ... */ }
}

// Шаг 2: Extract Class
class CheckoutService
{
    public function process() { /* ... */ }
}

class LegacyController
{
    public function checkout()
    {
        (new CheckoutService())->process();
    }
}

// Шаг 3: Dependency Injection
class LegacyController
{
    public function __construct(
        private CheckoutService $checkout
    ) {}

    public function checkout()
    {
        $this->checkout->process();
    }
}
```

**4. Strangler Fig Pattern:**

```
Новый код живёт рядом со старым:

routes/legacy.php (старые роуты)
routes/api.php (новые роуты)

Постепенно мигрировать пользователей:
- 10% → новая версия
- 50% → новая версия
- 100% → новая версия

Когда все на новой версии: удалить legacy код
```

---

## На собеседовании скажешь

> "Real-world cases: Flash sale — Redis atomic ops, queue для checkout, rate limiting, horizontal scaling. Feed — push model (pre-compute), hybrid для celebrities, кеш. Payment timeout — асинхронно через queue, webhooks, idempotency keys. Zero-downtime migration — Expand-Contract pattern (добавить колонку → dual write → switch read → удалить старую). Legacy refactoring — characterization tests, постепенный рефакторинг (Extract Method → Extract Class → DI), Strangler Fig pattern."

