# 7.3 TDD (Test-Driven Development)

## Краткое резюме

> **TDD** — методология разработки, где тесты пишутся ДО кода. Цикл Red-Green-Refactor: failing тест → минимальный код → рефакторинг.
>
> **Преимущества:** Продуманный API, высокое покрытие (100%), меньше багов. Тесты как документация.
>
> **Важно:** Подходит для бизнес-логики, API, алгоритмов. НЕ для прототипов и UI. Каждый цикл должен быть маленьким (5-10 минут).

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
TDD — методология разработки, где тесты пишутся ДО кода. Цикл: Red → Green → Refactor.

**Цикл TDD:**
1. **Red** — написать failing тест
2. **Green** — написать минимальный код для прохождения
3. **Refactor** — улучшить код

---

## Как работает

**Цикл Red-Green-Refactor:**

```php
// 1. RED: Написать failing тест
class CalculatorTest extends TestCase
{
    public function test_adds_two_numbers(): void
    {
        $calculator = new Calculator();  // Класса ещё нет
        $result = $calculator->add(2, 3);

        $this->assertEquals(5, $result);
    }
}

// Запустить: php artisan test
// Ошибка: Class Calculator not found

// 2. GREEN: Минимальный код для прохождения
class Calculator
{
    public function add(int $a, int $b): int
    {
        return $a + $b;  // Простейшая реализация
    }
}

// Запустить: php artisan test
// ✅ PASS

// 3. REFACTOR: Улучшить (если нужно)
// В данном случае код уже хорош
```

**Пример полного цикла:**

```php
// Задача: создать PriceCalculator с применением скидок

// 1. RED: Тест без скидки
public function test_calculates_price_without_discount(): void
{
    $calculator = new PriceCalculator();  // Класса нет
    $result = $calculator->calculate(100, 2);

    $this->assertEquals(200, $result);
}

// 2. GREEN: Создать класс
class PriceCalculator
{
    public function calculate(float $price, int $quantity): float
    {
        return $price * $quantity;
    }
}
// ✅ PASS

// 3. RED: Добавить тест со скидкой
public function test_applies_10_percent_discount(): void
{
    $calculator = new PriceCalculator();
    $result = $calculator->calculate(100, 2, 10);  // 10% discount

    $this->assertEquals(180, $result);  // 200 - 10%
}
// ❌ FAIL: Missing argument 3

// 4. GREEN: Добавить discount параметр
class PriceCalculator
{
    public function calculate(float $price, int $quantity, float $discount = 0): float
    {
        $total = $price * $quantity;
        return $total - ($total * $discount / 100);
    }
}
// ✅ PASS

// 5. REFACTOR: Улучшить читаемость
class PriceCalculator
{
    public function calculate(float $price, int $quantity, float $discountPercent = 0): float
    {
        $subtotal = $this->calculateSubtotal($price, $quantity);
        $discount = $this->calculateDiscount($subtotal, $discountPercent);

        return $subtotal - $discount;
    }

    private function calculateSubtotal(float $price, int $quantity): float
    {
        return $price * $quantity;
    }

    private function calculateDiscount(float $amount, float $percent): float
    {
        return $amount * $percent / 100;
    }
}
// ✅ PASS (тесты не изменились, но код лучше)
```

---

## Когда использовать

**Плюсы TDD:**
- ✅ Дизайн API (думаешь о публичном интерфейсе)
- ✅ Высокое покрытие (100% по умолчанию)
- ✅ Документация (тесты как примеры)
- ✅ Меньше багов

**Минусы TDD:**
- ❌ Медленнее начало
- ❌ Требует опыта
- ❌ Не всегда подходит (UI, прототипы)

**Когда использовать:**
- Критичная бизнес-логика
- Public API/Library
- Сложные алгоритмы

**Когда НЕ использовать:**
- Прототипирование
- UI/Frontend
- Простые CRUD

---

## Пример из практики

**TDD для Validation Rule:**

```php
// 1. RED: Тест для валидного промокода
class ValidPromoCodeTest extends TestCase
{
    public function test_passes_for_valid_promo_code(): void
    {
        $rule = new ValidPromoCode();  // Класса нет
        $result = $rule->passes('promo_code', 'SAVE10');

        $this->assertTrue($result);
    }
}
// ❌ FAIL

// 2. GREEN: Создать класс
class ValidPromoCode implements Rule
{
    public function passes($attribute, $value): bool
    {
        return true;  // Простейшая реализация
    }

    public function message(): string
    {
        return 'Invalid promo code';
    }
}
// ✅ PASS

// 3. RED: Тест для истёкшего промокода
public function test_fails_for_expired_promo_code(): void
{
    // Создать истёкший промокод
    PromoCode::factory()->create([
        'code' => 'EXPIRED',
        'expires_at' => now()->subDay(),
    ]);

    $rule = new ValidPromoCode();
    $result = $rule->passes('promo_code', 'EXPIRED');

    $this->assertFalse($result);
}
// ❌ FAIL (всегда возвращает true)

// 4. GREEN: Реализовать проверку
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
// ✅ PASS

// 5. RED: Тест для несуществующего промокода
public function test_fails_for_nonexistent_promo_code(): void
{
    $rule = new ValidPromoCode();
    $result = $rule->passes('promo_code', 'NONEXISTENT');

    $this->assertFalse($result);
}
// ✅ PASS (уже работает)

// 6. REFACTOR: Улучшить (если нужно)
// Код уже хорош
```

**TDD для Service с зависимостями:**

```php
// Задача: OrderService должен создавать заказ и списывать деньги

// 1. RED: Тест создания заказа
class OrderServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_order(): void
    {
        $user = User::factory()->create(['balance' => 1000]);
        $product = Product::factory()->create(['price' => 100]);

        $service = new OrderService();  // Класса нет
        $order = $service->create($user, [
            ['product_id' => $product->id, 'quantity' => 2],
        ]);

        $this->assertInstanceOf(Order::class, $order);
        $this->assertEquals(200, $order->total);
    }
}
// ❌ FAIL

// 2. GREEN: Простейшая реализация
class OrderService
{
    public function create(User $user, array $items): Order
    {
        $total = 0;
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            $total += $product->price * $item['quantity'];
        }

        return Order::create([
            'user_id' => $user->id,
            'total' => $total,
        ]);
    }
}
// ✅ PASS

// 3. RED: Тест списания баланса
public function test_deducts_balance(): void
{
    $user = User::factory()->create(['balance' => 1000]);
    $product = Product::factory()->create(['price' => 100]);

    $service = new OrderService();
    $service->create($user, [
        ['product_id' => $product->id, 'quantity' => 2],
    ]);

    $this->assertEquals(800, $user->fresh()->balance);  // 1000 - 200
}
// ❌ FAIL (баланс не изменился)

// 4. GREEN: Добавить списание
class OrderService
{
    public function create(User $user, array $items): Order
    {
        $total = 0;
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            $total += $product->price * $item['quantity'];
        }

        $order = Order::create([
            'user_id' => $user->id,
            'total' => $total,
        ]);

        $user->decrement('balance', $total);

        return $order;
    }
}
// ✅ PASS

// 5. RED: Тест для недостаточного баланса
public function test_throws_exception_for_insufficient_balance(): void
{
    $user = User::factory()->create(['balance' => 50]);
    $product = Product::factory()->create(['price' => 100]);

    $this->expectException(InsufficientFundsException::class);

    $service = new OrderService();
    $service->create($user, [
        ['product_id' => $product->id, 'quantity' => 2],
    ]);
}
// ❌ FAIL

// 6. GREEN: Добавить проверку
class OrderService
{
    public function create(User $user, array $items): Order
    {
        $total = 0;
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            $total += $product->price * $item['quantity'];
        }

        if ($user->balance < $total) {
            throw new InsufficientFundsException();
        }

        $order = Order::create([
            'user_id' => $user->id,
            'total' => $total,
        ]);

        $user->decrement('balance', $total);

        return $order;
    }
}
// ✅ PASS

// 7. REFACTOR: Извлечь методы
class OrderService
{
    public function create(User $user, array $items): Order
    {
        $total = $this->calculateTotal($items);

        $this->validateBalance($user, $total);

        DB::transaction(function () use ($user, $items, $total) {
            $order = $this->createOrder($user, $items, $total);
            $this->deductBalance($user, $total);

            return $order;
        });
    }

    private function calculateTotal(array $items): float
    {
        $total = 0;
        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            $total += $product->price * $item['quantity'];
        }
        return $total;
    }

    private function validateBalance(User $user, float $total): void
    {
        if ($user->balance < $total) {
            throw new InsufficientFundsException();
        }
    }

    private function createOrder(User $user, array $items, float $total): Order
    {
        return Order::create([
            'user_id' => $user->id,
            'total' => $total,
        ]);
    }

    private function deductBalance(User $user, float $total): void
    {
        $user->decrement('balance', $total);
    }
}
// ✅ PASS (все тесты проходят, код лучше)
```

---

## На собеседовании скажешь

> "TDD — тесты пишутся ДО кода. Цикл: Red (failing тест) → Green (минимальный код) → Refactor (улучшить). Плюсы: дизайн API, высокое покрытие, меньше багов. Минусы: медленнее начало, требует опыта. Использую для критичной бизнес-логики, API, сложных алгоритмов. Не использую для прототипов, UI. Тесты как документация и примеры использования."

---

## Практические задания

### Задание 1: Discount Calculator с TDD

Используя TDD, создай `DiscountCalculator` с методом `calculate(price, discountPercent)`. Реализуй пошагово: базовый расчет → проверка отрицательных значений → округление до 2 знаков.

<details>
<summary>Решение</summary>

```php
// ШАГ 1: RED - Написать первый тест
// tests/Unit/DiscountCalculatorTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\DiscountCalculator;

class DiscountCalculatorTest extends TestCase
{
    public function test_calculates_discount(): void
    {
        $calculator = new DiscountCalculator();  // Класса ещё нет
        $result = $calculator->calculate(100, 10);

        $this->assertEquals(90, $result);
    }
}

// Запустить: php artisan test
// ❌ FAIL: Class DiscountCalculator not found

// ШАГ 2: GREEN - Создать минимальный класс
// app/Services/DiscountCalculator.php
namespace App\Services;

class DiscountCalculator
{
    public function calculate(float $price, float $discountPercent): float
    {
        return $price - ($price * $discountPercent / 100);
    }
}

// ✅ PASS

// ШАГ 3: RED - Добавить тест на отрицательные значения
public function test_throws_exception_for_negative_price(): void
{
    $calculator = new DiscountCalculator();

    $this->expectException(\InvalidArgumentException::class);
    $calculator->calculate(-100, 10);
}

// ❌ FAIL: Expected exception not thrown

// ШАГ 4: GREEN - Добавить валидацию
class DiscountCalculator
{
    public function calculate(float $price, float $discountPercent): float
    {
        if ($price < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        if ($discountPercent < 0 || $discountPercent > 100) {
            throw new \InvalidArgumentException('Discount must be between 0 and 100');
        }

        return $price - ($price * $discountPercent / 100);
    }
}

// ✅ PASS

// ШАГ 5: RED - Тест на округление
public function test_rounds_to_two_decimals(): void
{
    $calculator = new DiscountCalculator();
    $result = $calculator->calculate(99.99, 15);

    $this->assertEquals(84.99, $result);
}

// ❌ FAIL: Expected 84.99, got 84.9915

// ШАГ 6: GREEN - Добавить округление
class DiscountCalculator
{
    public function calculate(float $price, float $discountPercent): float
    {
        if ($price < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        if ($discountPercent < 0 || $discountPercent > 100) {
            throw new \InvalidArgumentException('Discount must be between 0 and 100');
        }

        $finalPrice = $price - ($price * $discountPercent / 100);
        return round($finalPrice, 2);
    }
}

// ✅ PASS

// ШАГ 7: REFACTOR - Улучшить читаемость
class DiscountCalculator
{
    public function calculate(float $price, float $discountPercent): float
    {
        $this->validatePrice($price);
        $this->validateDiscount($discountPercent);

        $discountAmount = $this->calculateDiscountAmount($price, $discountPercent);
        $finalPrice = $price - $discountAmount;

        return round($finalPrice, 2);
    }

    private function validatePrice(float $price): void
    {
        if ($price < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }
    }

    private function validateDiscount(float $discountPercent): void
    {
        if ($discountPercent < 0 || $discountPercent > 100) {
            throw new \InvalidArgumentException('Discount must be between 0 and 100');
        }
    }

    private function calculateDiscountAmount(float $price, float $discountPercent): float
    {
        return $price * $discountPercent / 100;
    }
}

// ✅ PASS - Все тесты проходят, код стал лучше
```
</details>

### Задание 2: Shopping Cart с TDD

Создай `ShoppingCart` используя TDD. Функции: `addItem()`, `removeItem()`, `getTotal()`, `isEmpty()`, `clear()`. Каждый шаг - новый тест.

<details>
<summary>Решение</summary>

```php
// tests/Unit/ShoppingCartTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ShoppingCart;

class ShoppingCartTest extends TestCase
{
    // ШАГ 1: RED
    public function test_new_cart_is_empty(): void
    {
        $cart = new ShoppingCart();

        $this->assertTrue($cart->isEmpty());
    }

    // ШАГ 2: RED
    public function test_can_add_item(): void
    {
        $cart = new ShoppingCart();
        $cart->addItem('Apple', 1.50, 3);

        $this->assertFalse($cart->isEmpty());
    }

    // ШАГ 3: RED
    public function test_calculates_total(): void
    {
        $cart = new ShoppingCart();
        $cart->addItem('Apple', 1.50, 3);  // 4.50
        $cart->addItem('Banana', 2.00, 2);  // 4.00

        $this->assertEquals(8.50, $cart->getTotal());
    }

    // ШАГ 4: RED
    public function test_can_remove_item(): void
    {
        $cart = new ShoppingCart();
        $cart->addItem('Apple', 1.50, 3);
        $cart->removeItem('Apple');

        $this->assertTrue($cart->isEmpty());
    }

    // ШАГ 5: RED
    public function test_can_clear_cart(): void
    {
        $cart = new ShoppingCart();
        $cart->addItem('Apple', 1.50, 3);
        $cart->addItem('Banana', 2.00, 2);
        $cart->clear();

        $this->assertTrue($cart->isEmpty());
        $this->assertEquals(0, $cart->getTotal());
    }

    // ШАГ 6: RED
    public function test_throws_exception_for_negative_quantity(): void
    {
        $cart = new ShoppingCart();

        $this->expectException(\InvalidArgumentException::class);
        $cart->addItem('Apple', 1.50, -1);
    }
}

// Реализация после всех тестов
// app/Services/ShoppingCart.php
namespace App\Services;

class ShoppingCart
{
    private array $items = [];

    public function addItem(string $name, float $price, int $quantity): void
    {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Quantity must be positive');
        }

        if ($price < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        $this->items[$name] = [
            'price' => $price,
            'quantity' => $quantity,
        ];
    }

    public function removeItem(string $name): void
    {
        unset($this->items[$name]);
    }

    public function getTotal(): float
    {
        $total = 0;

        foreach ($this->items as $item) {
            $total += $item['price'] * $item['quantity'];
        }

        return round($total, 2);
    }

    public function isEmpty(): bool
    {
        return empty($this->items);
    }

    public function clear(): void
    {
        $this->items = [];
    }

    public function getItems(): array
    {
        return $this->items;
    }
}
```
</details>

### Задание 3: Password Validator с TDD

Создай `PasswordValidator` с TDD. Требования: минимум 8 символов, хотя бы одна заглавная, одна строчная, одна цифра. Пиши тесты постепенно.

<details>
<summary>Решение</summary>

```php
// tests/Unit/PasswordValidatorTest.php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\PasswordValidator;

class PasswordValidatorTest extends TestCase
{
    private PasswordValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new PasswordValidator();
    }

    // ШАГ 1: RED - Минимальная длина
    public function test_rejects_password_shorter_than_8_chars(): void
    {
        $result = $this->validator->validate('Short1');

        $this->assertFalse($result);
    }

    public function test_accepts_password_with_8_chars(): void
    {
        $result = $this->validator->validate('Password1');

        $this->assertTrue($result);
    }

    // ШАГ 2: RED - Заглавные буквы
    public function test_rejects_password_without_uppercase(): void
    {
        $result = $this->validator->validate('password1');

        $this->assertFalse($result);
    }

    // ШАГ 3: RED - Строчные буквы
    public function test_rejects_password_without_lowercase(): void
    {
        $result = $this->validator->validate('PASSWORD1');

        $this->assertFalse($result);
    }

    // ШАГ 4: RED - Цифры
    public function test_rejects_password_without_digit(): void
    {
        $result = $this->validator->validate('Password');

        $this->assertFalse($result);
    }

    // ШАГ 5: Комплексные тесты
    public function test_accepts_valid_passwords(): void
    {
        $validPasswords = [
            'Password1',
            'MyPass123',
            'SecureP@ss1',
            'Abcd1234',
        ];

        foreach ($validPasswords as $password) {
            $this->assertTrue(
                $this->validator->validate($password),
                "Failed for password: {$password}"
            );
        }
    }

    public function test_returns_validation_errors(): void
    {
        $errors = $this->validator->getErrors('short');

        $this->assertContains('Password must be at least 8 characters', $errors);
        $this->assertContains('Password must contain at least one uppercase letter', $errors);
        $this->assertContains('Password must contain at least one digit', $errors);
    }
}

// Финальная реализация
// app/Services/PasswordValidator.php
namespace App\Services;

class PasswordValidator
{
    private array $errors = [];

    public function validate(string $password): bool
    {
        $this->errors = [];

        if (strlen($password) < 8) {
            $this->errors[] = 'Password must be at least 8 characters';
        }

        if (!preg_match('/[A-Z]/', $password)) {
            $this->errors[] = 'Password must contain at least one uppercase letter';
        }

        if (!preg_match('/[a-z]/', $password)) {
            $this->errors[] = 'Password must contain at least one lowercase letter';
        }

        if (!preg_match('/[0-9]/', $password)) {
            $this->errors[] = 'Password must contain at least one digit';
        }

        return empty($this->errors);
    }

    public function getErrors(string $password): array
    {
        $this->validate($password);
        return $this->errors;
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
