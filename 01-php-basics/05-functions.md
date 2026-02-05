# 1.5 Функции в PHP

> **TL;DR**
> Всегда указывай типы параметров и возврата с declare(strict_types=1). Arrow functions (fn) автоматически захватывают переменные (не нужен use). Генераторы (yield) экономят память для больших выборок. Variadic функции (...$args) принимают переменное количество аргументов. Рекурсия требует базовый случай + ограничение глубины. PHP 8.1 добавил first-class callable (func(...)).

## Содержание

- [Объявление и вызов функций](#объявление-и-вызов-функций)
- [Type Hints (Типизация параметров и возврата)](#type-hints-типизация-параметров-и-возврата)
- [Анонимные функции (Closures)](#анонимные-функции-closures)
- [Arrow Functions (PHP 7.4+)](#arrow-functions-php-74)
- [Variadic Functions (Переменное количество аргументов)](#variadic-functions-переменное-количество-аргументов)
- [Generators (Генераторы)](#generators-генераторы)
- [Рекурсия](#рекурсия)
- [Callable и First-Class Callable (PHP 8.1+)](#callable-и-first-class-callable-php-81)
- [Резюме функций](#резюме-функций)
- [Практические задания](#практические-задания)

---

## Объявление и вызов функций

**Что это:**
Именованный блок кода, который можно вызывать многократно.

**Как работает:**
```php
// Простая функция
function greet(string $name): string
{
    return "Привет, $name!";
}

echo greet('Иван');  // "Привет, Иван!"

// Без return (void)
function log(string $message): void
{
    file_put_contents('log.txt', $message . PHP_EOL, FILE_APPEND);
}

// Значения по умолчанию
function getUsers(int $limit = 10, string $sort = 'created_at'): array
{
    return User::orderBy($sort)->limit($limit)->get()->toArray();
}

getUsers();              // limit=10, sort='created_at'
getUsers(20);            // limit=20, sort='created_at'
getUsers(20, 'name');    // limit=20, sort='name'

// Именованные аргументы (PHP 8.0+)
getUsers(sort: 'name', limit: 5);  // Порядок не важен
```

**Когда использовать:**
Для повторяющегося кода, выделения логики, упрощения чтения.

**Пример из практики:**
```php
// Форматирование цены
function formatPrice(int $cents, string $currency = 'RUB'): string
{
    $rubles = $cents / 100;
    return number_format($rubles, 2, '.', ' ') . " $currency";
}

echo formatPrice(199900);  // "1 999.00 RUB"

// Проверка прав
function canEdit(User $user, Post $post): bool
{
    return $user->isAdmin() || $user->id === $post->author_id;
}

if (canEdit($currentUser, $post)) {
    // Редактирование
}

// В Laravel лучше через Gate/Policy
Gate::define('update', fn(User $user, Post $post) => $user->id === $post->author_id);
```

**На собеседовании скажешь:**
> "Функция — именованный блок кода. PHP 8.0 добавил именованные аргументы. Использую для повторяющейся логики, но в Laravel предпочитаю классы (Services, Actions) вместо глобальных функций."

---

## Type Hints (Типизация параметров и возврата)

**Что это:**
Указание типов параметров и возвращаемого значения.

**Как работает:**
```php
// Скалярные типы (PHP 7.0+)
function add(int $a, int $b): int
{
    return $a + $b;
}

// Nullable типы (PHP 7.1+)
function findUser(?int $id): ?User
{
    return $id ? User::find($id) : null;
}

// Union types (PHP 8.0+)
function process(int|string $value): string
{
    return (string) $value;
}

// Mixed (PHP 8.0+)
function log(mixed $value): void
{
    file_put_contents('log.txt', print_r($value, true));
}

// Intersection types (PHP 8.1+)
function save(Countable&Iterator $collection): void
{
    // $collection должен реализовывать ОБА интерфейса
}

// Never (PHP 8.1+)
function redirect(string $url): never
{
    header("Location: $url");
    exit;
}
```

**Когда использовать:**
**Всегда** указывай типы (с `declare(strict_types=1)`).

**Пример из практики:**
```php
<?php
declare(strict_types=1);

namespace App\Services;

class OrderService
{
    public function __construct(
        private OrderRepository $repository,
        private PaymentGateway $gateway,
    ) {}

    public function create(int $userId, array $items, ?string $promoCode = null): Order
    {
        $amount = $this->calculateTotal($items);

        if ($promoCode !== null) {
            $amount = $this->applyPromoCode($amount, $promoCode);
        }

        $order = $this->repository->create([
            'user_id' => $userId,
            'amount' => $amount,
        ]);

        return $order;
    }

    private function calculateTotal(array $items): int
    {
        return array_reduce($items, fn($sum, $item) => $sum + $item['price'], 0);
    }

    private function applyPromoCode(int $amount, string $code): int
    {
        $discount = PromoCode::where('code', $code)->value('discount');
        return (int) ($amount * (1 - $discount / 100));
    }
}
```

**На собеседовании скажешь:**
> "Type hints указывают типы параметров и возврата. PHP 8.0 добавил union types (int|string), PHP 8.1 — intersection types. Всегда использую строгую типизацию (declare(strict_types=1))."

---

## Анонимные функции (Closures)

**Что это:**
Функции без имени, которые можно присвоить переменной или передать как аргумент.

**Как работает:**
```php
// Анонимная функция
$greet = function(string $name): string {
    return "Привет, $name!";
};

echo $greet('Иван');  // "Привет, Иван!"

// Использование внешних переменных (use)
$prefix = 'Mr. ';

$addPrefix = function(string $name) use ($prefix): string {
    return $prefix . $name;
};

echo $addPrefix('Smith');  // "Mr. Smith"

// По ссылке
$counter = 0;

$increment = function() use (&$counter): void {
    $counter++;
};

$increment();
$increment();
echo $counter;  // 2

// Callback функции
$numbers = [1, 2, 3, 4, 5];

$squared = array_map(function($n) {
    return $n ** 2;
}, $numbers);

var_dump($squared);  // [1, 4, 9, 16, 25]
```

**Когда использовать:**
Для callback'ов (array_map, array_filter, usort), Laravel Collection, события.

**Пример из практики:**
```php
// Laravel Collection
$users = User::all();

$active = $users->filter(function($user) {
    return $user->is_active;
});

$names = $users->map(function($user) {
    return $user->name;
});

// Eager loading с условием
$posts = Post::with(['comments' => function($query) {
    $query->where('approved', true)
          ->orderBy('created_at', 'desc')
          ->limit(5);
}])->get();

// Middleware
Route::get('/admin', function() {
    // ...
})->middleware(function($request, $next) {
    if (!auth()->user()?->isAdmin()) {
        abort(403);
    }
    return $next($request);
});

// Event Listener
Event::listen('user.created', function(User $user) {
    Mail::to($user->email)->send(new WelcomeMail($user));
});
```

**На собеседовании скажешь:**
> "Анонимные функции (closures) — функции без имени. Для доступа к внешним переменным использую use. В Laravel часто применяю в Collection методах (map, filter), Eloquent (with), middleware."

---

## Arrow Functions (PHP 7.4+)

**Что это:**
Короткий синтаксис для простых анонимных функций.

**Как работает:**
```php
// Обычная анонимная функция
$squared = array_map(function($n) {
    return $n ** 2;
}, [1, 2, 3]);

// Arrow function
$squared = array_map(fn($n) => $n ** 2, [1, 2, 3]);

// Автоматический use (без объявления)
$multiplier = 10;

// Обычная (нужно use)
$multiply = function($n) use ($multiplier) {
    return $n * $multiplier;
};

// Arrow function (автоматически захватывает $multiplier)
$multiply = fn($n) => $n * $multiplier;

// ⚠️ Только однострочные выражения
$process = fn($x) => $x * 2 + 1;  // ✅ OK

// Нельзя многострочное
$process = fn($x) => {  // ❌ Syntax error
    $result = $x * 2;
    return $result + 1;
};
```

**Когда использовать:**
Для простых callback'ов (одна строка, одно выражение).

**Пример из практики:**
```php
// Laravel Collection
$users = User::all();

$activeNames = $users
    ->filter(fn($user) => $user->is_active)
    ->map(fn($user) => $user->name)
    ->toArray();

// Сортировка
$sorted = $users->sortBy(fn($user) => $user->created_at);

// groupBy с преобразованием
$grouped = $posts->groupBy(fn($post) => $post->created_at->format('Y-m'));

// usort
usort($items, fn($a, $b) => $a['priority'] <=> $b['priority']);

// Route model binding
Route::get('/posts/{post}', fn(Post $post) => view('posts.show', compact('post')));

// Gate
Gate::define('update', fn(User $user, Post $post) => $user->id === $post->author_id);
```

**На собеседовании скажешь:**
> "Arrow functions (fn) — короткий синтаксис для однострочных функций (PHP 7.4+). Автоматически захватывают переменные из внешней области (не нужен use). Использую в Collection методах, сортировке, Gates."

---

## Variadic Functions (Переменное количество аргументов)

**Что это:**
Функция, принимающая произвольное количество аргументов через `...`.

**Как работает:**
```php
// Variadic параметр
function sum(int ...$numbers): int
{
    return array_sum($numbers);
}

echo sum(1, 2, 3);        // 6
echo sum(1, 2, 3, 4, 5);  // 15

// Первые параметры обычные, последний variadic
function format(string $format, mixed ...$args): string
{
    return sprintf($format, ...$args);
}

echo format('Привет, %s! Тебе %d лет.', 'Иван', 25);

// Распаковка массива в аргументы
$numbers = [1, 2, 3, 4, 5];
echo sum(...$numbers);  // 15

// Типизация variadic параметра
function addUsers(User ...$users): void
{
    foreach ($users as $user) {
        $user->save();
    }
}
```

**Когда использовать:**
Когда количество аргументов неизвестно (логирование, математические функции, builder'ы).

**Пример из практики:**
```php
// Logger
class Logger
{
    public function log(string $level, string $message, mixed ...$context): void
    {
        $formatted = sprintf('[%s] %s %s', $level, $message, json_encode($context));
        file_put_contents('log.txt', $formatted . PHP_EOL, FILE_APPEND);
    }
}

$logger->log('ERROR', 'User not found', ['user_id' => 123, 'ip' => '127.0.0.1']);

// Query builder
class QueryBuilder
{
    public function select(string ...$columns): self
    {
        $this->columns = $columns;
        return $this;
    }
}

$query->select('id', 'name', 'email');

// Event dispatcher
class EventDispatcher
{
    public function fire(string $event, mixed ...$args): void
    {
        foreach ($this->listeners[$event] ?? [] as $listener) {
            $listener(...$args);
        }
    }
}

$dispatcher->fire('user.created', $user, $timestamp);

// Laravel Eloquent with()
Post::with('author', 'category', 'comments')->get();
// Под капотом: with(...$relations)
```

**На собеседовании скажешь:**
> "Variadic функции принимают переменное количество аргументов через ... (PHP 5.6+). Внутри функции это массив. Можно распаковать массив в аргументы: func(...$array). Использую для логирования, builder'ов."

---

## Generators (Генераторы)

**Что это:**
Функция, которая возвращает итератор через `yield` вместо `return`.

**Как работает:**
```php
// Обычная функция (загружает всё в память)
function getNumbersArray(): array
{
    $result = [];
    for ($i = 1; $i <= 1000000; $i++) {
        $result[] = $i;
    }
    return $result;  // Вся память занята
}

// Generator (по одному элементу)
function getNumbersGenerator(): Generator
{
    for ($i = 1; $i <= 1000000; $i++) {
        yield $i;  // Возвращает по одному, память не забита
    }
}

// Использование
foreach (getNumbersGenerator() as $number) {
    echo $number;  // Получаем по одному
}

// yield key => value
function getUsersGenerator(): Generator
{
    $users = User::cursor();  // Построчное чтение из БД

    foreach ($users as $user) {
        yield $user->id => $user->name;
    }
}

foreach (getUsersGenerator() as $id => $name) {
    echo "$id: $name";
}
```

**Когда использовать:**
Для больших выборок из БД, файлов, API (избегаем загрузки всего в память).

**Пример из практики:**
```php
// Построчное чтение большого файла
function readCsv(string $filePath): Generator
{
    $handle = fopen($filePath, 'r');

    while (($line = fgets($handle)) !== false) {
        yield str_getcsv($line);
    }

    fclose($handle);
}

foreach (readCsv('large.csv') as $row) {
    // Обрабатываем по одной строке (не загружаем весь файл)
    $this->processRow($row);
}

// Eloquent cursor (использует generator под капотом)
foreach (User::cursor() as $user) {
    // Загружает по одной записи из БД
    $this->processUser($user);
}

// Пагинация API
function fetchAllPages(string $url): Generator
{
    $page = 1;

    do {
        $response = Http::get($url, ['page' => $page]);
        $data = $response->json('data');

        foreach ($data as $item) {
            yield $item;
        }

        $page++;
    } while (!empty($data));
}

foreach (fetchAllPages('/api/products') as $product) {
    // Обрабатываем по одному продукту
}
```

**На собеседовании скажешь:**
> "Generator возвращает итератор через yield вместо return. Не загружает всё в память, отдаёт по одному элементу. Использую для больших выборок из БД (cursor), файлов, API. Eloquent::cursor() использует generator."

---

## Рекурсия

**Что это:**
Функция, которая вызывает сама себя.

**Как работает:**
```php
// Факториал
function factorial(int $n): int
{
    if ($n <= 1) {
        return 1;  // Базовый случай (остановка)
    }

    return $n * factorial($n - 1);  // Рекурсивный вызов
}

echo factorial(5);  // 5 * 4 * 3 * 2 * 1 = 120

// Обход дерева категорий
function getCategoryTree(int $parentId = null): array
{
    $categories = Category::where('parent_id', $parentId)->get();

    return $categories->map(function($category) {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'children' => getCategoryTree($category->id),  // Рекурсия
        ];
    })->toArray();
}

$tree = getCategoryTree();  // Вся иерархия
```

**Когда использовать:**
Для древовидных структур (меню, категории, комментарии), обхода вложенных массивов.

**Пример из практики:**
```php
// Меню с подменю
function buildMenu(int $parentId = null, int $depth = 0): string
{
    if ($depth > 3) {
        return '';  // Защита от бесконечной рекурсии
    }

    $items = MenuItem::where('parent_id', $parentId)
                     ->orderBy('order')
                     ->get();

    if ($items->isEmpty()) {
        return '';
    }

    $html = '<ul>';
    foreach ($items as $item) {
        $html .= "<li>{$item->title}";
        $html .= buildMenu($item->id, $depth + 1);  // Рекурсия для подменю
        $html .= '</li>';
    }
    $html .= '</ul>';

    return $html;
}

// Поиск файла в директории
function findFile(string $directory, string $filename): ?string
{
    $files = scandir($directory);

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $path = $directory . DIRECTORY_SEPARATOR . $file;

        if (is_file($path) && $file === $filename) {
            return $path;
        }

        if (is_dir($path)) {
            $found = findFile($path, $filename);  // Рекурсия
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}
```

**На собеседовании скажешь:**
> "Рекурсия — функция вызывает сама себя. Обязателен базовый случай (условие выхода), иначе бесконечная рекурсия. Использую для древовидных структур (меню, категории), обхода вложенных массивов. Важно ограничить глубину рекурсии."

---

## Callable и First-Class Callable (PHP 8.1+)

**Что это:**
Способы передачи функций как значений.

**Как работает:**
```php
// Callable типы
// 1. Имя функции (строка)
$callback = 'strtoupper';
echo $callback('hello');  // "HELLO"

// 2. Анонимная функция
$callback = function($str) {
    return strtoupper($str);
};

// 3. Arrow function
$callback = fn($str) => strtoupper($str);

// 4. Метод класса
$callback = [$object, 'methodName'];
$callback = [ClassName::class, 'staticMethod'];

// 5. Инвокация объекта (__invoke)
class Transformer
{
    public function __invoke(string $str): string
    {
        return strtoupper($str);
    }
}

$callback = new Transformer();
echo $callback('hello');  // "HELLO"

// First-Class Callable (PHP 8.1+)
$callback = strtoupper(...);  // Короче, чем fn($x) => strtoupper($x)
echo $callback('hello');  // "HELLO"

$callback = $object->method(...);
$callback = ClassName::staticMethod(...);
```

**Когда использовать:**
Для callback'ов, стратегий, фабрик, middleware.

**Пример из практики:**
```php
// Strategy pattern
class PriceCalculator
{
    public function calculate(int $price, callable $strategy): int
    {
        return $strategy($price);
    }
}

$calculator = new PriceCalculator();

// Разные стратегии
$withTax = fn($price) => (int) ($price * 1.2);
$withDiscount = fn($price) => (int) ($price * 0.9);

echo $calculator->calculate(1000, $withTax);       // 1200
echo $calculator->calculate(1000, $withDiscount);  // 900

// Laravel Pipeline
$result = Pipeline::send($request)
    ->through([
        fn($req, $next) => $this->authenticate($req, $next),
        fn($req, $next) => $this->authorize($req, $next),
        fn($req, $next) => $this->validate($req, $next),
    ])
    ->then(fn($req) => $this->handle($req));

// array_map с first-class callable (PHP 8.1)
$names = ['ivan', 'petr'];
$upper = array_map(strtoupper(...), $names);  // ['IVAN', 'PETR']
```

**На собеседовании скажешь:**
> "Callable — тип для функций, которые можно вызвать. PHP 8.1 добавил first-class callable (func(...)), короче чем fn($x) => func($x). Использую для callback'ов, стратегий, Pipeline."

---

## Резюме функций

**Основное:**
- Объявление: `function name(params): returnType { ... }`
- Type hints: всегда указывай типы + `declare(strict_types=1)`
- Анонимные функции: `function() use ($var) { ... }`
- Arrow functions: `fn($x) => $x * 2` (PHP 7.4+)
- Variadic: `function(...$args)` (переменное количество аргументов)
- Generator: `yield` для больших выборок (экономия памяти)
- Callable: передача функций как значений
- First-class callable: `func(...)` (PHP 8.1+)

**Важно на собесе:**
- Arrow functions автоматически захватывают переменные (не нужен use)
- Generator (yield) не загружает всё в память
- Eloquent::cursor() использует generator
- Рекурсия: обязателен базовый случай + ограничение глубины
- `declare(strict_types=1)` — всегда использовать

---

## Практические задания

### Задание 1: Arrow Function vs Closure
**Условие:** Сравни поведение arrow function и closure с внешними переменными.

<details>
<summary>Решение</summary>

```php
<?php

$multiplier = 10;

// Closure (нужен use)
$closure = function($n) use ($multiplier) {
    return $n * $multiplier;
};

// Arrow function (автоматический use)
$arrow = fn($n) => $n * $multiplier;

echo $closure(5);  // 50
echo $arrow(5);    // 50

// Изменение внешней переменной
$multiplier = 20;

echo $closure(5);  // 50 (захватил старое значение)
echo $arrow(5);    // 100 (захватил новое значение)

// По ссылке в closure
$counter = 0;

$increment = function() use (&$counter) {
    $counter++;
};

$increment();
$increment();
echo $counter;  // 2

// ⚠️ Arrow function не поддерживает use по ссылке
// $arrowIncrement = fn() => $counter++;  // Не изменит внешнюю переменную

// Практический пример (Laravel Collection)
$users = User::all();
$minAge = 18;

// Closure
$adults = $users->filter(function($user) use ($minAge) {
    return $user->age >= $minAge;
});

// Arrow function (короче)
$adults = $users->filter(fn($user) => $user->age >= $minAge);

// Цепочка
$result = $users
    ->filter(fn($u) => $u->is_active)
    ->map(fn($u) => $u->name)
    ->sortBy(fn($name) => mb_strtolower($name))
    ->values();
```

**Ключевые моменты:**
- Arrow function автоматически захватывает переменные
- Arrow function только для однострочных выражений
- Arrow function не поддерживает use по ссылке
- Arrow function короче и читаемее для простых случаев
</details>

### Задание 2: Генератор для пагинации API
**Условие:** Создай генератор для получения всех страниц из API.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ ПЛОХО (загружает все страницы в память)
function fetchAllPagesBad(string $url): array
{
    $allData = [];
    $page = 1;

    do {
        $response = Http::get($url, ['page' => $page]);
        $data = $response->json('data');

        $allData = array_merge($allData, $data);
        $page++;
    } while (!empty($data));

    return $allData;  // Весь результат в памяти!
}

// ✅ ХОРОШО (генератор, экономит память)
function fetchAllPages(string $url): Generator
{
    $page = 1;

    do {
        $response = Http::get($url, ['page' => $page]);
        $data = $response->json('data');

        foreach ($data as $item) {
            yield $item;  // Возвращаем по одному элементу
        }

        $hasMore = $response->json('meta.has_more', false);
        $page++;

    } while ($hasMore);
}

// Использование
function syncProducts(): array
{
    $synced = [];
    $errors = [];

    foreach (fetchAllPages('/api/products') as $product) {
        try {
            Product::updateOrCreate(
                ['external_id' => $product['id']],
                [
                    'name' => $product['name'],
                    'price' => $product['price'],
                ]
            );

            $synced[] = $product['id'];

        } catch (\Exception $e) {
            $errors[] = [
                'product_id' => $product['id'],
                'error' => $e->getMessage(),
            ];
        }
    }

    return [
        'synced' => count($synced),
        'errors' => count($errors),
        'details' => $errors,
    ];
}

// Генератор с ключами
function fetchUsersWithKeys(): Generator
{
    foreach (User::cursor() as $user) {
        yield $user->id => $user->name;
    }
}

foreach (fetchUsersWithKeys() as $id => $name) {
    echo "$id: $name\n";
}
```

**Ключевые моменты:**
- Генератор не загружает все данные в память
- `yield` возвращает по одному элементу
- Подходит для API с пагинацией
- Eloquent::cursor() также использует генератор
</details>

### Задание 3: Рекурсивное построение дерева категорий
**Условие:** Построй иерархическое дерево категорий с защитой от бесконечной рекурсии.

<details>
<summary>Решение</summary>

```php
<?php

class CategoryTree
{
    private const MAX_DEPTH = 5;

    /**
     * Построение дерева категорий
     *
     * @param int|null $parentId ID родительской категории
     * @param int $depth Текущая глубина рекурсии
     * @return array
     */
    public function buildTree(?int $parentId = null, int $depth = 0): array
    {
        // Защита от бесконечной рекурсии
        if ($depth >= self::MAX_DEPTH) {
            Log::warning("Max depth reached for parent_id: $parentId");
            return [];
        }

        $categories = Category::where('parent_id', $parentId)
            ->orderBy('position')
            ->get();

        return $categories->map(function($category) use ($depth) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'depth' => $depth,
                'children' => $this->buildTree($category->id, $depth + 1),
            ];
        })->toArray();
    }

    /**
     * Поиск пути к категории (хлебные крошки)
     */
    public function findPath(int $categoryId): array
    {
        $path = [];
        $category = Category::find($categoryId);

        while ($category !== null) {
            array_unshift($path, [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ]);

            $category = $category->parent;
        }

        return $path;
    }

    /**
     * Проверка, является ли категория потомком другой
     */
    public function isDescendantOf(int $childId, int $ancestorId, int $maxDepth = 10): bool
    {
        $category = Category::find($childId);
        $depth = 0;

        while ($category !== null && $depth < $maxDepth) {
            if ($category->parent_id === $ancestorId) {
                return true;
            }

            $category = $category->parent;
            $depth++;
        }

        return false;
    }
}

// Использование
$tree = (new CategoryTree())->buildTree();
/*
[
    [
        'id' => 1,
        'name' => 'Электроника',
        'children' => [
            [
                'id' => 2,
                'name' => 'Телефоны',
                'children' => [...]
            ]
        ]
    ]
]
*/

$breadcrumbs = (new CategoryTree())->findPath(5);
// [['id' => 1, 'name' => 'Электроника'], ['id' => 2, 'name' => 'Телефоны'], ...]
```

**Ключевые моменты:**
- Обязательная защита от бесконечной рекурсии (MAX_DEPTH)
- Базовый случай (когда прекратить рекурсию)
- Передача глубины через параметр
- Логирование при достижении лимита
- Альтернатива — цикл while (findPath, isDescendantOf)
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
