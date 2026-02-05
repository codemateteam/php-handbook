# 7.1 Unit тесты

## Краткое резюме

> **Unit тесты** — тестирование отдельных компонентов (функций, методов, классов) в изоляции. Быстрые, без БД/HTTP. Структура AAA: Arrange-Act-Assert.
>
> **Создание:** `php artisan make:test UserTest --unit`. Assertions: `assertEquals()`, `assertTrue()`, `expectException()`.
>
> **Важно:** Mock зависимостей через Mockery. Data providers для параметризованных тестов. `setUp()`/`tearDown()` для подготовки/очистки.

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
Unit тесты — тестирование отдельных компонентов (функций, методов, классов) в изоляции от остальной системы.

**Основное:**
- Тестируют одну "единицу" кода
- Быстрые (без БД, HTTP, файлов)
- Изолированные (mock зависимостей)

---

## Как работает

**Создание теста:**

```bash
# Unit тест (без БД)
php artisan make:test UserTest --unit

# Или вручную создать в tests/Unit/
```

**Структура теста:**

```php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\Calculator;

class CalculatorTest extends TestCase
{
    public function test_adds_two_numbers(): void
    {
        // Arrange (подготовка)
        $calculator = new Calculator();

        // Act (действие)
        $result = $calculator->add(2, 3);

        // Assert (проверка)
        $this->assertEquals(5, $result);
    }

    public function test_subtracts_two_numbers(): void
    {
        $calculator = new Calculator();
        $result = $calculator->subtract(10, 4);

        $this->assertEquals(6, $result);
    }
}
```

**Assertions (проверки):**

```php
// Равенство
$this->assertEquals(expected, actual);
$this->assertSame(expected, actual);  // Строгое (===)

// Boolean
$this->assertTrue($value);
$this->assertFalse($value);

// Null
$this->assertNull($value);
$this->assertNotNull($value);

// Массивы
$this->assertContains('apple', ['apple', 'banana']);
$this->assertCount(3, $array);
$this->assertEmpty($array);

// Строки
$this->assertStringContainsString('hello', 'hello world');
$this->assertStringStartsWith('hello', 'hello world');

// Exceptions
$this->expectException(InvalidArgumentException::class);
$this->expectExceptionMessage('Invalid value');
someFunction();

// Instance
$this->assertInstanceOf(User::class, $user);
```

---

## Когда использовать

**Unit тесты для:**
- Бизнес-логика (Services, Actions)
- Вычисления (Calculator, Formatter)
- Валидация (Custom Rules)
- Utility функции

**НЕ для:**
- Контроллеры (Feature тесты)
- Работа с БД (Feature тесты)
- HTTP запросы (Feature тесты)

---

## Пример из практики

**Тестирование Service:**

```php
// app/Services/PriceCalculator.php
class PriceCalculator
{
    public function calculate(Product $product, int $quantity, ?string $promoCode = null): float
    {
        $total = $product->price * $quantity;

        if ($promoCode) {
            $discount = $this->getDiscount($promoCode);
            $total -= $total * ($discount / 100);
        }

        return round($total, 2);
    }

    private function getDiscount(string $promoCode): int
    {
        $discounts = [
            'SAVE10' => 10,
            'SAVE20' => 20,
            'SAVE50' => 50,
        ];

        return $discounts[$promoCode] ?? 0;
    }
}

// tests/Unit/PriceCalculatorTest.php
class PriceCalculatorTest extends TestCase
{
    private PriceCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new PriceCalculator();
    }

    public function test_calculates_price_without_promo_code(): void
    {
        $product = new Product(['price' => 100]);
        $result = $this->calculator->calculate($product, 2);

        $this->assertEquals(200, $result);
    }

    public function test_applies_10_percent_discount(): void
    {
        $product = new Product(['price' => 100]);
        $result = $this->calculator->calculate($product, 2, 'SAVE10');

        $this->assertEquals(180, $result);  // 200 - 10% = 180
    }

    public function test_applies_20_percent_discount(): void
    {
        $product = new Product(['price' => 100]);
        $result = $this->calculator->calculate($product, 1, 'SAVE20');

        $this->assertEquals(80, $result);  // 100 - 20% = 80
    }

    public function test_ignores_invalid_promo_code(): void
    {
        $product = new Product(['price' => 100]);
        $result = $this->calculator->calculate($product, 1, 'INVALID');

        $this->assertEquals(100, $result);  // Без скидки
    }

    public function test_rounds_to_two_decimals(): void
    {
        $product = new Product(['price' => 99.99]);
        $result = $this->calculator->calculate($product, 3, 'SAVE10');

        $this->assertEquals(269.97, $result);  // (99.99 * 3) - 10%
    }
}
```

**Data Providers (параметризованные тесты):**

```php
class PriceCalculatorTest extends TestCase
{
    /**
     * @dataProvider priceDataProvider
     */
    public function test_calculates_price_with_various_inputs(
        float $price,
        int $quantity,
        ?string $promoCode,
        float $expected
    ): void {
        $product = new Product(['price' => $price]);
        $calculator = new PriceCalculator();
        $result = $calculator->calculate($product, $quantity, $promoCode);

        $this->assertEquals($expected, $result);
    }

    public static function priceDataProvider(): array
    {
        return [
            'без промокода' => [100, 2, null, 200],
            'SAVE10' => [100, 2, 'SAVE10', 180],
            'SAVE20' => [100, 1, 'SAVE20', 80],
            'SAVE50' => [100, 1, 'SAVE50', 50],
            'невалидный промокод' => [100, 1, 'INVALID', 100],
        ];
    }
}
```

**Тестирование с Mock:**

```php
// Service с зависимостью
class OrderService
{
    public function __construct(
        private PaymentGateway $paymentGateway,
        private NotificationService $notificationService
    ) {}

    public function create(User $user, array $items): Order
    {
        $total = $this->calculateTotal($items);

        // Списать деньги
        $this->paymentGateway->charge($user, $total);

        // Создать заказ
        $order = Order::create([
            'user_id' => $user->id,
            'total' => $total,
        ]);

        // Отправить уведомление
        $this->notificationService->send($user, "Order #{$order->id} created");

        return $order;
    }

    private function calculateTotal(array $items): float
    {
        return array_sum(array_column($items, 'price'));
    }
}

// Unit тест с mock
class OrderServiceTest extends TestCase
{
    public function test_creates_order_and_charges_payment(): void
    {
        // Arrange
        $paymentGateway = Mockery::mock(PaymentGateway::class);
        $notificationService = Mockery::mock(NotificationService::class);

        $user = new User(['id' => 1]);
        $items = [
            ['price' => 100],
            ['price' => 200],
        ];

        // Ожидаем вызов charge с total = 300
        $paymentGateway->shouldReceive('charge')
            ->once()
            ->with($user, 300);

        // Ожидаем вызов send
        $notificationService->shouldReceive('send')
            ->once()
            ->with($user, Mockery::type('string'));

        $service = new OrderService($paymentGateway, $notificationService);

        // Act & Assert
        $order = $service->create($user, $items);

        $this->assertInstanceOf(Order::class, $order);
        $this->assertEquals(300, $order->total);
    }
}
```

**Тестирование Validation Rule:**

```php
// app/Rules/ValidPromoCode.php
class ValidPromoCode implements Rule
{
    public function passes($attribute, $value): bool
    {
        return PromoCode::where('code', $value)
            ->where('expires_at', '>', now())
            ->exists();
    }

    public function message(): string
    {
        return 'Промокод недействителен или истёк';
    }
}

// tests/Unit/ValidPromoCodeTest.php
class ValidPromoCodeTest extends TestCase
{
    public function test_passes_for_valid_promo_code(): void
    {
        // Mock PromoCode query
        PromoCode::shouldReceive('where->where->exists')
            ->andReturn(true);

        $rule = new ValidPromoCode();
        $result = $rule->passes('promo_code', 'VALID');

        $this->assertTrue($result);
    }

    public function test_fails_for_expired_promo_code(): void
    {
        PromoCode::shouldReceive('where->where->exists')
            ->andReturn(false);

        $rule = new ValidPromoCode();
        $result = $rule->passes('promo_code', 'EXPIRED');

        $this->assertFalse($result);
    }

    public function test_returns_error_message(): void
    {
        $rule = new ValidPromoCode();
        $message = $rule->message();

        $this->assertEquals('Промокод недействителен или истёк', $message);
    }
}
```

**Запуск тестов:**

```bash
# Все unit тесты
php artisan test --testsuite=Unit

# Конкретный файл
php artisan test tests/Unit/PriceCalculatorTest.php

# Конкретный метод
php artisan test --filter test_calculates_price

# С coverage
php artisan test --coverage
```

---

## На собеседовании скажешь

> "Unit тесты проверяют отдельные компоненты в изоляции. Структура AAA: Arrange (подготовка), Act (действие), Assert (проверка). Assertions: assertEquals, assertTrue, assertInstanceOf, expectException. Mock зависимостей через Mockery (shouldReceive, once, with). Data providers для параметризованных тестов. setUp() для подготовки, tearDown() для очистки. Unit тесты быстрые (без БД, HTTP). Тестирую Services, Rules, Helpers."

---

## Практические задания

### Задание 1: Тест для Calculator с Data Provider

Создай класс `Calculator` с методами `add()`, `subtract()`, `multiply()`, `divide()`. Напиши unit тест с Data Provider для проверки всех операций.

<details>
<summary>Решение</summary>

```php
// app/Services/Calculator.php
namespace App\Services;

class Calculator
{
    public function add(float $a, float $b): float
    {
        return $a + $b;
    }

    public function subtract(float $a, float $b): float
    {
        return $a - $b;
    }

    public function multiply(float $a, float $b): float
    {
        return $a * $b;
    }

    public function divide(float $a, float $b): float
    {
        if ($b === 0.0) {
            throw new \InvalidArgumentException('Division by zero');
        }

        return $a / $b;
    }
}

// tests/Unit/CalculatorTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\Calculator;

class CalculatorTest extends TestCase
{
    private Calculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new Calculator();
    }

    /**
     * @dataProvider mathOperationsProvider
     */
    public function test_performs_math_operations(
        string $operation,
        float $a,
        float $b,
        float $expected
    ): void {
        $result = $this->calculator->$operation($a, $b);
        $this->assertEquals($expected, $result);
    }

    public static function mathOperationsProvider(): array
    {
        return [
            'add positive' => ['add', 5, 3, 8],
            'add negative' => ['add', -5, -3, -8],
            'subtract' => ['subtract', 10, 4, 6],
            'multiply' => ['multiply', 6, 7, 42],
            'divide' => ['divide', 20, 4, 5],
        ];
    }

    public function test_divide_by_zero_throws_exception(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Division by zero');

        $this->calculator->divide(10, 0);
    }
}
```
</details>

### Задание 2: Mock внешнего сервиса

Создай `WeatherService` который использует `HttpClient` для получения погоды. Напиши unit тест с mock'ом HTTP клиента.

<details>
<summary>Решение</summary>

```php
// app/Services/WeatherService.php
namespace App\Services;

class WeatherService
{
    public function __construct(private HttpClient $http)
    {
    }

    public function getTemperature(string $city): float
    {
        $response = $this->http->get("https://api.weather.com/v1/current", [
            'q' => $city,
        ]);

        if (!isset($response['main']['temp'])) {
            throw new \RuntimeException('Invalid API response');
        }

        return $response['main']['temp'];
    }

    public function getForecast(string $city, int $days): array
    {
        $response = $this->http->get("https://api.weather.com/v1/forecast", [
            'q' => $city,
            'days' => $days,
        ]);

        return $response['forecast'] ?? [];
    }
}

// tests/Unit/WeatherServiceTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\WeatherService;
use App\Services\HttpClient;
use Mockery;

class WeatherServiceTest extends TestCase
{
    public function test_gets_temperature_for_city(): void
    {
        // Mock HTTP client
        $http = Mockery::mock(HttpClient::class);
        $http->shouldReceive('get')
            ->once()
            ->with('https://api.weather.com/v1/current', ['q' => 'London'])
            ->andReturn([
                'main' => ['temp' => 18.5],
            ]);

        $service = new WeatherService($http);
        $temperature = $service->getTemperature('London');

        $this->assertEquals(18.5, $temperature);
    }

    public function test_throws_exception_for_invalid_response(): void
    {
        $http = Mockery::mock(HttpClient::class);
        $http->shouldReceive('get')
            ->andReturn([]);  // Невалидный ответ

        $service = new WeatherService($http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Invalid API response');

        $service->getTemperature('London');
    }

    public function test_gets_forecast(): void
    {
        $http = Mockery::mock(HttpClient::class);
        $http->shouldReceive('get')
            ->once()
            ->with('https://api.weather.com/v1/forecast', [
                'q' => 'Paris',
                'days' => 7,
            ])
            ->andReturn([
                'forecast' => [
                    ['day' => 1, 'temp' => 20],
                    ['day' => 2, 'temp' => 22],
                ],
            ]);

        $service = new WeatherService($http);
        $forecast = $service->getForecast('Paris', 7);

        $this->assertCount(2, $forecast);
        $this->assertEquals(20, $forecast[0]['temp']);
    }
}
```
</details>

### Задание 3: Тест для Validation Rule

Создай custom validation rule `StrongPassword` (минимум 8 символов, 1 буква, 1 цифра, 1 спецсимвол). Напиши unit тесты для всех случаев.

<details>
<summary>Решение</summary>

```php
// app/Rules/StrongPassword.php
namespace App\Rules;

use Illuminate\Contracts\Validation\Rule;

class StrongPassword implements Rule
{
    public function passes($attribute, $value): bool
    {
        // Минимум 8 символов
        if (strlen($value) < 8) {
            return false;
        }

        // Должна быть хотя бы одна буква
        if (!preg_match('/[a-zA-Z]/', $value)) {
            return false;
        }

        // Должна быть хотя бы одна цифра
        if (!preg_match('/[0-9]/', $value)) {
            return false;
        }

        // Должен быть хотя бы один спецсимвол
        if (!preg_match('/[^a-zA-Z0-9]/', $value)) {
            return false;
        }

        return true;
    }

    public function message(): string
    {
        return 'Пароль должен содержать минимум 8 символов, включая буквы, цифры и спецсимволы.';
    }
}

// tests/Unit/StrongPasswordTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Rules\StrongPassword;

class StrongPasswordTest extends TestCase
{
    private StrongPassword $rule;

    protected function setUp(): void
    {
        parent::setUp();
        $this->rule = new StrongPassword();
    }

    public function test_passes_for_strong_password(): void
    {
        $result = $this->rule->passes('password', 'Abc123!@');

        $this->assertTrue($result);
    }

    public function test_fails_for_short_password(): void
    {
        $result = $this->rule->passes('password', 'Ab1!');

        $this->assertFalse($result);
    }

    public function test_fails_without_letters(): void
    {
        $result = $this->rule->passes('password', '12345678!@');

        $this->assertFalse($result);
    }

    public function test_fails_without_digits(): void
    {
        $result = $this->rule->passes('password', 'Abcdefg!@');

        $this->assertFalse($result);
    }

    public function test_fails_without_special_chars(): void
    {
        $result = $this->rule->passes('password', 'Abcdefg123');

        $this->assertFalse($result);
    }

    /**
     * @dataProvider strongPasswordsProvider
     */
    public function test_accepts_various_strong_passwords(string $password): void
    {
        $result = $this->rule->passes('password', $password);

        $this->assertTrue($result);
    }

    public static function strongPasswordsProvider(): array
    {
        return [
            ['Password123!'],
            ['MyP@ssw0rd'],
            ['Str0ng#Pass'],
            ['C0mpl3x$Pass'],
        ];
    }

    public function test_returns_correct_error_message(): void
    {
        $message = $this->rule->message();

        $this->assertStringContainsString('минимум 8 символов', $message);
        $this->assertStringContainsString('буквы', $message);
        $this->assertStringContainsString('цифры', $message);
        $this->assertStringContainsString('спецсимволы', $message);
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
