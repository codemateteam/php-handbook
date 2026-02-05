# 6.1 Основы SQL (SELECT, WHERE, JOIN)

## Краткое резюме

> **SQL (Structured Query Language)** — язык запросов к реляционным БД. SELECT читает данные, WHERE фильтрует, JOIN соединяет таблицы.
>
> **Основные команды:** SELECT (выбор), WHERE (фильтр), JOIN (соединение), ORDER BY (сортировка), LIMIT (ограничение).
>
> **Важно:** INNER JOIN возвращает только совпадения, LEFT JOIN — все из левой таблицы + совпадения справа.

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
SQL — язык запросов к реляционным БД. SELECT читает данные, WHERE фильтрует, JOIN соединяет таблицы.

**Основные команды:**
- SELECT — выбрать данные
- WHERE — фильтровать
- JOIN — соединить таблицы
- ORDER BY — сортировать
- LIMIT — ограничить количество

---

## Как работает

**SELECT:**

```sql
-- Выбрать все столбцы
SELECT * FROM users;

-- Выбрать конкретные столбцы
SELECT id, name, email FROM users;

-- С алиасом
SELECT
    id,
    name AS full_name,
    email AS user_email
FROM users;

-- DISTINCT (уникальные значения)
SELECT DISTINCT status FROM orders;

-- COUNT
SELECT COUNT(*) FROM users;
SELECT COUNT(DISTINCT status) FROM orders;
```

**WHERE (фильтрация):**

```sql
-- Равенство
SELECT * FROM users WHERE id = 1;
SELECT * FROM users WHERE status = 'active';

-- Неравенство
SELECT * FROM users WHERE age > 18;
SELECT * FROM users WHERE age >= 18;
SELECT * FROM users WHERE status != 'banned';

-- LIKE (поиск по шаблону)
SELECT * FROM users WHERE name LIKE 'John%';  -- Начинается с John
SELECT * FROM users WHERE email LIKE '%@gmail.com';  -- Заканчивается на @gmail.com
SELECT * FROM users WHERE name LIKE '%son%';  -- Содержит son

-- IN (в списке значений)
SELECT * FROM users WHERE id IN (1, 2, 3);
SELECT * FROM users WHERE status IN ('active', 'pending');

-- BETWEEN (в диапазоне)
SELECT * FROM users WHERE age BETWEEN 18 AND 65;
SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';

-- IS NULL / IS NOT NULL
SELECT * FROM users WHERE deleted_at IS NULL;
SELECT * FROM users WHERE email_verified_at IS NOT NULL;

-- AND / OR
SELECT * FROM users
WHERE status = 'active' AND age > 18;

SELECT * FROM users
WHERE status = 'active' OR status = 'pending';

-- Комбинация
SELECT * FROM users
WHERE (status = 'active' OR status = 'pending')
  AND age > 18;
```

**ORDER BY (сортировка):**

```sql
-- По возрастанию (ASC)
SELECT * FROM users ORDER BY name ASC;

-- По убыванию (DESC)
SELECT * FROM users ORDER BY created_at DESC;

-- По нескольким столбцам
SELECT * FROM users
ORDER BY status ASC, created_at DESC;
```

**LIMIT и OFFSET (пагинация):**

```sql
-- Первые 10 записей
SELECT * FROM users LIMIT 10;

-- Записи с 11 по 20 (пагинация)
SELECT * FROM users LIMIT 10 OFFSET 10;

-- Короткая форма
SELECT * FROM users LIMIT 10, 10;  -- OFFSET 10, LIMIT 10
```

**JOIN (соединение таблиц):**

```sql
-- INNER JOIN (только совпадения)
SELECT
    users.id,
    users.name,
    orders.id AS order_id,
    orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id;

-- LEFT JOIN (все из левой таблицы)
SELECT
    users.id,
    users.name,
    COUNT(orders.id) AS orders_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id, users.name;

-- RIGHT JOIN (все из правой таблицы)
SELECT
    orders.id,
    users.name
FROM users
RIGHT JOIN orders ON users.id = orders.user_id;

-- Множественные JOIN
SELECT
    users.name,
    orders.id AS order_id,
    products.name AS product_name,
    order_items.quantity
FROM users
INNER JOIN orders ON users.id = orders.user_id
INNER JOIN order_items ON orders.id = order_items.order_id
INNER JOIN products ON order_items.product_id = products.id;
```

---

## Когда использовать

**SELECT:**
- Чтение данных из БД

**WHERE:**
- Фильтрация по условиям

**JOIN:**
- Связывание данных из разных таблиц
- INNER JOIN — только совпадения
- LEFT JOIN — все из левой + совпадения справа
- RIGHT JOIN — все из правой + совпадения слева

---

## Пример из практики

**E-commerce запросы:**

```sql
-- Активные пользователи с заказами
SELECT
    users.id,
    users.name,
    users.email,
    COUNT(orders.id) AS total_orders,
    SUM(orders.total) AS total_spent
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE users.status = 'active'
  AND orders.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
GROUP BY users.id, users.name, users.email
HAVING total_orders > 5
ORDER BY total_spent DESC
LIMIT 100;

-- Товары без заказов (LEFT JOIN + IS NULL)
SELECT
    products.id,
    products.name,
    products.price
FROM products
LEFT JOIN order_items ON products.id = order_items.product_id
WHERE order_items.id IS NULL
  AND products.is_active = 1;

-- Заказы с деталями
SELECT
    orders.id AS order_id,
    orders.number AS order_number,
    users.name AS customer_name,
    products.name AS product_name,
    order_items.quantity,
    order_items.price,
    (order_items.quantity * order_items.price) AS item_total
FROM orders
INNER JOIN users ON orders.user_id = users.id
INNER JOIN order_items ON orders.id = order_items.order_id
INNER JOIN products ON order_items.product_id = products.id
WHERE orders.created_at >= '2024-01-01'
  AND orders.status = 'completed'
ORDER BY orders.created_at DESC;
```

**Подзапросы:**

```sql
-- Пользователи с заказами выше среднего
SELECT
    users.id,
    users.name,
    (
        SELECT SUM(total)
        FROM orders
        WHERE orders.user_id = users.id
    ) AS total_spent
FROM users
WHERE (
    SELECT SUM(total)
    FROM orders
    WHERE orders.user_id = users.id
) > (
    SELECT AVG(total)
    FROM orders
);

-- IN с подзапросом
SELECT * FROM users
WHERE id IN (
    SELECT user_id
    FROM orders
    WHERE total > 1000
);

-- EXISTS (проверка существования)
SELECT * FROM users
WHERE EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.user_id = users.id
      AND orders.status = 'pending'
);
```

**GROUP BY и HAVING:**

```sql
-- Группировка по статусу
SELECT
    status,
    COUNT(*) AS count,
    AVG(total) AS avg_total
FROM orders
GROUP BY status;

-- HAVING (фильтр после группировки)
SELECT
    user_id,
    COUNT(*) AS orders_count,
    SUM(total) AS total_spent
FROM orders
GROUP BY user_id
HAVING orders_count > 10 AND total_spent > 5000;
```

**UNION (объединение результатов):**

```sql
-- Объединить активных и VIP пользователей
SELECT id, name, 'active' AS type FROM users WHERE status = 'active'
UNION
SELECT id, name, 'vip' AS type FROM users WHERE is_vip = 1;

-- UNION ALL (с дубликатами)
SELECT id, name FROM customers
UNION ALL
SELECT id, name FROM suppliers;
```

**CASE (условная логика):**

```sql
SELECT
    id,
    name,
    total,
    CASE
        WHEN total > 10000 THEN 'Premium'
        WHEN total > 5000 THEN 'Gold'
        WHEN total > 1000 THEN 'Silver'
        ELSE 'Bronze'
    END AS tier
FROM orders;
```

**В Laravel Query Builder:**

```php
// SELECT с WHERE
$users = DB::table('users')
    ->select('id', 'name', 'email')
    ->where('status', 'active')
    ->where('age', '>', 18)
    ->orderBy('created_at', 'desc')
    ->limit(10)
    ->get();

// JOIN
$orders = DB::table('orders')
    ->join('users', 'users.id', '=', 'orders.user_id')
    ->join('products', 'products.id', '=', 'orders.product_id')
    ->select('orders.*', 'users.name as user_name', 'products.name as product_name')
    ->where('orders.status', 'completed')
    ->get();

// LEFT JOIN с COUNT
$users = DB::table('users')
    ->leftJoin('orders', 'users.id', '=', 'orders.user_id')
    ->select('users.*', DB::raw('COUNT(orders.id) as orders_count'))
    ->groupBy('users.id')
    ->get();

// Подзапрос
$averageTotal = DB::table('orders')->avg('total');
$users = DB::table('users')
    ->whereIn('id', function ($query) use ($averageTotal) {
        $query->select('user_id')
              ->from('orders')
              ->where('total', '>', $averageTotal)
              ->groupBy('user_id');
    })
    ->get();
```

---

## На собеседовании скажешь

> "SELECT читает данные, WHERE фильтрует (=, >, <, LIKE, IN, BETWEEN, IS NULL). ORDER BY сортирует, LIMIT ограничивает. JOIN соединяет таблицы: INNER JOIN (только совпадения), LEFT JOIN (все из левой), RIGHT JOIN (все из правой). GROUP BY для агрегации, HAVING для фильтрации после группировки. Подзапросы в WHERE, SELECT. В Laravel использую Query Builder: DB::table(), where(), join(), orderBy(), limit()."

---

## Практические задания

### Задание 1: Найди пользователей с заказами

Напиши запрос, который выберет всех пользователей у которых есть хотя бы один заказ. Используй два способа: JOIN и подзапрос.

<details>
<summary>Решение</summary>

```sql
-- Способ 1: INNER JOIN
SELECT DISTINCT users.id, users.name, users.email
FROM users
INNER JOIN orders ON users.id = orders.user_id;

-- Способ 2: EXISTS (эффективнее для больших таблиц)
SELECT id, name, email
FROM users
WHERE EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.user_id = users.id
);

-- Способ 3: IN с подзапросом
SELECT id, name, email
FROM users
WHERE id IN (
    SELECT DISTINCT user_id
    FROM orders
);

-- В Laravel Query Builder
$users = DB::table('users')
    ->join('orders', 'users.id', '=', 'orders.user_id')
    ->select('users.id', 'users.name', 'users.email')
    ->distinct()
    ->get();

// Или через whereHas
$users = User::whereHas('orders')->get();
```
</details>

### Задание 2: Топ 5 товаров по продажам

Выведи топ 5 товаров с наибольшим количеством продаж (сумма quantity из order_items).

<details>
<summary>Решение</summary>

```sql
-- SQL запрос
SELECT
    products.id,
    products.name,
    SUM(order_items.quantity) AS total_sold
FROM products
INNER JOIN order_items ON products.id = order_items.product_id
GROUP BY products.id, products.name
ORDER BY total_sold DESC
LIMIT 5;

-- В Laravel Query Builder
$topProducts = DB::table('products')
    ->join('order_items', 'products.id', '=', 'order_items.product_id')
    ->select(
        'products.id',
        'products.name',
        DB::raw('SUM(order_items.quantity) as total_sold')
    )
    ->groupBy('products.id', 'products.name')
    ->orderBy('total_sold', 'desc')
    ->limit(5)
    ->get();

// Eloquent вариант
$topProducts = Product::select('products.*')
    ->selectRaw('SUM(order_items.quantity) as total_sold')
    ->join('order_items', 'products.id', '=', 'order_items.product_id')
    ->groupBy('products.id')
    ->orderBy('total_sold', 'desc')
    ->limit(5)
    ->get();
```
</details>

### Задание 3: Найди товары без заказов

Выведи все товары, которые ни разу не были заказаны.

<details>
<summary>Решение</summary>

```sql
-- LEFT JOIN + IS NULL
SELECT
    products.id,
    products.name,
    products.price
FROM products
LEFT JOIN order_items ON products.id = order_items.product_id
WHERE order_items.id IS NULL;

-- NOT EXISTS (эффективнее)
SELECT id, name, price
FROM products
WHERE NOT EXISTS (
    SELECT 1
    FROM order_items
    WHERE order_items.product_id = products.id
);

-- NOT IN (может быть медленнее)
SELECT id, name, price
FROM products
WHERE id NOT IN (
    SELECT DISTINCT product_id
    FROM order_items
);

-- В Laravel
$unusedProducts = Product::leftJoin('order_items', 'products.id', '=', 'order_items.product_id')
    ->whereNull('order_items.id')
    ->select('products.*')
    ->get();

// Или через doesntHave
$unusedProducts = Product::doesntHave('orderItems')->get();
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
