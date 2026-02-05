# 9.5 Блокировки (Locks)

> **TL;DR:** Locks предотвращают concurrent доступ к данным. Shared Lock (FOR SHARE) разрешает читать, Exclusive Lock (FOR UPDATE) запрещает всё. SKIP LOCKED для queue workers. Optimistic Locking проверяет версию без блокировки. Advisory Locks для application-level блокировок. Deadlocks решаются блокировкой в одном порядке.

## Содержание

- [Что это](#что-это)
- [Типы блокировок](#типы-блокировок)
  - [Shared Lock](#1-shared-lock-s-lock--read-lock)
  - [Exclusive Lock](#2-exclusive-lock-x-lock--write-lock)
  - [Row-Level Lock](#3-row-level-lock-блокировка-строки)
  - [Table-Level Lock](#4-table-level-lock-блокировка-таблицы)
- [FOR UPDATE SKIP LOCKED](#for-update-skip-locked)
- [FOR UPDATE NOWAIT](#for-update-nowait)
- [Optimistic Locking](#optimistic-locking-оптимистичная-блокировка)
- [Advisory Locks](#advisory-locks-postgresql)
- [Lock Wait Timeout](#lock-wait-timeout)
- [Deadlocks](#deadlocks-взаимная-блокировка)
- [Мониторинг блокировок](#мониторинг-блокировок)
- [Best Practices](#best-practices)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Locks (Блокировки):**
Механизм для предотвращения одновременного изменения одних данных разными транзакциями.

**Зачем:**
- Предотвратить race conditions
- Обеспечить data consistency
- Контролировать concurrent доступ

**Trade-off:**
- Больше блокировок → больше consistency, меньше concurrency
- Меньше блокировок → меньше consistency, больше concurrency

---

## Типы блокировок

### 1. Shared Lock (S-lock) — READ Lock

**Что делает:**
- Разрешает другим читать
- Запрещает другим писать

```sql
-- PostgreSQL
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR SHARE;
-- Другие могут SELECT, но не UPDATE/DELETE
COMMIT;
```

---

### 2. Exclusive Lock (X-lock) — WRITE Lock

**Что делает:**
- Запрещает другим читать и писать

```sql
-- PostgreSQL
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- Другие НЕ могут SELECT FOR UPDATE/SHARE, UPDATE, DELETE
COMMIT;
```

**Laravel:**

```php
// Shared lock (FOR SHARE)
$user = User::lockForShare()->find($id);

// Exclusive lock (FOR UPDATE)
$user = User::lockForUpdate()->find($id);
```

---

### 3. Row-Level Lock (блокировка строки)

**PostgreSQL:**

```sql
-- Заблокировать конкретную строку
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
```

**Use case: Bank Transfer**

```php
DB::transaction(function () use ($fromId, $toId, $amount) {
    // Блокируем обе строки в порядке ID (deadlock prevention)
    $accounts = Account::whereIn('id', [$fromId, $toId])
        ->orderBy('id')
        ->lockForUpdate()
        ->get()
        ->keyBy('id');

    $from = $accounts[$fromId];
    $to = $accounts[$toId];

    if ($from->balance < $amount) {
        throw new InsufficientFundsException();
    }

    // Безопасно изменяем (никто другой не может)
    $from->decrement('balance', $amount);
    $to->increment('balance', $amount);
});
```

---

### 4. Table-Level Lock (блокировка таблицы)

```sql
-- PostgreSQL
LOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;
-- Никто не может читать/писать
```

**Режимы:**

```sql
-- ACCESS SHARE (читать можно)
LOCK TABLE accounts IN ACCESS SHARE MODE;

-- ROW EXCLUSIVE (обычные UPDATE/DELETE)
LOCK TABLE accounts IN ROW EXCLUSIVE MODE;

-- ACCESS EXCLUSIVE (никто не может ничего)
LOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;
```

**Когда использовать:**
- ❌ Редко в production (блокирует всю таблицу)
- ✅ Maintenance операции (ALTER TABLE, TRUNCATE)

---

## FOR UPDATE SKIP LOCKED

**Проблема: Queue Workers**

```sql
-- Worker 1
BEGIN;
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE;
-- Получил job #1

-- Worker 2 (одновременно)
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE;
-- Ждёт пока Worker 1 закончит (блокируется!)
```

**Решение: SKIP LOCKED**

```sql
-- Worker 1
BEGIN;
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED;
-- Получил job #1

-- Worker 2
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED;
-- Пропустил job #1, получил job #2 (не ждёт!)
```

**Laravel Queue Worker:**

```php
class ProcessNextJob
{
    public function handle()
    {
        // Получить следующий job без блокировки
        $job = Job::where('status', 'pending')
            ->orderBy('created_at')
            ->limit(1)
            ->lockForUpdate()  // FOR UPDATE SKIP LOCKED
            ->first();

        if (!$job) {
            return;  // Нет доступных jobs
        }

        $job->update(['status' => 'processing']);

        // Process job...
    }
}
```

---

## FOR UPDATE NOWAIT

**Что делает:**
Вместо ожидания сразу выбросить ошибку.

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;
-- Если уже заблокировано → ERROR: could not obtain lock
```

**Laravel:**

```php
try {
    $account = Account::where('id', 1)
        ->lockForUpdate()  // можно добавить NOWAIT через raw
        ->first();

} catch (QueryException $e) {
    if ($e->getCode() === '55P03') {  // lock_not_available
        return response()->json(['error' => 'Resource locked'], 423);
    }
}
```

---

## Optimistic Locking (Оптимистичная блокировка)

**Идея:**
Не блокировать, а проверять версию при сохранении.

**Реализация:**

```php
// Migration
Schema::table('products', function (Blueprint $table) {
    $table->integer('version')->default(0);
});

// Model
class Product extends Model
{
    public function updateStock($quantity)
    {
        $currentVersion = $this->version;

        // Попытка обновления
        $updated = DB::table('products')
            ->where('id', $this->id)
            ->where('version', $currentVersion)  // Проверка версии
            ->update([
                'stock' => DB::raw('stock - ' . $quantity),
                'version' => $currentVersion + 1,  // Инкремент версии
            ]);

        if ($updated === 0) {
            // Кто-то изменил раньше нас
            throw new OptimisticLockException('Product was modified by another transaction');
        }

        $this->refresh();
    }
}

// Использование
try {
    $product->updateStock(5);
} catch (OptimisticLockException $e) {
    // Retry or notify user
    return response()->json(['error' => 'Product was modified, please retry'], 409);
}
```

**Плюсы:**
- ✅ Высокая concurrency (не блокируем)
- ✅ Нет deadlocks

**Минусы:**
- ❌ Нужны retries
- ❌ Может часто падать при высокой конкуренции

---

## Advisory Locks (PostgreSQL)

**Что это:**
Application-level locks (не привязаны к транзакциям).

```sql
-- Получить lock
SELECT pg_advisory_lock(123);

-- Проверить доступность
SELECT pg_try_advisory_lock(123);  -- true/false

-- Освободить
SELECT pg_advisory_unlock(123);
```

**Use case: Prevent Duplicate Jobs**

```php
class ProcessUniqueTask
{
    public function handle($taskId)
    {
        // Попытка получить lock
        $locked = DB::selectOne("SELECT pg_try_advisory_lock(?) as locked", [$taskId])->locked;

        if (!$locked) {
            // Другой процесс уже обрабатывает
            Log::info("Task {$taskId} is already being processed");
            return;
        }

        try {
            // Process task...
            $this->processTask($taskId);

        } finally {
            // Освобождаем lock
            DB::statement("SELECT pg_advisory_unlock(?)", [$taskId]);
        }
    }
}
```

**Use case: Singleton Scheduler**

```php
// Гарантировать что только 1 экземпляр scheduler работает
class Scheduler
{
    private const LOCK_ID = 999999;

    public function run()
    {
        $locked = DB::selectOne(
            "SELECT pg_try_advisory_lock(?) as locked",
            [self::LOCK_ID]
        )->locked;

        if (!$locked) {
            die("Scheduler is already running\n");
        }

        // Scheduler loop...
        while (true) {
            $this->processTasks();
            sleep(60);
        }

        // Lock освобождается когда процесс завершается
    }
}
```

---

## Lock Wait Timeout

**PostgreSQL:**

```sql
-- Установить timeout для ожидания lock
SET lock_timeout = '5s';

BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- Если не получили lock за 5s → ERROR
COMMIT;
```

**Laravel config:**

```php
// config/database.php
'pgsql' => [
    'options' => [
        '--client_encoding=utf8',
        '--lock_timeout=5000',  // 5 seconds
    ],
],
```

---

## Deadlocks (Взаимная блокировка)

**Проблема:**

```sql
-- Transaction A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- Lock row 1
-- waiting...
UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- Need row 2

-- Transaction B
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- Lock row 2
-- waiting...
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- Need row 1

-- DEADLOCK!
```

**PostgreSQL детектит и откатывает одну транзакцию:**

```
ERROR: deadlock detected
DETAIL: Process 1234 waits for ShareLock on transaction 5678
```

**Решение: Блокировать в одном порядке**

```php
DB::transaction(function () use ($fromId, $toId, $amount) {
    // Всегда блокировать в порядке ID
    $ids = [$fromId, $toId];
    sort($ids);

    $accounts = Account::whereIn('id', $ids)
        ->orderBy('id')  // ← Критично!
        ->lockForUpdate()
        ->get()
        ->keyBy('id');

    // Теперь безопасно
    $accounts[$fromId]->decrement('balance', $amount);
    $accounts[$toId]->increment('balance', $amount);
});
```

---

## Мониторинг блокировок

**PostgreSQL:**

```sql
-- Текущие locks
SELECT
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query,
    state
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- Waiting queries
SELECT
    wait_event_type,
    wait_event,
    query,
    state,
    state_change
FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```

**MySQL:**

```sql
-- InnoDB locks
SELECT * FROM information_schema.INNODB_LOCKS;

-- Waiting transactions
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
```

---

## Best Practices

```
✓ Минимизировать длительность lock (короткие транзакции)
✓ Блокировать в одном порядке (по ID) для deadlock prevention
✓ Использовать SKIP LOCKED для queue workers
✓ Использовать Optimistic Locking для high-concurrency read-mostly данных
✓ Мониторить deadlocks и long-running locks
✓ Избегать Table-Level locks в production
✓ Устанавливать lock_timeout
✓ Для критичных операций: SELECT FOR UPDATE + версионирование
```

---

## Практические задания

### Задание 1: Queue Worker с SKIP LOCKED

**Задача:** Реализовать queue worker который обрабатывает задачи без блокировок.

<details>
<summary>Решение</summary>

```php
// app/Jobs/ProcessQueueJob.php
namespace App\Jobs;

use Illuminate\Support\Facades\DB;
use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;

class ProcessQueueJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public function handle()
    {
        // PostgreSQL
        $job = $this->getNextJobPostgres();

        // MySQL (не поддерживает SKIP LOCKED в старых версиях)
        // $job = $this->getNextJobMySQL();

        if (!$job) {
            return; // Нет доступных задач
        }

        try {
            // Обрабатываем задачу
            $this->processJob($job);

            // Помечаем как выполненную
            DB::table('queue_jobs')
                ->where('id', $job->id)
                ->update(['status' => 'completed', 'completed_at' => now()]);

        } catch (\Exception $e) {
            // Помечаем как failed
            DB::table('queue_jobs')
                ->where('id', $job->id)
                ->update([
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                    'failed_at' => now()
                ]);
        }
    }

    private function getNextJobPostgres()
    {
        return DB::transaction(function () {
            $job = DB::table('queue_jobs')
                ->where('status', 'pending')
                ->orderBy('created_at')
                ->limit(1)
                ->lockForUpdate('skip locked')
                ->first();

            if ($job) {
                // Сразу помечаем как processing
                DB::table('queue_jobs')
                    ->where('id', $job->id)
                    ->update(['status' => 'processing', 'started_at' => now()]);
            }

            return $job;
        });
    }

    private function getNextJobMySQL()
    {
        return DB::transaction(function () {
            // MySQL: используем UPDATE с WHERE
            $affected = DB::table('queue_jobs')
                ->where('status', 'pending')
                ->orderBy('created_at')
                ->limit(1)
                ->update([
                    'status' => 'processing',
                    'started_at' => now()
                ]);

            if ($affected === 0) {
                return null;
            }

            return DB::table('queue_jobs')
                ->where('status', 'processing')
                ->whereNull('completed_at')
                ->orderBy('started_at', 'desc')
                ->first();
        });
    }

    private function processJob($job)
    {
        // Симуляция обработки
        $data = json_decode($job->payload, true);

        match($job->type) {
            'send_email' => $this->sendEmail($data),
            'process_image' => $this->processImage($data),
            'generate_report' => $this->generateReport($data),
            default => throw new \Exception("Unknown job type: {$job->type}")
        };
    }
}

// Migration для queue_jobs
Schema::create('queue_jobs', function (Blueprint $table) {
    $table->id();
    $table->string('type');
    $table->json('payload');
    $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
    $table->text('error')->nullable();
    $table->timestamp('started_at')->nullable();
    $table->timestamp('completed_at')->nullable();
    $table->timestamp('failed_at')->nullable();
    $table->timestamps();

    $table->index(['status', 'created_at']);
});
```

</details>

### Задание 2: Optimistic Locking для Product Updates

**Задача:** Реализовать optimistic locking для предотвращения lost updates.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::table('products', function (Blueprint $table) {
    $table->integer('version')->default(0)->after('id');
});

// app/Models/Product.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Exceptions\OptimisticLockException;

class Product extends Model
{
    protected $fillable = ['name', 'price', 'stock', 'version'];

    public function updateWithOptimisticLock(array $data): bool
    {
        $currentVersion = $this->version;

        // Добавляем инкремент версии
        $data['version'] = $currentVersion + 1;

        // Обновляем только если версия не изменилась
        $updated = static::where('id', $this->id)
            ->where('version', $currentVersion)
            ->update($data);

        if ($updated === 0) {
            throw new OptimisticLockException(
                "Product #{$this->id} was modified by another transaction. Please reload and try again."
            );
        }

        // Обновляем модель
        $this->refresh();

        return true;
    }

    public function decrementStock(int $quantity): void
    {
        $currentVersion = $this->version;

        $updated = static::where('id', $this->id)
            ->where('version', $currentVersion)
            ->where('stock', '>=', $quantity) // Atomic check
            ->update([
                'stock' => DB::raw("stock - {$quantity}"),
                'version' => $currentVersion + 1,
            ]);

        if ($updated === 0) {
            $fresh = $this->fresh();

            if ($fresh->version !== $currentVersion) {
                throw new OptimisticLockException("Product was modified by another transaction");
            }

            if ($fresh->stock < $quantity) {
                throw new OutOfStockException("Insufficient stock");
            }

            throw new \Exception("Failed to update stock");
        }

        $this->refresh();
    }
}

// app/Http/Controllers/ProductController.php
public function update(Request $request, Product $product)
{
    $maxRetries = 3;
    $attempt = 0;

    while ($attempt < $maxRetries) {
        try {
            $product->updateWithOptimisticLock($request->validated());

            return response()->json([
                'message' => 'Product updated successfully',
                'product' => $product
            ]);

        } catch (OptimisticLockException $e) {
            $attempt++;

            if ($attempt >= $maxRetries) {
                return response()->json([
                    'error' => 'Product was modified multiple times. Please reload and try again.'
                ], 409);
            }

            // Exponential backoff
            usleep(50000 * $attempt); // 50ms, 100ms, 150ms

            // Перезагружаем модель
            $product->refresh();
        }
    }
}
```

</details>

### Задание 3: Advisory Locks для Singleton Tasks

**Задача:** Использовать PostgreSQL advisory locks для гарантии единственного экземпляра задачи.

<details>
<summary>Решение</summary>

```php
// app/Services/AdvisoryLockService.php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class AdvisoryLockService
{
    public function tryLock(int $lockId): bool
    {
        $result = DB::selectOne("SELECT pg_try_advisory_lock(?) as locked", [$lockId]);
        return $result->locked;
    }

    public function lock(int $lockId): void
    {
        DB::statement("SELECT pg_advisory_lock(?)", [$lockId]);
    }

    public function unlock(int $lockId): void
    {
        DB::statement("SELECT pg_advisory_unlock(?)", [$lockId]);
    }

    public function withLock(int $lockId, callable $callback)
    {
        if (!$this->tryLock($lockId)) {
            throw new \Exception("Failed to acquire lock {$lockId}");
        }

        try {
            return $callback();
        } finally {
            $this->unlock($lockId);
        }
    }
}

// app/Console/Commands/ProcessUniqueTask.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\AdvisoryLockService;

class ProcessUniqueTask extends Command
{
    protected $signature = 'task:process-unique {task-id}';
    protected $description = 'Process task that should run only once';

    public function __construct(
        private AdvisoryLockService $lockService
    ) {
        parent::__construct();
    }

    public function handle()
    {
        $taskId = $this->argument('task-id');

        try {
            $this->lockService->withLock($taskId, function () use ($taskId) {
                $this->info("Processing task {$taskId}...");

                // Долгая обработка
                sleep(10);

                $this->info("Task {$taskId} completed");
            });

        } catch (\Exception $e) {
            $this->error("Task {$taskId} is already being processed");
            return 1;
        }
    }
}

// app/Console/Commands/SingletonScheduler.php
class SingletonScheduler extends Command
{
    protected $signature = 'scheduler:run-singleton';
    private const LOCK_ID = 999999;

    public function __construct(
        private AdvisoryLockService $lockService
    ) {
        parent::__construct();
    }

    public function handle()
    {
        if (!$this->lockService->tryLock(self::LOCK_ID)) {
            $this->error('Scheduler is already running');
            return 1;
        }

        $this->info('Scheduler started');

        try {
            // Scheduler loop
            while (true) {
                $this->processTasks();
                sleep(60);
            }
        } finally {
            $this->lockService->unlock(self::LOCK_ID);
        }
    }

    private function processTasks()
    {
        // Process scheduled tasks
        $this->info('Processing tasks...');
    }
}
```

</details>

---

## На собеседовании скажешь

> "Locks предотвращают concurrent доступ к данным. Shared Lock (FOR SHARE) разрешает читать, Exclusive Lock (FOR UPDATE) запрещает всё. Row-Level locks для строк, Table-Level для таблиц. SKIP LOCKED для queue workers (не ждать занятые строки). Optimistic Locking: проверять версию при сохранении без блокировки. Advisory Locks в PostgreSQL для application-level блокировок. Deadlocks решаются блокировкой в одном порядке (по ID). Мониторинг через pg_stat_activity. Best practices: короткие транзакции, lock timeout, избегать Table locks."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
