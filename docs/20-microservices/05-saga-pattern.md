# 18.5 Saga Pattern

> **TL;DR**
> Saga Pattern — управление распределенными транзакциями в микросервисах без ACID. Последовательность локальных транзакций с compensation логикой при ошибках. Типы: Choreography (события, decentralized) и Orchestration (центральный coordinator, HTTP calls). Idempotency для защиты от дублирования. State Machine для сложных саг. Monitoring: логировать все шаги, dashboard для незавершенных саг.

## Содержание
- [Что это](#что-это)
- [Типы Saga](#типы-saga)
- [Choreography Saga (Laravel)](#choreography-saga-laravel)
- [Orchestration Saga (Laravel)](#orchestration-saga-laravel)
- [Choreography vs Orchestration](#choreography-vs-orchestration)
- [Saga State Machine](#saga-state-machine)
- [Idempotency](#idempotency)
- [Monitoring & Debugging](#monitoring--debugging)
- [Best Practices](#best-practices)
- [Когда использовать](#когда-использовать)
- [Практические задания](#практические-задания)

## Что это

**Saga Pattern:**
Паттерн для управления распределёнными транзакциями в микросервисах.

**Проблема:**
В микросервисах нельзя использовать ACID транзакции между БД разных сервисов.

```
Монолит:
BEGIN TRANSACTION;
  INSERT INTO orders (...);
  UPDATE inventory SET stock = stock - 1;
  INSERT INTO payments (...);
COMMIT;  -- Всё или ничего!

Микросервисы:
Order Service → Order DB
Inventory Service → Inventory DB
Payment Service → Payment DB
❌ Нет транзакций между БД!
```

**Решение: Saga**
Последовательность локальных транзакций с compensation логикой.

---

## Типы Saga

### 1. Choreography (хореография)

**Сервисы общаются через events (нет coordinator).**

```
1. Order Service: создать заказ → emit OrderCreated event
2. Inventory Service: слушает OrderCreated → резервирует товар → emit InventoryReserved
3. Payment Service: слушает InventoryReserved → списывает деньги → emit PaymentProcessed
4. Order Service: слушает PaymentProcessed → подтверждает заказ
```

**Если ошибка:**

```
3. Payment Service: ошибка → emit PaymentFailed
4. Inventory Service: слушает PaymentFailed → отменяет резерв
5. Order Service: слушает PaymentFailed → отменяет заказ
```

---

### 2. Orchestration (оркестрация)

**Центральный coordinator управляет saga.**

```
Saga Orchestrator:
1. Вызвать Order Service → создать заказ
2. Вызвать Inventory Service → резервировать товар
3. Вызвать Payment Service → списать деньги
4. Вызвать Order Service → подтвердить заказ

Если ошибка:
3. Payment Service: ошибка
4. Orchestrator: compensation
   - Вызвать Inventory Service → отменить резерв
   - Вызвать Order Service → отменить заказ
```

---

## Choreography Saga (Laravel)

**Scenario: Create Order**

**1. Order Service**

```php
class CreateOrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create([
            'user_id' => $request->user_id,
            'status' => 'pending',
            'total' => $request->total,
        ]);

        // Emit event
        event(new OrderCreated($order));

        return response()->json($order);
    }
}

// Event
class OrderCreated implements ShouldQueue
{
    public function __construct(public Order $order) {}
}

// Listener
class HandlePaymentFailed implements ShouldQueue
{
    public function handle(PaymentFailed $event)
    {
        // Compensation: отменить заказ
        $order = Order::find($event->orderId);
        $order->update(['status' => 'cancelled']);

        Log::info("Order {$order->id} cancelled due to payment failure");
    }
}
```

---

**2. Inventory Service**

```php
// Listener
class ReserveInventory implements ShouldQueue
{
    public function handle(OrderCreated $event)
    {
        try {
            $order = $event->order;

            foreach ($order->items as $item) {
                $product = Product::lockForUpdate()->find($item->product_id);

                if ($product->stock < $item->quantity) {
                    throw new OutOfStockException();
                }

                $product->decrement('stock', $item->quantity);

                // Создать резерв
                Reservation::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item->quantity,
                ]);
            }

            // Success: emit event
            event(new InventoryReserved($order->id));

        } catch (OutOfStockException $e) {
            // Failure: emit event
            event(new InventoryReservationFailed($order->id, $e->getMessage()));
        }
    }
}

class CancelReservation implements ShouldQueue
{
    public function handle(PaymentFailed $event)
    {
        // Compensation: отменить резерв
        $reservations = Reservation::where('order_id', $event->orderId)->get();

        foreach ($reservations as $reservation) {
            $product = Product::find($reservation->product_id);
            $product->increment('stock', $reservation->quantity);

            $reservation->delete();
        }

        Log::info("Reservations for order {$event->orderId} cancelled");
    }
}
```

---

**3. Payment Service**

```php
// Listener
class ProcessPayment implements ShouldQueue
{
    public function handle(InventoryReserved $event)
    {
        try {
            $order = Order::find($event->orderId);

            // Списать деньги
            $payment = $this->chargeCustomer($order);

            // Success: emit event
            event(new PaymentProcessed($order->id, $payment->id));

        } catch (PaymentException $e) {
            // Failure: emit event (запустит compensation)
            event(new PaymentFailed($order->id, $e->getMessage()));
        }
    }

    private function chargeCustomer(Order $order): Payment
    {
        // Stripe API, PayPal, etc.
        return Payment::create([
            'order_id' => $order->id,
            'amount' => $order->total,
            'status' => 'completed',
        ]);
    }
}
```

---

**4. Завершение (Order Service)**

```php
// Listener
class CompleteOrder implements ShouldQueue
{
    public function handle(PaymentProcessed $event)
    {
        $order = Order::find($event->orderId);
        $order->update(['status' => 'completed']);

        // Уведомление клиента
        Mail::to($order->user)->send(new OrderCompletedEmail($order));

        Log::info("Order {$order->id} completed");
    }
}
```

---

## Orchestration Saga (Laravel)

**Saga Orchestrator:**

```php
class CreateOrderSaga
{
    private Order $order;
    private array $compensations = [];

    public function execute(array $data): Order
    {
        try {
            // Step 1: Create Order
            $this->order = $this->createOrder($data);
            $this->compensations[] = fn() => $this->cancelOrder($this->order);

            // Step 2: Reserve Inventory
            $reservations = $this->reserveInventory($this->order);
            $this->compensations[] = fn() => $this->cancelReservations($reservations);

            // Step 3: Process Payment
            $payment = $this->processPayment($this->order);
            $this->compensations[] = fn() => $this->refundPayment($payment);

            // Step 4: Complete Order
            $this->completeOrder($this->order);

            return $this->order;

        } catch (Exception $e) {
            // Rollback: выполнить compensations в обратном порядке
            $this->compensate();

            throw $e;
        }
    }

    private function createOrder(array $data): Order
    {
        return Order::create([
            'user_id' => $data['user_id'],
            'status' => 'pending',
            'total' => $data['total'],
        ]);
    }

    private function reserveInventory(Order $order): array
    {
        // HTTP вызов Inventory Service
        $response = Http::post('http://inventory-service/api/reserve', [
            'order_id' => $order->id,
            'items' => $order->items->toArray(),
        ]);

        if ($response->failed()) {
            throw new InventoryException('Failed to reserve inventory');
        }

        return $response->json('reservations');
    }

    private function processPayment(Order $order): Payment
    {
        // HTTP вызов Payment Service
        $response = Http::post('http://payment-service/api/charge', [
            'order_id' => $order->id,
            'amount' => $order->total,
        ]);

        if ($response->failed()) {
            throw new PaymentException('Payment failed');
        }

        return new Payment($response->json());
    }

    private function completeOrder(Order $order): void
    {
        $order->update(['status' => 'completed']);
    }

    private function compensate(): void
    {
        // Выполнить compensations в обратном порядке
        foreach (array_reverse($this->compensations) as $compensation) {
            try {
                $compensation();
            } catch (Exception $e) {
                Log::error('Compensation failed', ['error' => $e->getMessage()]);
            }
        }
    }

    private function cancelOrder(Order $order): void
    {
        $order->update(['status' => 'cancelled']);
    }

    private function cancelReservations(array $reservations): void
    {
        Http::post('http://inventory-service/api/cancel-reservations', [
            'reservations' => $reservations,
        ]);
    }

    private function refundPayment(Payment $payment): void
    {
        Http::post('http://payment-service/api/refund', [
            'payment_id' => $payment->id,
        ]);
    }
}

// Controller
class OrderController extends Controller
{
    public function store(Request $request, CreateOrderSaga $saga)
    {
        try {
            $order = $saga->execute($request->validated());

            return response()->json($order);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Order creation failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
```

---

## Choreography vs Orchestration

| Choreography | Orchestration |
|--------------|---------------|
| Decentralized | Centralized (Orchestrator) |
| Events | HTTP calls |
| Слабое coupling | Сильное coupling |
| Сложнее debugging | Проще debugging |
| Для простых saga | Для сложных saga |

---

## Saga State Machine

**Для сложных saga — state machine:**

```php
class OrderSagaStateMachine
{
    private string $state = 'created';

    public function transition(string $event): void
    {
        $this->state = match ([$this->state, $event]) {
            ['created', 'inventory_reserved'] => 'inventory_reserved',
            ['inventory_reserved', 'payment_processed'] => 'payment_processed',
            ['payment_processed', 'order_completed'] => 'completed',

            // Compensations
            ['inventory_reserved', 'payment_failed'] => 'compensating_inventory',
            ['compensating_inventory', 'inventory_cancelled'] => 'cancelled',

            default => throw new InvalidTransitionException(),
        };

        $this->save();
    }

    private function save(): void
    {
        // Persist state в БД
        SagaState::updateOrCreate(
            ['saga_id' => $this->sagaId],
            ['state' => $this->state]
        );
    }
}
```

---

## Idempotency

**Проблема: события могут дублироваться (network retry).**

**Решение: idempotency key**

```php
class ReserveInventory implements ShouldQueue
{
    public function handle(OrderCreated $event)
    {
        $idempotencyKey = "reserve_inventory:{$event->order->id}";

        // Проверить уже выполнено?
        if (Cache::has($idempotencyKey)) {
            Log::info("Inventory already reserved for order {$event->order->id}");
            return;
        }

        // Резервировать товар
        $this->reserve($event->order);

        // Отметить как выполненное (TTL 24h)
        Cache::put($idempotencyKey, true, 86400);
    }
}
```

---

## Monitoring & Debugging

**Saga Log:**

```php
class SagaLog extends Model
{
    protected $fillable = ['saga_id', 'step', 'status', 'data', 'error'];
}

// В каждом шаге
SagaLog::create([
    'saga_id' => $this->sagaId,
    'step' => 'reserve_inventory',
    'status' => 'completed',
    'data' => json_encode($reservations),
]);

// При ошибке
SagaLog::create([
    'saga_id' => $this->sagaId,
    'step' => 'process_payment',
    'status' => 'failed',
    'error' => $e->getMessage(),
]);
```

**Dashboard для Saga:**

```php
// Посмотреть все шаги saga
$logs = SagaLog::where('saga_id', $sagaId)->orderBy('created_at')->get();

foreach ($logs as $log) {
    echo "{$log->step}: {$log->status}\n";
}
```

---

## Best Practices

```
✓ Idempotency для всех операций
✓ Compensation для каждого шага
✓ Logging всех шагов saga
✓ Retry с exponential backoff
✓ Timeout для каждого шага
✓ Monitoring: незавершённые saga
✓ Dead Letter Queue для failed events
✓ State machine для сложных saga
✓ Orchestration для сложных, Choreography для простых
```

---

## Когда использовать

**Saga нужна когда:**
- ✅ Микросервисы с разными БД
- ✅ Операция затрагивает несколько сервисов
- ✅ Нужна consistency

**Saga НЕ нужна когда:**
- ❌ Монолит (используй ACID транзакции)
- ❌ Eventual consistency OK (простые events)
- ❌ Операция в одном сервисе

---

## Практические задания

<details>
<summary>Задание 1: Orchestration Saga для заказа</summary>

**Задача:**
Создайте Orchestration Saga для создания заказа с шагами: создание заказа, резервирование товара, оплата, подтверждение. При ошибке выполнять compensation.

**Решение:**

```php
class CreateOrderSaga
{
    private Order $order;
    private array $compensations = [];

    public function execute(array $data): Order
    {
        DB::beginTransaction();

        try {
            // Шаг 1: Создать заказ
            $this->order = Order::create([
                'user_id' => $data['user_id'],
                'status' => 'pending',
                'total' => $data['total'],
            ]);
            $this->compensations[] = fn() => $this->order->delete();
            $this->logStep('order_created', 'completed');

            // Шаг 2: Резервировать товар
            $reservation = $this->reserveInventory($data['items']);
            $this->compensations[] = fn() => $this->cancelReservation($reservation);
            $this->logStep('inventory_reserved', 'completed');

            // Шаг 3: Оплата
            $payment = $this->processPayment($this->order);
            $this->compensations[] = fn() => $this->refundPayment($payment);
            $this->logStep('payment_processed', 'completed');

            // Шаг 4: Подтвердить заказ
            $this->order->update(['status' => 'completed']);
            $this->logStep('order_completed', 'completed');

            DB::commit();
            return $this->order;

        } catch (Exception $e) {
            DB::rollBack();
            $this->logStep('saga_failed', 'failed', $e->getMessage());
            $this->compensate();
            throw $e;
        }
    }

    private function reserveInventory(array $items): array
    {
        $response = Http::timeout(5)->post('http://inventory-service/api/reserve', [
            'order_id' => $this->order->id,
            'items' => $items,
        ]);

        if ($response->failed()) {
            throw new InventoryException('Failed to reserve inventory');
        }

        return $response->json('reservation_id');
    }

    private function processPayment(Order $order)
    {
        $response = Http::timeout(5)->post('http://payment-service/api/charge', [
            'order_id' => $order->id,
            'amount' => $order->total,
        ]);

        if ($response->failed()) {
            throw new PaymentException('Payment failed');
        }

        return $response->json('payment_id');
    }

    private function compensate(): void
    {
        logger()->warning("Starting compensation for order {$this->order->id}");

        foreach (array_reverse($this->compensations) as $index => $compensation) {
            try {
                $compensation();
                logger()->info("Compensation step {$index} completed");
            } catch (Exception $e) {
                logger()->error("Compensation step {$index} failed: {$e->getMessage()}");
            }
        }
    }

    private function cancelReservation($reservationId): void
    {
        Http::post('http://inventory-service/api/cancel', ['reservation_id' => $reservationId]);
    }

    private function refundPayment($paymentId): void
    {
        Http::post('http://payment-service/api/refund', ['payment_id' => $paymentId]);
    }

    private function logStep(string $step, string $status, ?string $error = null): void
    {
        SagaLog::create([
            'saga_id' => $this->order->id,
            'step' => $step,
            'status' => $status,
            'error' => $error,
            'created_at' => now(),
        ]);
    }
}
```
</details>

<details>
<summary>Задание 2: Choreography Saga с событиями</summary>

**Задача:**
Реализуйте Choreography Saga используя Laravel Events для создания заказа.

**Решение:**

```php
// 1. Order Service - создание заказа
class CreateOrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create([
            'user_id' => $request->user_id,
            'status' => 'pending',
            'total' => $request->total,
        ]);

        // Emit событие
        event(new OrderCreated($order));

        return response()->json($order);
    }
}

// 2. Inventory Service - слушает OrderCreated
class ReserveInventoryListener
{
    public function handle(OrderCreated $event)
    {
        try {
            foreach ($event->order->items as $item) {
                $product = Product::lockForUpdate()->find($item->product_id);

                if ($product->stock < $item->quantity) {
                    throw new OutOfStockException();
                }

                $product->decrement('stock', $item->quantity);
            }

            // Success
            event(new InventoryReserved($event->order->id));

        } catch (OutOfStockException $e) {
            // Failure
            event(new InventoryReservationFailed($event->order->id));
        }
    }
}

// 3. Payment Service - слушает InventoryReserved
class ProcessPaymentListener
{
    public function handle(InventoryReserved $event)
    {
        try {
            $payment = $this->chargeCustomer($event->orderId);
            event(new PaymentProcessed($event->orderId, $payment->id));
        } catch (PaymentException $e) {
            event(new PaymentFailed($event->orderId));
        }
    }
}

// 4. Compensation - Order Service слушает PaymentFailed
class CancelOrderListener
{
    public function handle(PaymentFailed $event)
    {
        $order = Order::find($event->orderId);
        $order->update(['status' => 'cancelled']);

        logger()->info("Order {$event->orderId} cancelled due to payment failure");
    }
}

// 5. Compensation - Inventory Service слушает PaymentFailed
class CancelReservationListener
{
    public function handle(PaymentFailed $event)
    {
        $order = Order::find($event->orderId);

        foreach ($order->items as $item) {
            $product = Product::find($item->product_id);
            $product->increment('stock', $item->quantity);
        }

        logger()->info("Inventory reservation cancelled for order {$event->orderId}");
    }
}

// EventServiceProvider.php
protected $listen = [
    OrderCreated::class => [ReserveInventoryListener::class],
    InventoryReserved::class => [ProcessPaymentListener::class],
    PaymentProcessed::class => [CompleteOrderListener::class],
    PaymentFailed::class => [CancelOrderListener::class, CancelReservationListener::class],
];
```
</details>

<details>
<summary>Задание 3: Idempotency для Saga</summary>

**Задача:**
Добавьте idempotency в Saga listener чтобы избежать дублирования при retry событий.

**Решение:**

```php
class ReserveInventoryListener implements ShouldQueue
{
    public function handle(OrderCreated $event)
    {
        $orderId = $event->order->id;
        $idempotencyKey = "saga:reserve_inventory:{$orderId}";

        // Проверить уже выполнено?
        if (Cache::has($idempotencyKey)) {
            logger()->info("Inventory already reserved for order {$orderId} (idempotency)");
            return;
        }

        try {
            DB::transaction(function () use ($event) {
                foreach ($event->order->items as $item) {
                    $product = Product::lockForUpdate()->find($item->product_id);

                    if ($product->stock < $item->quantity) {
                        throw new OutOfStockException();
                    }

                    $product->decrement('stock', $item->quantity);

                    // Сохранить резервацию
                    Reservation::create([
                        'order_id' => $event->order->id,
                        'product_id' => $product->id,
                        'quantity' => $item->quantity,
                    ]);
                }
            });

            // Отметить как выполненное (TTL 24 часа)
            Cache::put($idempotencyKey, true, 86400);

            // Success event
            event(new InventoryReserved($event->order->id));

        } catch (OutOfStockException $e) {
            // Failure event
            event(new InventoryReservationFailed($event->order->id, $e->getMessage()));
        }
    }
}

// В тестах можно проверить idempotency
public function test_reservation_is_idempotent()
{
    $order = Order::factory()->create();
    $event = new OrderCreated($order);

    // Первый вызов
    (new ReserveInventoryListener())->handle($event);
    $firstStock = Product::first()->stock;

    // Повторный вызов (не должен изменить stock)
    (new ReserveInventoryListener())->handle($event);
    $secondStock = Product::first()->stock;

    $this->assertEquals($firstStock, $secondStock);
}
```
</details>

---

## На собеседовании скажешь

> "Saga Pattern — управление распределёнными транзакциями в микросервисах. Проблема: нет ACID между разными БД. Решение: последовательность локальных транзакций + compensation. Типы: Choreography (события, decentralized, слабое coupling) и Orchestration (coordinator, HTTP calls, centralized). Compensation: откат изменений при ошибке в обратном порядке. Idempotency: защита от дублирования событий. State Machine для сложных saga. Monitoring: логировать все шаги, dashboard для незавершённых saga. Best practices: idempotency, retry, timeout, DLQ. Orchestration для сложных saga, Choreography для простых."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
