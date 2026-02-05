# 5.5 Jobs & Queues

## Краткое резюме

> **Jobs & Queues** — система асинхронного выполнения задач в фоне. Job — класс с логикой (SendEmail, ProcessFile), Queue — очередь задач.
>
> **Dispatch:** `JobName::dispatch()` отправляет в очередь. Worker (`queue:work`) обрабатывает задачи.
>
> **Важно:** `ShouldQueue` для асинхронности, `delay()` для отсрочки, `tries` для повторов. Job chains для последовательности, batches для параллельных задач.

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
Jobs — задачи, выполняемые в фоне (отправка email, обработка файлов). Queues — очереди задач для асинхронного выполнения.

**Основное:**
- Job — задача в фоне
- Queue — очередь задач
- Worker — процесс, выполняющий задачи

---

## Как работает

**Создание Job:**

```bash
php artisan make:job SendWelcomeEmail
```

```php
namespace App\Jobs;

use App\Models\User;
use App\Notifications\WelcomeNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWelcomeEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Количество попыток
    public $tries = 3;

    // Timeout (секунды)
    public $timeout = 60;

    // Очередь
    public $queue = 'emails';

    public function __construct(public User $user)
    {
    }

    public function handle(): void
    {
        // Отправить email
        $this->user->notify(new WelcomeNotification());
    }

    // Обработка ошибок
    public function failed(\Throwable $exception): void
    {
        Log::error('Failed to send welcome email', [
            'user_id' => $this->user->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

**Dispatch (вызов) Job:**

```php
use App\Jobs\SendWelcomeEmail;

// Отправить в очередь
SendWelcomeEmail::dispatch($user);

// Dispatch с задержкой
SendWelcomeEmail::dispatch($user)->delay(now()->addMinutes(10));

// Dispatch на конкретную очередь
SendWelcomeEmail::dispatch($user)->onQueue('emails');

// Dispatch синхронно (без очереди)
SendWelcomeEmail::dispatchSync($user);

// Dispatch после DB commit
SendWelcomeEmail::dispatch($user)->afterCommit();

// Dispatch если условие истинно
SendWelcomeEmail::dispatchIf($user->isActive(), $user);
SendWelcomeEmail::dispatchUnless($user->isBanned(), $user);
```

**Настройка очередей (.env):**

```env
# database/migrations/xxxx_create_jobs_table.php
php artisan queue:table
php artisan migrate

QUEUE_CONNECTION=database

# Или Redis
QUEUE_CONNECTION=redis

# Или Sync (без очереди, синхронно)
QUEUE_CONNECTION=sync
```

**Запуск Worker:**

```bash
# Запустить worker (обрабатывает задачи)
php artisan queue:work

# С конкретной очередью
php artisan queue:work --queue=emails,default

# С timeout
php artisan queue:work --timeout=60

# Перезапуск при изменении кода
php artisan queue:work --timeout=60 --tries=3

# Остановить worker после текущей задачи
php artisan queue:restart

# Одна задача (для cron)
php artisan queue:work --once
```

---

## Когда использовать

**Используй Jobs когда:**
- Долгие операции (отправка email, обработка файлов)
- Не блокировать HTTP response
- Ресурсоёмкие задачи
- Интеграция с внешними API

**Не используй когда:**
- Простые быстрые операции
- Нужен немедленный результат

---

## Пример из практики

**Обработка загруженного файла:**

```php
// Job
namespace App\Jobs;

use App\Models\Upload;
use Illuminate\Support\Facades\Storage;

class ProcessUploadedFile implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 300;  // 5 минут

    public function __construct(public Upload $upload)
    {
    }

    public function handle(): void
    {
        // Получить файл из storage
        $filePath = $this->upload->file_path;
        $content = Storage::get($filePath);

        // Обработать файл
        $processedData = $this->process($content);

        // Сохранить результат
        Storage::put(
            str_replace('.csv', '_processed.csv', $filePath),
            $processedData
        );

        // Обновить статус
        $this->upload->update([
            'status' => 'completed',
            'processed_at' => now(),
        ]);
    }

    private function process(string $content): string
    {
        // Логика обработки
        return $content;
    }

    public function failed(\Throwable $exception): void
    {
        $this->upload->update([
            'status' => 'failed',
            'error' => $exception->getMessage(),
        ]);
    }
}

// Controller
class UploadController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv|max:10240',
        ]);

        // Сохранить файл
        $path = $request->file('file')->store('uploads');

        // Создать запись
        $upload = Upload::create([
            'user_id' => $request->user()->id,
            'file_path' => $path,
            'status' => 'pending',
        ]);

        // Отправить в очередь
        ProcessUploadedFile::dispatch($upload);

        return response()->json([
            'message' => 'File uploaded, processing started',
            'upload_id' => $upload->id,
        ], 202);
    }
}
```

**Job Chains (цепочка задач):**

```php
use Illuminate\Support\Facades\Bus;

Bus::chain([
    new ProcessUploadedFile($upload),
    new GenerateReport($upload),
    new SendReportEmail($upload),
])->dispatch();

// С обработкой ошибок
Bus::chain([
    new ProcessUploadedFile($upload),
    new GenerateReport($upload),
])->catch(function (\Throwable $e) {
    // Вызовется если любая задача провалилась
    Log::error('Job chain failed', ['error' => $e->getMessage()]);
})->dispatch();
```

**Job Batches (пакеты задач):**

```php
use Illuminate\Support\Facades\Bus;

// Создать batch
$batch = Bus::batch([
    new ProcessUser($user1),
    new ProcessUser($user2),
    new ProcessUser($user3),
])->then(function () {
    // Все задачи выполнены
    Log::info('All users processed');
})->catch(function () {
    // Одна из задач провалилась
})->finally(function () {
    // Всегда выполнится
})->dispatch();

// Проверить статус batch
$batch = Bus::findBatch($batchId);
$batch->finished();  // Все завершены
$batch->cancelled();  // Отменён
$batch->totalJobs;  // Всего задач
$batch->processedJobs();  // Обработано
$batch->pendingJobs;  // Осталось
```

**Rate Limiting (ограничение частоты):**

```php
use Illuminate\Support\Facades\RateLimiter;

class ProcessApiRequest implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // Выполнить не более 10 задач в минуту
        RateLimiter::attempt(
            'api-requests',
            $perMinute = 10,
            function () {
                // Логика запроса
                Http::get('https://api.example.com');
            }
        );
    }

    // Или через middleware
    public function middleware(): array
    {
        return [new RateLimited('api-requests')];
    }
}
```

**Unique Jobs (предотвратить дубли):**

```php
use Illuminate\Contracts\Queue\ShouldBeUnique;

class ProcessOrder implements ShouldQueue, ShouldBeUnique
{
    public function __construct(public Order $order)
    {
    }

    // Уникальный ключ (одна задача на order)
    public function uniqueId(): string
    {
        return $this->order->id;
    }

    // Время уникальности (секунды)
    public $uniqueFor = 3600;  // 1 час

    public function handle(): void
    {
        // Обработка заказа
    }
}
```

**Job Middleware:**

```php
namespace App\Jobs\Middleware;

class RateLimited
{
    public function handle($job, $next)
    {
        RateLimiter::attempt(
            'process-orders',
            $perMinute = 10,
            function () use ($job, $next) {
                $next($job);
            },
            $decaySeconds = 60
        );
    }
}

// Использование в Job
public function middleware(): array
{
    return [new RateLimited()];
}
```

**Failed Jobs (обработка провалившихся):**

```bash
# Создать таблицу для failed jobs
php artisan queue:failed-table
php artisan migrate

# Посмотреть провалившиеся задачи
php artisan queue:failed

# Повторить задачу
php artisan queue:retry {id}

# Повторить все
php artisan queue:retry all

# Удалить провалившуюся задачу
php artisan queue:forget {id}

# Очистить все провалившиеся
php artisan queue:flush
```

**Мониторинг очередей:**

```php
// В AppServiceProvider
use Illuminate\Support\Facades\Queue;

public function boot(): void
{
    Queue::before(function (JobProcessing $event) {
        // Перед выполнением задачи
        Log::info('Job starting', [
            'job' => $event->job->resolveName(),
        ]);
    });

    Queue::after(function (JobProcessed $event) {
        // После выполнения задачи
        Log::info('Job completed', [
            'job' => $event->job->resolveName(),
        ]);
    });

    Queue::failing(function (JobFailed $event) {
        // Задача провалилась
        Log::error('Job failed', [
            'job' => $event->job->resolveName(),
            'exception' => $event->exception->getMessage(),
        ]);
    });
}
```

**Supervisor (для production):**

```ini
; /etc/supervisor/conf.d/laravel-worker.conf
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=8
redirect_stderr=true
stdout_logfile=/path/to/worker.log
stopwaitsecs=3600
```

```bash
# Перезапустить supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start laravel-worker:*
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Jobs — задачи в фоне (SendEmail, ProcessFile)
- Реализуют `ShouldQueue` для асинхронного выполнения
- Worker обрабатывает задачи через `queue:work`

**Dispatch:**
```php
JobName::dispatch($data);              // В очередь
JobName::dispatch($data)->delay(10);   // С задержкой
JobName::dispatchSync($data);          // Синхронно
```

**Настройка:**
- Drivers: `database`, `redis`, `sync`
- `tries` — количество попыток
- `timeout` — максимальное время выполнения
- `queue` — имя очереди

**Продвинутое:**
- **Job Chains** — последовательное выполнение: `Bus::chain([Job1, Job2])`
- **Job Batches** — параллельные задачи: `Bus::batch([...])`
- **ShouldBeUnique** — предотвращение дублей
- **Rate Limiting** — ограничение частоты
- **Supervisor** — для production
- **Failed Jobs** — `queue:failed`, `queue:retry`

---

## Практические задания

### Задание 1: Job с повторами и timeout

Создай `ProcessVideoJob` который обрабатывает видео. Должно быть 3 попытки, timeout 5 минут, очередь `videos`. При ошибке сохрани лог в базу.

<details>
<summary>Решение</summary>

```php
namespace App\Jobs;

use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 300; // 5 минут
    public $queue = 'videos';

    public function __construct(public Video $video)
    {
    }

    public function handle(): void
    {
        $this->video->update(['status' => 'processing']);

        // Обработка видео (например, конвертация)
        $inputPath = Storage::path($this->video->original_path);
        $outputPath = Storage::path($this->video->processed_path);

        // Здесь логика обработки видео
        // exec("ffmpeg -i {$inputPath} {$outputPath}");

        $this->video->update([
            'status' => 'completed',
            'processed_at' => now(),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        $this->video->update([
            'status' => 'failed',
            'error_message' => $exception->getMessage(),
        ]);

        Log::error('Video processing failed', [
            'video_id' => $this->video->id,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }
}

// Использование
ProcessVideoJob::dispatch($video);
```
</details>

### Задание 2: Job Chain для загрузки файла

Создай цепочку: `DownloadFileJob` → `ProcessFileJob` → `NotifyUserJob`. При ошибке в любом шаге отправь email админу.

<details>
<summary>Решение</summary>

```php
namespace App\Jobs;

use App\Models\Import;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

// Job 1: Скачать файл
class DownloadFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Import $import, public string $url)
    {
    }

    public function handle(): void
    {
        $content = Http::get($this->url)->body();
        Storage::put($this->import->file_path, $content);

        $this->import->update(['status' => 'downloaded']);
    }
}

// Job 2: Обработать файл
class ProcessFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Import $import)
    {
    }

    public function handle(): void
    {
        $content = Storage::get($this->import->file_path);
        $rows = array_map('str_getcsv', explode("\n", $content));

        // Обработка строк
        foreach ($rows as $row) {
            // Логика импорта
        }

        $this->import->update([
            'status' => 'processed',
            'rows_count' => count($rows),
        ]);
    }
}

// Job 3: Уведомить пользователя
class NotifyUserJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Import $import)
    {
    }

    public function handle(): void
    {
        $this->import->user->notify(
            new ImportCompletedNotification($this->import)
        );
    }
}

// Запуск цепочки
Bus::chain([
    new DownloadFileJob($import, $url),
    new ProcessFileJob($import),
    new NotifyUserJob($import),
])->catch(function (\Throwable $e) use ($import) {
    Log::error('Import chain failed', [
        'import_id' => $import->id,
        'error' => $e->getMessage(),
    ]);

    Mail::to(config('app.admin_email'))->send(
        new ImportFailedMail($import, $e)
    );
})->dispatch();
```
</details>

### Задание 3: Unique Job для экспорта

Создай `ExportUsersJob` который можно запустить только 1 раз в час для каждого пользователя. Если задача уже в очереди, не добавляй новую.

<details>
<summary>Решение</summary>

```php
namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ExportUsersJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 минут
    public $tries = 2;

    // Уникальность на 1 час
    public $uniqueFor = 3600;

    public function __construct(public User $requestedBy)
    {
    }

    // Уникальный ключ (один экспорт на пользователя)
    public function uniqueId(): string
    {
        return "export-users-{$this->requestedBy->id}";
    }

    public function handle(): void
    {
        $users = User::with('profile')->get();

        $csv = "ID,Name,Email,Created At\n";
        foreach ($users as $user) {
            $csv .= "{$user->id},{$user->name},{$user->email},{$user->created_at}\n";
        }

        $filename = "exports/users-" . now()->format('Y-m-d-His') . ".csv";
        Storage::put($filename, $csv);

        $this->requestedBy->notify(
            new ExportReadyNotification($filename)
        );
    }
}

// В контроллере
public function export(Request $request)
{
    // Попытка добавить в очередь
    ExportUsersJob::dispatch($request->user());

    return response()->json([
        'message' => 'Export started. You will be notified when ready.',
    ], 202);
}

// Если задача уже в очереди, она не добавится повторно
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
