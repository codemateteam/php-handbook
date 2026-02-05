# 6.7 Оптимизация запросов

## Краткое резюме

> **Оптимизация запросов** — повышение скорости выполнения SQL через индексы, переписывание запросов, кеширование.
>
> **Техники:** Индексы на WHERE/ORDER BY, select только нужные поля, eager loading, chunk/lazy для больших данных, exists() вместо count().
>
> **Важно:** EXPLAIN показывает plan запроса. Composite индекс для WHERE + ORDER BY. Batch insert вместо N запросов.

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
Оптимизация запросов — повышение скорости выполнения SQL через индексы, переписывание запросов, кеширование.

**Основные техники:**
- Индексы
- SELECT только нужные поля
- Eager Loading (N+1)
- Chunk для больших данных
- Кеширование

---

## Как работает

**SELECT только нужные поля:**

```php
// ❌ Загружает все поля (медленно)
$users = User::all();

// ✅ Загружает только нужные
$users = User::select('id', 'name', 'email')->get();

// Eloquent relationship
$posts = Post::with(['user' => function ($query) {
    $query->select('id', 'name');  // Только id и name
}])->get();
```

**Индексы:**

```php
// ❌ Без индекса (Full Table Scan)
SELECT * FROM users WHERE email = 'john@example.com';

// ✅ С индексом (Index Seek)
Schema::table('users', function (Blueprint $table) {
    $table->index('email');
});
```

**Chunk для больших данных:**

```php
// ❌ Загружает все в память (Memory Limit)
$users = User::all();

foreach ($users as $user) {
    processUser($user);
}

// ✅ Обработка по частям
User::chunk(100, function ($users) {
    foreach ($users as $user) {
        processUser($user);
    }
});

// Или lazy (Generator)
User::lazy()->each(function ($user) {
    processUser($user);
});
```

**EXISTS вместо COUNT:**

```php
// ❌ Медленно (считает все записи)
if (Post::where('user_id', $userId)->count() > 0) {
    // ...
}

// ✅ Быстро (останавливается на первой найденной)
if (Post::where('user_id', $userId)->exists()) {
    // ...
}
```

**Limit в подзапросах:**

```php
// ❌ Загружает все посты, затем фильтрует
$users = User::with('posts')->get();

// ✅ Ограничить количество постов
$users = User::with(['posts' => function ($query) {
    $query->limit(5);
}])->get();
```

---

## Когда использовать

**Используй оптимизацию когда:**
- Медленные запросы (> 100ms)
- Большие таблицы (> 10k записей)
- Частые запросы
- High traffic

**Не трать время когда:**
- Маленькие таблицы
- Редкие запросы
- Микрооптимизация

---

## Пример из практики

**EXPLAIN анализ:**

```php
// Включить Query Log
DB::enableQueryLog();

User::where('email', 'john@example.com')->get();

$queries = DB::getQueryLog();

// Анализировать через EXPLAIN
DB::statement('EXPLAIN ' . $queries[0]['query']);
```

**Оптимизация JOIN:**

```php
// ❌ Много JOIN (медленно)
$posts = Post::join('users', 'posts.user_id', '=', 'users.id')
    ->join('categories', 'posts.category_id', '=', 'categories.id')
    ->join('tags', 'posts.tag_id', '=', 'tags.id')
    ->get();

// ✅ Eager Loading (быстрее)
$posts = Post::with(['user', 'category', 'tags'])->get();
```

**Raw SQL для сложных запросов:**

```php
// ❌ Eloquent (медленно для сложной логики)
$users = User::with('orders')
    ->get()
    ->filter(function ($user) {
        return $user->orders->sum('total') > 1000;
    });

// ✅ Raw SQL с подзапросом
$users = DB::table('users')
    ->join(DB::raw('(SELECT user_id, SUM(total) as total_spent
                     FROM orders
                     GROUP BY user_id) as order_totals'),
        'users.id', '=', 'order_totals.user_id')
    ->where('order_totals.total_spent', '>', 1000)
    ->get();

// Или Query Builder
$users = User::whereHas('orders', function ($query) {
    $query->havingRaw('SUM(total) > ?', [1000]);
})->get();
```

**Avoid OR (используй UNION):**

```php
// ❌ OR может не использовать индексы
User::where('status', 'active')
    ->orWhere('is_vip', true)
    ->get();

// ✅ UNION
User::where('status', 'active')
    ->union(User::where('is_vip', true))
    ->get();
```

**Денормализация для часто читаемых данных:**

```php
// ❌ JOIN при каждом запросе
$posts = Post::join('users', 'posts.user_id', '=', 'users.id')
    ->select('posts.*', 'users.name as author_name')
    ->get();

// ✅ Хранить author_name в posts
Schema::table('posts', function (Blueprint $table) {
    $table->string('author_name')->nullable();
});

Post::creating(function (Post $post) {
    $post->author_name = $post->user->name;
});

// Теперь без JOIN
$posts = Post::select('id', 'title', 'author_name')->get();
```

**Индексы для ORDER BY:**

```php
// ❌ Без индекса на created_at (Filesort)
$posts = Post::orderBy('created_at', 'desc')->paginate(20);

// ✅ С индексом
Schema::table('posts', function (Blueprint $table) {
    $table->index('created_at');
});

// Составной индекс для WHERE + ORDER BY
Schema::table('posts', function (Blueprint $table) {
    $table->index(['status', 'created_at']);
});

$posts = Post::where('status', 'published')
    ->orderBy('created_at', 'desc')
    ->paginate(20);
```

**Кеширование запросов:**

```php
// Кешировать результат
$users = Cache::remember('users.all', 3600, function () {
    return User::all();
});

// Тегированный кеш
$posts = Cache::tags(['posts'])->remember('posts.published', 3600, function () {
    return Post::where('published', true)->get();
});

// Сбросить при обновлении
Post::created(function () {
    Cache::tags(['posts'])->flush();
});
```

**Query caching (MySQL):**

```php
// MySQL Query Cache (устарело в MySQL 8.0)
// Используйте Redis/Memcached вместо этого
```

**Pagination вместо get():**

```php
// ❌ Загружает все (медленно для больших данных)
$posts = Post::where('published', true)->get();

// ✅ Пагинация
$posts = Post::where('published', true)->paginate(20);

// Простая пагинация (без total count)
$posts = Post::where('published', true)->simplePaginate(20);

// Cursor pagination (для больших данных)
$posts = Post::where('published', true)->cursorPaginate(20);
```

**Batch Insert:**

```php
// ❌ N INSERT запросов
foreach ($data as $item) {
    User::create($item);
}

// ✅ Один запрос
User::insert($data);

// Или с timestamps
$now = now();
$data = array_map(function ($item) use ($now) {
    return array_merge($item, [
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}, $data);

User::insert($data);
```

**Update с условием (без загрузки модели):**

```php
// ❌ Загружает модель
$user = User::find($id);
$user->increment('views');

// ✅ Обновляет напрямую
User::where('id', $id)->increment('views');

// Bulk update
User::where('status', 'pending')
    ->where('created_at', '<', now()->subDays(30))
    ->update(['status' => 'expired']);
```

**Select distinct вместо pluck + unique:**

```php
// ❌ Загружает все, затем unique
$emails = User::pluck('email')->unique();

// ✅ DISTINCT в SQL
$emails = User::select('email')->distinct()->pluck('email');
```

---

## На собеседовании скажешь

> "Оптимизация: индексы на WHERE/ORDER BY/JOIN, select только нужные поля, eager loading для N+1, chunk/lazy для больших данных, exists() вместо count(), кеширование результатов. EXPLAIN показывает plan запроса. Composite индекс для WHERE + ORDER BY. Денормализация для часто читаемых данных. Batch insert вместо N запросов. Update без загрузки модели. Cursor pagination для больших данных. simplePaginate() без подсчёта total."

---

## Практические задания

### Задание 1: Оптимизируй медленный запрос

Запрос выполняется 5 секунд. Как оптимизировать?

```php
$users = User::all();

foreach ($users as $user) {
    $totalSpent = Order::where('user_id', $user->id)
        ->where('status', 'completed')
        ->sum('total');

    if ($totalSpent > 1000) {
        $user->update(['is_vip' => true]);
    }
}
```

<details>
<summary>Решение</summary>

```php
// ❌ Проблемы:
// 1. User::all() загружает всех пользователей в память
// 2. N запросов для подсчёта sum (по одному на каждого пользователя)
// 3. N запросов для update

// ✅ Решение 1: Один запрос с подзапросом
DB::table('users')
    ->update([
        'is_vip' => DB::raw('(
            SELECT CASE
                WHEN COALESCE(SUM(total), 0) > 1000 THEN 1
                ELSE 0
            END
            FROM orders
            WHERE orders.user_id = users.id
              AND orders.status = "completed"
        )')
    ]);

// ✅ Решение 2: JOIN + GROUP BY + UPDATE
DB::statement('
    UPDATE users
    INNER JOIN (
        SELECT user_id, SUM(total) as total_spent
        FROM orders
        WHERE status = "completed"
        GROUP BY user_id
        HAVING total_spent > 1000
    ) as order_totals ON users.id = order_totals.user_id
    SET users.is_vip = 1
');

// ✅ Решение 3: Chunk для обработки по частям (если нужна логика в PHP)
User::chunk(100, function ($users) {
    $userIds = $users->pluck('id');

    // Получить суммы для всех пользователей чанка одним запросом
    $totals = Order::select('user_id', DB::raw('SUM(total) as total_spent'))
        ->whereIn('user_id', $userIds)
        ->where('status', 'completed')
        ->groupBy('user_id')
        ->pluck('total_spent', 'user_id');

    // Определить VIP пользователей
    $vipIds = $totals->filter(fn($total) => $total > 1000)->keys();

    // Batch update
    if ($vipIds->isNotEmpty()) {
        User::whereIn('id', $vipIds)->update(['is_vip' => true]);
    }
});

// ✅ Решение 4: Денормализация (лучшее для частых запросов)
// Добавить поле total_spent в users
Schema::table('users', function (Blueprint $table) {
    $table->decimal('total_spent', 10, 2)->default(0);
    $table->boolean('is_vip')->default(false);
    $table->index('total_spent');
});

// Обновлять при создании заказа
class Order extends Model
{
    protected static function booted(): void
    {
        static::created(function (Order $order) {
            if ($order->status === 'completed') {
                $order->user->increment('total_spent', $order->total);
                $order->user->updateVipStatus();
            }
        });

        static::updated(function (Order $order) {
            if ($order->wasChanged('status') && $order->status === 'completed') {
                $order->user->increment('total_spent', $order->total);
                $order->user->updateVipStatus();
            }
        });
    }
}

class User extends Model
{
    public function updateVipStatus(): void
    {
        $this->update(['is_vip' => $this->total_spent > 1000]);
    }
}

// Теперь быстро:
$vipUsers = User::where('is_vip', true)->get();
```
</details>

### Задание 2: Оптимизируй пагинацию

У таблицы 10 миллионов записей. Пагинация медленная на последних страницах. Почему и как исправить?

```php
// Медленно на странице 100000
$posts = Post::orderBy('created_at', 'desc')
    ->paginate(20);
```

<details>
<summary>Решение</summary>

```php
// ❌ Проблема: OFFSET растёт
// На странице 100000: OFFSET 2000000
// MySQL должен прочитать и пропустить 2 млн записей

// ✅ Решение 1: Cursor Pagination (для больших offset)
$posts = Post::orderBy('created_at', 'desc')
    ->orderBy('id', 'desc')  // Важно: добавить уникальный ключ
    ->cursorPaginate(20);

// Cursor использует WHERE вместо OFFSET:
// WHERE (created_at < '2024-01-01' OR (created_at = '2024-01-01' AND id < 12345))
// LIMIT 20

// В Blade
{{ $posts->links() }}  // Работает автоматически

// ✅ Решение 2: Keyset Pagination (ручная реализация)
// Запомнить последний ID
$lastId = request('last_id');

$posts = Post::where('id', '<', $lastId ?? PHP_INT_MAX)
    ->orderBy('id', 'desc')
    ->limit(20)
    ->get();

// В ответе вернуть last_id для следующей страницы
return [
    'data' => $posts,
    'next_page' => $posts->isNotEmpty() ? $posts->last()->id : null,
];

// ✅ Решение 3: simplePaginate (без total count)
$posts = Post::orderBy('created_at', 'desc')
    ->simplePaginate(20);

// Не вычисляет total count (быстрее)
// Показывает только "Назад" и "Вперёд"

// ✅ Решение 4: Индекс для ORDER BY + LIMIT
Schema::table('posts', function (Blueprint $table) {
    $table->index(['created_at', 'id']);  // Composite index
});

// Теперь MySQL может использовать индекс для ORDER BY
// и эффективно пропустить OFFSET записей

// ✅ Решение 5: Денормализация + поиск
// Для поиска по тексту + пагинация
// Использовать Elasticsearch или Meilisearch
$posts = Post::search(request('q'))
    ->paginate(20);
```
</details>

### Задание 3: Batch операции

Нужно создать 10000 пользователей из CSV файла. Как сделать быстро?

<details>
<summary>Решение</summary>

```php
// ❌ Медленно: 10000 INSERT запросов
foreach ($csvData as $row) {
    User::create([
        'name' => $row['name'],
        'email' => $row['email'],
    ]);
}

// ✅ Решение 1: Batch Insert
$users = [];
foreach ($csvData as $row) {
    $users[] = [
        'name' => $row['name'],
        'email' => $row['email'],
        'created_at' => now(),
        'updated_at' => now(),
    ];
}

// Один INSERT запрос
User::insert($users);

// ✅ Решение 2: Chunk для больших данных
collect($csvData)->chunk(1000)->each(function ($chunk) {
    $users = $chunk->map(fn($row) => [
        'name' => $row['name'],
        'email' => $row['email'],
        'created_at' => now(),
        'updated_at' => now(),
    ])->toArray();

    User::insert($users);
});

// ✅ Решение 3: Bulk Insert с upsert (Laravel 8+)
User::upsert(
    $users,
    ['email'],  // Уникальное поле
    ['name', 'updated_at']  // Обновить если существует
);

// ✅ Решение 4: LOAD DATA INFILE (самый быстрый)
// 1. Сохранить CSV
$csvPath = storage_path('app/users.csv');

// 2. Загрузить через MySQL
DB::statement("
    LOAD DATA LOCAL INFILE '{$csvPath}'
    INTO TABLE users
    FIELDS TERMINATED BY ','
    ENCLOSED BY '\"'
    LINES TERMINATED BY '\\n'
    IGNORE 1 ROWS
    (name, email)
    SET created_at = NOW(), updated_at = NOW()
");

// ✅ Решение 5: Queue для фоновой обработки
ImportUsersFromCsv::dispatch($csvPath);

// Job
class ImportUsersFromCsv implements ShouldQueue
{
    public function handle(): void
    {
        $csv = Reader::createFromPath($this->csvPath);

        foreach ($csv->chunk(1000) as $chunk) {
            $users = $chunk->map(fn($row) => [
                'name' => $row['name'],
                'email' => $row['email'],
                'created_at' => now(),
                'updated_at' => now(),
            ])->toArray();

            User::insert($users);
        }
    }
}

// Сравнение производительности:
// create() x 10000: ~30 секунд
// insert() (batch): ~2 секунды
// LOAD DATA INFILE: ~0.5 секунды
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
