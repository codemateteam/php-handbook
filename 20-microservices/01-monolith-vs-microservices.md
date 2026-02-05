# 18.1 Монолит vs Микросервисы

> **TL;DR**
> Монолит — одна кодовая база, одна БД, простота разработки, но проблемы с масштабированием. Микросервисы — независимые сервисы со своими БД, сложнее в разработке, но лучше масштабируются. Модульный монолит — золотая середина для подготовки к микросервисам. Миграция через Strangler Fig Pattern. Данные в микросервисах — Saga Pattern для consistency.

## Содержание
- [Что это](#что-это)
- [Монолит](#монолит)
- [Микросервисы](#микросервисы)
- [Когда использовать](#когда-использовать)
- [Модульный монолит (гибрид)](#модульный-монолит-гибрид)
- [Миграция монолит → микросервисы](#миграция-монолит--микросервисы)
- [Data Management](#data-management)
- [Communication](#communication)
- [Практические задания](#практические-задания)

## Что это

**Монолит:**
Всё приложение в одной кодовой базе. Один деплой, одна БД, один процесс.

**Микросервисы:**
Приложение разделено на независимые сервисы. Каждый сервис — отдельный деплой, своя БД, своя кодовая база.

---

## Монолит

**Архитектура:**

```
Single Application
├── Users module
├── Orders module
├── Payments module
├── Notifications module
└── Shared Database
```

**Плюсы:**

```
✅ Простота разработки (один проект)
✅ Простота деплоя (один deploy)
✅ Простота тестирования (интеграционные тесты)
✅ Транзакции работают (одна БД)
✅ Нет сетевых вызовов (всё в одном процессе)
✅ Проще debugging
✅ Меньше DevOps сложности
```

**Минусы:**

```
❌ Scaling: нужно масштабировать всё (даже если bottleneck в одном модуле)
❌ Tight coupling: изменение в одном модуле влияет на всё
❌ Deployment: один баг блокирует весь deploy
❌ Technology lock-in: нельзя использовать разные технологии
❌ Team scaling: сложно работать большой командой
❌ Startup time: большое приложение долго стартует
```

**Пример (Laravel Monolith):**

```php
// app/Http/Controllers/OrderController.php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        DB::transaction(function () use ($request) {
            // 1. Users module
            $user = User::find(auth()->id());

            // 2. Orders module
            $order = Order::create([...]);

            // 3. Payments module
            Payment::charge($user, $order->total);

            // 4. Notifications module
            Notification::send($user, new OrderCreated($order));
        });

        return redirect('/orders');
    }
}

// Всё в одной транзакции, одной БД, одном процессе
```

---

## Микросервисы

**Архитектура:**

```
API Gateway
    ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ User        │ Order       │ Payment     │ Notification│
│ Service     │ Service     │ Service     │ Service     │
│             │             │             │             │
│ Users DB    │ Orders DB   │ Payments DB │ Notif. DB   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Плюсы:**

```
✅ Independent scaling: масштабировать только нужный сервис
✅ Independent deployment: деплой одного сервиса не влияет на другие
✅ Technology diversity: каждый сервис может быть на своём языке
✅ Team independence: команды работают независимо
✅ Fault isolation: баг в одном сервисе не роняет всё
✅ Easier understanding: маленькие кодовые базы проще понять
```

**Минусы:**

```
❌ Complexity: distributed system сложнее
❌ Network calls: latency, failures
❌ Data consistency: нет ACID транзакций между сервисами
❌ Testing: сложнее интеграционные тесты
❌ Debugging: trace через N сервисов
❌ DevOps overhead: N сервисов, N deployments, N databases
❌ Eventual consistency вместо strong consistency
```

**Пример (Микросервисы):**

```php
// Order Service
class OrderController extends Controller
{
    public function store(Request $request)
    {
        // 1. Вызов User Service через HTTP
        $user = Http::get("http://user-service/api/users/{$userId}")->json();

        // 2. Создать заказ (локальная БД)
        $order = Order::create([...]);

        // 3. Вызов Payment Service
        $payment = Http::post("http://payment-service/api/charge", [
            'user_id' => $userId,
            'amount' => $order->total,
        ])->json();

        if (!$payment['success']) {
            // Rollback? Нельзя! Разные БД
            // Нужна Saga или compensation
            $this->compensateOrder($order);
            throw new PaymentFailedException();
        }

        // 4. Async notification через message queue
        Queue::push('notification-service', new OrderCreated($order));

        return response()->json($order);
    }
}
```

---

## Когда использовать

### Монолит для:

```
✓ Стартапы / MVP
✓ Маленькие команды (< 10 человек)
✓ Простые приложения
✓ Строгая consistency нужна
✓ Нет опыта в микросервисах
```

### Микросервисы для:

```
✓ Большие команды (> 20 человек)
✓ Разные части нуждаются в разном масштабировании
✓ Независимые deployment циклы
✓ Разные технологии для разных частей
✓ Есть DevOps expertise
```

---

## Модульный монолит (гибрид)

**Что это:**
Монолит с чётким разделением на модули. Подготовка к микросервисам.

**Структура:**

```php
app/
├── Modules/
│   ├── Users/
│   │   ├── Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   └── routes.php
│   ├── Orders/
│   │   ├── Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   └── routes.php
│   └── Payments/
│       ├── Controllers/
│       ├── Models/
│       ├── Services/
│       └── routes.php
└── Shared/
    └── Database (общая, но можем разделить позже)
```

**Правила:**

```
✓ Модули общаются только через публичные API (Services)
✓ Нет прямого доступа к Models другого модуля
✓ Чёткие boundaries

// ❌ ПЛОХО
$user = \App\Modules\Users\Models\User::find($id);

// ✅ ХОРОШО
$user = app(UserService::class)->find($id);
```

**Преимущества:**

```
✅ Простота монолита
✅ Подготовка к микросервисам
✅ Легко выделить модуль в отдельный сервис позже
```

---

## Миграция монолит → микросервисы

**Strangler Fig Pattern:**

```
1. Монолит работает как есть
2. Выделить один модуль в микросервис
3. API Gateway роутит часть запросов в новый сервис
4. Постепенно мигрировать остальные модули
5. В конце выключить монолит
```

**Шаги:**

```
Step 1: Монолит
┌─────────────────────────┐
│   Monolith              │
│  - Users                │
│  - Orders               │
│  - Payments             │
└─────────────────────────┘

Step 2: Выделить Payment Service
┌─────────────────────────┐        ┌─────────────┐
│   Monolith              │        │  Payment    │
│  - Users                │──────▶ │  Service    │
│  - Orders               │        └─────────────┘
│  - Payments (deprecated)│
└─────────────────────────┘

Step 3: Выделить Order Service
┌─────────────────────────┐        ┌─────────────┐
│   Monolith              │        │  Order      │
│  - Users                │──────▶ │  Service    │
│  - Orders (deprecated)  │        └─────────────┘
└─────────────────────────┘        ┌─────────────┐
                                   │  Payment    │
                                   │  Service    │
                                   └─────────────┘

Step 4: Только User Service остался
┌─────────────┐
│  User       │
│  Service    │
└─────────────┘
┌─────────────┐
│  Order      │
│  Service    │
└─────────────┘
┌─────────────┐
│  Payment    │
│  Service    │
└─────────────┘
```

---

## Data Management

**Монолит:**

```sql
-- Одна БД, ACID транзакции
BEGIN;
  INSERT INTO orders (...);
  UPDATE products SET stock = stock - 1;
  INSERT INTO payments (...);
COMMIT;
```

**Микросервисы:**

```
Order Service DB: orders
Payment Service DB: payments
Product Service DB: products

Нельзя сделать транзакцию между БД!
```

**Решения:**

### 1. Saga Pattern

```php
// Order Service
class CreateOrderSaga
{
    public function execute($data)
    {
        try {
            // 1. Создать заказ
            $order = $this->orderService->create($data);

            // 2. Зарезервировать товар
            $reservation = $this->productService->reserve($data['product_id']);

            // 3. Оплата
            $payment = $this->paymentService->charge($data['amount']);

            // 4. Подтвердить резерв
            $this->productService->confirmReservation($reservation['id']);

            return $order;

        } catch (Exception $e) {
            // Compensation: откатить изменения
            $this->productService->cancelReservation($reservation['id']);
            $this->orderService->cancel($order['id']);

            throw $e;
        }
    }
}
```

### 2. Event Sourcing

```php
// Каждое изменение = событие
event(new OrderCreated($order));
event(new PaymentProcessed($payment));
event(new InventoryReserved($product));

// Другие сервисы слушают события и обновляют свои БД
```

### 3. Два-фазный коммит (2PC)

```
Coordinator:
1. Prepare phase: спросить все сервисы "готовы?"
2. Commit phase: если все "да" → commit, иначе → rollback

❌ Редко используется (медленно, blocking)
```

---

## Communication

**Синхронная (HTTP/REST):**

```php
// Order Service вызывает User Service
$user = Http::get("http://user-service/api/users/{$id}")->json();

✅ Просто
❌ Tight coupling
❌ If user-service down → order-service не работает
```

**Асинхронная (Message Queue):**

```php
// Order Service публикует событие
event(new OrderCreated($order));

// User Service, Payment Service слушают и реагируют
✅ Loose coupling
✅ Fault tolerant
❌ Eventual consistency
```

---

## Практические задания

<details>
<summary>Задание 1: Модульный монолит</summary>

**Задача:**
Создайте модульный монолит с двумя модулями: Users и Orders. Модули должны общаться только через сервисы, не напрямую через Models.

**Решение:**

```php
// app/Modules/Users/Services/UserService.php
namespace App\Modules\Users\Services;

class UserService
{
    public function find(int $id): ?array
    {
        $user = \App\Modules\Users\Models\User::find($id);

        return $user ? [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ] : null;
    }
}

// app/Modules/Orders/Controllers/OrderController.php
namespace App\Modules\Orders\Controllers;

use App\Modules\Users\Services\UserService;

class OrderController extends Controller
{
    public function __construct(private UserService $userService) {}

    public function store(Request $request)
    {
        // ✅ ПРАВИЛЬНО: через сервис
        $user = $this->userService->find($request->user_id);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $order = Order::create([
            'user_id' => $user['id'],
            'total' => $request->total,
        ]);

        return response()->json($order);
    }
}
```
</details>

<details>
<summary>Задание 2: Saga Pattern для создания заказа</summary>

**Задача:**
Реализуйте простую Saga для создания заказа с компенсацией при ошибке оплаты.

**Решение:**

```php
class CreateOrderSaga
{
    private array $compensations = [];

    public function execute(array $data): Order
    {
        try {
            // Шаг 1: Создать заказ
            $order = Order::create(['status' => 'pending', ...$data]);
            $this->compensations[] = fn() => $order->delete();

            // Шаг 2: Зарезервировать товар
            $product = Product::lockForUpdate()->find($data['product_id']);
            if ($product->stock < $data['quantity']) {
                throw new OutOfStockException();
            }
            $product->decrement('stock', $data['quantity']);
            $this->compensations[] = fn() => $product->increment('stock', $data['quantity']);

            // Шаг 3: Оплата (может упасть)
            $payment = $this->processPayment($order);
            $this->compensations[] = fn() => $this->refundPayment($payment);

            // Успех
            $order->update(['status' => 'completed']);
            return $order;

        } catch (Exception $e) {
            // Compensation: откат в обратном порядке
            foreach (array_reverse($this->compensations) as $compensation) {
                $compensation();
            }
            throw $e;
        }
    }

    private function processPayment(Order $order): Payment
    {
        // Симуляция оплаты
        if (rand(0, 1)) {
            throw new PaymentFailedException();
        }
        return Payment::create(['order_id' => $order->id, 'status' => 'paid']);
    }

    private function refundPayment(Payment $payment): void
    {
        $payment->update(['status' => 'refunded']);
    }
}
```
</details>

<details>
<summary>Задание 3: Strangler Fig Migration</summary>

**Задача:**
Реализуйте шаблон Strangler Fig для постепенной миграции монолита в микросервисы через API Gateway.

**Решение:**

```php
// API Gateway (routes/api.php)
Route::any('/api/payments/{path}', function (Request $request, $path) {
    // Новый микросервис
    return Http::asForm()
        ->withToken($request->bearerToken())
        ->send(
            $request->method(),
            "http://payment-service/api/{$path}",
            ['json' => $request->all()]
        );
})->where('path', '.*');

Route::any('/api/{service}/{path}', function (Request $request, $service, $path) {
    // Старый монолит (остальные сервисы)
    return app()->call("App\\Http\\Controllers\\{$service}@{$path}", $request->all());
})->where('path', '.*');

// Постепенно выносим сервисы:
// 1. Payment Service → микросервис (готово)
// 2. Order Service → следующий
// 3. User Service → последний
// 4. Монолит удаляем
```
</details>

---

## На собеседовании скажешь

> "Монолит: одна кодовая база, одна БД, один деплой. Плюсы: простота, транзакции, debugging. Минусы: scaling всего, tight coupling, большие команды сложно. Микросервисы: независимые сервисы со своими БД. Плюсы: independent scaling/deployment, technology diversity. Минусы: distributed system complexity, eventual consistency, network latency. Модульный монолит — гибрид: подготовка к микросервисам. Миграция: Strangler Fig Pattern. Data consistency: Saga Pattern, Event Sourcing. Коммуникация: синхронная (HTTP) или асинхронная (message queue)."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

