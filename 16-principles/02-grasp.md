# 10.2 GRASP (General Responsibility Assignment Software Patterns)

## Краткое резюме

> **GRASP** — 9 принципов для присвоения ответственности классам в ООП.
>
> **Основные:** Information Expert (Order считает total), Creator (Order создаёт items), Controller (thin), Low Coupling (DI).
>
> **Дополнительно:** High Cohesion (одна ответственность), Polymorphism (вместо if), Indirection (посредники), Protected Variations (стабильные интерфейсы).

---

## Содержание

- [Что это](#что-это)
- [1. Information Expert](#1-information-expert)
- [2. Creator](#2-creator)
- [3. Controller](#3-controller)
- [4. Low Coupling](#4-low-coupling)
- [5. High Cohesion](#5-high-cohesion)
- [6. Polymorphism](#6-polymorphism)
- [7. Pure Fabrication](#7-pure-fabrication)
- [8. Indirection](#8-indirection)
- [9. Protected Variations](#9-protected-variations)
- [Применение в Laravel](#применение-в-laravel)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**GRASP:**
9 принципов для присвоения ответственности классам и объектам в ООП.

**Зачем:**
- Распределить ответственность правильно
- Создать maintainable код
- Слабое coupling, сильное cohesion

**9 принципов:**
1. Information Expert
2. Creator
3. Controller
4. Low Coupling
5. High Cohesion
6. Polymorphism
7. Pure Fabrication
8. Indirection
9. Protected Variations

---

## 1. Information Expert

**Принцип:**
Присвой ответственность классу, у которого есть информация для её выполнения.

**❌ Плохо:**

```php
class OrderController
{
    public function show($id)
    {
        $order = Order::with('items')->find($id);

        // Controller считает total (не его ответственность!)
        $total = 0;
        foreach ($order->items as $item) {
            $total += $item->price * $item->quantity;
        }

        return view('orders.show', ['order' => $order, 'total' => $total]);
    }
}
```

**✅ Хорошо (Information Expert):**

```php
class Order extends Model
{
    // Order знает о своих items → он должен считать total
    public function getTotalAttribute(): float
    {
        return $this->items->sum(fn($item) => $item->price * $item->quantity);
    }
}

class OrderController
{
    public function show($id)
    {
        $order = Order::with('items')->find($id);

        return view('orders.show', ['order' => $order]);
    }
}

// В view
{{ $order->total }}
```

---

## 2. Creator

**Принцип:**
Класс B должен создавать A, если:
- B содержит A
- B агрегирует A
- B имеет данные для инициализации A

**❌ Плохо:**

```php
class OrderController
{
    public function store(Request $request)
    {
        $order = Order::create([...]);

        // Controller создаёт items (не его ответственность!)
        foreach ($request->items as $itemData) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $itemData['product_id'],
                'quantity' => $itemData['quantity'],
                'price' => Product::find($itemData['product_id'])->price,
            ]);
        }
    }
}
```

**✅ Хорошо (Creator):**

```php
class Order extends Model
{
    // Order содержит items → Order должен создавать items
    public function addItem(int $productId, int $quantity): OrderItem
    {
        $product = Product::find($productId);

        return $this->items()->create([
            'product_id' => $productId,
            'quantity' => $quantity,
            'price' => $product->price,
        ]);
    }
}

class OrderController
{
    public function store(Request $request)
    {
        $order = Order::create([...]);

        foreach ($request->items as $itemData) {
            $order->addItem($itemData['product_id'], $itemData['quantity']);
        }
    }
}
```

---

## 3. Controller

**Принцип:**
Контроллер обрабатывает системные события (HTTP requests) и делегирует бизнес-логику другим объектам.

**❌ Плохо (Fat Controller):**

```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        // Валидация
        $validated = $request->validate([...]);

        // Бизнес-логика
        $order = Order::create([...]);

        foreach ($validated['items'] as $item) {
            $product = Product::find($item['product_id']);
            if ($product->stock < $item['quantity']) {
                throw new OutOfStockException();
            }
            $product->decrement('stock', $item['quantity']);

            $order->items()->create([...]);
        }

        // Email
        Mail::to($order->user)->send(new OrderCreated($order));

        // Логирование
        Log::info("Order created", ['order_id' => $order->id]);

        return response()->json($order);
    }
}
```

**✅ Хорошо (Thin Controller):**

```php
class OrderController extends Controller
{
    public function store(
        StoreOrderRequest $request,
        OrderService $orderService
    ) {
        // Controller только координирует
        $order = $orderService->create($request->validated());

        return response()->json($order);
    }
}

class OrderService
{
    public function create(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $order = Order::create([...]);

            foreach ($data['items'] as $itemData) {
                $this->addItemToOrder($order, $itemData);
            }

            event(new OrderCreated($order));

            return $order;
        });
    }

    private function addItemToOrder(Order $order, array $itemData): void
    {
        $product = Product::lockForUpdate()->find($itemData['product_id']);

        if ($product->stock < $itemData['quantity']) {
            throw new OutOfStockException();
        }

        $product->decrement('stock', $itemData['quantity']);

        $order->items()->create([
            'product_id' => $product->id,
            'quantity' => $itemData['quantity'],
            'price' => $product->price,
        ]);
    }
}
```

---

## 4. Low Coupling

**Принцип:**
Минимизировать зависимости между классами.

**❌ High Coupling:**

```php
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Прямая зависимость от конкретного класса
        $mailer = new SmtpMailer();
        $mailer->sendOrderConfirmation($order);

        $logger = new FileLogger();
        $logger->log("Order created");

        return $order;
    }
}
```

**✅ Low Coupling (Dependency Injection):**

```php
class OrderService
{
    public function __construct(
        private MailerInterface $mailer,
        private LoggerInterface $logger
    ) {}

    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Зависимость от интерфейса
        $this->mailer->sendOrderConfirmation($order);
        $this->logger->info("Order created");

        return $order;
    }
}
```

---

## 5. High Cohesion

**Принцип:**
Класс должен иметь одну чёткую ответственность. Методы класса должны быть связаны.

**❌ Low Cohesion:**

```php
class UserService
{
    // Всё в одном классе (разные ответственности!)
    public function register(array $data) { }
    public function login(string $email, string $password) { }
    public function sendPasswordReset(string $email) { }
    public function updateProfile(User $user, array $data) { }
    public function deleteAccount(User $user) { }
    public function exportToCSV(User $user) { }
    public function calculateStatistics() { }
}
```

**✅ High Cohesion:**

```php
// Разделить на cohesive классы
class AuthService
{
    public function register(array $data) { }
    public function login(string $email, string $password) { }
    public function sendPasswordReset(string $email) { }
}

class ProfileService
{
    public function update(User $user, array $data) { }
    public function delete(User $user) { }
}

class UserExportService
{
    public function toCSV(User $user) { }
}

class UserStatisticsService
{
    public function calculate() { }
}
```

---

## 6. Polymorphism

**Принцип:**
Использовать полиморфизм вместо if/switch.

**❌ Без полиморфизма:**

```php
class OrderProcessor
{
    public function process(Order $order)
    {
        if ($order->payment_method === 'credit_card') {
            $this->processCreditCard($order);
        } elseif ($order->payment_method === 'paypal') {
            $this->processPayPal($order);
        } elseif ($order->payment_method === 'crypto') {
            $this->processCrypto($order);
        }
    }
}
```

**✅ С полиморфизмом:**

```php
interface PaymentGateway
{
    public function charge(Order $order): Payment;
}

class CreditCardGateway implements PaymentGateway
{
    public function charge(Order $order): Payment { }
}

class PayPalGateway implements PaymentGateway
{
    public function charge(Order $order): Payment { }
}

class CryptoGateway implements PaymentGateway
{
    public function charge(Order $order): Payment { }
}

class OrderProcessor
{
    public function process(Order $order, PaymentGateway $gateway)
    {
        $gateway->charge($order);
    }
}

// Использование
$gateway = match ($order->payment_method) {
    'credit_card' => new CreditCardGateway(),
    'paypal' => new PayPalGateway(),
    'crypto' => new CryptoGateway(),
};

$processor->process($order, $gateway);
```

---

## 7. Pure Fabrication

**Принцип:**
Создать искусственный класс для ответственности, которая не подходит ни одному domain объекту.

**Пример:**
Логирование не относится к domain, но нужно.

```php
// Pure Fabrication: класс для технической ответственности
class Logger
{
    public function log(string $message): void
    {
        // Техническая ответственность (не domain)
    }
}

class OrderService
{
    public function __construct(private Logger $logger) {}

    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Используем Pure Fabrication
        $this->logger->log("Order {$order->id} created");

        return $order;
    }
}
```

**Другие примеры Pure Fabrication:**
- Repository (для доступа к БД)
- Cache
- EventDispatcher
- Validator

---

## 8. Indirection

**Принцип:**
Использовать посредника для снижения coupling.

**❌ Прямая зависимость:**

```php
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Прямая зависимость от SMTP
        $mailer = new SmtpMailer();
        $mailer->send($order->user->email, 'Order Created', '...');

        return $order;
    }
}
```

**✅ Indirection (посредник):**

```php
// Посредник: Laravel Mail facade
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Indirection через Mail facade
        Mail::to($order->user)->send(new OrderCreated($order));

        return $order;
    }
}

// Mail facade — посредник между OrderService и SMTP
```

---

## 9. Protected Variations

**Принцип:**
Защитить систему от изменений с помощью стабильных интерфейсов.

**❌ Без защиты:**

```php
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Прямая зависимость от Stripe API
        $stripe = new StripeClient(config('stripe.key'));
        $stripe->charges->create([
            'amount' => $order->total * 100,
            'currency' => 'usd',
        ]);

        return $order;
    }
}

// Если нужно сменить Stripe на PayPal → переписывать OrderService
```

**✅ Protected Variations:**

```php
// Стабильный интерфейс
interface PaymentGateway
{
    public function charge(int $amount, string $currency): Payment;
}

class StripeGateway implements PaymentGateway
{
    public function charge(int $amount, string $currency): Payment
    {
        $stripe = new StripeClient(config('stripe.key'));
        // ...
    }
}

class PayPalGateway implements PaymentGateway
{
    public function charge(int $amount, string $currency): Payment
    {
        // PayPal API
    }
}

class OrderService
{
    public function __construct(private PaymentGateway $gateway) {}

    public function create(array $data): Order
    {
        $order = Order::create([...]);

        // Защищены от изменений payment gateway
        $this->gateway->charge($order->total, 'usd');

        return $order;
    }
}

// Можем менять gateway без изменения OrderService
```

---

## Применение в Laravel

```php
// Information Expert
class Order extends Model
{
    public function getTotalAttribute() { /* Order знает о своих items */ }
}

// Creator
class Order extends Model
{
    public function addItem($productId, $quantity) { /* Order создаёт items */ }
}

// Controller (thin)
class OrderController extends Controller
{
    public function store(StoreOrderRequest $request, OrderService $service)
    {
        return $service->create($request->validated());
    }
}

// Low Coupling (DI)
class OrderService
{
    public function __construct(
        private PaymentGateway $gateway,
        private LoggerInterface $logger
    ) {}
}

// High Cohesion (Single Responsibility)
class AuthService { /* только auth */ }
class ProfileService { /* только profile */ }

// Polymorphism
interface PaymentGateway { }
class StripeGateway implements PaymentGateway { }

// Pure Fabrication
class OrderRepository { /* техническая ответственность */ }

// Indirection
Mail::to($user)->send(new OrderCreated($order));

// Protected Variations
interface PaymentGateway { /* стабильный интерфейс */ }
```

---

## На собеседовании скажешь

> "GRASP — 9 принципов для присвоения ответственности. Information Expert: ответственность классу с информацией (Order считает total). Creator: класс создаёт то, что содержит (Order создаёт items). Controller: thin, делегирует в Service. Low Coupling: зависимости через интерфейсы (DI). High Cohesion: одна чёткая ответственность (AuthService отдельно от ProfileService). Polymorphism: вместо if/switch. Pure Fabrication: искусственные классы для технической ответственности (Logger, Repository). Indirection: посредники (Mail facade). Protected Variations: стабильные интерфейсы для защиты от изменений (PaymentGateway)."

---

## Практические задания

### Задание 1: Information Expert + Creator

Перепиши код применяя принципы Information Expert и Creator.

```php
// Плохо: Controller делает всё
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create([
            'user_id' => $request->user_id,
            'status' => 'pending',
        ]);

        // Controller считает total (не его дело!)
        $total = 0;
        foreach ($request->items as $itemData) {
            $product = Product::find($itemData['product_id']);
            $price = $product->price;
            $quantity = $itemData['quantity'];

            // Controller создаёт items (не его дело!)
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'quantity' => $quantity,
                'price' => $price,
            ]);

            $total += $price * $quantity;
        }

        $order->update(['total' => $total]);

        return response()->json($order);
    }
}
```

<details>
<summary>Решение</summary>

```php
// ✅ Information Expert + Creator

// Order знает о своих items → Order считает total (Information Expert)
class Order extends Model
{
    public function getTotalAttribute(): float
    {
        return $this->items->sum(fn($item) => $item->subtotal);
    }

    // Order содержит items → Order создаёт items (Creator)
    public function addItem(int $productId, int $quantity): OrderItem
    {
        $product = Product::findOrFail($productId);

        return $this->items()->create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'price' => $product->price,
        ]);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}

// OrderItem знает свой subtotal (Information Expert)
class OrderItem extends Model
{
    public function getSubtotalAttribute(): float
    {
        return $this->price * $this->quantity;
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

// Service координирует процесс
class OrderService
{
    public function create(int $userId, array $items): Order
    {
        return DB::transaction(function () use ($userId, $items) {
            $order = Order::create([
                'user_id' => $userId,
                'status' => 'pending',
            ]);

            foreach ($items as $item) {
                $order->addItem($item['product_id'], $item['quantity']);
            }

            // total вычисляется автоматически через accessor
            return $order->fresh(['items']);
        });
    }
}

// Controller только координирует (Controller принцип)
class OrderController extends Controller
{
    public function store(Request $request, OrderService $orderService)
    {
        $order = $orderService->create(
            $request->user_id,
            $request->items
        );

        return response()->json([
            'order' => $order,
            'total' => $order->total,  // Вычисляется Order
        ]);
    }
}

// Преимущества:
// - Order отвечает за свою логику
// - Легко тестировать
// - Переиспользуемый код
// - Понятная ответственность
```
</details>

### Задание 2: Low Coupling + Protected Variations

Рефактори код для уменьшения coupling и защиты от изменений.

```php
// Плохо: High Coupling
class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create($data);

        // Прямая зависимость от Stripe
        $stripe = new \Stripe\StripeClient(config('services.stripe.key'));
        $charge = $stripe->charges->create([
            'amount' => $order->total * 100,
            'currency' => 'usd',
            'source' => $data['card_token'],
        ]);

        $order->update(['payment_id' => $charge->id]);

        // Прямая зависимость от SMTP
        $mailer = new \Swift_Mailer(
            new \Swift_SmtpTransport('smtp.gmail.com', 587)
        );
        $message = (new \Swift_Message('Order Confirmation'))
            ->setFrom('noreply@example.com')
            ->setTo($order->user->email)
            ->setBody('Your order has been confirmed');
        $mailer->send($message);

        return $order;
    }
}

// Проблемы:
// - Нельзя сменить Stripe на PayPal
// - Нельзя сменить SMTP на другой transport
// - Сложно тестировать
```

<details>
<summary>Решение</summary>

```php
// ✅ Low Coupling + Protected Variations

// Стабильный интерфейс (Protected Variations)
interface PaymentGateway
{
    public function charge(float $amount, string $token): Payment;
}

class StripeGateway implements PaymentGateway
{
    public function __construct(private string $apiKey) {}

    public function charge(float $amount, string $token): Payment
    {
        $stripe = new \Stripe\StripeClient($this->apiKey);

        $charge = $stripe->charges->create([
            'amount' => $amount * 100,
            'currency' => 'usd',
            'source' => $token,
        ]);

        return new Payment(
            id: $charge->id,
            amount: $amount,
            status: $charge->status
        );
    }
}

class PayPalGateway implements PaymentGateway
{
    public function charge(float $amount, string $token): Payment
    {
        // PayPal implementation
    }
}

// Notification interface (Protected Variations)
interface Notifier
{
    public function send(User $user, string $message): void;
}

class EmailNotifier implements Notifier
{
    public function send(User $user, string $message): void
    {
        Mail::to($user->email)->send(new GenericEmail($message));
    }
}

class SmsNotifier implements Notifier
{
    public function send(User $user, string $message): void
    {
        // SMS implementation
    }
}

// Service с Low Coupling (через DI)
class OrderService
{
    public function __construct(
        private PaymentGateway $paymentGateway,
        private Notifier $notifier
    ) {}

    public function create(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $order = Order::create($data);

            // Не важно какой gateway (Low Coupling)
            $payment = $this->paymentGateway->charge(
                $order->total,
                $data['card_token']
            );

            $order->update(['payment_id' => $payment->id]);

            // Не важно какой notifier (Low Coupling)
            $this->notifier->send(
                $order->user,
                "Your order #{$order->id} has been confirmed"
            );

            return $order;
        });
    }
}

// Service Provider для binding
class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        // Можем легко сменить на PayPalGateway
        $this->app->bind(PaymentGateway::class, function () {
            return new StripeGateway(config('services.stripe.key'));
        });

        // Можем легко сменить на SmsNotifier
        $this->app->bind(Notifier::class, EmailNotifier::class);
    }
}

// Тестирование (легко!)
class OrderServiceTest extends TestCase
{
    public function test_creates_order_with_payment()
    {
        // Mock dependencies
        $gateway = Mockery::mock(PaymentGateway::class);
        $gateway->shouldReceive('charge')
            ->once()
            ->andReturn(new Payment(id: 'test_123', amount: 100, status: 'succeeded'));

        $notifier = Mockery::mock(Notifier::class);
        $notifier->shouldReceive('send')->once();

        $service = new OrderService($gateway, $notifier);

        $order = $service->create([...]);

        $this->assertEquals('test_123', $order->payment_id);
    }
}

// Преимущества:
// - Легко сменить gateway/notifier
// - Легко тестировать
// - Защищены от изменений API
// - Low coupling
```
</details>

### Задание 3: High Cohesion + Polymorphism

Рефактори Fat Service применяя High Cohesion и Polymorphism.

```php
// Плохо: Low Cohesion (всё в одном классе)
class UserService
{
    public function register(array $data) { /* ... */ }
    public function login(string $email, string $password) { /* ... */ }
    public function logout(User $user) { /* ... */ }
    public function updateProfile(User $user, array $data) { /* ... */ }
    public function uploadAvatar(User $user, $file) { /* ... */ }
    public function deleteAccount(User $user) { /* ... */ }
    public function sendNotification(User $user, string $message, string $type)
    {
        // Плохо: switch вместо polymorphism
        switch ($type) {
            case 'email':
                Mail::to($user->email)->send(new GenericEmail($message));
                break;
            case 'sms':
                $this->sendSms($user->phone, $message);
                break;
            case 'push':
                $this->sendPushNotification($user->id, $message);
                break;
        }
    }
}
```

<details>
<summary>Решение</summary>

```php
// ✅ High Cohesion: разделить на cohesive классы

// 1. Аутентификация (cohesive)
class AuthService
{
    public function register(array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        event(new UserRegistered($user));

        return $user;
    }

    public function login(string $email, string $password): ?User
    {
        if (Auth::attempt(['email' => $email, 'password' => $password])) {
            return Auth::user();
        }

        return null;
    }

    public function logout(User $user): void
    {
        Auth::logout();
    }
}

// 2. Профиль (cohesive)
class ProfileService
{
    public function update(User $user, array $data): User
    {
        $user->update($data);

        event(new ProfileUpdated($user));

        return $user->fresh();
    }

    public function uploadAvatar(User $user, UploadedFile $file): User
    {
        $path = $file->store('avatars', 's3');

        $user->update(['avatar' => $path]);

        return $user;
    }

    public function delete(User $user): void
    {
        $user->delete();

        event(new AccountDeleted($user));
    }
}

// 3. Polymorphism для уведомлений

// Интерфейс
interface NotificationChannel
{
    public function send(User $user, string $message): void;
}

// Реализации
class EmailChannel implements NotificationChannel
{
    public function send(User $user, string $message): void
    {
        Mail::to($user->email)->send(new GenericEmail($message));
    }
}

class SmsChannel implements NotificationChannel
{
    public function __construct(private SmsProvider $provider) {}

    public function send(User $user, string $message): void
    {
        $this->provider->send($user->phone, $message);
    }
}

class PushChannel implements NotificationChannel
{
    public function __construct(private PushProvider $provider) {}

    public function send(User $user, string $message): void
    {
        $this->provider->send($user->id, $message);
    }
}

// Notification Service
class NotificationService
{
    private array $channels = [];

    public function addChannel(string $name, NotificationChannel $channel): void
    {
        $this->channels[$name] = $channel;
    }

    public function send(User $user, string $message, string $channelName): void
    {
        $channel = $this->channels[$channelName]
            ?? throw new InvalidArgumentException("Unknown channel: $channelName");

        $channel->send($user, $message);
    }

    public function broadcast(User $user, string $message, array $channels): void
    {
        foreach ($channels as $channelName) {
            $this->send($user, $message, $channelName);
        }
    }
}

// Использование
$notificationService = new NotificationService();
$notificationService->addChannel('email', new EmailChannel());
$notificationService->addChannel('sms', new SmsChannel($smsProvider));
$notificationService->addChannel('push', new PushChannel($pushProvider));

// Отправить в один канал
$notificationService->send($user, 'Hello!', 'email');

// Broadcast в несколько каналов
$notificationService->broadcast($user, 'Important message', ['email', 'sms', 'push']);

// Преимущества:
// - Каждый класс имеет одну ответственность (High Cohesion)
// - Легко добавить новый канал (Open/Closed)
// - Нет switch/if (Polymorphism)
// - Легко тестировать каждый компонент
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
