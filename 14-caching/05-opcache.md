# 14.5 OPcache

## Краткое резюме

> **OPcache** — PHP bytecode cache, кэширует скомпилированный PHP код. 2-3x performance boost.
>
> **Production:** `validate_timestamps=0` (не проверять изменения файлов), очищать после deploy (`php artisan opcache:clear`). **Development:** `validate_timestamps=1`, `revalidate_freq=0` (видеть изменения сразу).
>
> **Preloading** (PHP 7.4+): загружать файлы в память при старте PHP-FPM. Monitoring: **hit rate > 99%**, достаточно memory (256-512MB). Laravel: `appstract/laravel-opcache` package.

---

## Содержание

- [Что это](#что-это)
- [Установка и конфигурация](#установка-и-конфигурация)
- [Production Settings](#production-settings)
- [Development Settings](#development-settings)
- [Очистка OPcache](#очистка-opcache)
- [Preloading](#preloading-php-74)
- [Мониторинг OPcache](#мониторинг-opcache)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**OPcache:**
PHP bytecode cache. Кэширует скомпилированный PHP код (bytecode), чтобы не компилировать на каждом запросе.

**Зачем:**
- Гораздо быстрее (не нужно парсить и компилировать PHP файлы)
- Меньше CPU usage
- 2-3x performance boost

**Как работает:**

```
Без OPcache:
Request → PHP парсит файл → компилирует → выполняет → Response

С OPcache:
Request → OPcache (bytecode cache) → выполняет → Response
          ↑ если нет в cache
          PHP парсит → компилирует → сохраняет в cache
```

---

## Установка и конфигурация

**Проверить установлен ли:**

```bash
php -v
# Должно быть: with Zend OPcache

php -m | grep opcache
# opcache
```

**php.ini:**

```ini
[opcache]
; Включить OPcache
opcache.enable=1

; Включить для CLI (optional)
opcache.enable_cli=0

; Memory (MB)
opcache.memory_consumption=128

; Interned strings buffer (MB)
opcache.interned_strings_buffer=8

; Max accelerated files
opcache.max_accelerated_files=10000

; Revalidate frequency (seconds)
opcache.revalidate_freq=2

; Validate timestamps (проверять изменения файлов)
opcache.validate_timestamps=1

; Fast shutdown
opcache.fast_shutdown=1
```

---

## Production Settings

**php.ini (production):**

```ini
[opcache]
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000

; ВАЖНО: отключить revalidate для максимальной производительности
opcache.validate_timestamps=0  # не проверять изменения файлов
opcache.revalidate_freq=0

opcache.fast_shutdown=1
opcache.enable_file_override=1
```

**После deploy:**

```bash
# Очистить OPcache
php artisan opcache:clear  # Laravel

# Или через nginx/apache
curl http://example.com/opcache-clear.php
```

---

## Development Settings

**php.ini (development):**

```ini
[opcache]
opcache.enable=1
opcache.validate_timestamps=1  # проверять изменения
opcache.revalidate_freq=0       # проверять каждый раз
```

**Почему:**
- Изменения в коде видны сразу (не нужно перезагружать PHP-FPM)

---

## Laravel OPcache Package

**Composer:**

```bash
composer require appstract/laravel-opcache
```

**Routes:**

```php
// Автоматически регистрируются
// /opcache/clear
// /opcache/config
// /opcache/status
```

**Artisan:**

```bash
# Clear OPcache
php artisan opcache:clear

# Status
php artisan opcache:status

# Config
php artisan opcache:config

# Optimize (preload)
php artisan opcache:optimize
```

---

## Очистка OPcache

### 1. CLI

```bash
php artisan opcache:clear
```

---

### 2. HTTP Endpoint

**routes/web.php:**

```php
Route::get('/opcache/clear', function () {
    if (function_exists('opcache_reset')) {
        opcache_reset();
        return 'OPcache cleared';
    }
    return 'OPcache not available';
})->middleware('auth');  // Защитить!
```

---

### 3. Deployment

**Deploy script:**

```bash
#!/bin/bash

# Pull code
git pull

# Install dependencies
composer install --no-dev --optimize-autoloader

# Clear caches
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Clear OPcache
php artisan opcache:clear

# Reload PHP-FPM
sudo systemctl reload php8.2-fpm
```

---

## Preloading (PHP 7.4+)

**Что это:**
Загрузить PHP файлы в память при старте PHP-FPM.

**php.ini:**

```ini
opcache.preload=/var/www/html/preload.php
opcache.preload_user=www-data
```

**preload.php:**

```php
<?php

// Laravel preload script
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Preload Laravel core
opcache_compile_file(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Foundation/Application.php');
opcache_compile_file(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Http/Request.php');
// ... другие часто используемые файлы
```

**Laravel Automatic Preload:**

```bash
# Generate preload file
php artisan opcache:optimize

# Создаст bootstrap/cache/opcache.php
```

---

## Мониторинг OPcache

**PHP Code:**

```php
$status = opcache_get_status();

echo "Memory Used: " . $status['memory_usage']['used_memory'] / 1024 / 1024 . " MB\n";
echo "Memory Free: " . $status['memory_usage']['free_memory'] / 1024 / 1024 . " MB\n";
echo "Hit Rate: " . ($status['opcache_statistics']['opcache_hit_rate']) . "%\n";
echo "Cached Scripts: " . $status['opcache_statistics']['num_cached_scripts'] . "\n";
echo "Max Cached Scripts: " . $status['opcache_statistics']['max_cached_scripts'] . "\n";
```

**Artisan:**

```bash
php artisan opcache:status
```

---

## Metrics

**Важные метрики:**

### 1. Hit Rate

```
opcache_hit_rate = (hits / (hits + misses)) * 100

> 99% — отлично
< 95% — нужно больше памяти или max_accelerated_files
```

---

### 2. Memory Usage

```
Если used_memory близко к memory_consumption:
→ увеличить opcache.memory_consumption
```

---

### 3. Cached Scripts

```
Если num_cached_scripts близко к max_accelerated_files:
→ увеличить opcache.max_accelerated_files
```

---

## Проблемы и решения

### 1. Stale Code After Deploy

**Проблема:**
После deploy старый код в OPcache.

**Решение:**

```bash
# Очистить OPcache
php artisan opcache:clear

# Или перезагрузить PHP-FPM
sudo systemctl reload php8.2-fpm
```

---

### 2. Out of Memory

**Проблема:**
OPcache закончилась память.

**Решение:**

```ini
; Увеличить memory
opcache.memory_consumption=512  # было 256
```

---

### 3. Too Many Files

**Проблема:**
`max_accelerated_files` достигнут.

**Решение:**

```ini
opcache.max_accelerated_files=30000  # было 10000
```

---

## Best Practices

```
✓ Production: validate_timestamps=0 (максимальная производительность)
✓ Development: validate_timestamps=1, revalidate_freq=0
✓ Достаточно memory (256-512 MB)
✓ max_accelerated_files > количество PHP файлов
✓ Очищать OPcache после deploy
✓ Preloading для часто используемых файлов (PHP 7.4+)
✓ Мониторинг hit rate (> 99%)
✓ Защитить /opcache/clear endpoint (auth)
```

---

## Comparison с другими caches

| Cache | Что кэширует | Scope |
|-------|--------------|-------|
| OPcache | PHP bytecode | Per PHP-FPM worker |
| APCu | User data (key-value) | Per PHP-FPM worker |
| Redis | Application data | Shared (все workers) |
| Memcached | Application data | Shared (все workers) |

**OPcache — низкоуровневый cache (PHP bytecode).**

**Redis/Memcached — высокоуровневый cache (application data).**

---

## Автоматизация

**Deploy Hook:**

```yaml
# .gitlab-ci.yml
deploy:
  script:
    - git pull
    - composer install --no-dev --optimize-autoloader
    - php artisan config:cache
    - php artisan route:cache
    - php artisan view:cache
    - php artisan opcache:clear  # Очистить OPcache
    - sudo systemctl reload php8.2-fpm
```

---

## На собеседовании скажешь

> "OPcache — PHP bytecode cache, кэширует скомпилированный PHP код. 2-3x performance boost. Production: validate_timestamps=0 (не проверять изменения файлов), очищать после deploy. Development: validate_timestamps=1, revalidate_freq=0 (видеть изменения сразу). Preloading (PHP 7.4+): загружать файлы в память при старте. Monitoring: hit rate > 99%, достаточно memory. Laravel: appstract/laravel-opcache package, php artisan opcache:clear. Best practices: достаточно memory (256-512MB), max_accelerated_files > количество файлов, защитить clear endpoint, автоматизировать clear в deploy."

---

## Практические задания

### Задание 1: OPcache Monitoring Dashboard

Создай сервис для мониторинга OPcache с метриками: hit rate, memory usage, cached scripts. Добавь artisan command для вывода статистики.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

class OPcacheMonitoringService
{
    /**
     * Получить статус OPcache
     */
    public function getStatus(): array
    {
        if (!function_exists('opcache_get_status')) {
            return ['enabled' => false];
        }

        $status = opcache_get_status(false);
        $config = opcache_get_configuration();

        if ($status === false) {
            return ['enabled' => false];
        }

        return [
            'enabled' => true,
            'version' => $config['version']['version'] ?? 'unknown',
            'memory' => $this->getMemoryStats($status),
            'statistics' => $this->getStatistics($status),
            'scripts' => $this->getScriptsStats($status),
            'config' => $this->getImportantConfig($config),
        ];
    }

    private function getMemoryStats(array $status): array
    {
        $memory = $status['memory_usage'];

        $total = $memory['used_memory'] + $memory['free_memory'];
        $usagePercent = $total > 0 ? round(($memory['used_memory'] / $total) * 100, 2) : 0;

        return [
            'used_mb' => round($memory['used_memory'] / 1024 / 1024, 2),
            'free_mb' => round($memory['free_memory'] / 1024 / 1024, 2),
            'wasted_mb' => round($memory['wasted_memory'] / 1024 / 1024, 2),
            'total_mb' => round($total / 1024 / 1024, 2),
            'usage_percent' => $usagePercent,
            'wasted_percent' => $total > 0
                ? round(($memory['wasted_memory'] / $total) * 100, 2)
                : 0,
        ];
    }

    private function getStatistics(array $status): array
    {
        $stats = $status['opcache_statistics'];

        $total = $stats['hits'] + $stats['misses'];
        $hitRate = $total > 0 ? round(($stats['hits'] / $total) * 100, 2) : 0;

        return [
            'hits' => $stats['hits'],
            'misses' => $stats['misses'],
            'hit_rate' => $hitRate,
            'blacklist_misses' => $stats['blacklist_misses'] ?? 0,
            'num_cached_scripts' => $stats['num_cached_scripts'],
            'max_cached_scripts' => $stats['max_cached_scripts'],
            'scripts_usage_percent' => $stats['max_cached_scripts'] > 0
                ? round(($stats['num_cached_scripts'] / $stats['max_cached_scripts']) * 100, 2)
                : 0,
            'oom_restarts' => $stats['oom_restarts'] ?? 0,
            'hash_restarts' => $stats['hash_restarts'] ?? 0,
            'manual_restarts' => $stats['manual_restarts'] ?? 0,
        ];
    }

    private function getScriptsStats(array $status): array
    {
        $scripts = $status['scripts'] ?? [];

        return [
            'count' => count($scripts),
            'total_size_mb' => round(
                array_sum(array_column($scripts, 'memory_consumption')) / 1024 / 1024,
                2
            ),
        ];
    }

    private function getImportantConfig(array $config): array
    {
        $directives = $config['directives'];

        return [
            'memory_consumption' => $directives['opcache.memory_consumption'] ?? 0,
            'interned_strings_buffer' => $directives['opcache.interned_strings_buffer'] ?? 0,
            'max_accelerated_files' => $directives['opcache.max_accelerated_files'] ?? 0,
            'validate_timestamps' => (bool)($directives['opcache.validate_timestamps'] ?? false),
            'revalidate_freq' => $directives['opcache.revalidate_freq'] ?? 0,
            'preload' => $directives['opcache.preload'] ?? '',
        ];
    }

    /**
     * Проверить здоровье OPcache
     */
    public function healthCheck(): array
    {
        $status = $this->getStatus();

        if (!$status['enabled']) {
            return [
                'healthy' => false,
                'issues' => ['OPcache is not enabled'],
            ];
        }

        $issues = [];

        // Проверить hit rate
        if ($status['statistics']['hit_rate'] < 95) {
            $issues[] = "Low hit rate: {$status['statistics']['hit_rate']}% (should be > 95%)";
        }

        // Проверить memory usage
        if ($status['memory']['usage_percent'] > 90) {
            $issues[] = "High memory usage: {$status['memory']['usage_percent']}% (should be < 90%)";
        }

        // Проверить scripts usage
        if ($status['statistics']['scripts_usage_percent'] > 90) {
            $issues[] = "High scripts usage: {$status['statistics']['scripts_usage_percent']}% (should be < 90%)";
        }

        // Проверить restarts
        if ($status['statistics']['oom_restarts'] > 0) {
            $issues[] = "OOM restarts detected: {$status['statistics']['oom_restarts']}";
        }

        return [
            'healthy' => empty($issues),
            'issues' => $issues,
        ];
    }
}

// Artisan Command
namespace App\Console\Commands;

use App\Services\OPcacheMonitoringService;
use Illuminate\Console\Command;

class OPcacheStatusCommand extends Command
{
    protected $signature = 'opcache:status {--health : Show health check only}';
    protected $description = 'Show OPcache status and statistics';

    public function handle(OPcacheMonitoringService $service)
    {
        if ($this->option('health')) {
            $health = $service->healthCheck();

            if ($health['healthy']) {
                $this->info('OPcache is healthy');
            } else {
                $this->error('OPcache has issues:');
                foreach ($health['issues'] as $issue) {
                    $this->line("  - {$issue}");
                }
            }

            return $health['healthy'] ? 0 : 1;
        }

        $status = $service->getStatus();

        if (!$status['enabled']) {
            $this->error('OPcache is not enabled');
            return 1;
        }

        $this->info('OPcache Status:');
        $this->newLine();

        // Memory
        $this->line('<fg=yellow>Memory Usage:</>');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Used', "{$status['memory']['used_mb']} MB"],
                ['Free', "{$status['memory']['free_mb']} MB"],
                ['Wasted', "{$status['memory']['wasted_mb']} MB"],
                ['Total', "{$status['memory']['total_mb']} MB"],
                ['Usage', "{$status['memory']['usage_percent']}%"],
            ]
        );

        // Statistics
        $this->line('<fg=yellow>Statistics:</>');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Hits', number_format($status['statistics']['hits'])],
                ['Misses', number_format($status['statistics']['misses'])],
                ['Hit Rate', "{$status['statistics']['hit_rate']}%"],
                ['Cached Scripts', "{$status['statistics']['num_cached_scripts']} / {$status['statistics']['max_cached_scripts']}"],
                ['Scripts Usage', "{$status['statistics']['scripts_usage_percent']}%"],
            ]
        );

        // Restarts
        if ($status['statistics']['oom_restarts'] > 0 || $status['statistics']['manual_restarts'] > 0) {
            $this->line('<fg=red>Restarts:</>');
            $this->table(
                ['Type', 'Count'],
                [
                    ['OOM', $status['statistics']['oom_restarts']],
                    ['Manual', $status['statistics']['manual_restarts']],
                    ['Hash', $status['statistics']['hash_restarts']],
                ]
            );
        }

        // Health check
        $health = $service->healthCheck();
        $this->newLine();

        if ($health['healthy']) {
            $this->info('✓ OPcache is healthy');
        } else {
            $this->error('✗ OPcache has issues:');
            foreach ($health['issues'] as $issue) {
                $this->line("  - {$issue}");
            }
        }

        return 0;
    }
}

// Controller для dashboard
namespace App\Http\Controllers;

use App\Services\OPcacheMonitoringService;

class OPcacheController extends Controller
{
    public function __construct(
        private OPcacheMonitoringService $service
    ) {
        $this->middleware('auth');
    }

    public function status()
    {
        return response()->json([
            'status' => $this->service->getStatus(),
            'health' => $this->service->healthCheck(),
        ]);
    }

    public function clear()
    {
        if (function_exists('opcache_reset')) {
            opcache_reset();
            return response()->json(['message' => 'OPcache cleared']);
        }

        return response()->json(['message' => 'OPcache not available'], 400);
    }
}
```
</details>

### Задание 2: Smart OPcache Preloading Generator

Создай сервис который автоматически генерирует preload.php файл на основе часто используемых классов.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\File;

class OPcachePreloadGenerator
{
    private array $classes = [];
    private string $basePath;

    public function __construct()
    {
        $this->basePath = base_path();
    }

    /**
     * Добавить класс для preload
     */
    public function addClass(string $class): self
    {
        $this->classes[] = $class;
        return $this;
    }

    /**
     * Добавить все классы из директории
     */
    public function addDirectory(string $directory): self
    {
        $files = File::allFiles($directory);

        foreach ($files as $file) {
            if ($file->getExtension() === 'php') {
                $this->addFileToPreload($file->getPathname());
            }
        }

        return $this;
    }

    /**
     * Добавить Laravel core классы
     */
    public function addLaravelCore(): self
    {
        $coreClasses = [
            \Illuminate\Foundation\Application::class,
            \Illuminate\Http\Request::class,
            \Illuminate\Http\Response::class,
            \Illuminate\Routing\Router::class,
            \Illuminate\Support\Facades\Facade::class,
            \Illuminate\Database\Eloquent\Model::class,
            \Illuminate\Database\Eloquent\Builder::class,
            \Illuminate\Support\Collection::class,
        ];

        foreach ($coreClasses as $class) {
            $this->addClass($class);
        }

        return $this;
    }

    /**
     * Добавить модели приложения
     */
    public function addModels(): self
    {
        return $this->addDirectory(app_path('Models'));
    }

    /**
     * Добавить контроллеры
     */
    public function addControllers(): self
    {
        return $this->addDirectory(app_path('Http/Controllers'));
    }

    /**
     * Добавить middleware
     */
    public function addMiddleware(): self
    {
        return $this->addDirectory(app_path('Http/Middleware'));
    }

    /**
     * Сгенерировать preload.php файл
     */
    public function generate(string $outputPath = null): string
    {
        $outputPath = $outputPath ?? $this->basePath . '/bootstrap/cache/preload.php';

        $content = $this->generateContent();

        File::put($outputPath, $content);

        return $outputPath;
    }

    private function generateContent(): string
    {
        $files = $this->resolveFiles();

        $content = "<?php\n\n";
        $content .= "// Auto-generated OPcache preload file\n";
        $content .= "// Generated at: " . date('Y-m-d H:i:s') . "\n\n";

        $content .= "// Load Composer autoloader\n";
        $content .= "require __DIR__ . '/../../vendor/autoload.php';\n\n";

        $content .= "// Preload files\n";
        foreach ($files as $file) {
            $content .= "opcache_compile_file('{$file}');\n";
        }

        $content .= "\n// Total files preloaded: " . count($files) . "\n";

        return $content;
    }

    private function resolveFiles(): array
    {
        $files = [];

        foreach ($this->classes as $class) {
            try {
                $reflection = new \ReflectionClass($class);
                $file = $reflection->getFileName();

                if ($file && file_exists($file)) {
                    $files[] = $file;
                }
            } catch (\ReflectionException $e) {
                // Класс не найден
                continue;
            }
        }

        return array_unique($files);
    }

    private function addFileToPreload(string $filepath): void
    {
        // Попытаться определить класс из файла
        $content = file_get_contents($filepath);

        // Простой regex для namespace и class
        if (preg_match('/namespace\s+([^;]+);/', $content, $namespaceMatch)) {
            $namespace = $namespaceMatch[1];

            if (preg_match('/class\s+(\w+)/', $content, $classMatch)) {
                $className = $namespace . '\\' . $classMatch[1];
                $this->addClass($className);
            }
        }
    }
}

// Artisan Command
namespace App\Console\Commands;

use App\Services\OPcachePreloadGenerator;
use Illuminate\Console\Command;

class GenerateOPcachePreloadCommand extends Command
{
    protected $signature = 'opcache:generate-preload
                            {--core : Include Laravel core}
                            {--models : Include models}
                            {--controllers : Include controllers}
                            {--middleware : Include middleware}
                            {--all : Include everything}';

    protected $description = 'Generate OPcache preload file';

    public function handle(OPcachePreloadGenerator $generator)
    {
        $this->info('Generating OPcache preload file...');

        if ($this->option('all')) {
            $generator->addLaravelCore()
                ->addModels()
                ->addControllers()
                ->addMiddleware();
        } else {
            if ($this->option('core')) {
                $generator->addLaravelCore();
                $this->line('✓ Added Laravel core classes');
            }

            if ($this->option('models')) {
                $generator->addModels();
                $this->line('✓ Added models');
            }

            if ($this->option('controllers')) {
                $generator->addControllers();
                $this->line('✓ Added controllers');
            }

            if ($this->option('middleware')) {
                $generator->addMiddleware();
                $this->line('✓ Added middleware');
            }
        }

        $outputPath = $generator->generate();

        $this->info("Preload file generated: {$outputPath}");
        $this->newLine();
        $this->line('Add to php.ini:');
        $this->line("opcache.preload={$outputPath}");
        $this->line('opcache.preload_user=www-data');

        return 0;
    }
}

// Service Provider для регистрации
namespace App\Providers;

use App\Services\OPcachePreloadGenerator;
use Illuminate\Support\ServiceProvider;

class OPcacheServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(OPcachePreloadGenerator::class);
    }

    public function boot()
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Console\Commands\GenerateOPcachePreloadCommand::class,
            ]);
        }
    }
}
```
</details>

### Задание 3: Automated Deploy with OPcache Management

Создай deploy script который автоматически управляет OPcache: warm up после deploy, monitoring, rollback при проблемах.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DeployOPcacheManager
{
    private string $appUrl;
    private array $servers;

    public function __construct()
    {
        $this->appUrl = config('app.url');
        $this->servers = config('deploy.servers', []);
    }

    /**
     * Pre-deploy: сохранить метрики
     */
    public function preDeploy(): array
    {
        $this->log('Starting pre-deploy OPcache check...');

        $metrics = [];

        foreach ($this->servers as $server) {
            $status = $this->getServerOPcacheStatus($server);
            $metrics[$server] = $status;

            $this->log("Server {$server}: Hit Rate = {$status['hit_rate']}%");
        }

        // Сохранить метрики для сравнения
        cache()->put('deploy:opcache:pre_metrics', $metrics, 3600);

        return $metrics;
    }

    /**
     * Post-deploy: clear OPcache на всех серверах
     */
    public function postDeploy(): bool
    {
        $this->log('Clearing OPcache on all servers...');

        $results = [];

        foreach ($this->servers as $server) {
            $success = $this->clearServerOPcache($server);
            $results[$server] = $success;

            if ($success) {
                $this->log("✓ OPcache cleared on {$server}");
            } else {
                $this->log("✗ Failed to clear OPcache on {$server}", 'error');
            }
        }

        return !in_array(false, $results, true);
    }

    /**
     * Warm up: прогреть cache после deploy
     */
    public function warmUp(): bool
    {
        $this->log('Warming up OPcache...');

        $urls = $this->getWarmUpUrls();

        foreach ($urls as $url) {
            try {
                Http::timeout(10)->get($url);
                $this->log("✓ Warmed up: {$url}");
            } catch (\Exception $e) {
                $this->log("✗ Failed to warm up {$url}: {$e->getMessage()}", 'error');
            }

            usleep(100000); // 100ms delay between requests
        }

        return true;
    }

    /**
     * Verify: проверить что deploy прошел успешно
     */
    public function verify(): array
    {
        $this->log('Verifying OPcache after deploy...');

        sleep(5); // Подождать немного для накопления метрик

        $issues = [];

        foreach ($this->servers as $server) {
            $status = $this->getServerOPcacheStatus($server);

            // Проверить hit rate
            if ($status['hit_rate'] < 80) {
                $issues[] = "Low hit rate on {$server}: {$status['hit_rate']}%";
            }

            // Проверить memory
            if ($status['memory_usage'] > 95) {
                $issues[] = "High memory usage on {$server}: {$status['memory_usage']}%";
            }

            // Проверить restarts
            if ($status['oom_restarts'] > 0) {
                $issues[] = "OOM restarts detected on {$server}";
            }
        }

        if (empty($issues)) {
            $this->log('✓ OPcache verification passed');
        } else {
            foreach ($issues as $issue) {
                $this->log("✗ {$issue}", 'error');
            }
        }

        return [
            'success' => empty($issues),
            'issues' => $issues,
        ];
    }

    /**
     * Rollback: восстановить предыдущее состояние
     */
    public function rollback(): bool
    {
        $this->log('Rolling back OPcache...');

        // Очистить cache для перезагрузки старого кода
        return $this->postDeploy();
    }

    private function getServerOPcacheStatus(string $server): array
    {
        try {
            $response = Http::timeout(5)
                ->get("{$server}/api/opcache/status");

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'hit_rate' => $data['statistics']['hit_rate'] ?? 0,
                    'memory_usage' => $data['memory']['usage_percent'] ?? 0,
                    'oom_restarts' => $data['statistics']['oom_restarts'] ?? 0,
                ];
            }
        } catch (\Exception $e) {
            $this->log("Failed to get OPcache status from {$server}: {$e->getMessage()}", 'error');
        }

        return [
            'hit_rate' => 0,
            'memory_usage' => 0,
            'oom_restarts' => 0,
        ];
    }

    private function clearServerOPcache(string $server): bool
    {
        try {
            $response = Http::timeout(5)
                ->post("{$server}/api/opcache/clear");

            return $response->successful();
        } catch (\Exception $e) {
            $this->log("Failed to clear OPcache on {$server}: {$e->getMessage()}", 'error');
            return false;
        }
    }

    private function getWarmUpUrls(): array
    {
        return [
            $this->appUrl . '/',
            $this->appUrl . '/api/health',
            $this->appUrl . '/blog',
            // Добавить другие важные URLs
        ];
    }

    private function log(string $message, string $level = 'info'): void
    {
        Log::channel('deploy')->{$level}("[OPcache Deploy] {$message}");
    }
}

// Artisan Command для deploy
namespace App\Console\Commands;

use App\Services\DeployOPcacheManager;
use Illuminate\Console\Command;

class DeployCommand extends Command
{
    protected $signature = 'deploy {--skip-opcache : Skip OPcache management}';
    protected $description = 'Deploy application with OPcache management';

    public function handle(DeployOPcacheManager $opcacheManager)
    {
        $this->info('Starting deployment...');

        // Pre-deploy checks
        if (!$this->option('skip-opcache')) {
            $this->info('Running pre-deploy OPcache checks...');
            $opcacheManager->preDeploy();
        }

        // Deploy code (git pull, composer install, etc.)
        $this->info('Deploying code...');
        $this->call('down');

        exec('git pull origin main');
        exec('composer install --no-dev --optimize-autoloader');

        $this->call('migrate', ['--force' => true]);
        $this->call('config:cache');
        $this->call('route:cache');
        $this->call('view:cache');

        // Post-deploy OPcache management
        if (!$this->option('skip-opcache')) {
            $this->info('Clearing OPcache...');
            if (!$opcacheManager->postDeploy()) {
                $this->error('Failed to clear OPcache on some servers');

                if ($this->confirm('Rollback?', true)) {
                    $this->call('deploy:rollback');
                    return 1;
                }
            }

            $this->info('Warming up OPcache...');
            $opcacheManager->warmUp();

            $this->info('Verifying deployment...');
            $result = $opcacheManager->verify();

            if (!$result['success']) {
                $this->error('Deployment verification failed:');
                foreach ($result['issues'] as $issue) {
                    $this->line("  - {$issue}");
                }

                if ($this->confirm('Rollback?', true)) {
                    $this->call('deploy:rollback');
                    return 1;
                }
            }
        }

        $this->call('up');
        $this->info('Deployment completed successfully!');

        return 0;
    }
}

// Bash deploy script
/*
#!/bin/bash

# deploy.sh

set -e

echo "Starting deployment..."

# Pre-deploy
php artisan deploy:pre-check

# Pull code
git pull origin main

# Install dependencies
composer install --no-dev --optimize-autoloader

# Laravel optimizations
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Clear OPcache
php artisan opcache:clear

# Reload PHP-FPM
sudo systemctl reload php8.2-fpm

# Warm up
php artisan cache:warm
php artisan opcache:warm

# Verify
php artisan deploy:verify

echo "Deployment completed!"
*/
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
