# 3.7 Новые возможности PHP 8.x

## Краткое резюме

> **PHP 8.x** — Named Arguments, Union Types, Match, Nullsafe ?->, Property Promotion, readonly, Enums.
>
> **PHP 8.0:** Constructor Property Promotion, Attributes, Match expression.
>
> **PHP 8.1:** Enums, readonly properties, never type, Fibers.

---

## Содержание

- [Named Arguments (PHP 8.0)](#named-arguments-php-80)
- [Union Types (PHP 8.0)](#union-types-php-80)
- [Match Expression (PHP 8.0)](#match-expression-php-80)
- [Nullsafe Operator ?-> (PHP 8.0)](#nullsafe-operator---php-80)
- [Constructor Property Promotion (PHP 8.0)](#constructor-property-promotion-php-80)
- [Readonly Properties (PHP 8.1)](#readonly-properties-php-81)
- [Enums (PHP 8.1)](#enums-php-81)
- [Другие новшества PHP 8.x](#другие-новшества-php-8x)
- [Резюме PHP 8.x](#резюме-php-8x)
- [Практические задания](#практические-задания)

---

## Named Arguments (PHP 8.0)

**Что это:**
Передача аргументов по имени (не по порядку).

**Как работает:**
```php
// До PHP 8.0
function createUser(string $name, string $email, bool $isActive = true, ?string $role = null)
{
    // ...
}

createUser('Иван', 'ivan@mail.com', true, 'admin');

// Чтобы пропустить $isActive, нужно передать null
createUser('Иван', 'ivan@mail.com', true, null);

// PHP 8.0: именованные аргументы
createUser(
    name: 'Иван',
    email: 'ivan@mail.com',
    role: 'admin'  // Пропустили $isActive
);

// Порядок не важен
createUser(
    email: 'ivan@mail.com',
    name: 'Иван',
    isActive: false
);
```

**Когда использовать:**
Для функций с множеством опциональных параметров, улучшения читаемости.

**Пример из практики:**
```php
// Laravel Route
Route::get('/users', [UserController::class, 'index'])
    ->middleware('auth')
    ->name('users.index');

// С именованными аргументами (PHP 8.0+)
response()->json(
    data: $users,
    status: 200,
    headers: ['X-Custom' => 'value']
);

// Eloquent
User::create(
    attributes: [
        'name' => 'Иван',
        'email' => 'ivan@mail.com',
    ]
);

// В тестах (очень читаемо)
$this->assertDatabaseHas(
    table: 'users',
    data: ['email' => 'ivan@mail.com']
);
```

**На собеседовании скажешь:**
> "Named Arguments (PHP 8.0) — передача по имени, порядок не важен. Улучшает читаемость, позволяет пропускать опциональные параметры. В Laravel использую для routes, responses, тестов."

---

## Union Types (PHP 8.0)

**Что это:**
Указание нескольких возможных типов для параметра/возврата.

**Как работает:**
```php
// До PHP 8.0 (через PHPDoc)
/**
 * @param int|string $id
 * @return User|null
 */
function findUser($id)
{
    // ...
}

// PHP 8.0: Union Types
function findUser(int|string $id): User|null
{
    if (is_int($id)) {
        return User::find($id);
    }

    return User::where('email', $id)->first();
}

// Несколько типов
function process(int|float|string $value): int|float
{
    return is_string($value) ? (int) $value : $value;
}

// С массивом
function save(array|object $data): void
{
    // ...
}
```

**Когда использовать:**
Когда параметр может быть разных типов.

**Пример из практики:**
```php
// Laravel Response
function respond(array|Collection $data, int $status = 200): JsonResponse
{
    if ($data instanceof Collection) {
        $data = $data->toArray();
    }

    return response()->json($data, $status);
}

// Repository
class UserRepository
{
    public function find(int|string $id): User|null
    {
        if (is_int($id)) {
            return User::find($id);  // Поиск по ID
        }

        return User::where('email', $id)->first();  // Поиск по email
    }
}

// Cache
class CacheService
{
    public function remember(
        string $key,
        int|\DateInterval $ttl,
        callable $callback
    ): mixed {
        return Cache::remember($key, $ttl, $callback);
    }
}

// Никогда не используй с null (используй nullable)
// ПЛОХО
function bad(int|null $value): void {}  // ❌

// ХОРОШО
function good(?int $value): void {}  // ✅
```

**На собеседовании скажешь:**
> "Union Types (PHP 8.0) — несколько типов через |. int|string|null или int|float. Не использую с null (есть ?int). В Laravel для гибких методов (find по ID или email)."

---

## Match Expression (PHP 8.0)

**Что это:**
Улучшенный switch с возвратом значения и строгим сравнением.

**Как работает:**
```php
// До PHP 8.0 (switch)
$message = '';
switch ($status) {
    case 'pending':
        $message = 'В ожидании';
        break;
    case 'paid':
        $message = 'Оплачено';
        break;
    default:
        $message = 'Неизвестно';
}

// PHP 8.0: match
$message = match($status) {
    'pending' => 'В ожидании',
    'paid' => 'Оплачено',
    default => 'Неизвестно',
};

// Несколько значений
$type = match($code) {
    200, 201, 204 => 'success',
    400, 404 => 'client_error',
    500, 502, 503 => 'server_error',
    default => 'unknown',
};

// Строгое сравнение (===)
$result = match($value) {
    0 => 'zero',
    '0' => 'string zero',  // Не совпадёт с 0
    default => 'other',
};
```

**Когда использовать:**
Вместо switch, когда нужно вернуть значение.

**Пример из практики:**
```php
// HTTP статусы
$message = match($response->status()) {
    200 => 'OK',
    201 => 'Created',
    400 => 'Bad Request',
    401 => 'Unauthorized',
    403 => 'Forbidden',
    404 => 'Not Found',
    500 => 'Server Error',
    default => throw new HttpException($response->status()),
};

// Enum (PHP 8.1)
enum Status: string {
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
}

$badge = match($order->status) {
    Status::Pending => 'badge-warning',
    Status::Paid => 'badge-info',
    Status::Shipped => 'badge-success',
};

// Условия
$discount = match(true) {
    $amount > 10000 => 0.15,
    $amount > 5000 => 0.10,
    $amount > 1000 => 0.05,
    default => 0,
};
```

**На собеседовании скажешь:**
> "Match (PHP 8.0) — улучшенный switch. Возвращает значение, строгое сравнение (===), не нужен break. Выбрасывает ошибку без default. Использую вместо switch для возврата значений."

---

## Nullsafe Operator ?-> (PHP 8.0)

**Что это:**
Безопасный доступ к свойствам/методам (если объект null → вернёт null).

**Как работает:**
```php
// До PHP 8.0
$country = null;
if ($user !== null && $user->address !== null) {
    $country = $user->address->country;
}

// PHP 8.0: nullsafe operator
$country = $user?->address?->country;
// Если $user или $address = null → вернёт null (без ошибки)

// С методами
$city = $user?->getAddress()?->getCity();

// Цепочка
$street = $user?->address?->street ?? 'Не указана';
```

**Когда использовать:**
Для безопасного доступа к вложенным объектам.

**Пример из практики:**
```php
// Eloquent отношения
$departmentName = $user?->department?->name ?? 'Без департамента';

$managerEmail = $user?->department?->manager?->email;

// API Response
$data = json_decode($response->body());
$userId = $data?->user?->id;

// Blade шаблон
{{ $user?->profile?->avatar ?? '/default-avatar.png' }}

// Service
public function process(?User $user): void
{
    $this->logger->info('User email', [
        'email' => $user?->email ?? 'N/A',
    ]);
}
```

**На собеседовании скажешь:**
> "Nullsafe ?-> (PHP 8.0) — безопасный доступ. Если объект null → вернёт null без ошибки. $user?->address?->city. Удобно для Eloquent отношений, API responses."

---

## Constructor Property Promotion (PHP 8.0)

**Что это:**
Короткий синтаксис объявления свойств в конструкторе.

**Как работает:**
```php
// До PHP 8.0
class User
{
    private string $name;
    private string $email;
    private int $age;

    public function __construct(string $name, string $email, int $age)
    {
        $this->name = $name;
        $this->email = $email;
        $this->age = $age;
    }
}

// PHP 8.0: Property Promotion
class User
{
    public function __construct(
        private string $name,
        private string $email,
        private int $age,
    ) {}  // Короче!
}

// Смешанный стиль (можно)
class User
{
    private string $createdAt;

    public function __construct(
        private string $name,
        private string $email,
    ) {
        $this->createdAt = date('Y-m-d H:i:s');
    }
}
```

**Когда использовать:**
**Всегда** для простых конструкторов (DTO, Value Objects, Services).

**Пример из практики:**
```php
// DTO
readonly class CreateUserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}
}

// Value Object
class Money
{
    public function __construct(
        public readonly int $amount,
        public readonly string $currency,
    ) {}

    public function add(Money $other): Money
    {
        return new Money($this->amount + $other->amount, $this->currency);
    }
}

// Service с DI
class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private PaymentGateway $gateway,
        private LoggerInterface $logger,
    ) {}

    public function create(array $data): Order
    {
        $this->logger->info('Creating order');
        return $this->repository->create($data);
    }
}
```

**На собеседовании скажешь:**
> "Constructor Property Promotion (PHP 8.0) — короткий синтаксис. Объявление свойства в параметрах конструктора: private string $name. Удобно для DTO, Value Objects, Services с DI."

---

## Readonly Properties (PHP 8.1)

**Что это:**
Свойства, которые можно установить только один раз.

**Как работает:**
```php
class User
{
    public function __construct(
        public readonly string $name,
        public readonly int $id,
    ) {}
}

$user = new User('Иван', 1);
echo $user->name;  // "Иван"
$user->name = 'Пётр';  // ❌ Error: Cannot modify readonly property

// readonly class (PHP 8.2)
readonly class Money
{
    public function __construct(
        public int $amount,
        public string $currency,
    ) {}
}
// Все свойства автоматически readonly
```

**Когда использовать:**
Для неизменяемых данных (DTO, Value Objects, Events).

**Пример из практики:**
```php
// Event
readonly class OrderCreated
{
    public function __construct(
        public Order $order,
        public \DateTimeImmutable $createdAt,
    ) {}
}

// DTO
readonly class RegisterUserRequest
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}
}

// Value Object
readonly class Email
{
    public string $value;

    public function __construct(string $email)
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email');
        }

        $this->value = strtolower($email);
    }
}
```

**На собеседовании скажешь:**
> "readonly (PHP 8.1) — свойство устанавливается один раз. readonly class (PHP 8.2) — все свойства readonly. Использую для DTO, Value Objects, Events. Гарантия иммутабельности."

---

## Enums (PHP 8.1)

**Что это:**
Перечисления — набор фиксированных значений.

**Как работает:**
```php
// PHP 8.1: Enum
enum Status
{
    case Pending;
    case Paid;
    case Shipped;
    case Delivered;
}

$status = Status::Pending;

// С backing value (string/int)
enum Status: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
}

$status = Status::Paid;
echo $status->value;  // "paid"
echo $status->name;   // "Paid"

// Сравнение
if ($order->status === Status::Paid) {
    // Оплачен
}

// match с Enum
$badge = match($order->status) {
    Status::Pending => 'badge-warning',
    Status::Paid => 'badge-info',
    Status::Shipped => 'badge-primary',
    Status::Delivered => 'badge-success',
};

// Методы в Enum
enum Status: string
{
    case Pending = 'pending';
    case Paid = 'paid';

    public function label(): string
    {
        return match($this) {
            self::Pending => 'В ожидании',
            self::Paid => 'Оплачено',
        };
    }

    public function color(): string
    {
        return match($this) {
            self::Pending => 'yellow',
            self::Paid => 'green',
        };
    }
}

echo Status::Paid->label();  // "Оплачено"
echo Status::Paid->color();  // "green"
```

**Когда использовать:**
Для статусов, типов, режимов вместо констант класса.

**Пример из практики:**
```php
// Laravel Model
enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match($this) {
            self::Pending => 'В ожидании',
            self::Paid => 'Оплачено',
            self::Shipped => 'Отправлено',
            self::Delivered => 'Доставлено',
            self::Cancelled => 'Отменено',
        };
    }
}

class Order extends Model
{
    protected $casts = [
        'status' => OrderStatus::class,  // Автоматический cast
    ];
}

$order = Order::find(1);
if ($order->status === OrderStatus::Paid) {
    // Оплачен
}

echo $order->status->label();  // "Оплачено"

// Blade
<span class="badge-{{ $order->status->value }}">
    {{ $order->status->label() }}
</span>

// Миграция
$table->enum('status', ['pending', 'paid', 'shipped', 'delivered', 'cancelled']);

// Validation
'status' => ['required', Rule::enum(OrderStatus::class)],
```

**На собеседовании скажешь:**
> "Enum (PHP 8.1) — набор фиксированных значений. Backed Enum с string/int. Методы в Enum. В Laravel использую для статусов, типов. Casting в моделях, Rule::enum для валидации."

---

## Другие новшества PHP 8.x

**PHP 8.0:**
- **throw в выражениях**: `$value = $data['key'] ?? throw new Exception();`
- **str_contains()**, **str_starts_with()**, **str_ends_with()**
- **fdiv()** — деление с плавающей точкой (не ошибка при делении на 0)
- **get_debug_type()** — лучше gettype()

**PHP 8.1:**
- **Intersection Types**: `function save(Countable&Iterator $collection)`
- **never type**: `function redirect(): never { exit; }`
- **Final константы класса**
- **Fibers** — легковесные потоки (для async)

**PHP 8.2:**
- **readonly class** — все свойства readonly
- **Disjunctive Normal Form (DNF)** types: `(A&B)|C`
- **true type** — только true (не bool)

**Пример из практики:**
```php
// throw в выражении
$user = User::find($id) ?? throw new NotFoundException("User {$id} not found");

// str_* функции
if (str_contains($email, '@gmail.com')) {
    // Gmail
}

if (str_starts_with($url, 'https://')) {
    // Безопасное соединение
}

// never type (PHP 8.1)
function redirect(string $url): never
{
    header("Location: {$url}");
    exit;
}

function fail(string $message): never
{
    throw new Exception($message);
}

// readonly class (PHP 8.2)
readonly class UserDTO
{
    public function __construct(
        public string $name,
        public string $email,
    ) {}
}
```

**На собеседовании скажешь:**
> "PHP 8.0: named arguments, union types, match, ?->, property promotion. PHP 8.1: readonly, enum, never type. PHP 8.2: readonly class, DNF types. В Laravel активно использую все эти возможности."

---

## Резюме PHP 8.x

**PHP 8.0:**
- **Named Arguments** — передача по имени
- **Union Types** — int|string|null
- **Match** — улучшенный switch
- **Nullsafe ?->** — безопасный доступ
- **Property Promotion** — короткий синтаксис конструктора
- **Attributes** — метаданные (#[Attr])

**PHP 8.1:**
- **readonly** — неизменяемые свойства
- **Enum** — перечисления
- **never** — никогда не возвращает
- **Intersection Types** — A&B
- **Fibers** — async

**PHP 8.2:**
- **readonly class** — все свойства readonly
- **DNF types** — (A&B)|C
- **true type**

**Важно на собесе:**
- Property Promotion + readonly — стандарт для DTO
- Enum вместо констант класса
- Match вместо switch
- ?-> для безопасного доступа
- Named Arguments для читаемости
- Laravel активно использует все возможности PHP 8.x

---

## Практические задания

### Задание 1: Создай DTO с PHP 8 возможностями

Создай readonly DTO для регистрации пользователя, используя Property Promotion, Union Types и Named Arguments.

<details>
<parameter name="Решение</summary>

```php
<?php

namespace App\DTO;

readonly class RegisterUserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
        public string|null $phone = null,
        public int|null $age = null,
        public array $roles = [],
    ) {}

    public static function fromRequest(Request $request): self
    {
        return new self(
            name: $request->input('name'),
            email: $request->input('email'),
            password: $request->input('password'),
            phone: $request->input('phone'),
            age: $request->integer('age'),
            roles: $request->input('roles', []),
        );
    }

    public static function fromArray(array $data): self
    {
        return new self(
            name: $data['name'],
            email: $data['email'],
            password: $data['password'],
            phone: $data['phone'] ?? null,
            age: $data['age'] ?? null,
            roles: $data['roles'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'email' => $this->email,
            'password' => $this->password,
            'phone' => $this->phone,
            'age' => $this->age,
            'roles' => $this->roles,
        ];
    }
}

// Использование
class UserService
{
    public function register(RegisterUserDTO $dto): User
    {
        $user = User::create([
            'name' => $dto->name,
            'email' => $dto->email,
            'password' => Hash::make($dto->password),
            'phone' => $dto->phone,
            'age' => $dto->age,
        ]);

        if (!empty($dto->roles)) {
            $user->roles()->attach($dto->roles);
        }

        return $user;
    }
}

// Controller
public function register(Request $request)
{
    $dto = RegisterUserDTO::fromRequest($request);

    $user = $this->userService->register($dto);

    return response()->json($user, 201);
}

// Нельзя изменить readonly свойства
$dto = new RegisterUserDTO('John', 'john@mail.com', 'password');
$dto->name = 'Jane';  // ❌ Error: Cannot modify readonly property
```
</details>

### Задание 2: Реализуй State Machine через Enum

Создай систему управления статусами заказа, используя Enum с методами и Match expression.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Processing = 'processing';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match($this) {
            self::Pending => 'В ожидании',
            self::Confirmed => 'Подтверждён',
            self::Processing => 'Обрабатывается',
            self::Shipped => 'Отправлен',
            self::Delivered => 'Доставлен',
            self::Cancelled => 'Отменён',
            self::Refunded => 'Возврат средств',
        };
    }

    public function color(): string
    {
        return match($this) {
            self::Pending => 'yellow',
            self::Confirmed, self::Processing => 'blue',
            self::Shipped => 'purple',
            self::Delivered => 'green',
            self::Cancelled, self::Refunded => 'red',
        };
    }

    public function canTransitionTo(OrderStatus $newStatus): bool
    {
        return match($this) {
            self::Pending => in_array($newStatus, [
                self::Confirmed,
                self::Cancelled,
            ]),
            self::Confirmed => in_array($newStatus, [
                self::Processing,
                self::Cancelled,
            ]),
            self::Processing => in_array($newStatus, [
                self::Shipped,
                self::Cancelled,
            ]),
            self::Shipped => in_array($newStatus, [
                self::Delivered,
            ]),
            self::Delivered => in_array($newStatus, [
                self::Refunded,
            ]),
            self::Cancelled, self::Refunded => false,
        };
    }

    public function allowedTransitions(): array
    {
        return match($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Processing, self::Cancelled],
            self::Processing => [self::Shipped, self::Cancelled],
            self::Shipped => [self::Delivered],
            self::Delivered => [self::Refunded],
            self::Cancelled, self::Refunded => [],
        };
    }

    public function isFinal(): bool
    {
        return match($this) {
            self::Delivered, self::Cancelled, self::Refunded => true,
            default => false,
        };
    }

    public function requiresPayment(): bool
    {
        return match($this) {
            self::Pending, self::Confirmed => true,
            default => false,
        };
    }
}

// Model
class Order extends Model
{
    protected $casts = [
        'status' => OrderStatus::class,
    ];

    public function transitionTo(OrderStatus $newStatus): void
    {
        if (!$this->status->canTransitionTo($newStatus)) {
            throw new \InvalidArgumentException(
                "Cannot transition from {$this->status->value} to {$newStatus->value}"
            );
        }

        $oldStatus = $this->status;

        $this->status = $newStatus;
        $this->save();

        event(new OrderStatusChanged($this, $oldStatus, $newStatus));
    }
}

// Service
class OrderService
{
    public function confirm(Order $order): void
    {
        $order->transitionTo(OrderStatus::Confirmed);

        // Отправить уведомление
        Notification::send($order->user, new OrderConfirmed($order));
    }

    public function ship(Order $order, string $trackingNumber): void
    {
        $order->transitionTo(OrderStatus::Shipped);
        $order->update(['tracking_number' => $trackingNumber]);

        Notification::send($order->user, new OrderShipped($order));
    }

    public function cancel(Order $order, string $reason): void
    {
        $order->transitionTo(OrderStatus::Cancelled);
        $order->update(['cancellation_reason' => $reason]);

        // Возврат средств если оплачен
        if ($order->isPaid()) {
            $this->refundPayment($order);
        }
    }
}

// Controller
public function updateStatus(Request $request, Order $order)
{
    $newStatus = OrderStatus::from($request->input('status'));

    if (!$order->status->canTransitionTo($newStatus)) {
        return response()->json([
            'error' => 'Invalid status transition',
            'current' => $order->status->value,
            'requested' => $newStatus->value,
            'allowed' => array_map(
                fn($s) => $s->value,
                $order->status->allowedTransitions()
            ),
        ], 422);
    }

    $order->transitionTo($newStatus);

    return response()->json([
        'message' => 'Status updated successfully',
        'order' => $order,
    ]);
}

// Blade
<span class="badge badge-{{ $order->status->color() }}">
    {{ $order->status->label() }}
</span>

@if(!$order->status->isFinal())
    <div class="actions">
        @foreach($order->status->allowedTransitions() as $transition)
            <button wire:click="transitionTo('{{ $transition->value }}')">
                {{ $transition->label() }}
            </button>
        @endforeach
    </div>
@endif
```
</details>

### Задание 3: Создай гибкий Query Builder с Named Arguments и Union Types

Реализуй Builder pattern с использованием Named Arguments и Union Types для гибких параметров.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\QueryBuilder;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class FluentQueryBuilder
{
    public function __construct(
        private Builder $query,
    ) {}

    public function filter(
        string|array|null $search = null,
        string|array|null $status = null,
        int|string|null $userId = null,
        \DateTimeInterface|string|null $dateFrom = null,
        \DateTimeInterface|string|null $dateTo = null,
        array $tags = [],
        bool $onlyActive = false,
    ): self {
        // Search
        if ($search !== null) {
            $searchTerms = is_array($search) ? $search : [$search];

            $this->query->where(function ($q) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $q->orWhere('title', 'like', "%{$term}%")
                      ->orWhere('description', 'like', "%{$term}%");
                }
            });
        }

        // Status
        if ($status !== null) {
            $statuses = is_array($status) ? $status : [$status];
            $this->query->whereIn('status', $statuses);
        }

        // User
        if ($userId !== null) {
            $this->query->where('user_id', $userId);
        }

        // Date range
        if ($dateFrom !== null) {
            $date = $dateFrom instanceof \DateTimeInterface
                ? $dateFrom->format('Y-m-d')
                : $dateFrom;

            $this->query->where('created_at', '>=', $date);
        }

        if ($dateTo !== null) {
            $date = $dateTo instanceof \DateTimeInterface
                ? $dateTo->format('Y-m-d')
                : $dateTo;

            $this->query->where('created_at', '<=', $date);
        }

        // Tags
        if (!empty($tags)) {
            $this->query->whereHas('tags', function ($q) use ($tags) {
                $q->whereIn('tags.id', $tags);
            });
        }

        // Only active
        if ($onlyActive) {
            $this->query->where('is_active', true);
        }

        return $this;
    }

    public function sort(
        string|array $orderBy = 'created_at',
        string $direction = 'desc',
    ): self {
        $columns = is_array($orderBy) ? $orderBy : [$orderBy];

        foreach ($columns as $column) {
            $this->query->orderBy($column, $direction);
        }

        return $this;
    }

    public function paginate(
        int $perPage = 15,
        int|null $page = null,
    ): \Illuminate\Pagination\LengthAwarePaginator {
        return $this->query->paginate(
            perPage: $perPage,
            page: $page,
        );
    }

    public function get(): Collection
    {
        return $this->query->get();
    }

    public function first(): mixed
    {
        return $this->query->first();
    }
}

// Service
class PostService
{
    public function search(array $params): \Illuminate\Pagination\LengthAwarePaginator
    {
        $builder = new FluentQueryBuilder(Post::query());

        return $builder
            ->filter(
                search: $params['search'] ?? null,
                status: $params['status'] ?? null,
                userId: $params['user_id'] ?? null,
                dateFrom: $params['date_from'] ?? null,
                dateTo: $params['date_to'] ?? null,
                tags: $params['tags'] ?? [],
                onlyActive: $params['only_active'] ?? false,
            )
            ->sort(
                orderBy: $params['order_by'] ?? 'created_at',
                direction: $params['direction'] ?? 'desc',
            )
            ->paginate(
                perPage: $params['per_page'] ?? 15,
                page: $params['page'] ?? null,
            );
    }
}

// Controller
public function index(Request $request)
{
    $posts = $this->postService->search([
        'search' => $request->input('q'),
        'status' => $request->input('status'),
        'user_id' => $request->integer('user_id'),
        'date_from' => $request->input('date_from'),
        'date_to' => $request->input('date_to'),
        'tags' => $request->input('tags', []),
        'only_active' => $request->boolean('only_active'),
        'order_by' => $request->input('order_by', 'created_at'),
        'direction' => $request->input('direction', 'desc'),
        'per_page' => $request->integer('per_page', 15),
    ]);

    return response()->json($posts);
}

// Или с Named Arguments напрямую
$posts = (new FluentQueryBuilder(Post::query()))
    ->filter(
        search: 'Laravel',
        status: ['published', 'draft'],
        onlyActive: true,
    )
    ->sort(orderBy: 'created_at', direction: 'desc')
    ->paginate(perPage: 20);
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
