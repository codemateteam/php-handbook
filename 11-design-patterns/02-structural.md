# 11.2 Структурные паттерны (Structural Patterns)

## Краткое резюме

> **Structural Patterns** — паттерны для композиции классов и объектов в более крупные структуры.
>
> **Основные:** Adapter (адаптация интерфейсов), Decorator (добавление поведения), Facade (упрощение API), Proxy (контроль доступа), Composite (древовидные структуры).
>
> **Laravel примеры:** Cache drivers (Adapter), Middleware (Decorator), Facades (Facade), Eloquent relations (Proxy).

---

## Содержание

- [Что это](#что-это)
- [Adapter](#1-adapter-адаптер)
- [Decorator](#2-decorator-декоратор)
- [Facade](#3-facade-фасад)
- [Proxy](#4-proxy-прокси)
- [Composite](#5-composite-компоновщик)
- [Сравнение](#сравнение)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Structural Patterns:**
Паттерны для композиции классов и объектов в более крупные структуры.

**Зачем:**
- Упростить сложные структуры
- Адаптировать интерфейсы
- Добавить функциональность без изменения кода

**Основные паттерны:**
1. Adapter
2. Decorator
3. Facade
4. Proxy
5. Composite
6. Bridge
7. Flyweight

---

## 1. Adapter (Адаптер)

**Что это:**
Преобразует интерфейс класса в другой интерфейс, который ожидает клиент.

**Когда использовать:**
- Интеграция legacy кода
- Использование сторонних библиотек с несовместимым API

**Проблема:**

```php
// Наш интерфейс
interface PaymentGateway
{
    public function charge(int $amount): Payment;
}

// Сторонняя библиотека Stripe
class StripeClient
{
    public function createCharge(array $params): array
    {
        // Stripe API call
        return ['id' => 'ch_123', 'status' => 'succeeded'];
    }
}

// Несовместимые интерфейсы!
```

**Решение: Adapter**

```php
class StripeAdapter implements PaymentGateway
{
    public function __construct(
        private StripeClient $stripe
    ) {}

    public function charge(int $amount): Payment
    {
        // Адаптируем: наш интерфейс → Stripe API
        $result = $this->stripe->createCharge([
            'amount' => $amount * 100,  // cents
            'currency' => 'usd',
        ]);

        return new Payment(
            id: $result['id'],
            status: $result['status'],
            amount: $amount
        );
    }
}

// Использование
$stripe = new StripeClient();
$gateway = new StripeAdapter($stripe);

$payment = $gateway->charge(100);  // Единый интерфейс
```

**Laravel Cache Adapter:**

```php
// Laravel Cache адаптирует разные драйверы к единому интерфейсу
Cache::store('redis')->put('key', 'value', 3600);
Cache::store('memcached')->put('key', 'value', 3600);
Cache::store('file')->put('key', 'value', 3600);

// Один интерфейс, разные реализации
```

---

## 2. Decorator (Декоратор)

**Что это:**
Динамически добавляет объекту новую функциональность без изменения его структуры.

**Когда использовать:**
- Добавить поведение динамически
- Избежать наследования (composition over inheritance)
- Множество комбинаций функциональности

**Проблема без Decorator:**

```php
// Плохо: класс для каждой комбинации
class SimpleCoffee {}
class CoffeeWithMilk {}
class CoffeeWithSugar {}
class CoffeeWithMilkAndSugar {}
class CoffeeWithMilkAndSugarAndCaramel {}
// Комбинаторный взрыв!
```

**Решение: Decorator**

```php
interface Coffee
{
    public function getCost(): float;
    public function getDescription(): string;
}

class SimpleCoffee implements Coffee
{
    public function getCost(): float
    {
        return 10;
    }

    public function getDescription(): string
    {
        return 'Simple coffee';
    }
}

abstract class CoffeeDecorator implements Coffee
{
    public function __construct(
        protected Coffee $coffee
    ) {}
}

class MilkDecorator extends CoffeeDecorator
{
    public function getCost(): float
    {
        return $this->coffee->getCost() + 2;
    }

    public function getDescription(): string
    {
        return $this->coffee->getDescription() . ', milk';
    }
}

class SugarDecorator extends CoffeeDecorator
{
    public function getCost(): float
    {
        return $this->coffee->getCost() + 1;
    }

    public function getDescription(): string
    {
        return $this->coffee->getDescription() . ', sugar';
    }
}

// Использование: композиция декораторов
$coffee = new SimpleCoffee();
$coffee = new MilkDecorator($coffee);
$coffee = new SugarDecorator($coffee);

echo $coffee->getDescription();  // "Simple coffee, milk, sugar"
echo $coffee->getCost();  // 13
```

**Laravel Middleware = Decorator Pattern:**

```php
// Middleware декорирует Request/Response
class AuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        // Before logic
        if (!auth()->check()) {
            return redirect('/login');
        }

        $response = $next($request);  // Декорируемый объект

        // After logic
        $response->header('X-Authenticated', 'true');

        return $response;
    }
}

// Route с декораторами
Route::middleware(['auth', 'verified', 'throttle:60,1'])
    ->get('/dashboard', [DashboardController::class, 'index']);
```

---

## 3. Facade (Фасад)

**Что это:**
Предоставляет упрощённый интерфейс к сложной подсистеме.

**Когда использовать:**
- Сложная подсистема с множеством классов
- Нужен простой API для клиентов

**Проблема без Facade:**

```php
// Клиент должен знать о всех классах
$socket = new Socket();
$socket->connect('smtp.example.com', 587);

$connection = new SmtpConnection($socket);
$connection->authenticate('user', 'pass');

$message = new EmailMessage();
$message->setFrom('from@example.com');
$message->setTo('to@example.com');
$message->setSubject('Hello');
$message->setBody('World');

$sender = new EmailSender($connection);
$sender->send($message);

$connection->close();
$socket->disconnect();

// Слишком сложно!
```

**Решение: Facade**

```php
class EmailFacade
{
    public static function send(string $to, string $subject, string $body): void
    {
        // Скрываем сложность
        $socket = new Socket();
        $socket->connect(config('mail.host'), config('mail.port'));

        $connection = new SmtpConnection($socket);
        $connection->authenticate(config('mail.username'), config('mail.password'));

        $message = new EmailMessage();
        $message->setFrom(config('mail.from'));
        $message->setTo($to);
        $message->setSubject($subject);
        $message->setBody($body);

        $sender = new EmailSender($connection);
        $sender->send($message);

        $connection->close();
        $socket->disconnect();
    }
}

// Использование: просто!
EmailFacade::send('to@example.com', 'Hello', 'World');
```

**Laravel Facades:**

```php
// Laravel Facade = Facade Pattern
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

// Простой API к сложным подсистемам
Cache::put('key', 'value', 3600);
DB::table('users')->where('active', true)->get();

// Под капотом:
Cache::put() → CacheManager → Repository → Store (Redis/Memcached/File)
```

---

## 4. Proxy (Прокси)

**Что это:**
Предоставляет объект-заменитель который контролирует доступ к другому объекту.

**Типы Proxy:**
- **Virtual Proxy** — lazy loading
- **Protection Proxy** — access control
- **Remote Proxy** — удалённый объект
- **Caching Proxy** — кэш результатов

**Virtual Proxy (Lazy Loading):**

```php
interface Image
{
    public function render(): string;
}

class RealImage implements Image
{
    private string $data;

    public function __construct(private string $filename)
    {
        // Дорогая операция
        $this->loadFromDisk();
    }

    private function loadFromDisk(): void
    {
        echo "Loading image: {$this->filename}\n";
        sleep(2);  // Simulate heavy operation
        $this->data = file_get_contents($this->filename);
    }

    public function render(): string
    {
        return $this->data;
    }
}

class ImageProxy implements Image
{
    private ?RealImage $realImage = null;

    public function __construct(private string $filename) {}

    public function render(): string
    {
        // Lazy loading: загрузить только когда нужно
        if ($this->realImage === null) {
            $this->realImage = new RealImage($this->filename);
        }

        return $this->realImage->render();
    }
}

// Использование
$image = new ImageProxy('large.jpg');
// Image НЕ загружен

// ... много кода ...

echo $image->render();  // Загрузится ЗДЕСЬ
```

**Protection Proxy (Access Control):**

```php
interface Document
{
    public function read(): string;
    public function write(string $content): void;
}

class RealDocument implements Document
{
    private string $content = '';

    public function read(): string
    {
        return $this->content;
    }

    public function write(string $content): void
    {
        $this->content = $content;
    }
}

class ProtectedDocumentProxy implements Document
{
    public function __construct(
        private RealDocument $document,
        private User $user
    ) {}

    public function read(): string
    {
        // Access control
        if (!$this->user->hasPermission('read')) {
            throw new AccessDeniedException();
        }

        return $this->document->read();
    }

    public function write(string $content): void
    {
        // Access control
        if (!$this->user->hasPermission('write')) {
            throw new AccessDeniedException();
        }

        $this->document->write($content);
    }
}
```

**Laravel Eloquent Lazy Loading = Virtual Proxy:**

```php
$user = User::find(1);

// posts НЕ загружены (proxy)
$user->posts;  // Загрузятся ЗДЕСЬ (lazy loading)
```

---

## 5. Composite (Компоновщик)

**Что это:**
Компонует объекты в древовидные структуры. Клиент работает с единичными объектами и композициями одинаково.

**Когда использовать:**
- Древовидная структура (меню, файловая система)
- Клиент должен работать с объектами и группами одинаково

**Пример: Menu Structure**

```php
interface MenuComponent
{
    public function render(): string;
}

class MenuItem implements MenuComponent
{
    public function __construct(
        private string $name,
        private string $url
    ) {}

    public function render(): string
    {
        return "<li><a href='{$this->url}'>{$this->name}</a></li>";
    }
}

class MenuComposite implements MenuComponent
{
    private array $children = [];

    public function __construct(private string $name) {}

    public function add(MenuComponent $component): void
    {
        $this->children[] = $component;
    }

    public function render(): string
    {
        $html = "<li>{$this->name}<ul>";

        foreach ($this->children as $child) {
            $html .= $child->render();  // Рекурсия
        }

        $html .= "</ul></li>";

        return $html;
    }
}

// Использование
$menu = new MenuComposite('Menu');

$menu->add(new MenuItem('Home', '/'));
$menu->add(new MenuItem('About', '/about'));

$products = new MenuComposite('Products');
$products->add(new MenuItem('Laptops', '/products/laptops'));
$products->add(new MenuItem('Phones', '/products/phones'));

$menu->add($products);

echo $menu->render();
```

---

## Сравнение

| Pattern | Use Case | Laravel Example |
|---------|----------|-----------------|
| Adapter | Адаптация интерфейсов | Cache drivers |
| Decorator | Добавить поведение | Middleware |
| Facade | Упростить API | Laravel Facades |
| Proxy | Контроль доступа, lazy loading | Eloquent relations |
| Composite | Древовидные структуры | Menu, categories |

---

## На собеседовании скажешь

> "Structural Patterns для композиции объектов. Adapter: адаптация несовместимых интерфейсов, Laravel Cache адаптирует разные драйверы. Decorator: динамически добавить поведение, Middleware пример (composition over inheritance). Facade: упрощённый API к сложной подсистеме, Laravel Facades. Proxy: контроль доступа или lazy loading, Eloquent relations lazy loading. Composite: древовидные структуры (меню, категории). Decorator и Facade наиболее популярны в Laravel. Middleware = Decorator, Facades = Facade."

---

## Практические задания

### Задание 1: Реализуй Adapter

У тебя есть старый `LegacyLogger` с методом `writeLog($message)` и новый интерфейс `Logger` с методом `log($level, $message)`. Создай адаптер.

<details>
<summary>Решение</summary>

```php
// Новый интерфейс
interface Logger
{
    public function log(string $level, string $message): void;
}

// Старый класс (нельзя изменить)
class LegacyLogger
{
    public function writeLog(string $message): void
    {
        file_put_contents('app.log', $message . PHP_EOL, FILE_APPEND);
    }
}

// Adapter
class LegacyLoggerAdapter implements Logger
{
    public function __construct(
        private LegacyLogger $legacyLogger
    ) {}

    public function log(string $level, string $message): void
    {
        $formattedMessage = "[{$level}] {$message}";
        $this->legacyLogger->writeLog($formattedMessage);
    }
}

// Использование
$legacy = new LegacyLogger();
$logger = new LegacyLoggerAdapter($legacy);

$logger->log('ERROR', 'Something went wrong');  // Работает!
```
</details>

### Задание 2: Реализуй Decorator для кэширования

Создай `CachedRepository` который декорирует `UserRepository` добавляя кэширование для метода `find()`.

<details>
<summary>Решение</summary>

```php
interface UserRepository
{
    public function find(int $id): ?User;
    public function save(User $user): void;
}

class DatabaseUserRepository implements UserRepository
{
    public function find(int $id): ?User
    {
        // DB query
        return User::find($id);
    }

    public function save(User $user): void
    {
        $user->save();
    }
}

class CachedUserRepository implements UserRepository
{
    public function __construct(
        private UserRepository $repository,
        private CacheInterface $cache
    ) {}

    public function find(int $id): ?User
    {
        $key = "user:{$id}";

        return $this->cache->remember($key, 3600, function () use ($id) {
            return $this->repository->find($id);
        });
    }

    public function save(User $user): void
    {
        $this->repository->save($user);

        // Инвалидация кэша
        $this->cache->forget("user:{$user->id}");
    }
}

// Использование
$repository = new DatabaseUserRepository();
$cachedRepository = new CachedUserRepository($repository, $cache);

$user = $cachedRepository->find(1);  // DB query
$user = $cachedRepository->find(1);  // Cache hit!
```
</details>

### Задание 3: В чём разница между Adapter и Facade?

Объясни разницу и приведи примеры когда что использовать.

<details>
<summary>Решение</summary>

| Аспект | Adapter | Facade |
|--------|---------|---------|
| **Назначение** | Преобразовать интерфейс | Упростить интерфейс |
| **Количество классов** | Обычно 1 класс | Обычно много классов |
| **Изменение интерфейса** | Да, адаптирует | Нет, упрощает существующий |
| **Когда использовать** | Интеграция несовместимого кода | Сложная подсистема |

**Adapter - когда интерфейсы несовместимы:**
```php
// Stripe API: createCharge(array $params)
// Наш API: charge(int $amount)
class StripeAdapter implements PaymentGateway
{
    public function charge(int $amount): Payment
    {
        $result = $this->stripe->createCharge(['amount' => $amount * 100]);
        return new Payment($result['id'], $result['status']);
    }
}
```

**Facade - когда подсистема сложная:**
```php
// Вместо работы с Socket, SmtpConnection, EmailMessage, EmailSender
// Простой API:
class EmailFacade
{
    public static function send(string $to, string $subject, string $body): void
    {
        // Скрываем всю сложность
    }
}

EmailFacade::send('to@example.com', 'Hello', 'World');
```

**Ключевое отличие:**
- Adapter преобразует один интерфейс в другой
- Facade предоставляет простой API к сложной системе
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
