# 10.4 SOLID принципы

## Краткое резюме

> **SOLID** — 5 принципов объектно-ориентированного проектирования.
>
> **Принципы:** S (одна ответственность), O (расширение без изменения), L (замена подклассами), I (маленькие интерфейсы), D (зависимость от абстракций).
>
> **Важно:** Laravel автоматически применяет D через Service Container. Repository/Service паттерны следуют SOLID.

---

## Содержание

- [Что это](#что-это)
- [Single Responsibility](#single-responsibility-одна-ответственность)
- [Open/Closed](#openclosed-открыт-для-расширения-закрыт-для-изменения)
- [Liskov Substitution](#liskov-substitution-подстановка-лисков)
- [Interface Segregation](#interface-segregation-разделение-интерфейсов)
- [Dependency Inversion](#dependency-inversion-инверсия-зависимостей)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
SOLID — 5 принципов объектно-ориентированного проектирования для гибкого и поддерживаемого кода.

**Принципы:**
- **S** - Single Responsibility
- **O** - Open/Closed
- **L** - Liskov Substitution
- **I** - Interface Segregation
- **D** - Dependency Inversion

---

## Single Responsibility (одна ответственность)

Класс должен иметь только одну причину для изменения.

```php
// ❌ ПЛОХО: класс делает всё
class User
{
    public function save() { /* БД */ }
    public function sendEmail() { /* Email */ }
    public function generateReport() { /* PDF */ }
}

// ✅ ХОРОШО: разделение ответственности
class User { /* только данные */ }
class UserRepository { public function save(User $user) {} }
class MailService { public function sendWelcome(User $user) {} }
class ReportGenerator { public function generate(User $user) {} }
```

---

## Open/Closed (открыт для расширения, закрыт для изменения)

Можно расширять поведение, не изменяя существующий код.

```php
// ❌ ПЛОХО: нужно менять класс для нового типа
class PaymentProcessor
{
    public function process($type, $amount)
    {
        if ($type === 'credit_card') {
            // ...
        } elseif ($type === 'paypal') {
            // ...
        }
        // Добавление нового типа = изменение класса
    }
}

// ✅ ХОРОШО: новый тип = новый класс
interface PaymentMethod
{
    public function charge(float $amount): bool;
}

class CreditCardPayment implements PaymentMethod
{
    public function charge(float $amount): bool { /* ... */ }
}

class PayPalPayment implements PaymentMethod
{
    public function charge(float $amount): bool { /* ... */ }
}

class PaymentProcessor
{
    public function process(PaymentMethod $method, float $amount)
    {
        return $method->charge($amount);
    }
}
```

---

## Liskov Substitution (подстановка Лисков)

Подклассы должны заменять базовые классы без изменения поведения.

```php
// ❌ ПЛОХО: нарушение LSP
class Rectangle
{
    protected $width;
    protected $height;

    public function setWidth($width) { $this->width = $width; }
    public function setHeight($height) { $this->height = $height; }
    public function area() { return $this->width * $this->height; }
}

class Square extends Rectangle
{
    public function setWidth($width) {
        $this->width = $this->height = $width; // Изменяет поведение
    }
}

// ✅ ХОРОШО: отдельные классы
interface Shape
{
    public function area(): float;
}

class Rectangle implements Shape
{
    public function __construct(
        private float $width,
        private float $height
    ) {}

    public function area(): float {
        return $this->width * $this->height;
    }
}

class Square implements Shape
{
    public function __construct(private float $side) {}

    public function area(): float {
        return $this->side * $this->side;
    }
}
```

---

## Interface Segregation (разделение интерфейсов)

Много специфичных интерфейсов лучше, чем один общий.

```php
// ❌ ПЛОХО: большой интерфейс
interface Worker
{
    public function work();
    public function eat();
    public function sleep();
}

class Robot implements Worker
{
    public function work() { /* OK */ }
    public function eat() { /* Робот не ест! */ }
    public function sleep() { /* Робот не спит! */ }
}

// ✅ ХОРОШО: маленькие интерфейсы
interface Workable
{
    public function work();
}

interface Eatable
{
    public function eat();
}

class Human implements Workable, Eatable
{
    public function work() { /* ... */ }
    public function eat() { /* ... */ }
}

class Robot implements Workable
{
    public function work() { /* ... */ }
}
```

---

## Dependency Inversion (инверсия зависимостей)

Зависеть от абстракций, а не от конкретных реализаций.

```php
// ❌ ПЛОХО: зависимость от конкретного класса
class OrderService
{
    private MySQLOrderRepository $repository;

    public function __construct()
    {
        $this->repository = new MySQLOrderRepository(); // Жёсткая связь
    }
}

// ✅ ХОРОШО: зависимость от интерфейса
interface OrderRepository
{
    public function save(Order $order): void;
}

class MySQLOrderRepository implements OrderRepository
{
    public function save(Order $order): void { /* ... */ }
}

class OrderService
{
    public function __construct(
        private OrderRepository $repository // Интерфейс
    ) {}
}

// Service Container внедряет реализацию
$this->app->bind(OrderRepository::class, MySQLOrderRepository::class);
```

---

## На собеседовании скажешь

> "SOLID: S — один класс = одна ответственность. O — расширение через наследование/интерфейсы, не изменение кода. L — подклассы заменяют базовые без поломки. I — маленькие специфичные интерфейсы. D — зависимость от абстракций (интерфейсов), не конкретных классов. Laravel: DI через Service Container автоматически применяет D. Repository/Service паттерны следуют SOLID."

---

## Практические задания

### Задание 1: Исправь нарушение SRP

Этот класс делает слишком много. Раздели его по принципу Single Responsibility.

```php
class User extends Model
{
    public function save(array $options = [])
    {
        // Сохранение в БД
        parent::save($options);

        // Отправка email
        Mail::to($this->email)->send(new WelcomeEmail($this));

        // Логирование
        Log::info("User {$this->id} saved");

        // Очистка кеша
        Cache::forget("user.{$this->id}");
    }
}
```

<details>
<summary>Решение</summary>

```php
// Разделяем ответственности:

// 1. Model — только данные
class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];
}

// 2. Repository — работа с БД
class UserRepository
{
    public function save(User $user): User
    {
        $user->save();
        return $user;
    }
}

// 3. MailService — отправка email
class MailService
{
    public function sendWelcome(User $user): void
    {
        Mail::to($user->email)->send(new WelcomeEmail($user));
    }
}

// 4. CacheService — работа с кешем
class CacheService
{
    public function forgetUser(int $userId): void
    {
        Cache::forget("user.{$userId}");
    }
}

// 5. Service — координация
class UserService
{
    public function __construct(
        private UserRepository $repository,
        private MailService $mailService,
        private CacheService $cache
    ) {}

    public function create(array $data): User
    {
        $user = new User($data);
        $this->repository->save($user);

        $this->mailService->sendWelcome($user);
        $this->cache->forgetUser($user->id);

        Log::info("User {$user->id} created");

        return $user;
    }
}
```
</details>

### Задание 2: Примени Open/Closed принцип

Добавь новый тип уведомления без изменения существующего кода.

```php
class NotificationService
{
    public function send(string $type, User $user, string $message)
    {
        if ($type === 'email') {
            Mail::to($user->email)->send(new Notification($message));
        } elseif ($type === 'sms') {
            // SMS logic
        }
        // Добавление нового типа = изменение класса ❌
    }
}
```

<details>
<summary>Решение</summary>

```php
// 1. Создаём интерфейс
interface NotificationChannel
{
    public function send(User $user, string $message): void;
}

// 2. Реализации для каждого канала
class EmailChannel implements NotificationChannel
{
    public function send(User $user, string $message): void
    {
        Mail::to($user->email)->send(new Notification($message));
    }
}

class SmsChannel implements NotificationChannel
{
    public function send(User $user, string $message): void
    {
        // SMS logic
    }
}

// 3. Новый канал — просто новый класс (без изменения существующего!)
class PushChannel implements NotificationChannel
{
    public function send(User $user, string $message): void
    {
        // Push notification logic
    }
}

class SlackChannel implements NotificationChannel
{
    public function send(User $user, string $message): void
    {
        // Slack webhook logic
    }
}

// 4. Service работает с интерфейсом
class NotificationService
{
    public function __construct(
        private NotificationChannel $channel
    ) {}

    public function send(User $user, string $message): void
    {
        $this->channel->send($user, $message);
    }
}

// 5. Регистрация в ServiceProvider
$this->app->bind(NotificationChannel::class, function ($app) {
    return match (config('notifications.default')) {
        'email' => new EmailChannel(),
        'sms' => new SmsChannel(),
        'push' => new PushChannel(),
        'slack' => new SlackChannel(),
    };
});
```
</details>

### Задание 3: Исправь нарушение Interface Segregation

Упрости интерфейс, разделив его на маленькие.

```php
interface Animal
{
    public function walk();
    public function fly();
    public function swim();
}

class Dog implements Animal
{
    public function walk() { /* OK */ }
    public function fly() { /* Собака не летает! */ }
    public function swim() { /* OK */ }
}
```

<details>
<summary>Решение</summary>

```php
// Разделяем на специфичные интерфейсы:

interface Walkable
{
    public function walk(): void;
}

interface Flyable
{
    public function fly(): void;
}

interface Swimmable
{
    public function swim(): void;
}

// Каждый класс реализует только нужные интерфейсы
class Dog implements Walkable, Swimmable
{
    public function walk(): void
    {
        echo "Dog is walking";
    }

    public function swim(): void
    {
        echo "Dog is swimming";
    }
}

class Bird implements Walkable, Flyable
{
    public function walk(): void
    {
        echo "Bird is walking";
    }

    public function fly(): void
    {
        echo "Bird is flying";
    }
}

class Fish implements Swimmable
{
    public function swim(): void
    {
        echo "Fish is swimming";
    }
}

class Duck implements Walkable, Flyable, Swimmable
{
    public function walk(): void { }
    public function fly(): void { }
    public function swim(): void { }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
