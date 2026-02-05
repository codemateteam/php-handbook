# 9.4 Уровни изоляции транзакций

> **TL;DR:** Isolation Levels контролируют видимость данных между concurrent транзакциями. Read Committed (default PostgreSQL) только committed данные, Repeatable Read (default MySQL) snapshot isolation, Serializable как последовательное выполнение. Trade-off: больше изоляция → больше consistency, меньше performance. Deadlocks решаются retry и блокировкой в одном порядке.

## Содержание

- [Что это](#что-это)
- [Проблемы concurrent доступа](#проблемы-concurrent-доступа)
  - [Dirty Read](#1-dirty-read-грязное-чтение)
  - [Non-Repeatable Read](#2-non-repeatable-read-неповторяющееся-чтение)
  - [Phantom Read](#3-phantom-read-фантомное-чтение)
- [Read Uncommitted](#1-read-uncommitted)
- [Read Committed](#2-read-committed-default-postgresql)
- [Repeatable Read](#3-repeatable-read-default-mysql)
- [Serializable](#4-serializable)
- [Comparison Table](#comparison-table)
- [Laravel](#laravel)
- [Практические примеры](#практические-примеры)
- [Deadlocks](#deadlocks)
- [Мониторинг](#мониторинг)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Isolation Levels:**
Настройки которые контролируют что видит транзакция когда другие транзакции параллельно изменяют данные.

**Trade-off:**
- Больше изоляция → больше consistency, меньше performance
- Меньше изоляция → меньше consistency, больше performance

**4 уровня (от слабого к строгому):**
1. Read Uncommitted
2. Read Committed (default в PostgreSQL)
3. Repeatable Read (default в MySQL)
4. Serializable

---

## Проблемы concurrent доступа

### 1. Dirty Read (грязное чтение)

**Проблема:** Читаем uncommitted данные другой транзакции.

```sql
-- Transaction A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- НЕ commit

-- Transaction B (параллельно)
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- Видит -100
COMMIT;

-- Transaction A
ROLLBACK;  -- Откатили!

-- Transaction B прочитала данные которых никогда не было
```

---

### 2. Non-Repeatable Read (неповторяющееся чтение)

**Проблема:** Читаем одну строку дважды и получаем разные значения.

```sql
-- Transaction A
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- Transaction B (параллельно)
BEGIN;
UPDATE accounts SET balance = 500 WHERE id = 1;
COMMIT;

-- Transaction A (продолжаем)
SELECT balance FROM accounts WHERE id = 1;  -- 500 (было 1000!)
COMMIT;
```

---

### 3. Phantom Read (фантомное чтение)

**Проблема:** Запрос дважды возвращает разное количество строк.

```sql
-- Transaction A
BEGIN;
SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 10

-- Transaction B (параллельно)
BEGIN;
INSERT INTO orders (status) VALUES ('pending');
COMMIT;

-- Transaction A (продолжаем)
SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 11 (было 10!)
COMMIT;
```

---

## 1. Read Uncommitted

**Что разрешает:**
- ✅ Dirty Read
- ✅ Non-Repeatable Read
- ✅ Phantom Read

**Использование:**

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
BEGIN;
SELECT * FROM accounts;  -- Может прочитать uncommitted данные
COMMIT;
```

**Когда использовать:**
- Приблизительные статистики (не критично)
- ❌ Почти никогда не используется в production

---

## 2. Read Committed (default PostgreSQL)

**Что запрещает:**
- ❌ Dirty Read
- ✅ Non-Repeatable Read
- ✅ Phantom Read

**Гарантия:** Видим только committed данные.

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN;

SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- Другая транзакция изменила и commit
-- Следующий SELECT увидит новое значение

SELECT balance FROM accounts WHERE id = 1;  -- 500

COMMIT;
```

**PostgreSQL default:**

```php
DB::transaction(function () {
    // Read Committed по умолчанию
    $user = User::find(1);
});
```

---

## 3. Repeatable Read (default MySQL)

**Что запрещает:**
- ❌ Dirty Read
- ❌ Non-Repeatable Read
- ✅ Phantom Read (в PostgreSQL запрещено, в MySQL разрешено)

**Гарантия:** Одна строка всегда возвращает одно значение в рамках транзакции.

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;

SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- Другая транзакция изменила и commit
-- Но мы всё равно видим старое значение

SELECT balance FROM accounts WHERE id = 1;  -- 1000 (не изменилось!)

COMMIT;
```

**Реализация:** Snapshot isolation (каждая транзакция видит snapshot на момент начала).

**MySQL:**

```php
DB::transaction(function () {
    // Repeatable Read по умолчанию
    $balance1 = Account::find(1)->balance;
    sleep(5);  // Другая транзакция изменила balance
    $balance2 = Account::find(1)->balance;
    // $balance1 === $balance2 (тот же snapshot)
});
```

---

## 4. Serializable

**Что запрещает:**
- ❌ Dirty Read
- ❌ Non-Repeatable Read
- ❌ Phantom Read

**Гарантия:** Транзакции выполняются как будто последовательно (serial).

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;

SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 10

-- Другая транзакция пытается INSERT
-- Будет заблокирована или вернёт serialization error

SELECT COUNT(*) FROM orders WHERE status = 'pending';  -- 10

COMMIT;
```

**Недостатки:**
- ❌ Медленно (много блокировок)
- ❌ Serialization errors (нужен retry)

**Когда использовать:**
- Критичные финансовые операции
- Когда нужна абсолютная consistency

---

## Comparison Table

| Level              | Dirty Read | Non-Repeatable | Phantom | Performance |
|--------------------|------------|----------------|---------|-------------|
| Read Uncommitted   | ✅ Да      | ✅ Да          | ✅ Да   | Быстро      |
| Read Committed     | ❌ Нет     | ✅ Да          | ✅ Да   | Средне      |
| Repeatable Read    | ❌ Нет     | ❌ Нет         | ✅ Да*  | Средне      |
| Serializable       | ❌ Нет     | ❌ Нет         | ❌ Нет  | Медленно    |

\* PostgreSQL запрещает, MySQL разрешает

---

## Laravel

**Установить уровень изоляции:**

```php
// Глобально в config/database.php
'mysql' => [
    'options' => [
        PDO::ATTR_PERSISTENT => true,
    ],
    // MySQL не поддерживает изоляцию через options
],

// Для конкретной транзакции
DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
DB::transaction(function () {
    // ...
});

// Или через raw
DB::beginTransaction();
DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
// ... queries ...
DB::commit();
```

---

## Практические примеры

### 1. Bank Transfer (нужна изоляция)

```php
// ❌ Read Committed: race condition
DB::transaction(function () use ($from, $to, $amount) {
    $fromAccount = Account::find($from);

    if ($fromAccount->balance < $amount) {
        throw new InsufficientFundsException();
    }

    // Другая транзакция может одновременно сделать withdrawal
    // и balance станет negative!

    $fromAccount->decrement('balance', $amount);
    Account::find($to)->increment('balance', $amount);
});

// ✅ Serializable: безопасно
DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
DB::transaction(function () use ($from, $to, $amount) {
    $fromAccount = Account::lockForUpdate()->find($from);

    if ($fromAccount->balance < $amount) {
        throw new InsufficientFundsException();
    }

    $fromAccount->decrement('balance', $amount);
    Account::find($to)->increment('balance', $amount);
});
```

---

### 2. Inventory Check (Repeatable Read достаточно)

```php
DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
DB::transaction(function () use ($productId, $quantity) {
    $product = Product::find($productId);

    // Видим snapshot, не меняется во время транзакции
    if ($product->stock < $quantity) {
        throw new OutOfStockException();
    }

    $product->decrement('stock', $quantity);
    Order::create([...]);
});
```

---

### 3. Analytics Report (Read Committed OK)

```php
// Read Committed достаточно для reports
// Не критично если данные немного несогласованы
DB::transaction(function () {
    $totalUsers = User::count();
    $totalOrders = Order::count();
    $totalRevenue = Order::sum('total');

    return [
        'users' => $totalUsers,
        'orders' => $totalOrders,
        'revenue' => $totalRevenue,
    ];
});
```

---

## Deadlocks

**Проблема:** Две транзакции ждут друг друга.

```sql
-- Transaction A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- Блокирует row 1
-- Ждёт...
UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- Нужна row 2

-- Transaction B (параллельно)
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- Блокирует row 2
-- Ждёт...
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- Нужна row 1

-- DEADLOCK! Обе ждут друг друга
```

**Решение БД:** Автоматически откатывает одну транзакцию.

**Предотвращение:**

```php
// 1. Всегда блокировать в одном порядке (по ID)
$accounts = Account::whereIn('id', [$from, $to])
    ->orderBy('id')  // Всегда один порядок!
    ->lockForUpdate()
    ->get();

// 2. Retry при deadlock
$maxRetries = 3;
for ($i = 0; $i < $maxRetries; $i++) {
    try {
        DB::transaction(function () {
            // ...
        });
        break;
    } catch (DeadlockException $e) {
        if ($i === $maxRetries - 1) {
            throw $e;
        }
        usleep(100000 * ($i + 1));  // Exponential backoff
    }
}
```

---

## Мониторинг

**PostgreSQL:**

```sql
-- Посмотреть текущие locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Посмотреть blocking queries
SELECT
    blocked_locks.pid AS blocked_pid,
    blocking_locks.pid AS blocking_pid,
    blocked_activity.query AS blocked_query,
    blocking_activity.query AS blocking_query
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted AND blocking_locks.granted;
```

**MySQL:**

```sql
-- Deadlocks
SHOW ENGINE INNODB STATUS;

-- Transactions
SELECT * FROM information_schema.INNODB_TRX;
```

---

## Практические задания

### Задание 1: Безопасный банковский перевод

**Задача:** Реализовать банковский перевод с правильным уровнем изоляции для предотвращения race conditions.

<details>
<summary>Решение</summary>

```php
// app/Services/BankTransferService.php
namespace App\Services;

use App\Models\Account;
use App\Exceptions\InsufficientFundsException;
use Illuminate\Support\Facades\DB;

class BankTransferService
{
    public function transfer(int $fromAccountId, int $toAccountId, float $amount): void
    {
        // Используем Serializable для критичных финансовых операций
        DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

        DB::transaction(function () use ($fromAccountId, $toAccountId, $amount) {
            // Блокируем аккаунты в порядке ID (предотвращение deadlock)
            $ids = [$fromAccountId, $toAccountId];
            sort($ids);

            $accounts = Account::whereIn('id', $ids)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $fromAccount = $accounts[$fromAccountId];
            $toAccount = $accounts[$toAccountId];

            // Проверка баланса
            if ($fromAccount->balance < $amount) {
                throw new InsufficientFundsException(
                    "Insufficient funds. Available: {$fromAccount->balance}, Required: {$amount}"
                );
            }

            // Выполняем перевод
            $fromAccount->decrement('balance', $amount);
            $toAccount->increment('balance', $amount);

            // Логируем транзакцию
            DB::table('transactions')->insert([
                'from_account_id' => $fromAccountId,
                'to_account_id' => $toAccountId,
                'amount' => $amount,
                'created_at' => now(),
            ]);
        });
    }

    // Вариант с retry при deadlock
    public function transferWithRetry(int $fromAccountId, int $toAccountId, float $amount): void
    {
        $maxAttempts = 3;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $this->transfer($fromAccountId, $toAccountId, $amount);
                return; // Успешно
            } catch (\Illuminate\Database\QueryException $e) {
                // Deadlock error code
                if ($e->getCode() === '40P01' && $attempt < $maxAttempts) {
                    // Exponential backoff
                    usleep(100000 * $attempt); // 100ms, 200ms, 300ms
                    continue;
                }
                throw $e;
            }
        }
    }
}
```

</details>

### Задание 2: Демонстрация Isolation Levels

**Задача:** Создать Artisan команду для демонстрации разных проблем concurrent доступа.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/DemoIsolationLevels.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DemoIsolationLevels extends Command
{
    protected $signature = 'demo:isolation {level}';
    protected $description = 'Demonstrate isolation level behaviors';

    public function handle()
    {
        $level = $this->argument('level');

        match($level) {
            'dirty-read' => $this->demoDirtyRead(),
            'non-repeatable' => $this->demoNonRepeatableRead(),
            'phantom' => $this->demoPhantomRead(),
            default => $this->error('Invalid level')
        };
    }

    private function demoDirtyRead()
    {
        $this->info('=== Dirty Read Demo ===');

        // Transaction A (в отдельном процессе симулируем через sleep)
        $this->comment('Transaction A: BEGIN');
        DB::statement('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
        DB::beginTransaction();

        $this->comment('Transaction A: UPDATE balance = 500');
        DB::table('accounts')->where('id', 1)->update(['balance' => 500]);

        // Transaction B читает uncommitted данные
        $this->comment('Transaction B: SELECT balance');
        $balance = DB::table('accounts')->where('id', 1)->value('balance');
        $this->line("Transaction B видит: balance = {$balance}");

        // Transaction A откатывается
        $this->comment('Transaction A: ROLLBACK');
        DB::rollBack();

        $actualBalance = DB::table('accounts')->where('id', 1)->value('balance');
        $this->error("Реальный balance: {$actualBalance}");
        $this->error('Transaction B прочитала данные которых не существует!');
    }

    private function demoNonRepeatableRead()
    {
        $this->info('=== Non-Repeatable Read Demo ===');

        DB::statement('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        DB::beginTransaction();

        // Первое чтение
        $balance1 = DB::table('accounts')->where('id', 1)->value('balance');
        $this->line("Первое чтение: balance = {$balance1}");

        $this->comment('Другая транзакция изменила balance...');
        // Симулируем изменение в другой транзакции
        DB::commit();
        DB::table('accounts')->where('id', 1)->update(['balance' => 999]);
        DB::beginTransaction();

        // Второе чтение
        $balance2 = DB::table('accounts')->where('id', 1)->value('balance');
        $this->line("Второе чтение: balance = {$balance2}");

        if ($balance1 !== $balance2) {
            $this->error('Non-Repeatable Read: значения разные!');
        }

        DB::commit();
    }

    private function demoPhantomRead()
    {
        $this->info('=== Phantom Read Demo ===');

        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        DB::beginTransaction();

        // Первый подсчет
        $count1 = DB::table('orders')->where('status', 'pending')->count();
        $this->line("Первый подсчет: {$count1} pending orders");

        $this->comment('Другая транзакция добавила order...');
        DB::commit();
        DB::table('orders')->insert(['status' => 'pending', 'total' => 100]);
        DB::beginTransaction();

        // Второй подсчет
        $count2 = DB::table('orders')->where('status', 'pending')->count();
        $this->line("Второй подсчет: {$count2} pending orders");

        if ($count1 !== $count2) {
            $this->error('Phantom Read: количество строк изменилось!');
        }

        DB::commit();
    }
}
```

</details>

### Задание 3: Inventory Management с Repeatable Read

**Задача:** Реализовать систему управления складом с правильной изоляцией.

<details>
<summary>Решение</summary>

```php
// app/Services/InventoryService.php
namespace App\Services;

use App\Models\Product;
use App\Models\Order;
use App\Exceptions\OutOfStockException;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function createOrder(int $productId, int $quantity): Order
    {
        // Repeatable Read достаточно для inventory
        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

        return DB::transaction(function () use ($productId, $quantity) {
            // Блокируем продукт
            $product = Product::lockForUpdate()->findOrFail($productId);

            // Проверяем stock (видим snapshot на момент начала транзакции)
            if ($product->stock < $quantity) {
                throw new OutOfStockException(
                    "Product {$product->name} is out of stock. Available: {$product->stock}, Requested: {$quantity}"
                );
            }

            // Уменьшаем stock
            $product->decrement('stock', $quantity);

            // Создаём заказ
            $order = Order::create([
                'product_id' => $productId,
                'quantity' => $quantity,
                'total' => $product->price * $quantity,
            ]);

            return $order;
        });
    }

    // Batch order с обработкой deadlock
    public function createBatchOrder(array $items): array
    {
        DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

        return DB::transaction(function () use ($items) {
            $orders = [];

            // Сортируем по product_id для предотвращения deadlock
            usort($items, fn($a, $b) => $a['product_id'] <=> $b['product_id']);

            foreach ($items as $item) {
                $orders[] = $this->createOrder(
                    $item['product_id'],
                    $item['quantity']
                );
            }

            return $orders;
        });
    }
}
```

</details>

---

## На собеседовании скажешь

> "Isolation Levels контролируют видимость данных между concurrent транзакциями. 4 уровня: Read Uncommitted (dirty reads OK), Read Committed (default PostgreSQL, только committed данные), Repeatable Read (default MySQL, snapshot isolation), Serializable (как последовательное выполнение). Проблемы: Dirty Read (uncommitted), Non-Repeatable Read (разные значения), Phantom Read (разное количество строк). Trade-off: больше изоляция → больше consistency, меньше performance. Deadlocks: транзакции ждут друг друга, решение — retry и блокировать в одном порядке."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

