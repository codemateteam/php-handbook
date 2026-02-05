# 11.3 Поведенческие паттерны (Behavioral Patterns)

## Краткое резюме

> **Behavioral Patterns** — паттерны для эффективной коммуникации между объектами и распределения обязанностей.
>
> **Основные:** Strategy (взаимозаменяемые алгоритмы), Observer (уведомление зависимых), Command (инкапсуляция запроса), Chain of Responsibility (цепочка обработчиков), Template Method (скелет алгоритма).
>
> **Laravel примеры:** Validation rules (Strategy), Events/Listeners (Observer), Jobs/Queue (Command), Middleware (Chain of Responsibility).

---

## Содержание

- [Что это](#что-это)
- [Strategy](#1-strategy-стратегия)
- [Observer](#2-observer-наблюдатель)
- [Command](#3-command-команда)
- [Chain of Responsibility](#4-chain-of-responsibility-цепочка-обязанностей)
- [Template Method](#5-template-method-шаблонный-метод)
- [Iterator](#6-iterator-итератор)
- [Сравнение](#сравнение)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Behavioral Patterns:**
Паттерны для эффективной коммуникации между объектами и распределения обязанностей.

**Зачем:**
- Гибкая коммуникация между объектами
- Инкапсуляция поведения
- Слабое связывание

**Основные паттерны:**
1. Strategy
2. Observer
3. Command
4. Chain of Responsibility
5. Template Method
6. Iterator
7. State
8. Mediator

---

## 1. Strategy (Стратегия)

**Что это:**
Определяет семейство алгоритмов, инкапсулирует каждый и делает взаимозаменяемыми.

**Когда использовать:**
- Много похожих классов отличающихся только поведением
- Нужны разные варианты алгоритма
- Избежать условных операторов

**Проблема без Strategy:**

```php
class OrderProcessor
{
    public function process(Order $order, string $shippingType)
    {
        // Плохо: switch для каждого типа
        switch ($shippingType) {
            case 'standard':
                $cost = 5;
                $days = 5;
                break;
            case 'express':
                $cost = 15;
                $days = 2;
                break;
            case 'overnight':
                $cost = 30;
                $days = 1;
                break;
        }

        $order->shipping_cost = $cost;
        $order->delivery_days = $days;
    }
}
```

**Решение: Strategy**

```php
interface ShippingStrategy
{
    public function calculate(Order $order): array;
}

class StandardShipping implements ShippingStrategy
{
    public function calculate(Order $order): array
    {
        return [
            'cost' => 5,
            'days' => 5,
        ];
    }
}

class ExpressShipping implements ShippingStrategy
{
    public function calculate(Order $order): array
    {
        return [
            'cost' => 15,
            'days' => 2,
        ];
    }
}

class OvernightShipping implements ShippingStrategy
{
    public function calculate(Order $order): array
    {
        return [
            'cost' => 30,
            'days' => 1,
        ];
    }
}

class OrderProcessor
{
    public function __construct(
        private ShippingStrategy $shippingStrategy
    ) {}

    public function process(Order $order): void
    {
        $shipping = $this->shippingStrategy->calculate($order);

        $order->shipping_cost = $shipping['cost'];
        $order->delivery_days = $shipping['days'];
        $order->save();
    }
}

// Использование
$strategy = new ExpressShipping();
$processor = new OrderProcessor($strategy);
$processor->process($order);
```

**Laravel Validation Rules = Strategy:**

```php
// Каждое правило = стратегия
$request->validate([
    'email' => ['required', 'email', 'unique:users'],
    'password' => ['required', 'min:8', 'confirmed'],
]);

// Custom strategy
class CustomRule implements Rule
{
    public function passes($attribute, $value)
    {
        return $value === 'valid';
    }

    public function message()
    {
        return 'The :attribute must be valid.';
    }
}
```

---

## 2. Observer (Наблюдатель)

**Что это:**
Определяет зависимость один-ко-многим так что при изменении состояния одного объекта все зависимые уведомляются.

**Когда использовать:**
- Один объект должен уведомлять другие об изменениях
- Объекты слабо связаны
- Event-driven архитектура

**Реализация:**

```php
interface Observer
{
    public function update(Subject $subject): void;
}

interface Subject
{
    public function attach(Observer $observer): void;
    public function detach(Observer $observer): void;
    public function notify(): void;
}

class Order implements Subject
{
    private array $observers = [];
    private string $status;

    public function attach(Observer $observer): void
    {
        $this->observers[] = $observer;
    }

    public function detach(Observer $observer): void
    {
        $key = array_search($observer, $this->observers, true);
        if ($key !== false) {
            unset($this->observers[$key]);
        }
    }

    public function notify(): void
    {
        foreach ($this->observers as $observer) {
            $observer->update($this);
        }
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
        $this->notify();  // Уведомить observers
    }

    public function getStatus(): string
    {
        return $this->status;
    }
}

class EmailNotificationObserver implements Observer
{
    public function update(Subject $subject): void
    {
        if ($subject instanceof Order) {
            echo "Email: Order status changed to {$subject->getStatus()}\n";
        }
    }
}

class SmsNotificationObserver implements Observer
{
    public function update(Subject $subject): void
    {
        if ($subject instanceof Order) {
            echo "SMS: Order status changed to {$subject->getStatus()}\n";
        }
    }
}

// Использование
$order = new Order();
$order->attach(new EmailNotificationObserver());
$order->attach(new SmsNotificationObserver());

$order->setStatus('shipped');  // Оба observers уведомлены
```

**Laravel Events = Observer Pattern:**

```php
// Event
class OrderShipped
{
    public function __construct(public Order $order) {}
}

// Observers (Listeners)
class SendShipmentNotification
{
    public function handle(OrderShipped $event)
    {
        Mail::to($event->order->user)->send(new OrderShippedEmail($event->order));
    }
}

class UpdateInventory
{
    public function handle(OrderShipped $event)
    {
        foreach ($event->order->items as $item) {
            $item->product->decrement('stock', $item->quantity);
        }
    }
}

// Регистрация
Event::listen(OrderShipped::class, [
    SendShipmentNotification::class,
    UpdateInventory::class,
]);

// Trigger
event(new OrderShipped($order));  // Все listeners уведомлены
```

---

## 3. Command (Команда)

**Что это:**
Инкапсулирует запрос как объект, позволяя параметризовать клиентов с разными запросами, ставить в очередь или логировать.

**Когда использовать:**
- Параметризовать объекты с операциями
- Undo/Redo функциональность
- Очередь операций
- Логирование операций

**Реализация:**

```php
interface Command
{
    public function execute(): void;
    public function undo(): void;
}

class Order
{
    public string $status = 'pending';
}

class PlaceOrderCommand implements Command
{
    private string $previousStatus;

    public function __construct(private Order $order) {}

    public function execute(): void
    {
        $this->previousStatus = $this->order->status;
        $this->order->status = 'placed';
        echo "Order placed\n";
    }

    public function undo(): void
    {
        $this->order->status = $this->previousStatus;
        echo "Order placement undone\n";
    }
}

class ShipOrderCommand implements Command
{
    private string $previousStatus;

    public function __construct(private Order $order) {}

    public function execute(): void
    {
        $this->previousStatus = $this->order->status;
        $this->order->status = 'shipped';
        echo "Order shipped\n";
    }

    public function undo(): void
    {
        $this->order->status = $this->previousStatus;
        echo "Order shipment undone\n";
    }
}

class CommandInvoker
{
    private array $history = [];

    public function execute(Command $command): void
    {
        $command->execute();
        $this->history[] = $command;
    }

    public function undo(): void
    {
        $command = array_pop($this->history);
        if ($command) {
            $command->undo();
        }
    }
}

// Использование
$order = new Order();
$invoker = new CommandInvoker();

$invoker->execute(new PlaceOrderCommand($order));
$invoker->execute(new ShipOrderCommand($order));

$invoker->undo();  // Отменить shipment
$invoker->undo();  // Отменить placement
```

**Laravel Jobs = Command Pattern:**

```php
// Job = Command
class SendEmailJob implements ShouldQueue
{
    public function __construct(
        private User $user,
        private string $message
    ) {}

    public function handle(): void
    {
        Mail::to($this->user)->send(new GenericEmail($this->message));
    }
}

// Invoker = Queue
SendEmailJob::dispatch($user, 'Hello');

// Параметризация, очередь, retry - всё как в Command Pattern
```

---

## 4. Chain of Responsibility (Цепочка обязанностей)

**Что это:**
Избегает привязки отправителя запроса к получателю, давая возможность обработать запрос нескольким объектам.

**Когда использовать:**
- Несколько объектов могут обработать запрос
- Обработчик заранее неизвестен
- Набор обработчиков динамический

**Реализация:**

```php
abstract class Handler
{
    private ?Handler $nextHandler = null;

    public function setNext(Handler $handler): Handler
    {
        $this->nextHandler = $handler;
        return $handler;
    }

    public function handle(Request $request): ?Response
    {
        $response = $this->process($request);

        if ($response === null && $this->nextHandler !== null) {
            return $this->nextHandler->handle($request);
        }

        return $response;
    }

    abstract protected function process(Request $request): ?Response;
}

class AuthenticationHandler extends Handler
{
    protected function process(Request $request): ?Response
    {
        if (!$request->hasToken()) {
            return new Response('Unauthorized', 401);
        }

        // Authenticated, передать дальше
        return null;
    }
}

class AuthorizationHandler extends Handler
{
    protected function process(Request $request): ?Response
    {
        if (!$request->hasPermission()) {
            return new Response('Forbidden', 403);
        }

        return null;
    }
}

class ValidationHandler extends Handler
{
    protected function process(Request $request): ?Response
    {
        if (!$request->isValid()) {
            return new Response('Invalid data', 422);
        }

        return null;
    }
}

class ActionHandler extends Handler
{
    protected function process(Request $request): ?Response
    {
        // Actual business logic
        return new Response('Success', 200);
    }
}

// Использование: строим цепочку
$chain = new AuthenticationHandler();
$chain->setNext(new AuthorizationHandler())
      ->setNext(new ValidationHandler())
      ->setNext(new ActionHandler());

$response = $chain->handle($request);
```

**Laravel Middleware = Chain of Responsibility:**

```php
// Каждый middleware = handler в цепочке
class Authenticate
{
    public function handle(Request $request, Closure $next)
    {
        if (!auth()->check()) {
            return redirect('/login');
        }

        return $next($request);  // Передать следующему
    }
}

class VerifyEmail
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->user()->hasVerifiedEmail()) {
            return redirect('/verify-email');
        }

        return $next($request);
    }
}

// Route = цепочка
Route::middleware(['auth', 'verified', 'throttle:60,1'])
    ->get('/dashboard', [DashboardController::class, 'index']);
```

---

## 5. Template Method (Шаблонный метод)

**Что это:**
Определяет скелет алгоритма, перекладывая некоторые шаги на подклассы.

**Когда использовать:**
- Общий алгоритм с вариациями в шагах
- Избежать дублирования

**Реализация:**

```php
abstract class DataImporter
{
    // Template method (скелет)
    public function import(string $file): void
    {
        $data = $this->readFile($file);
        $validated = $this->validate($data);
        $transformed = $this->transform($validated);
        $this->save($transformed);
    }

    abstract protected function readFile(string $file): array;
    abstract protected function validate(array $data): array;
    abstract protected function transform(array $data): array;
    abstract protected function save(array $data): void;
}

class CsvImporter extends DataImporter
{
    protected function readFile(string $file): array
    {
        return array_map('str_getcsv', file($file));
    }

    protected function validate(array $data): array
    {
        return array_filter($data, fn($row) => count($row) === 3);
    }

    protected function transform(array $data): array
    {
        return array_map(fn($row) => [
            'name' => $row[0],
            'email' => $row[1],
            'phone' => $row[2],
        ], $data);
    }

    protected function save(array $data): void
    {
        DB::table('users')->insert($data);
    }
}

class JsonImporter extends DataImporter
{
    protected function readFile(string $file): array
    {
        return json_decode(file_get_contents($file), true);
    }

    protected function validate(array $data): array
    {
        return array_filter($data, fn($row) => isset($row['email']));
    }

    protected function transform(array $data): array
    {
        return $data;  // Already in correct format
    }

    protected function save(array $data): void
    {
        DB::table('users')->insert($data);
    }
}

// Использование
$importer = new CsvImporter();
$importer->import('users.csv');
```

---

## 6. Iterator (Итератор)

**Что это:**
Предоставляет способ последовательного доступа к элементам без раскрытия внутренней структуры.

**Laravel Collections = Iterator:**

```php
$users = User::all();  // Collection implements Iterator

foreach ($users as $user) {
    echo $user->name;
}

// Методы iterator
$users->each(fn($user) => $user->notify());
$users->map(fn($user) => $user->email);
$users->filter(fn($user) => $user->isActive());
```

---

## Сравнение

| Pattern | Use Case | Laravel Example |
|---------|----------|-----------------|
| Strategy | Взаимозаменяемые алгоритмы | Validation rules |
| Observer | Уведомление зависимых объектов | Events & Listeners |
| Command | Инкапсуляция запроса | Jobs, Queue |
| Chain of Responsibility | Цепочка обработчиков | Middleware |
| Template Method | Общий алгоритм, вариации шагов | Import classes |
| Iterator | Обход коллекции | Collections |

---

## На собеседовании скажешь

> "Behavioral Patterns для коммуникации между объектами. Strategy: взаимозаменяемые алгоритмы, Laravel Validation rules пример. Observer: один-ко-многим уведомления, Laravel Events/Listeners. Command: инкапсуляция запроса как объект, Laravel Jobs для queue. Chain of Responsibility: цепочка обработчиков, Middleware пример. Template Method: скелет алгоритма с вариациями в шагах. Iterator: обход коллекции, Laravel Collections. Strategy, Observer, Command наиболее популярны. Middleware = Chain of Responsibility, Events = Observer, Jobs = Command."

---

## Практические задания

### Задание 1: Реализуй Strategy Pattern

Создай систему для расчёта скидок: `NoDiscount`, `PercentageDiscount`, `FixedDiscount`. Используй Strategy Pattern.

<details>
<summary>Решение</summary>

```php
interface DiscountStrategy
{
    public function calculate(float $amount): float;
}

class NoDiscount implements DiscountStrategy
{
    public function calculate(float $amount): float
    {
        return $amount;
    }
}

class PercentageDiscount implements DiscountStrategy
{
    public function __construct(private float $percentage) {}

    public function calculate(float $amount): float
    {
        return $amount * (1 - $this->percentage / 100);
    }
}

class FixedDiscount implements DiscountStrategy
{
    public function __construct(private float $discount) {}

    public function calculate(float $amount): float
    {
        return max(0, $amount - $this->discount);
    }
}

class Order
{
    public function __construct(
        private float $amount,
        private DiscountStrategy $discountStrategy
    ) {}

    public function getTotal(): float
    {
        return $this->discountStrategy->calculate($this->amount);
    }
}

// Использование
$order1 = new Order(1000, new PercentageDiscount(10));
echo $order1->getTotal();  // 900

$order2 = new Order(1000, new FixedDiscount(100));
echo $order2->getTotal();  // 900

$order3 = new Order(1000, new NoDiscount());
echo $order3->getTotal();  // 1000
```
</details>

### Задание 2: Реализуй Observer Pattern

Создай систему уведомлений где `Order` уведомляет `EmailNotifier` и `SmsNotifier` при изменении статуса.

<details>
<summary>Решение</summary>

```php
interface Observer
{
    public function update(string $event, mixed $data): void;
}

interface Subject
{
    public function attach(Observer $observer): void;
    public function detach(Observer $observer): void;
    public function notify(string $event, mixed $data): void;
}

class Order implements Subject
{
    private array $observers = [];
    private string $status;

    public function attach(Observer $observer): void
    {
        $this->observers[] = $observer;
    }

    public function detach(Observer $observer): void
    {
        $key = array_search($observer, $this->observers, true);
        if ($key !== false) {
            unset($this->observers[$key]);
        }
    }

    public function notify(string $event, mixed $data): void
    {
        foreach ($this->observers as $observer) {
            $observer->update($event, $data);
        }
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
        $this->notify('status_changed', ['status' => $status]);
    }
}

class EmailNotifier implements Observer
{
    public function update(string $event, mixed $data): void
    {
        if ($event === 'status_changed') {
            echo "Email: Order status changed to {$data['status']}\n";
        }
    }
}

class SmsNotifier implements Observer
{
    public function update(string $event, mixed $data): void
    {
        if ($event === 'status_changed') {
            echo "SMS: Order status changed to {$data['status']}\n";
        }
    }
}

// Использование
$order = new Order();
$order->attach(new EmailNotifier());
$order->attach(new SmsNotifier());

$order->setStatus('shipped');
// Email: Order status changed to shipped
// SMS: Order status changed to shipped
```
</details>

### Задание 3: В чём разница между Strategy и Template Method?

Объясни разницу и приведи примеры.

<details>
<summary>Решение</summary>

| Аспект | Strategy | Template Method |
|--------|----------|-----------------|
| **Механизм** | Композиция (has-a) | Наследование (is-a) |
| **Изменение во время выполнения** | Да, можно менять стратегию | Нет, определено в подклассе |
| **Количество объектов** | Много стратегий | Один объект с шаблоном |
| **Инверсия контроля** | Клиент выбирает стратегию | Базовый класс контролирует алгоритм |

**Strategy - композиция, выбор алгоритма:**
```php
class PaymentProcessor
{
    public function __construct(
        private PaymentStrategy $strategy  // Можно менять
    ) {}

    public function setStrategy(PaymentStrategy $strategy): void
    {
        $this->strategy = $strategy;
    }

    public function process(Order $order): void
    {
        $this->strategy->pay($order->total);
    }
}

$processor = new PaymentProcessor(new CreditCardStrategy());
$processor->process($order);  // Credit card

$processor->setStrategy(new PayPalStrategy());
$processor->process($order);  // PayPal
```

**Template Method - наследование, скелет алгоритма:**
```php
abstract class DataImporter
{
    // Template method
    public function import(string $file): void
    {
        $data = $this->readFile($file);  // Шаг 1
        $validated = $this->validate($data);  // Шаг 2
        $this->save($validated);  // Шаг 3
    }

    abstract protected function readFile(string $file): array;
    abstract protected function validate(array $data): array;
    abstract protected function save(array $data): void;
}

class CsvImporter extends DataImporter
{
    protected function readFile(string $file): array
    {
        return array_map('str_getcsv', file($file));
    }
    // ...
}

// Алгоритм фиксирован: read → validate → save
$importer = new CsvImporter();
$importer->import('data.csv');
```

**Когда что использовать:**
- **Strategy** - когда нужна гибкость и возможность менять алгоритм в runtime
- **Template Method** - когда есть фиксированный алгоритм с вариациями в шагах
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
