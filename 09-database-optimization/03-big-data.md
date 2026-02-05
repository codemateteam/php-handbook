# 9.3 Работа с большими данными

> **TL;DR**
> Big Data в БД — таблицы с millions/billions строк. Проблемы: медленные queries, долгие migrations, lock contentions. Решения: Partitioning (разделение по времени/регионам), Sharding (горизонтальное разделение), Read Replicas (analytics на replica), Archiving (старые данные в S3), Bulk INSERT (batch вместо single), Cursor (streaming без памяти). Оптимизация: covering indexes, materialized views, index на JSONB.

## Содержание

- [Что это](#что-это)
- [Проблемы с большими таблицами](#проблемы-с-большими-таблицами)
  - [1. Slow SELECT](#1-slow-select)
  - [2. Slow INSERT/UPDATE](#2-slow-insertupdate)
  - [3. Долгие Migrations](#3-долгие-migrations)
  - [4. Archiving старых данных](#4-archiving-старых-данных)
  - [5. Read Replicas для analytics](#5-read-replicas-для-analytics)
  - [6. Cursor для batch processing](#6-cursor-для-batch-processing)
- [Оптимизация queries на больших таблицах](#оптимизация-queries-на-больших-таблицах)
- [Monitoring больших таблиц](#monitoring-больших-таблиц)
- [Best Practices](#best-practices)
- [Tools](#tools)
- [Практические задания](#практические-задания)

## Что это

**Big Data в контексте БД:**
Таблицы с millions/billions строк, которые требуют специальных подходов для эффективной работы.

**Проблемы:**
- Медленные queries
- Долгие migrations
- Нехватка памяти
- Slow backup/restore
- Lock contentions

**Решения:**
- Partitioning
- Sharding
- Read replicas
- Archiving
- Batch processing

---

## Проблемы с большими таблицами

### 1. Slow SELECT

**Проблема:**

```sql
-- 100 million rows
SELECT * FROM logs WHERE user_id = 123;
-- Slow! (даже с индексом)
```

**Решения:**

**A. Partitioning**

```sql
-- Partition по месяцам
CREATE TABLE logs_2024_01 PARTITION OF logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Query только нужную партицию
SELECT * FROM logs
WHERE created_at >= '2024-01-15'
  AND user_id = 123;
-- Scan только logs_2024_01
```

**B. Sharding**

```php
// Разделить users по ID на разные БД
function getUserShard($userId)
{
    return 'shard_' . ($userId % 4);  // 4 shards
}

$shardName = getUserShard(123);
$user = DB::connection($shardName)->table('users')->find(123);
```

---

### 2. Slow INSERT/UPDATE

**Проблема:**

```php
// Bulk insert 1 million rows (медленно)
foreach ($records as $record) {
    DB::table('logs')->insert($record);  // 1 million queries!
}
```

**Решения:**

**A. Bulk INSERT**

```php
// Batch insert (100x faster)
$chunks = array_chunk($records, 1000);

foreach ($chunks as $chunk) {
    DB::table('logs')->insert($chunk);
}
```

**B. COPY (PostgreSQL)**

```php
// Fastest: PostgreSQL COPY
$file = '/tmp/logs.csv';

// Export to CSV
$fp = fopen($file, 'w');
foreach ($records as $record) {
    fputcsv($fp, $record);
}
fclose($fp);

// COPY from CSV (super fast!)
DB::statement("
    COPY logs (user_id, action, created_at)
    FROM '{$file}'
    CSV
");
```

**C. LOAD DATA INFILE (MySQL)**

```php
// MySQL equivalent
DB::statement("
    LOAD DATA LOCAL INFILE '{$file}'
    INTO TABLE logs
    FIELDS TERMINATED BY ','
    LINES TERMINATED BY '\\n'
    (user_id, action, created_at)
");
```

---

### 3. Долгие Migrations

**Проблема:**

```php
// Добавить колонку к большой таблице (часы!)
Schema::table('logs', function (Blueprint $table) {
    $table->string('ip_address')->nullable();
});
// Locks table!
```

**Решения:**

**A. Online Schema Change (PostgreSQL)**

```php
// PostgreSQL: добавить колонку без lock
DB::statement("
    ALTER TABLE logs
    ADD COLUMN ip_address VARCHAR(255) DEFAULT NULL
");
// Быстро (metadata change only)
```

**B. pt-online-schema-change (MySQL)**

```bash
# Percona Toolkit
pt-online-schema-change \
  --alter "ADD COLUMN ip_address VARCHAR(255)" \
  D=mydb,t=logs \
  --execute
# Создаёт новую таблицу, копирует данные, swap
```

**C. Batch UPDATE**

```php
// Вместо UPDATE всех строк сразу
$lastId = 0;
$batchSize = 10000;

while (true) {
    $updated = DB::table('logs')
        ->where('id', '>', $lastId)
        ->whereNull('ip_address')
        ->limit($batchSize)
        ->update(['ip_address' => DB::raw('...')]);

    if ($updated === 0) {
        break;
    }

    $lastId = DB::table('logs')
        ->where('id', '>', $lastId)
        ->min('id');

    sleep(1);  // Пауза чтобы не нагружать БД
}
```

---

### 4. Archiving старых данных

**Проблема:**

```sql
-- Logs за 5 лет (миллиарды строк)
-- Нужны только последние 3 месяца
```

**Решения:**

**A. Partitioning + DROP**

```php
// Удалить старую партицию (instant!)
DB::statement("DROP TABLE logs_2023_01");
// Быстро (no DELETE queries)
```

**B. Archive to cold storage**

```php
class ArchiveOldLogs extends Command
{
    public function handle()
    {
        $cutoffDate = now()->subMonths(3);

        // Export to S3
        $logs = DB::table('logs')
            ->where('created_at', '<', $cutoffDate)
            ->cursor();

        $file = storage_path('logs_archive_' . now()->format('Y-m-d') . '.csv');
        $fp = fopen($file, 'w');

        foreach ($logs as $log) {
            fputcsv($fp, (array) $log);
        }

        fclose($fp);

        // Upload to S3
        Storage::disk('s3')->put(
            'archives/' . basename($file),
            file_get_contents($file)
        );

        // Delete old data
        DB::table('logs')
            ->where('created_at', '<', $cutoffDate)
            ->delete();

        unlink($file);
    }
}

// Scheduler: archive раз в месяц
$schedule->command('logs:archive')->monthly();
```

---

### 5. Read Replicas для analytics

**Проблема:**

```sql
-- Heavy analytics queries блокируют production
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as count,
    AVG(response_time) as avg_response
FROM logs
WHERE created_at >= NOW() - INTERVAL '1 year'
GROUP BY DATE_TRUNC('day', created_at);
-- Slow query блокирует другие queries
```

**Решение: Read Replica**

```php
// config/database.php
'connections' => [
    'mysql' => [
        'write' => [
            'host' => 'master.db.example.com',
        ],
        'read' => [
            ['host' => 'replica1.db.example.com'],
            ['host' => 'replica2.db.example.com'],
        ],
    ],
],

// Analytics на replica
DB::connection('mysql')
    ->table('logs')
    ->where('created_at', '>=', now()->subYear())
    ->groupBy(DB::raw('DATE_TRUNC("day", created_at)'))
    ->get();
// Не нагружает master
```

---

### 6. Cursor для batch processing

**Проблема:**

```php
// Загрузить 100 million rows в память (crash!)
$logs = Log::all();
```

**Решение: Cursor**

```php
// Streaming (не загружает всё в память)
foreach (Log::cursor() as $log) {
    $this->process($log);
}

// Или chunk
Log::chunk(10000, function ($logs) {
    foreach ($logs as $log) {
        $this->process($log);
    }
});
```

---

## Оптимизация queries на больших таблицах

### 1. Covering Index

```sql
-- Query
SELECT id, user_id, created_at
FROM logs
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 100;

-- Covering index (содержит ВСЕ нужные колонки)
CREATE INDEX idx_logs_user_created_cover
ON logs (user_id, created_at DESC)
INCLUDE (id);

-- Теперь БД не читает таблицу (index-only scan)
```

---

### 2. Index на JSONB

```sql
-- Slow: scan всю таблицу
SELECT * FROM products
WHERE attributes->>'brand' = 'Dell';

-- Fast: GIN index
CREATE INDEX idx_products_attributes ON products USING gin (attributes);
```

---

### 3. Partial Index

```sql
-- Index только нужные строки
CREATE INDEX idx_logs_pending
ON logs (user_id)
WHERE status = 'pending';

-- Query использует partial index
SELECT * FROM logs
WHERE user_id = 123 AND status = 'pending';
```

---

### 4. Materialized Views

```sql
-- Pre-compute expensive aggregations
CREATE MATERIALIZED VIEW daily_stats AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as count,
    AVG(response_time) as avg_response
FROM logs
GROUP BY DATE_TRUNC('day', created_at);

-- Refresh periodically
REFRESH MATERIALIZED VIEW daily_stats;

-- Fast query
SELECT * FROM daily_stats WHERE date >= NOW() - INTERVAL '30 days';
```

---

## Monitoring больших таблиц

**PostgreSQL:**

```sql
-- Размер таблиц
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**MySQL:**

```sql
-- Размер таблиц
SELECT
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = 'mydb'
ORDER BY (data_length + index_length) DESC;
```

---

## Best Practices

```
✓ Partitioning для временных данных (logs, events)
✓ Sharding для horizontal scaling
✓ Read replicas для analytics
✓ Archive старых данных (S3, cold storage)
✓ Bulk INSERT вместо single inserts
✓ Cursor для batch processing
✓ Covering indexes для частых queries
✓ Materialized views для aggregations
✓ Мониторинг размера таблиц и slow queries
✓ Vacuum/Analyze регулярно (PostgreSQL)
✓ Optimize Table регулярно (MySQL)
```

---

## Tools

**PostgreSQL:**
- `pg_partman` — автоматическое партиционирование
- `pgbadger` — анализ логов
- `pg_repack` — rebuild таблиц без downtime

**MySQL:**
- `pt-online-schema-change` — миграции без downtime
- `pt-archiver` — архивирование данных
- `mysqldumper` — быстрый dump больших БД

---

## Практические задания

### Задание 1: Оптимизировать bulk insert

Нужно импортировать 1 миллион записей логов из CSV файла. Наивный подход слишком медленный. Оптимизируйте.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: по одной записи (часы!)
class ImportLogsCommand extends Command
{
    public function handle()
    {
        $file = fopen(storage_path('logs.csv'), 'r');

        while (($row = fgetcsv($file)) !== false) {
            Log::create([
                'user_id' => $row[0],
                'action' => $row[1],
                'created_at' => $row[2],
            ]);
        }

        fclose($file);
    }
}

// ✅ ХОРОШО: batch insert (минуты)
class ImportLogsCommand extends Command
{
    public function handle()
    {
        $file = fopen(storage_path('logs.csv'), 'r');
        $batch = [];
        $batchSize = 1000;

        while (($row = fgetcsv($file)) !== false) {
            $batch[] = [
                'user_id' => $row[0],
                'action' => $row[1],
                'created_at' => $row[2],
            ];

            // Вставить пакет
            if (count($batch) >= $batchSize) {
                DB::table('logs')->insert($batch);
                $batch = [];
            }
        }

        // Остаток
        if (!empty($batch)) {
            DB::table('logs')->insert($batch);
        }

        fclose($file);
    }
}

// ⚡ СУПЕР БЫСТРО: PostgreSQL COPY (секунды!)
class ImportLogsCommand extends Command
{
    public function handle()
    {
        $file = storage_path('logs.csv');

        DB::statement("
            COPY logs (user_id, action, created_at)
            FROM '{$file}'
            CSV HEADER
        ");

        $this->info('Imported successfully!');
    }
}

// MySQL LOAD DATA INFILE
class ImportLogsCommand extends Command
{
    public function handle()
    {
        $file = storage_path('logs.csv');

        DB::statement("
            LOAD DATA LOCAL INFILE '{$file}'
            INTO TABLE logs
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n'
            IGNORE 1 LINES
            (user_id, action, created_at)
        ");

        $this->info('Imported successfully!');
    }
}
```

**Производительность:**
- Single INSERT: ~3 часа для 1M записей
- Batch INSERT (1000): ~5 минут для 1M записей
- COPY/LOAD DATA: ~30 секунд для 1M записей
</details>

---

### Задание 2: Реализовать archiving старых данных

Таблица `activity_logs` содержит 500 миллионов записей за 5 лет. Для работы приложения нужны только последние 3 месяца. Реализуйте архивирование.

<details>
<summary>Решение</summary>

```php
// Command для архивирования
class ArchiveOldLogsCommand extends Command
{
    protected $signature = 'logs:archive {--dry-run}';

    public function handle()
    {
        $cutoffDate = now()->subMonths(3);

        $this->info("Archiving logs older than {$cutoffDate}...");

        // Подсчет записей
        $count = DB::table('activity_logs')
            ->where('created_at', '<', $cutoffDate)
            ->count();

        $this->info("Found {$count} records to archive");

        if ($this->option('dry-run')) {
            return;
        }

        // Export в CSV
        $filename = 'logs_archive_' . now()->format('Y-m-d') . '.csv';
        $filepath = storage_path('archives/' . $filename);

        if (!file_exists(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        $file = fopen($filepath, 'w');

        // Header
        fputcsv($file, ['id', 'user_id', 'action', 'ip_address', 'created_at']);

        // Streaming export (не загружает всё в память)
        DB::table('activity_logs')
            ->where('created_at', '<', $cutoffDate)
            ->orderBy('id')
            ->chunk(10000, function ($logs) use ($file) {
                foreach ($logs as $log) {
                    fputcsv($file, (array) $log);
                }
            });

        fclose($file);

        $this->info("Exported to {$filepath}");

        // Compress
        $compressed = $filepath . '.gz';
        $this->info('Compressing...');

        exec("gzip {$filepath}");

        // Upload to S3
        $this->info('Uploading to S3...');

        Storage::disk('s3')->put(
            'archives/' . basename($compressed),
            file_get_contents($compressed)
        );

        // Delete from database
        $this->info('Deleting old records...');

        $deleted = 0;
        while (true) {
            $batch = DB::table('activity_logs')
                ->where('created_at', '<', $cutoffDate)
                ->limit(10000)
                ->delete();

            $deleted += $batch;
            $this->info("Deleted {$deleted} / {$count}");

            if ($batch === 0) {
                break;
            }

            sleep(1); // Пауза чтобы не нагружать БД
        }

        // Delete local file
        unlink($compressed);

        $this->info('Archive completed!');
    }
}

// Scheduler: архивировать раз в месяц
protected function schedule(Schedule $schedule)
{
    $schedule->command('logs:archive')
        ->monthlyOn(1, '02:00');
}

// Command для восстановления из архива
class RestoreLogsCommand extends Command
{
    protected $signature = 'logs:restore {file}';

    public function handle()
    {
        $file = $this->argument('file');

        // Download from S3
        $this->info('Downloading from S3...');
        $content = Storage::disk('s3')->get($file);

        $localFile = storage_path('temp/' . basename($file));
        file_put_contents($localFile, $content);

        // Decompress
        exec("gunzip {$localFile}");
        $csvFile = str_replace('.gz', '', $localFile);

        // Import
        $this->info('Importing...');

        DB::statement("
            COPY activity_logs (id, user_id, action, ip_address, created_at)
            FROM '{$csvFile}'
            CSV HEADER
        ");

        unlink($csvFile);

        $this->info('Restore completed!');
    }
}
```

**Преимущества:**
- БД остается маленькой и быстрой
- Архивы в S3 (дешевое хранение)
- Можно восстановить при необходимости
- Batch delete (не блокирует БД)
</details>

---

### Задание 3: Оптимизировать query на большой таблице

Дан медленный запрос к таблице с 100 миллионами записей:

```sql
SELECT * FROM orders
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY total DESC
LIMIT 100;
```

EXPLAIN показывает Seq Scan. Оптимизируйте.

<details>
<summary>Решение</summary>

```php
// Анализ проблемы
// EXPLAIN ANALYZE показывает:
// Seq Scan on orders (cost=0..1000000 rows=5000000)
//   Filter: (status = 'pending' AND created_at > ...)

// Решение 1: Composite Index
Schema::table('orders', function (Blueprint $table) {
    // Covering index (содержит все нужные колонки)
    $table->index(['status', 'created_at', 'total', 'id'], 'idx_orders_pending_recent');
});

// Решение 2: Partial Index (PostgreSQL)
DB::statement("
    CREATE INDEX idx_orders_pending ON orders (created_at, total)
    WHERE status = 'pending'
");
// Меньший размер, быстрее

// Решение 3: Materialized View для частого запроса
DB::statement("
    CREATE MATERIALIZED VIEW pending_orders_recent AS
    SELECT *
    FROM orders
    WHERE status = 'pending'
      AND created_at > NOW() - INTERVAL '7 days'
");

// Refresh периодически
DB::statement("REFRESH MATERIALIZED VIEW pending_orders_recent");

// Query к materialized view (мгновенно!)
$orders = DB::table('pending_orders_recent')
    ->orderBy('total', 'desc')
    ->limit(100)
    ->get();

// Решение 4: Партиционирование по created_at
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id');
    $table->string('status');
    $table->decimal('total', 10, 2);
    $table->timestamp('created_at');
    $table->timestamp('updated_at');
});

// PostgreSQL Partitioning
DB::statement("
    CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
");
// Query будет сканировать только нужные партиции

// Eloquent query builder (использует индексы)
class Order extends Model
{
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeRecent($query, $days = 7)
    {
        return $query->where('created_at', '>', now()->subDays($days));
    }

    public function scopeHighestValue($query)
    {
        return $query->orderBy('total', 'desc');
    }
}

// Использование
$orders = Order::pending()
    ->recent(7)
    ->highestValue()
    ->limit(100)
    ->get();

// EXPLAIN после оптимизации:
// Index Scan using idx_orders_pending on orders (cost=0..500 rows=100)
//   Index Cond: (status = 'pending' AND created_at > ...)
//   Order By: total DESC
// 1000x быстрее!
```

**Итог:**
- БЫЛО: Seq Scan 100M строк, ~30 секунд
- СТАЛО: Index Scan ~1000 строк, ~10ms
- Covering index избегает чтение таблицы
- Partial index экономит место
</details>

---

## На собеседовании скажешь

> "Big Data в БД — millions/billions строк. Проблемы: медленные queries, долгие migrations, нехватка памяти. Решения: Partitioning (разделить по времени), Sharding (горизонтальное разделение), Read Replicas (analytics на replica), Archiving (старые данные в S3), Bulk INSERT (batch вместо single), Cursor (streaming без памяти). Оптимизация: covering indexes, partial indexes, materialized views, index на JSONB. Migrations: online schema change, batch UPDATE. Monitoring: размер таблиц, slow queries. Tools: pg_partman, pt-online-schema-change, pt-archiver."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
