# 3.4 PSR стандарты

## Краткое резюме

> **PSR** — PHP Standard Recommendations, стандарты для совместимости библиотек.
>
> **Основные:** PSR-4 (автозагрузка), PSR-3 (логирование), PSR-11 (контейнер), PSR-12 (стиль кода).
>
> **Laravel** следует PSR-4, PSR-3, PSR-11, PSR-16.

---

## Содержание

- [Что такое PSR](#что-такое-psr)
- [PSR-1: Basic Coding Standard](#psr-1-basic-coding-standard)
- [PSR-12: Extended Coding Style Guide](#psr-12-extended-coding-style-guide)
- [PSR-3: Logger Interface](#psr-3-logger-interface)
- [PSR-4: Autoloading Standard](#psr-4-autoloading-standard)
- [PSR-11: Container Interface](#psr-11-container-interface)
- [PSR-16: Simple Cache](#psr-16-simple-cache)
- [Резюме PSR стандартов](#резюме-psr-стандартов)
- [Практические задания](#практические-задания)

---

## Что такое PSR

**Что это:**
PHP Standard Recommendations — стандарты кодирования и интерфейсы для совместимости библиотек.

**Основные PSR:**
- **PSR-1** — Basic Coding Standard (базовый стиль кода)
- **PSR-2** — Coding Style Guide (устарел, заменён PSR-12)
- **PSR-3** — Logger Interface
- **PSR-4** — Autoloading Standard
- **PSR-6** — Caching Interface
- **PSR-7** — HTTP Message Interface
- **PSR-11** — Container Interface
- **PSR-12** — Extended Coding Style Guide
- **PSR-15** — HTTP Server Request Handlers
- **PSR-16** — Simple Cache

**Когда использовать:**
**Всегда** следуй PSR стандартам для совместимости и читаемости.

**Пример из практики:**
```php
// Laravel следует PSR-4, PSR-3, PSR-11, PSR-16

// PSR-4 автозагрузка
use App\Models\User;
use App\Services\UserService;

// PSR-3 Logger
use Psr\Log\LoggerInterface;

class OrderService
{
    public function __construct(
        private LoggerInterface $logger,  // PSR-3
    ) {}

    public function create(array $data): Order
    {
        $this->logger->info('Creating order', $data);
        // ...
    }
}

// PSR-11 Container
$service = app(OrderService::class);  // Laravel Container (PSR-11)

// PSR-16 Simple Cache
Cache::put('key', 'value', 3600);  // Laravel Cache (PSR-16)
```

**На собеседовании скажешь:**
> "PSR — стандарты PHP. PSR-4 для автозагрузки, PSR-3 для логирования, PSR-11 для контейнеров. Laravel следует PSR. Это обеспечивает совместимость библиотек и читаемость кода."

---

## PSR-1: Basic Coding Standard

**Что это:**
Базовые правила оформления кода.

**Правила:**
```php
// 1. <?php или <?= для открытия
<?php

// 2. Только UTF-8 без BOM
// 3. Файлы должны объявлять символы (классы) ИЛИ производить побочные эффекты, но не оба

// ПЛОХО (объявление + побочный эффект)
<?php
class User {}
echo "Hello";  // Побочный эффект

// ХОРОШО (только объявление)
<?php
class User {}

// ХОРОШО (только побочные эффекты)
<?php
require 'vendor/autoload.php';
$app->run();

// 4. Namespace и use после <?php
<?php

declare(strict_types=1);  // Опционально

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class User extends Model {}

// 5. Имена классов в StudlyCaps (PascalCase)
class UserService {}
class OrderController {}

// 6. Константы класса в UPPER_CASE
class Config
{
    public const DB_HOST = 'localhost';
    public const DB_PORT = 5432;
}

// 7. Методы в camelCase
class UserService
{
    public function createUser() {}
    public function getUserById() {}
}
```

**Когда использовать:**
**Всегда** следуй PSR-1.

**Пример из практики:**
```php
// Laravel файл (следует PSR-1)
<?php

declare(strict_types=1);

namespace App\Services\Order;

use App\Models\Order;
use App\Repositories\OrderRepository;
use Psr\Log\LoggerInterface;

class OrderService
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_COMPLETED = 'completed';

    public function __construct(
        private OrderRepository $repository,
        private LoggerInterface $logger,
    ) {}

    public function createOrder(array $data): Order
    {
        $this->logger->info('Creating order');
        return $this->repository->create($data);
    }

    public function getOrderById(int $id): ?Order
    {
        return $this->repository->find($id);
    }
}
```

**На собеседовании скажешь:**
> "PSR-1: файлы UTF-8, классы в PascalCase, методы в camelCase, константы в UPPER_CASE. Один файл — либо объявления, либо побочные эффекты. declare(strict_types=1) в начале файла."

---

## PSR-12: Extended Coding Style Guide

**Что это:**
Расширенные правила оформления кода (заменил PSR-2).

**Правила:**
```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\{User, Post, Comment};  // Группировка
use Illuminate\Support\Collection;

// 1. Отступы: 4 пробела (не табы)
// 2. Длина строки: желательно <= 120 символов

class UserService
{
    // 3. Видимость обязательна для всех свойств и методов
    private string $name;
    protected int $age;
    public bool $isActive;

    // 4. Конструктор
    public function __construct(
        private UserRepository $repository,  // Каждый параметр на новой строке
        private LoggerInterface $logger,
    ) {}  // Закрывающая скобка на новой строке

    // 5. Методы: открывающая { на новой строке (устарело в PSR-12, теперь на той же)
    public function create(array $data): User
    {
        // Тело метода
        if (empty($data['name'])) {
            throw new \InvalidArgumentException('Name is required');
        }

        return $this->repository->create($data);
    }

    // 6. if, for, foreach: { на той же строке
    public function process(Collection $items): void
    {
        foreach ($items as $item) {
            if ($item->isValid()) {
                $this->processItem($item);
            } else {
                $this->skipItem($item);
            }
        }
    }

    // 7. return type на той же строке
    public function getUserById(int $id): ?User
    {
        return $this->repository->find($id);
    }
}

// 8. Операторы: пробелы вокруг
$sum = $a + $b;  // ✅
$sum=$a+$b;      // ❌

// 9. Запятая в массиве: пробел после
$array = [1, 2, 3];  // ✅
$array = [1,2,3];    // ❌

// 10. use в начале файла, сортировка по алфавиту
use App\Models\User;
use App\Services\UserService;
use Illuminate\Support\Facades\Log;
```

**Когда использовать:**
**Всегда**. Используй PHP CS Fixer для автоформатирования.

**Пример из практики:**
```bash
# PHP CS Fixer
composer require friendsofphp/php-cs-fixer --dev

# .php-cs-fixer.php
<?php

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__ . '/app')
    ->in(__DIR__ . '/tests');

return (new PhpCsFixer\Config())
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
    ])
    ->setFinder($finder);

# Запуск
php-cs-fixer fix

# Laravel Pint (встроенный в Laravel 9+)
./vendor/bin/pint

# composer.json
{
    "scripts": {
        "format": "pint"
    }
}

composer format
```

**На собеседовании скажешь:**
> "PSR-12: 4 пробела отступ, видимость обязательна, { на той же строке для if/foreach. PHP CS Fixer или Laravel Pint для автоформатирования. PSR-12 заменил PSR-2."

---

## PSR-3: Logger Interface

**Что это:**
Стандартный интерфейс для логирования.

**Как работает:**
```php
// Интерфейс PSR-3
namespace Psr\Log;

interface LoggerInterface
{
    public function emergency(string|\Stringable $message, array $context = []): void;
    public function alert(string|\Stringable $message, array $context = []): void;
    public function critical(string|\Stringable $message, array $context = []): void;
    public function error(string|\Stringable $message, array $context = []): void;
    public function warning(string|\Stringable $message, array $context = []): void;
    public function notice(string|\Stringable $message, array $context = []): void;
    public function info(string|\Stringable $message, array $context = []): void;
    public function debug(string|\Stringable $message, array $context = []): void;
    public function log($level, string|\Stringable $message, array $context = []): void;
}

// Использование
use Psr\Log\LoggerInterface;

class UserService
{
    public function __construct(
        private LoggerInterface $logger,
    ) {}

    public function create(array $data): User
    {
        $this->logger->info('Creating user', ['email' => $data['email']]);

        try {
            $user = User::create($data);
            $this->logger->info('User created', ['id' => $user->id]);

            return $user;
        } catch (\Exception $e) {
            $this->logger->error('User creation failed', [
                'error' => $e->getMessage(),
                'data' => $data,
            ]);

            throw $e;
        }
    }
}
```

**Когда использовать:**
Для совместимости с разными логгерами (Monolog, Laravel Log).

**Пример из практики:**
```php
// Laravel реализует PSR-3
use Illuminate\Support\Facades\Log;

// Методы PSR-3
Log::emergency('System is down');
Log::alert('Critical issue');
Log::critical('Application crashed');
Log::error('User not found', ['id' => 123]);
Log::warning('Slow query', ['time' => 5.2]);
Log::notice('User logged in', ['user_id' => 1]);
Log::info('Processing order', ['order_id' => 456]);
Log::debug('Debug info', ['var' => $value]);

// DI через PSR-3
class OrderService
{
    public function __construct(
        private LoggerInterface $logger,  // Любая PSR-3 реализация
    ) {}

    public function process(Order $order): void
    {
        $this->logger->info('Processing order', [
            'order_id' => $order->id,
            'amount' => $order->amount,
        ]);

        // Логика
    }
}

// Laravel Service Container автоматически внедрит
$service = app(OrderService::class);

// Можно заменить реализацию
app()->bind(LoggerInterface::class, MyCustomLogger::class);
```

**На собеседовании скажешь:**
> "PSR-3 — стандартный интерфейс логирования. Методы: emergency, alert, critical, error, warning, notice, info, debug. Laravel Log реализует PSR-3. DI через LoggerInterface для совместимости с разными логгерами."

---

## PSR-4: Autoloading Standard

**Что это:**
Стандарт автозагрузки классов (см. тему 3.2).

**Правила:**
```php
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\": "database/"
        }
    }
}

// Правила PSR-4:
// 1. Полное имя класса = namespace + class name
// 2. Namespace соответствует структуре папок
// 3. Имя файла = имя класса + .php

// Пример:
// Класс: App\Services\Order\OrderService
// Файл: app/Services/Order/OrderService.php

// namespace App\Services\Order; — соответствует app/Services/Order/
// class OrderService             — соответствует OrderService.php
```

**На собеседовании скажешь:**
> "PSR-4 — стандарт автозагрузки. Namespace соответствует структуре папок. App\\\\ → app/, имя файла = имя класса. Composer автоматически загружает классы."

---

## PSR-11: Container Interface

**Что это:**
Стандартный интерфейс для Dependency Injection контейнеров.

**Как работает:**
```php
// Интерфейс PSR-11
namespace Psr\Container;

interface ContainerInterface
{
    public function get(string $id): mixed;  // Получить сервис
    public function has(string $id): bool;   // Проверить наличие
}

// Laravel Container реализует PSR-11
use Psr\Container\ContainerInterface;

$container = app();  // Laravel Container (PSR-11)

// Методы PSR-11
if ($container->has(UserService::class)) {
    $service = $container->get(UserService::class);
}

// Использование
class OrderController
{
    public function __construct(
        private ContainerInterface $container,  // PSR-11
    ) {}

    public function index()
    {
        $service = $this->container->get(OrderService::class);
        $orders = $service->all();

        return view('orders.index', compact('orders'));
    }
}
```

**Когда использовать:**
Для совместимости с разными контейнерами.

**Пример из практики:**
```php
// Laravel Service Container (PSR-11)
app()->bind(UserRepositoryInterface::class, EloquentUserRepository::class);

// Получение через PSR-11
$repository = app()->get(UserRepositoryInterface::class);

// Проверка
if (app()->has(UserRepositoryInterface::class)) {
    // ...
}

// DI в конструкторе (Laravel автоматически использует контейнер)
class UserService
{
    public function __construct(
        private UserRepositoryInterface $repository,
    ) {}
}

$service = app(UserService::class);  // Laravel разрешит зависимости
```

**На собеседовании скажешь:**
> "PSR-11 — стандартный интерфейс контейнера. Методы: get(), has(). Laravel Container реализует PSR-11. Используется для DI, разрешения зависимостей."

---

## PSR-16: Simple Cache

**Что это:**
Простой стандартный интерфейс для кэширования.

**Как работает:**
```php
// Интерфейс PSR-16
namespace Psr\SimpleCache;

interface CacheInterface
{
    public function get(string $key, mixed $default = null): mixed;
    public function set(string $key, mixed $value, null|int|\DateInterval $ttl = null): bool;
    public function delete(string $key): bool;
    public function clear(): bool;
    public function getMultiple(iterable $keys, mixed $default = null): iterable;
    public function setMultiple(iterable $values, null|int|\DateInterval $ttl = null): bool;
    public function deleteMultiple(iterable $keys): bool;
    public function has(string $key): bool;
}

// Laravel Cache реализует PSR-16
use Psr\SimpleCache\CacheInterface;

class UserService
{
    public function __construct(
        private CacheInterface $cache,
    ) {}

    public function getUser(int $id): ?User
    {
        $key = "user:{$id}";

        // PSR-16 методы
        if ($this->cache->has($key)) {
            return $this->cache->get($key);
        }

        $user = User::find($id);

        $this->cache->set($key, $user, 3600);

        return $user;
    }
}
```

**Когда использовать:**
Для совместимости с разными кэш-драйверами.

**Пример из практики:**
```php
// Laravel Cache Facade (PSR-16)
use Illuminate\Support\Facades\Cache;

// PSR-16 методы
Cache::set('key', 'value', 3600);
$value = Cache::get('key');
$exists = Cache::has('key');
Cache::delete('key');

// Multiple операции
Cache::setMultiple([
    'user:1' => $user1,
    'user:2' => $user2,
], 3600);

$users = Cache::getMultiple(['user:1', 'user:2']);

Cache::deleteMultiple(['user:1', 'user:2']);

// DI через PSR-16
$cache = app(CacheInterface::class);
$cache->set('key', 'value', 3600);

// Можно заменить драйвер (Redis, Memcached, File)
// config/cache.php
'default' => env('CACHE_DRIVER', 'redis'),
```

**На собеседовании скажешь:**
> "PSR-16 — простой интерфейс кэширования. Методы: get(), set(), delete(), has(). Laravel Cache реализует PSR-16. Совместимость с разными драйверами (Redis, Memcached)."

---

## Резюме PSR стандартов

**Основные PSR:**
- **PSR-1** — базовый стиль кода (UTF-8, PascalCase для классов)
- **PSR-12** — расширенный стиль (заменил PSR-2, 4 пробела, видимость)
- **PSR-3** — Logger Interface (emergency, alert, error, warning, info)
- **PSR-4** — автозагрузка (namespace = структура папок)
- **PSR-11** — Container Interface (get, has)
- **PSR-16** — Simple Cache (get, set, delete, has)
- **PSR-7** — HTTP Message Interface (Request, Response)
- **PSR-15** — HTTP Server Request Handlers (Middleware)

**Зачем нужны PSR:**
- Совместимость библиотек
- Единый стиль кода
- Возможность замены реализаций

**Важно на собесе:**
- Laravel следует PSR-4, PSR-3, PSR-11, PSR-16
- PSR-12 для форматирования (PHP CS Fixer, Laravel Pint)
- PSR-3 для логирования (LoggerInterface)
- PSR-11 для DI (ContainerInterface)
- PSR-4 для автозагрузки (обязательно)

---

## Практические задания

### Задание 1: Настрой Laravel Pint для PSR-12

Настрой Laravel Pint для автоматического форматирования кода по PSR-12.

<details>
<summary>Решение</summary>

```json
// pint.json (в корне проекта)
{
    "preset": "psr12",
    "rules": {
        "array_syntax": {
            "syntax": "short"
        },
        "ordered_imports": {
            "sort_algorithm": "alpha"
        },
        "no_unused_imports": true,
        "blank_line_after_namespace": true,
        "blank_line_after_opening_tag": true,
        "concat_space": {
            "spacing": "one"
        },
        "trailing_comma_in_multiline": {
            "elements": ["arrays"]
        }
    }
}
```

```json
// composer.json (добавить scripts)
{
    "scripts": {
        "format": "pint",
        "format:test": "pint --test",
        "format:dirty": "pint --dirty"
    }
}
```

Использование:
```bash
# Форматировать все файлы
./vendor/bin/pint

# Или через composer
composer format

# Проверить без изменений
composer format:test

# Только измененные файлы (git)
composer format:dirty
```

**.gitignore:**
```
.php-cs-fixer.cache
```

**CI/CD (GitHub Actions):**
```yaml
# .github/workflows/pint.yml
name: Laravel Pint

on: [push, pull_request]

jobs:
  pint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2

      - name: Install Dependencies
        run: composer install

      - name: Run Pint
        run: ./vendor/bin/pint --test
```
</details>

### Задание 2: Реализуй PSR-3 Logger

Создай кастомный Logger, который реализует PSR-3 интерфейс и пишет в файл.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Logging;

use Psr\Log\LoggerInterface;
use Psr\Log\LogLevel;

class FileLogger implements LoggerInterface
{
    public function __construct(
        private string $logFile,
    ) {}

    public function emergency(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::EMERGENCY, $message, $context);
    }

    public function alert(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::ALERT, $message, $context);
    }

    public function critical(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::CRITICAL, $message, $context);
    }

    public function error(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::ERROR, $message, $context);
    }

    public function warning(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::WARNING, $message, $context);
    }

    public function notice(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::NOTICE, $message, $context);
    }

    public function info(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::INFO, $message, $context);
    }

    public function debug(string|\Stringable $message, array $context = []): void
    {
        $this->log(LogLevel::DEBUG, $message, $context);
    }

    public function log($level, string|\Stringable $message, array $context = []): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $levelUpper = strtoupper($level);

        $message = $this->interpolate($message, $context);

        $contextJson = !empty($context) ? ' ' . json_encode($context) : '';

        $logMessage = "[{$timestamp}] {$levelUpper}: {$message}{$contextJson}\n";

        file_put_contents($this->logFile, $logMessage, FILE_APPEND);
    }

    private function interpolate(string|\Stringable $message, array $context): string
    {
        $replace = [];

        foreach ($context as $key => $val) {
            if (!is_array($val) && (!is_object($val) || method_exists($val, '__toString'))) {
                $replace['{' . $key . '}'] = $val;
            }
        }

        return strtr((string) $message, $replace);
    }
}

// Регистрация в Laravel Service Provider
namespace App\Providers;

use App\Logging\FileLogger;
use Illuminate\Support\ServiceProvider;
use Psr\Log\LoggerInterface;

class LoggingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LoggerInterface::class, function () {
            return new FileLogger(storage_path('logs/app.log'));
        });
    }
}

// Использование
use Psr\Log\LoggerInterface;

class UserService
{
    public function __construct(
        private LoggerInterface $logger,
    ) {}

    public function create(array $data): User
    {
        $this->logger->info('Creating user', ['email' => $data['email']]);

        try {
            $user = User::create($data);
            $this->logger->info('User created', ['id' => $user->id]);

            return $user;
        } catch (\Exception $e) {
            $this->logger->error('User creation failed', [
                'error' => $e->getMessage(),
                'data' => $data,
            ]);

            throw $e;
        }
    }
}
```
</details>

### Задание 3: Создай PSR-11 совместимый контейнер

Реализуй простой DI контейнер, совместимый с PSR-11.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Container;

use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use ReflectionClass;

class Container implements ContainerInterface
{
    private array $bindings = [];
    private array $instances = [];

    public function bind(string $id, callable|string $concrete): void
    {
        $this->bindings[$id] = $concrete;
    }

    public function singleton(string $id, callable|string $concrete): void
    {
        $this->bind($id, $concrete);
        // Пометка как singleton
        $this->bindings[$id . '.singleton'] = true;
    }

    public function get(string $id): mixed
    {
        // Если есть готовый singleton
        if (isset($this->instances[$id])) {
            return $this->instances[$id];
        }

        // Если есть binding
        if (isset($this->bindings[$id])) {
            $concrete = $this->bindings[$id];

            $object = is_callable($concrete)
                ? $concrete($this)
                : $this->resolve($concrete);

            // Сохранить singleton
            if (isset($this->bindings[$id . '.singleton'])) {
                $this->instances[$id] = $object;
            }

            return $object;
        }

        // Попытка автоматического разрешения
        if (class_exists($id)) {
            return $this->resolve($id);
        }

        throw new class("Entry '{$id}' not found in container") extends \Exception implements NotFoundExceptionInterface {};
    }

    public function has(string $id): bool
    {
        return isset($this->bindings[$id])
            || isset($this->instances[$id])
            || class_exists($id);
    }

    private function resolve(string $class): object
    {
        $reflection = new ReflectionClass($class);

        $constructor = $reflection->getConstructor();

        if ($constructor === null) {
            return new $class();
        }

        $dependencies = [];

        foreach ($constructor->getParameters() as $parameter) {
            $type = $parameter->getType();

            if ($type === null || $type->isBuiltin()) {
                if ($parameter->isDefaultValueAvailable()) {
                    $dependencies[] = $parameter->getDefaultValue();
                } else {
                    throw new \Exception("Cannot resolve {$parameter->getName()} for {$class}");
                }
            } else {
                $dependencies[] = $this->get($type->getName());
            }
        }

        return $reflection->newInstanceArgs($dependencies);
    }
}

// Использование
$container = new Container();

// Биндинг интерфейса к реализации
$container->bind(UserRepositoryInterface::class, EloquentUserRepository::class);

// Singleton
$container->singleton(DatabaseConnection::class, function ($container) {
    return new DatabaseConnection('localhost', 'mydb');
});

// Получение
$repository = $container->get(UserRepositoryInterface::class);

// Автоматическое разрешение зависимостей
class UserService
{
    public function __construct(
        private UserRepositoryInterface $repository,
        private LoggerInterface $logger,
    ) {}
}

$service = $container->get(UserService::class);
// Автоматически разрешит UserRepositoryInterface и LoggerInterface
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
