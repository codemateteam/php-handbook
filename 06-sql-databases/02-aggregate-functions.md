# 6.2 Агрегатные функции

## Краткое резюме

> **Агрегатные функции** — вычисления над группами строк (COUNT, SUM, AVG, MIN, MAX). Возвращают одно значение для группы.
>
> **Функции:** COUNT (количество), SUM (сумма), AVG (среднее), MIN/MAX (экстремумы).
>
> **Важно:** GROUP BY группирует данные, HAVING фильтрует после группировки (WHERE — до группировки).

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
Агрегатные функции — вычисления над группами строк (COUNT, SUM, AVG, MIN, MAX). Возвращают одно значение для группы.

**Основные функции:**
- COUNT() — количество
- SUM() — сумма
- AVG() — среднее
- MIN() — минимум
- MAX() — максимум

---

## Как работает

**COUNT (подсчёт):**

```sql
-- Общее количество пользователей
SELECT COUNT(*) FROM users;

-- Количество не-NULL значений
SELECT COUNT(email) FROM users;

-- DISTINCT (уникальные значения)
SELECT COUNT(DISTINCT status) FROM orders;

-- С условием
SELECT COUNT(*) FROM users WHERE status = 'active';
```

**SUM (сумма):**

```sql
-- Сумма всех заказов
SELECT SUM(total) FROM orders;

-- Сумма по условию
SELECT SUM(total) FROM orders WHERE status = 'completed';

-- С GROUP BY
SELECT
    user_id,
    SUM(total) AS total_spent
FROM orders
GROUP BY user_id;
```

**AVG (среднее):**

```sql
-- Средняя сумма заказа
SELECT AVG(total) FROM orders;

-- Средний возраст активных пользователей
SELECT AVG(age) FROM users WHERE status = 'active';

-- С GROUP BY
SELECT
    status,
    AVG(total) AS avg_total
FROM orders
GROUP BY status;
```

**MIN и MAX:**

```sql
-- Минимальная и максимальная цена
SELECT
    MIN(price) AS min_price,
    MAX(price) AS max_price
FROM products;

-- По категориям
SELECT
    category_id,
    MIN(price) AS min_price,
    MAX(price) AS max_price
FROM products
GROUP BY category_id;

-- Самый старый и новый заказ
SELECT
    MIN(created_at) AS first_order,
    MAX(created_at) AS last_order
FROM orders;
```

**GROUP BY (группировка):**

```sql
-- Количество заказов по статусам
SELECT
    status,
    COUNT(*) AS count
FROM orders
GROUP BY status;

-- Сумма заказов по пользователям
SELECT
    user_id,
    COUNT(*) AS orders_count,
    SUM(total) AS total_spent,
    AVG(total) AS avg_order
FROM orders
GROUP BY user_id;

-- Группировка по нескольким полям
SELECT
    user_id,
    status,
    COUNT(*) AS count
FROM orders
GROUP BY user_id, status;
```

**HAVING (фильтр после группировки):**

```sql
-- Пользователи с более чем 10 заказами
SELECT
    user_id,
    COUNT(*) AS orders_count
FROM orders
GROUP BY user_id
HAVING orders_count > 10;

-- Категории со средней ценой > 1000
SELECT
    category_id,
    AVG(price) AS avg_price
FROM products
GROUP BY category_id
HAVING avg_price > 1000;

-- Комбинация WHERE и HAVING
SELECT
    user_id,
    COUNT(*) AS orders_count,
    SUM(total) AS total_spent
FROM orders
WHERE status = 'completed'  -- Фильтр ДО группировки
GROUP BY user_id
HAVING total_spent > 5000;  -- Фильтр ПОСЛЕ группировки
```

---

## Когда использовать

**COUNT:**
- Подсчёт записей
- Количество элементов в группе

**SUM:**
- Сумма значений (продажи, балансы)

**AVG:**
- Средние значения (средний чек, рейтинг)

**MIN/MAX:**
- Экстремальные значения (самый дешёвый/дорогой)

---

## Пример из практики

**Статистика по заказам:**

```sql
-- Общая статистика
SELECT
    COUNT(*) AS total_orders,
    SUM(total) AS total_revenue,
    AVG(total) AS avg_order_value,
    MIN(total) AS min_order,
    MAX(total) AS max_order
FROM orders
WHERE status = 'completed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH);

-- По пользователям
SELECT
    user_id,
    users.name,
    COUNT(orders.id) AS orders_count,
    SUM(orders.total) AS total_spent,
    AVG(orders.total) AS avg_order,
    MAX(orders.total) AS max_order,
    MIN(orders.created_at) AS first_order,
    MAX(orders.created_at) AS last_order
FROM orders
INNER JOIN users ON orders.user_id = users.id
WHERE orders.status = 'completed'
GROUP BY user_id, users.name
HAVING orders_count >= 5
ORDER BY total_spent DESC
LIMIT 100;
```

**Аналитика товаров:**

```sql
-- Топ товаров по продажам
SELECT
    products.id,
    products.name,
    COUNT(order_items.id) AS times_sold,
    SUM(order_items.quantity) AS total_quantity,
    SUM(order_items.quantity * order_items.price) AS total_revenue
FROM products
INNER JOIN order_items ON products.id = order_items.product_id
INNER JOIN orders ON order_items.order_id = orders.id
WHERE orders.status = 'completed'
  AND orders.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
GROUP BY products.id, products.name
ORDER BY total_revenue DESC
LIMIT 20;
```

**Временная аналитика:**

```sql
-- Продажи по дням
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS orders_count,
    SUM(total) AS daily_revenue,
    AVG(total) AS avg_order
FROM orders
WHERE status = 'completed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- По месяцам
SELECT
    YEAR(created_at) AS year,
    MONTH(created_at) AS month,
    COUNT(*) AS orders_count,
    SUM(total) AS monthly_revenue
FROM orders
WHERE status = 'completed'
GROUP BY YEAR(created_at), MONTH(created_at)
ORDER BY year DESC, month DESC;

-- По часам (пиковые время)
SELECT
    HOUR(created_at) AS hour,
    COUNT(*) AS orders_count
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY HOUR(created_at)
ORDER BY orders_count DESC;
```

**Сегментация пользователей:**

```sql
-- RFM анализ (Recency, Frequency, Monetary)
SELECT
    user_id,
    users.name,
    DATEDIFF(NOW(), MAX(orders.created_at)) AS days_since_last_order,
    COUNT(orders.id) AS orders_count,
    SUM(orders.total) AS total_spent,
    CASE
        WHEN DATEDIFF(NOW(), MAX(orders.created_at)) <= 30 THEN 'Active'
        WHEN DATEDIFF(NOW(), MAX(orders.created_at)) <= 90 THEN 'At Risk'
        ELSE 'Lost'
    END AS status_segment,
    CASE
        WHEN SUM(orders.total) > 10000 THEN 'VIP'
        WHEN SUM(orders.total) > 5000 THEN 'Premium'
        ELSE 'Regular'
    END AS value_segment
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE orders.status = 'completed'
GROUP BY user_id, users.name
HAVING orders_count > 0;
```

**В Laravel:**

```php
use Illuminate\Support\Facades\DB;

// COUNT, SUM, AVG
$stats = DB::table('orders')
    ->where('status', 'completed')
    ->select(
        DB::raw('COUNT(*) as total_orders'),
        DB::raw('SUM(total) as revenue'),
        DB::raw('AVG(total) as avg_order')
    )
    ->first();

// GROUP BY с агрегацией
$userStats = DB::table('orders')
    ->select(
        'user_id',
        DB::raw('COUNT(*) as orders_count'),
        DB::raw('SUM(total) as total_spent')
    )
    ->where('status', 'completed')
    ->groupBy('user_id')
    ->having('orders_count', '>', 5)
    ->orderBy('total_spent', 'desc')
    ->get();

// Eloquent с агрегацией
$orderCount = Order::where('user_id', $userId)->count();
$totalSpent = Order::where('user_id', $userId)->sum('total');
$avgOrder = Order::where('user_id', $userId)->avg('total');

// WithCount (Eloquent relationship)
$users = User::withCount('orders')
    ->having('orders_count', '>', 10)
    ->get();

// WithSum, WithAvg
$users = User::withSum('orders', 'total')
    ->withAvg('orders', 'total')
    ->get();

foreach ($users as $user) {
    echo $user->orders_sum_total;  // Сумма заказов
    echo $user->orders_avg_total;  // Средний заказ
}
```

**Window Functions (MySQL 8.0+):**

```sql
-- Ранжирование пользователей по тратам
SELECT
    user_id,
    total_spent,
    ROW_NUMBER() OVER (ORDER BY total_spent DESC) AS rank,
    RANK() OVER (ORDER BY total_spent DESC) AS rank_with_ties,
    PERCENT_RANK() OVER (ORDER BY total_spent DESC) AS percentile
FROM (
    SELECT
        user_id,
        SUM(total) AS total_spent
    FROM orders
    GROUP BY user_id
) AS user_totals;

-- Running total (накопительная сумма)
SELECT
    DATE(created_at) AS date,
    SUM(total) AS daily_revenue,
    SUM(SUM(total)) OVER (ORDER BY DATE(created_at)) AS running_total
FROM orders
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date;
```

---

## На собеседовании скажешь

> "Агрегатные функции: COUNT (количество), SUM (сумма), AVG (среднее), MIN/MAX (экстремумы). GROUP BY группирует данные, HAVING фильтрует после группировки (WHERE — до). COUNT(*) считает все строки, COUNT(column) — не-NULL. В Laravel: DB::raw() для SQL агрегации, withCount/withSum/withAvg для Eloquent relationships. Window functions (ROW_NUMBER, RANK, running totals) в MySQL 8.0+."

---

## Практические задания

### Задание 1: Статистика по категориям

Выведи для каждой категории товаров: количество товаров, среднюю цену, минимальную и максимальную цену.

<details>
<summary>Решение</summary>

```sql
-- SQL запрос
SELECT
    categories.id,
    categories.name,
    COUNT(products.id) AS products_count,
    AVG(products.price) AS avg_price,
    MIN(products.price) AS min_price,
    MAX(products.price) AS max_price
FROM categories
LEFT JOIN products ON categories.id = products.category_id
GROUP BY categories.id, categories.name
ORDER BY products_count DESC;

-- В Laravel Query Builder
$stats = DB::table('categories')
    ->leftJoin('products', 'categories.id', '=', 'products.category_id')
    ->select(
        'categories.id',
        'categories.name',
        DB::raw('COUNT(products.id) as products_count'),
        DB::raw('AVG(products.price) as avg_price'),
        DB::raw('MIN(products.price) as min_price'),
        DB::raw('MAX(products.price) as max_price')
    )
    ->groupBy('categories.id', 'categories.name')
    ->orderBy('products_count', 'desc')
    ->get();

// Eloquent с withCount и withAvg
$categories = Category::withCount('products')
    ->withAvg('products', 'price')
    ->withMin('products', 'price')
    ->withMax('products', 'price')
    ->get();
```
</details>

### Задание 2: VIP клиенты

Найди пользователей, которые сделали больше 10 заказов И потратили больше 5000. Выведи их имя, количество заказов и общую сумму.

<details>
<summary>Решение</summary>

```sql
-- SQL запрос
SELECT
    users.id,
    users.name,
    COUNT(orders.id) AS orders_count,
    SUM(orders.total) AS total_spent
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE orders.status = 'completed'
GROUP BY users.id, users.name
HAVING orders_count > 10 AND total_spent > 5000
ORDER BY total_spent DESC;

-- В Laravel Query Builder
$vipUsers = DB::table('users')
    ->join('orders', 'users.id', '=', 'orders.user_id')
    ->select(
        'users.id',
        'users.name',
        DB::raw('COUNT(orders.id) as orders_count'),
        DB::raw('SUM(orders.total) as total_spent')
    )
    ->where('orders.status', 'completed')
    ->groupBy('users.id', 'users.name')
    ->having('orders_count', '>', 10)
    ->having('total_spent', '>', 5000)
    ->orderBy('total_spent', 'desc')
    ->get();

// Eloquent вариант
$vipUsers = User::withCount(['orders' => function ($query) {
        $query->where('status', 'completed');
    }])
    ->withSum(['orders as total_spent' => function ($query) {
        $query->where('status', 'completed');
    }], 'total')
    ->having('orders_count', '>', 10)
    ->having('total_spent', '>', 5000)
    ->orderBy('total_spent', 'desc')
    ->get();
```
</details>

### Задание 3: Продажи по месяцам

Выведи количество заказов и общую выручку по месяцам за последний год.

<details>
<summary>Решение</summary>

```sql
-- SQL запрос
SELECT
    YEAR(created_at) AS year,
    MONTH(created_at) AS month,
    COUNT(*) AS orders_count,
    SUM(total) AS monthly_revenue,
    AVG(total) AS avg_order_value
FROM orders
WHERE status = 'completed'
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
GROUP BY YEAR(created_at), MONTH(created_at)
ORDER BY year DESC, month DESC;

-- В Laravel Query Builder
$monthlySales = DB::table('orders')
    ->select(
        DB::raw('YEAR(created_at) as year'),
        DB::raw('MONTH(created_at) as month'),
        DB::raw('COUNT(*) as orders_count'),
        DB::raw('SUM(total) as monthly_revenue'),
        DB::raw('AVG(total) as avg_order_value')
    )
    ->where('status', 'completed')
    ->where('created_at', '>=', now()->subYear())
    ->groupBy(DB::raw('YEAR(created_at)'), DB::raw('MONTH(created_at)'))
    ->orderByRaw('year DESC, month DESC')
    ->get();

// Форматирование для удобства
$monthlySales = $monthlySales->map(function ($item) {
    $item->month_name = \Carbon\Carbon::create()->month($item->month)->format('F');
    return $item;
});
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
