# 10.5 DDD (Domain-Driven Design)

## Краткое резюме

> **DDD** — подход к разработке, ориентированный на предметную область (domain).
>
> **Концепции:** Entity (с ID), Value Object (без ID), Aggregate (группа Entity), Repository, Domain Events.
>
> **Важно:** Структура: Domain (логика), Infrastructure (БД/API), Application (use cases). Подходит для сложной бизнес-логики.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
DDD — подход к разработке, ориентированный на предметную область (domain). Код отражает бизнес-логику.

**Основные концепции:**
- Entity — объект с идентичностью
- Value Object — объект без идентичности
- Aggregate — группа связанных объектов
- Repository — доступ к агрегатам
- Domain Event — событие в domain

---

## Как работает

**Entity (с идентичностью):**

```php
// app/Domain/Order/Order.php
class Order
{
    private OrderId $id;
    private UserId $userId;
    private OrderStatus $status;
    private Money $total;
    private Collection $items;

    public function __construct(OrderId $id, UserId $userId)
    {
        $this->id = $id;
        $this->userId = $userId;
        $this->status = OrderStatus::pending();
        $this->items = collect();
    }

    public function addItem(Product $product, int $quantity): void
    {
        $this->items->push(new OrderItem($product, $quantity));
        $this->recalculateTotal();
    }

    public function markAsPaid(): void
    {
        if (!$this->status->isPending()) {
            throw new InvalidOrderStateException();
        }

        $this->status = OrderStatus::paid();
        $this->recordEvent(new OrderPaid($this->id));
    }

    private function recalculateTotal(): void
    {
        $this->total = $this->items->sum(fn($item) => $item->subtotal());
    }
}
```

**Value Object (без идентичности):**

```php
// app/Domain/Order/Money.php
class Money
{
    private function __construct(
        private float $amount,
        private string $currency
    ) {
        if ($amount < 0) {
            throw new InvalidArgumentException('Amount cannot be negative');
        }
    }

    public static function fromAmount(float $amount, string $currency = 'USD'): self
    {
        return new self($amount, $currency);
    }

    public function add(Money $other): Money
    {
        if ($this->currency !== $other->currency) {
            throw new CurrencyMismatchException();
        }

        return new Money($this->amount + $other->amount, $this->currency);
    }

    public function equals(Money $other): bool
    {
        return $this->amount === $other->amount
            && $this->currency === $other->currency;
    }
}
```

**Aggregate Root:**

```php
class Order // Aggregate Root
{
    private Collection $items; // Часть агрегата

    public function addItem(Product $product, int $quantity): void
    {
        // Только через Order можно добавить item
        $this->items->push(new OrderItem($product, $quantity));
    }

    // Нельзя напрямую изменить OrderItem вне Order
}
```

---

## Когда использовать

**DDD для:**
- Сложная бизнес-логика
- Большие проекты
- Изменяющиеся требования

**НЕ для:**
- Простые CRUD
- Маленькие проекты

---

## Пример из практики

**Структура проекта:**

```
app/Domain/
├── Order/
│   ├── Order.php (Entity)
│   ├── OrderId.php (Value Object)
│   ├── OrderStatus.php (Value Object)
│   ├── OrderItem.php (Entity)
│   ├── OrderRepository.php (Interface)
│   └── Events/
│       ├── OrderCreated.php
│       └── OrderPaid.php
├── Product/
│   ├── Product.php
│   └── ProductRepository.php
└── User/
    ├── User.php
    └── UserRepository.php

app/Infrastructure/
├── Persistence/
│   ├── EloquentOrderRepository.php
│   └── EloquentProductRepository.php
└── Services/
    └── StripePaymentService.php

app/Application/
├── Commands/
│   ├── CreateOrderCommand.php
│   └── CreateOrderHandler.php
└── Queries/
    ├── GetOrderQuery.php
    └── GetOrderHandler.php
```

**Domain Service:**

```php
// app/Domain/Order/OrderService.php
class OrderService
{
    public function __construct(
        private OrderRepository $orders,
        private ProductRepository $products
    ) {}

    public function placeOrder(UserId $userId, array $items): Order
    {
        $order = new Order(OrderId::generate(), $userId);

        foreach ($items as $item) {
            $product = $this->products->find($item['product_id']);
            $order->addItem($product, $item['quantity']);
        }

        $this->orders->save($order);

        return $order;
    }
}
```

---

## На собеседовании скажешь

> "DDD ориентирован на предметную область. Entity — объект с идентичностью (Order, User). Value Object — без идентичности (Money, Address). Aggregate — группа связанных Entity, доступ через Root. Repository для агрегатов. Domain Events для реакции на изменения. Структура: Domain (логика), Infrastructure (БД, API), Application (use cases). Подходит для сложной бизнес-логики, не для простых CRUD."

---

## Практические задания

### Задание 1: Создай Value Object для Money

Реализуй Value Object `Money` с валидацией и арифметическими операциями.

<details>
<summary>Решение</summary>

```php
// app/Domain/Shared/ValueObjects/Money.php
namespace App\Domain\Shared\ValueObjects;

class Money
{
    private function __construct(
        private readonly float $amount,
        private readonly string $currency
    ) {
        $this->validate();
    }

    public static function fromAmount(float $amount, string $currency = 'USD'): self
    {
        return new self($amount, $currency);
    }

    public static function zero(string $currency = 'USD'): self
    {
        return new self(0, $currency);
    }

    private function validate(): void
    {
        if ($this->amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }

        $allowedCurrencies = ['USD', 'EUR', 'GBP', 'RUB'];
        if (!in_array($this->currency, $allowedCurrencies)) {
            throw new \InvalidArgumentException("Invalid currency: {$this->currency}");
        }
    }

    public function add(Money $other): Money
    {
        $this->ensureSameCurrency($other);

        return new Money(
            $this->amount + $other->amount,
            $this->currency
        );
    }

    public function subtract(Money $other): Money
    {
        $this->ensureSameCurrency($other);

        return new Money(
            $this->amount - $other->amount,
            $this->currency
        );
    }

    public function multiply(float $multiplier): Money
    {
        return new Money(
            $this->amount * $multiplier,
            $this->currency
        );
    }

    public function equals(Money $other): bool
    {
        return $this->amount === $other->amount
            && $this->currency === $other->currency;
    }

    public function greaterThan(Money $other): bool
    {
        $this->ensureSameCurrency($other);

        return $this->amount > $other->amount;
    }

    private function ensureSameCurrency(Money $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new \InvalidArgumentException(
                "Currency mismatch: {$this->currency} vs {$other->currency}"
            );
        }
    }

    public function getAmount(): float
    {
        return $this->amount;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function format(): string
    {
        return match ($this->currency) {
            'USD' => '$' . number_format($this->amount, 2),
            'EUR' => '€' . number_format($this->amount, 2),
            'GBP' => '£' . number_format($this->amount, 2),
            'RUB' => number_format($this->amount, 2) . ' ₽',
        };
    }

    public function __toString(): string
    {
        return $this->format();
    }
}

// Использование
$price = Money::fromAmount(100, 'USD');
$tax = Money::fromAmount(20, 'USD');
$total = $price->add($tax); // $120 USD

echo $total->format(); // $120.00
```
</details>

### Задание 2: Реализуй Aggregate Root для Order

Создай `Order` как Aggregate Root с `OrderItem` внутри. Изменение items только через Order.

<details>
<summary>Решение</summary>

```php
// app/Domain/Order/Order.php
namespace App\Domain\Order;

use App\Domain\Shared\ValueObjects\Money;
use Illuminate\Support\Collection;

class Order // Aggregate Root
{
    private OrderId $id;
    private UserId $userId;
    private OrderStatus $status;
    private Collection $items;
    private Money $total;

    public function __construct(OrderId $id, UserId $userId)
    {
        $this->id = $id;
        $this->userId = $userId;
        $this->status = OrderStatus::pending();
        $this->items = collect();
        $this->total = Money::zero();
    }

    // Только через Order можно добавить item
    public function addItem(ProductId $productId, int $quantity, Money $price): void
    {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Quantity must be positive');
        }

        $item = new OrderItem($productId, $quantity, $price);
        $this->items->push($item);
        $this->recalculateTotal();
    }

    public function removeItem(ProductId $productId): void
    {
        $this->items = $this->items->reject(
            fn(OrderItem $item) => $item->getProductId()->equals($productId)
        );
        $this->recalculateTotal();
    }

    public function updateItemQuantity(ProductId $productId, int $quantity): void
    {
        $item = $this->findItem($productId);

        if (!$item) {
            throw new \DomainException('Item not found in order');
        }

        $item->updateQuantity($quantity);
        $this->recalculateTotal();
    }

    public function markAsPaid(): void
    {
        if (!$this->status->isPending()) {
            throw new \DomainException('Only pending orders can be marked as paid');
        }

        $this->status = OrderStatus::paid();
    }

    public function cancel(): void
    {
        if ($this->status->isShipped()) {
            throw new \DomainException('Cannot cancel shipped orders');
        }

        $this->status = OrderStatus::cancelled();
    }

    private function recalculateTotal(): void
    {
        $this->total = $this->items->reduce(
            fn(Money $total, OrderItem $item) => $total->add($item->getSubtotal()),
            Money::zero()
        );
    }

    private function findItem(ProductId $productId): ?OrderItem
    {
        return $this->items->first(
            fn(OrderItem $item) => $item->getProductId()->equals($productId)
        );
    }

    public function getId(): OrderId
    {
        return $this->id;
    }

    public function getTotal(): Money
    {
        return $this->total;
    }

    public function getItems(): Collection
    {
        return $this->items;
    }
}

// app/Domain/Order/OrderItem.php
class OrderItem // Часть агрегата
{
    private Money $subtotal;

    public function __construct(
        private readonly ProductId $productId,
        private int $quantity,
        private readonly Money $price
    ) {
        $this->calculateSubtotal();
    }

    public function updateQuantity(int $quantity): void
    {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Quantity must be positive');
        }

        $this->quantity = $quantity;
        $this->calculateSubtotal();
    }

    private function calculateSubtotal(): void
    {
        $this->subtotal = $this->price->multiply($this->quantity);
    }

    public function getProductId(): ProductId
    {
        return $this->productId;
    }

    public function getSubtotal(): Money
    {
        return $this->subtotal;
    }
}
```
</details>

### Задание 3: Создай Domain Event

Реализуй `OrderPlaced` Domain Event и его обработку.

<details>
<summary>Решение</summary>

```php
// app/Domain/Order/Events/OrderPlaced.php
namespace App\Domain\Order\Events;

use App\Domain\Order\Order;
use DateTimeImmutable;

class OrderPlaced
{
    public function __construct(
        public readonly string $orderId,
        public readonly string $userId,
        public readonly float $total,
        public readonly DateTimeImmutable $occurredAt
    ) {}

    public static function fromOrder(Order $order): self
    {
        return new self(
            orderId: (string) $order->getId(),
            userId: (string) $order->getUserId(),
            total: $order->getTotal()->getAmount(),
            occurredAt: new DateTimeImmutable()
        );
    }

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId,
            'user_id' => $this->userId,
            'total' => $this->total,
            'occurred_at' => $this->occurredAt->format('Y-m-d H:i:s'),
        ];
    }
}

// app/Domain/Order/Order.php (обновлённая версия)
class Order
{
    private array $domainEvents = [];

    public function place(): void
    {
        if ($this->items->isEmpty()) {
            throw new \DomainException('Cannot place empty order');
        }

        $this->status = OrderStatus::placed();
        $this->recordEvent(OrderPlaced::fromOrder($this));
    }

    private function recordEvent(object $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function releaseEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];
        return $events;
    }
}

// app/Infrastructure/Persistence/EloquentOrderRepository.php
class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function save(Order $order): void
    {
        // Сохранение в БД
        // ...

        // Отправка domain events
        foreach ($order->releaseEvents() as $event) {
            event($event);
        }
    }
}

// app/Listeners/SendOrderConfirmationEmail.php
class SendOrderConfirmationEmail
{
    public function handle(OrderPlaced $event): void
    {
        $user = User::find($event->userId);
        Mail::to($user->email)->send(new OrderConfirmationMail($event));
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
