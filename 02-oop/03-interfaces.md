# 2.3 Интерфейсы

## Краткое резюме

> **Интерфейс** — контракт, определяющий методы, которые должен реализовать класс. Только объявление методов, без реализации.
>
> **Ключевые концепции:** implements (реализация), множественная реализация, наследование интерфейсов, константы в интерфейсах.
>
> **Важно:** Класс может реализовать несколько интерфейсов (в отличие от наследования — только один родитель). PSR интерфейсы для совместимости библиотек.

---

## Содержание

- [Что такое интерфейс](#что-такое-интерфейс)
- [Множественная реализация интерфейсов](#множественная-реализация-интерфейсов)
- [Наследование интерфейсов](#наследование-интерфейсов)
- [Константы в интерфейсах](#константы-в-интерфейсах)
- [Интерфейс vs Абстрактный класс](#интерфейс-vs-абстрактный-класс)
- [PSR интерфейсы](#psr-интерфейсы-стандарты-php)
- [Резюме](#резюме-интерфейсов)
- [Практические задания](#практические-задания)

---

## Что такое интерфейс

**Что это:**
Контракт, определяющий методы, которые должен реализовать класс. Интерфейс — это только объявление методов без реализации.

**Как работает:**
```php
interface PaymentGatewayInterface
{
    public function charge(int $amount, string $currency): bool;
    public function refund(string $transactionId, int $amount): bool;
    public function getBalance(): int;
}

class StripeGateway implements PaymentGatewayInterface
{
    public function charge(int $amount, string $currency): bool
    {
        // Реализация для Stripe
        return true;
    }

    public function refund(string $transactionId, int $amount): bool
    {
        // Реализация для Stripe
        return true;
    }

    public function getBalance(): int
    {
        // Реализация для Stripe
        return 10000;
    }
}

class PayPalGateway implements PaymentGatewayInterface
{
    public function charge(int $amount, string $currency): bool
    {
        // Реализация для PayPal
        return true;
    }

    public function refund(string $transactionId, int $amount): bool
    {
        // Реализация для PayPal
        return true;
    }

    public function getBalance(): int
    {
        // Реализация для PayPal
        return 5000;
    }
}

// Можно использовать любую реализацию
function processPayment(PaymentGatewayInterface $gateway, int $amount): bool
{
    return $gateway->charge($amount, 'RUB');
}

$stripe = new StripeGateway();
$paypal = new PayPalGateway();

processPayment($stripe, 1000);  // Работает
processPayment($paypal, 1000);  // Работает
```

**Когда использовать:**
Для определения контрактов, полиморфизма, Dependency Injection, тестирования (моки).

**Пример из практики:**
```php
// Repository интерфейс
interface UserRepositoryInterface
{
    public function find(int $id): ?User;
    public function all(): Collection;
    public function create(array $data): User;
    public function update(int $id, array $data): User;
    public function delete(int $id): bool;
}

// Eloquent реализация
class EloquentUserRepository implements UserRepositoryInterface
{
    public function find(int $id): ?User
    {
        return User::find($id);
    }

    public function all(): Collection
    {
        return User::all();
    }

    public function create(array $data): User
    {
        return User::create($data);
    }

    public function update(int $id, array $data): User
    {
        $user = User::findOrFail($id);
        $user->update($data);
        return $user;
    }

    public function delete(int $id): bool
    {
        return User::destroy($id) > 0;
    }
}

// Service с DI
class UserService
{
    public function __construct(
        private UserRepositoryInterface $repository,
    ) {}

    public function register(array $data): User
    {
        return $this->repository->create($data);
    }
}

// Laravel Service Container
app()->bind(UserRepositoryInterface::class, EloquentUserRepository::class);

// Теперь можем легко заменить реализацию (например, для тестов)
app()->bind(UserRepositoryInterface::class, FakeUserRepository::class);
```

**На собеседовании скажешь:**
> "Интерфейс — контракт, только объявление методов. Класс implements интерфейс и обязан реализовать все методы. Использую для полиморфизма, DI, тестирования. В Laravel часто создаю интерфейсы для репозиториев, сервисов."

---

## Множественная реализация интерфейсов

**Что это:**
Класс может реализовать несколько интерфейсов (в отличие от наследования — только один родитель).

**Как работает:**
```php
interface Loggable
{
    public function log(string $message): void;
}

interface Cacheable
{
    public function cache(string $key, mixed $value): void;
    public function getCached(string $key): mixed;
}

interface Notifiable
{
    public function notify(string $message): void;
}

class UserService implements Loggable, Cacheable, Notifiable
{
    public function log(string $message): void
    {
        Log::info($message);
    }

    public function cache(string $key, mixed $value): void
    {
        Cache::put($key, $value, 3600);
    }

    public function getCached(string $key): mixed
    {
        return Cache::get($key);
    }

    public function notify(string $message): void
    {
        // Отправка уведомления
    }
}

// Работает с любым интерфейсом
function logMessage(Loggable $service, string $msg): void
{
    $service->log($msg);
}

function cacheData(Cacheable $service, string $key, mixed $data): void
{
    $service->cache($key, $data);
}

$service = new UserService();
logMessage($service, 'Test');
cacheData($service, 'user:1', ['name' => 'Ivan']);
```

**Когда использовать:**
Когда объект должен иметь несколько "способностей" (логирование + кэширование + уведомления).

**Пример из практики:**
```php
// Laravel Contracts
interface Arrayable
{
    public function toArray(): array;
}

interface Jsonable
{
    public function toJson($options = 0): string;
}

class User extends Model implements Arrayable, Jsonable
{
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
        ];
    }

    public function toJson($options = 0): string
    {
        return json_encode($this->toArray(), $options);
    }
}

// Можем использовать как Arrayable или Jsonable
function convertToArray(Arrayable $object): array
{
    return $object->toArray();
}

function convertToJson(Jsonable $object): string
{
    return $object->toJson();
}

$user = User::find(1);
$array = convertToArray($user);
$json = convertToJson($user);
```

**На собеседовании скажешь:**
> "Класс может реализовать несколько интерфейсов через запятую: implements A, B, C. Это решает проблему множественного наследования через контракты. В Laravel модели реализуют Arrayable, Jsonable."

---

## Наследование интерфейсов

**Что это:**
Интерфейс может наследовать другой интерфейс (extends).

**Как работает:**
```php
interface Readable
{
    public function read(): string;
}

interface Writable
{
    public function write(string $data): bool;
}

// Интерфейс наследует другие интерфейсы
interface ReadWritable extends Readable, Writable
{
    public function readWrite(string $data): string;
}

class File implements ReadWritable
{
    public function read(): string
    {
        return file_get_contents('file.txt');
    }

    public function write(string $data): bool
    {
        return file_put_contents('file.txt', $data) !== false;
    }

    public function readWrite(string $data): string
    {
        $this->write($data);
        return $this->read();
    }
}
```

**Когда использовать:**
Для создания иерархии интерфейсов (базовый → расширенный).

**Пример из практики:**
```php
// Базовый репозиторий интерфейс
interface RepositoryInterface
{
    public function find(int $id): ?Model;
    public function all(): Collection;
}

// Расширенный интерфейс с дополнительными методами
interface AdvancedRepositoryInterface extends RepositoryInterface
{
    public function findByCustomCriteria(array $criteria): Collection;
    public function paginate(int $perPage): LengthAwarePaginator;
    public function search(string $query): Collection;
}

class UserRepository implements AdvancedRepositoryInterface
{
    // Обязан реализовать ВСЕ методы (из обоих интерфейсов)
    public function find(int $id): ?Model { /* ... */ }
    public function all(): Collection { /* ... */ }
    public function findByCustomCriteria(array $criteria): Collection { /* ... */ }
    public function paginate(int $perPage): LengthAwarePaginator { /* ... */ }
    public function search(string $query): Collection { /* ... */ }
}

// Laravel Contracts
interface Authenticatable extends \JsonSerializable
{
    public function getAuthIdentifierName(): string;
    public function getAuthIdentifier(): mixed;
    public function getAuthPassword(): string;
    // ...
}

class User extends Model implements Authenticatable
{
    // Реализует методы Authenticatable + JsonSerializable
}
```

**На собеседовании скажешь:**
> "Интерфейс может наследовать другие интерфейсы через extends. Класс, реализующий расширенный интерфейс, обязан реализовать ВСЕ методы из всей иерархии. В Laravel Authenticatable наследует JsonSerializable."

---

## Константы в интерфейсах

**Что это:**
Интерфейсы могут содержать константы (всегда public).

**Как работает:**
```php
interface OrderStatus
{
    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const SHIPPED = 'shipped';
    public const DELIVERED = 'delivered';
    public const CANCELLED = 'cancelled';
}

class Order implements OrderStatus
{
    private string $status;

    public function __construct()
    {
        $this->status = self::PENDING;
    }

    public function markAsPaid(): void
    {
        $this->status = self::PAID;
    }
}

// Доступ к константам
echo OrderStatus::PENDING;  // "pending"

if ($order->status === OrderStatus::PAID) {
    // ...
}
```

**Когда использовать:**
Для определения констант, связанных с контрактом.

**Пример из практики:**
```php
// HTTP коды
interface HttpStatus
{
    public const OK = 200;
    public const CREATED = 201;
    public const NO_CONTENT = 204;
    public const BAD_REQUEST = 400;
    public const UNAUTHORIZED = 401;
    public const FORBIDDEN = 403;
    public const NOT_FOUND = 404;
    public const SERVER_ERROR = 500;
}

class ApiController implements HttpStatus
{
    public function index()
    {
        return response()->json($data, self::OK);
    }

    public function store(Request $request)
    {
        $item = Item::create($request->all());
        return response()->json($item, self::CREATED);
    }

    public function destroy(int $id)
    {
        Item::destroy($id);
        return response()->json(null, self::NO_CONTENT);
    }
}

// Cache TTL
interface CacheTTL
{
    public const MINUTE = 60;
    public const HOUR = 3600;
    public const DAY = 86400;
    public const WEEK = 604800;
}

class CacheService implements CacheTTL
{
    public function rememberUser(int $userId): User
    {
        return Cache::remember("user:{$userId}", self::HOUR, function() use ($userId) {
            return User::find($userId);
        });
    }
}
```

**На собеседовании скажешь:**
> "Интерфейсы могут содержать константы (всегда public). Использую для HTTP статусов, TTL, статусов. PHP 8.1 добавил Enum — лучше для таких случаев."

---

## Интерфейс vs Абстрактный класс

**Что это:**
Сравнение двух механизмов для определения контрактов.

**Интерфейс:**
```php
interface PaymentGatewayInterface
{
    public function charge(int $amount): bool;
    public function refund(string $id): bool;
}

class StripeGateway implements PaymentGatewayInterface
{
    public function charge(int $amount): bool { /* ... */ }
    public function refund(string $id): bool { /* ... */ }
}
```

**Абстрактный класс:**
```php
abstract class PaymentGateway
{
    protected string $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }

    // Метод с реализацией
    protected function log(string $message): void
    {
        Log::info($message);
    }

    // Абстрактные методы (без реализации)
    abstract public function charge(int $amount): bool;
    abstract public function refund(string $id): bool;
}

class StripeGateway extends PaymentGateway
{
    public function charge(int $amount): bool
    {
        $this->log("Charging {$amount}");  // Используем метод родителя
        // Stripe API
        return true;
    }

    public function refund(string $id): bool
    {
        $this->log("Refunding {$id}");
        // Stripe API
        return true;
    }
}
```

**Отличия:**

| Интерфейс | Абстрактный класс |
|-----------|-------------------|
| Только объявление методов | Может содержать реализацию |
| Нет свойств (кроме констант) | Может иметь свойства |
| Можно реализовать несколько | Можно наследовать только один |
| Нет конструктора | Может иметь конструктор |
| Все методы public | Методы: public, protected, private |
| Контракт "ЧТО делать" | Базовый класс "КАК делать" |

**Когда использовать:**
- **Интерфейс** — для контракта (что должен уметь класс), полиморфизма, DI
- **Абстрактный класс** — для общей логики (как делать), базового поведения

**Пример из практики:**
```php
// Интерфейс — контракт
interface LoggerInterface
{
    public function log(string $level, string $message): void;
}

// Абстрактный класс — общая логика
abstract class BaseLogger implements LoggerInterface
{
    protected function format(string $level, string $message): string
    {
        return "[{$level}] " . now() . " - {$message}";
    }

    abstract protected function write(string $formatted): void;

    public function log(string $level, string $message): void
    {
        $formatted = $this->format($level, $message);
        $this->write($formatted);
    }
}

// Конкретные реализации
class FileLogger extends BaseLogger
{
    protected function write(string $formatted): void
    {
        file_put_contents('log.txt', $formatted . PHP_EOL, FILE_APPEND);
    }
}

class DatabaseLogger extends BaseLogger
{
    protected function write(string $formatted): void
    {
        DB::table('logs')->insert(['message' => $formatted]);
    }
}

// Можем использовать через интерфейс
function logMessage(LoggerInterface $logger, string $message): void
{
    $logger->log('info', $message);
}

$fileLogger = new FileLogger();
$dbLogger = new DatabaseLogger();

logMessage($fileLogger, 'Test');  // Работает
logMessage($dbLogger, 'Test');    // Работает
```

**На собеседовании скажешь:**
> "Интерфейс — контракт (ЧТО делать), только объявление. Абстрактный класс — базовая реализация (КАК делать), может содержать логику. Интерфейсов можно несколько, абстрактный класс — один. Использую интерфейс для DI, абстрактный класс для переиспользования кода."

---

## PSR интерфейсы (Стандарты PHP)

**Что это:**
Стандартные интерфейсы PSR для совместимости библиотек.

**Как работает:**
```php
// PSR-3: Logger Interface
use Psr\Log\LoggerInterface;

class MyService
{
    public function __construct(
        private LoggerInterface $logger,  // Любой PSR-3 логгер
    ) {}

    public function process(): void
    {
        $this->logger->info('Processing...');
        $this->logger->error('Error!', ['context' => 'data']);
    }
}

// Можем использовать любой PSR-3 логгер
$monolog = new Monolog\Logger('app');
$service = new MyService($monolog);

// PSR-7: HTTP Message Interface
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

function handleRequest(RequestInterface $request): ResponseInterface
{
    $method = $request->getMethod();
    $uri = $request->getUri();

    return new Response(200, [], 'OK');
}

// PSR-11: Container Interface
use Psr\Container\ContainerInterface;

class ServiceFactory
{
    public function __construct(
        private ContainerInterface $container,
    ) {}

    public function create(): MyService
    {
        return new MyService(
            $this->container->get(LoggerInterface::class)
        );
    }
}
```

**Основные PSR интерфейсы:**
- **PSR-3** — Logger Interface (LoggerInterface)
- **PSR-6** — Caching Interface (CacheItemPoolInterface)
- **PSR-7** — HTTP Message Interface (RequestInterface, ResponseInterface)
- **PSR-11** — Container Interface (ContainerInterface)
- **PSR-15** — HTTP Server Request Handlers (RequestHandlerInterface, MiddlewareInterface)
- **PSR-16** — Simple Cache (CacheInterface)

**Когда использовать:**
Всегда используй PSR интерфейсы для совместимости библиотек.

**Пример из практики:**
```php
// Laravel использует PSR интерфейсы
use Illuminate\Contracts\Cache\Repository as CacheContract;  // PSR-16
use Psr\Log\LoggerInterface;  // PSR-3

class OrderService
{
    public function __construct(
        private LoggerInterface $logger,
        private CacheContract $cache,
    ) {}

    public function create(array $data): Order
    {
        $this->logger->info('Creating order', $data);

        $order = Order::create($data);

        $this->cache->put("order:{$order->id}", $order, 3600);

        return $order;
    }
}

// Service Container автоматически внедрит PSR реализации
$service = app(OrderService::class);
```

**На собеседовании скажешь:**
> "PSR интерфейсы — стандарты PHP для совместимости библиотек. PSR-3 (Logger), PSR-7 (HTTP), PSR-11 (Container), PSR-16 (Cache). Laravel использует PSR интерфейсы для DI. Это позволяет легко заменять реализации."

---

## Резюме интерфейсов

**Основное:**
- Интерфейс — контракт, только объявление методов (без реализации)
- `implements` — класс реализует интерфейс
- Можно реализовать несколько интерфейсов: `implements A, B, C`
- Интерфейс может наследовать другие: `extends A, B`
- Константы в интерфейсах (всегда public)
- Интерфейс vs Абстрактный класс:
  - Интерфейс — контракт (ЧТО), можно несколько
  - Абстрактный — реализация (КАК), только один
- PSR интерфейсы — стандарты для совместимости

**Важно на собесе:**
- Интерфейс — только объявление (в отличие от абстрактного класса)
- Можно реализовать много интерфейсов (решение проблемы множественного наследования)
- Использую для DI, полиморфизма, тестирования
- PSR интерфейсы (PSR-3, PSR-7, PSR-11) для совместимости библиотек
- В Laravel создаю интерфейсы для репозиториев, сервисов

---

## Практические задания

### Задание 1: Реализуй Repository Pattern

Создай `UserRepositoryInterface` с методами find, all, create, update, delete. Реализуй `EloquentUserRepository` и `ArrayUserRepository`.

<details>
<summary>Решение</summary>

```php
interface UserRepositoryInterface
{
    public function find(int $id): ?array;
    public function all(): array;
    public function create(array $data): array;
    public function update(int $id, array $data): array;
    public function delete(int $id): bool;
    public function findByEmail(string $email): ?array;
}

// Реализация через массив (для тестов)
class ArrayUserRepository implements UserRepositoryInterface
{
    private array $users = [];
    private int $nextId = 1;

    public function find(int $id): ?array
    {
        return $this->users[$id] ?? null;
    }

    public function all(): array
    {
        return array_values($this->users);
    }

    public function create(array $data): array
    {
        $user = [
            'id' => $this->nextId++,
            'name' => $data['name'],
            'email' => $data['email'],
            'created_at' => date('Y-m-d H:i:s'),
        ];

        $this->users[$user['id']] = $user;
        return $user;
    }

    public function update(int $id, array $data): array
    {
        if (!isset($this->users[$id])) {
            throw new \Exception('User not found');
        }

        $this->users[$id] = array_merge($this->users[$id], $data);
        $this->users[$id]['updated_at'] = date('Y-m-d H:i:s');

        return $this->users[$id];
    }

    public function delete(int $id): bool
    {
        if (!isset($this->users[$id])) {
            return false;
        }

        unset($this->users[$id]);
        return true;
    }

    public function findByEmail(string $email): ?array
    {
        foreach ($this->users as $user) {
            if ($user['email'] === $email) {
                return $user;
            }
        }

        return null;
    }
}

// Реализация через Eloquent (псевдокод)
class EloquentUserRepository implements UserRepositoryInterface
{
    public function find(int $id): ?array
    {
        $user = User::find($id);
        return $user ? $user->toArray() : null;
    }

    public function all(): array
    {
        return User::all()->toArray();
    }

    public function create(array $data): array
    {
        return User::create($data)->toArray();
    }

    public function update(int $id, array $data): array
    {
        $user = User::findOrFail($id);
        $user->update($data);
        return $user->fresh()->toArray();
    }

    public function delete(int $id): bool
    {
        return User::destroy($id) > 0;
    }

    public function findByEmail(string $email): ?array
    {
        $user = User::where('email', $email)->first();
        return $user ? $user->toArray() : null;
    }
}

// Service с DI
class UserService
{
    public function __construct(
        private UserRepositoryInterface $repository,
    ) {}

    public function register(string $name, string $email, string $password): array
    {
        // Проверка email
        if ($this->repository->findByEmail($email)) {
            throw new \Exception('Email already exists');
        }

        return $this->repository->create([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);
    }

    public function getUserById(int $id): array
    {
        $user = $this->repository->find($id);

        if (!$user) {
            throw new \Exception('User not found');
        }

        return $user;
    }
}

// Использование (легко заменить реализацию)
$repository = new ArrayUserRepository();
$service = new UserService($repository);

$user = $service->register('Иван', 'ivan@mail.com', 'secret');
print_r($user);

// Для продакшена
$repository = new EloquentUserRepository();
$service = new UserService($repository);
```
</details>

### Задание 2: Множественные интерфейсы и Cacheable

Создай интерфейсы `Loggable`, `Cacheable`, `Notifiable`. Класс `OrderService` реализует все три.

<details>
<summary>Решение</summary>

```php
interface Loggable
{
    public function log(string $level, string $message, array $context = []): void;
}

interface Cacheable
{
    public function cache(string $key, mixed $value, int $ttl = 3600): void;
    public function getCached(string $key): mixed;
    public function clearCache(string $key): bool;
}

interface Notifiable
{
    public function notify(string $channel, string $message, array $data = []): void;
}

class OrderService implements Loggable, Cacheable, Notifiable
{
    private array $cache = [];
    private array $logs = [];
    private array $notifications = [];

    public function log(string $level, string $message, array $context = []): void
    {
        $this->logs[] = [
            'level' => $level,
            'message' => $message,
            'context' => $context,
            'timestamp' => date('Y-m-d H:i:s'),
        ];

        echo "[{$level}] {$message}\n";
    }

    public function cache(string $key, mixed $value, int $ttl = 3600): void
    {
        $this->cache[$key] = [
            'value' => $value,
            'expires_at' => time() + $ttl,
        ];
    }

    public function getCached(string $key): mixed
    {
        if (!isset($this->cache[$key])) {
            return null;
        }

        $cached = $this->cache[$key];

        if ($cached['expires_at'] < time()) {
            unset($this->cache[$key]);
            return null;
        }

        return $cached['value'];
    }

    public function clearCache(string $key): bool
    {
        if (isset($this->cache[$key])) {
            unset($this->cache[$key]);
            return true;
        }

        return false;
    }

    public function notify(string $channel, string $message, array $data = []): void
    {
        $this->notifications[] = [
            'channel' => $channel,
            'message' => $message,
            'data' => $data,
            'timestamp' => date('Y-m-d H:i:s'),
        ];

        echo "[{$channel}] {$message}\n";
    }

    // Бизнес-логика
    public function createOrder(array $orderData): array
    {
        $this->log('info', 'Creating order', ['data' => $orderData]);

        // Проверка кэша
        $cacheKey = "order:draft:{$orderData['user_id']}";
        $draft = $this->getCached($cacheKey);

        if ($draft) {
            $this->log('info', 'Using cached draft');
            $orderData = array_merge($draft, $orderData);
        }

        $order = [
            'id' => rand(1000, 9999),
            'user_id' => $orderData['user_id'],
            'amount' => $orderData['amount'],
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s'),
        ];

        // Кэшируем заказ
        $this->cache("order:{$order['id']}", $order, 7200);

        // Уведомление
        $this->notify('email', 'Order created', ['order_id' => $order['id']]);
        $this->notify('sms', 'Your order #' . $order['id'] . ' created');

        $this->log('info', 'Order created successfully', ['order_id' => $order['id']]);

        return $order;
    }

    public function getLogs(): array
    {
        return $this->logs;
    }

    public function getNotifications(): array
    {
        return $this->notifications;
    }
}

// Использование
$service = new OrderService();

$order = $service->createOrder([
    'user_id' => 1,
    'amount' => 1000,
]);

print_r($order);
print_r($service->getLogs());
print_r($service->getNotifications());
```
</details>

### Задание 3: Payment Gateway с интерфейсом

Создай `PaymentGatewayInterface` и две реализации: `StripeGateway` и `PayPalGateway`.

<details>
<summary>Решение</summary>

```php
interface PaymentGatewayInterface
{
    public function charge(int $amount, string $currency, array $metadata = []): array;
    public function refund(string $transactionId, int $amount): array;
    public function getBalance(): int;
    public function getName(): string;
}

class StripeGateway implements PaymentGatewayInterface
{
    public function __construct(
        private string $apiKey,
    ) {}

    public function charge(int $amount, string $currency, array $metadata = []): array
    {
        // Stripe API logic
        return [
            'transaction_id' => 'stripe_' . uniqid(),
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'succeeded',
            'gateway' => 'stripe',
            'fee' => (int) ($amount * 0.029 + 30), // 2.9% + 30 копеек
            'metadata' => $metadata,
        ];
    }

    public function refund(string $transactionId, int $amount): array
    {
        return [
            'refund_id' => 'refund_' . uniqid(),
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'status' => 'refunded',
            'gateway' => 'stripe',
        ];
    }

    public function getBalance(): int
    {
        // Stripe API balance
        return 1000000; // 10,000.00
    }

    public function getName(): string
    {
        return 'Stripe';
    }
}

class PayPalGateway implements PaymentGatewayInterface
{
    public function __construct(
        private string $clientId,
        private string $clientSecret,
    ) {}

    public function charge(int $amount, string $currency, array $metadata = []): array
    {
        // PayPal API logic
        return [
            'transaction_id' => 'paypal_' . uniqid(),
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'completed',
            'gateway' => 'paypal',
            'fee' => (int) ($amount * 0.034 + 10), // 3.4% + 10 копеек
            'metadata' => $metadata,
        ];
    }

    public function refund(string $transactionId, int $amount): array
    {
        return [
            'refund_id' => 'paypal_refund_' . uniqid(),
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'status' => 'refunded',
            'gateway' => 'paypal',
        ];
    }

    public function getBalance(): int
    {
        // PayPal API balance
        return 500000; // 5,000.00
    }

    public function getName(): string
    {
        return 'PayPal';
    }
}

// Payment Service с DI
class PaymentService
{
    public function __construct(
        private PaymentGatewayInterface $gateway,
    ) {}

    public function processPayment(int $amount, string $currency = 'RUB'): array
    {
        echo "Processing payment via {$this->gateway->getName()}...\n";

        $result = $this->gateway->charge($amount, $currency, [
            'customer_id' => 123,
            'order_id' => 456,
        ]);

        echo "Payment {$result['status']}: {$result['transaction_id']}\n";
        echo "Fee: " . number_format($result['fee'] / 100, 2) . " {$currency}\n";

        return $result;
    }

    public function processRefund(string $transactionId, int $amount): array
    {
        echo "Processing refund via {$this->gateway->getName()}...\n";

        $result = $this->gateway->refund($transactionId, $amount);

        echo "Refund {$result['status']}: {$result['refund_id']}\n";

        return $result;
    }
}

// Использование — легко переключаться между gateway
$stripeGateway = new StripeGateway('sk_test_...');
$paymentService = new PaymentService($stripeGateway);

$payment = $paymentService->processPayment(100000, 'RUB'); // 1000.00 RUB
$refund = $paymentService->processRefund($payment['transaction_id'], 50000);

// Переключение на PayPal
$paypalGateway = new PayPalGateway('client_id', 'client_secret');
$paymentService = new PaymentService($paypalGateway);

$payment = $paymentService->processPayment(100000, 'RUB');
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
