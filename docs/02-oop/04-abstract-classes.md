# 2.4 Абстрактные классы

## Краткое резюме

> **Абстрактный класс** — класс, который нельзя создать напрямую, только наследовать. Может содержать как обычные методы (с реализацией), так и абстрактные (без).
>
> **Ключевые концепции:** abstract методы (наследники обязаны реализовать), Template Method Pattern, комбинация с интерфейсами.
>
> **Важно:** Абстрактный класс для общей логики (КАК делать), интерфейс для контракта (ЧТО делать). Можно комбинировать: интерфейс + abstract класс.

---

## Содержание

- [Что такое абстрактный класс](#что-такое-абстрактный-класс)
- [Абстрактные методы](#абстрактные-методы)
- [Абстрактный класс vs Интерфейс](#абстрактный-класс-vs-интерфейс)
- [protected в абстрактных классах](#protected-в-абстрактных-классах)
- [Template Method Pattern](#template-method-pattern)
- [Резюме](#резюме-абстрактных-классов)
- [Практические задания](#практические-задания)

---

## Что такое абстрактный класс

**Что это:**
Класс, который нельзя создать напрямую (только наследовать). Может содержать как обычные методы (с реализацией), так и абстрактные (без реализации).

**Как работает:**
```php
abstract class Animal
{
    protected string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    // Обычный метод (с реализацией)
    public function eat(): string
    {
        return "{$this->name} ест";
    }

    // Абстрактный метод (БЕЗ реализации)
    abstract public function makeSound(): string;
}

class Dog extends Animal
{
    // ОБЯЗАТЕЛЬНО реализовать абстрактный метод
    public function makeSound(): string
    {
        return "{$this->name} лает: Гав!";
    }
}

class Cat extends Animal
{
    public function makeSound(): string
    {
        return "{$this->name} мяукает: Мяу!";
    }
}

// $animal = new Animal('Животное');  // ❌ Cannot instantiate abstract class

$dog = new Dog('Шарик');
echo $dog->eat();        // "Шарик ест" (унаследовано)
echo $dog->makeSound();  // "Шарик лает: Гав!" (реализовано в Dog)

$cat = new Cat('Мурка');
echo $cat->makeSound();  // "Мурка мяукает: Мяу!"
```

**Когда использовать:**
Когда есть общая логика для группы классов, но часть методов должна быть реализована в наследниках.

**Пример из практики:**
```php
// Базовый репозиторий
abstract class BaseRepository
{
    protected Model $model;

    public function __construct(Model $model)
    {
        $this->model = $model;
    }

    // Общие методы (с реализацией)
    public function find(int $id): ?Model
    {
        return $this->model->find($id);
    }

    public function all(): Collection
    {
        return $this->model->all();
    }

    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    // Абстрактные методы (каждый репозиторий реализует сам)
    abstract public function findByCustomCriteria(array $criteria): Collection;
}

class UserRepository extends BaseRepository
{
    public function __construct()
    {
        parent::__construct(new User());
    }

    public function findByCustomCriteria(array $criteria): Collection
    {
        $query = $this->model->query();

        if (isset($criteria['department_id'])) {
            $query->where('department_id', $criteria['department_id']);
        }

        if (isset($criteria['is_active'])) {
            $query->where('is_active', $criteria['is_active']);
        }

        return $query->get();
    }
}

// Использование
$repository = new UserRepository();
$user = $repository->find(1);  // Унаследованный метод
$users = $repository->findByCustomCriteria(['is_active' => true]);
```

**На собеседовании скажешь:**
> "Абстрактный класс нельзя создать напрямую, только наследовать. Может содержать обычные методы (с реализацией) и abstract методы (без). Наследники обязаны реализовать все abstract методы. Использую для базовых классов с общей логикой."

---

## Абстрактные методы

**Что это:**
Методы без реализации (только объявление). Наследники **обязаны** реализовать.

**Как работает:**
```php
abstract class Shape
{
    protected string $color;

    public function __construct(string $color)
    {
        $this->color = $color;
    }

    // Обычный метод
    public function getColor(): string
    {
        return $this->color;
    }

    // Абстрактные методы (БЕЗ реализации)
    abstract public function calculateArea(): float;
    abstract public function calculatePerimeter(): float;
}

class Circle extends Shape
{
    private float $radius;

    public function __construct(string $color, float $radius)
    {
        parent::__construct($color);
        $this->radius = $radius;
    }

    // ОБЯЗАТЕЛЬНО реализовать
    public function calculateArea(): float
    {
        return pi() * $this->radius ** 2;
    }

    public function calculatePerimeter(): float
    {
        return 2 * pi() * $this->radius;
    }
}

class Rectangle extends Shape
{
    private float $width;
    private float $height;

    public function __construct(string $color, float $width, float $height)
    {
        parent::__construct($color);
        $this->width = $width;
        $this->height = $height;
    }

    public function calculateArea(): float
    {
        return $this->width * $this->height;
    }

    public function calculatePerimeter(): float
    {
        return 2 * ($this->width + $this->height);
    }
}

// Полиморфизм
function printShapeInfo(Shape $shape): void
{
    echo "Цвет: {$shape->getColor()}\n";
    echo "Площадь: {$shape->calculateArea()}\n";
    echo "Периметр: {$shape->calculatePerimeter()}\n";
}

$circle = new Circle('red', 5);
$rectangle = new Rectangle('blue', 4, 6);

printShapeInfo($circle);
printShapeInfo($rectangle);
```

**Когда использовать:**
Когда алгоритм известен, но реализация зависит от конкретного класса.

**Пример из практики:**
```php
// Payment Gateway
abstract class PaymentGateway
{
    protected string $apiKey;
    protected string $apiUrl;

    public function __construct(string $apiKey, string $apiUrl)
    {
        $this->apiKey = $apiKey;
        $this->apiUrl = $apiUrl;
    }

    // Общая логика (с реализацией)
    protected function logTransaction(string $type, int $amount): void
    {
        Log::info("Payment {$type}: {$amount}", [
            'gateway' => static::class,
        ]);
    }

    public function processPayment(int $amount, string $currency): bool
    {
        $this->logTransaction('charge', $amount);

        try {
            return $this->charge($amount, $currency);
        } catch (\Exception $e) {
            $this->logTransaction('failed', $amount);
            throw $e;
        }
    }

    // Абстрактные методы (каждый gateway реализует сам)
    abstract protected function charge(int $amount, string $currency): bool;
    abstract public function refund(string $transactionId, int $amount): bool;
    abstract public function getBalance(): int;
}

class StripeGateway extends PaymentGateway
{
    protected function charge(int $amount, string $currency): bool
    {
        // Stripe API
        $stripe = new \Stripe\StripeClient($this->apiKey);
        $charge = $stripe->charges->create([
            'amount' => $amount,
            'currency' => $currency,
        ]);

        return $charge->status === 'succeeded';
    }

    public function refund(string $transactionId, int $amount): bool
    {
        // Stripe refund API
        return true;
    }

    public function getBalance(): int
    {
        // Stripe balance API
        return 10000;
    }
}

class PayPalGateway extends PaymentGateway
{
    protected function charge(int $amount, string $currency): bool
    {
        // PayPal API
        return true;
    }

    public function refund(string $transactionId, int $amount): bool
    {
        // PayPal refund API
        return true;
    }

    public function getBalance(): int
    {
        // PayPal balance API
        return 5000;
    }
}

// Dependency Injection
class OrderService
{
    public function __construct(
        private PaymentGateway $gateway,  // Любой gateway
    ) {}

    public function charge(Order $order): bool
    {
        return $this->gateway->processPayment($order->amount, 'RUB');
    }
}
```

**На собеседовании скажешь:**
> "Абстрактные методы — без реализации, только объявление. Наследники обязаны реализовать. Использую для определения "скелета" алгоритма: базовый класс задаёт структуру, наследники реализуют детали."

---

## Абстрактный класс vs Интерфейс

**Сравнение:**

| Абстрактный класс | Интерфейс |
|-------------------|-----------|
| Может содержать реализацию | Только объявление методов |
| Может иметь свойства | Только константы |
| Только одиночное наследование | Можно реализовать несколько |
| Может иметь конструктор | Нет конструктора |
| Методы: public, protected, private | Методы: только public |
| Для общей логики ("КАК") | Для контракта ("ЧТО") |

**Абстрактный класс:**
```php
abstract class PaymentGateway
{
    protected string $apiKey;  // Свойства

    public function __construct(string $apiKey)  // Конструктор
    {
        $this->apiKey = $apiKey;
    }

    // Метод с реализацией
    protected function log(string $message): void
    {
        Log::info($message);
    }

    // Абстрактный метод
    abstract public function charge(int $amount): bool;
}
```

**Интерфейс:**
```php
interface PaymentGatewayInterface
{
    public const STATUS_SUCCESS = 'success';  // Константа

    // Только объявление
    public function charge(int $amount): bool;
    public function refund(string $id): bool;
}
```

**Когда использовать:**
- **Абстрактный класс** — когда есть общая логика для группы классов
- **Интерфейс** — для контракта, полиморфизма, DI

**Можно комбинировать:**
```php
interface PaymentGatewayInterface
{
    public function charge(int $amount): bool;
    public function refund(string $id): bool;
}

abstract class BasePaymentGateway implements PaymentGatewayInterface
{
    protected string $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }

    protected function log(string $message): void
    {
        Log::info($message);
    }

    // Общий метод для всех gateway
    public function processPayment(int $amount): bool
    {
        $this->log("Processing payment: {$amount}");

        try {
            return $this->charge($amount);
        } catch (\Exception $e) {
            $this->log("Payment failed: {$e->getMessage()}");
            return false;
        }
    }

    // Абстрактный метод (каждый gateway реализует сам)
    abstract public function charge(int $amount): bool;
}

class StripeGateway extends BasePaymentGateway
{
    public function charge(int $amount): bool
    {
        // Stripe API
        return true;
    }

    public function refund(string $id): bool
    {
        // Stripe refund
        return true;
    }
}

// DI через интерфейс
function pay(PaymentGatewayInterface $gateway, int $amount): bool
{
    return $gateway->charge($amount);
}

$stripe = new StripeGateway('api_key');
pay($stripe, 1000);
```

**Пример из практики:**
```php
// Laravel Job
interface ShouldQueue  // Интерфейс (контракт)
{
    public function handle(): void;
}

abstract class Job implements ShouldQueue  // Абстрактный класс (общая логика)
{
    public int $tries = 3;
    public int $timeout = 60;

    protected function log(string $message): void
    {
        Log::info($message);
    }

    // Абстрактный метод
    abstract public function handle(): void;
}

class SendEmailJob extends Job
{
    public function __construct(
        private User $user,
        private string $message,
    ) {}

    public function handle(): void
    {
        $this->log("Sending email to {$this->user->email}");
        Mail::to($this->user)->send(new MessageMail($this->message));
    }
}

// Можем использовать как ShouldQueue или Job
dispatch(new SendEmailJob($user, 'Hello'));
```

**На собеседовании скажешь:**
> "Абстрактный класс — для общей логики (КАК), может содержать реализацию. Интерфейс — для контракта (ЧТО), только объявление. Абстрактный класс — один родитель, интерфейсов — много. Часто комбинирую: интерфейс + абстрактный класс."

---

## protected в абстрактных классах

**Что это:**
Абстрактные методы могут быть protected — доступны только наследникам.

**Как работает:**
```php
abstract class BaseController
{
    // protected абстрактный метод
    abstract protected function authorize(): bool;

    public function index()
    {
        if (!$this->authorize()) {
            abort(403);
        }

        return $this->getData();
    }

    // Наследники реализуют этот метод
    abstract protected function getData(): array;
}

class AdminController extends BaseController
{
    protected function authorize(): bool
    {
        return auth()->user()?->isAdmin() ?? false;
    }

    protected function getData(): array
    {
        return ['users' => User::all()];
    }
}

class UserController extends BaseController
{
    protected function authorize(): bool
    {
        return auth()->check();
    }

    protected function getData(): array
    {
        return ['user' => auth()->user()];
    }
}
```

**Когда использовать:**
Для методов, которые используются только внутри иерархии классов.

**Пример из практики:**
```php
// Базовый сервис
abstract class BaseService
{
    protected LoggerInterface $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    // protected — только для наследников
    abstract protected function validate(array $data): bool;
    abstract protected function process(array $data): mixed;

    // public — внешний API
    public function execute(array $data): mixed
    {
        $this->logger->info('Executing service', ['data' => $data]);

        if (!$this->validate($data)) {
            throw new \InvalidArgumentException('Invalid data');
        }

        $result = $this->process($data);

        $this->logger->info('Service completed', ['result' => $result]);

        return $result;
    }
}

class OrderService extends BaseService
{
    protected function validate(array $data): bool
    {
        return isset($data['user_id']) && isset($data['amount']);
    }

    protected function process(array $data): mixed
    {
        return Order::create($data);
    }
}

// Клиент видит только execute()
$service = new OrderService($logger);
$order = $service->execute(['user_id' => 1, 'amount' => 1000]);
```

**На собеседовании скажешь:**
> "Абстрактные методы могут быть protected — доступны только наследникам. Использую для методов, которые — часть внутренней логики иерархии классов. public методы — внешний API, protected — внутренняя реализация."

---

## Template Method Pattern

**Что это:**
Паттерн проектирования: базовый класс определяет алгоритм, наследники реализуют шаги.

**Как работает:**
```php
abstract class DataImporter
{
    // Template method (определяет алгоритм)
    final public function import(string $file): void
    {
        $this->validate($file);
        $data = $this->parse($file);
        $this->transform($data);
        $this->save($data);
        $this->cleanup();
    }

    // Шаги алгоритма (абстрактные)
    abstract protected function validate(string $file): void;
    abstract protected function parse(string $file): array;
    abstract protected function transform(array &$data): void;
    abstract protected function save(array $data): void;

    // Опциональный шаг (с реализацией по умолчанию)
    protected function cleanup(): void
    {
        // По умолчанию ничего не делаем
    }
}

class CsvImporter extends DataImporter
{
    protected function validate(string $file): void
    {
        if (!str_ends_with($file, '.csv')) {
            throw new \InvalidArgumentException('Not a CSV file');
        }
    }

    protected function parse(string $file): array
    {
        $handle = fopen($file, 'r');
        $data = [];

        while (($row = fgetcsv($handle)) !== false) {
            $data[] = $row;
        }

        fclose($handle);
        return $data;
    }

    protected function transform(array &$data): void
    {
        // Преобразование данных CSV
    }

    protected function save(array $data): void
    {
        foreach ($data as $row) {
            User::create($row);
        }
    }

    protected function cleanup(): void
    {
        // Удаление временного файла
        unlink($this->file);
    }
}

class JsonImporter extends DataImporter
{
    protected function validate(string $file): void
    {
        if (!str_ends_with($file, '.json')) {
            throw new \InvalidArgumentException('Not a JSON file');
        }
    }

    protected function parse(string $file): array
    {
        return json_decode(file_get_contents($file), true);
    }

    protected function transform(array &$data): void
    {
        // Преобразование данных JSON
    }

    protected function save(array $data): void
    {
        User::insert($data);
    }
}

// Использование
$importer = new CsvImporter();
$importer->import('users.csv');

$importer = new JsonImporter();
$importer->import('users.json');
```

**Когда использовать:**
Когда есть общий алгоритм с вариативными шагами.

**Пример из практики:**
```php
// Laravel: Middleware pipeline
abstract class BaseMiddleware
{
    final public function handle($request, Closure $next)
    {
        // Шаг 1: Before (перед обработкой)
        $this->before($request);

        // Шаг 2: Основная обработка (можно прервать)
        if (!$this->authorize($request)) {
            return $this->deny($request);
        }

        // Шаг 3: Передача дальше
        $response = $next($request);

        // Шаг 4: After (после обработки)
        $this->after($request, $response);

        return $response;
    }

    // Шаги (абстрактные)
    abstract protected function authorize($request): bool;

    // Опциональные шаги (с реализацией по умолчанию)
    protected function before($request): void {}
    protected function after($request, $response): void {}

    protected function deny($request)
    {
        abort(403);
    }
}

class AdminMiddleware extends BaseMiddleware
{
    protected function authorize($request): bool
    {
        return auth()->user()?->isAdmin() ?? false;
    }

    protected function before($request): void
    {
        Log::info('Admin access attempt', ['user' => auth()->id()]);
    }
}
```

**На собеседовании скажешь:**
> "Template Method Pattern: базовый класс определяет алгоритм (template method), наследники реализуют шаги. final template method нельзя переопределить. Использую для стандартизации процессов с вариативными шагами."

---

## Резюме абстрактных классов

**Основное:**
- `abstract class` — нельзя создать напрямую, только наследовать
- Может содержать обычные методы (с реализацией) и abstract (без)
- abstract методы — наследники обязаны реализовать
- Можно иметь свойства, конструктор, protected/private методы
- Только одиночное наследование (один родитель)
- Для общей логики группы классов

**Абстрактный класс vs Интерфейс:**
- Абстрактный — общая логика (КАК делать), может содержать реализацию
- Интерфейс — контракт (ЧТО делать), только объявление
- Часто комбинирую: interface + abstract class

**Template Method Pattern:**
- final метод определяет алгоритм
- abstract методы — шаги алгоритма
- Наследники реализуют шаги

**Важно на собесе:**
- abstract class vs interface: реализация vs контракт
- abstract методы обязательно реализовать в наследниках
- protected abstract методы — для внутренней иерархии
- Template Method Pattern — стандартизация алгоритмов
- В Laravel: BaseController, BaseMiddleware, Job

---

## Практические задания

### Задание 1: Template Method Pattern для импорта данных

Создай абстрактный `DataImporter` с шагами: validate, parse, transform, save. Реализуй `CsvImporter` и `JsonImporter`.

<details>
<summary>Решение</summary>

```php
abstract class DataImporter
{
    protected array $errors = [];
    protected array $imported = [];

    // Template method (final — нельзя переопределить)
    final public function import(string $file): array
    {
        $this->reset();

        // Шаг 1: Валидация файла
        if (!$this->validate($file)) {
            return [
                'success' => false,
                'errors' => $this->errors,
            ];
        }

        // Шаг 2: Парсинг
        $data = $this->parse($file);

        if (empty($data)) {
            $this->errors[] = 'No data found in file';
            return ['success' => false, 'errors' => $this->errors];
        }

        // Шаг 3: Трансформация
        $transformed = $this->transform($data);

        // Шаг 4: Сохранение
        $this->save($transformed);

        // Шаг 5: Очистка (опциональная)
        $this->cleanup($file);

        return [
            'success' => true,
            'imported' => count($this->imported),
            'data' => $this->imported,
        ];
    }

    // Абстрактные методы (наследники обязаны реализовать)
    abstract protected function validate(string $file): bool;
    abstract protected function parse(string $file): array;
    abstract protected function save(array $data): void;

    // Методы с реализацией по умолчанию (можно переопределить)
    protected function transform(array $data): array
    {
        // По умолчанию — без трансформации
        return $data;
    }

    protected function cleanup(string $file): void
    {
        // По умолчанию — ничего не делаем
    }

    protected function reset(): void
    {
        $this->errors = [];
        $this->imported = [];
    }

    protected function addError(string $error): void
    {
        $this->errors[] = $error;
    }
}

class CsvImporter extends DataImporter
{
    protected function validate(string $file): bool
    {
        if (!file_exists($file)) {
            $this->addError('File not found');
            return false;
        }

        if (!str_ends_with($file, '.csv')) {
            $this->addError('File must be CSV');
            return false;
        }

        return true;
    }

    protected function parse(string $file): array
    {
        $data = [];
        $handle = fopen($file, 'r');

        // Первая строка — заголовки
        $headers = fgetcsv($handle);

        while (($row = fgetcsv($handle)) !== false) {
            $data[] = array_combine($headers, $row);
        }

        fclose($handle);
        return $data;
    }

    protected function transform(array $data): array
    {
        return array_map(function ($row) {
            // Очистка данных
            return array_map('trim', $row);
        }, $data);
    }

    protected function save(array $data): void
    {
        foreach ($data as $row) {
            // Сохранение в БД (упрощённо)
            echo "INSERT INTO users: {$row['name']}, {$row['email']}\n";
            $this->imported[] = $row;
        }
    }

    protected function cleanup(string $file): void
    {
        // Удаление временного файла
        echo "Deleting temp file: {$file}\n";
    }
}

class JsonImporter extends DataImporter
{
    protected function validate(string $file): bool
    {
        if (!file_exists($file)) {
            $this->addError('File not found');
            return false;
        }

        if (!str_ends_with($file, '.json')) {
            $this->addError('File must be JSON');
            return false;
        }

        return true;
    }

    protected function parse(string $file): array
    {
        $content = file_get_contents($file);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->addError('Invalid JSON: ' . json_last_error_msg());
            return [];
        }

        return $data;
    }

    protected function transform(array $data): array
    {
        return array_map(function ($row) {
            // Преобразование дат
            if (isset($row['created_at'])) {
                $row['created_at'] = date('Y-m-d H:i:s', strtotime($row['created_at']));
            }
            return $row;
        }, $data);
    }

    protected function save(array $data): void
    {
        // Batch insert
        echo "Batch INSERT INTO users (" . count($data) . " rows)\n";
        $this->imported = $data;
    }
}

// Использование
$csvImporter = new CsvImporter();
$result = $csvImporter->import('users.csv');
print_r($result);

$jsonImporter = new JsonImporter();
$result = $jsonImporter->import('users.json');
print_r($result);
```
</details>

### Задание 2: Абстрактный Payment Gateway

Создай абстрактный `PaymentGateway` с общей логикой логирования и абстрактными методами charge, refund.

<details>
<summary>Решение</summary>

```php
abstract class PaymentGateway
{
    protected array $logs = [];

    public function __construct(
        protected string $apiKey,
        protected bool $isProduction = false,
    ) {}

    // Общая логика (реализовано в базовом классе)
    protected function log(string $type, string $message, array $context = []): void
    {
        $log = [
            'type' => $type,
            'message' => $message,
            'context' => $context,
            'gateway' => static::class,
            'timestamp' => date('Y-m-d H:i:s'),
        ];

        $this->logs[] = $log;

        echo "[{$type}] " . static::class . ": {$message}\n";
    }

    public function processPayment(int $amount, string $currency, array $metadata = []): array
    {
        $this->log('info', "Processing payment", [
            'amount' => $amount,
            'currency' => $currency,
        ]);

        try {
            // Вызов абстрактного метода
            $result = $this->charge($amount, $currency, $metadata);

            $this->log('success', "Payment successful", [
                'transaction_id' => $result['transaction_id'],
            ]);

            return $result;
        } catch (\Exception $e) {
            $this->log('error', "Payment failed: {$e->getMessage()}");
            throw $e;
        }
    }

    public function processRefund(string $transactionId, int $amount): array
    {
        $this->log('info', "Processing refund", [
            'transaction_id' => $transactionId,
            'amount' => $amount,
        ]);

        try {
            $result = $this->refund($transactionId, $amount);

            $this->log('success', "Refund successful", [
                'refund_id' => $result['refund_id'],
            ]);

            return $result;
        } catch (\Exception $e) {
            $this->log('error', "Refund failed: {$e->getMessage()}");
            throw $e;
        }
    }

    // Абстрактные методы (каждый gateway реализует по-своему)
    abstract protected function charge(int $amount, string $currency, array $metadata): array;
    abstract protected function refund(string $transactionId, int $amount): array;
    abstract public function getBalance(): int;

    // Геттер для логов
    public function getLogs(): array
    {
        return $this->logs;
    }

    // Helper метод
    protected function buildApiUrl(string $endpoint): string
    {
        $baseUrl = $this->isProduction
            ? $this->getProductionUrl()
            : $this->getSandboxUrl();

        return rtrim($baseUrl, '/') . '/' . ltrim($endpoint, '/');
    }

    abstract protected function getProductionUrl(): string;
    abstract protected function getSandboxUrl(): string;
}

class StripeGateway extends PaymentGateway
{
    protected function charge(int $amount, string $currency, array $metadata): array
    {
        // Stripe API
        $url = $this->buildApiUrl('/v1/charges');

        return [
            'transaction_id' => 'stripe_' . uniqid(),
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'succeeded',
            'fee' => (int) ($amount * 0.029 + 30),
            'metadata' => $metadata,
        ];
    }

    protected function refund(string $transactionId, int $amount): array
    {
        $url = $this->buildApiUrl('/v1/refunds');

        return [
            'refund_id' => 'refund_' . uniqid(),
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'status' => 'succeeded',
        ];
    }

    public function getBalance(): int
    {
        $url = $this->buildApiUrl('/v1/balance');
        return 1000000;
    }

    protected function getProductionUrl(): string
    {
        return 'https://api.stripe.com';
    }

    protected function getSandboxUrl(): string
    {
        return 'https://api.stripe.com/test';
    }
}

class YooKassaGateway extends PaymentGateway
{
    protected function charge(int $amount, string $currency, array $metadata): array
    {
        $url = $this->buildApiUrl('/v3/payments');

        return [
            'transaction_id' => 'yookassa_' . uniqid(),
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'succeeded',
            'fee' => (int) ($amount * 0.035),
            'metadata' => $metadata,
        ];
    }

    protected function refund(string $transactionId, int $amount): array
    {
        $url = $this->buildApiUrl('/v3/refunds');

        return [
            'refund_id' => 'yookassa_refund_' . uniqid(),
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'status' => 'succeeded',
        ];
    }

    public function getBalance(): int
    {
        $url = $this->buildApiUrl('/v3/me');
        return 500000;
    }

    protected function getProductionUrl(): string
    {
        return 'https://api.yookassa.ru';
    }

    protected function getSandboxUrl(): string
    {
        return 'https://api.yookassa.ru/sandbox';
    }
}

// Использование
$stripe = new StripeGateway('sk_test_xxx', false);
$payment = $stripe->processPayment(100000, 'RUB', ['order_id' => 123]);
print_r($payment);
print_r($stripe->getLogs());

$yookassa = new YooKassaGateway('shop_xxx', false);
$payment = $yookassa->processPayment(100000, 'RUB', ['order_id' => 456]);
```
</details>

### Задание 3: Абстрактный Validator с Template Method

Создай абстрактный `Validator` с методом `validate()`. Реализуй `UserValidator` и `OrderValidator`.

<details>
<summary>Решение</summary>

```php
abstract class Validator
{
    protected array $errors = [];
    protected array $data = [];

    final public function validate(array $data): bool
    {
        $this->reset();
        $this->data = $data;

        // Шаг 1: Базовая валидация
        $this->validateRequired();

        // Шаг 2: Валидация типов
        $this->validateTypes();

        // Шаг 3: Кастомная валидация (реализуется в наследниках)
        $this->validateCustom();

        return empty($this->errors);
    }

    // Абстрактные методы
    abstract protected function getRequiredFields(): array;
    abstract protected function getFieldTypes(): array;
    abstract protected function validateCustom(): void;

    // Общие методы
    protected function validateRequired(): void
    {
        foreach ($this->getRequiredFields() as $field) {
            if (!isset($this->data[$field]) || $this->data[$field] === '') {
                $this->addError($field, "Field {$field} is required");
            }
        }
    }

    protected function validateTypes(): void
    {
        foreach ($this->getFieldTypes() as $field => $type) {
            if (!isset($this->data[$field])) {
                continue;
            }

            $value = $this->data[$field];

            $isValid = match($type) {
                'string' => is_string($value),
                'int' => is_int($value),
                'email' => filter_var($value, FILTER_VALIDATE_EMAIL) !== false,
                'array' => is_array($value),
                default => true,
            };

            if (!$isValid) {
                $this->addError($field, "Field {$field} must be {$type}");
            }
        }
    }

    protected function addError(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }

        $this->errors[$field][] = $message;
    }

    protected function reset(): void
    {
        $this->errors = [];
        $this->data = [];
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function hasError(string $field): bool
    {
        return isset($this->errors[$field]);
    }
}

class UserValidator extends Validator
{
    protected function getRequiredFields(): array
    {
        return ['name', 'email', 'password'];
    }

    protected function getFieldTypes(): array
    {
        return [
            'name' => 'string',
            'email' => 'email',
            'password' => 'string',
            'age' => 'int',
        ];
    }

    protected function validateCustom(): void
    {
        // Валидация длины пароля
        if (isset($this->data['password']) && strlen($this->data['password']) < 8) {
            $this->addError('password', 'Password must be at least 8 characters');
        }

        // Валидация возраста
        if (isset($this->data['age']) && $this->data['age'] < 18) {
            $this->addError('age', 'User must be 18 or older');
        }

        // Валидация уникальности email (упрощённо)
        if (isset($this->data['email']) && $this->data['email'] === 'taken@example.com') {
            $this->addError('email', 'Email already exists');
        }
    }
}

class OrderValidator extends Validator
{
    protected function getRequiredFields(): array
    {
        return ['user_id', 'amount', 'items'];
    }

    protected function getFieldTypes(): array
    {
        return [
            'user_id' => 'int',
            'amount' => 'int',
            'items' => 'array',
        ];
    }

    protected function validateCustom(): void
    {
        // Валидация суммы
        if (isset($this->data['amount']) && $this->data['amount'] < 100) {
            $this->addError('amount', 'Minimum order amount is 100');
        }

        // Валидация items
        if (isset($this->data['items']) && count($this->data['items']) === 0) {
            $this->addError('items', 'Order must contain at least one item');
        }

        // Валидация каждого item
        if (isset($this->data['items'])) {
            foreach ($this->data['items'] as $index => $item) {
                if (!isset($item['product_id'])) {
                    $this->addError("items.{$index}", "Product ID is required");
                }

                if (!isset($item['quantity']) || $item['quantity'] < 1) {
                    $this->addError("items.{$index}", "Quantity must be at least 1");
                }
            }
        }
    }
}

// Использование
$userValidator = new UserValidator();

$isValid = $userValidator->validate([
    'name' => 'Иван',
    'email' => 'ivan@example.com',
    'password' => '12345',  // Короткий
    'age' => 16,  // Меньше 18
]);

echo "Valid: " . ($isValid ? 'Yes' : 'No') . "\n";
print_r($userValidator->getErrors());
// [
//   'password' => ['Password must be at least 8 characters'],
//   'age' => ['User must be 18 or older']
// ]

$orderValidator = new OrderValidator();
$isValid = $orderValidator->validate([
    'user_id' => 1,
    'amount' => 50,  // Меньше минимума
    'items' => [
        ['product_id' => 10, 'quantity' => 2],
        ['quantity' => 1],  // Нет product_id
    ],
]);

print_r($orderValidator->getErrors());
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
