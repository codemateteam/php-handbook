# 6.5 Нормализация БД

## Краткое резюме

> **Нормализация** — процесс организации данных для уменьшения избыточности и аномалий.
>
> **Нормальные формы:** 1NF (атомарные значения), 2NF (нет частичной зависимости), 3NF (нет транзитивной зависимости).
>
> **Важно:** Денормализация оправдана для часто читаемых данных (счётчики, статистика). Snapshot для исторических данных (цена на момент заказа).

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
Нормализация — процесс организации данных для уменьшения избыточности и аномалий.

**Нормальные формы:**
- **1NF** — атомарные значения
- **2NF** — нет частичной зависимости
- **3NF** — нет транзитивной зависимости
- **BCNF** — каждый детерминант — ключ

---

## Как работает

**1NF (Первая нормальная форма):**

Каждое поле содержит только атомарное значение (не массив, не список).

```sql
-- ❌ НЕ 1NF (несколько телефонов в одном поле)
CREATE TABLE users (
    id INT,
    name VARCHAR(255),
    phones VARCHAR(255)  -- '+79001111111, +79002222222'
);

-- ✅ 1NF (атомарные значения)
CREATE TABLE users (
    id INT,
    name VARCHAR(255)
);

CREATE TABLE user_phones (
    id INT,
    user_id INT,
    phone VARCHAR(20)
);
```

**2NF (Вторая нормальная форма):**

Нет частичной зависимости (все неключевые поля зависят от всего ключа).

```sql
-- ❌ НЕ 2NF (product_name зависит только от product_id, а не от (order_id, product_id))
CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    product_name VARCHAR(255),  -- Зависит только от product_id
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);

-- ✅ 2NF (вынести product_name в отдельную таблицу)
CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10, 2),
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10, 2)
);
```

**3NF (Третья нормальная форма):**

Нет транзитивной зависимости (неключевые поля зависят только от ключа).

```sql
-- ❌ НЕ 3NF (category_name зависит от category_id, а не от product_id)
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    category_id INT,
    category_name VARCHAR(255)  -- Зависит от category_id
);

-- ✅ 3NF (вынести category в отдельную таблицу)
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    category_id INT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
```

---

## Когда использовать

**Плюсы нормализации:**
- ✅ Нет избыточности (экономия места)
- ✅ Нет аномалий обновления
- ✅ Целостность данных

**Минусы нормализации:**
- ❌ Больше JOIN запросов (медленнее)
- ❌ Сложнее запросы

**Когда денормализовать:**
- Читается чаще, чем пишется
- Критична производительность чтения
- Аналитические БД (data warehouses)

---

## Пример из практики

**E-commerce нормализация:**

```sql
-- ❌ Денормализованная таблица (плохо)
CREATE TABLE orders (
    id INT PRIMARY KEY,
    user_id INT,
    user_name VARCHAR(255),       -- Дубль из users
    user_email VARCHAR(255),      -- Дубль из users
    product_id INT,
    product_name VARCHAR(255),    -- Дубль из products
    product_price DECIMAL(10, 2), -- Дубль из products
    quantity INT,
    total DECIMAL(10, 2)
);

-- Проблемы:
-- 1. При изменении user_name нужно обновить все заказы
-- 2. При изменении product_price изменятся старые заказы (!)
-- 3. Избыточность данных

-- ✅ Нормализованная структура
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10, 2)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    user_id INT,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10, 2),  -- Цена на момент заказа (не дубль!)
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

**Когда денормализация оправдана:**

```php
// Пример: кеширование счётчиков

// ❌ Медленно (JOIN и COUNT каждый раз)
$users = User::with(['posts' => function ($query) {
    $query->select('user_id', DB::raw('COUNT(*) as posts_count'))
          ->groupBy('user_id');
}])->get();

// ✅ Денормализация: хранить posts_count в users
Schema::table('users', function (Blueprint $table) {
    $table->integer('posts_count')->default(0);
});

// Обновлять при создании/удалении поста
class Post extends Model
{
    protected static function booted(): void
    {
        static::created(function (Post $post) {
            $post->user->increment('posts_count');
        });

        static::deleted(function (Post $post) {
            $post->user->decrement('posts_count');
        });
    }
}

// Теперь быстро
$users = User::where('posts_count', '>', 10)->get();
```

**Snapshot данных (исторические данные):**

```php
// Заказы: сохранить product_name и price на момент заказа
Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained();
    $table->foreignId('product_id')->constrained();
    $table->string('product_name');  // Snapshot
    $table->decimal('price', 10, 2);  // Snapshot (цена на момент заказа)
    $table->integer('quantity');
});

class OrderService
{
    public function createOrder(User $user, array $items): Order
    {
        return DB::transaction(function () use ($user, $items) {
            $order = Order::create(['user_id' => $user->id]);

            foreach ($items as $item) {
                $product = Product::find($item['product_id']);

                $order->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->name,      // Сохранить snapshot
                    'price' => $product->price,            // Цена на момент заказа
                    'quantity' => $item['quantity'],
                ]);
            }

            return $order;
        });
    }
}
```

**Materialized Views (материализованные представления):**

```sql
-- Сложный запрос (медленно)
SELECT
    users.id,
    users.name,
    COUNT(orders.id) AS orders_count,
    SUM(orders.total) AS total_spent
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id, users.name;

-- Создать материализованное представление (PostgreSQL)
CREATE MATERIALIZED VIEW user_stats AS
SELECT
    users.id,
    users.name,
    COUNT(orders.id) AS orders_count,
    COALESCE(SUM(orders.total), 0) AS total_spent
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.id, users.name;

-- Обновить данные
REFRESH MATERIALIZED VIEW user_stats;

-- Теперь быстро
SELECT * FROM user_stats WHERE orders_count > 10;
```

**В Laravel (через таблицу):**

```php
// Миграция для денормализованных данных
Schema::create('user_stats', function (Blueprint $table) {
    $table->foreignId('user_id')->primary();
    $table->integer('posts_count')->default(0);
    $table->integer('orders_count')->default(0);
    $table->decimal('total_spent', 10, 2)->default(0);
    $table->timestamp('updated_at');
});

// Команда для обновления статистики
class UpdateUserStats extends Command
{
    public function handle(): void
    {
        User::chunk(100, function ($users) {
            foreach ($users as $user) {
                DB::table('user_stats')->updateOrInsert(
                    ['user_id' => $user->id],
                    [
                        'posts_count' => $user->posts()->count(),
                        'orders_count' => $user->orders()->count(),
                        'total_spent' => $user->orders()->sum('total'),
                        'updated_at' => now(),
                    ]
                );
            }
        });
    }
}

// Запускать в cron
// schedule:run каждый час
```

---

## На собеседовании скажешь

> "Нормализация уменьшает избыточность. 1NF — атомарные значения, 2NF — нет частичной зависимости, 3NF — нет транзитивной зависимости. Плюсы: нет дублей, целостность. Минусы: больше JOIN, медленнее. Денормализация оправдана для часто читаемых данных (счётчики, статистика). Snapshot данных для исторических записей (цена на момент заказа). Materialized views для сложных агрегаций. В Laravel: хранить счётчики (posts_count), обновлять через events."

---

## Практические задания

### Задание 1: Нормализуй таблицу

Приведи эту таблицу к 3NF. Какие проблемы видишь?

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    product_names TEXT,  -- 'Product 1, Product 2, Product 3'
    product_prices TEXT, -- '100, 200, 300'
    total DECIMAL(10, 2),
    discount_percent INT,
    discount_name VARCHAR(255)  -- 'VIP Discount'
);
```

<details>
<summary>Решение</summary>

```sql
-- Проблемы:
-- 1. НЕ 1NF: product_names и product_prices содержат несколько значений
-- 2. НЕ 2NF: customer_* повторяются для каждого заказа
-- 3. НЕ 3NF: discount_name зависит от discount_percent

-- ✅ Нормализованная структура (3NF)

-- Таблица клиентов
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20)
);

-- Таблица товаров
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- Таблица скидок
CREATE TABLE discounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    percent INT NOT NULL
);

-- Таблица заказов
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    discount_id INT,
    total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (discount_id) REFERENCES discounts(id)
);

-- Таблица позиций заказа
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,  -- Цена на момент заказа (snapshot)
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- В Laravel миграциях
Schema::create('customers', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->string('phone', 20)->nullable();
    $table->timestamps();
});

Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->decimal('price', 10, 2);
    $table->timestamps();
});

Schema::create('discounts', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->integer('percent');
    $table->timestamps();
});

Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id')->constrained()->onDelete('cascade');
    $table->foreignId('discount_id')->nullable()->constrained();
    $table->decimal('total', 10, 2);
    $table->timestamps();
});

Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->onDelete('cascade');
    $table->foreignId('product_id')->constrained();
    $table->integer('quantity')->default(1);
    $table->decimal('price', 10, 2);  // Snapshot цены
    $table->timestamps();
});
```
</details>

### Задание 2: Когда денормализовать?

У тебя таблица `users` и `posts`. Запрос "пользователи с количеством постов > 10" выполняется часто и медленно. Как оптимизировать?

<details>
<summary>Решение</summary>

```php
// ❌ Медленный запрос (JOIN + COUNT каждый раз)
$users = User::select('users.*')
    ->selectRaw('COUNT(posts.id) as posts_count')
    ->leftJoin('posts', 'users.id', '=', 'posts.user_id')
    ->groupBy('users.id')
    ->having('posts_count', '>', 10)
    ->get();

// ✅ Решение: Денормализация - добавить счётчик в users
Schema::table('users', function (Blueprint $table) {
    $table->integer('posts_count')->default(0);
    $table->index('posts_count');  // Индекс для быстрой фильтрации
});

// Обновлять счётчик через Model Events
class Post extends Model
{
    protected static function booted(): void
    {
        static::created(function (Post $post) {
            $post->user()->increment('posts_count');
        });

        static::deleted(function (Post $post) {
            $post->user()->decrement('posts_count');
        });

        // При восстановлении soft deleted
        static::restored(function (Post $post) {
            $post->user()->increment('posts_count');
        });
    }
}

// Теперь быстрый запрос (без JOIN)
$users = User::where('posts_count', '>', 10)->get();

// Или через Observer (более чистый код)
class PostObserver
{
    public function created(Post $post): void
    {
        $post->user->increment('posts_count');
    }

    public function deleted(Post $post): void
    {
        $post->user->decrement('posts_count');
    }

    public function restored(Post $post): void
    {
        $post->user->increment('posts_count');
    }
}

// В AppServiceProvider
public function boot(): void
{
    Post::observe(PostObserver::class);
}

// Команда для пересчёта (если счётчики рассинхронизировались)
class RecalculatePostsCounts extends Command
{
    public function handle(): void
    {
        User::chunk(100, function ($users) {
            foreach ($users as $user) {
                $count = $user->posts()->count();
                $user->update(['posts_count' => $count]);
            }
        });

        $this->info('Posts counts recalculated');
    }
}
```
</details>

### Задание 3: Snapshot исторических данных

Создай систему заказов, где цена товара может меняться, но в заказе должна храниться цена на момент покупки.

<details>
<summary>Решение</summary>

```php
// Миграция order_items
Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->onDelete('cascade');
    $table->foreignId('product_id')->constrained();

    // Snapshot данных на момент заказа
    $table->string('product_name');  // Название на момент заказа
    $table->decimal('price', 10, 2);  // Цена на момент заказа
    $table->text('product_description')->nullable();  // Описание

    $table->integer('quantity')->default(1);
    $table->timestamps();
});

// Service для создания заказа
class OrderService
{
    public function createOrder(User $user, array $items): Order
    {
        return DB::transaction(function () use ($user, $items) {
            $order = Order::create([
                'user_id' => $user->id,
                'status' => 'pending',
            ]);

            $total = 0;

            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);

                // Создать item со snapshot данных
                $orderItem = $order->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->name,  // Snapshot
                    'price' => $product->price,  // Snapshot (текущая цена)
                    'product_description' => $product->description,  // Snapshot
                    'quantity' => $item['quantity'],
                ]);

                $total += $orderItem->price * $orderItem->quantity;
            }

            $order->update(['total' => $total]);

            return $order->fresh('items');
        });
    }
}

// Модель OrderItem
class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'product_name',
        'price',
        'product_description',
        'quantity',
    ];

    // Вычисляемый атрибут
    public function getSubtotalAttribute(): float
    {
        return $this->price * $this->quantity;
    }

    // Relationship к текущему товару (может измениться)
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    // Relationship к заказу
    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}

// Использование
$order = OrderService::createOrder($user, [
    ['product_id' => 1, 'quantity' => 2],
    ['product_id' => 5, 'quantity' => 1],
]);

// Даже если цена товара изменится, в заказе останется старая
$product = Product::find(1);
$product->update(['price' => 9999]);  // Цена изменилась

// В заказе цена осталась прежней
$orderItem = $order->items->first();
echo $orderItem->price;  // Старая цена (snapshot)
echo $orderItem->product->price;  // Новая цена (9999)
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
