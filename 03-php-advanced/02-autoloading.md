# 3.2 Автозагрузка (Composer, PSR-4)

## Краткое резюме

> **Автозагрузка** — автоматическая загрузка классов без require/include через Composer.
>
> **PSR-4:** Namespace = структура папок. `App\\Models\\User` → `app/Models/User.php`.
>
> **Важно:** `composer dump-autoload` после изменений, `--optimize` для продакшена.

---

## Содержание

- [Что такое автозагрузка](#что-такое-автозагрузка)
- [PSR-4 стандарт](#psr-4-стандарт)
- [composer dump-autoload](#composer-dump-autoload)
- [classmap автозагрузка](#classmap-автозагрузка)
- [files автозагрузка](#files-автозагрузка)
- [Автозагрузка для dev (autoload-dev)](#автозагрузка-для-dev-autoload-dev)
- [spl_autoload_register](#spl_autoload_register-custom-autoloader)
- [Резюме автозагрузки](#резюме-автозагрузки)
- [Практические задания](#практические-задания)

---

## Что такое автозагрузка

**Что это:**
Автоматическая загрузка классов без require/include.

**Как работает:**
```php
// БЕЗ автозагрузки (старый способ)
require_once 'app/Models/User.php';
require_once 'app/Services/UserService.php';
require_once 'app/Repositories/UserRepository.php';

$user = new App\Models\User();
$service = new App\Services\UserService();

// С автозагрузкой
// require_once 'vendor/autoload.php';  // Только один раз

$user = new App\Models\User();  // Автоматически загружает app/Models/User.php
$service = new App\Services\UserService();  // Автоматически загружает app/Services/UserService.php
```

**Когда использовать:**
**Всегда** через Composer (PSR-4).

**Пример из практики:**
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

// index.php (Laravel public/index.php)
require __DIR__ . '/../vendor/autoload.php';

// Теперь все классы загружаются автоматически
use App\Models\User;
use App\Services\UserService;

$user = User::find(1);  // Автоматически загружает app/Models/User.php
$service = new UserService();  // Автоматически загружает app/Services/UserService.php
```

**На собеседовании скажешь:**
> "Автозагрузка автоматически подключает классы без require. Composer генерирует autoloader по PSR-4. Достаточно require 'vendor/autoload.php' один раз. Composer связывает namespace со структурой папок."

---

## PSR-4 стандарт

**Что это:**
Стандарт автозагрузки: namespace соответствует структуре папок.

**Как работает:**
```php
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Tests\\": "tests/"
        }
    }
}

// Структура проекта:
// app/
//   Models/
//     User.php        → namespace App\Models; class User
//     Post.php        → namespace App\Models; class Post
//   Services/
//     UserService.php → namespace App\Services; class UserService
//   Http/
//     Controllers/
//       UserController.php → namespace App\Http\Controllers; class UserController

// Правила PSR-4:
// 1. Namespace = путь от базовой директории
// 2. Имя файла = имя класса + .php
// 3. Один класс = один файл

// Пример:
// App\Models\User → app/Models/User.php
// App\Services\Order\OrderService → app/Services/Order/OrderService.php

// Использование:
use App\Models\User;
use App\Services\UserService;

$user = new User();  // Загрузит app/Models/User.php
$service = new UserService();  // Загрузит app/Services/UserService.php
```

**Когда использовать:**
**Всегда** следуй PSR-4 для структуры проекта.

**Пример из практики:**
```php
// Laravel структура (PSR-4)
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        }
    }
}

// Файл: app/Http/Controllers/Api/PostController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;

class PostController extends Controller
{
    public function index()
    {
        return Post::all();
    }
}

// Файл: app/Services/Order/OrderService.php
namespace App\Services\Order;

use App\Models\Order;
use App\Repositories\OrderRepository;

class OrderService
{
    public function __construct(
        private OrderRepository $repository,
    ) {}

    public function create(array $data): Order
    {
        return $this->repository->create($data);
    }
}

// Composer автоматически знает:
// App\Http\Controllers\Api\PostController → app/Http/Controllers/Api/PostController.php
// App\Services\Order\OrderService → app/Services/Order/OrderService.php
```

**На собеседовании скажешь:**
> "PSR-4 — стандарт автозагрузки. Namespace соответствует структуре папок. App\\\\ → app/, App\\\\Models\\\\User → app/Models/User.php. Один класс = один файл. Имя файла = имя класса + .php."

---

## composer dump-autoload

**Что это:**
Команда для регенерации файлов автозагрузки.

**Как работает:**
```bash
# После изменения composer.json
composer dump-autoload

# Оптимизированная автозагрузка (для продакшена)
composer dump-autoload --optimize
# или
composer dump-autoload -o

# Авторитетная автозагрузка (ещё быстрее)
composer dump-autoload --classmap-authoritative
# или
composer dump-autoload -a
```

**Когда использовать:**
- После изменения `autoload` в composer.json
- После добавления новых namespace
- Перед деплоем (с `--optimize`)

**Пример из практики:**
```php
// 1. Добавили новый namespace в composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "MyPackage\\": "packages/my-package/src/"  // Новый namespace
        }
    }
}

// 2. Регенерировать autoload
composer dump-autoload

// 3. Теперь можно использовать
use MyPackage\Services\MyService;
$service = new MyService();

// Для продакшена (быстрее)
composer dump-autoload --optimize

// Laravel Artisan (обёртка)
php artisan optimize  # Включает composer dump-autoload -o

// CI/CD pipeline
composer install --no-dev --optimize-autoloader
```

**На собеседовании скажешь:**
> "composer dump-autoload регенерирует файлы автозагрузки. Запускаю после изменения autoload в composer.json. --optimize для продакшена (быстрее). Laravel: php artisan optimize включает dump-autoload."

---

## classmap автозагрузка

**Что это:**
Альтернативный способ автозагрузки: список классов и путей к файлам.

**Как работает:**
```php
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        },
        "classmap": [
            "database/seeders",
            "database/factories"
        ]
    }
}

// Classmap НЕ требует соответствия namespace структуре папок
// database/seeders/UserSeeder.php
namespace Database\Seeders;

class UserSeeder extends Seeder
{
    // Файл может быть где угодно, Composer найдёт класс
}

// После изменений
composer dump-autoload

// Теперь можно использовать
use Database\Seeders\UserSeeder;
$seeder = new UserSeeder();
```

**Когда использовать:**
Для legacy кода, тестов, сидеров (где не соблюдается PSR-4).

**Пример из практики:**
```php
// Laravel использует classmap для database
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        },
        "classmap": [
            "database/seeders",
            "database/factories"
        ]
    }
}

// Legacy код (не PSR-4)
// lib/
//   some_old_file.php  → class SomeOldClass {}
//   another.php        → class AnotherClass {}

// composer.json
{
    "autoload": {
        "classmap": [
            "lib/"
        ]
    }
}

composer dump-autoload

// Теперь можно использовать
$obj = new SomeOldClass();  // Найдёт в lib/some_old_file.php
```

**На собеседовании скажешь:**
> "classmap — список папок с классами. Composer сканирует файлы и создаёт карту классов. Не требует соответствия namespace структуре. Использую для legacy кода, сидеров. PSR-4 предпочтительнее."

---

## files автозагрузка

**Что это:**
Автоматическая загрузка файлов (для функций, констант).

**Как работает:**
```php
// composer.json
{
    "autoload": {
        "files": [
            "app/helpers.php",
            "app/constants.php"
        ]
    }
}

// app/helpers.php
<?php

if (!function_exists('format_price')) {
    function format_price(int $cents): string
    {
        return number_format($cents / 100, 2, '.', ' ');
    }
}

if (!function_exists('str_limit')) {
    function str_limit(string $text, int $length): string
    {
        return mb_substr($text, 0, $length) . '...';
    }
}

// app/constants.php
<?php

define('MAX_UPLOAD_SIZE', 10485760);  // 10MB
define('ALLOWED_EXTENSIONS', ['jpg', 'png', 'pdf']);

// После изменений
composer dump-autoload

// Файлы загружаются автоматически при require 'vendor/autoload.php'
$price = format_price(199900);  // "1 999.00"
$limit = str_limit('Long text...', 100);

$maxSize = MAX_UPLOAD_SIZE;
```

**Когда использовать:**
Для глобальных функций, констант, bootstrap файлов.

**Пример из практики:**
```php
// Laravel структура
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        },
        "files": [
            "app/helpers.php"  // Глобальные helper функции
        ]
    }
}

// app/helpers.php
<?php

// Laravel уже содержит множество helpers
// Можно добавить свои

if (!function_exists('active_class')) {
    function active_class(string $path, string $active = 'active'): string
    {
        return request()->is($path) ? $active : '';
    }
}

if (!function_exists('format_date')) {
    function format_date(?string $date): string
    {
        return $date ? (new DateTime($date))->format('d.m.Y') : '';
    }
}

// Использование в Blade
<li class="{{ active_class('users*') }}">
    <a href="/users">Users</a>
</li>

// Использование в PHP
$formatted = format_date($user->created_at);

// Пакеты тоже могут регистрировать files
// vendor/laravel/framework/composer.json
{
    "autoload": {
        "files": [
            "src/Illuminate/Foundation/helpers.php",
            "src/Illuminate/Support/helpers.php"
        ]
    }
}
```

**На собеседовании скажешь:**
> "files автозагружает файлы при require 'vendor/autoload.php'. Использую для глобальных функций, констант. Laravel загружает helpers.php через files. if (!function_exists()) предотвращает конфликты."

---

## Автозагрузка для dev (autoload-dev)

**Что это:**
Автозагрузка только для разработки (тесты).

**Как работает:**
```php
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    }
}

// Структура:
// tests/
//   Unit/
//     ExampleTest.php → namespace Tests\Unit; class ExampleTest
//   Feature/
//     UserTest.php    → namespace Tests\Feature; class UserTest

// tests/Feature/UserTest.php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;

class UserTest extends TestCase
{
    public function test_user_can_be_created(): void
    {
        $user = User::factory()->create();
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }
}

// В разработке (composer install)
composer dump-autoload  # Загружает autoload + autoload-dev

// В продакшене (composer install --no-dev)
composer install --no-dev  # НЕ загружает autoload-dev (тесты не нужны)
```

**Когда использовать:**
Для тестов, dev-утилит, fixtures.

**Пример из практики:**
```php
// composer.json (полный пример)
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        },
        "files": [
            "app/helpers.php"
        ]
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    }
}

// tests/Unit/Services/UserServiceTest.php
namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\UserService;
use App\Repositories\UserRepository;
use Mockery;

class UserServiceTest extends TestCase
{
    public function test_create_user(): void
    {
        $repository = Mockery::mock(UserRepository::class);
        $service = new UserService($repository);

        $repository->shouldReceive('create')
            ->once()
            ->andReturn(new User());

        $user = $service->create(['name' => 'Test']);

        $this->assertInstanceOf(User::class, $user);
    }
}

// CI/CD
# Установка зависимостей для тестов
composer install

# Запуск тестов
php artisan test

# Деплой (без dev-зависимостей)
composer install --no-dev --optimize-autoloader
```

**На собеседовании скажешь:**
> "autoload-dev для разработки (тесты, dev-утилиты). composer install загружает, composer install --no-dev — нет. В продакшене тесты не нужны. Laravel: Tests\\\\ → tests/."

---

## spl_autoload_register (custom autoloader)

**Что это:**
Регистрация собственного автозагрузчика (без Composer).

**Как работает:**
```php
// Свой автозагрузчик (PSR-4)
spl_autoload_register(function ($class) {
    // App\Models\User → app/Models/User.php

    // Базовый namespace
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/app/';

    // Проверка префикса
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;  // Не наш namespace
    }

    // Относительное имя класса
    $relativeClass = substr($class, strlen($prefix));

    // Замена \ на /
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    // Загрузить файл
    if (file_exists($file)) {
        require $file;
    }
});

// Теперь можно использовать
$user = new App\Models\User();  // Автоматически загрузит app/Models/User.php

// Несколько автозагрузчиков
spl_autoload_register(function ($class) {
    // Первый автозагрузчик
});

spl_autoload_register(function ($class) {
    // Второй автозагрузчик
});
// Вызываются по очереди, пока класс не загрузится
```

**Когда использовать:**
Редко (Composer лучше). Для микропроектов без Composer.

**Пример из практики:**
```php
// index.php (без Composer)
<?php

// Автозагрузчик PSR-4
spl_autoload_register(function ($class) {
    $namespaces = [
        'App\\' => __DIR__ . '/app/',
        'Lib\\' => __DIR__ . '/lib/',
    ];

    foreach ($namespaces as $prefix => $baseDir) {
        if (strncmp($prefix, $class, strlen($prefix)) === 0) {
            $relativeClass = substr($class, strlen($prefix));
            $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

            if (file_exists($file)) {
                require $file;
                return;
            }
        }
    }
});

// Теперь можно использовать
use App\Controllers\HomeController;
use Lib\Database\Connection;

$controller = new HomeController();
$db = new Connection();

// Composer делает то же самое (но лучше)
require 'vendor/autoload.php';
```

**На собеседовании скажешь:**
> "spl_autoload_register регистрирует свой автозагрузчик. Функция получает имя класса, преобразует в путь к файлу, загружает. Composer использует spl_autoload_register внутри. Для проектов предпочитаю Composer."

---

## Резюме автозагрузки

**Основное:**
- **PSR-4** — стандарт автозагрузки (namespace = структура папок)
- `composer dump-autoload` — регенерация autoloader
- `--optimize` — оптимизированная автозагрузка (для продакшена)
- **classmap** — список папок с классами (не требует PSR-4)
- **files** — автозагрузка файлов (функции, константы)
- **autoload-dev** — только для разработки (тесты)
- `spl_autoload_register` — custom autoloader (редко)

**composer.json структура:**
```json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        },
        "classmap": ["database/seeders"],
        "files": ["app/helpers.php"]
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    }
}
```

**Важно на собесе:**
- PSR-4: App\\Models\\User → app/Models/User.php
- После изменения composer.json: composer dump-autoload
- Продакшен: composer dump-autoload --optimize
- files для глобальных функций (helpers.php)
- autoload-dev не загружается в продакшене (--no-dev)
- Composer автоматически использует spl_autoload_register

---

## Практические задания

### Задание 1: Настрой PSR-4 автозагрузку для пакета

Создай структуру для пакета `MyPackage` с namespace `MyCompany\MyPackage`. Настрой автозагрузку.

<details>
<summary>Решение</summary>

```json
// composer.json
{
    "name": "mycompany/mypackage",
    "autoload": {
        "psr-4": {
            "MyCompany\\MyPackage\\": "src/"
        },
        "files": [
            "src/helpers.php"
        ]
    },
    "autoload-dev": {
        "psr-4": {
            "MyCompany\\MyPackage\\Tests\\": "tests/"
        }
    }
}
```

Структура:
```
mypackage/
  src/
    Services/
      UserService.php    → namespace MyCompany\MyPackage\Services;
    Models/
      User.php          → namespace MyCompany\MyPackage\Models;
    helpers.php         → namespace MyCompany\MyPackage;
  tests/
    Unit/
      UserServiceTest.php → namespace MyCompany\MyPackage\Tests\Unit;
  composer.json
```

```php
// src/Services/UserService.php
<?php

namespace MyCompany\MyPackage\Services;

use MyCompany\MyPackage\Models\User;

class UserService
{
    public function create(string $name): User
    {
        return new User($name);
    }
}
```

После создания структуры:
```bash
composer dump-autoload
```

Использование в проекте:
```php
use MyCompany\MyPackage\Services\UserService;

$service = new UserService();
$user = $service->create('Иван');
```
</details>

### Задание 2: Добавь legacy код через classmap

Есть папка `legacy/` с классами без namespace. Добавь их в автозагрузку.

<details>
<summary>Решение</summary>

Структура:
```
legacy/
  OldUser.php      → class OldUser {}
  OldProduct.php   → class OldProduct {}
  helpers.php      → function old_helper() {}
```

```json
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        },
        "classmap": [
            "legacy/"
        ]
    }
}
```

```bash
composer dump-autoload
```

Использование:
```php
// Классы из legacy доступны глобально
$user = new OldUser();
$product = new OldProduct();

// Функции тоже доступны
old_helper();
```

**Альтернатива (только классы, без функций):**
```json
{
    "autoload": {
        "classmap": [
            "legacy/OldUser.php",
            "legacy/OldProduct.php"
        ]
    }
}
```
</details>

### Задание 3: Оптимизируй автозагрузку для продакшена

Подготовь команды для деплоя Laravel приложения с оптимизированной автозагрузкой.

<details>
<summary>Решение</summary>

```bash
# 1. Установка зависимостей без dev-пакетов
composer install --no-dev --optimize-autoloader

# 2. Или отдельно (если уже установлено)
composer dump-autoload --optimize --no-dev

# 3. Laravel оптимизация (включает composer dump-autoload -o)
php artisan optimize

# 4. Проверка режима автозагрузки
composer dump-autoload --optimize --classmap-authoritative

# Полный скрипт деплоя
#!/bin/bash

# Установка зависимостей
composer install --no-dev --optimize-autoloader

# Laravel кэширование
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Права доступа
chmod -R 755 storage bootstrap/cache

# Миграции
php artisan migrate --force
```

**Composer scripts (composer.json):**
```json
{
    "scripts": {
        "post-autoload-dump": [
            "Illuminate\\Foundation\\ComposerScripts::postAutoloadDump",
            "@php artisan package:discover --ansi"
        ],
        "deploy": [
            "composer install --no-dev --optimize-autoloader",
            "@php artisan optimize",
            "@php artisan migrate --force"
        ]
    }
}
```

Использование:
```bash
composer deploy
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
