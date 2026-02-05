# 13.2 Database Optimization

## Краткое резюме

> **Database Optimization** — ускорение работы с БД через индексы, избежание N+1, оптимизацию JOIN.
>
> **Проблемы:** N+1 queries (решение: `with()`), отсутствие индексов, `SELECT *`, медленные JOIN.
>
> **Методы:** Eager Loading, пагинация вместо `all()`, `chunk/lazy` для больших объёмов, `withCount` для агрегатов.

---

## Содержание

- [Что это](#что-это)
- [N+1 Problem](#n1-problem)
- [Индексы](#индексы)
- [Оптимизация запросов](#оптимизация-запросов)
- [Оптимизация JOIN](#оптимизация-join)
- [Агрегаты](#агрегаты)
- [Кеширование запросов](#кеширование-запросов)
- [Практические примеры](#практические-примеры)
- [Database Connection Pool](#database-connection-pool)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Оптимизация запросов к БД для ускорения приложения. Индексы, избежание N+1, оптимизация JOIN.

**Основные проблемы:**
- N+1 queries
- Отсутствие индексов
- SELECT *
- Медленные JOIN

---

## N+1 Problem

**Проблема:**

```php
// ❌ ПЛОХО: 1 + N queries
$posts = Post::all();  // 1 query

foreach ($posts as $post) {
    echo $post->user->name;  // N queries
}
// Итого: 1 + 100 = 101 query для 100 постов
```

**Решение: Eager Loading:**

```php
// ✅ ХОРОШО: 2 queries
$posts = Post::with('user')->get();  // 2 queries: posts + users

foreach ($posts as $post) {
    echo $post->user->name;  // Без запроса
}
```

**Nested relationships:**

```php
// Загрузить несколько связей
$posts = Post::with(['user', 'comments', 'tags'])->get();

// Вложенные связи
$posts = Post::with('comments.user')->get();

// Условия для eager loading
$posts = Post::with(['comments' => function ($query) {
    $query->where('approved', true)
          ->orderBy('created_at', 'desc')
          ->limit(5);
}])->get();
```

**Lazy Eager Loading:**

```php
$posts = Post::all();

// Загрузить связь позже
if ($needUsers) {
    $posts->load('user');
}
```

---

## Индексы

**Создание индексов:**

```php
Schema::table('posts', function (Blueprint $table) {
    // Простой индекс
    $table->index('user_id');

    // Составной индекс
    $table->index(['user_id', 'published']);

    // Уникальный индекс
    $table->unique('email');

    // Полнотекстовый индекс (MySQL)
    $table->fullText('title');
});
```

**Когда использовать:**

```php
// ✅ Индекс нужен для:
// - WHERE clause
Post::where('user_id', 1)->get();  // Индекс на user_id

// - ORDER BY
Post::orderBy('created_at', 'desc')->get();  // Индекс на created_at

// - JOIN
Post::join('users', 'posts.user_id', '=', 'users.id');  // Индексы на обе колонки

// - FOREIGN KEY
$table->foreign('user_id')->references('id')->on('users');  // Автоматический индекс
```

**Проверить использование индексов:**

```php
// EXPLAIN для анализа
DB::enableQueryLog();

Post::where('user_id', 1)
    ->where('published', true)
    ->orderBy('created_at', 'desc')
    ->get();

dd(DB::getQueryLog());

// Или напрямую SQL:
// EXPLAIN SELECT * FROM posts WHERE user_id = 1 AND published = 1 ORDER BY created_at DESC;
```

---

## Оптимизация запросов

**Избегать SELECT *:**

```php
// ❌ ПЛОХО: выбирает всё
$users = User::all();

// ✅ ХОРОШО: только нужные колонки
$users = User::select(['id', 'name', 'email'])->get();

// С relationships
$posts = Post::with('user:id,name')->get();
```

**Пагинация:**

```php
// ❌ ПЛОХО: загружает всё в память
$posts = Post::all();

// ✅ ХОРОШО: пагинация
$posts = Post::paginate(20);

// Для API: простая пагинация (без total count)
$posts = Post::simplePaginate(20);

// Курсорная пагинация (для больших данных)
$posts = Post::orderBy('id')->cursorPaginate(20);
```

**Chunk для больших объёмов:**

```php
// ❌ ПЛОХО: вся таблица в памяти
User::all()->each(function ($user) {
    $this->processUser($user);
});

// ✅ ХОРОШО: по частям
User::chunk(100, function ($users) {
    foreach ($users as $user) {
        $this->processUser($user);
    }
});

// Lazy для итерации
User::lazy()->each(function ($user) {
    $this->processUser($user);
});
```

---

## Оптимизация JOIN

**Eager Loading vs JOIN:**

```php
// Eager Loading (2 queries)
$posts = Post::with('user')->get();

// JOIN (1 query, но дублирование данных)
$posts = Post::join('users', 'posts.user_id', '=', 'users.id')
    ->select('posts.*', 'users.name as user_name')
    ->get();
```

**LEFT JOIN для подсчёта:**

```php
// Количество комментариев для каждого поста
$posts = Post::leftJoin('comments', 'posts.id', '=', 'comments.post_id')
    ->select('posts.*', DB::raw('COUNT(comments.id) as comments_count'))
    ->groupBy('posts.id')
    ->get();

// Или через withCount (проще)
$posts = Post::withCount('comments')->get();
```

---

## Агрегаты

**COUNT, SUM, AVG:**

```php
// Общее количество
$count = User::count();

// С условием
$activeUsers = User::where('active', true)->count();

// SUM
$totalRevenue = Order::sum('total');
$todayRevenue = Order::whereDate('created_at', today())->sum('total');

// AVG
$avgOrderValue = Order::avg('total');

// MIN, MAX
$minPrice = Product::min('price');
$maxPrice = Product::max('price');
```

**Группировка:**

```php
// Заказы по пользователям
$orders = Order::select('user_id', DB::raw('COUNT(*) as total'))
    ->groupBy('user_id')
    ->get();

// С HAVING
$bigSpenders = Order::select('user_id', DB::raw('SUM(total) as spent'))
    ->groupBy('user_id')
    ->having('spent', '>', 1000)
    ->get();
```

---

## Кеширование запросов

**Кеш для агрегатов:**

```php
// ❌ ПЛОХО: запрос на каждый request
public function dashboard()
{
    return [
        'users_count' => User::count(),
        'orders_count' => Order::count(),
        'revenue' => Order::sum('total'),
    ];
}

// ✅ ХОРОШО: кешировать
public function dashboard()
{
    return Cache::remember('dashboard.stats', 600, function () {
        return [
            'users_count' => User::count(),
            'orders_count' => Order::count(),
            'revenue' => Order::sum('total'),
        ];
    });
}
```

---

## Практические примеры

**Оптимизация сложного запроса:**

```php
// ❌ ПЛОХО
public function getPopularPosts()
{
    $posts = Post::all();  // N+1

    return $posts->filter(function ($post) {
        return $post->comments()->count() > 10;  // N queries
    })->map(function ($post) {
        return [
            'title' => $post->title,
            'author' => $post->user->name,  // N+1
            'comments' => $post->comments->count(),
        ];
    });
}

// ✅ ХОРОШО
public function getPopularPosts()
{
    return Cache::remember('posts.popular', 3600, function () {
        return Post::withCount('comments')
            ->with('user:id,name')
            ->having('comments_count', '>', 10)
            ->select(['id', 'title', 'user_id'])
            ->get()
            ->map(function ($post) {
                return [
                    'title' => $post->title,
                    'author' => $post->user->name,
                    'comments' => $post->comments_count,
                ];
            });
    });
}
```

**Оптимизация поиска:**

```php
// ❌ ПЛОХО
public function search($query)
{
    return Product::where('name', 'like', "%$query%")
        ->orWhere('description', 'like', "%$query%")
        ->get();
}

// ✅ ХОРОШО: fulltext index
Schema::table('products', function (Blueprint $table) {
    $table->fullText(['name', 'description']);
});

public function search($query)
{
    return Product::whereFullText(['name', 'description'], $query)
        ->limit(20)
        ->get();
}

// Или Scout (Algolia, Meilisearch)
return Product::search($query)->get();
```

**Batch вставка:**

```php
// ❌ ПЛОХО: N queries
foreach ($data as $item) {
    Product::create($item);  // N insert queries
}

// ✅ ХОРОШО: 1 query
Product::insert($data);

// Или с timestamps
$now = now();
$data = array_map(function ($item) use ($now) {
    return array_merge($item, [
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}, $data);

Product::insert($data);
```

---

## Database Connection Pool

**Persistent connections:**

```php
// config/database.php
'mysql' => [
    'driver' => 'mysql',
    'host' => env('DB_HOST'),
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
    'options' => [
        PDO::ATTR_PERSISTENT => true,  // Persistent connection
    ],
],
```

**Read/Write connections:**

```php
'mysql' => [
    'read' => [
        'host' => ['192.168.1.1', '192.168.1.2'],  // Read replicas
    ],
    'write' => [
        'host' => ['192.168.1.3'],  // Master
    ],
    'sticky' => true,  // Читать с write после записи
],
```

---

## На собеседовании скажешь

> "Database optimization: избегать N+1 через eager loading (with). Индексы на WHERE, ORDER BY, JOIN колонки. SELECT только нужные поля. Пагинация вместо all(). Chunk/lazy для больших объёмов. withCount для COUNT. Кешировать агрегаты. Fulltext index для поиска. Batch insert вместо N queries. EXPLAIN для анализа. Read/write replicas для масштабирования."

---

## Практические задания

### Задание 1: Исправь N+1 проблему

Найди и исправь N+1 проблему в коде.

```php
// Контроллер
public function index()
{
    $posts = Post::where('published', true)->get();

    return view('posts.index', compact('posts'));
}

// View
@foreach($posts as $post)
    <h2>{{ $post->title }}</h2>
    <p>Автор: {{ $post->user->name }}</p>
    <p>Комментариев: {{ $post->comments->count() }}</p>
    <p>Категория: {{ $post->category->name }}</p>
@endforeach
```

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: 1 + N (users) + N (comments) + N (categories) queries

// ✅ ХОРОШО: 4 queries total
public function index()
{
    $posts = Post::where('published', true)
        ->with(['user', 'category'])  // Eager load relationships
        ->withCount('comments')        // COUNT в одном запросе
        ->get();

    return view('posts.index', compact('posts'));
}

// View (без изменений)
@foreach($posts as $post)
    <h2>{{ $post->title }}</h2>
    <p>Автор: {{ $post->user->name }}</p>
    <p>Комментариев: {{ $post->comments_count }}</p>
    <p>Категория: {{ $post->category->name }}</p>
@endforeach

// Queries:
// 1. SELECT * FROM posts WHERE published = 1
// 2. SELECT * FROM users WHERE id IN (1, 2, 3, ...)
// 3. SELECT * FROM categories WHERE id IN (1, 2, 3, ...)
// 4. SELECT post_id, COUNT(*) FROM comments WHERE post_id IN (...) GROUP BY post_id
```
</details>

### Задание 2: Оптимизация с индексами

Создай миграцию с правильными индексами для таблицы `products`. Запросы: фильтр по category_id, поиск по name, сортировка по price.

<details>
<summary>Решение</summary>

```php
// database/migrations/xxxx_create_products_table.php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('slug')->unique();
    $table->text('description')->nullable();
    $table->decimal('price', 10, 2);
    $table->integer('stock')->default(0);
    $table->foreignId('category_id')->constrained()->onDelete('cascade');
    $table->boolean('is_active')->default(true);
    $table->timestamps();

    // Индексы для оптимизации запросов
    $table->index('category_id');           // WHERE category_id
    $table->index('name');                  // WHERE name LIKE / ORDER BY name
    $table->index('price');                 // ORDER BY price

    // Composite index для частых запросов
    $table->index(['category_id', 'is_active', 'price']);  // WHERE category_id AND is_active ORDER BY price

    // Fulltext для поиска
    $table->fullText(['name', 'description']);
});

// Использование
// ✅ Использует composite index
Product::where('category_id', 1)
    ->where('is_active', true)
    ->orderBy('price', 'asc')
    ->get();

// ✅ Использует fulltext index
Product::whereFullText(['name', 'description'], 'laptop')
    ->limit(20)
    ->get();
```
</details>

### Задание 3: Оптимизация batch операций

Оптимизируй импорт 10000 продуктов из CSV файла.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: 10000 INSERT queries
public function import(string $csvPath)
{
    $rows = $this->parseCsv($csvPath);

    foreach ($rows as $row) {
        Product::create([
            'name' => $row['name'],
            'price' => $row['price'],
            'category_id' => $row['category_id'],
        ]);
    }
}

// ✅ ХОРОШО: Batch insert + chunk
public function import(string $csvPath)
{
    $rows = $this->parseCsv($csvPath);

    // Разбить на chunks по 1000
    collect($rows)->chunk(1000)->each(function ($chunk) {
        $data = $chunk->map(function ($row) {
            return [
                'name' => $row['name'],
                'price' => $row['price'],
                'category_id' => $row['category_id'],
                'created_at' => now(),
                'updated_at' => now(),
            ];
        })->toArray();

        // 1 INSERT для 1000 строк
        Product::insert($data);
    });
}

// ✅ ЕЩЁ ЛУЧШЕ: Используем DB transaction + отключаем events
public function import(string $csvPath)
{
    Product::withoutEvents(function () use ($csvPath) {
        DB::transaction(function () use ($csvPath) {
            $rows = $this->parseCsv($csvPath);

            collect($rows)->chunk(1000)->each(function ($chunk) {
                $data = $chunk->map(function ($row) {
                    return [
                        'name' => $row['name'],
                        'price' => $row['price'],
                        'category_id' => $row['category_id'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })->toArray();

                Product::insert($data);
            });
        });
    });
}

// Производительность:
// ❌ create() в цикле: ~30 сек для 10k строк
// ✅ batch insert: ~2 сек
// ✅ + без events + transaction: ~1 сек
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
