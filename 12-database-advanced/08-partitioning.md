# 9.8 Партиционирование (Partitioning)

> **TL;DR:** Partitioning разделяет большую таблицу на меньшие части для ускорения запросов. Range (по дате), List (по категориям), Hash (равномерное распределение). Partition pruning сканирует только нужные партиции. PostgreSQL: partition key в PK, индексы автоматически на партициях. Laravel: автоматизировать создание/удаление через scheduler.

## Содержание

- [Что это](#что-это)
- [Типы Partitioning](#типы-partitioning)
  - [Range Partitioning](#1-range-partitioning-по-диапазону)
  - [List Partitioning](#2-list-partitioning-по-списку)
  - [Hash Partitioning](#3-hash-partitioning-по-хешу)
- [Laravel Implementation](#laravel-implementation)
- [Автоматическое создание партиций](#автоматическое-создание-партиций)
- [Удаление старых партиций](#удаление-старых-партиций)
- [Practical Example](#practical-example-logs)
- [Partition Pruning](#partition-pruning)
- [Indexes на партициях](#indexes-на-партициях)
- [Sub-partitioning](#sub-partitioning)
- [Best Practices](#best-practices)
- [MySQL Partitioning](#mysql-partitioning)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Partitioning:**
Разделение большой таблицы на меньшие физические части (partitions), которые логически остаются одной таблицей.

**Зачем:**
- Ускорить запросы (query только нужные партиции)
- Упростить архивирование (drop старых партиций)
- Улучшить maintenance (VACUUM, REINDEX быстрее)
- Параллельные операции

**Trade-off:**
- ✅ Производительность на больших таблицах (millions+ rows)
- ❌ Сложность настройки
- ❌ Не всегда даёт выигрыш на маленьких таблицах

---

## Типы Partitioning

### 1. Range Partitioning (по диапазону)

**Use case:** временные данные (логи, заказы по дате)

```sql
-- Parent table
CREATE TABLE orders (
    id BIGSERIAL,
    user_id BIGINT,
    total DECIMAL(10, 2),
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id, created_at)  -- partition key должен быть в PK
) PARTITION BY RANGE (created_at);

-- Child partitions
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02 PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE orders_2024_03 PARTITION OF orders
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

**Запросы автоматически роутятся:**

```sql
-- PostgreSQL автоматически выберет нужную партицию
SELECT * FROM orders
WHERE created_at >= '2024-02-15' AND created_at < '2024-02-20';
-- Сканирует только orders_2024_02 (не все партиции!)
```

---

### 2. List Partitioning (по списку)

**Use case:** категории, регионы, статусы

```sql
CREATE TABLE products (
    id BIGSERIAL,
    name VARCHAR(255),
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2),
    PRIMARY KEY (id, category)
) PARTITION BY LIST (category);

-- Партиции по категориям
CREATE TABLE products_electronics PARTITION OF products
    FOR VALUES IN ('electronics', 'computers', 'phones');

CREATE TABLE products_clothing PARTITION OF products
    FOR VALUES IN ('clothing', 'shoes', 'accessories');

CREATE TABLE products_food PARTITION OF products
    FOR VALUES IN ('food', 'beverages');
```

---

### 3. Hash Partitioning (по хешу)

**Use case:** равномерное распределение данных

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255)
) PARTITION BY HASH (id);

-- 4 партиции (равномерное распределение)
CREATE TABLE users_p0 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE users_p1 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE users_p2 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE users_p3 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

---

## Laravel Implementation

**Migration для Range Partitioning:**

```php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('user_id');
    $table->decimal('total', 10, 2);
    $table->timestamp('created_at');

    // Partition key должен быть в primary key
    $table->primary(['id', 'created_at']);
});

// Создать партиции через raw SQL
DB::statement("
    ALTER TABLE orders
    PARTITION BY RANGE (created_at)
");

// Партиция за январь 2024
DB::statement("
    CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
");

// Индексы создаются автоматически на каждой партиции
DB::statement("CREATE INDEX ON orders_2024_01(user_id)");
```

---

## Автоматическое создание партиций

**Command для создания будущих партиций:**

```php
class CreateMonthlyPartitions extends Command
{
    protected $signature = 'partitions:create-monthly {table} {--months=3}';

    public function handle()
    {
        $table = $this->argument('table');
        $months = $this->option('months');

        $start = now()->startOfMonth();

        for ($i = 0; $i < $months; $i++) {
            $date = $start->copy()->addMonths($i);
            $nextDate = $date->copy()->addMonth();

            $partitionName = "{$table}_{$date->format('Y_m')}";

            // Проверить существование
            $exists = DB::selectOne("
                SELECT 1 FROM pg_tables
                WHERE tablename = ?
            ", [$partitionName]);

            if ($exists) {
                $this->info("Partition {$partitionName} already exists");
                continue;
            }

            // Создать партицию
            DB::statement("
                CREATE TABLE {$partitionName} PARTITION OF {$table}
                FOR VALUES FROM ('{$date->format('Y-m-d')}')
                             TO ('{$nextDate->format('Y-m-d')}')
            ");

            // Индексы
            DB::statement("CREATE INDEX ON {$partitionName}(user_id)");

            $this->info("✓ Created partition {$partitionName}");
        }
    }
}

// Scheduler: создавать партиции на 3 месяца вперёд
$schedule->command('partitions:create-monthly orders --months=3')->monthly();
```

---

## Удаление старых партиций

**Архивирование старых данных:**

```php
class DropOldPartitions extends Command
{
    protected $signature = 'partitions:drop-old {table} {--months-ago=12}';

    public function handle()
    {
        $table = $this->argument('table');
        $monthsAgo = $this->option('months-ago');

        $cutoffDate = now()->subMonths($monthsAgo)->startOfMonth();

        // Найти все партиции старше cutoff
        $partitions = DB::select("
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE '{$table}_%'
              AND tablename < '{$table}_{$cutoffDate->format('Y_m')}'
        ");

        foreach ($partitions as $partition) {
            $name = $partition->tablename;

            if ($this->confirm("Drop partition {$name}?")) {
                // Опционально: экспорт в архив
                $this->exportToArchive($name);

                // Удалить партицию
                DB::statement("DROP TABLE {$name}");

                $this->info("✓ Dropped partition {$name}");
            }
        }
    }

    private function exportToArchive(string $partition)
    {
        // Export to S3, filesystem, etc.
        $data = DB::table($partition)->get();
        Storage::disk('archive')->put(
            "{$partition}.json",
            json_encode($data)
        );
    }
}

// Scheduler: удалять партиции старше 12 месяцев
$schedule->command('partitions:drop-old orders --months-ago=12')->monthly();
```

---

## Practical Example: Logs

**Scenario:** миллионы логов в день, хранить 3 месяца.

```php
// Migration
Schema::create('logs', function (Blueprint $table) {
    $table->id();
    $table->string('level');
    $table->text('message');
    $table->text('context')->nullable();
    $table->timestamp('created_at');

    $table->primary(['id', 'created_at']);
});

DB::statement("ALTER TABLE logs PARTITION BY RANGE (created_at)");

// Создать партиции на 3 месяца вперёд
for ($i = 0; $i < 3; $i++) {
    $date = now()->addMonths($i)->startOfMonth();
    $nextDate = $date->copy()->addMonth();

    DB::statement("
        CREATE TABLE logs_{$date->format('Y_m')} PARTITION OF logs
        FOR VALUES FROM ('{$date->format('Y-m-d')}')
                     TO ('{$nextDate->format('Y-m-d')}')
    ");
}

// Scheduler
$schedule->command('partitions:create-monthly logs --months=3')->monthly();
$schedule->command('partitions:drop-old logs --months-ago=3')->daily();
```

**Использование:**

```php
// Laravel автоматически работает с партициями
Log::info('User logged in', ['user_id' => 123]);

// Query только нужную партицию
DB::table('logs')
    ->where('created_at', '>=', now()->subDays(7))
    ->where('level', 'error')
    ->get();
// Scan только партиции за последние 7 дней
```

---

## Partition Pruning

**EXPLAIN покажет какие партиции сканируются:**

```sql
EXPLAIN SELECT * FROM orders
WHERE created_at >= '2024-02-01' AND created_at < '2024-03-01';

-- Seq Scan on orders_2024_02
-- (только 1 партиция!)
```

**Без partition key в WHERE — сканируются ВСЕ партиции:**

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- Append
--   -> Seq Scan on orders_2024_01
--   -> Seq Scan on orders_2024_02
--   -> Seq Scan on orders_2024_03
-- (все партиции!)
```

**Решение: добавить partition key в WHERE**

```sql
SELECT * FROM orders
WHERE user_id = 123
  AND created_at >= '2024-02-01'  -- partition key!
  AND created_at < '2024-03-01';
```

---

## Indexes на партициях

**Индексы создаются на parent → автоматически на всех партициях:**

```sql
-- Создать индекс на parent table
CREATE INDEX idx_orders_user ON orders(user_id);

-- Автоматически создаются индексы:
-- idx_orders_user_2024_01 на orders_2024_01
-- idx_orders_user_2024_02 на orders_2024_02
-- ...
```

**Laravel:**

```php
Schema::table('orders', function (Blueprint $table) {
    $table->index('user_id');
    // Автоматически на всех партициях
});
```

---

## Sub-partitioning

**Partition по дате, sub-partition по региону:**

```sql
CREATE TABLE orders (
    id BIGSERIAL,
    user_id BIGINT,
    region VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id, created_at, region)
) PARTITION BY RANGE (created_at);

-- Партиция за месяц
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    PARTITION BY LIST (region);

-- Sub-партиции по региону
CREATE TABLE orders_2024_01_eu PARTITION OF orders_2024_01
    FOR VALUES IN ('EU', 'UK');

CREATE TABLE orders_2024_01_us PARTITION OF orders_2024_01
    FOR VALUES IN ('US', 'CA');
```

---

## Best Practices

```
✓ Partitioning для больших таблиц (millions+ rows)
✓ Range partitioning для временных данных (logs, orders)
✓ List partitioning для категорий (region, status)
✓ Hash partitioning для равномерного распределения
✓ Partition key должен быть в primary key
✓ Всегда включай partition key в WHERE для pruning
✓ Автоматизируй создание/удаление партиций (scheduler)
✓ Индексы создавай на parent table (автоматически на партициях)
✓ EXPLAIN для проверки partition pruning
✓ Не используй partitioning на маленьких таблицах (overhead)
```

---

## MySQL Partitioning

**MySQL поддерживает, но с ограничениями:**

```sql
-- Range partitioning (MySQL)
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT,
    created_at TIMESTAMP,
    total DECIMAL(10, 2),
    PRIMARY KEY (id, created_at)
)
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

**Ограничения MySQL:**
- Foreign keys НЕ поддерживаются
- Partition key должен быть в primary key
- Меньше гибкости чем PostgreSQL

---

## Практические задания

### Задание 1: Partitioned Logs Table

**Задача:** Создать партиционированную таблицу логов с автоматическим управлением партициями.

<details>
<summary>Решение</summary>

```php
// database/migrations/xxxx_create_logs_partitioned.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Создаём parent table
        DB::statement("
            CREATE TABLE logs (
                id BIGSERIAL,
                level VARCHAR(20),
                message TEXT,
                context JSONB,
                created_at TIMESTAMP NOT NULL,
                PRIMARY KEY (id, created_at)
            ) PARTITION BY RANGE (created_at)
        ");

        // Создаём индексы на parent (автоматически на всех партициях)
        DB::statement("CREATE INDEX ON logs (level, created_at)");
        DB::statement("CREATE INDEX ON logs USING gin (context)");

        // Создаём партиции на 3 месяца вперёд
        $this->createPartitions(3);
    }

    private function createPartitions(int $months)
    {
        for ($i = 0; $i < $months; $i++) {
            $date = now()->addMonths($i)->startOfMonth();
            $nextDate = $date->copy()->addMonth();

            $partitionName = "logs_" . $date->format('Y_m');

            DB::statement("
                CREATE TABLE IF NOT EXISTS {$partitionName}
                PARTITION OF logs
                FOR VALUES FROM ('{$date->format('Y-m-d')}')
                             TO ('{$nextDate->format('Y-m-d')}')
            ");
        }
    }

    public function down()
    {
        DB::statement("DROP TABLE IF EXISTS logs CASCADE");
    }
};

// app/Console/Commands/ManageLogPartitions.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ManageLogPartitions extends Command
{
    protected $signature = 'logs:manage-partitions
                            {--create-future=3 : Create partitions N months ahead}
                            {--drop-old=3 : Drop partitions older than N months}';

    public function handle()
    {
        $this->createFuturePartitions();
        $this->dropOldPartitions();
    }

    private function createFuturePartitions()
    {
        $months = $this->option('create-future');
        $this->info("Creating partitions for next {$months} months...");

        for ($i = 0; $i < $months; $i++) {
            $date = now()->addMonths($i)->startOfMonth();
            $nextDate = $date->copy()->addMonth();

            $partitionName = "logs_" . $date->format('Y_m');

            // Проверяем существование
            $exists = DB::selectOne("
                SELECT 1 FROM pg_tables
                WHERE tablename = ?
            ", [$partitionName]);

            if ($exists) {
                $this->comment("Partition {$partitionName} already exists");
                continue;
            }

            DB::statement("
                CREATE TABLE {$partitionName}
                PARTITION OF logs
                FOR VALUES FROM ('{$date->format('Y-m-d')}')
                             TO ('{$nextDate->format('Y-m-d')}')
            ");

            $this->info("✓ Created partition {$partitionName}");
        }
    }

    private function dropOldPartitions()
    {
        $months = $this->option('drop-old');
        $cutoffDate = now()->subMonths($months)->startOfMonth();

        $this->info("Dropping partitions older than {$cutoffDate->format('Y-m')}...");

        // Найти старые партиции
        $partitions = DB::select("
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE 'logs_%'
              AND tablename < ?
        ", ["logs_" . $cutoffDate->format('Y_m')]);

        foreach ($partitions as $partition) {
            $name = $partition->tablename;

            if (!$this->confirm("Drop partition {$name}?", true)) {
                continue;
            }

            // Опционально: экспорт в архив
            $this->exportToArchive($name);

            // Удаляем партицию
            DB::statement("DROP TABLE IF EXISTS {$name}");

            $this->info("✓ Dropped partition {$name}");
        }
    }

    private function exportToArchive(string $partition)
    {
        // Экспорт в S3, файловую систему и т.д.
        $this->comment("Exporting {$partition} to archive...");

        $data = DB::table($partition)->get();

        Storage::disk('archive')->put(
            "{$partition}.json",
            json_encode($data)
        );
    }
}

// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Управлять партициями ежемесячно
    $schedule->command('logs:manage-partitions --create-future=3 --drop-old=3')
        ->monthly();
}

// Использование (прозрачно для приложения)
DB::table('logs')->insert([
    'level' => 'error',
    'message' => 'Something went wrong',
    'context' => json_encode(['user_id' => 123]),
    'created_at' => now(),
]);

// Query автоматически использует partition pruning
$recentErrors = DB::table('logs')
    ->where('level', 'error')
    ->where('created_at', '>=', now()->subDays(7))
    ->get();
// Сканирует только партиции за последние 7 дней!
```

</details>

### Задание 2: Orders Partitioning by Date

**Задача:** Партиционировать таблицу заказов по дате для быстрого архивирования старых заказов.

<details>
<summary>Решение</summary>

```php
// Migration
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        // Создаём partitioned table
        DB::statement("
            CREATE TABLE orders (
                id BIGSERIAL,
                user_id BIGINT NOT NULL,
                total DECIMAL(10, 2),
                status VARCHAR(20),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP,
                PRIMARY KEY (id, created_at)
            ) PARTITION BY RANGE (created_at)
        ");

        // Индексы
        DB::statement("CREATE INDEX ON orders (user_id, created_at)");
        DB::statement("CREATE INDEX ON orders (status, created_at)");

        // Создать партиции за последние 12 месяцев
        for ($i = 11; $i >= 0; $i--) {
            $date = now()->subMonths($i)->startOfMonth();
            $nextDate = $date->copy()->addMonth();

            $partitionName = "orders_" . $date->format('Y_m');

            DB::statement("
                CREATE TABLE {$partitionName}
                PARTITION OF orders
                FOR VALUES FROM ('{$date->format('Y-m-d')}')
                             TO ('{$nextDate->format('Y-m-d')}')
            ");
        }

        // Партиция для будущих заказов
        DB::statement("
            CREATE TABLE orders_future
            PARTITION OF orders
            FOR VALUES FROM ('{$this->getNextMonthStart()}')
                         TO (MAXVALUE)
        ");
    }

    private function getNextMonthStart()
    {
        return now()->addMonth()->startOfMonth()->format('Y-m-d');
    }

    public function down()
    {
        DB::statement("DROP TABLE IF EXISTS orders CASCADE");
    }
};

// app/Models/Order.php (прозрачно работает с партициями)
class Order extends Model
{
    // Стандартная модель, партиционирование прозрачно
}

// Queries используют partition pruning
Order::where('created_at', '>=', now()->subDays(30))->get();
// Сканирует только партицию текущего месяца!

// app/Console/Commands/ArchiveOldOrders.php
class ArchiveOldOrders extends Command
{
    protected $signature = 'orders:archive {--months-ago=12}';

    public function handle()
    {
        $monthsAgo = $this->option('months-ago');
        $cutoffDate = now()->subMonths($monthsAgo)->startOfMonth();

        $this->info("Archiving orders older than {$cutoffDate->format('Y-m')}...");

        // Найти старые партиции
        $partitions = DB::select("
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE 'orders_%'
              AND tablename != 'orders_future'
              AND tablename < ?
            ORDER BY tablename
        ", ["orders_" . $cutoffDate->format('Y_m')]);

        foreach ($partitions as $partition) {
            $name = $partition->tablename;

            $this->info("Processing partition {$name}...");

            // 1. Export to archive storage
            $this->exportPartition($name);

            // 2. Drop partition
            if ($this->confirm("Drop partition {$name}?")) {
                DB::statement("DROP TABLE {$name}");
                $this->info("✓ Dropped {$name}");
            }
        }
    }

    private function exportPartition(string $partition)
    {
        // Export по частям (chunk)
        $exported = 0;

        DB::table($partition)
            ->orderBy('id')
            ->chunk(1000, function ($orders) use ($partition, &$exported) {
                // Save to S3/file storage
                Storage::disk('archive')->append(
                    "{$partition}.jsonl",
                    $orders->map(fn($o) => json_encode($o))->implode("\n")
                );

                $exported += $orders->count();
            });

        $this->info("  Exported {$exported} orders");
    }
}
```

</details>

### Задание 3: Проверка Partition Pruning

**Задача:** Создать команду для анализа partition pruning в запросах.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/AnalyzePartitionPruning.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AnalyzePartitionPruning extends Command
{
    protected $signature = 'partition:analyze {query}';
    protected $description = 'Analyze partition pruning for a query';

    public function handle()
    {
        $query = $this->argument('query');

        $this->info("Analyzing query:");
        $this->line($query);
        $this->newLine();

        // EXPLAIN query
        $plan = DB::select("EXPLAIN {$query}");

        $this->info("Execution Plan:");

        $partitionsScanned = [];
        $pruningDetected = false;

        foreach ($plan as $row) {
            $line = $row->{'QUERY PLAN'};
            $this->line($line);

            // Detect partition scans
            if (preg_match('/Seq Scan on (\w+)/', $line, $matches)) {
                $partitionsScanned[] = $matches[1];
            }

            // Detect pruning
            if (str_contains($line, 'Partitions')) {
                $pruningDetected = true;
            }
        }

        $this->newLine();

        if ($pruningDetected) {
            $this->info("✓ Partition pruning is ACTIVE");
            $this->info("Partitions scanned: " . count($partitionsScanned));

            $this->table(['Partition'], array_map(fn($p) => [$p], $partitionsScanned));
        } else {
            $this->warn("⚠ Partition pruning is NOT detected");
            $this->warn("This query may scan ALL partitions!");
            $this->comment("Tip: Include partition key in WHERE clause");
        }
    }
}

// Примеры использования:
// php artisan partition:analyze "SELECT * FROM orders WHERE created_at >= '2024-01-01'"
// php artisan partition:analyze "SELECT * FROM logs WHERE level = 'error' AND created_at > NOW() - INTERVAL '7 days'"

// app/Console/Commands/ShowPartitionStats.php
class ShowPartitionStats extends Command
{
    protected $signature = 'partition:stats {table}';

    public function handle()
    {
        $table = $this->argument('table');

        // Получить информацию о партициях
        $partitions = DB::select("
            SELECT
                c.relname as partition_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) as size,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_live_tup as live_rows,
                n_dead_tup as dead_rows
            FROM pg_class c
            JOIN pg_stat_user_tables s ON c.oid = s.relid
            WHERE c.relname LIKE ?
            ORDER BY c.relname
        ", ["{$table}_%"]);

        $this->table(
            ['Partition', 'Size', 'Inserts', 'Updates', 'Deletes', 'Live Rows', 'Dead Rows'],
            array_map(fn($p) => [
                $p->partition_name,
                $p->size,
                number_format($p->inserts),
                number_format($p->updates),
                number_format($p->deletes),
                number_format($p->live_rows),
                number_format($p->dead_rows),
            ], $partitions)
        );

        // Total
        $totalSize = DB::selectOne("
            SELECT pg_size_pretty(pg_total_relation_size(?::regclass)) as size
        ", [$table])->size;

        $this->newLine();
        $this->info("Total table size: {$totalSize}");
    }
}
```

</details>

---

## На собеседовании скажешь

> "Partitioning — разделение большой таблицы на меньшие физические части. Типы: Range (по дате), List (по категориям), Hash (равномерное распределение). Преимущества: query только нужные партиции (partition pruning), простое архивирование (DROP TABLE), быстрый maintenance. PostgreSQL поддерживает декларативное partitioning, partition key должен быть в PK. Индексы на parent создаются автоматически на партициях. Laravel: создавать через DB::statement, автоматизировать через scheduler (создание будущих, удаление старых). Best practices: для millions+ rows, всегда partition key в WHERE, EXPLAIN для проверки pruning. MySQL поддерживает, но без foreign keys."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
