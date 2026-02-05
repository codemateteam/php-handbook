# 3.1 Пространства имён (Namespaces)

## Краткое резюме

> **Namespaces** — способ организации кода в логические группы, избегая конфликтов имён.
>
> **Основное:** `namespace App\Models;`, `use App\Models\User;`, `use ... as Alias;`, группировка `use App\Models\{User, Post}`.
>
> **PSR-4:** Namespace соответствует структуре папок. `App\\Models\\User` → `app/Models/User.php`.

---

## Содержание

- [Что такое namespace](#что-такое-namespace)
- [Объявление namespace](#объявление-namespace)
- [use, as, группировка](#use-as-группировка)
- [Глобальный namespace](#глобальный-namespace)
- [namespace и автозагрузка (PSR-4)](#namespace-и-автозагрузка-psr-4)
- [__NAMESPACE__ константа](#__namespace__-константа)
- [namespace_alias для функций и констант](#namespace_alias-use-для-функций-и-констант)
- [Резюме namespace](#резюме-namespace)
- [Практические задания](#практические-задания)

---

## Что такое namespace

**Что это:**
Способ организации кода в логические группы, избегая конфликтов имён.

**Как работает:**
```php
// File: app/Models/User.php
namespace App\Models;

class User
{
    public string $name;
}

// File: app/Services/User.php
namespace App\Services;

class User  // Не конфликтует с App\Models\User
{
    public function process(): void {}
}

// Использование
use App\Models\User as ModelUser;
use App\Services\User as ServiceUser;

$model = new ModelUser();
$service = new ServiceUser();

// Или полное имя (Fully Qualified Name)
$model = new \App\Models\User();
$service = new \App\Services\User();
```

**Когда использовать:**
**Всегда** в современном PHP (PSR-4). Организация кода, избежание конфликтов имён.

**Пример из практики:**
```php
// Laravel структура
namespace App\Http\Controllers;

use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private UserService $service,
    ) {}

    public function index(Request $request)
    {
        $users = User::all();
        return view('users.index', compact('users'));
    }
}

// Composer автозагрузка (composer.json)
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Seeders\\": "database/seeders/"
        }
    }
}
```

**На собеседовании скажешь:**
> "Namespace организует код в логические группы, избегая конфликтов имён. В Laravel: App\Models, App\Http\Controllers. PSR-4 автозагрузка связывает namespace с директорией."

---

## Объявление namespace

**Что это:**
Указание namespace в начале файла.

**Как работает:**
```php
<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserService
{
    public function create(array $data): User
    {
        return DB::transaction(function () use ($data) {
            return User::create($data);
        });
    }
}

// Вложенные namespace
namespace App\Services\Payment;

class StripeService {}

namespace App\Services\Notification;

class EmailService {}

// Или через фигурные скобки (редко используется)
namespace App\Services {
    class UserService {}
}

namespace App\Repositories {
    class UserRepository {}
}
```

**Когда использовать:**
Один namespace на файл (первая строка после `<?php`).

**Пример из практики:**
```php
// app/Services/Order/OrderService.php
<?php

declare(strict_types=1);

namespace App\Services\Order;

use App\Models\Order;
use App\Repositories\OrderRepository;
use App\Services\Payment\PaymentGateway;

class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private PaymentGateway $gateway,
    ) {}

    public function create(array $data): Order
    {
        $order = $this->repository->create($data);
        $this->gateway->charge($order->amount);

        return $order;
    }
}

// Использование
use App\Services\Order\OrderService;

$service = app(OrderService::class);
```

**На собеседовании скажешь:**
> "Объявление namespace — первая строка после <?php. Один namespace на файл. Вложенные namespace через \\ (App\\Services\\Order). Laravel следует PSR-4: namespace соответствует структуре папок."

---

## use, as, группировка

**Что это:**
Импорт классов из других namespace.

**Как работает:**
```php
namespace App\Http\Controllers;

// Импорт класса
use App\Models\User;
use App\Services\UserService;

// Алиас (если конфликт имён)
use App\Models\Post as PostModel;
use App\Services\Post as PostService;

// Группировка (PHP 7.0+)
use App\Models\{User, Post, Comment};
use App\Services\{
    UserService,
    PostService,
    CommentService
};

// Функции и константы (PHP 5.6+)
use function App\Helpers\format_price;
use const App\Constants\MAX_ITEMS;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();  // Без \App\Models\
        $service = new UserService();

        $price = format_price(1000);  // Функция
        $limit = MAX_ITEMS;  // Константа

        return view('users.index', compact('users'));
    }
}

// Без use (полное имя)
$user = new \App\Models\User();
```

**Когда использовать:**
`use` для всех классов из других namespace. Группировка для импорта из одного namespace.

**Пример из практики:**
```php
// Controller с множественными импортами
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\{
    StorePostRequest,
    UpdatePostRequest
};
use App\Http\Resources\{
    PostResource,
    PostCollection
};
use App\Models\Post;
use App\Services\PostService;
use Illuminate\Http\{JsonResponse, Request};

class PostController extends Controller
{
    public function __construct(
        private PostService $service,
    ) {}

    public function index(): PostCollection
    {
        $posts = Post::paginate(20);
        return new PostCollection($posts);
    }

    public function store(StorePostRequest $request): JsonResponse
    {
        $post = $this->service->create($request->validated());
        return response()->json(new PostResource($post), 201);
    }
}

// Helper functions
namespace App\Helpers;

function format_price(int $cents): string
{
    return number_format($cents / 100, 2);
}

// Использование
use function App\Helpers\format_price;

echo format_price(199900);  // "1999.00"
```

**На собеседовании скажешь:**
> "use импортирует классы из других namespace. as создаёт алиас при конфликте. Группировка use App\Models\{User, Post} для импорта из одного namespace. Можно импортировать функции (use function) и константы (use const)."

---

## Глобальный namespace

**Что это:**
Классы без namespace (встроенные PHP классы, legacy код).

**Как работает:**
```php
namespace App\Services;

// PDO — встроенный класс в глобальном namespace
$pdo = new \PDO('mysql:host=localhost', 'user', 'pass');

// Без \ — ищет в текущем namespace
$pdo = new PDO();  // ❌ Class 'App\Services\PDO' not found

// Встроенные классы PHP
$date = new \DateTime();
$exception = new \Exception('Error');
$reflection = new \ReflectionClass(User::class);

// Legacy класс без namespace
class LegacyClass {}

// Использование
$legacy = new \LegacyClass();  // Из глобального namespace
```

**Когда использовать:**
Всегда ставь `\` перед встроенными классами PHP (DateTime, Exception, PDO) внутри namespace.

**Пример из практики:**
```php
namespace App\Services;

use App\Models\User;

class UserService
{
    public function create(array $data): User
    {
        try {
            // \DateTime — встроенный класс
            $now = new \DateTime();

            $user = User::create([
                ...$data,
                'created_at' => $now,
            ]);

            return $user;
        } catch (\Exception $e) {  // \Exception — встроенный
            throw new \RuntimeException('User creation failed', 0, $e);
        }
    }

    public function validate(string $email): bool
    {
        // filter_var — встроенная функция
        return filter_var($email, \FILTER_VALIDATE_EMAIL) !== false;
    }
}

// Или импортируй
namespace App\Services;

use DateTime;
use Exception;
use RuntimeException;

class UserService
{
    public function create(array $data): User
    {
        try {
            $now = new DateTime();  // Без \
            // ...
        } catch (Exception $e) {
            throw new RuntimeException('Failed', 0, $e);
        }
    }
}
```

**На собеседовании скажешь:**
> "Глобальный namespace — для встроенных PHP классов (DateTime, Exception, PDO). Внутри namespace нужен \\ перед глобальными классами или use. Константы PHP (FILTER_VALIDATE_EMAIL) тоже в глобальном namespace."

---

## namespace и автозагрузка (PSR-4)

**Что это:**
Стандарт связи namespace с структурой папок.

**Как работает:**
```php
// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Seeders\\": "database/seeders/",
            "Tests\\": "tests/"
        }
    }
}

// Структура:
// app/
//   Models/
//     User.php        → namespace App\Models; class User
//   Services/
//     UserService.php → namespace App\Services; class UserService
//   Http/
//     Controllers/
//       UserController.php → namespace App\Http\Controllers; class UserController

// Автозагрузка:
// new App\Models\User()         → app/Models/User.php
// new App\Services\UserService() → app/Services/UserService.php

// После изменения composer.json
composer dump-autoload
```

**Когда использовать:**
**Всегда** следуй PSR-4. Namespace = структура папок.

**Пример из практики:**
```php
// Laravel структура (PSR-4)
app/
  Http/
    Controllers/
      Api/
        PostController.php  → namespace App\Http\Controllers\Api;
    Middleware/
      Authenticate.php      → namespace App\Http\Middleware;
    Requests/
      StorePostRequest.php  → namespace App\Http\Requests;
  Models/
    User.php               → namespace App\Models;
    Post.php               → namespace App\Models;
  Services/
    Order/
      OrderService.php     → namespace App\Services\Order;

// Composer автоматически загружает по namespace
use App\Http\Controllers\Api\PostController;
use App\Services\Order\OrderService;

// Не нужно require/include
$controller = new PostController();
$service = new OrderService();

// Кастомный namespace
// composer.json
{
    "autoload": {
        "psr-4": {
            "MyApp\\": "src/",
            "MyApp\\Tests\\": "tests/"
        }
    }
}

// src/Services/Payment.php
namespace MyApp\Services;

class Payment {}

// Использование
use MyApp\Services\Payment;
$payment = new Payment();
```

**На собеседовании скажешь:**
> "PSR-4 связывает namespace со структурой папок. Composer автоматически загружает классы. App\\ → app/, namespace App\\Models\\User → файл app/Models/User.php. После изменения composer.json делаю composer dump-autoload."

---

## __NAMESPACE__ константа

**Что это:**
Магическая константа, возвращающая текущий namespace.

**Как работает:**
```php
namespace App\Services;

class UserService
{
    public function getCurrentNamespace(): string
    {
        return __NAMESPACE__;  // "App\Services"
    }

    public function getFullClassName(): string
    {
        return __NAMESPACE__ . '\\UserService';  // "App\Services\UserService"
    }
}

// Динамическое создание класса
namespace App\Services;

function createService(string $name): object
{
    $class = __NAMESPACE__ . '\\' . $name;  // "App\Services\UserService"
    return new $class();
}

$service = createService('UserService');
```

**Когда использовать:**
Для динамического создания классов, метапрограммирования.

**Пример из практики:**
```php
// Фабрика сервисов
namespace App\Services;

class ServiceFactory
{
    public function make(string $serviceName): object
    {
        $class = __NAMESPACE__ . '\\' . $serviceName;

        if (!class_exists($class)) {
            throw new \RuntimeException("Service {$serviceName} not found");
        }

        return app($class);  // Создать через контейнер
    }
}

$factory = new ServiceFactory();
$userService = $factory->make('UserService');
$orderService = $factory->make('OrderService');

// Helper для создания DTO
namespace App\DTO;

function make(string $dtoName, array $data): object
{
    $class = __NAMESPACE__ . '\\' . $dtoName;
    return new $class(...$data);
}

$dto = make('CreateUserDTO', ['name' => 'Иван', 'email' => 'ivan@mail.com']);

// Логирование с namespace
namespace App\Services\Payment;

use Illuminate\Support\Facades\Log;

class StripeService
{
    public function charge(int $amount): bool
    {
        Log::info(__NAMESPACE__ . ': Charging', ['amount' => $amount]);
        // [App\Services\Payment: Charging]

        return true;
    }
}
```

**На собеседовании скажешь:**
> "__NAMESPACE__ возвращает текущий namespace. Использую для динамического создания классов, фабрик, логирования. __NAMESPACE__ . '\\\\' . $className создаёт полное имя класса."

---

## namespace_alias (use) для функций и констант

**Что это:**
Импорт функций и констант из других namespace.

**Как работает:**
```php
// Файл с функциями
namespace App\Helpers;

function format_price(int $cents): string
{
    return number_format($cents / 100, 2, '.', ' ');
}

function truncate(string $text, int $length): string
{
    return mb_substr($text, 0, $length) . '...';
}

// Файл с константами
namespace App\Constants;

const MAX_UPLOAD_SIZE = 10485760;  // 10MB
const ALLOWED_EXTENSIONS = ['jpg', 'png', 'pdf'];

// Использование
namespace App\Http\Controllers;

use function App\Helpers\{format_price, truncate};
use const App\Constants\{MAX_UPLOAD_SIZE, ALLOWED_EXTENSIONS};

class ProductController extends Controller
{
    public function index()
    {
        $price = format_price(199900);  // "1 999.00"
        $description = truncate('Long text...', 100);

        $maxSize = MAX_UPLOAD_SIZE;  // 10485760
        $extensions = ALLOWED_EXTENSIONS;  // ['jpg', 'png', 'pdf']

        return view('products.index', compact('price', 'description'));
    }
}

// Без use (полное имя)
$price = \App\Helpers\format_price(199900);
$maxSize = \App\Constants\MAX_UPLOAD_SIZE;
```

**Когда использовать:**
Для переиспользования функций и констант между namespace.

**Пример из практики:**
```php
// app/Helpers/helpers.php
namespace App\Helpers;

function array_get(array $array, string $key, mixed $default = null): mixed
{
    return $array[$key] ?? $default;
}

function str_limit(string $value, int $limit = 100): string
{
    return mb_substr($value, 0, $limit) . '...';
}

// composer.json (автозагрузка файлов с функциями)
{
    "autoload": {
        "files": [
            "app/Helpers/helpers.php"
        ]
    }
}

// Использование
namespace App\Services;

use function App\Helpers\{array_get, str_limit};

class DataService
{
    public function process(array $data): array
    {
        $name = array_get($data, 'name', 'Unknown');
        $description = str_limit($data['description'] ?? '', 200);

        return compact('name', 'description');
    }
}

// Laravel helpers (уже есть в глобальном namespace)
// Не нужен use
$user = auth()->user();
$path = storage_path('app/files');
$config = config('app.name');
```

**На собеседовании скажешь:**
> "use function импортирует функции, use const — константы из других namespace. Группировка: use function App\\Helpers\\{fn1, fn2}. Laravel helpers в глобальном namespace (auth(), config())."

---

## Резюме namespace

**Основное:**
- `namespace App\Services;` — объявление namespace
- `use App\Models\User;` — импорт класса
- `use App\Models\User as ModelUser;` — алиас
- `use App\Models\{User, Post};` — группировка
- `use function`, `use const` — импорт функций и констант
- `\DateTime` — глобальный namespace (встроенные классы)
- `__NAMESPACE__` — текущий namespace

**PSR-4:**
- Namespace = структура папок
- `App\\Models\\User` → `app/Models/User.php`
- `composer dump-autoload` после изменений

**Важно на собесе:**
- Один namespace на файл (первая строка)
- Всегда use для классов из других namespace
- `\\` перед встроенными классами (DateTime, Exception) в namespace
- PSR-4: namespace соответствует папкам
- Laravel: App\\, Database\\, Tests\\
- Группировка use для импорта из одного namespace

---

## Практические задания

### Задание 1: Создай структуру классов с namespace

Создай классы `User`, `Post`, `Comment` в namespace `App\Models`. Создай сервисы `UserService`, `PostService` в namespace `App\Services`. Правильно импортируй зависимости.

<details>
<summary>Решение</summary>

```php
// app/Models/User.php
<?php

declare(strict_types=1);

namespace App\Models;

class User
{
    public function __construct(
        public string $name,
        public string $email,
    ) {}
}

// app/Models/Post.php
<?php

declare(strict_types=1);

namespace App\Models;

class Post
{
    public function __construct(
        public string $title,
        public User $author,
    ) {}
}

// app/Services/UserService.php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;

class UserService
{
    public function create(string $name, string $email): User
    {
        return new User($name, $email);
    }
}

// app/Services/PostService.php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\{Post, User};

class PostService
{
    public function __construct(
        private UserService $userService,
    ) {}

    public function createPost(string $title, string $authorEmail): Post
    {
        $author = $this->userService->create('Author', $authorEmail);
        return new Post($title, $author);
    }
}
```

**composer.json:**
```json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        }
    }
}
```

После изменений:
```bash
composer dump-autoload
```
</details>

### Задание 2: Исправь конфликт имён

Есть два класса `User`: `App\Models\User` и `App\DTO\User`. Используй оба в одном файле без конфликтов.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Services;

use App\Models\User as UserModel;
use App\DTO\User as UserDTO;

class UserService
{
    public function create(UserDTO $dto): UserModel
    {
        $model = new UserModel();
        $model->name = $dto->name;
        $model->email = $dto->email;
        $model->save();

        return $model;
    }

    public function toDTO(UserModel $user): UserDTO
    {
        return new UserDTO(
            name: $user->name,
            email: $user->email,
        );
    }
}

// Использование
$dto = new UserDTO('Иван', 'ivan@mail.com');
$service = new UserService();
$user = $service->create($dto);  // UserModel
$backToDto = $service->toDTO($user);  // UserDTO
```
</details>

### Задание 3: Создай helper функции с namespace

Создай файл `app/Helpers/helpers.php` с функциями `format_price()` и `str_limit()` в namespace `App\Helpers`. Настрой автозагрузку.

<details>
<summary>Решение</summary>

```php
// app/Helpers/helpers.php
<?php

namespace App\Helpers;

function format_price(int $cents): string
{
    return number_format($cents / 100, 2, '.', ' ') . ' ₽';
}

function str_limit(string $text, int $length): string
{
    if (mb_strlen($text) <= $length) {
        return $text;
    }

    return mb_substr($text, 0, $length) . '...';
}

// composer.json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        },
        "files": [
            "app/Helpers/helpers.php"
        ]
    }
}

// Использование
namespace App\Services;

use function App\Helpers\{format_price, str_limit};

class ProductService
{
    public function getFormattedPrice(int $price): string
    {
        return format_price($price);  // "19 999.00 ₽"
    }

    public function getShortDescription(string $description): string
    {
        return str_limit($description, 100);
    }
}

// После изменений
// composer dump-autoload
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
