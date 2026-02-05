# 5.2 Query Builder

## Краткое резюме

> **Query Builder** — fluent интерфейс для построения SQL запросов без написания чистого SQL.
>
> **Основа:** `DB::table('users')` + методы `where()`, `join()`, `groupBy()`, `orderBy()`.
>
> **Защита:** автоматическая защита от SQL injection через параметры.

---

## Содержание

- [Что это](#что-это)
- [Базовые запросы](#как-работает)
- [INSERT, UPDATE, DELETE](#как-работает)
- [JOIN](#как-работает)
- [Aggregates](#как-работает)
- [Транзакции](#пример-из-практики)
- [Когда использовать](#когда-использовать)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Query Builder — fluent интерфейс для построения SQL запросов. Защищает от SQL injection, поддерживает все базы данных.

**Основное:**
- `DB::table()` — начало запроса
- Fluent методы: where, join, groupBy, orderBy
- Защита от SQL injection

---

## Как работает

**Базовые запросы:**

```php
use Illuminate\Support\Facades\DB;

// SELECT
$users = DB::table('users')->get();
$user = DB::table('users')->where('id', 1)->first();
$email = DB::table('users')->where('id', 1)->value('email');

// SELECT с условиями
$users = DB::table('users')
    ->where('active', true)
    ->where('age', '>', 18)
    ->get();

// OR условие
$users = DB::table('users')
    ->where('role', 'admin')
    ->orWhere('role', 'moderator')
    ->get();

// WHERE IN
$users = DB::table('users')
    ->whereIn('id', [1, 2, 3])
    ->get();

// WHERE BETWEEN
$users = DB::table('users')
    ->whereBetween('age', [18, 65])
    ->get();

// WHERE NULL
$users = DB::table('users')
    ->whereNull('deleted_at')
    ->get();

// WHERE LIKE
$users = DB::table('users')
    ->where('name', 'like', '%John%')
    ->get();
```

**INSERT:**

```php
// Вставить одну запись
DB::table('users')->insert([
    'name' => 'John',
    'email' => 'john@example.com',
]);

// Вставить несколько
DB::table('users')->insert([
    ['name' => 'John', 'email' => 'john@example.com'],
    ['name' => 'Jane', 'email' => 'jane@example.com'],
]);

// Вставить и получить ID
$id = DB::table('users')->insertGetId([
    'name' => 'John',
    'email' => 'john@example.com',
]);

// Вставить или обновить (upsert)
DB::table('users')->upsert([
    ['email' => 'john@example.com', 'name' => 'John'],
    ['email' => 'jane@example.com', 'name' => 'Jane'],
], ['email'], ['name']);  // Уникальные поля, обновляемые поля
```

**UPDATE:**

```php
// Обновить
DB::table('users')
    ->where('id', 1)
    ->update(['name' => 'John Doe']);

// Инкремент/декремент
DB::table('users')->increment('views');
DB::table('users')->increment('views', 5);
DB::table('users')->decrement('likes');

// Инкремент с дополнительным update
DB::table('users')->increment('views', 1, ['updated_at' => now()]);

// Update or Insert
DB::table('users')->updateOrInsert(
    ['email' => 'john@example.com'],  // Условие поиска
    ['name' => 'John', 'active' => true]  // Данные для update/insert
);
```

**DELETE:**

```php
// Удалить
DB::table('users')->where('id', 1)->delete();

// Удалить все
DB::table('users')->delete();

// Truncate (быстрее)
DB::table('users')->truncate();
```

**JOIN:**

```php
// INNER JOIN
$users = DB::table('users')
    ->join('profiles', 'users.id', '=', 'profiles.user_id')
    ->select('users.*', 'profiles.bio')
    ->get();

// LEFT JOIN
$users = DB::table('users')
    ->leftJoin('profiles', 'users.id', '=', 'profiles.user_id')
    ->get();

// Multiple JOIN
$users = DB::table('users')
    ->join('orders', 'users.id', '=', 'orders.user_id')
    ->join('products', 'orders.product_id', '=', 'products.id')
    ->select('users.name', 'products.name as product')
    ->get();

// JOIN с условием
$users = DB::table('users')
    ->join('posts', function ($join) {
        $join->on('users.id', '=', 'posts.user_id')
             ->where('posts.published', true);
    })
    ->get();
```

**Aggregates:**

```php
// COUNT
$count = DB::table('users')->count();
$activeCount = DB::table('users')->where('active', true)->count();

// SUM, AVG, MIN, MAX
$sum = DB::table('orders')->sum('amount');
$avg = DB::table('orders')->avg('amount');
$min = DB::table('products')->min('price');
$max = DB::table('products')->max('price');

// Существование
$exists = DB::table('users')->where('email', 'john@example.com')->exists();
$notExists = DB::table('users')->where('email', 'john@example.com')->doesntExist();
```

**GROUP BY, HAVING:**

```php
// Группировка
$users = DB::table('orders')
    ->select('user_id', DB::raw('SUM(amount) as total'))
    ->groupBy('user_id')
    ->get();

// HAVING
$users = DB::table('orders')
    ->select('user_id', DB::raw('SUM(amount) as total'))
    ->groupBy('user_id')
    ->having('total', '>', 1000)
    ->get();
```

**ORDER BY, LIMIT:**

```php
// Сортировка
$users = DB::table('users')
    ->orderBy('name', 'asc')
    ->orderBy('created_at', 'desc')
    ->get();

// Случайная сортировка
$users = DB::table('users')->inRandomOrder()->get();

// LIMIT, OFFSET
$users = DB::table('users')->limit(10)->get();
$users = DB::table('users')->offset(10)->limit(10)->get();

// Пагинация
$users = DB::table('users')->paginate(15);
```

---

## Когда использовать

**Query Builder когда:**
- Сложные JOIN запросы
- Агрегатные функции
- Raw SQL с параметрами
- Bulk операции

**Eloquent когда:**
- CRUD операции
- Работа с relationships
- Events, observers
- Soft deletes

---

## Пример из практики

**Сложный запрос с JOIN и агрегацией:**

```php
// Пользователи с количеством заказов и общей суммой
$users = DB::table('users')
    ->leftJoin('orders', 'users.id', '=', 'orders.user_id')
    ->select(
        'users.id',
        'users.name',
        'users.email',
        DB::raw('COUNT(orders.id) as orders_count'),
        DB::raw('COALESCE(SUM(orders.amount), 0) as total_spent')
    )
    ->groupBy('users.id', 'users.name', 'users.email')
    ->having('orders_count', '>', 0)
    ->orderBy('total_spent', 'desc')
    ->get();
```

**Subqueries:**

```php
// Пользователи с последним заказом
$latestOrders = DB::table('orders')
    ->select('user_id', DB::raw('MAX(created_at) as last_order_date'))
    ->groupBy('user_id');

$users = DB::table('users')
    ->joinSub($latestOrders, 'latest_orders', function ($join) {
        $join->on('users.id', '=', 'latest_orders.user_id');
    })
    ->get();

// Или через whereIn с subquery
$activeUsers = DB::table('users')
    ->whereIn('id', function ($query) {
        $query->select('user_id')
              ->from('orders')
              ->where('created_at', '>', now()->subDays(30));
    })
    ->get();
```

**Transactions:**

```php
DB::transaction(function () {
    DB::table('users')->where('id', 1)->update(['balance' => DB::raw('balance - 100')]);
    DB::table('users')->where('id', 2)->update(['balance' => DB::raw('balance + 100')]);

    DB::table('transactions')->insert([
        'from_user_id' => 1,
        'to_user_id' => 2,
        'amount' => 100,
    ]);
});

// Ручное управление транзакциями
DB::beginTransaction();

try {
    // Запросы
    DB::table('users')->where('id', 1)->update(['balance' => DB::raw('balance - 100')]);
    DB::table('users')->where('id', 2)->update(['balance' => DB::raw('balance + 100')]);

    DB::commit();
} catch (\Exception $e) {
    DB::rollBack();
    throw $e;
}
```

**Raw expressions:**

```php
// DB::raw() для сложных выражений
$users = DB::table('users')
    ->select(DB::raw('COUNT(*) as user_count, status'))
    ->where('status', '<>', 1)
    ->groupBy('status')
    ->get();

// WHERE RAW
$users = DB::table('users')
    ->whereRaw('age > ? and votes = 100', [25])
    ->get();

// ORDER BY RAW
$users = DB::table('users')
    ->orderByRaw('updated_at - created_at DESC')
    ->get();
```

**Chunking (обработка больших данных):**

```php
// Обработка по частям (экономия памяти)
DB::table('users')->orderBy('id')->chunk(100, function ($users) {
    foreach ($users as $user) {
        // Обработать пользователя
        processUser($user);
    }
});

// Lazy (Generator под капотом)
DB::table('users')->orderBy('id')->lazy()->each(function ($user) {
    processUser($user);
});

// Cursor (Generator)
foreach (DB::table('users')->cursor() as $user) {
    processUser($user);
}
```

**Conditional Clauses:**

```php
$role = request('role');
$status = request('status');

$users = DB::table('users')
    ->when($role, function ($query, $role) {
        return $query->where('role', $role);
    })
    ->when($status, function ($query, $status) {
        return $query->where('status', $status);
    })
    ->get();

// unless (противоположность when)
$users = DB::table('users')
    ->unless(auth()->user()->isAdmin(), function ($query) {
        return $query->where('user_id', auth()->id());
    })
    ->get();
```

**Debugging:**

```php
// Получить SQL запрос
$query = DB::table('users')->where('active', true)->toSql();
// SELECT * FROM users WHERE active = ?

// С параметрами
$query = DB::table('users')->where('active', true);
dd($query->toSql(), $query->getBindings());

// Вывести запрос в лог
DB::enableQueryLog();

DB::table('users')->where('active', true)->get();

$queries = DB::getQueryLog();
dd($queries);

// Вывести все запросы (в AppServiceProvider)
DB::listen(function ($query) {
    Log::info('Query', [
        'sql' => $query->sql,
        'bindings' => $query->bindings,
        'time' => $query->time,
    ]);
});
```

---

## На собеседовании скажешь

> "Query Builder — fluent интерфейс для SQL с защитой от инъекций. DB::table() для начала, методы where/join/groupBy/orderBy для построения. Transactions через DB::transaction() или beginTransaction/commit/rollBack. chunk/lazy/cursor для больших данных (экономия памяти). DB::raw() для сложных выражений. when() для условных clauses. toSql()/getBindings() для отладки. Использую Query Builder для сложных JOIN и агрегаций, Eloquent для CRUD и relationships."

---

## Практические задания

### Задание 1: Построй сложный отчет

Получи список пользователей с количеством их заказов и общей суммой покупок за последние 30 дней.

<details>
<summary>Решение</summary>

```php
$users = DB::table('users')
    ->leftJoin('orders', function ($join) {
        $join->on('users.id', '=', 'orders.user_id')
             ->where('orders.created_at', '>=', now()->subDays(30));
    })
    ->select(
        'users.id',
        'users.name',
        'users.email',
        DB::raw('COUNT(orders.id) as orders_count'),
        DB::raw('COALESCE(SUM(orders.total), 0) as total_spent')
    )
    ->groupBy('users.id', 'users.name', 'users.email')
    ->orderBy('total_spent', 'desc')
    ->get();
```
</details>

### Задание 2: Реализуй транзакцию перевода

Реализуй перевод денег между двумя пользователями с проверкой баланса.

<details>
<summary>Решение</summary>

```php
public function transfer(int $fromUserId, int $toUserId, float $amount): void
{
    DB::transaction(function () use ($fromUserId, $toUserId, $amount) {
        // Получить баланс отправителя с блокировкой
        $fromUser = DB::table('users')
            ->where('id', $fromUserId)
            ->lockForUpdate()
            ->first();

        if (!$fromUser || $fromUser->balance < $amount) {
            throw new \Exception('Insufficient funds');
        }

        // Списать у отправителя
        DB::table('users')
            ->where('id', $fromUserId)
            ->update(['balance' => DB::raw("balance - {$amount}")]);

        // Зачислить получателю
        DB::table('users')
            ->where('id', $toUserId)
            ->update(['balance' => DB::raw("balance + {$amount}")]);

        // Записать транзакцию
        DB::table('transactions')->insert([
            'from_user_id' => $fromUserId,
            'to_user_id' => $toUserId,
            'amount' => $amount,
            'created_at' => now(),
        ]);
    });
}
```
</details>

### Задание 3: Обработай большую выборку

Обнови поле `status` для 100,000 неактивных пользователей порциями, чтобы не упала память.

<details>
<summary>Решение</summary>

```php
// Вариант 1: chunk
DB::table('users')
    ->where('last_login_at', '<', now()->subYear())
    ->where('status', 'active')
    ->orderBy('id')
    ->chunk(1000, function ($users) {
        $ids = $users->pluck('id');

        DB::table('users')
            ->whereIn('id', $ids)
            ->update([
                'status' => 'inactive',
                'updated_at' => now(),
            ]);

        Log::info("Updated {$users->count()} users");
    });

// Вариант 2: lazy (более эффективно)
DB::table('users')
    ->where('last_login_at', '<', now()->subYear())
    ->where('status', 'active')
    ->orderBy('id')
    ->lazy(1000)
    ->each(function ($user) {
        DB::table('users')
            ->where('id', $user->id)
            ->update(['status' => 'inactive']);
    });
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
