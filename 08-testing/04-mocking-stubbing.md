# 7.4 Mocking и Stubbing

## Краткое резюме

> **Mock** — поддельный объект для изоляции в тестах. Проверяет вызовы методов. **Stub** — просто возвращает данные без проверки.
>
> **Mockery:** `shouldReceive()` ожидает вызов, `with()` аргументы, `andReturn()` возврат, `once()`/`never()` количество.
>
> **Важно:** Laravel Fakes для фасадов: `Mail::fake()`, `Queue::fake()`, `Storage::fake()`. Не мокать Eloquent — использовать Factory. Spy проверяет вызовы постфактум.

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
Mock — поддельный объект для тестирования в изоляции. Stub — упрощённая реализация зависимости.

**Разница:**
- **Mock** — проверяет вызовы методов (shouldReceive, once)
- **Stub** — просто возвращает данные (willReturn)

---

## Как работает

**Mockery (Laravel по умолчанию):**

```php
use Mockery;

// Создать mock
$mock = Mockery::mock(PaymentGateway::class);

// Ожидать вызов
$mock->shouldReceive('charge')
    ->once()  // Ровно 1 раз
    ->with(100)  // С аргументом 100
    ->andReturn(true);  // Вернуть true

// Использовать
$result = $mock->charge(100);  // true
```

**PHPUnit Mock:**

```php
// Создать mock
$mock = $this->createMock(PaymentGateway::class);

// Настроить возврат
$mock->method('charge')
    ->with(100)
    ->willReturn(true);

// Использовать
$result = $mock->charge(100);  // true
```

---

## Когда использовать

**Используй Mock когда:**
- Тестируешь в изоляции (Unit тесты)
- Зависимость дорогая (API, БД)
- Нужна проверка вызовов

**Не используй когда:**
- Feature тесты (реальные зависимости)
- Простые объекты (DTO, Value Objects)

---

## Пример из практики

**Mock внешнего API:**

```php
// Service с API зависимостью
class WeatherService
{
    public function __construct(
        private HttpClient $http
    ) {}

    public function getTemperature(string $city): float
    {
        $response = $this->http->get("https://api.weather.com/{$city}");

        return $response['temperature'];
    }
}

// Unit тест с mock
class WeatherServiceTest extends TestCase
{
    public function test_returns_temperature(): void
    {
        // Mock HTTP client
        $http = Mockery::mock(HttpClient::class);
        $http->shouldReceive('get')
            ->once()
            ->with('https://api.weather.com/Moscow')
            ->andReturn(['temperature' => 15.5]);

        $service = new WeatherService($http);
        $result = $service->getTemperature('Moscow');

        $this->assertEquals(15.5, $result);
    }
}
```

**Mock с разными возвратами:**

```php
class NotificationService
{
    public function __construct(
        private MailService $mail,
        private SmsService $sms
    ) {}

    public function send(User $user, string $message): void
    {
        if ($user->prefers_email) {
            $this->mail->send($user->email, $message);
        } else {
            $this->sms->send($user->phone, $message);
        }
    }
}

// Тест для email
public function test_sends_email_if_user_prefers_email(): void
{
    $user = new User(['prefers_email' => true, 'email' => 'test@example.com']);

    $mail = Mockery::mock(MailService::class);
    $mail->shouldReceive('send')
        ->once()
        ->with('test@example.com', 'Hello');

    $sms = Mockery::mock(SmsService::class);
    $sms->shouldNotReceive('send');  // Не должен вызываться

    $service = new NotificationService($mail, $sms);
    $service->send($user, 'Hello');
}

// Тест для SMS
public function test_sends_sms_if_user_prefers_sms(): void
{
    $user = new User(['prefers_email' => false, 'phone' => '+79001234567']);

    $mail = Mockery::mock(MailService::class);
    $mail->shouldNotReceive('send');

    $sms = Mockery::mock(SmsService::class);
    $sms->shouldReceive('send')
        ->once()
        ->with('+79001234567', 'Hello');

    $service = new NotificationService($mail, $sms);
    $service->send($user, 'Hello');
}
```

**Spy (проверка вызовов после):**

```php
// Spy не требует настройки shouldReceive заранее
$logger = Mockery::spy(Logger::class);

$service = new OrderService($logger);
$service->create($user, $items);

// Проверить после выполнения
$logger->shouldHaveReceived('log')
    ->with('Order created', Mockery::type('array'));
```

**Partial Mock (mock только некоторых методов):**

```php
// Mock только charge(), остальные методы реальные
$gateway = Mockery::mock(PaymentGateway::class)->makePartial();
$gateway->shouldReceive('charge')
    ->andReturn(true);

// Реальные методы работают
$gateway->validate($card);  // Реальный метод
```

**Fake (Laravel Facades):**

```php
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

// Mail fake
Mail::fake();

// Код отправки email
Mail::to($user)->send(new Welcome());

// Проверить
Mail::assertSent(Welcome::class);
Mail::assertSent(Welcome::class, function ($mail) use ($user) {
    return $mail->hasTo($user->email);
});

// Queue fake
Queue::fake();
dispatch(new ProcessOrder($order));
Queue::assertPushed(ProcessOrder::class);

// Storage fake
Storage::fake('public');
$file = UploadedFile::fake()->image('photo.jpg');
$path = Storage::put('photos', $file);
Storage::assertExists($path);
```

**Mock Eloquent Model:**

```php
// ❌ НЕ мокать Eloquent напрямую
$user = Mockery::mock(User::class);  // Сложно, не нужно

// ✅ Использовать Factory
$user = User::factory()->make(['name' => 'John']);

// ✅ Или создать реальную модель
$user = new User(['name' => 'John']);
```

**Mock Repository:**

```php
// Interface
interface UserRepository
{
    public function find(int $id): ?User;
}

// Реализация
class EloquentUserRepository implements UserRepository
{
    public function find(int $id): ?User
    {
        return User::find($id);
    }
}

// Service
class UserService
{
    public function __construct(
        private UserRepository $users
    ) {}

    public function activate(int $id): void
    {
        $user = $this->users->find($id);
        $user->update(['active' => true]);
    }
}

// Unit тест (mock repository)
public function test_activates_user(): void
{
    $user = User::factory()->make(['id' => 1, 'active' => false]);

    $repository = Mockery::mock(UserRepository::class);
    $repository->shouldReceive('find')
        ->with(1)
        ->andReturn($user);

    $service = new UserService($repository);
    $service->activate(1);

    $this->assertTrue($user->active);
}

// Feature тест (реальный repository)
public function test_activates_user_in_database(): void
{
    $user = User::factory()->create(['active' => false]);

    $repository = new EloquentUserRepository();
    $service = new UserService($repository);
    $service->activate($user->id);

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'active' => true,
    ]);
}
```

**Argument Matchers:**

```php
// Любое значение
$mock->shouldReceive('method')
    ->with(Mockery::any());

// Определённый тип
$mock->shouldReceive('send')
    ->with(Mockery::type(User::class), Mockery::type('string'));

// Замыкание
$mock->shouldReceive('create')
    ->with(Mockery::on(function ($arg) {
        return $arg['email'] === 'test@example.com';
    }));

// Subset (массив содержит)
$mock->shouldReceive('log')
    ->with('Error', Mockery::subset(['user_id' => 1]));
```

---

## На собеседовании скажешь

> "Mock — поддельный объект для изоляции в тестах. Mockery: shouldReceive() ожидает вызов, with() аргументы, andReturn() возврат, once()/never() количество. Spy проверяет вызовы после выполнения. Partial mock мокает только некоторые методы. Laravel Fakes: Mail::fake(), Queue::fake(), Storage::fake(). Не мокать Eloquent — использовать Factory. Mock для дорогих зависимостей (API, email). Argument matchers: Mockery::type(), Mockery::any(), Mockery::on()."

---

## Практические задания

### Задание 1: Mock Payment Gateway

Создай `OrderService` который использует `PaymentGateway` для списания средств. Напиши unit тест с mock'ом gateway.

<details>
<summary>Решение</summary>

```php
// app/Services/OrderService.php
namespace App\Services;

use App\Models\{Order, User};
use App\Contracts\PaymentGatewayInterface;

class OrderService
{
    public function __construct(
        private PaymentGatewayInterface $paymentGateway
    ) {}

    public function createOrder(User $user, array $items, float $total): Order
    {
        // Списать деньги
        $transactionId = $this->paymentGateway->charge($user, $total);

        // Создать заказ
        $order = Order::create([
            'user_id' => $user->id,
            'items' => $items,
            'total' => $total,
            'transaction_id' => $transactionId,
            'status' => 'paid',
        ]);

        return $order;
    }

    public function refundOrder(Order $order): bool
    {
        if ($order->status !== 'paid') {
            throw new \RuntimeException('Only paid orders can be refunded');
        }

        $success = $this->paymentGateway->refund(
            $order->transaction_id,
            $order->total
        );

        if ($success) {
            $order->update(['status' => 'refunded']);
        }

        return $success;
    }
}

// tests/Unit/OrderServiceTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\OrderService;
use App\Contracts\PaymentGatewayInterface;
use App\Models\{Order, User};
use Mockery;

class OrderServiceTest extends TestCase
{
    public function test_creates_order_and_charges_payment(): void
    {
        // Mock payment gateway
        $gateway = Mockery::mock(PaymentGatewayInterface::class);
        $gateway->shouldReceive('charge')
            ->once()
            ->with(Mockery::type(User::class), 150.00)
            ->andReturn('txn_123456');

        $user = User::factory()->make(['id' => 1]);
        $items = [
            ['product_id' => 1, 'quantity' => 2, 'price' => 50],
            ['product_id' => 2, 'quantity' => 1, 'price' => 50],
        ];

        $service = new OrderService($gateway);
        $order = $service->createOrder($user, $items, 150.00);

        $this->assertInstanceOf(Order::class, $order);
        $this->assertEquals('paid', $order->status);
        $this->assertEquals('txn_123456', $order->transaction_id);
    }

    public function test_refunds_paid_order(): void
    {
        $gateway = Mockery::mock(PaymentGatewayInterface::class);
        $gateway->shouldReceive('refund')
            ->once()
            ->with('txn_123456', 150.00)
            ->andReturn(true);

        $order = Order::factory()->make([
            'status' => 'paid',
            'transaction_id' => 'txn_123456',
            'total' => 150.00,
        ]);

        $service = new OrderService($gateway);
        $result = $service->refundOrder($order);

        $this->assertTrue($result);
        $this->assertEquals('refunded', $order->status);
    }

    public function test_throws_exception_when_refunding_unpaid_order(): void
    {
        $gateway = Mockery::mock(PaymentGatewayInterface::class);
        $gateway->shouldNotReceive('refund');

        $order = Order::factory()->make(['status' => 'pending']);

        $service = new OrderService($gateway);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Only paid orders can be refunded');

        $service->refundOrder($order);
    }
}
```
</details>

### Задание 2: Spy для Logger

Создай `UserRegistrationService` который логирует действия. Используй Spy для проверки вызовов logger после выполнения.

<details>
<summary>Решение</summary>

```php
// app/Services/UserRegistrationService.php
namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Psr\Log\LoggerInterface;

class UserRegistrationService
{
    public function __construct(
        private LoggerInterface $logger
    ) {}

    public function register(array $data): User
    {
        $this->logger->info('User registration started', [
            'email' => $data['email'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $this->logger->info('User registered successfully', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return $user;
    }

    public function registerWithReferral(array $data, string $referralCode): User
    {
        $this->logger->info('Registration with referral', [
            'email' => $data['email'],
            'referral_code' => $referralCode,
        ]);

        $user = $this->register($data);

        // Логика реферальной программы
        $this->logger->info('Referral bonus applied', [
            'user_id' => $user->id,
            'referral_code' => $referralCode,
        ]);

        return $user;
    }
}

// tests/Unit/UserRegistrationServiceTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\UserRegistrationService;
use Psr\Log\LoggerInterface;
use Mockery;

class UserRegistrationServiceTest extends TestCase
{
    public function test_logs_registration_process(): void
    {
        // Spy не требует shouldReceive заранее
        $logger = Mockery::spy(LoggerInterface::class);

        $service = new UserRegistrationService($logger);

        $user = $service->register([
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        // Проверить вызовы ПОСЛЕ выполнения
        $logger->shouldHaveReceived('info')
            ->with('User registration started', Mockery::subset([
                'email' => 'john@example.com',
            ]));

        $logger->shouldHaveReceived('info')
            ->with('User registered successfully', Mockery::subset([
                'email' => 'john@example.com',
            ]));
    }

    public function test_logs_referral_registration(): void
    {
        $logger = Mockery::spy(LoggerInterface::class);

        $service = new UserRegistrationService($logger);

        $user = $service->registerWithReferral([
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'password123',
        ], 'REF123');

        // Должно быть 4 вызова info()
        $logger->shouldHaveReceived('info')->times(4);

        // Проверить вызов с реферальным кодом
        $logger->shouldHaveReceived('info')
            ->with('Registration with referral', Mockery::subset([
                'referral_code' => 'REF123',
            ]));
    }
}
```
</details>

### Задание 3: Laravel Fakes для Mail и Queue

Напиши тест для регистрации пользователя, которая отправляет welcome email и запускает job для обработки. Используй fakes.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/RegisterController.php
namespace App\Http\Controllers;

use App\Models\User;
use App\Mail\WelcomeEmail;
use App\Jobs\ProcessNewUser;
use Illuminate\Support\Facades\{Hash, Mail};
use Illuminate\Http\Request;

class RegisterController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        // Отправить welcome email
        Mail::to($user)->send(new WelcomeEmail($user));

        // Запустить job для обработки
        ProcessNewUser::dispatch($user);

        return response()->json([
            'message' => 'Registration successful',
            'user' => $user,
        ], 201);
    }
}

// tests/Feature/RegisterControllerTest.php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Mail\WelcomeEmail;
use App\Jobs\ProcessNewUser;
use Illuminate\Support\Facades\{Mail, Queue};
use Illuminate\Foundation\Testing\RefreshDatabase;

class RegisterControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_registers_user_and_sends_email(): void
    {
        Mail::fake();
        Queue::fake();

        $response = $this->postJson('/register', [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(201);
        $response->assertJson([
            'message' => 'Registration successful',
        ]);

        // Проверить пользователя в БД
        $this->assertDatabaseHas('users', [
            'email' => 'john@example.com',
        ]);

        $user = User::where('email', 'john@example.com')->first();

        // Проверить отправку email
        Mail::assertSent(WelcomeEmail::class, function ($mail) use ($user) {
            return $mail->hasTo($user->email);
        });

        // Проверить dispatch job
        Queue::assertPushed(ProcessNewUser::class, function ($job) use ($user) {
            return $job->user->id === $user->id;
        });
    }

    public function test_does_not_send_email_on_validation_failure(): void
    {
        Mail::fake();
        Queue::fake();

        $response = $this->postJson('/register', [
            'name' => 'John',
            'email' => 'invalid-email',  // Невалидный email
            'password' => '123',  // Слишком короткий
        ]);

        $response->assertStatus(422);

        // Email и Job НЕ должны быть отправлены
        Mail::assertNothingSent();
        Queue::assertNothingPushed();
    }

    public function test_rejects_duplicate_email(): void
    {
        Mail::fake();
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/register', [
            'name' => 'John Doe',
            'email' => 'existing@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);

        Mail::assertNothingSent();
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
