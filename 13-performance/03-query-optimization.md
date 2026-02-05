# 13.3 Query Optimization

## Краткое резюме

> **Query Optimization** — оптимизация SQL запросов для ускорения работы с БД. EXPLAIN показывает план выполнения.
>
> **Инструменты:** EXPLAIN (анализ), Laravel Debugbar (отладка N+1), Query Log (мониторинг медленных запросов).
>
> **Методы:** Индексы на WHERE/ORDER BY, covering index, избегать функций в WHERE, cursor pagination для больших offset.

---

## Содержание

- [Что это](#что-это)
- [EXPLAIN](#explain)
- [Laravel Debugbar](#laravel-debugbar)
- [Оптимизация WHERE](#оптимизация-where)
- [Оптимизация JOIN](#оптимизация-join)
- [Оптимизация сортировки](#оптимизация-сортировки)
- [Оптимизация COUNT](#оптимизация-count)
- [Оптимизация UPDATE/DELETE](#оптимизация-updatedelete)
- [Практические примеры](#практические-примеры)
- [Database Profiling](#database-profiling)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Оптимизация SQL запросов для ускорения работы с БД. EXPLAIN, профилирование, избежание медленных операций.

**Инструменты:**
- EXPLAIN — план выполнения запроса
- Laravel Debugbar — отладка запросов
- Query Log — логирование запросов

---

## EXPLAIN

**Анализ запроса:**

```sql
EXPLAIN SELECT * FROM posts
WHERE user_id = 1
AND published = 1
ORDER BY created_at DESC;

-- Результат:
-- +----+-------------+-------+------------+------+---------------+-------------+---------+-------+------+----------+-------------+
-- | id | select_type | table | partitions | type | possible_keys | key         | key_len | ref   | rows | filtered | Extra       |
-- +----+-------------+-------+------------+------+---------------+-------------+---------+-------+------+----------+-------------+
-- |  1 | SIMPLE      | posts | NULL       | ref  | user_id,idx   | user_id     | 4       | const |  100 |   10.00  | Using where |
-- +----+-------------+-------+------------+------+---------------+-------------+---------+-------+------+----------+-------------+
```

**Важные колонки:**

```
type: тип доступа
  - ALL: полное сканирование (медленно)
  - index: сканирование индекса
  - range: диапазон
  - ref: по ключу
  - const: константа (быстро)

possible_keys: возможные индексы
key: использованный индекс
rows: количество сканируемых строк
Extra:
  - Using index: используется covering index (быстро)
  - Using where: фильтрация после чтения
  - Using filesort: сортировка (медленно)
  - Using temporary: временная таблица (медленно)
```

**Laravel EXPLAIN:**

```php
$query = Post::where('user_id', 1)
    ->where('published', true)
    ->orderBy('created_at', 'desc');

// Получить SQL
dd($query->toSql(), $query->getBindings());

// Или вручную через DB
DB::select('EXPLAIN ' . $query->toSql(), $query->getBindings());
```

---

## Laravel Debugbar

**Установка:**

```bash
composer require barryvdh/laravel-debugbar --dev
```

**Использование:**

```php
// Автоматически показывает:
// - Все queries
// - Время выполнения
// - Дублирующиеся queries
// - N+1 проблемы

// http://localhost:8000 → внизу панель
```

**Query Log:**

```php
// Включить логирование
DB::enableQueryLog();

// Ваш код
$users = User::with('posts')->get();

// Посмотреть queries
dd(DB::getQueryLog());

// Отключить
DB::disableQueryLog();
```

---

## Оптимизация WHERE

**Использовать индексы:**

```php
// ❌ МЕДЛЕННО: не использует индекс
Post::whereRaw('YEAR(created_at) = 2024')->get();
// SELECT * FROM posts WHERE YEAR(created_at) = 2024

// ✅ БЫСТРО: использует индекс на created_at
Post::whereBetween('created_at', ['2024-01-01', '2024-12-31'])->get();
// SELECT * FROM posts WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'

// ❌ МЕДЛЕННО: функция в WHERE
User::whereRaw('LOWER(email) = ?', [strtolower($email)])->first();

// ✅ БЫСТРО
User::where('email', strtolower($email))->first();
```

**Composite index:**

```php
// Миграция
Schema::table('posts', function (Blueprint $table) {
    $table->index(['user_id', 'published', 'created_at']);
});

// Использование (порядок важен!)
// ✅ Использует индекс
Post::where('user_id', 1)
    ->where('published', true)
    ->orderBy('created_at', 'desc')
    ->get();

// ⚠️ Не использует индекс полностью (пропущен user_id)
Post::where('published', true)
    ->orderBy('created_at', 'desc')
    ->get();
```

---

## Оптимизация JOIN

**INNER JOIN vs LEFT JOIN:**

```php
// INNER JOIN (быстрее, если нужны только связанные)
$posts = Post::join('users', 'posts.user_id', '=', 'users.id')
    ->select('posts.*', 'users.name')
    ->get();

// LEFT JOIN (если могут быть NULL)
$posts = Post::leftJoin('comments', 'posts.id', '=', 'comments.post_id')
    ->select('posts.*', DB::raw('COUNT(comments.id) as comments_count'))
    ->groupBy('posts.id')
    ->get();
```

**Избегать subqueries в SELECT:**

```php
// ❌ МЕДЛЕННО: subquery для каждой строки
$posts = DB::table('posts')
    ->select([
        'posts.*',
        DB::raw('(SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comments_count')
    ])
    ->get();

// ✅ БЫСТРО: LEFT JOIN
$posts = DB::table('posts')
    ->leftJoin('comments', 'posts.id', '=', 'comments.post_id')
    ->select('posts.*', DB::raw('COUNT(comments.id) as comments_count'))
    ->groupBy('posts.id')
    ->get();

// ✅ ИЛИ: withCount
$posts = Post::withCount('comments')->get();
```

---

## Оптимизация сортировки

**Индекс на ORDER BY:**

```php
// Миграция
Schema::table('posts', function (Blueprint $table) {
    $table->index('created_at');
});

// ✅ Использует индекс
Post::orderBy('created_at', 'desc')->get();

// ❌ Не использует индекс (функция)
Post::orderByRaw('RAND()')->get();

// ✅ Альтернатива: inRandomOrder (лучше для малых выборок)
Post::inRandomOrder()->limit(10)->get();
```

**Covering index:**

```php
// Миграция: индекс включает все нужные колонки
Schema::table('posts', function (Blueprint $table) {
    $table->index(['user_id', 'created_at', 'title']);
});

// ✅ Запрос использует только индекс (не читает таблицу)
Post::where('user_id', 1)
    ->select(['user_id', 'created_at', 'title'])
    ->orderBy('created_at', 'desc')
    ->get();

// EXPLAIN покажет "Using index"
```

---

## Оптимизация COUNT

**Избегать COUNT(*):**

```php
// ❌ МЕДЛЕННО: полное сканирование
$count = Post::count();

// ✅ Кешировать
$count = Cache::remember('posts.count', 3600, function () {
    return Post::count();
});

// ✅ Или хранить в отдельной таблице (counter cache)
// posts_count в таблице users
```

**Пагинация без COUNT:**

```php
// ❌ МЕДЛЕННО: делает COUNT(*) для total
$posts = Post::paginate(20);

// ✅ БЫСТРО: без COUNT
$posts = Post::simplePaginate(20);

// ✅ Ещё быстрее: cursor pagination
$posts = Post::orderBy('id')->cursorPaginate(20);
```

---

## Оптимизация UPDATE/DELETE

**Batch операции:**

```php
// ❌ МЕДЛЕННО: N queries
foreach ($userIds as $id) {
    User::where('id', $id)->update(['active' => false]);
}

// ✅ БЫСТРО: 1 query
User::whereIn('id', $userIds)->update(['active' => false]);
```

**Избегать UPDATE без WHERE:**

```php
// ⚠️ ОПАСНО и медленно
User::update(['last_seen_at' => now()]);

// ✅ С условием
User::where('active', true)->update(['last_seen_at' => now()]);
```

---

## Практические примеры

**Оптимизация поиска:**

```php
// ❌ МЕДЛЕННО
public function search($query)
{
    return Product::where('name', 'like', "%$query%")
        ->orWhere('description', 'like', "%$query%")
        ->get();
}

// ✅ Fulltext index
Schema::table('products', function (Blueprint $table) {
    $table->fullText(['name', 'description']);
});

public function search($query)
{
    return Product::whereFullText(['name', 'description'], $query)
        ->limit(100)
        ->get();
}
```

**Оптимизация pagination:**

```php
// ❌ МЕДЛЕННО для больших offset
Product::orderBy('id')->offset(10000)->limit(20)->get();
// SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000

// ✅ Cursor pagination (keyset)
Product::where('id', '>', $lastId)->orderBy('id')->limit(20)->get();
// SELECT * FROM products WHERE id > 10000 ORDER BY id LIMIT 20
```

**Денормализация для производительности:**

```php
// ❌ МЕДЛЕННО: COUNT на каждый запрос
public function getPosts()
{
    return Post::withCount('comments')->get();
}

// ✅ Хранить comments_count в posts таблице
Schema::table('posts', function (Blueprint $table) {
    $table->integer('comments_count')->default(0);
});

// Observer для обновления счётчика
class CommentObserver
{
    public function created(Comment $comment)
    {
        $comment->post()->increment('comments_count');
    }

    public function deleted(Comment $comment)
    {
        $comment->post()->decrement('comments_count');
    }
}
```

---

## Database Profiling

**MySQL slow query log:**

```sql
-- my.cnf
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1  -- Логировать запросы > 1 секунды

-- Анализ
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log
```

**Laravel query monitoring:**

```php
// app/Providers/AppServiceProvider.php
public function boot()
{
    if (app()->environment('local')) {
        DB::listen(function ($query) {
            if ($query->time > 1000) {  // > 1 секунды
                Log::warning('Slow query', [
                    'sql' => $query->sql,
                    'bindings' => $query->bindings,
                    'time' => $query->time,
                ]);
            }
        });
    }
}
```

---

## На собеседовании скажешь

> "Query optimization: EXPLAIN для анализа плана. Laravel Debugbar показывает N+1. Индексы на WHERE, ORDER BY, JOIN колонки. Covering index включает все SELECT поля. Composite index: порядок колонок важен. Избегать функций в WHERE. simplePaginate без COUNT. Cursor pagination для больших offset. Fulltext index для поиска. Batch операции вместо N queries. Денормализация для COUNT. Slow query log для мониторинга."

---

## Практические задания

### Задание 1: Оптимизация запроса с EXPLAIN

Проанализируй и оптимизируй запрос используя EXPLAIN.

```php
// Медленный запрос
$users = DB::table('users')
    ->whereRaw('YEAR(created_at) = 2024')
    ->where('status', 'active')
    ->orderBy('created_at', 'desc')
    ->get();
```

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: YEAR(created_at) не использует индекс
// EXPLAIN покажет: type = ALL (полное сканирование)

// ✅ ХОРОШО: убрать функцию из WHERE
$users = DB::table('users')
    ->whereBetween('created_at', ['2024-01-01', '2024-12-31 23:59:59'])
    ->where('status', 'active')
    ->orderBy('created_at', 'desc')
    ->get();

// Миграция: composite index
Schema::table('users', function (Blueprint $table) {
    $table->index(['status', 'created_at']);
});

// EXPLAIN теперь покажет:
// type = range (использует индекс)
// key = status_created_at_index
// rows = ~100 (вместо 10000)

// Проверка в Laravel
DB::enableQueryLog();
// ... запрос ...
dd(DB::getQueryLog());

// SQL для EXPLAIN
EXPLAIN SELECT * FROM users
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'
AND status = 'active'
ORDER BY created_at DESC;
```
</details>

### Задание 2: Cursor Pagination

Реализуй эффективную пагинацию для большой таблицы (1 млн строк) без использования OFFSET.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: OFFSET медленный для больших значений
public function index(Request $request)
{
    $page = $request->get('page', 1);
    $perPage = 20;

    // SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 100000
    // Сканирует 100020 строк!
    return Post::orderBy('id')->paginate($perPage);
}

// ✅ ХОРОШО: Cursor pagination (keyset)
public function index(Request $request)
{
    $lastId = $request->get('last_id', 0);
    $perPage = 20;

    // SELECT * FROM posts WHERE id > 100000 ORDER BY id LIMIT 20
    // Сканирует только 20 строк!
    $posts = Post::where('id', '>', $lastId)
        ->orderBy('id')
        ->limit($perPage)
        ->get();

    return response()->json([
        'data' => $posts,
        'meta' => [
            'last_id' => $posts->last()?->id,
            'has_more' => $posts->count() === $perPage,
        ],
    ]);
}

// ✅ Laravel встроенный cursor pagination
public function index()
{
    return Post::orderBy('id')->cursorPaginate(20);
}

// Response:
// {
//   "data": [...],
//   "next_cursor": "eyJpZCI6MTAwMDJ9",
//   "prev_cursor": null
// }

// Производительность:
// OFFSET 100000: ~500ms
// Cursor (WHERE id > 100000): ~5ms
```
</details>

### Задание 3: Denormalization для производительности

Оптимизируй подсчёт комментариев для постов используя денормализацию.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: COUNT на каждый запрос
public function index()
{
    return Post::withCount('comments')->get();
    // SELECT *, (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comments_count
}

// ✅ ХОРОШО: Денормализация - хранить счётчик в таблице
// Миграция
Schema::table('posts', function (Blueprint $table) {
    $table->integer('comments_count')->default(0)->after('content');
    $table->index('comments_count'); // Для сортировки по популярности
});

// Заполнить существующие
DB::statement('
    UPDATE posts
    SET comments_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE comments.post_id = posts.id
    )
');

// Observer для автообновления
class CommentObserver
{
    public function created(Comment $comment)
    {
        $comment->post()->increment('comments_count');
        Cache::forget("post.{$comment->post_id}");
    }

    public function deleted(Comment $comment)
    {
        $comment->post()->decrement('comments_count');
        Cache::forget("post.{$comment->post_id}");
    }
}

// Теперь простой запрос
public function index()
{
    return Post::select(['id', 'title', 'comments_count'])
        ->orderBy('comments_count', 'desc')
        ->get();
    // SELECT id, title, comments_count FROM posts ORDER BY comments_count DESC
}

// Производительность:
// withCount(): ~200ms для 10k постов
// denormalized: ~10ms
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
