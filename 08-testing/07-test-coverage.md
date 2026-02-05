# 7.7 Test Coverage

## Краткое резюме

> **Test Coverage** — процент кода, покрытого тестами. Метрики: line, function, class, branch coverage.
>
> **Запуск:** `php artisan test --coverage`. Требует Xdebug или PCOV. HTML отчёт: `--coverage-html coverage/`.
>
> **Важно:** Целевые значения: критичная логика 90%+, общий проект 70-80%. 100% coverage НЕ гарантирует отсутствие багов. Mutation testing (Infection) проверяет качество тестов.

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
Test Coverage — процент кода, покрытого тестами. Показывает, какие строки/функции/классы протестированы.

**Метрики:**
- Line Coverage — покрытие строк
- Function Coverage — покрытие функций
- Class Coverage — покрытие классов
- Branch Coverage — покрытие веток (if/else)

---

## Как работает

**Включить Xdebug:**

```bash
# macOS (Homebrew)
pecl install xdebug

# Ubuntu
apt-get install php-xdebug

# Проверить
php -v | grep Xdebug
```

**Запустить coverage:**

```bash
# PHPUnit
php artisan test --coverage

# HTML отчёт
php artisan test --coverage-html coverage/

# Минимальный порог
php artisan test --min=80  # Минимум 80%

# Pest
pest --coverage
pest --coverage --min=80
```

**Пример отчёта:**

```
Tests:  10 passed
Coverage:
  App\Services\Calculator ..... 100%
  App\Services\Payment ........ 75%
  App\Http\Controllers\User ... 60%
  Total ........................ 78%
```

---

## Когда использовать

**Плюсы высокого coverage:**
- ✅ Меньше багов
- ✅ Уверенность при рефакторинге
- ✅ Документация

**Минусы погони за 100%:**
- ❌ Медленная разработка
- ❌ Тесты ради тестов
- ❌ Ложное чувство безопасности

**Целевые значения:**
- Критичные модули: 90%+
- Бизнес-логика: 80%+
- Контроллеры: 70%+
- Общий проект: 70-80%

---

## Пример из практики

**Анализ coverage:**

```php
// Класс с 50% coverage
class PaymentService
{
    public function charge(User $user, float $amount): bool
    {
        if ($user->balance < $amount) {
            throw new InsufficientFundsException();  // ❌ Не покрыт
        }

        $user->decrement('balance', $amount);  // ✅ Покрыт
        return true;  // ✅ Покрыт
    }
}

// Единственный тест (успешный случай)
public function test_charges_user(): void
{
    $user = User::factory()->create(['balance' => 1000]);
    $service = new PaymentService();

    $result = $service->charge($user, 100);

    $this->assertTrue($result);
    $this->assertEquals(900, $user->fresh()->balance);
}

// Добавить тест для недостаточного баланса → 100% coverage
public function test_throws_exception_for_insufficient_balance(): void
{
    $user = User::factory()->create(['balance' => 50]);
    $service = new PaymentService();

    $this->expectException(InsufficientFundsException::class);
    $service->charge($user, 100);
}
```

**phpunit.xml конфигурация:**

```xml
<coverage processUncoveredFiles="true">
    <include>
        <directory suffix=".php">app</directory>
    </include>
    <exclude>
        <directory>app/Console</directory>
        <file>app/Http/Kernel.php</file>
    </exclude>
    <report>
        <html outputDirectory="coverage"/>
        <text outputFile="php://stdout" showUncoveredFiles="false"/>
    </report>
</coverage>
```

**CI/CD с coverage:**

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install dependencies
        run: composer install

      - name: Run tests with coverage
        run: php artisan test --coverage --min=80

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage.xml
```

**Игнорирование кода:**

```php
class Logger
{
    public function log(string $message): void
    {
        // @codeCoverageIgnoreStart
        if (app()->environment('testing')) {
            return;  // Не считать в coverage
        }
        // @codeCoverageIgnoreEnd

        file_put_contents('log.txt', $message);
    }
}
```

**Mutation Testing (продвинутый уровень):**

```bash
# Установить Infection
composer require --dev infection/infection

# Запустить
vendor/bin/infection

# Infection изменяет код (мутации) и проверяет, ловят ли тесты ошибки
# Если тесты проходят с мутацией → тест плохой
```

**Пример мутации:**

```php
// Оригинальный код
if ($user->balance >= $amount) {
    // ...
}

// Мутация 1: >= → >
if ($user->balance > $amount) {  // Изменено
    // ...
}

// Мутация 2: >= → <=
if ($user->balance <= $amount) {  // Изменено
    // ...
}

// Если тесты не ловят мутацию → тест неполный
```

**Coverage Badge (для README):**

```markdown
# My Project

![Tests](https://github.com/user/repo/workflows/tests/badge.svg)
![Coverage](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)
```

**Что НЕ покрывать тестами:**

```php
// ❌ Не тестировать фреймворк
Route::get('/users', [UserController::class, 'index']);

// ❌ Не тестировать конфиг
config(['app.name' => 'MyApp']);

// ❌ Не тестировать геттеры/сеттеры
class User {
    private string $name;
    public function getName(): string { return $this->name; }
    public function setName(string $name): void { $this->name = $name; }
}

// ✅ Тестировать бизнес-логику
class OrderService {
    public function calculateTotal(array $items): float {
        // Логика вычисления
    }
}
```

**Balance между coverage и pragmatism:**

```php
// 100% coverage НЕ значит нет багов

// Плохой тест (100% coverage, но бесполезный)
public function test_user_has_name(): void
{
    $user = new User();
    $user->name = 'John';

    $this->assertEquals('John', $user->name);  // Очевидно
}

// Хороший тест (проверяет реальное поведение)
public function test_user_cannot_be_created_with_invalid_email(): void
{
    $this->expectException(ValidationException::class);

    User::create([
        'name' => 'John',
        'email' => 'invalid-email',  // Проверяет валидацию
    ]);
}
```

---

## На собеседовании скажешь

> "Test Coverage показывает процент покрытого кода. Включается через Xdebug. Запуск: php artisan test --coverage. Метрики: line, function, class, branch coverage. Целевые значения: критичные модули 90%+, бизнес-логика 80%+, общий 70-80%. 100% coverage не гарантирует отсутствие багов. Mutation testing (Infection) проверяет качество тестов. Не тестировать фреймворк, конфиг, геттеры/сеттеры. CI/CD с минимальным порогом (--min=80)."

---

## Практические задания

### Задание 1: Анализ и улучшение Coverage

Дан класс с 50% coverage. Проанализируй отчёт и напиши недостающие тесты для 100% покрытия.

<details>
<summary>Решение</summary>

```php
// app/Services/OrderCalculator.php
namespace App\Services;

class OrderCalculator
{
    public function calculateTotal(array $items, ?string $couponCode = null): float
    {
        $subtotal = 0;

        foreach ($items as $item) {
            $subtotal += $item['price'] * $item['quantity'];
        }

        // Применить купон (НЕ ПОКРЫТО)
        if ($couponCode) {
            $discount = $this->getDiscount($couponCode);
            $subtotal -= $subtotal * ($discount / 100);
        }

        // Доставка (НЕ ПОКРЫТО)
        $shipping = $this->calculateShipping($subtotal);

        return round($subtotal + $shipping, 2);
    }

    private function getDiscount(string $couponCode): int
    {
        // НЕ ПОКРЫТО
        $coupons = [
            'SAVE10' => 10,
            'SAVE20' => 20,
            'SAVE50' => 50,
        ];

        return $coupons[$couponCode] ?? 0;
    }

    private function calculateShipping(float $subtotal): float
    {
        // НЕ ПОКРЫТО
        if ($subtotal >= 100) {
            return 0;  // Бесплатная доставка
        }

        return 10;  // Фиксированная стоимость
    }
}

// tests/Unit/OrderCalculatorTest.php - НАЧАЛЬНОЕ СОСТОЯНИЕ (50% coverage)
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\OrderCalculator;

class OrderCalculatorTest extends TestCase
{
    private OrderCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new OrderCalculator();
    }

    // ЕДИНСТВЕННЫЙ тест (покрывает только базовый сценарий)
    public function test_calculates_total_without_coupon(): void
    {
        $items = [
            ['price' => 50, 'quantity' => 2],
            ['price' => 30, 'quantity' => 1],
        ];

        $total = $this->calculator->calculateTotal($items);

        // subtotal: 130, shipping: 10 (130 < 100)
        $this->assertEquals(140, $total);
    }
}

// Запустить coverage:
// php artisan test --coverage
// Output:
// OrderCalculator.php ........ 50%
//   - Line 14-16: NOT COVERED (купон)
//   - Line 23-31: NOT COVERED (getDiscount)
//   - Line 33-40: NOT COVERED (calculateShipping для >= 100)

// УЛУЧШЕННАЯ версия (100% coverage)
class OrderCalculatorTest extends TestCase
{
    private OrderCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new OrderCalculator();
    }

    public function test_calculates_total_without_coupon(): void
    {
        $items = [
            ['price' => 50, 'quantity' => 2],
            ['price' => 30, 'quantity' => 1],
        ];

        $total = $this->calculator->calculateTotal($items);

        $this->assertEquals(140, $total);  // 130 + 10 shipping
    }

    // НОВЫЙ: Покрыть купон
    public function test_applies_valid_coupon(): void
    {
        $items = [
            ['price' => 50, 'quantity' => 2],
        ];

        $total = $this->calculator->calculateTotal($items, 'SAVE20');

        // subtotal: 100, discount: 20%, result: 80, shipping: 0
        $this->assertEquals(80, $total);
    }

    // НОВЫЙ: Покрыть невалидный купон
    public function test_ignores_invalid_coupon(): void
    {
        $items = [
            ['price' => 50, 'quantity' => 2],
        ];

        $total = $this->calculator->calculateTotal($items, 'INVALID');

        // subtotal: 100, no discount, shipping: 0
        $this->assertEquals(100, $total);
    }

    // НОВЫЙ: Покрыть бесплатную доставку
    public function test_free_shipping_over_100(): void
    {
        $items = [
            ['price' => 60, 'quantity' => 2],
        ];

        $total = $this->calculator->calculateTotal($items);

        // subtotal: 120, shipping: 0 (>= 100)
        $this->assertEquals(120, $total);
    }

    // НОВЫЙ: Покрыть платную доставку
    public function test_charges_shipping_under_100(): void
    {
        $items = [
            ['price' => 40, 'quantity' => 2],
        ];

        $total = $this->calculator->calculateTotal($items);

        // subtotal: 80, shipping: 10 (< 100)
        $this->assertEquals(90, $total);
    }

    // НОВЫЙ: Комплексный сценарий
    public function test_complex_calculation(): void
    {
        $items = [
            ['price' => 30, 'quantity' => 3],
            ['price' => 20, 'quantity' => 2],
        ];

        $total = $this->calculator->calculateTotal($items, 'SAVE10');

        // subtotal: 130, discount: 13, result: 117, shipping: 0
        $this->assertEquals(117, $total);
    }
}

// Запустить повторно:
// php artisan test --coverage
// Output:
// OrderCalculator.php ........ 100% ✅
```
</details>

### Задание 2: Coverage в CI/CD с минимальным порогом

Настрой GitHub Actions для автоматической проверки coverage с минимальным порогом 80%. При падении ниже - провалить CI.

<details>
<summary>Решение</summary>

```yaml
# .github/workflows/tests.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_DATABASE: testing
          MYSQL_ROOT_PASSWORD: password
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2
          extensions: dom, curl, libxml, mbstring, zip, pcntl, pdo, sqlite, pdo_sqlite, bcmath, soap, intl, gd, exif, iconv
          coverage: xdebug

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-interaction --no-progress

      - name: Copy .env
        run: php -r "file_exists('.env') || copy('.env.example', '.env');"

      - name: Generate application key
        run: php artisan key:generate

      - name: Run migrations
        run: php artisan migrate --force
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: testing
          DB_USERNAME: root
          DB_PASSWORD: password

      - name: Run tests with coverage
        run: php artisan test --coverage --min=80
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: testing
          DB_USERNAME: root
          DB_PASSWORD: password

      - name: Generate coverage report
        if: always()
        run: php artisan test --coverage-html coverage/

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          fail_ci_if_error: true

      - name: Upload coverage artifact
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: coverage/

# phpunit.xml - конфигурация coverage
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>

    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">app/Services</directory>
            <directory suffix=".php">app/Actions</directory>
            <directory suffix=".php">app/Http/Controllers</directory>
        </include>
        <exclude>
            <directory>app/Console</directory>
            <file>app/Http/Kernel.php</file>
            <directory>app/Exceptions</directory>
        </exclude>
        <report>
            <html outputDirectory="coverage"/>
            <xml outputFile="coverage.xml"/>
            <text outputFile="php://stdout" showUncoveredFiles="true"/>
        </report>
    </coverage>

    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="BCRYPT_ROUNDS" value="4"/>
        <env name="CACHE_DRIVER" value="array"/>
        <env name="DB_DATABASE" value="testing"/>
        <env name="MAIL_MAILER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
        <env name="SESSION_DRIVER" value="array"/>
    </php>
</phpunit>

# composer.json - добавить скрипт
{
    "scripts": {
        "test": "php artisan test",
        "test:coverage": "php artisan test --coverage --min=80",
        "test:coverage-html": "php artisan test --coverage-html coverage/",
        "test:unit": "php artisan test --testsuite=Unit",
        "test:feature": "php artisan test --testsuite=Feature"
    }
}

# Теперь можно запускать:
# composer test:coverage
```
</details>

### Задание 3: Mutation Testing с Infection

Установи и настрой Infection для проверки качества тестов. Найди "слабые" тесты, которые не ловят мутации.

<details>
<summary>Решение</summary>

```bash
# Установка Infection
composer require --dev infection/infection

# Инициализация
vendor/bin/infection --configure
```

```json
// infection.json.dist
{
    "$schema": "vendor/infection/infection/resources/schema.json",
    "source": {
        "directories": [
            "app/Services",
            "app/Actions"
        ]
    },
    "logs": {
        "text": "infection.log",
        "html": "infection-report.html"
    },
    "mutators": {
        "@default": true
    },
    "minMsi": 70,
    "minCoveredMsi": 80
}
```

```php
// Пример: ПЛОХОЙ тест (не ловит мутации)
// app/Services/PriceCalculator.php
class PriceCalculator
{
    public function calculateDiscount(float $price, int $percent): float
    {
        return $price - ($price * $percent / 100);  // Оригинальный код
    }
}

// tests/Unit/PriceCalculatorTest.php - ПЛОХОЙ тест
public function test_calculates_discount(): void
{
    $calculator = new PriceCalculator();
    $result = $calculator->calculateDiscount(100, 10);

    // Слабая проверка - пропустит многие мутации
    $this->assertGreaterThan(0, $result);
}

// Infection создаёт мутации:
// Мутация 1: - → +
return $price + ($price * $percent / 100);  // Тест ПРОХОДИТ ❌

// Мутация 2: * → /
return $price - ($price / $percent / 100);  // Тест ПРОХОДИТ ❌

// Мутация 3: / 100 → / 101
return $price - ($price * $percent / 101);  // Тест ПРОХОДИТ ❌

// Отчёт Infection:
// Mutations: 10 total, 7 escaped, 3 killed
// MSI (Mutation Score Indicator): 30%  ❌ ПЛОХО

// ХОРОШИЙ тест (ловит все мутации)
public function test_calculates_discount(): void
{
    $calculator = new PriceCalculator();
    $result = $calculator->calculateDiscount(100, 10);

    // Точная проверка
    $this->assertEquals(90, $result);
}

public function test_calculates_various_discounts(): void
{
    $calculator = new PriceCalculator();

    $this->assertEquals(80, $calculator->calculateDiscount(100, 20));
    $this->assertEquals(50, $calculator->calculateDiscount(100, 50));
    $this->assertEquals(99, $calculator->calculateDiscount(100, 1));
    $this->assertEquals(100, $calculator->calculateDiscount(100, 0));
}

// Теперь Infection:
// Mutations: 10 total, 1 escaped, 9 killed
// MSI: 90%  ✅ ОТЛИЧНО

// Запуск Infection
vendor/bin/infection --threads=4 --min-msi=70

// Добавить в CI/CD
// .github/workflows/mutation-tests.yml
name: Mutation Tests

on:
  pull_request:
    branches: [main]

jobs:
  infection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2
          coverage: xdebug

      - name: Install dependencies
        run: composer install

      - name: Run Infection
        run: vendor/bin/infection --min-msi=70 --min-covered-msi=80 --threads=4

      - name: Upload Infection report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: infection-report
          path: infection-report.html
```

```bash
# Полезные команды Infection
vendor/bin/infection                     # Базовый запуск
vendor/bin/infection --min-msi=80        # С минимальным порогом
vendor/bin/infection --filter=OrderService  # Конкретный класс
vendor/bin/infection --show-mutations    # Показать все мутации
vendor/bin/infection --only-covered      # Только покрытый код
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
