# 9.3 Window Functions (Оконные функции)

> **TL;DR:** Window Functions выполняют вычисления на окне строк без GROUP BY. ROW_NUMBER для уникальных номеров, RANK с пропусками, PARTITION BY разделяет на группы. Running totals через SUM() OVER, moving averages через ROWS BETWEEN. LAG/LEAD для предыдущей/следующей строки. Use cases: топы, накопительные суммы, deduplicate.

## Содержание

- [Что это](#что-это)
- [Синтаксис](#синтаксис)
- [ROW_NUMBER, RANK, DENSE_RANK](#row_number-rank-dense_rank)
  - [ROW_NUMBER](#row_number)
  - [RANK](#rank)
  - [DENSE_RANK](#dense_rank)
- [PARTITION BY](#partition-by)
- [Running Totals](#running-totals-накопительная-сумма)
- [Moving Average](#moving-average-скользящее-среднее)
- [LAG и LEAD](#lag-и-lead)
- [FIRST_VALUE и LAST_VALUE](#first_value-и-last_value)
- [NTILE](#ntile-разделить-на-n-групп)
- [Практические примеры](#практические-примеры)
- [Frame Clause](#frame-clause)
- [Performance](#performance)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Window Functions:**
Функции SQL которые выполняют вычисления на наборе строк (окне), связанных с текущей строкой, не группируя результат.

**Отличие от GROUP BY:**
- **GROUP BY** сворачивает строки в одну
- **Window Functions** сохраняют все строки и добавляют вычисленные колонки

**Зачем:**
- Ranking (топы, рейтинги)
- Running totals (накопительные суммы)
- Moving averages
- Row numbering
- Lag/Lead (сравнение с предыдущей/следующей строкой)

---

## Синтаксис

```sql
function_name([args]) OVER (
    [PARTITION BY column]
    [ORDER BY column]
    [ROWS/RANGE frame_clause]
)
```

**Компоненты:**
- **PARTITION BY** — разделить на группы (как GROUP BY, но не сворачивает)
- **ORDER BY** — порядок внутри окна
- **ROWS/RANGE** — рамка окна (по умолчанию: от начала до текущей строки)

---

## ROW_NUMBER, RANK, DENSE_RANK

### ROW_NUMBER()

**Уникальный номер для каждой строки:**

```sql
SELECT
    name,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) as row_num
FROM employees;

-- name       salary  row_num
-- Alice      5000    1
-- Bob        4000    2
-- Charlie    4000    3  ← уникальный номер, даже если salary одинаковый
-- David      3000    4
```

---

### RANK()

**Ранг с пропусками при одинаковых значениях:**

```sql
SELECT
    name,
    salary,
    RANK() OVER (ORDER BY salary DESC) as rank
FROM employees;

-- name       salary  rank
-- Alice      5000    1
-- Bob        4000    2
-- Charlie    4000    2  ← тот же ранг
-- David      3000    4  ← пропуск (3 отсутствует)
```

---

### DENSE_RANK()

**Ранг без пропусков:**

```sql
SELECT
    name,
    salary,
    DENSE_RANK() OVER (ORDER BY salary DESC) as dense_rank
FROM employees;

-- name       salary  dense_rank
-- Alice      5000    1
-- Bob        4000    2
-- Charlie    4000    2  ← тот же ранг
-- David      3000    3  ← нет пропуска
```

---

## PARTITION BY

**Отдельное окно для каждой группы:**

```sql
-- Топ 3 зарплаты в каждом департаменте
SELECT
    department,
    name,
    salary,
    ROW_NUMBER() OVER (
        PARTITION BY department
        ORDER BY salary DESC
    ) as rank_in_dept
FROM employees;

-- department  name     salary  rank_in_dept
-- Sales       Alice    5000    1
-- Sales       Bob      4000    2
-- Sales       Charlie  3000    3
-- IT          David    6000    1
-- IT          Eve      5500    2
-- IT          Frank    5000    3
```

**Laravel Eloquent:**

```php
// Топ 3 товара в каждой категории
DB::table('products')
    ->select([
        'category_id',
        'name',
        'price',
        DB::raw('ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC) as rank')
    ])
    ->get()
    ->filter(fn($p) => $p->rank <= 3);
```

---

## Running Totals (Накопительная сумма)

```sql
SELECT
    date,
    revenue,
    SUM(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as running_total
FROM daily_sales
ORDER BY date;

-- date        revenue  running_total
-- 2024-01-01  100      100
-- 2024-01-02  150      250  ← 100 + 150
-- 2024-01-03  200      450  ← 100 + 150 + 200
-- 2024-01-04  120      570  ← 100 + 150 + 200 + 120
```

**Короткая форма:**

```sql
SUM(revenue) OVER (ORDER BY date)
-- По умолчанию: от начала до текущей строки
```

**Laravel:**

```php
DB::table('daily_sales')
    ->select([
        'date',
        'revenue',
        DB::raw('SUM(revenue) OVER (ORDER BY date) as running_total')
    ])
    ->orderBy('date')
    ->get();
```

---

## Moving Average (Скользящее среднее)

**Среднее за последние 3 дня:**

```sql
SELECT
    date,
    price,
    AVG(price) OVER (
        ORDER BY date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3days
FROM stock_prices
ORDER BY date;

-- date        price  moving_avg_3days
-- 2024-01-01  100    100           ← avg(100)
-- 2024-01-02  110    105           ← avg(100, 110)
-- 2024-01-03  120    110           ← avg(100, 110, 120)
-- 2024-01-04  130    120           ← avg(110, 120, 130)
-- 2024-01-05  140    130           ← avg(120, 130, 140)
```

---

## LAG и LEAD

### LAG (предыдущая строка)

```sql
SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) as prev_day_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY date) as change
FROM daily_sales
ORDER BY date;

-- date        revenue  prev_day  change
-- 2024-01-01  100      NULL      NULL
-- 2024-01-02  150      100       50   ← 150 - 100
-- 2024-01-03  120      150       -30  ← 120 - 150
```

---

### LEAD (следующая строка)

```sql
SELECT
    date,
    revenue,
    LEAD(revenue, 1) OVER (ORDER BY date) as next_day_revenue
FROM daily_sales
ORDER BY date;

-- date        revenue  next_day
-- 2024-01-01  100      150
-- 2024-01-02  150      120
-- 2024-01-03  120      NULL
```

---

## FIRST_VALUE и LAST_VALUE

```sql
SELECT
    department,
    name,
    salary,
    FIRST_VALUE(name) OVER (
        PARTITION BY department
        ORDER BY salary DESC
    ) as highest_paid,
    LAST_VALUE(name) OVER (
        PARTITION BY department
        ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as lowest_paid
FROM employees;

-- department  name    salary  highest_paid  lowest_paid
-- Sales       Alice   5000    Alice         Charlie
-- Sales       Bob     4000    Alice         Charlie
-- Sales       Charlie 3000    Alice         Charlie
```

---

## NTILE (разделить на N групп)

```sql
-- Разделить пользователей на 4 группы (квартили) по активности
SELECT
    user_id,
    activity_score,
    NTILE(4) OVER (ORDER BY activity_score DESC) as quartile
FROM users;

-- user_id  activity_score  quartile
-- 101      1000            1  ← top 25%
-- 102      900             1
-- 103      800             2
-- 104      700             2
-- 105      600             3
-- 106      500             3
-- 107      400             4  ← bottom 25%
-- 108      300             4
```

**Use case:** A/B testing, сегментация пользователей.

---

## Практические примеры

### 1. Топ 5 товаров в каждой категории

```sql
WITH ranked_products AS (
    SELECT
        category_id,
        product_id,
        name,
        sales,
        ROW_NUMBER() OVER (
            PARTITION BY category_id
            ORDER BY sales DESC
        ) as rank
    FROM products
)
SELECT *
FROM ranked_products
WHERE rank <= 5;
```

**Laravel:**

```php
DB::table(DB::raw('(
    SELECT
        category_id,
        product_id,
        name,
        sales,
        ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY sales DESC) as rank
    FROM products
) as ranked'))
->where('rank', '<=', 5)
->get();
```

---

### 2. Процент от total

```sql
SELECT
    product_id,
    sales,
    ROUND(sales * 100.0 / SUM(sales) OVER (), 2) as percent_of_total
FROM products;

-- product_id  sales  percent_of_total
-- 1           100    10.00%
-- 2           200    20.00%
-- 3           300    30.00%
-- 4           400    40.00%
-- Total: 1000
```

---

### 3. Найти gaps (пропуски)

```sql
-- Найти пропущенные даты
WITH dates AS (
    SELECT
        date,
        LEAD(date) OVER (ORDER BY date) as next_date
    FROM sales
)
SELECT
    date as missing_after,
    next_date as next_available
FROM dates
WHERE next_date - date > INTERVAL '1 day';
```

---

### 4. Deduplicate (удалить дубликаты)

```sql
-- Оставить только последнюю запись для каждого user
WITH ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY created_at DESC
        ) as rn
    FROM user_actions
)
SELECT *
FROM ranked
WHERE rn = 1;
```

**Laravel:**

```php
DB::table(DB::raw('(
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM user_actions
) as ranked'))
->where('rn', 1)
->get();
```

---

### 5. Сравнение с прошлым периодом

```sql
SELECT
    month,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY month) as prev_month,
    ROUND(
        (revenue - LAG(revenue, 1) OVER (ORDER BY month)) * 100.0 /
        LAG(revenue, 1) OVER (ORDER BY month),
        2
    ) as growth_percent
FROM monthly_revenue
ORDER BY month;

-- month     revenue  prev_month  growth_percent
-- 2024-01   1000     NULL        NULL
-- 2024-02   1200     1000        20.00%
-- 2024-03   1100     1200        -8.33%
```

---

## Frame Clause

**ROWS vs RANGE:**

```sql
-- ROWS: физические строки
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW

-- RANGE: логический диапазон (по значению)
RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW
```

**Примеры frame:**

```sql
-- От начала до текущей строки (по умолчанию)
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW

-- Последние 3 строки
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW

-- Текущая и следующие 2
ROWS BETWEEN CURRENT ROW AND 2 FOLLOWING

-- Все строки в partition
ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
```

---

## Performance

**Индексы:**

```sql
-- Window function использует ORDER BY
-- Нужен индекс на сортируемую колонку
CREATE INDEX idx_sales_date ON sales(date);

-- С PARTITION BY нужен composite index
CREATE INDEX idx_products_category_sales ON products(category_id, sales DESC);
```

**Materialized View для сложных window queries:**

```sql
CREATE MATERIALIZED VIEW product_rankings AS
SELECT
    category_id,
    product_id,
    sales,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY sales DESC) as rank
FROM products;

CREATE INDEX ON product_rankings(category_id, rank);

-- Обновлять периодически
REFRESH MATERIALIZED VIEW product_rankings;
```

---

## Практические задания

### Задание 1: Топ продуктов в каждой категории

**Задача:** Получить топ 3 самых дорогих продукта в каждой категории.

<details>
<summary>Решение</summary>

```php
// SQL решение
$topProducts = DB::select("
    WITH ranked_products AS (
        SELECT
            p.id,
            p.name,
            p.price,
            c.name as category_name,
            ROW_NUMBER() OVER (
                PARTITION BY p.category_id
                ORDER BY p.price DESC
            ) as rank
        FROM products p
        JOIN categories c ON p.category_id = c.id
    )
    SELECT *
    FROM ranked_products
    WHERE rank <= 3
    ORDER BY category_name, rank
");

// Laravel Eloquent (через subquery)
$products = DB::table(DB::raw('(
    SELECT
        products.*,
        categories.name as category_name,
        ROW_NUMBER() OVER (
            PARTITION BY products.category_id
            ORDER BY products.price DESC
        ) as rank
    FROM products
    JOIN categories ON products.category_id = categories.id
) as ranked'))
->where('rank', '<=', 3)
->orderBy('category_name')
->orderBy('rank')
->get();

// Группировка по категориям
$grouped = collect($products)->groupBy('category_name');

foreach ($grouped as $category => $items) {
    echo "Category: {$category}\n";
    foreach ($items as $product) {
        echo "  {$product->rank}. {$product->name} - \${$product->price}\n";
    }
}
```

</details>

### Задание 2: Накопительная сумма продаж

**Задача:** Рассчитать накопительную сумму продаж по дням и процент от общей суммы.

<details>
<summary>Решение</summary>

```php
// SQL с running total и процентом
$salesReport = DB::select("
    SELECT
        date,
        daily_revenue,
        SUM(daily_revenue) OVER (
            ORDER BY date
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_total,
        ROUND(
            daily_revenue * 100.0 / SUM(daily_revenue) OVER (),
            2
        ) as percent_of_total
    FROM (
        SELECT
            DATE(created_at) as date,
            SUM(total) as daily_revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
    ) daily_sales
    ORDER BY date
");

// Laravel Query Builder
$report = DB::table(DB::raw('(
    SELECT
        DATE(created_at) as date,
        SUM(total) as daily_revenue
    FROM orders
    WHERE created_at >= NOW() - INTERVAL \'30 days\'
    GROUP BY DATE(created_at)
) as daily_sales'))
->selectRaw("
    date,
    daily_revenue,
    SUM(daily_revenue) OVER (ORDER BY date) as running_total,
    ROUND(daily_revenue * 100.0 / SUM(daily_revenue) OVER (), 2) as percent_of_total
")
->orderBy('date')
->get();

// Форматирование для отчета
foreach ($report as $row) {
    echo sprintf(
        "%s: $%s (Running: $%s, %s%%)\n",
        $row->date,
        number_format($row->daily_revenue, 2),
        number_format($row->running_total, 2),
        $row->percent_of_total
    );
}
```

</details>

### Задание 3: Сравнение с предыдущим периодом (MoM Growth)

**Задача:** Рассчитать месячный рост выручки (Month-over-Month growth).

<details>
<summary>Решение</summary>

```php
// SQL с LAG для сравнения с предыдущим месяцем
$monthlyGrowth = DB::select("
    SELECT
        month,
        revenue,
        LAG(revenue, 1) OVER (ORDER BY month) as prev_month_revenue,
        revenue - LAG(revenue, 1) OVER (ORDER BY month) as revenue_change,
        CASE
            WHEN LAG(revenue, 1) OVER (ORDER BY month) IS NULL THEN NULL
            ELSE ROUND(
                (revenue - LAG(revenue, 1) OVER (ORDER BY month)) * 100.0 /
                LAG(revenue, 1) OVER (ORDER BY month),
                2
            )
        END as growth_percent
    FROM (
        SELECT
            DATE_TRUNC('month', created_at) as month,
            SUM(total) as revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
    ) monthly_revenue
    ORDER BY month
");

// Artisan Command для отчета
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MonthlyGrowthReport extends Command
{
    protected $signature = 'report:monthly-growth';

    public function handle()
    {
        $data = DB::select("
            SELECT
                TO_CHAR(month, 'YYYY-MM') as month,
                revenue,
                LAG(revenue, 1) OVER (ORDER BY month) as prev_month,
                ROUND(
                    (revenue - LAG(revenue, 1) OVER (ORDER BY month)) * 100.0 /
                    NULLIF(LAG(revenue, 1) OVER (ORDER BY month), 0),
                    2
                ) as growth_percent
            FROM (
                SELECT
                    DATE_TRUNC('month', created_at) as month,
                    SUM(total) as revenue
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
            ) monthly_revenue
            ORDER BY month
        ");

        $this->table(
            ['Month', 'Revenue', 'Prev Month', 'Growth %'],
            array_map(function ($row) {
                return [
                    $row->month,
                    '$' . number_format($row->revenue, 2),
                    $row->prev_month ? '$' . number_format($row->prev_month, 2) : '-',
                    $row->growth_percent ? $row->growth_percent . '%' : '-',
                ];
            }, $data)
        );
    }
}
```

</details>

---

## На собеседовании скажешь

> "Window Functions выполняют вычисления на окне строк без GROUP BY. Синтаксис: function OVER (PARTITION BY, ORDER BY, ROWS). ROW_NUMBER для уникальных номеров, RANK с пропусками, DENSE_RANK без пропусков. PARTITION BY разделяет на группы. Running totals через SUM() OVER (ORDER BY). Moving average через ROWS BETWEEN N PRECEDING AND CURRENT ROW. LAG/LEAD для предыдущей/следующей строки. Use cases: топы по категориям, накопительные суммы, процент от total, deduplicate. Индексы на ORDER BY колонки для performance."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

