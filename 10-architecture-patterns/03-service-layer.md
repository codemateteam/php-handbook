# 10.3 Service Layer

## Краткое резюме

> **Service Layer** — слой бизнес-логики между Controller и Model/Repository.
>
> **Зачем:** Тонкие контроллеры, переиспользование логики, тестируемость.
>
> **Важно:** Service вызывает Repository, другие Services, отправляет события. Контроллеры остаются тонкими.

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
Service Layer — слой бизнес-логики между Controller и Model/Repository. Инкапсулирует сложную логику.

**Зачем:**
- Тонкие контроллеры
- Переиспользование логики
- Тестируемость

---

## Как работает

**Структура:**

```
Controller → Service → Repository → Model
```

**Service:**

```php
// app/Services/OrderService.php
class OrderService
{
    public function __construct(
        private OrderRepository $orderRepository,
        private PaymentService $paymentService,
        private NotificationService $notificationService
    ) {}

    public function create(User $user, array $items): Order
    {
        DB::beginTransaction();

        try {
            // 1. Создать заказ
            $order = $this->orderRepository->create([
                'user_id' => $user->id,
                'total' => $this->calculateTotal($items),
            ]);

            // 2. Добавить items
            foreach ($items as $item) {
                $order->items()->create($item);
            }

            // 3. Списать оплату
            $this->paymentService->charge($user, $order->total);

            // 4. Отправить уведомление
            $this->notificationService->sendOrderConfirmation($user, $order);

            // 5. Event
            event(new OrderCreated($order));

            DB::commit();

            return $order;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    private function calculateTotal(array $items): float
    {
        return array_sum(array_column($items, 'price'));
    }
}
```

**Использование в Controller:**

```php
class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {}

    public function store(CreateOrderRequest $request)
    {
        $order = $this->orderService->create(
            $request->user(),
            $request->validated('items')
        );

        return redirect()->route('orders.show', $order);
    }
}
```

---

## Когда использовать

**Service для:**
- Бизнес-логика
- Операции с несколькими моделями
- Внешние API
- Сложные вычисления

**НЕ для:**
- Простые CRUD (достаточно Controller + Model)

---

## Пример из практики

**Service с несколькими зависимостями:**

```php
class UserService
{
    public function __construct(
        private UserRepository $userRepository,
        private MailService $mailService,
        private CacheService $cacheService
    ) {}

    public function register(array $data): User
    {
        // 1. Создать пользователя
        $user = $this->userRepository->create([
            'password' => Hash::make($data['password']),
            ...$data,
        ]);

        // 2. Отправить welcome email
        $this->mailService->sendWelcome($user);

        // 3. Очистить кеш
        $this->cacheService->forget('users.count');

        // 4. Event
        event(new UserRegistered($user));

        return $user;
    }

    public function updateProfile(User $user, array $data): User
    {
        $user = $this->userRepository->update($user, $data);

        // Инвалидация кеша
        $this->cacheService->forget("user.{$user->id}");

        return $user;
    }
}
```

**Action Classes (альтернатива):**

```php
// app/Actions/CreateOrderAction.php
class CreateOrderAction
{
    public function execute(User $user, array $items): Order
    {
        // Логика создания заказа
        return $order;
    }
}

// Controller
public function store(CreateOrderRequest $request, CreateOrderAction $action)
{
    $order = $action->execute($request->user(), $request->validated('items'));

    return redirect()->route('orders.show', $order);
}
```

---

## На собеседовании скажешь

> "Service Layer содержит бизнес-логику. Контроллеры остаются тонкими. Service вызывает Repository, другие Services, отправляет события. Используется для сложной логики, операций с несколькими моделями, внешних API. DI через конструктор. Альтернатива: Action Classes для одиночных операций. Тестируется через mock зависимостей."

---

## Практические задания

### Задание 1: Создай UserRegistrationService

Реализуй сервис регистрации пользователя который:
1. Создаёт пользователя
2. Отправляет welcome email
3. Создаёт начальные настройки
4. Отправляет событие UserRegistered

<details>
<summary>Решение</summary>

```php
// app/Services/UserRegistrationService.php
namespace App\Services;

use App\Contracts\UserRepositoryInterface;
use App\Events\UserRegistered;
use App\Mail\WelcomeEmail;
use App\Models\User;
use App\Models\UserSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class UserRegistrationService
{
    public function __construct(
        private UserRepositoryInterface $userRepository
    ) {}

    public function register(array $data): User
    {
        DB::beginTransaction();

        try {
            // 1. Создать пользователя
            $user = $this->userRepository->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);

            // 2. Создать начальные настройки
            UserSettings::create([
                'user_id' => $user->id,
                'theme' => 'light',
                'language' => 'en',
                'notifications_enabled' => true,
            ]);

            // 3. Отправить welcome email
            Mail::to($user->email)->send(new WelcomeEmail($user));

            // 4. Отправить событие
            event(new UserRegistered($user));

            DB::commit();

            return $user;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

// app/Http/Controllers/Auth/RegisterController.php
class RegisterController extends Controller
{
    public function __construct(
        private UserRegistrationService $registrationService
    ) {}

    public function store(RegisterRequest $request)
    {
        $user = $this->registrationService->register(
            $request->validated()
        );

        auth()->login($user);

        return redirect()->route('dashboard')
            ->with('success', 'Welcome to our platform!');
    }
}
```
</details>

### Задание 2: Реализуй PaymentService с несколькими gateway

Создай `PaymentService` который может работать с разными платёжными системами (Stripe, PayPal).

<details>
<summary>Решение</summary>

```php
// app/Contracts/PaymentGatewayInterface.php
namespace App\Contracts;

interface PaymentGatewayInterface
{
    public function charge(float $amount, array $paymentDetails): bool;
    public function refund(string $transactionId, float $amount): bool;
}

// app/Services/Payment/StripeGateway.php
namespace App\Services\Payment;

use App\Contracts\PaymentGatewayInterface;
use Stripe\Stripe;
use Stripe\Charge;

class StripeGateway implements PaymentGatewayInterface
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    public function charge(float $amount, array $paymentDetails): bool
    {
        try {
            Charge::create([
                'amount' => $amount * 100, // cents
                'currency' => 'usd',
                'source' => $paymentDetails['token'],
            ]);

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function refund(string $transactionId, float $amount): bool
    {
        // Stripe refund logic
        return true;
    }
}

// app/Services/Payment/PayPalGateway.php
namespace App\Services\Payment;

use App\Contracts\PaymentGatewayInterface;

class PayPalGateway implements PaymentGatewayInterface
{
    public function charge(float $amount, array $paymentDetails): bool
    {
        // PayPal charge logic
        return true;
    }

    public function refund(string $transactionId, float $amount): bool
    {
        // PayPal refund logic
        return true;
    }
}

// app/Services/PaymentService.php
namespace App\Services;

use App\Contracts\PaymentGatewayInterface;
use App\Models\Order;
use App\Models\Payment;

class PaymentService
{
    public function __construct(
        private PaymentGatewayInterface $gateway
    ) {}

    public function processOrderPayment(Order $order, array $paymentDetails): Payment
    {
        $success = $this->gateway->charge($order->total, $paymentDetails);

        $payment = Payment::create([
            'order_id' => $order->id,
            'amount' => $order->total,
            'status' => $success ? 'completed' : 'failed',
            'gateway' => get_class($this->gateway),
        ]);

        if ($success) {
            $order->update(['status' => 'paid']);
        }

        return $payment;
    }
}

// app/Providers/AppServiceProvider.php
public function register(): void
{
    $this->app->bind(
        PaymentGatewayInterface::class,
        function ($app) {
            return match (config('payment.default_gateway')) {
                'stripe' => new StripeGateway(),
                'paypal' => new PayPalGateway(),
                default => new StripeGateway(),
            };
        }
    );
}
```
</details>

### Задание 3: Action Class vs Service

Когда использовать Action Class вместо Service? Реализуй `SendPasswordResetEmailAction`.

<details>
<summary>Решение</summary>

```php
// Action Class используется для ОДНОЙ конкретной операции
// Service используется для ГРУППЫ связанных операций

// app/Actions/SendPasswordResetEmailAction.php
namespace App\Actions;

use App\Mail\PasswordResetEmail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

class SendPasswordResetEmailAction
{
    public function execute(string $email): bool
    {
        $user = User::where('email', $email)->first();

        if (!$user) {
            return false;
        }

        $token = Password::createToken($user);

        Mail::to($user->email)->send(
            new PasswordResetEmail($user, $token)
        );

        return true;
    }
}

// app/Http/Controllers/Auth/ForgotPasswordController.php
class ForgotPasswordController extends Controller
{
    public function sendResetLink(
        Request $request,
        SendPasswordResetEmailAction $action
    ) {
        $request->validate(['email' => 'required|email']);

        $sent = $action->execute($request->email);

        return $sent
            ? back()->with('status', 'Reset link sent!')
            : back()->withErrors(['email' => 'User not found']);
    }
}

// Сравнение:
// Action — одна операция, один метод execute()
// Service — несколько операций, несколько методов

// Example Service:
class UserService
{
    public function register(array $data): User { }
    public function updateProfile(User $user, array $data): User { }
    public function deleteAccount(User $user): bool { }
    public function suspendAccount(User $user): void { }
}

// Example Actions:
class RegisterUserAction { public function execute(array $data): User { } }
class UpdateUserProfileAction { public function execute(User $user, array $data): User { } }
class DeleteUserAccountAction { public function execute(User $user): bool { } }
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
