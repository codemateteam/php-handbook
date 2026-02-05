# 9.7 Materialized Views

> **TL;DR:** Materialized View — результат запроса, физически сохранённый на диске. REFRESH MATERIALIZED VIEW для обновления, CONCURRENTLY не блокирует SELECT. Use cases: dashboard statistics, complex aggregations, reporting. Laravel: создавать через DB::statement, refresh через Scheduler. MySQL не поддерживает — workaround через таблицу + scheduled job.

## Содержание

- [Что это](#что-это)
- [Создание Materialized View](#создание-materialized-view)
- [Refresh Materialized View](#refresh-materialized-view)
- [Автоматический Refresh](#автоматический-refresh)
- [Use Cases](#use-cases)
- [Incremental Update](#incremental-update-postgresql-13)
- [Triggers для Refresh](#triggers-для-refresh)
- [MySQL](#mysql)
- [Best Practices](#best-practices)
- [Альтернативы](#альтернативы)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Materialized View:**
Результат запроса, сохранённый как таблица. Данные физически хранятся на диске.

**View vs Materialized View:**
- **View** (обычная): виртуальная, запрос выполняется каждый раз
- **Materialized View**: физическая, данные закешированы

**Зачем:**
- Ускорить сложные запросы (aggregations, joins)
- Pre-compute expensive операции
- Отчёты и аналитика

**Trade-off:**
- ✅ Быстрые SELECT
- ❌ Данные могут быть устаревшими (нужен REFRESH)
- ❌ Занимают место на диске

---

## Создание Materialized View

**PostgreSQL:**

```sql
CREATE MATERIALIZED VIEW product_stats AS
SELECT
    category_id,
    COUNT(*) as products_count,
    AVG(price) as avg_price,
    SUM(stock) as total_stock
FROM products
GROUP BY category_id;

-- Создать индекс
CREATE INDEX ON product_stats(category_id);
```

**Laravel Migration:**

```php
Schema::create('product_stats', function (Blueprint $table) {
    DB::statement("
        CREATE MATERIALIZED VIEW product_stats AS
        SELECT
            category_id,
            COUNT(*) as products_count,
            AVG(price) as avg_price,
            SUM(stock) as total_stock
        FROM products
        GROUP BY category_id
    ");

    DB::statement("CREATE INDEX ON product_stats(category_id)");
});
```

---

## Refresh Materialized View

**Manual Refresh:**

```sql
REFRESH MATERIALIZED VIEW product_stats;
```

**Concurrent Refresh (не блокирует SELECT):**

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats;
-- Требует UNIQUE индекс
```

**Laravel:**

```php
// В команде или job
DB::statement('REFRESH MATERIALIZED VIEW product_stats');

// Concurrent
DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats');
```

---

## Автоматический Refresh

**Laravel Scheduler:**

```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Обновлять каждый час
    $schedule->call(function () {
        DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats');
    })->hourly();

    // Или каждую ночь
    $schedule->command('app:refresh-materialized-views')->daily();
}
```

**Artisan команда:**

```php
// app/Console/Commands/RefreshMaterializedViews.php
class RefreshMaterializedViews extends Command
{
    protected $signature = 'app:refresh-materialized-views';

    public function handle()
    {
        $views = [
            'product_stats',
            'user_analytics',
            'sales_summary',
        ];

        foreach ($views as $view) {
            $this->info("Refreshing {$view}...");

            DB::statement("REFRESH MATERIALIZED VIEW CONCURRENTLY {$view}");

            $this->info("✓ {$view} refreshed");
        }
    }
}
```

---

## Use Cases

### 1. Dashboard Statistics

**Проблема: медленный запрос**

```sql
-- Каждый раз считает (медленно)
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users,
    COUNT(CASE WHEN last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_users,
    AVG(orders_count) as avg_orders
FROM users;
```

**Решение: Materialized View**

```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users,
    COUNT(CASE WHEN last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_users,
    AVG(orders_count) as avg_orders
FROM users;

-- Refresh каждый час
```

**Laravel:**

```php
class DashboardController extends Controller
{
    public function index()
    {
        // Быстро (данные уже посчитаны)
        $stats = DB::table('dashboard_stats')->first();

        return view('dashboard', compact('stats'));
    }
}
```

---

### 2. Product Search с агрегациями

**Проблема:**

```sql
-- Медленно: JOIN + GROUP BY + COUNT
SELECT
    products.*,
    categories.name as category_name,
    AVG(reviews.rating) as avg_rating,
    COUNT(reviews.id) as reviews_count
FROM products
LEFT JOIN categories ON products.category_id = categories.id
LEFT JOIN reviews ON products.id = reviews.product_id
GROUP BY products.id, categories.name;
```

**Решение:**

```sql
CREATE MATERIALIZED VIEW products_with_stats AS
SELECT
    products.id,
    products.name,
    products.price,
    products.stock,
    categories.name as category_name,
    COALESCE(AVG(reviews.rating), 0) as avg_rating,
    COUNT(reviews.id) as reviews_count
FROM products
LEFT JOIN categories ON products.category_id = categories.id
LEFT JOIN reviews ON products.id = reviews.product_id
GROUP BY products.id, categories.name;

CREATE INDEX ON products_with_stats(category_name);
CREATE INDEX ON products_with_stats(avg_rating DESC);
```

**Laravel Model:**

```php
// app/Models/ProductWithStats.php
class ProductWithStats extends Model
{
    protected $table = 'products_with_stats';
    public $timestamps = false;

    // Read-only
    public function save(array $options = [])
    {
        throw new Exception('Materialized view is read-only');
    }
}

// Использование
$products = ProductWithStats::where('category_name', 'Electronics')
    ->where('avg_rating', '>=', 4.0)
    ->orderBy('avg_rating', 'desc')
    ->paginate(20);
```

---

### 3. Reporting / Analytics

**Monthly Sales Report:**

```sql
CREATE MATERIALIZED VIEW monthly_sales AS
SELECT
    DATE_TRUNC('month', created_at) as month,
    user_id,
    users.name as user_name,
    COUNT(*) as orders_count,
    SUM(total) as total_revenue,
    AVG(total) as avg_order_value
FROM orders
JOIN users ON orders.user_id = users.id
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), user_id, users.name;

CREATE INDEX ON monthly_sales(month);
CREATE INDEX ON monthly_sales(user_id);
```

**Laravel:**

```php
class ReportsController extends Controller
{
    public function monthlySales()
    {
        $sales = DB::table('monthly_sales')
            ->whereBetween('month', [now()->subYear(), now()])
            ->orderBy('month', 'desc')
            ->get();

        return view('reports.monthly-sales', compact('sales'));
    }
}
```

---

### 4. Leaderboard (топы)

```sql
CREATE MATERIALIZED VIEW user_leaderboard AS
SELECT
    users.id,
    users.name,
    COUNT(orders.id) as orders_count,
    SUM(orders.total) as total_spent,
    ROW_NUMBER() OVER (ORDER BY SUM(orders.total) DESC) as rank
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id, users.name
ORDER BY total_spent DESC
LIMIT 100;

-- Refresh ежедневно
```

---

## Incremental Update (PostgreSQL 13+)

**Проблема:**
REFRESH MATERIALIZED VIEW пересчитывает ВСЕ данные.

**Решение: Incremental Materialized View**

```sql
-- Требует: primary key или unique index
CREATE MATERIALIZED VIEW product_stats AS
SELECT
    category_id,
    COUNT(*) as products_count,
    AVG(price) as avg_price
FROM products
GROUP BY category_id;

CREATE UNIQUE INDEX ON product_stats(category_id);

-- Теперь можно incremental refresh (только изменённые данные)
REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats;
```

---

## Triggers для Refresh

**Auto-refresh при изменении данных:**

```sql
-- Function для refresh
CREATE OR REPLACE FUNCTION refresh_product_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger на INSERT/UPDATE/DELETE
CREATE TRIGGER trigger_refresh_product_stats
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_product_stats();
```

**Проблема:**
- ❌ REFRESH после КАЖДОГО изменения (медленно)
- ❌ Может блокировать

**Лучше:**
- ✅ Scheduled refresh (hourly/daily)
- ✅ Manual refresh через job после bulk операций

---

## MySQL

**MySQL НЕ поддерживает Materialized Views!**

**Workaround: обычная таблица + scheduled update**

```php
// Migration: обычная таблица
Schema::create('product_stats', function (Blueprint $table) {
    $table->unsignedBigInteger('category_id')->primary();
    $table->integer('products_count');
    $table->decimal('avg_price');
    $table->timestamp('updated_at');
});

// Command для refresh
class RefreshProductStats extends Command
{
    public function handle()
    {
        DB::table('product_stats')->truncate();

        DB::table('product_stats')->insert(
            DB::table('products')
                ->select([
                    'category_id',
                    DB::raw('COUNT(*) as products_count'),
                    DB::raw('AVG(price) as avg_price'),
                    DB::raw('NOW() as updated_at'),
                ])
                ->groupBy('category_id')
                ->get()
                ->toArray()
        );
    }
}

// Scheduler
$schedule->command('app:refresh-product-stats')->hourly();
```

---

## Best Practices

```
✓ REFRESH CONCURRENTLY с UNIQUE индексом (не блокирует SELECT)
✓ Scheduler для автоматического refresh (hourly/daily)
✓ Индексы на Materialized View для быстрых запросов
✓ Используй для read-heavy aggregate запросов
✓ НЕ используй если данные должны быть real-time
✓ Мониторь размер (могут занимать много места)
✓ Используй для отчётов, dashboards, leaderboards
✓ В MySQL: workaround через обычную таблицу + scheduled job
```

---

## Альтернативы

**Когда НЕ использовать Materialized View:**

### 1. Real-time данные → Cache

```php
// Вместо Materialized View
Cache::remember('dashboard_stats', 3600, function () {
    return DB::table('users')->select([...])->first();
});
```

### 2. Частые изменения → Query Optimization

```sql
-- Вместо Materialized View: добавить индексы
CREATE INDEX ON products(category_id, price);
```

### 3. Simple queries → Обычная View

```sql
-- Если запрос быстрый, достаточно обычной View
CREATE VIEW active_users AS
SELECT * FROM users WHERE is_active = true;
```

---

## Практические задания

### Задание 1: Dashboard Statistics Materialized View

**Задача:** Создать materialized view для дашборда с автоматическим обновлением.

<details>
<summary>Решение</summary>

```php
// database/migrations/xxxx_create_dashboard_stats_view.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::statement("
            CREATE MATERIALIZED VIEW dashboard_stats AS
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d,
                (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '7 days') as active_users_7d,
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT SUM(total) FROM orders WHERE status = 'completed') as total_revenue,
                (SELECT AVG(total) FROM orders WHERE status = 'completed') as avg_order_value,
                NOW() as updated_at
        ");

        // Создаём уникальный индекс (для CONCURRENTLY)
        DB::statement("CREATE UNIQUE INDEX ON dashboard_stats (updated_at)");
    }

    public function down()
    {
        DB::statement("DROP MATERIALIZED VIEW IF EXISTS dashboard_stats");
    }
};

// app/Console/Commands/RefreshDashboardStats.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefreshDashboardStats extends Command
{
    protected $signature = 'stats:refresh-dashboard';
    protected $description = 'Refresh dashboard materialized view';

    public function handle()
    {
        $this->info('Refreshing dashboard stats...');

        $start = microtime(true);

        DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats');

        $duration = round((microtime(true) - $start) * 1000, 2);

        $this->info("✓ Dashboard stats refreshed in {$duration}ms");
    }
}

// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Обновлять каждые 15 минут
    $schedule->command('stats:refresh-dashboard')->everyFifteenMinutes();
}

// app/Http/Controllers/DashboardController.php
class DashboardController extends Controller
{
    public function index()
    {
        // Быстро! Данные уже посчитаны
        $stats = DB::table('dashboard_stats')->first();

        return response()->json([
            'stats' => $stats,
            'updated_at' => $stats->updated_at,
        ]);
    }
}
```

</details>

### Задание 2: Product Rankings with Materialized View

**Задача:** Создать топ продуктов по продажам с периодическим обновлением.

<details>
<summary>Решение</summary>

```php
// Migration
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::statement("
            CREATE MATERIALIZED VIEW product_rankings AS
            SELECT
                p.id,
                p.name,
                p.category_id,
                c.name as category_name,
                COUNT(oi.id) as orders_count,
                SUM(oi.quantity) as units_sold,
                SUM(oi.price * oi.quantity) as total_revenue,
                AVG(r.rating) as avg_rating,
                COUNT(r.id) as reviews_count,
                ROW_NUMBER() OVER (ORDER BY SUM(oi.price * oi.quantity) DESC) as overall_rank,
                ROW_NUMBER() OVER (
                    PARTITION BY p.category_id
                    ORDER BY SUM(oi.price * oi.quantity) DESC
                ) as category_rank
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN order_items oi ON p.id = oi.product_id
            LEFT JOIN reviews r ON p.id = r.product_id
            GROUP BY p.id, p.name, p.category_id, c.name
        ");

        // Индексы для быстрых запросов
        DB::statement("CREATE UNIQUE INDEX ON product_rankings (id)");
        DB::statement("CREATE INDEX ON product_rankings (category_id)");
        DB::statement("CREATE INDEX ON product_rankings (overall_rank)");
        DB::statement("CREATE INDEX ON product_rankings (category_rank)");
    }

    public function down()
    {
        DB::statement("DROP MATERIALIZED VIEW IF EXISTS product_rankings");
    }
};

// app/Models/ProductRanking.php (read-only model)
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductRanking extends Model
{
    protected $table = 'product_rankings';
    public $timestamps = false;

    // Read-only
    public function save(array $options = [])
    {
        throw new \Exception('ProductRanking is a read-only materialized view');
    }

    public function delete()
    {
        throw new \Exception('ProductRanking is a read-only materialized view');
    }
}

// app/Http/Controllers/ProductRankingController.php
class ProductRankingController extends Controller
{
    public function topProducts(Request $request)
    {
        $limit = $request->input('limit', 10);

        $products = ProductRanking::orderBy('overall_rank')
            ->limit($limit)
            ->get();

        return response()->json($products);
    }

    public function topByCategory(Request $request, $categoryId)
    {
        $limit = $request->input('limit', 10);

        $products = ProductRanking::where('category_id', $categoryId)
            ->orderBy('category_rank')
            ->limit($limit)
            ->get();

        return response()->json($products);
    }
}

// app/Console/Commands/RefreshProductRankings.php
class RefreshProductRankings extends Command
{
    protected $signature = 'stats:refresh-products';

    public function handle()
    {
        $this->info('Refreshing product rankings...');

        DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY product_rankings');

        $this->info('✓ Product rankings refreshed');
    }
}

// Scheduler: обновлять каждый час
$schedule->command('stats:refresh-products')->hourly();
```

</details>

### Задание 3: MySQL Alternative (без Materialized Views)

**Задача:** Реализовать аналог materialized view для MySQL.

<details>
<summary>Решение</summary>

```php
// Migration (обычная таблица вместо materialized view)
Schema::create('dashboard_stats_cache', function (Blueprint $table) {
    $table->id();
    $table->integer('total_users');
    $table->integer('new_users_30d');
    $table->integer('active_users_7d');
    $table->integer('total_orders');
    $table->decimal('total_revenue', 15, 2);
    $table->decimal('avg_order_value', 10, 2);
    $table->timestamp('updated_at');
});

// app/Services/DashboardStatsService.php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class DashboardStatsService
{
    public function refresh(): void
    {
        $stats = $this->calculateStats();

        // Truncate и insert (для MySQL)
        DB::table('dashboard_stats_cache')->truncate();
        DB::table('dashboard_stats_cache')->insert($stats);
    }

    private function calculateStats(): array
    {
        return [
            'total_users' => DB::table('users')->count(),
            'new_users_30d' => DB::table('users')
                ->where('created_at', '>', now()->subDays(30))
                ->count(),
            'active_users_7d' => DB::table('users')
                ->where('last_login', '>', now()->subDays(7))
                ->count(),
            'total_orders' => DB::table('orders')->count(),
            'total_revenue' => DB::table('orders')
                ->where('status', 'completed')
                ->sum('total') ?? 0,
            'avg_order_value' => DB::table('orders')
                ->where('status', 'completed')
                ->avg('total') ?? 0,
            'updated_at' => now(),
        ];
    }

    public function get(): ?object
    {
        return DB::table('dashboard_stats_cache')->first();
    }
}

// app/Console/Commands/RefreshDashboardStatsMySQL.php
class RefreshDashboardStatsMySQL extends Command
{
    protected $signature = 'stats:refresh-dashboard';

    public function __construct(
        private DashboardStatsService $statsService
    ) {
        parent::__construct();
    }

    public function handle()
    {
        $this->info('Refreshing dashboard stats...');

        $start = microtime(true);

        $this->statsService->refresh();

        $duration = round((microtime(true) - $start) * 1000, 2);

        $this->info("✓ Dashboard stats refreshed in {$duration}ms");
    }
}

// app/Http/Controllers/DashboardController.php
class DashboardController extends Controller
{
    public function __construct(
        private DashboardStatsService $statsService
    ) {}

    public function index()
    {
        $stats = $this->statsService->get();

        if (!$stats) {
            // Первый раз - вычислить и закешировать
            $this->statsService->refresh();
            $stats = $this->statsService->get();
        }

        return response()->json([
            'stats' => $stats,
            'updated_at' => $stats->updated_at,
        ]);
    }
}

// Scheduler
$schedule->command('stats:refresh-dashboard')->everyFifteenMinutes();
```

</details>

---

## На собеседовании скажешь

> "Materialized View — результат запроса, физически сохранённый на диске. Отличие от обычной View: данные закешированы, не пересчитываются каждый раз. REFRESH MATERIALIZED VIEW для обновления, CONCURRENTLY не блокирует SELECT (требует UNIQUE индекс). Use cases: dashboard statistics, complex aggregations, reporting, leaderboards. Laravel: создавать через DB::statement в migration, refresh через Scheduler (hourly/daily). MySQL не поддерживает — workaround через таблицу + scheduled job. Best practices: CONCURRENTLY, индексы, scheduled refresh, для read-heavy запросов. Альтернативы: Cache для real-time, индексы для simple queries."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
