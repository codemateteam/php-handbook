# 2.8 Область видимости (Visibility)

## Краткое резюме

> **Область видимости** — модификаторы доступа, определяющие видимость свойств и методов: public (везде), protected (класс + наследники), private (только класс).
>
> **Ключевые концепции:** инкапсуляция (сокрытие реализации), readonly свойства (PHP 8.1+), readonly класс (PHP 8.2+), константы класса с модификаторами (PHP 7.1+).
>
> **Важно:** Инкапсуляция — основной принцип ООП. Можно расширить видимость (protected → public), но нельзя сузить.

---

## Содержание

- [public, protected, private](#public-protected-private)
- [Области видимости в наследовании](#области-видимости-в-наследовании)
- [Изменение видимости при переопределении](#изменение-видимости-при-переопределении)
- [readonly свойства (PHP 8.1+)](#readonly-свойства-php-81)
- [readonly класс (PHP 8.2+)](#readonly-класс-php-82)
- [Константы класса и видимость](#константы-класса-и-видимость)
- [Инкапсуляция — принцип ООП](#инкапсуляция--принцип-ооп)
- [Резюме](#резюме-области-видимости)
- [Практические задания](#практические-задания)

---

## public, protected, private

**Что это:**
Модификаторы доступа, определяющие видимость свойств и методов.

**Как работает:**
```php
class User
{
    public string $name;          // Доступно везде
    protected string $email;      // Доступно в классе и наследниках
    private string $password;     // Доступно ТОЛЬКО в этом классе

    public function __construct(string $name, string $email, string $password)
    {
        $this->name = $name;
        $this->email = $email;
        $this->password = $password;
    }

    public function getEmail(): string  // public метод
    {
        return $this->email;
    }

    protected function hashPassword(string $password): string  // protected метод
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    private function validatePassword(string $password): bool  // private метод
    {
        return strlen($password) >= 8;
    }
}

$user = new User('Иван', 'ivan@mail.com', 'secret');

echo $user->name;                // ✅ OK (public)
echo $user->email;               // ❌ Error (protected)
echo $user->password;            // ❌ Error (private)

echo $user->getEmail();          // ✅ OK (public метод)
$user->hashPassword('pass');     // ❌ Error (protected)
$user->validatePassword('pass'); // ❌ Error (private)
```

**Когда использовать:**
- `public` — для внешнего API класса
- `protected` — для методов, доступных наследникам
- `private` — для внутренней реализации

**Пример из практики:**
```php
class Model
{
    protected array $attributes = [];  // protected — для наследников
    private array $original = [];      // private — только для Model

    public function getAttribute(string $key): mixed  // public API
    {
        return $this->attributes[$key] ?? null;
    }

    protected function setAttribute(string $key, mixed $value): void  // Для наследников
    {
        $this->attributes[$key] = $value;
    }

    private function syncOriginal(): void  // Внутренняя логика
    {
        $this->original = $this->attributes;
    }

    public function save(): bool
    {
        // Используем private метод
        $this->syncOriginal();
        return true;
    }
}

class User extends Model
{
    public function setName(string $name): void
    {
        $this->setAttribute('name', $name);  // ✅ OK (protected)
        // $this->syncOriginal();  // ❌ Error (private, не доступен в наследнике)
    }
}
```

**На собеседовании скажешь:**
> "public — доступно везде, protected — в классе и наследниках, private — только в текущем классе. Инкапсуляция: скрываю реализацию (private), открываю API (public), даю доступ наследникам (protected)."

---

## Области видимости в наследовании

**Что это:**
Как работают модификаторы при наследовании.

**Как работает:**
```php
class Animal
{
    public string $name;
    protected int $age;
    private string $secret;

    public function getAge(): int
    {
        return $this->age;
    }

    protected function calculateYears(): int
    {
        return $this->age * 7;  // Для собак
    }

    private function getSecret(): string
    {
        return $this->secret;
    }
}

class Dog extends Animal
{
    public function info(): string
    {
        $info = "Name: {$this->name}\n";       // ✅ public
        $info .= "Age: {$this->age}\n";        // ✅ protected (доступен)
        // $info .= $this->secret;             // ❌ private (НЕ доступен)

        $info .= $this->calculateYears();      // ✅ protected метод
        // $info .= $this->getSecret();        // ❌ private метод

        return $info;
    }

    // Можно переопределить protected
    protected function calculateYears(): int
    {
        return $this->age * 10;  // Для собак по-другому
    }

    // Нельзя переопределить private (это новый метод)
    private function getSecret(): string
    {
        return "Dog's secret";  // Это НОВЫЙ метод, не переопределение
    }
}
```

**Когда использовать:**
- `protected` для методов, которые должны быть доступны наследникам
- `private` для методов, которые не должны переопределяться

**Пример из практики:**
```php
// Eloquent Model
abstract class Model
{
    protected array $attributes = [];  // Наследники имеют доступ

    // public — внешний API
    public function getAttribute(string $key): mixed
    {
        return $this->attributes[$key] ?? null;
    }

    // protected — для переопределения в наследниках
    protected function castAttribute(string $key, mixed $value): mixed
    {
        // Приведение типов
        return $value;
    }

    // private — нельзя изменить в наследниках
    private function syncOriginalAttributes(): void
    {
        // Критичная логика, не должна изменяться
    }
}

class User extends Model
{
    // Переопределяем protected метод
    protected function castAttribute(string $key, mixed $value): mixed
    {
        if ($key === 'birth_date' && is_string($value)) {
            return new \DateTime($value);
        }

        return parent::castAttribute($key, $value);
    }

    // Не можем переопределить private syncOriginalAttributes()
}
```

**На собеседовании скажешь:**
> "Наследник имеет доступ к public и protected, но не к private. protected используется для методов, которые можно переопределить. private — для методов, которые не должны изменяться в наследниках."

---

## Изменение видимости при переопределении

**Что это:**
Можно расширить видимость (protected → public), но нельзя сузить (public → protected).

**Как работает:**
```php
class Animal
{
    protected function eat(): string
    {
        return "Eating";
    }

    public function sleep(): string
    {
        return "Sleeping";
    }
}

class Dog extends Animal
{
    // ✅ OK: расширение (protected → public)
    public function eat(): string
    {
        return "Dog eating";
    }

    // ❌ Fatal error: сужение (public → protected)
    protected function sleep(): string
    {
        return "Dog sleeping";
    }
}

// Правило: можно только расширять видимость
// private → protected → public (можно только вправо)
```

**Когда использовать:**
Редко нужно изменять видимость. Обычно проектируй API сразу правильно.

**Пример из практики:**
```php
// Базовый контроллер
class Controller
{
    protected function authorize(string $ability, mixed $model): void
    {
        if (!Gate::allows($ability, $model)) {
            abort(403);
        }
    }
}

// Конкретный контроллер
class PostController extends Controller
{
    // Расширяем видимость для использования в middleware
    public function authorize(string $ability, mixed $model): void
    {
        parent::authorize($ability, $model);
        Log::info("Authorization check", ['ability' => $ability]);
    }
}

// Middleware может вызвать
Route::post('/posts/{post}', function (Post $post) {
    app(PostController::class)->authorize('update', $post);
    // ...
});
```

**На собеседовании скажешь:**
> "Можно расширить видимость (protected → public), но нельзя сузить (public → protected). Это нарушает принцип подстановки Барбары Лисков (LSP). Проектируй API сразу с правильной видимостью."

---

## readonly свойства (PHP 8.1+)

**Что это:**
Свойства, которые можно установить только один раз (в конструкторе или при объявлении).

**Как работает:**
```php
class User
{
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly int $id,
    ) {}
}

$user = new User('Иван', 'ivan@mail.com', 1);

echo $user->name;  // "Иван" ✅
$user->name = 'Пётр';  // ❌ Error: Cannot modify readonly property

// Или
class Post
{
    public readonly string $slug;

    public function __construct(string $title)
    {
        $this->slug = Str::slug($title);  // ✅ OK (первая установка)
    }

    public function updateSlug(string $slug): void
    {
        $this->slug = $slug;  // ❌ Error (нельзя изменить)
    }
}
```

**Когда использовать:**
Для неизменяемых свойств (ID, slug, timestamps при создании), Value Objects.

**Пример из практики:**
```php
// Value Object
class Money
{
    public function __construct(
        public readonly int $amount,
        public readonly string $currency,
    ) {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }
    }

    public function add(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new \Exception('Currency mismatch');
        }

        // Создаём новый объект (иммутабельность)
        return new Money($this->amount + $other->amount, $this->currency);
    }
}

$price = new Money(1000, 'RUB');
// $price->amount = 2000;  // ❌ Error (readonly)

// DTO (Data Transfer Object)
readonly class CreateUserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}
}

$dto = new CreateUserDTO('Иван', 'ivan@mail.com', 'secret');
// Все свойства readonly (нельзя изменить)

// Event
class OrderCreated
{
    public function __construct(
        public readonly Order $order,
        public readonly \DateTimeImmutable $createdAt,
    ) {}
}

$event = new OrderCreated($order, new \DateTimeImmutable());
// $event->order = $anotherOrder;  // ❌ Error
```

**На собеседовании скажешь:**
> "readonly (PHP 8.1+) — свойство можно установить только один раз (в конструкторе). Использую для Value Objects (Money), DTO, Events. Обеспечивает иммутабельность данных."

---

## readonly класс (PHP 8.2+)

**Что это:**
Все свойства класса автоматически readonly.

**Как работает:**
```php
// PHP 8.2+
readonly class User
{
    public function __construct(
        public string $name,
        public string $email,
        public int $id,
    ) {}
}

// Эквивалентно:
class UserManual
{
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly int $id,
    ) {}
}

$user = new User('Иван', 'ivan@mail.com', 1);
// $user->name = 'Пётр';  // ❌ Error (все свойства readonly)
```

**Когда использовать:**
Для иммутабельных классов (DTO, Value Objects, Events).

**Пример из практики:**
```php
// DTO
readonly class RegisterUserRequest
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            $data['name'],
            $data['email'],
            $data['password'],
        );
    }
}

$request = RegisterUserRequest::fromArray($requestData);
// Гарантия: данные не изменятся

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

    public function __toString(): string
    {
        return $this->value;
    }
}

$email = new Email('IVAN@MAIL.COM');
// $email->value = 'changed';  // ❌ Error

// Event
readonly class UserRegistered
{
    public function __construct(
        public int $userId,
        public string $email,
        public \DateTimeImmutable $timestamp,
    ) {}
}
```

**На собеседовании скажешь:**
> "readonly class (PHP 8.2+) — все свойства автоматически readonly. Короче, чем писать readonly на каждом свойстве. Использую для DTO, Value Objects, Events — гарантия иммутабельности."

---

## Константы класса и видимость

**Что это:**
Константы класса могут иметь модификаторы (PHP 7.1+).

**Как работает:**
```php
class Config
{
    public const PUBLIC_CONST = 'public';
    protected const PROTECTED_CONST = 'protected';
    private const PRIVATE_CONST = 'private';

    public function getPrivateConst(): string
    {
        return self::PRIVATE_CONST;  // ✅ OK (внутри класса)
    }
}

echo Config::PUBLIC_CONST;        // ✅ "public"
echo Config::PROTECTED_CONST;     // ❌ Error (protected)
echo Config::PRIVATE_CONST;       // ❌ Error (private)

class ExtendedConfig extends Config
{
    public function getProtectedConst(): string
    {
        return self::PROTECTED_CONST;  // ✅ OK (наследник)
        // return self::PRIVATE_CONST;  // ❌ Error (private не доступен)
    }
}
```

**Когда использовать:**
- `public` — для констант, используемых извне
- `protected` — для констант, используемых в иерархии
- `private` — для констант, используемых только в классе

**Пример из практики:**
```php
class Order
{
    // public — клиент может использовать
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_SHIPPED = 'shipped';

    // protected — только для наследников
    protected const INTERNAL_STATUS_PROCESSING = 'processing';

    // private — только для Order
    private const DB_TABLE = 'orders';

    private string $status;

    public function markAsPaid(): void
    {
        $this->status = self::STATUS_PAID;
        // Используем private константу
        DB::table(self::DB_TABLE)->update([...]);
    }
}

// Клиент может использовать public
if ($order->status === Order::STATUS_PAID) {
    // ...
}

// HTTP статусы
class Response
{
    public const HTTP_OK = 200;
    public const HTTP_CREATED = 201;
    public const HTTP_NOT_FOUND = 404;

    protected const DEFAULT_STATUS = self::HTTP_OK;

    private const HEADERS_WHITELIST = ['Content-Type', 'Authorization'];

    public function send(int $status = self::DEFAULT_STATUS): void
    {
        // Используем protected константу
    }
}
```

**На собеседовании скажешь:**
> "Константы класса (PHP 7.1+) могут быть public, protected, private. public — для внешнего использования, protected — для иерархии, private — для класса. По умолчанию public."

---

## Инкапсуляция — принцип ООП

**Что это:**
Сокрытие внутренней реализации, предоставление публичного API.

**Как работает:**
```php
// ПЛОХО: нарушение инкапсуляции
class UserBad
{
    public string $name;
    public string $email;
    public string $password;  // Открытый доступ к паролю! ❌
}

$user = new UserBad();
$user->password = 'plain_password';  // Хранится открытым текстом ❌
echo $user->password;  // Можно прочитать ❌

// ХОРОШО: инкапсуляция
class User
{
    private string $name;
    private string $email;
    private string $passwordHash;  // Хеш, не пароль

    public function __construct(string $name, string $email, string $password)
    {
        $this->name = $name;
        $this->email = $email;
        $this->setPassword($password);  // Используем метод
    }

    // Геттеры (контролируемый доступ)
    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    // Пароль не открываем наружу!
    public function setPassword(string $password): void
    {
        if (strlen($password) < 8) {
            throw new \InvalidArgumentException('Password too short');
        }

        $this->passwordHash = password_hash($password, PASSWORD_DEFAULT);
    }

    public function checkPassword(string $password): bool
    {
        return password_verify($password, $this->passwordHash);
    }
}

$user = new User('Иван', 'ivan@mail.com', 'secret123');
// $user->password = 'plain';  // ❌ Нельзя (private)
echo $user->getName();  // ✅ OK (через getter)
$user->checkPassword('secret123');  // ✅ OK
```

**Когда использовать:**
**Всегда**. Скрывай реализацию, открывай только API.

**Пример из практики:**
```php
// Eloquent Model (инкапсуляция $attributes)
class User extends Model
{
    private array $attributes = [];  // Скрыто

    // Контролируемый доступ
    public function __get(string $key): mixed
    {
        // Можем добавить логику (cast, mutators)
        return $this->attributes[$key] ?? null;
    }

    public function __set(string $key, mixed $value): void
    {
        // Валидация, преобразование
        $this->attributes[$key] = $value;
    }

    protected function castAttribute(string $key): mixed
    {
        // Приведение типов
    }
}

// Payment Service (инкапсуляция API ключей)
class PaymentService
{
    private const API_KEY = 'secret_key';  // Скрыто
    private string $apiUrl;

    public function __construct(string $apiUrl)
    {
        $this->apiUrl = $apiUrl;
    }

    // Публичный API
    public function charge(int $amount): bool
    {
        return $this->sendRequest('/charge', ['amount' => $amount]);
    }

    // Внутренняя реализация (скрыта)
    private function sendRequest(string $endpoint, array $data): bool
    {
        // Используем self::API_KEY
        // Клиент не знает про детали реализации
        return true;
    }
}

$service = new PaymentService('https://api.example.com');
$service->charge(1000);  // Простой API
// $service->sendRequest();  // ❌ Нельзя (private)
```

**На собеседовании скажешь:**
> "Инкапсуляция — сокрытие реализации, предоставление публичного API. Делай свойства private, доступ через геттеры/сеттеры. Скрывай детали реализации (API ключи, алгоритмы), открывай только нужное."

---

## Резюме области видимости

**Основное:**
- `public` — доступно везде (внешний API)
- `protected` — доступно в классе и наследниках
- `private` — доступно только в текущем классе
- Наследник видит public и protected, но не private
- Можно расширить видимость (protected → public), но нельзя сузить
- `readonly` (PHP 8.1+) — свойство устанавливается один раз
- `readonly class` (PHP 8.2+) — все свойства readonly
- Константы класса (PHP 7.1+) могут быть public/protected/private

**Инкапсуляция:**
- Скрывай реализацию (private)
- Открывай API (public)
- Для наследников — protected

**Важно на собесе:**
- Инкапсуляция — основной принцип ООП
- readonly для Value Objects, DTO, Events
- private для внутренней логики, public для API
- Константы класса могут иметь модификаторы (PHP 7.1+)
- PHP 8.2: readonly class для иммутабельных классов

---

## Практические задания

### Задание 1: Инкапсуляция в User модели

Создай класс `User` с инкапсулированным паролем (хранится как хеш, доступ только через метод checkPassword).

<details>
<summary>Решение</summary>

```php
class User
{
    private string $passwordHash;
    private array $loginAttempts = [];

    public function __construct(
        private string $name,
        private string $email,
        string $password,
    ) {
        $this->setPassword($password);
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setPassword(string $password): void
    {
        if (!$this->validatePassword($password)) {
            throw new \InvalidArgumentException('Password must be at least 8 characters');
        }

        $this->passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $this->logPasswordChange();
    }

    public function checkPassword(string $password): bool
    {
        $this->recordLoginAttempt();

        if ($this->isTooManyAttempts()) {
            throw new \Exception('Too many login attempts. Account locked.');
        }

        $isValid = password_verify($password, $this->passwordHash);

        if ($isValid) {
            $this->resetLoginAttempts();
        }

        return $isValid;
    }

    private function validatePassword(string $password): bool
    {
        return strlen($password) >= 8;
    }

    private function logPasswordChange(): void
    {
        echo "Password changed at " . date('Y-m-d H:i:s') . "\n";
    }

    private function recordLoginAttempt(): void
    {
        $this->loginAttempts[] = time();
    }

    private function isTooManyAttempts(): bool
    {
        // Последние 5 попыток за последние 15 минут
        $recent = array_filter($this->loginAttempts, fn($time) => $time > time() - 900);
        return count($recent) >= 5;
    }

    private function resetLoginAttempts(): void
    {
        $this->loginAttempts = [];
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'email' => $this->email,
            // password НЕ включается в toArray (инкапсуляция)
        ];
    }
}

// Использование
$user = new User('Иван', 'ivan@example.com', 'secret123');

// ✅ OK
echo $user->getName();  // "Иван"
echo $user->getEmail(); // "ivan@example.com"

// ✅ OK
if ($user->checkPassword('secret123')) {
    echo "Login successful\n";
}

// ❌ Нельзя получить пароль напрямую
// echo $user->password;  // Error
// echo $user->passwordHash;  // Error (private)

// ✅ Можно изменить через метод (с валидацией)
$user->setPassword('newpassword123');
```
</details>

### Задание 2: readonly DTO и Value Object

Создай `OrderDTO` (readonly class) и `Money` (readonly properties) для иммутабельных данных.

<details>
<summary>Решение</summary>

```php
// PHP 8.2+ readonly class
readonly class CreateOrderDTO
{
    public function __construct(
        public int $userId,
        public array $items,
        public ?string $couponCode = null,
        public string $shippingAddress = '',
    ) {
        $this->validate();
    }

    private function validate(): void
    {
        if ($this->userId <= 0) {
            throw new \InvalidArgumentException('Invalid user ID');
        }

        if (empty($this->items)) {
            throw new \InvalidArgumentException('Order must have at least one item');
        }
    }

    public static function fromArray(array $data): self
    {
        return new self(
            userId: $data['user_id'],
            items: $data['items'],
            couponCode: $data['coupon_code'] ?? null,
            shippingAddress: $data['shipping_address'] ?? '',
        );
    }

    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'items' => $this->items,
            'coupon_code' => $this->couponCode,
            'shipping_address' => $this->shippingAddress,
        ];
    }
}

// PHP 8.1+ readonly properties
class Money
{
    public function __construct(
        public readonly int $amount,
        public readonly string $currency = 'RUB',
    ) {
        if ($amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }
    }

    public function add(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException('Currency mismatch');
        }

        // Создаём НОВЫЙ объект (иммутабельность)
        return new Money($this->amount + $other->amount, $this->currency);
    }

    public function multiply(int $factor): Money
    {
        return new Money($this->amount * $factor, $this->currency);
    }

    public function format(): string
    {
        return number_format($this->amount / 100, 2) . ' ' . $this->currency;
    }
}

// Использование
$dto = CreateOrderDTO::fromArray([
    'user_id' => 1,
    'items' => [
        ['product_id' => 10, 'quantity' => 2],
        ['product_id' => 20, 'quantity' => 1],
    ],
    'coupon_code' => 'SAVE10',
]);

echo $dto->userId;  // 1
// $dto->userId = 2;  // ❌ Error: Cannot modify readonly property

$price = new Money(100000, 'RUB');  // 1000.00 RUB
$tax = new Money(20000, 'RUB');     // 200.00 RUB

$total = $price->add($tax);  // 1200.00 RUB
echo $total->format();

// $price не изменился (иммутабельность)
echo $price->format();  // 1000.00 RUB

// $price->amount = 50000;  // ❌ Error: Cannot modify readonly property
```
</details>

### Задание 3: Константы класса с модификаторами

Создай класс `OrderStatus` с public, protected и private константами.

<details>
<summary>Решение</summary>

```php
class OrderStatus
{
    // public — доступны везде
    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const SHIPPED = 'shipped';
    public const DELIVERED = 'delivered';
    public const CANCELLED = 'cancelled';

    // protected — только в иерархии классов
    protected const INTERNAL_PROCESSING = 'processing';
    protected const INTERNAL_REFUNDING = 'refunding';

    // private — только в этом классе
    private const DB_TABLE = 'orders';
    private const CACHE_PREFIX = 'order:';

    private string $status;

    public function __construct()
    {
        $this->status = self::PENDING;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function markAsPaid(): void
    {
        if ($this->status !== self::PENDING) {
            throw new \Exception('Can only mark pending orders as paid');
        }

        $this->status = self::PAID;
        $this->logStatusChange(self::PAID);
    }

    public function ship(): void
    {
        if ($this->status !== self::PAID) {
            throw new \Exception('Can only ship paid orders');
        }

        $this->status = self::SHIPPED;
        $this->logStatusChange(self::SHIPPED);
    }

    protected function startProcessing(): void
    {
        $this->status = self::INTERNAL_PROCESSING;
        $this->logStatusChange(self::INTERNAL_PROCESSING);
    }

    private function logStatusChange(string $newStatus): void
    {
        // Используем private константу
        $cacheKey = self::CACHE_PREFIX . $this->getId();
        echo "Status changed to {$newStatus} (cached at {$cacheKey})\n";

        // Используем private константу
        echo "Updating table " . self::DB_TABLE . "\n";
    }

    private function getId(): int
    {
        return 123; // Упрощённо
    }

    public static function getAllStatuses(): array
    {
        return [
            self::PENDING,
            self::PAID,
            self::SHIPPED,
            self::DELIVERED,
            self::CANCELLED,
        ];
    }
}

class PriorityOrder extends OrderStatus
{
    public function processFast(): void
    {
        // ✅ OK: protected константа доступна
        $this->startProcessing();

        // ❌ Error: private константа недоступна
        // echo self::DB_TABLE;
    }

    protected function customProcessing(): void
    {
        // ✅ OK: protected константа
        $status = self::INTERNAL_PROCESSING;
    }
}

// Использование
$order = new OrderStatus();

// ✅ public константы доступны
echo "Available statuses:\n";
foreach (OrderStatus::getAllStatuses() as $status) {
    echo "- {$status}\n";
}

$order->markAsPaid();
// Status changed to paid (cached at order:123)
// Updating table orders

$order->ship();
// Status changed to shipped (cached at order:123)

// ❌ protected/private константы недоступны извне
// echo OrderStatus::INTERNAL_PROCESSING;  // Error
// echo OrderStatus::DB_TABLE;  // Error

// ✅ public константы доступны
if ($order->getStatus() === OrderStatus::SHIPPED) {
    echo "Order is shipped!\n";
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
