# 9.9 Cursor (Курсоры)

> **TL;DR:** Cursor для построчной итерации без загрузки всего в память. Laravel cursor() использует server-side cursors. Use cases: экспорт больших данных в CSV, обработка millions+ rows. Chunk по страницам (можно UPDATE), cursor streaming (read-only). Lazy Collections = cursor с functional операциями. Не использовать для маленьких выборок.

## Содержание

- [Что это](#что-это)
- [PostgreSQL Cursor](#postgresql-cursor)
- [Laravel Cursor](#laravel-cursor-lazy-collections)
- [Chunk vs Cursor](#chunk-vs-cursor)
- [Lazy Collections](#lazy-collections)
- [Export в CSV](#export-в-csv)
- [Cursor с фильтрами](#cursor-с-фильтрами)
- [PostgreSQL Server-Side Cursor](#postgresql-server-side-cursor)
- [WITH HOLD](#with-hold-postgresql)
- [Cursor для UPDATE](#cursor-для-update)
- [MySQL Cursor](#mysql-cursor)
- [Best Practices](#best-practices)
- [Когда НЕ использовать cursor](#когда-не-использовать-cursor)
- [Monitoring](#monitoring)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Cursor:**
Механизм для итерации по результатам SQL запроса строка за строкой.

**Зачем:**
- Обработка больших объёмов данных (не загружать всё в память)
- Построчная обработка с логикой
- Streaming data

**Trade-off:**
- ✅ Не загружает всё в память
- ❌ Медленнее чем bulk операции
- ❌ Держит соединение открытым

**Когда использовать:**
- Миллионы строк (не влезают в память)
- Сложная логика для каждой строки
- Export больших данных

---

## PostgreSQL Cursor

**Базовый пример:**

```sql
-- Объявить cursor
DECLARE my_cursor CURSOR FOR
    SELECT id, email, name FROM users;

-- Открыть cursor
OPEN my_cursor;

-- Fetch строки
FETCH NEXT FROM my_cursor;  -- Одна строка
FETCH 10 FROM my_cursor;    -- 10 строк

-- Закрыть cursor
CLOSE my_cursor;
```

---

## Laravel Cursor (Lazy Collections)

**Laravel предоставляет Eloquent cursor():**

```php
// ❌ ПЛОХО: загрузит ВСЁ в память
$users = User::all();  // 10 million users → OutOfMemoryError

foreach ($users as $user) {
    $this->process($user);
}

// ✅ ХОРОШО: cursor
foreach (User::cursor() as $user) {
    $this->process($user);
}
// Загружает по 1000 строк, освобождает память после обработки
```

**Как работает:**

```php
// User::cursor() под капотом
public function cursor()
{
    return $this->applyScopes()
        ->query
        ->cursor();  // DB cursor (PostgreSQL DECLARE CURSOR)
}
```

---

## Chunk vs Cursor

**Chunk (по страницам):**

```php
User::chunk(1000, function ($users) {
    foreach ($users as $user) {
        $this->process($user);
    }
});

// Выполняет:
// SELECT * FROM users LIMIT 1000 OFFSET 0
// SELECT * FROM users LIMIT 1000 OFFSET 1000
// SELECT * FROM users LIMIT 1000 OFFSET 2000
// ...
```

**Cursor (streaming):**

```php
foreach (User::cursor() as $user) {
    $this->process($user);
}

// Выполняет:
// DECLARE cursor_name CURSOR FOR SELECT * FROM users
// FETCH 1000 FROM cursor_name
// FETCH 1000 FROM cursor_name
// ...
```

**Когда chunk, когда cursor:**

| Chunk | Cursor |
|-------|--------|
| Можно изменять строки | Read-only |
| ORDER BY нестабильный | ORDER BY стабильный |
| Простая логика | Сложная логика |
| Небольшие таблицы | Огромные таблицы |

---

## Lazy Collections

**Laravel Lazy Collections = cursor под капотом:**

```php
// Обработать 10 млн пользователей
User::cursor()
    ->filter(fn ($user) => $user->isActive())
    ->map(fn ($user) => [
        'email' => $user->email,
        'name' => $user->name,
    ])
    ->each(fn ($data) => $this->sendEmail($data));

// Всё выполняется streaming (не загружает всё в память)
```

---

## Export в CSV

**Плохо: загружает всё в память**

```php
// ❌ OutOfMemoryError на больших данных
$users = User::all();

$csv = Writer::createFromPath('users.csv', 'w+');
$csv->insertAll($users->toArray());
```

**Хорошо: cursor**

```php
// ✅ Streaming export
$csv = Writer::createFromPath('users.csv', 'w+');

foreach (User::cursor() as $user) {
    $csv->insertOne([
        $user->id,
        $user->email,
        $user->name,
    ]);
}
```

**Laravel Job:**

```php
class ExportUsersJob implements ShouldQueue
{
    public function handle()
    {
        $file = storage_path('exports/users.csv');
        $handle = fopen($file, 'w');

        // Header
        fputcsv($handle, ['ID', 'Email', 'Name']);

        // Cursor (streaming)
        foreach (User::cursor() as $user) {
            fputcsv($handle, [
                $user->id,
                $user->email,
                $user->name,
            ]);
        }

        fclose($handle);

        // Send to user...
    }
}
```

---

## Cursor с фильтрами

```php
// Только активные пользователи
foreach (User::where('is_active', true)->cursor() as $user) {
    $this->process($user);
}

// С отношениями (N+1 problem!)
foreach (User::with('orders')->cursor() as $user) {
    $this->process($user);
}
```

---

## PostgreSQL Server-Side Cursor

**Для очень больших выборок (миллиарды строк):**

```php
class ProcessHugeTable extends Command
{
    public function handle()
    {
        DB::transaction(function () {
            // Объявить cursor
            DB::statement("DECLARE my_cursor CURSOR FOR SELECT * FROM huge_table");

            while (true) {
                // Fetch 1000 строк
                $rows = DB::select("FETCH 1000 FROM my_cursor");

                if (empty($rows)) {
                    break;  // Конец данных
                }

                foreach ($rows as $row) {
                    $this->process($row);
                }
            }

            // Закрыть cursor
            DB::statement("CLOSE my_cursor");
        });
    }
}
```

---

## WITH HOLD (PostgreSQL)

**Обычный cursor закрывается после COMMIT:**

```sql
BEGIN;
DECLARE my_cursor CURSOR FOR SELECT * FROM users;
COMMIT;
-- Cursor закрыт!
```

**WITH HOLD — cursor остаётся открытым:**

```sql
BEGIN;
DECLARE my_cursor CURSOR WITH HOLD FOR SELECT * FROM users;
COMMIT;

-- Cursor всё ещё открыт
FETCH FROM my_cursor;
```

**Laravel:**

```php
DB::transaction(function () {
    DB::statement("DECLARE my_cursor CURSOR WITH HOLD FOR SELECT * FROM users");
});

// Cursor доступен вне транзакции
$rows = DB::select("FETCH 1000 FROM my_cursor");

DB::statement("CLOSE my_cursor");
```

---

## Cursor для UPDATE

**Update по частям (чтобы не блокировать таблицу):**

```php
class UpdateUsersInBatches extends Command
{
    public function handle()
    {
        $processed = 0;

        foreach (User::where('status', 'pending')->cursor() as $user) {
            $user->update(['status' => 'active']);

            $processed++;

            if ($processed % 1000 === 0) {
                $this->info("Processed: {$processed}");
            }
        }
    }
}
```

**Лучше: chunk с UPDATE:**

```php
User::where('status', 'pending')
    ->chunkById(1000, function ($users) {
        User::whereIn('id', $users->pluck('id'))
            ->update(['status' => 'active']);
    });
```

---

## MySQL Cursor

**MySQL НЕ поддерживает server-side cursors в клиентских запросах!**

**Laravel cursor() в MySQL работает иначе:**

```php
// MySQL: не настоящий cursor, просто unbuffered query
foreach (User::cursor() as $user) {
    // Всё равно загружает всё, но streaming
}
```

**Stored Procedure с cursor (MySQL):**

```sql
DELIMITER //

CREATE PROCEDURE process_users()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id INT;
    DECLARE user_email VARCHAR(255);

    DECLARE cur CURSOR FOR SELECT id, email FROM users;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO user_id, user_email;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- Process...

    END LOOP;

    CLOSE cur;
END //

DELIMITER ;

-- Вызов
CALL process_users();
```

**Проблема:** сложно, редко используется.

---

## Best Practices

```
✓ Cursor для ОГРОМНЫХ таблиц (millions+ rows)
✓ Laravel cursor() для Eloquent
✓ Lazy Collections для цепочки операций
✓ CSV export через cursor (streaming)
✓ Chunk для UPDATE/DELETE (не cursor!)
✓ Избегай cursor если можешь сделать bulk операцию
✓ PostgreSQL: server-side cursor для миллиардов строк
✓ MySQL: cursor только в stored procedures
✓ Мониторь открытые cursors (pg_cursors)
```

---

## Когда НЕ использовать cursor

**1. Можно bulk операцию:**

```php
// ❌ Медленно: cursor
foreach (User::cursor() as $user) {
    $user->update(['updated_at' => now()]);
}

// ✅ Быстро: bulk update
User::query()->update(['updated_at' => now()]);
```

**2. Небольшая выборка:**

```php
// ❌ Overkill: cursor для 100 строк
foreach (User::limit(100)->cursor() as $user) {
    //...
}

// ✅ Просто get()
foreach (User::limit(100)->get() as $user) {
    //...
}
```

**3. Можно paginate:**

```php
// Для API pagination не cursor, а paginate()
User::paginate(50);
```

---

## Monitoring

**PostgreSQL: открытые cursors**

```sql
SELECT * FROM pg_cursors;

-- name           | statement                    | is_holdable | is_binary
-- my_cursor      | SELECT * FROM users          | f           | f
```

**Laravel: memory usage**

```php
class ProcessHugeTable extends Command
{
    public function handle()
    {
        $this->info('Memory: ' . memory_get_usage() / 1024 / 1024 . ' MB');

        foreach (User::cursor() as $user) {
            $this->process($user);
        }

        $this->info('Memory: ' . memory_get_usage() / 1024 / 1024 . ' MB');
        // Должно быть примерно одинаково
    }
}
```

---

## Практические задания

### Задание 1: CSV Export с Cursor

**Задача:** Реализовать экспорт миллионов записей в CSV без OutOfMemory.

<details>
<summary>Решение</summary>

```php
// app/Jobs/ExportUsersToCSV.php
namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ExportUsersToCSV implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600; // 1 hour

    public function __construct(
        private array $filters = []
    ) {}

    public function handle()
    {
        $filename = 'exports/users_' . now()->format('Y-m-d_His') . '.csv';
        $tempPath = storage_path("app/{$filename}");

        // Открываем файл для записи
        $handle = fopen($tempPath, 'w');

        // Header
        fputcsv($handle, [
            'ID',
            'Name',
            'Email',
            'Created At',
            'Last Login',
            'Orders Count',
            'Total Spent',
        ]);

        $exported = 0;
        $startTime = microtime(true);
        $memoryStart = memory_get_usage();

        // Cursor для streaming
        $query = User::query();

        // Применяем фильтры
        if (!empty($this->filters['created_from'])) {
            $query->where('created_at', '>=', $this->filters['created_from']);
        }

        if (!empty($this->filters['has_orders'])) {
            $query->whereHas('orders');
        }

        // Cursor через записи
        foreach ($query->cursor() as $user) {
            fputcsv($handle, [
                $user->id,
                $user->name,
                $user->email,
                $user->created_at->format('Y-m-d H:i:s'),
                $user->last_login?->format('Y-m-d H:i:s'),
                $user->orders_count ?? 0,
                $user->total_spent ?? 0,
            ]);

            $exported++;

            // Progress logging
            if ($exported % 10000 === 0) {
                $memoryUsed = round((memory_get_usage() - $memoryStart) / 1024 / 1024, 2);
                $elapsed = round(microtime(true) - $startTime, 2);
                $rate = round($exported / $elapsed);

                logger()->info("Export progress: {$exported} users ({$rate}/s, {$memoryUsed}MB)");
            }
        }

        fclose($handle);

        // Move to cloud storage
        Storage::disk('s3')->put(
            $filename,
            file_get_contents($tempPath)
        );

        unlink($tempPath);

        $duration = round(microtime(true) - $startTime, 2);
        $memoryPeak = round(memory_get_peak_usage() / 1024 / 1024, 2);

        logger()->info("Export completed: {$exported} users in {$duration}s (peak memory: {$memoryPeak}MB)");

        // Notify user
        // event(new ExportCompleted($filename));
    }
}

// app/Http/Controllers/ExportController.php
class ExportController extends Controller
{
    public function exportUsers(Request $request)
    {
        $validated = $request->validate([
            'created_from' => 'sometimes|date',
            'has_orders' => 'sometimes|boolean',
        ]);

        // Dispatch job
        ExportUsersToCSV::dispatch($validated);

        return response()->json([
            'message' => 'Export started. You will be notified when it\'s ready.',
        ]);
    }
}
```

</details>

### Задание 2: Batch Processing с Cursor

**Задача:** Обработать миллионы записей с комплексной логикой для каждой.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/ProcessInactiveUsers.php
namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ProcessInactiveUsers extends Command
{
    protected $signature = 'users:process-inactive
                            {--dry-run : Run without making changes}
                            {--limit= : Limit number of users to process}';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $limit = $this->option('limit');

        $this->info('Processing inactive users...');

        if ($dryRun) {
            $this->warn('DRY RUN MODE - no changes will be made');
        }

        $processed = 0;
        $deactivated = 0;
        $notified = 0;
        $deleted = 0;

        $progressBar = $this->output->createProgressBar();

        // Query для inactive users
        $query = User::where('last_login', '<', now()->subMonths(6))
            ->where('is_active', true);

        if ($limit) {
            $query->limit($limit);
        }

        // Cursor для обработки
        foreach ($query->cursor() as $user) {
            $processed++;
            $progressBar->advance();

            // Комплексная логика для каждого пользователя
            $inactiveDays = now()->diffInDays($user->last_login);

            try {
                if ($inactiveDays > 365) {
                    // Более года - удалить
                    if (!$dryRun) {
                        $this->deleteUser($user);
                    }
                    $deleted++;
                    $this->line("\n[DELETE] User {$user->id} - inactive for {$inactiveDays} days");

                } elseif ($inactiveDays > 180) {
                    // Более 6 месяцев - деактивировать
                    if (!$dryRun) {
                        $user->update(['is_active' => false]);
                    }
                    $deactivated++;
                    $this->line("\n[DEACTIVATE] User {$user->id} - inactive for {$inactiveDays} days");

                } else {
                    // Отправить напоминание
                    if (!$dryRun) {
                        $this->sendReactivationEmail($user);
                    }
                    $notified++;
                    $this->line("\n[NOTIFY] User {$user->id} - inactive for {$inactiveDays} days");
                }

            } catch (\Exception $e) {
                $this->error("\nError processing user {$user->id}: " . $e->getMessage());
            }

            // Memory check
            if ($processed % 1000 === 0) {
                $memoryMB = round(memory_get_usage() / 1024 / 1024, 2);
                $this->comment("\nMemory usage: {$memoryMB}MB");

                // Force garbage collection
                gc_collect_cycles();
            }
        }

        $progressBar->finish();

        $this->newLine(2);
        $this->info("Processing completed!");
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Processed', number_format($processed)],
                ['Notified', number_format($notified)],
                ['Deactivated', number_format($deactivated)],
                ['Deleted', number_format($deleted)],
            ]
        );

        if ($dryRun) {
            $this->warn('This was a DRY RUN - no changes were made');
        }
    }

    private function deleteUser(User $user)
    {
        DB::transaction(function () use ($user) {
            // Удалить связанные данные
            $user->orders()->delete();
            $user->preferences()->delete();
            $user->sessions()->delete();

            // Удалить пользователя
            $user->delete();
        });
    }

    private function sendReactivationEmail(User $user)
    {
        // Send email
        // Mail::to($user)->send(new ReactivationReminder($user));
    }
}
```

</details>

### Задание 3: Chunk vs Cursor Comparison

**Задача:** Создать команду для сравнения производительности chunk и cursor.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/BenchmarkCursorVsChunk.php
namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class BenchmarkCursorVsChunk extends Command
{
    protected $signature = 'benchmark:cursor-vs-chunk {count=10000}';
    protected $description = 'Compare cursor vs chunk performance';

    public function handle()
    {
        $count = (int) $this->argument('count');

        $this->info("Benchmarking with {$count} records...");
        $this->newLine();

        // Benchmark 1: All at once (BAD)
        $this->info('1. Loading all records at once...');
        $result1 = $this->benchmarkAll($count);

        // Benchmark 2: Chunk
        $this->info('2. Using chunk...');
        $result2 = $this->benchmarkChunk($count);

        // Benchmark 3: Cursor
        $this->info('3. Using cursor...');
        $result3 = $this->benchmarkCursor($count);

        // Results
        $this->newLine();
        $this->table(
            ['Method', 'Time (s)', 'Peak Memory (MB)', 'Avg Memory (MB)'],
            [
                [
                    'all()',
                    number_format($result1['time'], 3),
                    number_format($result1['peak_memory'], 2),
                    number_format($result1['avg_memory'], 2),
                ],
                [
                    'chunk(1000)',
                    number_format($result2['time'], 3),
                    number_format($result2['peak_memory'], 2),
                    number_format($result2['avg_memory'], 2),
                ],
                [
                    'cursor()',
                    number_format($result3['time'], 3),
                    number_format($result3['peak_memory'], 2),
                    number_format($result3['avg_memory'], 2),
                ],
            ]
        );

        // Winner
        $fastest = collect([$result1, $result2, $result3])->sortBy('time')->first();
        $this->info("Fastest: {$fastest['method']}");

        $leastMemory = collect([$result1, $result2, $result3])->sortBy('peak_memory')->first();
        $this->info("Least memory: {$leastMemory['method']}");
    }

    private function benchmarkAll($count): array
    {
        $memoryStart = memory_get_usage();
        $timeStart = microtime(true);

        $users = User::limit($count)->get();

        foreach ($users as $user) {
            // Simulate processing
            $this->processUser($user);
        }

        return [
            'method' => 'all()',
            'time' => microtime(true) - $timeStart,
            'peak_memory' => (memory_get_peak_usage() - $memoryStart) / 1024 / 1024,
            'avg_memory' => (memory_get_usage() - $memoryStart) / 1024 / 1024,
        ];
    }

    private function benchmarkChunk($count): array
    {
        $memoryStart = memory_get_usage();
        $timeStart = microtime(true);

        User::limit($count)->chunk(1000, function ($users) {
            foreach ($users as $user) {
                $this->processUser($user);
            }
        });

        return [
            'method' => 'chunk(1000)',
            'time' => microtime(true) - $timeStart,
            'peak_memory' => (memory_get_peak_usage() - $memoryStart) / 1024 / 1024,
            'avg_memory' => (memory_get_usage() - $memoryStart) / 1024 / 1024,
        ];
    }

    private function benchmarkCursor($count): array
    {
        $memoryStart = memory_get_usage();
        $timeStart = microtime(true);

        foreach (User::limit($count)->cursor() as $user) {
            $this->processUser($user);
        }

        return [
            'method' => 'cursor()',
            'time' => microtime(true) - $timeStart,
            'peak_memory' => (memory_get_peak_usage() - $memoryStart) / 1024 / 1024,
            'avg_memory' => (memory_get_usage() - $memoryStart) / 1024 / 1024,
        ];
    }

    private function processUser($user)
    {
        // Simulate processing
        $data = [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
        ];

        // Some calculation
        $hash = md5(json_encode($data));
    }
}

// Использование:
// php artisan benchmark:cursor-vs-chunk 10000
// php artisan benchmark:cursor-vs-chunk 100000
```

</details>

---

## На собеседовании скажешь

> "Cursor — механизм для построчной итерации по результатам SQL. Преимущество: не загружает всё в память. Laravel cursor() использует PostgreSQL server-side cursors, в MySQL unbuffered query. Use cases: экспорт больших данных в CSV, обработка millions+ rows. Chunk vs Cursor: chunk по страницам (можно UPDATE), cursor streaming (read-only, стабильный ORDER BY). Lazy Collections = cursor с functional операциями. PostgreSQL WITH HOLD для cursor вне транзакции. Best practices: cursor для огромных таблиц, bulk операции вместо cursor для UPDATE, мониторинг открытых cursors. Не использовать для маленьких выборок или если можно bulk операцию."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
