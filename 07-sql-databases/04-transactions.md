# 6.4 Транзакции (ACID)

## Краткое резюме

> **Транзакция** — группа SQL операций, выполняющихся как единое целое. Либо все успешно, либо все откатываются.
>
> **ACID:** Atomicity (всё или ничего), Consistency (целостность), Isolation (не мешают друг другу), Durability (после commit сохранено).
>
> **Важно:** lockForUpdate() для pessimistic locking. Isolation levels: READ COMMITTED, REPEATABLE READ (default MySQL), SERIALIZABLE.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [ACID свойства](#acid-свойства)
- [Isolation Levels](#isolation-levels)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Транзакция — группа SQL операций, выполняющихся как единое целое. Либо все успешно, либо все откатываются.

**ACID свойства:**
- **Atomicity** (Атомарность) — всё или ничего
- **Consistency** (Согласованность) — данные остаются корректными
- **Isolation** (Изоляция) — транзакции не мешают друг другу
- **Durability** (Долговечность) — после commit данные сохранены

---

## Как работает

**Базовый синтаксис:**

```sql
-- Начать транзакцию
START TRANSACTION;
-- или
BEGIN;

-- Выполнить операции
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- Зафиксировать изменения
COMMIT;

-- Или откатить при ошибке
ROLLBACK;
```

**В Laravel:**

```php
use Illuminate\Support\Facades\DB;

// Автоматическая транзакция
DB::transaction(function () {
    $user = User::find(1);
    $user->decrement('balance', 100);

    $recipient = User::find(2);
    $recipient->increment('balance', 100);

    Transaction::create([
        'from_user_id' => $user->id,
        'to_user_id' => $recipient->id,
        'amount' => 100,
    ]);
});
// Автоматически COMMIT при успехе или ROLLBACK при исключении

// Ручное управление
DB::beginTransaction();

try {
    // Операции
    $user->decrement('balance', 100);
    $recipient->increment('balance', 100);

    DB::commit();
} catch (\Exception $e) {
    DB::rollBack();
    throw $e;
}
```

---

## ACID свойства

**Atomicity (Атомарность):**

Все операции выполняются полностью или не выполняются вообще.

```php
// Пример: перевод денег
DB::transaction(function () {
    // Если любая из операций провалится, все откатятся
    User::where('id', 1)->decrement('balance', 100);
    User::where('id', 2)->increment('balance', 100);
    Transaction::create(['amount' => 100]);
});

// Невозможно, чтобы деньги списались, но не начислились
```

**Consistency (Согласованность):**

База остаётся в корректном состоянии (не нарушаются constraints).

```sql
-- Constraint: balance >= 0
ALTER TABLE users ADD CONSTRAINT check_balance CHECK (balance >= 0);

START TRANSACTION;

-- Эта операция провалится, если balance < 100
UPDATE users SET balance = balance - 100 WHERE id = 1;

-- Транзакция откатится, balance останется >= 0
COMMIT;
```

**Isolation (Изоляция):**

Одновременные транзакции не мешают друг другу.

```sql
-- Транзакция 1
START TRANSACTION;
SELECT balance FROM users WHERE id = 1;  -- balance = 1000
UPDATE users SET balance = balance - 100 WHERE id = 1;
-- Ещё не COMMIT

-- Транзакция 2 (в другом подключении)
START TRANSACTION;
SELECT balance FROM users WHERE id = 1;  -- balance = 1000 (видит старое значение)
COMMIT;

-- Транзакция 1
COMMIT;  -- Теперь balance = 900
```

**Durability (Долговечность):**

После COMMIT данные сохранены навсегда (даже при сбое).

```sql
START TRANSACTION;
INSERT INTO orders (user_id, total) VALUES (1, 1000);
COMMIT;

-- Даже если сервер упадёт сразу после COMMIT,
-- запись останется в БД после перезапуска
```

---

## Isolation Levels

**Уровни изоляции (от слабого к сильному):**

1. READ UNCOMMITTED — видит незакоммиченные изменения
2. READ COMMITTED — видит только закоммиченные (по умолчанию в PostgreSQL)
3. REPEATABLE READ — фиксирует snapshot (по умолчанию в MySQL)
4. SERIALIZABLE — полная изоляция

```sql
-- Установить уровень
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

**В Laravel:**

```php
// По умолчанию REPEATABLE READ (MySQL)
DB::transaction(function () {
    // Операции
});

// Изменить уровень изоляции
DB::transaction(function () {
    DB::statement('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    // Операции
});
```

---

## Когда использовать

**Используй транзакции когда:**
- Несколько связанных операций (перевод денег)
- Нужна атомарность (всё или ничего)
- Критичная целостность данных

**Не используй когда:**
- Одиночные INSERT/UPDATE
- Только чтение (SELECT)
- Долгие операции (блокируют таблицы)

---

## Пример из практики

**Перевод денег:**

```php
class TransferService
{
    public function transfer(User $from, User $to, int $amount): Transaction
    {
        return DB::transaction(function () use ($from, $to, $amount) {
            // Проверить баланс с блокировкой
            $from = User::where('id', $from->id)
                ->lockForUpdate()  // SELECT ... FOR UPDATE
                ->first();

            if ($from->balance < $amount) {
                throw new InsufficientFundsException();
            }

            // Списать
            $from->decrement('balance', $amount);

            // Начислить
            $to = User::where('id', $to->id)
                ->lockForUpdate()
                ->first();
            $to->increment('balance', $amount);

            // Записать транзакцию
            return Transaction::create([
                'from_user_id' => $from->id,
                'to_user_id' => $to->id,
                'amount' => $amount,
                'status' => 'completed',
            ]);
        });
    }
}
```

**Создание заказа с обновлением склада:**

```php
class OrderService
{
    public function create(User $user, array $items): Order
    {
        return DB::transaction(function () use ($user, $items) {
            // Создать заказ
            $order = Order::create([
                'user_id' => $user->id,
                'total' => $this->calculateTotal($items),
                'status' => 'pending',
            ]);

            // Создать items и обновить склад
            foreach ($items as $item) {
                // Проверить наличие с блокировкой
                $product = Product::where('id', $item['product_id'])
                    ->lockForUpdate()
                    ->first();

                if ($product->stock < $item['quantity']) {
                    throw new OutOfStockException($product->name);
                }

                // Создать order item
                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'price' => $product->price,
                ]);

                // Уменьшить stock
                $product->decrement('stock', $item['quantity']);
            }

            // Списать с баланса
            $user->decrement('balance', $order->total);

            return $order;
        });
    }
}
```

**Вложенные транзакции (savepoints):**

```php
DB::transaction(function () {
    // Операция 1
    User::create(['name' => 'John']);

    try {
        DB::transaction(function () {
            // Операция 2 (может провалиться)
            Post::create(['title' => 'Invalid']);
        });
    } catch (\Exception $e) {
        // Операция 2 откатилась, но операция 1 сохранится
    }

    // Операция 3
    User::create(['name' => 'Jane']);
});
```

**Pessimistic Locking (блокировки):**

```php
// lockForUpdate() — SELECT ... FOR UPDATE (блокирует для записи)
$user = User::where('id', 1)
    ->lockForUpdate()
    ->first();

$user->increment('balance', 100);

// sharedLock() — SELECT ... LOCK IN SHARE MODE (блокирует для чтения)
$user = User::where('id', 1)
    ->sharedLock()
    ->first();
```

**Optimistic Locking (через version):**

```php
// Миграция
Schema::table('users', function (Blueprint $table) {
    $table->integer('version')->default(0);
});

// Обновление с проверкой версии
$user = User::find(1);
$currentVersion = $user->version;

$updated = User::where('id', $user->id)
    ->where('version', $currentVersion)
    ->update([
        'balance' => $user->balance + 100,
        'version' => $currentVersion + 1,
    ]);

if (!$updated) {
    throw new ConcurrentModificationException();
}
```

**Deadlock (взаимная блокировка):**

```php
// Транзакция 1
DB::transaction(function () {
    User::where('id', 1)->lockForUpdate()->first();  // Блокирует user 1
    sleep(1);
    User::where('id', 2)->lockForUpdate()->first();  // Ждёт user 2
});

// Транзакция 2 (одновременно)
DB::transaction(function () {
    User::where('id', 2)->lockForUpdate()->first();  // Блокирует user 2
    sleep(1);
    User::where('id', 1)->lockForUpdate()->first();  // Ждёт user 1
});

// Результат: DEADLOCK

// Решение: всегда блокировать в одном порядке (сначала меньший id)
$ids = [$fromUserId, $toUserId];
sort($ids);

foreach ($ids as $id) {
    User::where('id', $id)->lockForUpdate()->first();
}
```

---

## На собеседовании скажешь

> "Транзакция — группа операций, выполняющихся атомарно. ACID: Atomicity (всё или ничего), Consistency (целостность), Isolation (не мешают друг другу), Durability (после commit сохранено). В Laravel: DB::transaction() автоматически commit/rollback, DB::beginTransaction/commit/rollBack вручную. lockForUpdate() для pessimistic locking (SELECT FOR UPDATE). Isolation levels: READ COMMITTED, REPEATABLE READ (default MySQL), SERIALIZABLE. Deadlock когда две транзакции ждут друг друга — решение: блокировать в одном порядке."

---

## Практические задания

### Задание 1: Реализуй безопасный перевод баллов

Пользователь может перевести баллы другому пользователю. Реализуй транзакцию с проверкой баланса и предотвращением race condition.

<details>
<summary>Решение</summary>

```php
class PointsTransferService
{
    public function transfer(User $from, User $to, int $points): void
    {
        DB::transaction(function () use ($from, $to, $points) {
            // Получить отправителя с блокировкой
            $sender = User::where('id', $from->id)
                ->lockForUpdate()
                ->first();

            // Проверить баланс
            if ($sender->points < $points) {
                throw new InsufficientPointsException(
                    "Недостаточно баллов. Доступно: {$sender->points}"
                );
            }

            // Получить получателя с блокировкой
            $receiver = User::where('id', $to->id)
                ->lockForUpdate()
                ->first();

            // Выполнить перевод
            $sender->decrement('points', $points);
            $receiver->increment('points', $points);

            // Записать историю
            PointsTransaction::create([
                'from_user_id' => $sender->id,
                'to_user_id' => $receiver->id,
                'points' => $points,
                'type' => 'transfer',
                'created_at' => now(),
            ]);
        });
    }
}

// Тест
try {
    $service = new PointsTransferService();
    $service->transfer($user1, $user2, 100);
    echo "Перевод выполнен успешно";
} catch (InsufficientPointsException $e) {
    echo "Ошибка: " . $e->getMessage();
} catch (\Exception $e) {
    echo "Системная ошибка: " . $e->getMessage();
}
```
</details>

### Задание 2: Исправь Deadlock

Две транзакции создают deadlock. Как исправить?

```php
// Транзакция 1
DB::transaction(function () {
    User::where('id', 1)->lockForUpdate()->first();
    sleep(1);
    User::where('id', 2)->lockForUpdate()->first();
});

// Транзакция 2 (одновременно)
DB::transaction(function () {
    User::where('id', 2)->lockForUpdate()->first();
    sleep(1);
    User::where('id', 1)->lockForUpdate()->first();
});
```

<details>
<summary>Решение</summary>

```php
// ❌ Проблема: Deadlock
// Транзакция 1 блокирует user 1, ждёт user 2
// Транзакция 2 блокирует user 2, ждёт user 1
// Результат: взаимная блокировка

// ✅ Решение: Всегда блокировать в одном порядке (по ID)
class SafeTransferService
{
    public function transfer(User $from, User $to, int $amount): void
    {
        DB::transaction(function () use ($from, $to, $amount) {
            // Определить порядок блокировки (меньший ID первым)
            $ids = [$from->id, $to->id];
            sort($ids);

            // Заблокировать в одном порядке
            $users = User::whereIn('id', $ids)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $sender = $users[$from->id];
            $receiver = $users[$to->id];

            // Проверки и перевод
            if ($sender->balance < $amount) {
                throw new InsufficientFundsException();
            }

            $sender->decrement('balance', $amount);
            $receiver->increment('balance', $amount);
        });
    }
}

// Альтернативное решение: Retry при deadlock
class RetryableTransferService
{
    public function transfer(User $from, User $to, int $amount): void
    {
        $maxRetries = 3;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            try {
                DB::transaction(function () use ($from, $to, $amount) {
                    // Ваш код транзакции
                    $sender = User::where('id', $from->id)->lockForUpdate()->first();
                    $receiver = User::where('id', $to->id)->lockForUpdate()->first();

                    $sender->decrement('balance', $amount);
                    $receiver->increment('balance', $amount);
                });

                return; // Успешно
            } catch (\Illuminate\Database\QueryException $e) {
                if ($e->getCode() == 40001 || str_contains($e->getMessage(), 'Deadlock')) {
                    $attempt++;
                    if ($attempt >= $maxRetries) {
                        throw $e;
                    }
                    usleep(100000 * $attempt); // Exponential backoff
                } else {
                    throw $e;
                }
            }
        }
    }
}
```
</details>

### Задание 3: Optimistic vs Pessimistic Locking

Реализуй два подхода для обновления счётчика просмотров статьи.

<details>
<summary>Решение</summary>

```php
// Pessimistic Locking (блокировка на запись)
class PessimisticViewCounter
{
    public function increment(Post $post): void
    {
        DB::transaction(function () use ($post) {
            // Заблокировать запись
            $lockedPost = Post::where('id', $post->id)
                ->lockForUpdate()
                ->first();

            // Обновить счётчик
            $lockedPost->increment('views');
        });
    }
}

// Плюсы: Гарантированная консистентность
// Минусы: Блокирует другие транзакции (медленнее)

// Optimistic Locking (проверка версии)
class OptimisticViewCounter
{
    public function increment(Post $post): void
    {
        $maxRetries = 5;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            // Прочитать текущую версию
            $currentVersion = $post->version;
            $currentViews = $post->views;

            // Попытаться обновить с проверкой версии
            $updated = Post::where('id', $post->id)
                ->where('version', $currentVersion) // Проверка версии
                ->update([
                    'views' => $currentViews + 1,
                    'version' => $currentVersion + 1,
                ]);

            if ($updated) {
                return; // Успешно
            }

            // Если версия изменилась, повторить
            $post->refresh();
            $attempt++;
        }

        throw new ConcurrentModificationException('Не удалось обновить после нескольких попыток');
    }
}

// Плюсы: Не блокирует, быстрее для редких конфликтов
// Минусы: Требует retry логики, может быть медленнее при частых конфликтах

// Миграция для optimistic locking
Schema::table('posts', function (Blueprint $table) {
    $table->integer('version')->default(0);
});

// Когда использовать?
// Pessimistic: Частые конфликты, критичная целостность (переводы денег)
// Optimistic: Редкие конфликты, высокая нагрузка (счётчики просмотров)

// Гибридный подход: Без блокировки для счётчиков
class SimpleViewCounter
{
    public function increment(Post $post): void
    {
        // Прямое обновление без блокировки
        Post::where('id', $post->id)->increment('views');

        // Для более точного учёта можно использовать Redis
        Redis::incr("post:{$post->id}:views");

        // Периодически синхронизировать с БД
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
