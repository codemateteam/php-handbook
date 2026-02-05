# 13.5 PHP Optimization

## Краткое резюме

> **PHP Optimization** — оптимизация PHP кода и настроек для максимальной производительности.
>
> **Основное:** OPcache кеширует bytecode (validate_timestamps=0 для production), PHP-FPM настройки (pm.max_children).
>
> **Методы:** Memory management (chunk/lazy), PHP 8 JIT, profiling (Xdebug, Blackfire), Laravel optimize, typed properties.

---

## Содержание

- [Что это](#что-это)
- [OPcache](#opcache)
- [PHP-FPM настройки](#php-fpm-настройки)
- [Memory Management](#memory-management)
- [PHP 8.x оптимизации](#php-8x-оптимизации)
- [Profiling](#profiling)
- [Оптимизация кода](#оптимизация-кода)
- [Laravel оптимизации](#laravel-оптимизации)
- [Практические примеры](#практические-примеры)
- [Мониторинг производительности](#мониторинг-производительности)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Оптимизация PHP кода и настроек для максимальной производительности.

**Основные направления:**
- OPcache
- PHP-FPM настройки
- Memory management
- Profiling

---

## OPcache

**Что это:**
OPcache кеширует скомпилированный bytecode PHP, избегая парсинга на каждый request.

**Конфигурация (php.ini):**

```ini
[opcache]
opcache.enable=1
opcache.memory_consumption=256        ; MB памяти
opcache.interned_strings_buffer=16   ; Для строк
opcache.max_accelerated_files=10000  ; Количество файлов
opcache.validate_timestamps=0        ; Production: не проверять изменения
opcache.revalidate_freq=0
opcache.fast_shutdown=1

; Development: проверять изменения
opcache.validate_timestamps=1
opcache.revalidate_freq=2
```

**Проверка:**

```php
// Посмотреть статус
<?php
opcache_get_status();

// Очистить OPcache
opcache_reset();
```

**Artisan команда:**

```bash
# Очистить OPcache
php artisan opcache:clear

# Прогреть кеш (запросить все роуты)
php artisan opcache:compile
```

---

## PHP-FPM настройки

**pool конфигурация (/etc/php/8.2/fpm/pool.d/www.conf):**

```ini
[www]
user = www-data
group = www-data

; Process manager
pm = dynamic
pm.max_children = 50          ; Максимум процессов
pm.start_servers = 5          ; При старте
pm.min_spare_servers = 5      ; Минимум idle
pm.max_spare_servers = 10     ; Максимум idle
pm.max_requests = 500         ; Перезапуск после N запросов

; Для высоконагруженных
; pm = static
; pm.max_children = 100

; Таймауты
request_terminate_timeout = 30s
request_slowlog_timeout = 5s
slowlog = /var/log/php-fpm-slow.log
```

**Расчёт pm.max_children:**

```
Доступная память: 8GB
Средняя память на процесс: 50MB
Оставить для системы: 2GB

max_children = (8GB - 2GB) / 50MB = 120
```

**Проверка статуса:**

```php
// Включить status page
// pm.status_path = /status

// http://localhost/status
// pool:                 www
// process manager:      dynamic
// active processes:     5
// idle processes:       10
```

---

## Memory Management

**Memory limit:**

```ini
; php.ini
memory_limit = 256M  ; Для обычных запросов
memory_limit = 512M  ; Для Artisan команд
```

```php
// Увеличить для конкретного скрипта
ini_set('memory_limit', '512M');

// Artisan команда
php -d memory_limit=512M artisan queue:work
```

**Освобождение памяти:**

```php
// ❌ ПЛОХО: держит в памяти
$users = User::all();  // 100k пользователей в памяти
foreach ($users as $user) {
    $this->process($user);
}

// ✅ ХОРОШО: по частям
User::chunk(1000, function ($users) {
    foreach ($users as $user) {
        $this->process($user);
    }
});

// Или cursor
foreach (User::lazy() as $user) {
    $this->process($user);
}

// Явно очистить переменную
unset($users);
```

---

## PHP 8.x оптимизации

**JIT (Just-In-Time compilation):**

```ini
; php.ini
opcache.jit=tracing       ; Режим JIT
opcache.jit_buffer_size=100M
```

**Преимущества PHP 8:**

```php
// Union types (меньше проверок)
function process(int|float $value): int|float
{
    return $value * 2;
}

// Match (быстрее switch)
$result = match($status) {
    'pending' => 'В ожидании',
    'processing' => 'Обработка',
    'completed' => 'Завершено',
};

// Named arguments (меньше памяти)
User::create(
    name: 'John',
    email: 'john@example.com'
);

// Nullsafe operator
$country = $user?->address?->country;

// Attributes (вместо annotations)
#[Route('/api/users')]
class UserController {}
```

---

## Profiling

**Xdebug profiler:**

```ini
; php.ini
xdebug.mode=profile
xdebug.output_dir=/tmp/xdebug
xdebug.profiler_output_name=cachegrind.out.%p
```

**Анализ в PhpStorm:**

```
Tools → Analyze Xdebug Profiler Snapshot
```

**Blackfire:**

```bash
# Установить
sudo apt-get install blackfire-agent blackfire-php

# Профилировать
blackfire curl http://localhost/slow-page

# Web UI: https://blackfire.io
```

**Laravel Telescope:**

```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate

# http://localhost/telescope
# Показывает медленные запросы, queries, jobs
```

---

## Оптимизация кода

**Избегать лишних вычислений:**

```php
// ❌ ПЛОХО: вычисление в цикле
for ($i = 0; $i < count($array); $i++) {
    // count() вызывается каждую итерацию
}

// ✅ ХОРОШО
$count = count($array);
for ($i = 0; $i < $count; $i++) {
    // ...
}

// ✅ Ещё лучше: foreach
foreach ($array as $item) {
    // ...
}
```

**Строковые операции:**

```php
// ❌ ПЛОХО: медленная конкатенация
$result = '';
foreach ($items as $item) {
    $result .= $item . "\n";
}

// ✅ ХОРОШО: implode
$result = implode("\n", $items);

// ✅ Или array join
$result = array_reduce($items, fn($carry, $item) => $carry . $item . "\n", '');
```

**Использовать типизацию:**

```php
// ❌ ПЛОХО: без типов (PHP проверяет типы runtime)
function calculate($a, $b)
{
    return $a + $b;
}

// ✅ ХОРОШО: с типами (оптимизация компилятора)
function calculate(int $a, int $b): int
{
    return $a + $b;
}
```

---

## Laravel оптимизации

**Config cache:**

```bash
# Production: кешировать всё
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Одна команда
php artisan optimize
```

**Autoload optimization:**

```bash
# Production: оптимизированный autoload
composer install --optimize-autoloader --no-dev

# Или
composer dump-autoload --optimize
```

**Eager loading:**

```php
// ❌ ПЛОХО: N+1
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name;  // N queries
}

// ✅ ХОРОШО: 2 queries
$posts = Post::with('user')->get();
```

---

## Практические примеры

**Оптимизация API response:**

```php
// ❌ ПЛОХО
public function index()
{
    return User::all();  // Вся таблица, все поля
}

// ✅ ХОРОШО
public function index()
{
    return User::select(['id', 'name', 'email'])
        ->paginate(20);
}

// ✅ С кешем
public function index()
{
    return Cache::remember('users.list', 300, function () {
        return User::select(['id', 'name', 'email'])
            ->paginate(20);
    });
}
```

**Оптимизация Job:**

```php
// ❌ ПЛОХО: много памяти
class ProcessUsers implements ShouldQueue
{
    public function handle()
    {
        $users = User::all();  // Вся таблица в памяти

        foreach ($users as $user) {
            $this->process($user);
        }
    }
}

// ✅ ХОРОШО: chunking
class ProcessUsers implements ShouldQueue
{
    public function handle()
    {
        User::chunk(100, function ($users) {
            foreach ($users as $user) {
                $this->process($user);
            }
        });
    }
}
```

**Preloading (PHP 7.4+):**

```php
// preload.php
<?php
opcache_compile_file(__DIR__ . '/vendor/autoload.php');

$files = [
    __DIR__ . '/app/Models/User.php',
    __DIR__ . '/app/Models/Post.php',
    // ... часто используемые классы
];

foreach ($files as $file) {
    opcache_compile_file($file);
}
```

```ini
; php.ini
opcache.preload=/path/to/preload.php
```

---

## Мониторинг производительности

**APM (Application Performance Monitoring):**

```bash
# New Relic
composer require newrelic/newrelic-php-agent

# Blackfire
composer require blackfire/blackfire-php-sdk
```

**Custom metrics:**

```php
// Замерить время выполнения
$start = microtime(true);

// ... код ...

$time = microtime(true) - $start;
Log::info('Processing time', ['time' => $time]);

// Или через helper
$result = timer(function () {
    return $this->heavyOperation();
});
```

---

## На собеседовании скажешь

> "PHP optimization: OPcache для кеширования bytecode (validate_timestamps=0 для production). PHP-FPM: pm.max_children расчёт по памяти, pm=dynamic/static. Memory management: chunk/lazy для больших объёмов. PHP 8 JIT для CPU-intensive задач. Profiling: Xdebug, Blackfire, Telescope. Laravel optimize (config, route, view cache). Autoloader optimization. Typed properties для оптимизации. Избегать count() в цикле, использовать implode вместо конкатенации."

---

## Практические задания

### Задание 1: Настрой OPcache для production

Создай оптимальную конфигурацию OPcache для Laravel приложения на production.

<details>
<summary>Решение</summary>

```ini
; /etc/php/8.2/fpm/conf.d/10-opcache.ini

[opcache]
; Включить OPcache
opcache.enable=1
opcache.enable_cli=0  ; Отключить для CLI (artisan commands)

; Память
opcache.memory_consumption=256        ; 256MB для кеша
opcache.interned_strings_buffer=16   ; 16MB для строк
opcache.max_accelerated_files=20000  ; Laravel ~10k файлов

; Production настройки
opcache.validate_timestamps=0        ; НЕ проверять изменения файлов
opcache.revalidate_freq=0
opcache.fast_shutdown=1

; Оптимизации
opcache.save_comments=1              ; Сохранять комментарии (для Doctrine annotations)
opcache.enable_file_override=1

; Огромные файлы
opcache.max_file_size=0              ; Без лимита

; JIT (PHP 8+)
opcache.jit=tracing
opcache.jit_buffer_size=100M

; Мониторинг
opcache.error_log=/var/log/php-opcache-errors.log

# Перезагрузить PHP-FPM после изменений
sudo systemctl reload php8.2-fpm

# Проверить статус
php -r "var_dump(opcache_get_status());"

# Очистить OPcache после deploy
php artisan opcache:clear
# или через FPM
sudo systemctl reload php8.2-fpm

# Development настройки (отличия)
opcache.validate_timestamps=1
opcache.revalidate_freq=2
opcache.jit=off
```
</details>

### Задание 2: Оптимизация memory-intensive команды

Оптимизируй Artisan команду для экспорта 1 млн пользователей в CSV.

<details>
<summary>Решение</summary>

```php
// ❌ ПЛОХО: Вся таблица в памяти
class ExportUsersCommand extends Command
{
    public function handle()
    {
        $users = User::all();  // 1M users × 500 bytes = 500MB!

        $csv = fopen('users.csv', 'w');

        foreach ($users as $user) {
            fputcsv($csv, [
                $user->id,
                $user->name,
                $user->email,
            ]);
        }

        fclose($csv);
    }
}

// ✅ ХОРОШО: Chunk + generator
class ExportUsersCommand extends Command
{
    private const CHUNK_SIZE = 1000;

    public function handle()
    {
        $csv = fopen('users.csv', 'w');

        // Headers
        fputcsv($csv, ['ID', 'Name', 'Email']);

        $processed = 0;

        // Chunk: загружает по 1000 записей
        User::select(['id', 'name', 'email'])
            ->chunk(self::CHUNK_SIZE, function ($users) use ($csv, &$processed) {
                foreach ($users as $user) {
                    fputcsv($csv, [
                        $user->id,
                        $user->name,
                        $user->email,
                    ]);
                }

                $processed += $users->count();
                $this->info("Processed: {$processed}");

                // Освободить память
                unset($users);
                gc_collect_cycles();
            });

        fclose($csv);

        $this->info('Export completed!');
    }
}

// ✅ ЕЩЁ ЛУЧШЕ: LazyCollection (PHP 8+)
class ExportUsersCommand extends Command
{
    public function handle()
    {
        $csv = fopen('users.csv', 'w');
        fputcsv($csv, ['ID', 'Name', 'Email']);

        User::select(['id', 'name', 'email'])
            ->lazy()  // Generator pattern
            ->each(function ($user) use ($csv) {
                fputcsv($csv, [
                    $user->id,
                    $user->name,
                    $user->email,
                ]);
            });

        fclose($csv);
    }
}

// Память:
// ❌ all(): ~500MB
// ✅ chunk(): ~5MB
// ✅ lazy(): ~1MB

// Запуск с увеличенным memory_limit
php -d memory_limit=512M artisan export:users
```
</details>

### Задание 3: PHP 8 оптимизации

Перепиши код используя новые возможности PHP 8 для лучшей производительности.

<details>
<summary>Решение</summary>

```php
// ❌ PHP 7 стиль
class OrderService
{
    private $paymentGateway;
    private $logger;

    public function __construct($paymentGateway, $logger)
    {
        $this->paymentGateway = $paymentGateway;
        $this->logger = $logger;
    }

    public function calculateDiscount($order)
    {
        $discount = 0;

        if ($order->type === 'standard') {
            $discount = 5;
        } elseif ($order->type === 'premium') {
            $discount = 10;
        } elseif ($order->type === 'vip') {
            $discount = 20;
        }

        return $discount;
    }

    public function getTotal($order)
    {
        if ($order === null) {
            return null;
        }

        if ($order->user === null) {
            return null;
        }

        if ($order->user->discount === null) {
            return null;
        }

        return $order->user->discount->amount;
    }
}

// ✅ PHP 8 оптимизированный
class OrderService
{
    // Constructor property promotion (меньше кода, меньше памяти)
    public function __construct(
        private PaymentGateway $paymentGateway,
        private LoggerInterface $logger
    ) {}

    // Match expression (быстрее switch, меньше памяти)
    public function calculateDiscount(Order $order): int
    {
        return match($order->type) {
            OrderType::Standard => 5,
            OrderType::Premium => 10,
            OrderType::VIP => 20,
            default => 0,
        };
    }

    // Nullsafe operator (меньше проверок)
    public function getTotal(?Order $order): ?float
    {
        return $order?->user?->discount?->amount;
    }

    // Union types (меньше runtime проверок)
    public function process(int|float $amount): int|float
    {
        return $amount * 1.1;
    }

    // Named arguments (читаемость + меньше памяти)
    public function createOrder(
        int $userId,
        array $items,
        ?string $discountCode = null,
        bool $isGift = false
    ): Order {
        // ...
    }

    // Использование
    // $order = $service->createOrder(
    //     userId: 1,
    //     items: $items,
    //     isGift: true
    // );
}

// Производительность:
// - Constructor promotion: -10% памяти
// - Match vs switch: +5% скорость
// - Nullsafe: +15% скорость (меньше if)
// - Typed properties: +10% скорость (JIT оптимизация)
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
