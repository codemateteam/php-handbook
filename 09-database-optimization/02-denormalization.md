# 9.2 Денормализация

> **TL;DR**
> Денормализация добавляет избыточность для ускорения чтения. Типы: дублирование колонок (избежать JOIN), counter cache (pre-computed агрегации), summary tables, JSONB. Trade-off: быстрее SELECT, медленнее UPDATE, риск inconsistency. Решения: Observers для автосинхронизации, scheduled jobs для проверки. Используй для read-heavy workload, избегай для write-heavy.

## Содержание

- [Что это](#что-это)
- [Типы денормализации](#типы-денормализации)
  - [1. Дублирование колонок](#1-дублирование-колонок)
  - [2. Pre-computed агрегации](#2-pre-computed-агрегации)
  - [3. Сводные таблицы (summary tables)](#3-сводные-таблицы-summary-tables)
  - [4. Materialized Views](#4-materialized-views)
  - [5. JSONB для flexible fields](#5-jsonb-для-flexible-fields)
- [Практические примеры](#практические-примеры)
- [Риски денормализации](#риски-денормализации)
- [Когда денормализовать](#когда-денормализовать)
- [Когда НЕ денормализовать](#когда-не-денормализовать)
- [Best Practices](#best-practices)
- [Проверка consistency](#проверка-consistency)
- [Практические задания](#практические-задания)

## Что это

**Денормализация:**
Намеренное добавление избыточности в нормализованную БД для улучшения производительности чтения.

**Зачем:**
- Уменьшить JOIN'ы (быстрее SELECT)
- Pre-compute агрегации
- Снизить нагрузку на БД

**Trade-off:**
- ✅ Быстрее SELECT
- ❌ Медленнее INSERT/UPDATE
- ❌ Риск inconsistency (нужна синхронизация)

---

## Типы денормализации

### 1. Дублирование колонок

**Проблема: JOIN на каждый запрос**

```php
// Normalized (3NF)
$orders = Order::with('customer')->get();

foreach ($orders as $order) {
    echo $order->customer->name;  // JOIN каждый раз
}
```

**Решение: дублировать customer_name**

```php
// Migration
Schema::table('orders', function (Blueprint $table) {
    $table->string('customer_name')->after('customer_id');
});

// При создании заказа
Order::create([
    'customer_id' => $customer->id,
    'customer_name' => $customer->name,  // дублирование
    'total' => 100,
]);

// Запрос БЕЗ JOIN
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->customer_name;  // нет JOIN!
}
```

**Синхронизация при изменении:**

```php
class Customer extends Model
{
    protected static function booted()
    {
        static::updated(function ($customer) {
            // Обновить customer_name во всех заказах
            Order::where('customer_id', $customer->id)
                ->update(['customer_name' => $customer->name]);
        });
    }
}
```

---

### 2. Pre-computed агрегации

**Проблема: COUNT/SUM на каждый запрос**

```php
// Normalized: считать каждый раз
class User extends Model
{
    public function getOrdersCountAttribute()
    {
        return $this->orders()->count();  // SELECT COUNT(*)
    }
}
```

**Решение: хранить counter**

```php
// Migration
Schema::table('users', function (Blueprint $table) {
    $table->integer('orders_count')->default(0);
    $table->decimal('total_spent', 10, 2)->default(0);
});

// Observer для автоматического обновления
class OrderObserver
{
    public function created(Order $order)
    {
        $order->user->increment('orders_count');
        $order->user->increment('total_spent', $order->total);
    }

    public function deleted(Order $order)
    {
        $order->user->decrement('orders_count');
        $order->user->decrement('total_spent', $order->total);
    }
}

// Регистрация observer
Order::observe(OrderObserver::class);

// Использование (БЕЗ запроса)
$user = User::find(1);
echo $user->orders_count;  // нет SELECT COUNT(*)!
echo $user->total_spent;
```

---

### 3. Сводные таблицы (summary tables)

**Проблема: сложные агрегации**

```sql
-- Каждый раз считать (медленно)
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as orders_count,
    SUM(total) as revenue
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at);
```

**Решение: summary table**

```php
// Migration
Schema::create('daily_stats', function (Blueprint $table) {
    $table->date('date')->primary();
    $table->integer('orders_count')->default(0);
    $table->decimal('revenue', 12, 2)->default(0);
    $table->timestamps();
});

// Job для обновления (hourly)
class UpdateDailyStats extends Command
{
    public function handle()
    {
        $today = now()->toDateString();

        $stats = Order::whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as orders_count, SUM(total) as revenue')
            ->first();

        DailyStat::updateOrCreate(
            ['date' => $today],
            [
                'orders_count' => $stats->orders_count,
                'revenue' => $stats->revenue,
            ]
        );
    }
}

// Scheduler
$schedule->command('stats:update-daily')->hourly();

// Использование (быстро!)
$stats = DailyStat::where('date', '>=', now()->subDays(30))->get();
```

---

### 4. Materialized Views

**См. тему 9.7 Materialized Views**

---

### 5. JSONB для flexible fields

**Проблема: много optional полей**

```sql
-- Normalized (много NULL)
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    color VARCHAR(50),      -- NULL для не-clothing
    size VARCHAR(10),       -- NULL для не-clothing
    cpu VARCHAR(50),        -- NULL для не-electronics
    ram VARCHAR(20),        -- NULL для не-electronics
    storage VARCHAR(50)     -- NULL для не-electronics
);
```

**Решение: JSONB**

```php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->decimal('price', 10, 2);
    $table->jsonb('attributes');  // гибкие поля
});

// Clothing
Product::create([
    'name' => 'T-Shirt',
    'attributes' => [
        'color' => 'blue',
        'size' => 'L',
        'material' => 'cotton',
    ],
]);

// Electronics
Product::create([
    'name' => 'Laptop',
    'attributes' => [
        'brand' => 'Dell',
        'cpu' => 'Intel i7',
        'ram' => '16GB',
    ],
]);
```

---

## Практические примеры

### 1. Posts с counter кэшированием

**Проблема:**

```php
// Каждый раз COUNT (медленно)
class Post extends Model
{
    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}

$posts = Post::all();
foreach ($posts as $post) {
    echo $post->comments()->count();  // N+1 queries!
}
```

**Решение:**

```php
// Migration
Schema::table('posts', function (Blueprint $table) {
    $table->integer('comments_count')->default(0);
});

// Observer
class CommentObserver
{
    public function created(Comment $comment)
    {
        $comment->post->increment('comments_count');
    }

    public function deleted(Comment $comment)
    {
        $comment->post->decrement('comments_count');
    }
}

// Использование (БЕЗ queries)
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->comments_count;  // 0 queries!
}
```

---

### 2. E-commerce: order totals

**Проблема:**

```php
// Считать total каждый раз
class Order extends Model
{
    public function getTotalAttribute()
    {
        return $this->items()->sum('price * quantity');  // SUM query
    }
}
```

**Решение:**

```php
// Migration
Schema::table('orders', function (Blueprint $table) {
    $table->decimal('total', 10, 2)->default(0);
});

// Observer
class OrderItemObserver
{
    public function created(OrderItem $item)
    {
        $this->recalculateTotal($item->order);
    }

    public function updated(OrderItem $item)
    {
        $this->recalculateTotal($item->order);
    }

    public function deleted(OrderItem $item)
    {
        $this->recalculateTotal($item->order);
    }

    private function recalculateTotal(Order $order)
    {
        $total = $order->items()
            ->selectRaw('SUM(price * quantity) as total')
            ->value('total');

        $order->update(['total' => $total ?? 0]);
    }
}

// Использование
$order = Order::find(1);
echo $order->total;  // нет SUM query!
```

---

### 3. Full-text search с денормализацией

**Проблема:**

```sql
-- Поиск по title + body + tags (JOIN + concat)
SELECT posts.*
FROM posts
LEFT JOIN tags ON posts.id = tags.post_id
WHERE
    posts.title ILIKE '%keyword%' OR
    posts.body ILIKE '%keyword%' OR
    tags.name ILIKE '%keyword%';
```

**Решение: search_vector**

```php
// Migration
Schema::table('posts', function (Blueprint $table) {
    $table->text('search_text');  // денормализованный поиск
    $table->index('search_text', null, 'gin');
});

// Observer
class PostObserver
{
    public function saved(Post $post)
    {
        // Объединить все searchable поля
        $searchText = implode(' ', [
            $post->title,
            $post->body,
            $post->tags->pluck('name')->implode(' '),
        ]);

        $post->updateQuietly(['search_text' => $searchText]);
    }
}

// Использование (быстрый поиск)
Post::whereRaw("search_text ILIKE ?", ["%$keyword%"])->get();
```

---

## Риски денормализации

### 1. Data Inconsistency

**Проблема:**

```php
// Если забыть обновить денормализованное поле
Order::where('customer_id', 1)->update([
    'total' => 200,
    // Забыли обновить customer.total_spent!
]);
```

**Решение: Observers**

```php
class OrderObserver
{
    public function updated(Order $order)
    {
        // Автоматически пересчитать
        if ($order->isDirty('total')) {
            $this->recalculateCustomerTotalSpent($order->customer);
        }
    }
}
```

---

### 2. Медленные WRITE операции

**Проблема:**

```php
// Каждый INSERT обновляет counter
Comment::create([...]);  // + UPDATE posts.comments_count
```

**Решение: Queue для bulk updates**

```php
// Вместо immediate update
class Comment extends Model
{
    protected static function booted()
    {
        static::created(function ($comment) {
            // Отложить обновление counter
            UpdatePostCommentsCount::dispatch($comment->post_id)->delay(60);
        });
    }
}
```

---

## Когда денормализовать

```
✓ Read-heavy workload (SELECT >> INSERT/UPDATE)
✓ Expensive JOIN'ы
✓ Сложные агрегации (COUNT, SUM)
✓ Dashboards, reports
✓ Full-text search
✓ Performance критична
```

---

## Когда НЕ денормализовать

```
❌ Write-heavy workload
❌ Strong consistency критична
❌ Данные часто изменяются
❌ Небольшая БД (нет performance проблем)
```

---

## Best Practices

```
✓ Денормализация = trade-off (скорость vs consistency)
✓ Используй Observers для автоматической синхронизации
✓ Добавляй денормализацию ПОСЛЕ профилирования (не преждевременно)
✓ Документируй денормализованные поля
✓ Scheduled jobs для проверки consistency
✓ Логируй расхождения (monitoring)
✓ Materialized Views для сложных агрегаций
```

---

## Проверка consistency

```php
// Artisan команда для проверки
class CheckCountersConsistency extends Command
{
    public function handle()
    {
        $users = User::all();

        foreach ($users as $user) {
            $actualCount = $user->orders()->count();
            $cachedCount = $user->orders_count;

            if ($actualCount !== $cachedCount) {
                $this->error("User {$user->id}: expected {$actualCount}, got {$cachedCount}");

                // Fix
                $user->update(['orders_count' => $actualCount]);
            }
        }
    }
}

// Scheduler: проверять раз в день
$schedule->command('check:counters-consistency')->daily();
```

---

## Практические задания

### Задание 1: Реализовать counter cache

Дана модель блога с постами и комментариями. Каждый раз при отображении списка постов выполняется N+1 запрос для подсчета комментариев. Оптимизируйте с помощью денормализации.

<details>
<summary>Решение</summary>

```php
// Migration: добавить counter cache
Schema::table('posts', function (Blueprint $table) {
    $table->integer('comments_count')->default(0)->after('body');
    $table->index('comments_count');
});

// Observer для автоматического обновления
class CommentObserver
{
    public function created(Comment $comment)
    {
        $comment->post->increment('comments_count');
    }

    public function deleted(Comment $comment)
    {
        $comment->post->decrement('comments_count');
    }

    public function restored(Comment $comment)
    {
        $comment->post->increment('comments_count');
    }
}

// В AppServiceProvider
public function boot()
{
    Comment::observe(CommentObserver::class);
}

// БЫЛО: N+1 запросов
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->comments()->count(); // SELECT COUNT(*)
}

// СТАЛО: 1 запрос
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->comments_count; // 0 queries!
}

// Команда для пересчета (если рассинхронизация)
class RecalculateCommentsCount extends Command
{
    protected $signature = 'posts:recalculate-comments';

    public function handle()
    {
        Post::query()->chunkById(100, function ($posts) {
            foreach ($posts as $post) {
                $count = $post->comments()->count();
                $post->update(['comments_count' => $count]);
            }
        });

        $this->info('Comments count recalculated!');
    }
}
```

**Преимущества:**
- Избежали N+1 проблему
- Быстрое отображение списка постов
- Можно сортировать по популярности
</details>

---

### Задание 2: Денормализация для избежания JOIN

Имеется таблица заказов, которая всегда отображается с именем клиента. Каждый раз выполняется JOIN. Оптимизируйте.

<details>
<summary>Решение</summary>

```php
// Migration: добавить customer_name
Schema::table('orders', function (Blueprint $table) {
    $table->string('customer_name')->after('customer_id');
    $table->index(['customer_id', 'customer_name']);
});

// Observer для синхронизации
class CustomerObserver
{
    public function updated(Customer $customer)
    {
        // Если имя изменилось, обновить все заказы
        if ($customer->isDirty('name')) {
            Order::where('customer_id', $customer->id)
                ->update(['customer_name' => $customer->name]);
        }
    }
}

// При создании заказа
class CreateOrderAction
{
    public function execute(Customer $customer, array $items)
    {
        return Order::create([
            'customer_id' => $customer->id,
            'customer_name' => $customer->name, // дублируем
            'total' => $this->calculateTotal($items),
        ]);
    }
}

// БЫЛО: JOIN на каждый запрос
$orders = Order::with('customer')->get();
foreach ($orders as $order) {
    echo $order->customer->name; // JOIN
}

// СТАЛО: без JOIN
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->customer_name; // нет JOIN!
}

// API endpoint (быстрее)
Route::get('/orders', function () {
    return Order::select('id', 'customer_name', 'total', 'created_at')
        ->latest()
        ->paginate(20);
    // Нет JOIN с customers!
});
```

**Trade-offs:**
- ✅ Быстрее SELECT (нет JOIN)
- ✅ Меньше нагрузка на БД
- ❌ Занимает больше места
- ❌ Нужна синхронизация при UPDATE customer.name
</details>

---

### Задание 3: Summary table для аналитики

Нужно построить дашборд с ежедневной статистикой продаж за последний год. Каждый раз выполнять GROUP BY по миллионам заказов слишком медленно. Оптимизируйте.

<details>
<summary>Решение</summary>

```php
// Migration: summary table
Schema::create('daily_sales_stats', function (Blueprint $table) {
    $table->date('date')->primary();
    $table->integer('orders_count')->default(0);
    $table->decimal('revenue', 12, 2)->default(0);
    $table->decimal('avg_order_value', 10, 2)->default(0);
    $table->integer('new_customers')->default(0);
    $table->timestamps();
});

// Job для обновления статистики
class UpdateDailySalesStats implements ShouldQueue
{
    public function handle()
    {
        $yesterday = now()->subDay()->toDateString();

        // Собрать статистику за вчера
        $stats = Order::whereDate('created_at', $yesterday)
            ->selectRaw('
                COUNT(*) as orders_count,
                SUM(total) as revenue,
                AVG(total) as avg_order_value
            ')
            ->first();

        $newCustomers = Customer::whereDate('created_at', $yesterday)->count();

        DailySalesStat::updateOrCreate(
            ['date' => $yesterday],
            [
                'orders_count' => $stats->orders_count ?? 0,
                'revenue' => $stats->revenue ?? 0,
                'avg_order_value' => $stats->avg_order_value ?? 0,
                'new_customers' => $newCustomers,
            ]
        );
    }
}

// Scheduler: запускать каждую ночь
protected function schedule(Schedule $schedule)
{
    $schedule->job(new UpdateDailySalesStats)->dailyAt('01:00');
}

// Controller: быстрый дашборд
class DashboardController extends Controller
{
    public function index()
    {
        // БЫЛО: медленный запрос к миллионам заказов
        // $stats = Order::where('created_at', '>=', now()->subYear())
        //     ->groupBy(DB::raw('DATE(created_at)'))
        //     ->select(...)
        //     ->get();

        // СТАЛО: быстрый запрос к summary table
        $stats = DailySalesStat::where('date', '>=', now()->subYear())
            ->orderBy('date')
            ->get();

        return view('dashboard', compact('stats'));
    }
}

// API endpoint
Route::get('/api/stats/monthly', function () {
    return DailySalesStat::selectRaw('
            DATE_TRUNC(\'month\', date) as month,
            SUM(orders_count) as total_orders,
            SUM(revenue) as total_revenue
        ')
        ->where('date', '>=', now()->subYear())
        ->groupBy('month')
        ->get();
    // Супер быстро!
});
```

**Преимущества:**
- Дашборд загружается мгновенно
- Нет нагрузки на основную таблицу orders
- Можно добавлять дополнительные метрики
- Исторические данные сохранены
</details>

---

## На собеседовании скажешь

> "Денормализация — добавление избыточности для улучшения производительности чтения. Типы: дублирование колонок (избежать JOIN), pre-computed агрегации (counter cache), summary tables, JSONB для flexible fields. Trade-off: быстрее SELECT, медленнее INSERT/UPDATE, риск inconsistency. Решение: Observers для автоматической синхронизации, scheduled jobs для проверки consistency. Когда использовать: read-heavy workload, expensive JOIN'ы, dashboards. Когда нет: write-heavy, strong consistency критична. Best practices: профилировать перед денормализацией, документировать, мониторить consistency."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
