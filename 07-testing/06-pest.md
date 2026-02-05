# 7.6 Pest

## Краткое резюме

> **Pest** — современный testing framework поверх PHPUnit. Функциональный стиль без классов, элегантный синтаксис.
>
> **Синтаксис:** `it()` для тестов, `expect()->toBe()` вместо assertions. Datasets вместо Data Providers. `beforeEach()`/`afterEach()` для setup.
>
> **Важно:** Higher Order Tests для коротких проверок. Архитектурные тесты для зависимостей. Parallel execution из коробки. Меньше boilerplate, лучше читаемость.

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
Pest — современный testing framework для PHP с элегантным синтаксисом. Построен поверх PHPUnit.

**Основное:**
- Функциональный стиль (без классов)
- Меньше boilerplate
- Лучшая читаемость

---

## Как работает

**Установка:**

```bash
composer require pestphp/pest --dev --with-all-dependencies
php artisan pest:install
```

**Базовый тест:**

```php
// PHPUnit
class ExampleTest extends TestCase
{
    public function test_example(): void
    {
        $result = 2 + 2;
        $this->assertEquals(4, $result);
    }
}

// Pest (короче)
test('example', function () {
    $result = 2 + 2;
    expect($result)->toBe(4);
});
```

**Expectations (аналог assertions):**

```php
// Равенство
expect($value)->toBe(5);  // ===
expect($value)->toEqual(5);  // ==
expect($value)->not->toBe(3);

// Boolean
expect($value)->toBeTrue();
expect($value)->toBeFalse();

// Null
expect($value)->toBeNull();
expect($value)->not->toBeNull();

// Arrays
expect($array)->toHaveCount(3);
expect($array)->toContain('item');
expect($array)->toHaveKey('name');

// Strings
expect($string)->toContain('hello');
expect($string)->toStartWith('Hello');
expect($string)->toEndWith('world');

// Instance
expect($user)->toBeInstanceOf(User::class);

// Exceptions
expect(fn() => throw new Exception())->toThrow(Exception::class);
```

---

## Когда использовать

**Pest vs PHPUnit:**

| PHPUnit | Pest |
|---------|------|
| Классы | Функции |
| Больше кода | Меньше кода |
| Стандарт | Современный |
| $this->assert | expect()->to |

**Используй Pest когда:**
- Новый проект
- Хочешь чище синтаксис
- Команда согласна

---

## Пример из практики

**Feature тесты:**

```php
// tests/Feature/PostTest.php
use App\Models\{User, Post};

it('shows post list', function () {
    Post::factory()->count(5)->create();

    $response = $this->get('/posts');

    $response->assertStatus(200);
    $response->assertViewIs('posts.index');
});

it('creates post', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/posts', [
        'title' => 'Test Post',
        'body' => 'Content',
    ]);

    $response->assertStatus(302);
    expect(Post::count())->toBe(1);
});

it('validates required fields', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/posts', []);

    $response->assertSessionHasErrors(['title', 'body']);
});
```

**Datasets (аналог Data Providers):**

```php
it('adds numbers', function (int $a, int $b, int $expected) {
    $calculator = new Calculator();
    $result = $calculator->add($a, $b);

    expect($result)->toBe($expected);
})->with([
    [2, 3, 5],
    [10, 5, 15],
    [-5, 5, 0],
]);

// Именованные datasets
dataset('users', [
    'admin' => [User::factory()->admin()->create()],
    'regular' => [User::factory()->create()],
]);

it('can view dashboard', function (User $user) {
    $response = $this->actingAs($user)->get('/dashboard');
    $response->assertStatus(200);
})->with('users');
```

**Hooks (setup/teardown):**

```php
// Перед каждым тестом
beforeEach(function () {
    $this->user = User::factory()->create();
});

// После каждого теста
afterEach(function () {
    // Cleanup
});

// Один раз перед всеми тестами
beforeAll(function () {
    // Setup
});

// Один раз после всех тестов
afterAll(function () {
    // Cleanup
});

// Использование
it('can login', function () {
    $response = $this->actingAs($this->user)->get('/profile');
    $response->assertStatus(200);
});
```

**Higher Order Tests:**

```php
// Архивация
it('archives post')
    ->actingAs(User::factory()->create())
    ->post('/posts/1/archive')
    ->assertStatus(200);

// JSON API
it('returns user')
    ->getJson('/api/users/1')
    ->assertStatus(200)
    ->assertJson(['id' => 1]);
```

**Custom Expectations:**

```php
// Создать кастомный expect
expect()->extend('toBeWithinRange', function (int $min, int $max) {
    return $this->toBeGreaterThanOrEqual($min)
        ->toBeLessThanOrEqual($max);
});

// Использование
test('age is valid', function () {
    $user = User::factory()->create(['age' => 25]);
    expect($user->age)->toBeWithinRange(18, 65);
});
```

**Группы:**

```php
// Пометить группой
it('slow test')->group('slow');

it('api test')->group('api', 'slow');

// Запустить группу
pest --group=api

// Исключить группу
pest --exclude-group=slow
```

**Параллельное выполнение:**

```bash
# Быстрее на мультиядерных системах
pest --parallel

# Указать количество процессов
pest --parallel --processes=4
```

**Pest.php (глобальная конфигурация):**

```php
// tests/Pest.php
uses(TestCase::class)->in('Feature');
uses(TestCase::class)->in('Unit');

// Глобальные хуки
beforeEach(function () {
    // Выполнится перед каждым тестом
});

// Кастомные функции
function createUser(array $attributes = []): User
{
    return User::factory()->create($attributes);
}

// Использование в тестах
it('creates user', function () {
    $user = createUser(['name' => 'John']);
    expect($user->name)->toBe('John');
});
```

**Plugins:**

```bash
# Laravel plugin (включён по умолчанию)
composer require pestphp/pest-plugin-laravel --dev

# Faker plugin
composer require pestphp/pest-plugin-faker --dev

# Livewire plugin
composer require pestphp/pest-plugin-livewire --dev
```

**Snapshots (тестирование вывода):**

```php
it('generates correct output', function () {
    $output = view('emails.welcome', ['name' => 'John'])->render();

    expect($output)->toMatchSnapshot();
});

// При первом запуске создаст snapshot
// При следующих запусках будет сравнивать
```

**Архитектурные тесты:**

```php
// Проверить зависимости
arch('controllers')
    ->expect('App\Http\Controllers')
    ->toOnlyUse([
        'App\Http\Requests',
        'App\Http\Resources',
        'App\Services',
    ]);

// Проверить naming
arch('models')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model')
    ->toHaveSuffix('Model');

// Проверить не использование
arch('services')
    ->expect('App\Services')
    ->not->toUse('Illuminate\Support\Facades');
```

---

## На собеседовании скажешь

> "Pest — современный testing framework поверх PHPUnit. Функциональный стиль без классов. expect()->toBe() вместо $this->assertEquals(). it() для тестов, beforeEach()/afterEach() для setup. Datasets вместо Data Providers. Higher Order Tests для коротких проверок. Архитектурные тесты для проверки зависимостей. Parallel execution из коробки. Plugins для Laravel, Livewire, Faker. Меньше boilerplate, лучше читаемость."

---

## Практические задания

### Задание 1: Конвертация PHPUnit теста в Pest

Конвертируй PHPUnit тест для `Calculator` в Pest синтаксис. Используй datasets для параметризации.

<details>
<summary>Решение</summary>

```php
// PHPUnit версия (старый стиль)
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

    public function test_adds_numbers(): void
    {
        $result = $this->calculator->add(5, 3);
        $this->assertEquals(8, $result);
    }

    /**
     * @dataProvider numbersProvider
     */
    public function test_multiplies_numbers(int $a, int $b, int $expected): void
    {
        $result = $this->calculator->multiply($a, $b);
        $this->assertEquals($expected, $result);
    }

    public static function numbersProvider(): array
    {
        return [
            [2, 3, 6],
            [5, 4, 20],
            [0, 10, 0],
        ];
    }
}

// Pest версия (новый стиль)
// tests/Unit/CalculatorPestTest.php
use App\Services\Calculator;

beforeEach(function () {
    $this->calculator = new Calculator();
});

it('adds numbers', function () {
    $result = $this->calculator->add(5, 3);

    expect($result)->toBe(8);
});

it('subtracts numbers', function () {
    $result = $this->calculator->subtract(10, 4);

    expect($result)->toBe(6);
});

it('multiplies numbers', function (int $a, int $b, int $expected) {
    $result = $this->calculator->multiply($a, $b);

    expect($result)->toBe($expected);
})->with([
    [2, 3, 6],
    [5, 4, 20],
    [0, 10, 0],
    [7, 7, 49],
]);

it('divides numbers', function () {
    $result = $this->calculator->divide(20, 4);

    expect($result)->toBe(5.0);
});

it('throws exception on division by zero', function () {
    $this->calculator->divide(10, 0);
})->throws(DivisionByZeroError::class);

// Именованные datasets
dataset('math operations', [
    'positive numbers' => [10, 5, 50],
    'negative numbers' => [-3, -2, 6],
    'mixed signs' => [-4, 5, -20],
    'with zero' => [0, 100, 0],
]);

it('handles various multiplication scenarios', function ($a, $b, $expected) {
    expect($this->calculator->multiply($a, $b))->toBe($expected);
})->with('math operations');

// Цепочка expectations
it('performs complex calculation', function () {
    $result = $this->calculator->add(10, 5);

    expect($result)
        ->toBe(15)
        ->toBeGreaterThan(10)
        ->toBeLessThan(20)
        ->toBeNumeric();
});
```
</details>

### Задание 2: Higher Order Tests для API

Создай набор API тестов используя Higher Order Tests и expectations цепочки.

<details>
<summary>Решение</summary>

```php
// tests/Feature/Api/PostApiTest.php
use App\Models\{User, Post};

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

// Higher Order Test (короткий синтаксис)
it('shows posts list')
    ->get('/api/posts')
    ->assertStatus(200)
    ->assertJsonStructure([
        'data' => [
            '*' => ['id', 'title', 'content', 'author'],
        ],
    ]);

// Обычный тест с expectations
it('creates post', function () {
    $response = $this->postJson('/api/posts', [
        'title' => 'Test Post',
        'content' => 'Test content',
    ]);

    $response->assertStatus(201);

    expect(Post::count())->toBe(1);

    $post = Post::first();
    expect($post)
        ->title->toBe('Test Post')
        ->content->toBe('Test content')
        ->user_id->toBe($this->user->id);
});

// Dataset для валидации
it('validates required fields', function ($field, $value) {
    $data = [
        'title' => 'Valid Title',
        'content' => 'Valid content',
    ];

    $data[$field] = $value;

    $response = $this->postJson('/api/posts', $data);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors([$field]);
})->with([
    ['title', ''],
    ['title', null],
    ['content', ''],
    ['content', null],
]);

// Группировка тестов
describe('Post filtering', function () {
    beforeEach(function () {
        Post::factory()->count(3)->create(['published' => true]);
        Post::factory()->count(2)->create(['published' => false]);
    });

    it('filters published posts', function () {
        $response = $this->getJson('/api/posts?status=published');

        $response->assertStatus(200);
        expect($response->json('data'))->toHaveCount(3);
    });

    it('filters draft posts', function () {
        $response = $this->getJson('/api/posts?status=draft');

        $response->assertStatus(200);
        expect($response->json('data'))->toHaveCount(2);
    });

    it('shows all posts without filter', function () {
        $response = $this->getJson('/api/posts');

        $response->assertStatus(200);
        expect($response->json('data'))->toHaveCount(5);
    });
});

// Custom expectations
expect()->extend('toBeValidPost', function () {
    return $this
        ->toHaveKey('id')
        ->toHaveKey('title')
        ->toHaveKey('content')
        ->toHaveKey('author');
});

it('returns valid post structure', function () {
    $post = Post::factory()->create();

    $response = $this->getJson("/api/posts/{$post->id}");

    expect($response->json('data'))->toBeValidPost();
});

// Тесты с tags (группы)
it('handles pagination', function () {
    Post::factory()->count(30)->create();

    $response = $this->getJson('/api/posts?page=2&per_page=10');

    expect($response->json())
        ->toHaveKey('data')
        ->and($response->json('data'))->toHaveCount(10)
        ->and($response->json('meta.current_page'))->toBe(2)
        ->and($response->json('meta.total'))->toBe(30);
})->group('pagination', 'slow');

it('searches posts by title', function () {
    Post::factory()->create(['title' => 'Laravel Testing']);
    Post::factory()->create(['title' => 'PHP Best Practices']);

    $response = $this->getJson('/api/posts?search=Laravel');

    expect($response->json('data'))
        ->toHaveCount(1)
        ->and($response->json('data.0.title'))->toContain('Laravel');
})->group('search');
```
</details>

### Задание 3: Архитектурные тесты

Создай архитектурные тесты для проверки структуры проекта (зависимости, naming conventions).

<details>
<summary>Решение</summary>

```php
// tests/Architecture/ControllersTest.php

// Все контроллеры должны быть в namespace App\Http\Controllers
arch('controllers are in correct namespace')
    ->expect('App\Http\Controllers')
    ->toBeClasses()
    ->toHaveSuffix('Controller');

// Контроллеры могут использовать только определённые классы
arch('controllers follow dependency rules')
    ->expect('App\Http\Controllers')
    ->toOnlyUse([
        'Illuminate\Http',
        'Illuminate\Routing',
        'App\Http\Requests',
        'App\Http\Resources',
        'App\Services',
        'App\Models',
    ]);

// Контроллеры НЕ должны использовать DB напрямую
arch('controllers do not use DB directly')
    ->expect('App\Http\Controllers')
    ->not->toUse([
        'Illuminate\Support\Facades\DB',
        'Illuminate\Database\Query\Builder',
    ]);

// tests/Architecture/ModelsTest.php

// Все модели должны расширять Eloquent Model
arch('models extend eloquent')
    ->expect('App\Models')
    ->toExtend('Illuminate\Database\Eloquent\Model');

// Модели могут использовать traits
arch('models can use specific traits')
    ->expect('App\Models')
    ->toOnlyUse([
        'Illuminate\Database\Eloquent',
        'Illuminate\Database\Eloquent\Factories',
        'Illuminate\Notifications',
    ]);

// tests/Architecture/ServicesTest.php

// Сервисы должны быть в правильном namespace
arch('services are in correct namespace')
    ->expect('App\Services')
    ->toBeClasses()
    ->toHaveSuffix('Service');

// Сервисы НЕ должны использовать Request напрямую
arch('services do not use HTTP layer')
    ->expect('App\Services')
    ->not->toUse([
        'Illuminate\Http\Request',
        'Illuminate\Routing',
    ]);

// tests/Architecture/GeneralTest.php

// Никакие классы не должны использовать dd() или dump() в production
arch('no debugging functions in production code')
    ->expect(['dd', 'dump', 'var_dump', 'print_r'])
    ->not->toBeUsed();

// Глобальные хелперы Laravel разрешены
arch('can use laravel helpers')
    ->expect('App')
    ->toUse([
        'config',
        'cache',
        'route',
        'view',
    ]);

// tests/Architecture/NamingTest.php

// Request классы должны иметь суффикс Request
arch('request classes have Request suffix')
    ->expect('App\Http\Requests')
    ->toHaveSuffix('Request');

// Resource классы должны иметь суффикс Resource
arch('resource classes have Resource suffix')
    ->expect('App\Http\Resources')
    ->toHaveSuffix('Resource');

// Job классы должны иметь суффикс Job
arch('job classes have Job suffix')
    ->expect('App\Jobs')
    ->toHaveSuffix('Job')
    ->toImplement('Illuminate\Contracts\Queue\ShouldQueue');

// Event классы в правильном namespace
arch('events are in correct namespace')
    ->expect('App\Events')
    ->toBeClasses()
    ->not->toBeAbstract();

// Listener классы обрабатывают события
arch('listeners have handle method')
    ->expect('App\Listeners')
    ->toHaveMethod('handle');

// tests/Architecture/LayersTest.php

// Модели не должны знать о HTTP слое
arch('models are independent of HTTP')
    ->expect('App\Models')
    ->not->toUse([
        'App\Http\Controllers',
        'App\Http\Requests',
        'App\Http\Resources',
    ]);

// Запуск архитектурных тестов:
// pest --filter=Architecture
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
