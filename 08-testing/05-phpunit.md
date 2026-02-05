# 7.5 PHPUnit

## Краткое резюме

> **PHPUnit** — стандартный testing framework для PHP. Laravel использует PHPUnit с обёрткой TestCase.
>
> **Запуск:** `php artisan test`, `--filter`, `--testsuite=Unit`, `--parallel`. Assertions: `assertEquals()`, `assertTrue()`, `expectException()`.
>
> **Важно:** Data providers для параметризации. `setUp()`/`tearDown()` для подготовки. Mock через `createMock()`, `expects()`, `willReturn()`. Annotations: `@test`, `@dataProvider`, `@group`.

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
PHPUnit — стандартный framework для тестирования PHP. Laravel использует PHPUnit по умолчанию.

**Основное:**
- `php artisan test` — запуск тестов
- Assertions — проверки
- Data Providers — параметризованные тесты
- setUp/tearDown — подготовка/очистка

---

## Как работает

**Структура теста:**

```php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ExampleTest extends TestCase
{
    // Выполняется перед каждым тестом
    protected function setUp(): void
    {
        parent::setUp();
        // Подготовка
    }

    // Выполняется после каждого теста
    protected function tearDown(): void
    {
        // Очистка
        parent::tearDown();
    }

    // Тест (должен начинаться с test_ или иметь @test)
    public function test_example(): void
    {
        $this->assertTrue(true);
    }

    /**
     * @test
     */
    public function it_works(): void
    {
        $this->assertTrue(true);
    }
}
```

**Запуск тестов:**

```bash
# Все тесты
php artisan test

# Конкретный файл
php artisan test tests/Unit/ExampleTest.php

# Конкретный метод
php artisan test --filter test_example

# Testsuite
php artisan test --testsuite=Unit
php artisan test --testsuite=Feature

# Parallel (быстрее)
php artisan test --parallel

# Coverage
php artisan test --coverage
php artisan test --coverage-html coverage/

# С выводом
php artisan test --verbose
```

**Основные Assertions:**

```php
// Равенство
$this->assertEquals(expected, actual);
$this->assertSame(expected, actual);  // ===
$this->assertNotEquals(expected, actual);

// Boolean
$this->assertTrue($value);
$this->assertFalse($value);

// Null
$this->assertNull($value);
$this->assertNotNull($value);

// Empty
$this->assertEmpty($array);
$this->assertNotEmpty($array);

// Arrays/Strings
$this->assertContains('item', $array);
$this->assertCount(3, $array);
$this->assertArrayHasKey('key', $array);
$this->assertStringContainsString('hello', 'hello world');

// Numeric
$this->assertGreaterThan(5, 10);
$this->assertLessThan(10, 5);
$this->assertEqualsWithDelta(1.0, 1.1, 0.2);  // ±0.2

// Instance/Type
$this->assertInstanceOf(User::class, $user);
$this->assertIsArray($value);
$this->assertIsString($value);
$this->assertIsInt($value);

// Exceptions
$this->expectException(InvalidArgumentException::class);
$this->expectExceptionMessage('Invalid');
someFunction();

// File
$this->assertFileExists('/path/to/file');
$this->assertFileIsReadable('/path/to/file');
```

---

## Когда использовать

**PHPUnit vs Pest:**
- PHPUnit — стандарт, классы, больше boilerplate
- Pest — современный, функции, меньше кода

**Используй PHPUnit когда:**
- Стандартный подход
- Большая команда (все знают PHPUnit)
- Legacy проект

---

## Пример из практики

**Data Providers:**

```php
class CalculatorTest extends TestCase
{
    /**
     * @dataProvider additionProvider
     */
    public function test_adds_numbers(int $a, int $b, int $expected): void
    {
        $calculator = new Calculator();
        $result = $calculator->add($a, $b);

        $this->assertEquals($expected, $result);
    }

    public static function additionProvider(): array
    {
        return [
            'positive numbers' => [2, 3, 5],
            'negative numbers' => [-2, -3, -5],
            'mixed' => [10, -5, 5],
            'zeros' => [0, 0, 0],
        ];
    }
}
```

**setUp/tearDown:**

```php
class DatabaseTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        parent::setUp();

        // Создать соединение
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->exec('CREATE TABLE users (id INTEGER, name TEXT)');
    }

    protected function tearDown(): void
    {
        // Закрыть соединение
        $this->pdo = null;

        parent::tearDown();
    }

    public function test_inserts_user(): void
    {
        $this->pdo->exec("INSERT INTO users VALUES (1, 'John')");
        $result = $this->pdo->query("SELECT * FROM users")->fetch();

        $this->assertEquals('John', $result['name']);
    }
}
```

**Test Doubles (Mock, Stub, Spy):**

```php
// Mock
$mock = $this->createMock(PaymentGateway::class);
$mock->expects($this->once())  // Ожидаем 1 вызов
    ->method('charge')
    ->with($this->equalTo(100))
    ->willReturn(true);

// Stub (без проверки вызовов)
$stub = $this->createStub(PaymentGateway::class);
$stub->method('charge')
    ->willReturn(true);

// Partial Mock
$mock = $this->getMockBuilder(PaymentGateway::class)
    ->onlyMethods(['charge'])  // Mock только charge()
    ->getMock();
```

**Annotations:**

```php
class ExampleTest extends TestCase
{
    /**
     * @test
     * @group slow
     * @requires PHP >= 8.1
     * @covers \App\Services\Calculator::add
     */
    public function it_adds_numbers(): void
    {
        // ...
    }

    /**
     * @test
     * @depends test_user_can_be_created
     */
    public function test_user_can_be_updated(User $user): User
    {
        // Получить $user из предыдущего теста
        $user->update(['name' => 'Updated']);
        return $user;
    }

    /**
     * @test
     * @dataProvider invalidEmailProvider
     */
    public function test_validates_email(string $email): void
    {
        $this->assertFalse(filter_var($email, FILTER_VALIDATE_EMAIL));
    }

    public static function invalidEmailProvider(): array
    {
        return [
            ['invalid'],
            ['@example.com'],
            ['user@'],
        ];
    }
}
```

**phpunit.xml конфигурация:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="vendor/autoload.php"
         colors="true"
         stopOnFailure="false">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>

    <coverage>
        <include>
            <directory>app</directory>
        </include>
        <exclude>
            <directory>app/Console</directory>
        </exclude>
    </coverage>

    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
    </php>
</phpunit>
```

---

## На собеседовании скажешь

> "PHPUnit — стандартный testing framework для PHP. Структура: setUp() для подготовки, test методы, tearDown() для очистки. Assertions: assertEquals, assertTrue, assertInstanceOf, expectException. Data providers для параметризованных тестов. Mock через createMock(), expects(), willReturn(). Annotations: @test, @dataProvider, @group. Запуск: php artisan test, --filter, --testsuite, --parallel. Laravel использует PHPUnit с TestCase обёрткой."

---

## Практические задания

### Задание 1: Data Provider с именованными тестами

Создай тест для `StringHelper::slugify()` с Data Provider. Проверь различные входные строки (пробелы, спецсимволы, unicode).

<details>
<summary>Решение</summary>

```php
// app/Helpers/StringHelper.php
namespace App\Helpers;

class StringHelper
{
    public static function slugify(string $text): string
    {
        // Заменить всё кроме букв, цифр и дефисов
        $text = preg_replace('/[^A-Za-z0-9-]+/', '-', $text);

        // Убрать множественные дефисы
        $text = preg_replace('/-+/', '-', $text);

        // Убрать дефисы в начале и конце
        $text = trim($text, '-');

        return strtolower($text);
    }

    public static function truncate(string $text, int $length, string $suffix = '...'): string
    {
        if (strlen($text) <= $length) {
            return $text;
        }

        return substr($text, 0, $length) . $suffix;
    }
}

// tests/Unit/StringHelperTest.php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Helpers\StringHelper;

class StringHelperTest extends TestCase
{
    /**
     * @test
     * @dataProvider slugifyProvider
     */
    public function it_converts_string_to_slug(string $input, string $expected): void
    {
        $result = StringHelper::slugify($input);

        $this->assertEquals($expected, $result);
    }

    public static function slugifyProvider(): array
    {
        return [
            'простой текст' => ['Hello World', 'hello-world'],
            'с пробелами' => ['  Multiple   Spaces  ', 'multiple-spaces'],
            'спецсимволы' => ['Hello @ World!', 'hello-world'],
            'дефисы' => ['Already-Has-Dashes', 'already-has-dashes'],
            'смешанный регистр' => ['MiXeD CaSe', 'mixed-case'],
            'только спецсимволы' => ['@#$%^&*()', ''],
            'числа' => ['Test 123', 'test-123'],
            'множественные дефисы' => ['Too---Many---Dashes', 'too-many-dashes'],
        ];
    }

    /**
     * @test
     * @dataProvider truncateProvider
     */
    public function it_truncates_string(
        string $text,
        int $length,
        string $suffix,
        string $expected
    ): void {
        $result = StringHelper::truncate($text, $length, $suffix);

        $this->assertEquals($expected, $result);
    }

    public static function truncateProvider(): array
    {
        return [
            'короткий текст' => ['Hello', 10, '...', 'Hello'],
            'длинный текст' => ['Hello World', 5, '...', 'Hello...'],
            'точный размер' => ['Hello', 5, '...', 'Hello'],
            'кастомный суффикс' => ['Long text here', 8, '…', 'Long tex…'],
            'без суффикса' => ['Very long text', 8, '', 'Very lon'],
        ];
    }
}
```
</details>

### Задание 2: setUp и tearDown для Database тестов

Создай тест для работы с temporary SQLite database. Используй setUp для создания схемы, tearDown для очистки.

<details>
<summary>Решение</summary>

```php
// tests/Unit/DatabaseRepositoryTest.php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use PDO;

class UserRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(string $name, string $email): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (name, email) VALUES (?, ?)'
        );
        $stmt->execute([$name, $email]);

        return (int) $this->pdo->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function all(): array
    {
        $stmt = $this->pdo->query('SELECT * FROM users ORDER BY id');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
        return $stmt->execute([$id]);
    }
}

class DatabaseRepositoryTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        // Создать in-memory SQLite database
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Создать таблицу
        $this->pdo->exec('
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');

        $this->repository = new UserRepository($this->pdo);
    }

    protected function tearDown(): void
    {
        // Закрыть соединение
        $this->pdo = null;
        $this->repository = null;

        parent::tearDown();
    }

    public function test_creates_user(): void
    {
        $id = $this->repository->create('John Doe', 'john@example.com');

        $this->assertGreaterThan(0, $id);

        $user = $this->repository->find($id);
        $this->assertEquals('John Doe', $user['name']);
        $this->assertEquals('john@example.com', $user['email']);
    }

    public function test_finds_user_by_id(): void
    {
        $id = $this->repository->create('Jane Doe', 'jane@example.com');

        $user = $this->repository->find($id);

        $this->assertIsArray($user);
        $this->assertEquals($id, $user['id']);
        $this->assertEquals('Jane Doe', $user['name']);
    }

    public function test_returns_null_for_nonexistent_user(): void
    {
        $user = $this->repository->find(999);

        $this->assertNull($user);
    }

    public function test_gets_all_users(): void
    {
        $this->repository->create('User 1', 'user1@example.com');
        $this->repository->create('User 2', 'user2@example.com');
        $this->repository->create('User 3', 'user3@example.com');

        $users = $this->repository->all();

        $this->assertCount(3, $users);
        $this->assertEquals('User 1', $users[0]['name']);
        $this->assertEquals('User 3', $users[2]['name']);
    }

    public function test_deletes_user(): void
    {
        $id = $this->repository->create('To Delete', 'delete@example.com');

        $result = $this->repository->delete($id);

        $this->assertTrue($result);
        $this->assertNull($this->repository->find($id));
    }
}
```
</details>

### Задание 3: Annotations и Groups

Создай набор тестов с разными группами (@group slow, @group api, @group unit). Добавь @depends для зависимых тестов.

<details>
<summary>Решение</summary>

```php
// tests/Feature/UserManagementTest.php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @test
     * @group unit
     * @group fast
     */
    public function user_factory_creates_valid_user(): void
    {
        $user = User::factory()->make();

        $this->assertInstanceOf(User::class, $user);
        $this->assertNotEmpty($user->name);
        $this->assertNotEmpty($user->email);
    }

    /**
     * @test
     * @group api
     * @group integration
     */
    public function api_returns_users_list(): void
    {
        User::factory()->count(5)->create();

        $response = $this->getJson('/api/users');

        $response->assertStatus(200);
        $response->assertJsonCount(5, 'data');
    }

    /**
     * @test
     * @group api
     * @group slow
     * Этот тест медленный из-за пагинации большого dataset
     */
    public function api_paginates_large_user_list(): void
    {
        User::factory()->count(100)->create();

        $response = $this->getJson('/api/users?page=1&per_page=10');

        $response->assertStatus(200);
        $response->assertJsonCount(10, 'data');
        $response->assertJsonPath('meta.total', 100);
    }

    /**
     * @test
     * @group api
     * @group authentication
     */
    public function authenticated_user_can_create_post(): User
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/posts', [
            'title' => 'Test Post',
            'content' => 'Content',
        ]);

        $response->assertStatus(201);

        return $user;  // Вернуть для зависимого теста
    }

    /**
     * @test
     * @group api
     * @depends authenticated_user_can_create_post
     */
    public function user_can_see_own_posts(User $user): void
    {
        $response = $this->actingAs($user)->getJson('/api/my-posts');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
    }

    /**
     * @test
     * @group validation
     * @dataProvider invalidUserDataProvider
     */
    public function validates_user_creation(array $data, array $expectedErrors): void
    {
        $response = $this->postJson('/api/users', $data);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors($expectedErrors);
    }

    public static function invalidUserDataProvider(): array
    {
        return [
            'empty name' => [
                ['name' => '', 'email' => 'test@example.com'],
                ['name'],
            ],
            'invalid email' => [
                ['name' => 'John', 'email' => 'not-an-email'],
                ['email'],
            ],
            'missing fields' => [
                [],
                ['name', 'email'],
            ],
        ];
    }

    /**
     * @test
     * @group security
     * @group slow
     */
    public function prevents_sql_injection(): void
    {
        $maliciousInput = "'; DROP TABLE users; --";

        $response = $this->postJson('/api/users/search', [
            'query' => $maliciousInput,
        ]);

        // Должен вернуть пустой результат, а не ошибку
        $response->assertStatus(200);
        $response->assertJsonCount(0, 'data');

        // Проверить, что таблица существует
        $this->assertDatabaseCount('users', 0);
    }
}

// Запуск конкретных групп:
// php artisan test --group=fast
// php artisan test --group=api
// php artisan test --exclude-group=slow
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
