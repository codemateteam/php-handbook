# 1.2 Переменные в PHP

> **TL;DR**
> Переменные начинаются с $, динамически типизированы. isset() проверяет существование и не null, empty() — falsy значения. & создаёт ссылку (важно делать unset после foreach). Избегай глобальных переменных, используй DI. Суперглобальные ($_GET, $_POST, $_SERVER) в Laravel заменяются Request объектом. Константы через const в классах для статусов.

## Содержание

- [Объявление и присваивание](#объявление-и-присваивание)
- [isset() vs empty()](#isset-vs-empty)
- [Переменные переменных](#переменные-переменных)
- [Ссылки (References)](#ссылки-references)
- [Глобальные переменные](#глобальные-переменные)
- [Суперглобальные переменные](#суперглобальные-переменные)
- [Константы](#константы)
- [Резюме](#резюме)
- [Практические задания](#практические-задания)

---

## Объявление и присваивание

**Что это:**
Переменные в PHP начинаются с `$` и не требуют явного объявления типа.

**Как работает:**
```php
$name = 'Иван';
$age = 25;
$price = 99.99;

// Динамическая типизация
$value = 10;        // int
$value = 'string';  // теперь string (переприсвоение)
```

**Когда использовать:**
Для хранения любых данных в коде (строки, числа, объекты, массивы).

**Пример из практики:**
```php
// Контроллер
public function store(Request $request)
{
    $data = $request->validated();
    $user = User::create($data);

    return response()->json($user, 201);
}
```

**На собеседовании скажешь:**
> "В PHP переменные начинаются с $, динамически типизированы. Тип определяется автоматически при присваивании и может меняться."

---

## isset() vs empty()

**Что это:**
Функции для проверки существования и значения переменной.

**Как работает:**
```php
$var = null;

// isset() — существует И не null
var_dump(isset($var));        // false (null)
var_dump(isset($undefined));  // false (не существует)

$var = 0;
var_dump(isset($var));        // true (существует, даже если 0)

// empty() — "пустое" значение
var_dump(empty(0));          // true
var_dump(empty('0'));        // true
var_dump(empty(''));         // true
var_dump(empty(null));       // true
var_dump(empty([]));         // true
var_dump(empty(false));      // true

var_dump(empty('hello'));    // false
var_dump(empty(1));          // false
```

**Когда использовать:**
- `isset()` — проверка, что переменная установлена (не null)
- `empty()` — проверка, что значение "пустое" (falsy)

**Пример из практики:**
```php
// Проверка query параметров
public function index(Request $request)
{
    // isset — проверяем, что параметр передан
    if (isset($request->query()['status'])) {
        $status = $request->query('status');
    }

    // empty — проверяем, что значение не пустое
    if (!empty($request->input('search'))) {
        $query->where('name', 'like', "%{$request->input('search')}%");
    }
}

// Проверка массива
$filters = $request->input('filters', []);
if (!empty($filters)) {
    // Применяем фильтры
}
```

**На собеседовании скажешь:**
> "isset() проверяет, что переменная существует и не null. empty() проверяет falsy значения: 0, '0', '', null, [], false. Важно: empty('0') = true, а isset() не проверяет значение, только существование."

---

## Переменные переменных

**Что это:**
Возможность использовать значение одной переменной как имя другой.

**Как работает:**
```php
$name = 'value';
$value = 'Hello!';

echo $$name;  // "Hello!" (обращение к $value)

// Более явный синтаксис
echo ${$name};  // "Hello!"

// Опасно!
$field = $_GET['field'];  // Может быть что угодно
echo $$field;  // Потенциальная уязвимость
```

**Когда использовать:**
Редко. Чаще используй массивы или объекты.

**Пример из практики:**
```php
// ПЛОХО (не делай так)
$status_active = 'Активен';
$status_blocked = 'Заблокирован';
$currentStatus = 'active';
echo ${"status_$currentStatus"};  // "Активен"

// ХОРОШО (используй массив)
$statuses = [
    'active' => 'Активен',
    'blocked' => 'Заблокирован',
];
echo $statuses[$currentStatus];  // "Активен"
```

**На собеседовании скажешь:**
> "$$var — переменная переменной. Использую редко, предпочитаю массивы или объекты. Может быть опасно, если имя переменной приходит извне (XSS, RCE)."

---

## Ссылки (References)

**Что это:**
Возможность создать псевдоним переменной через `&`.

**Как работает:**
```php
$a = 10;
$b = &$a;  // $b — ссылка на $a

$b = 20;
echo $a;  // 20 (изменили через $b, но $a тоже изменился)

// Передача по ссылке в функцию
function increment(&$value) {
    $value++;
}

$count = 5;
increment($count);
echo $count;  // 6 (изменился оригинал)
```

**Когда использовать:**
- Когда нужно изменить оригинальную переменную внутри функции
- Избегай без необходимости (может усложнить код)

**Пример из практики:**
```php
// Модификация массива в цикле
$users = [
    ['name' => 'Иван', 'active' => false],
    ['name' => 'Пётр', 'active' => false],
];

// С ссылкой
foreach ($users as &$user) {
    $user['active'] = true;  // Изменяет оригинальный массив
}
unset($user);  // ВАЖНО! Очистить ссылку после цикла

var_dump($users);
// Все пользователи теперь active = true

// Без ссылки (не изменится)
foreach ($users as $user) {
    $user['active'] = false;  // Изменяет только копию
}
// $users не изменился
```

**⚠️ Важная ошибка:**
```php
$array = [1, 2, 3];

foreach ($array as &$value) {
    $value *= 2;
}
// НЕ забыть unset($value)!

// Если забыть unset():
foreach ($array as $value) {
    // $value всё ещё ссылка на последний элемент!
    // Это перезапишет последний элемент
}

var_dump($array);  // [2, 4, 4] (а не [2, 4, 6])

// Правильно:
unset($value);  // Очистить ссылку после первого foreach
```

**На собеседовании скажешь:**
> "& создаёт ссылку на переменную. Использую для изменения оригинала в функции или в foreach. Важно: после foreach с ссылкой обязательно делать unset(), иначе последний элемент может быть перезаписан."

---

## Глобальные переменные

**Что это:**
Переменные, доступные во всех областях видимости через `global` или `$GLOBALS`.

**Как работает:**
```php
$name = 'Иван';  // Глобальная переменная

function greet() {
    global $name;  // Доступ к глобальной переменной
    echo "Привет, $name!";
}

greet();  // "Привет, Иван!"

// Или через $GLOBALS
function greet2() {
    echo "Привет, {$GLOBALS['name']}!";
}
```

**Когда использовать:**
❌ Избегай глобальных переменных! Используй:
- Dependency Injection
- Параметры функций
- Классы и свойства

**Пример из практики:**
```php
// ПЛОХО
$db = new Database();

function getUsers() {
    global $db;  // Плохо: зависимость от глобальной переменной
    return $db->query('SELECT * FROM users');
}

// ХОРОШО (Dependency Injection)
class UserRepository
{
    public function __construct(private Database $db) {}

    public function getUsers(): array
    {
        return $this->db->query('SELECT * FROM users');
    }
}

// Laravel
$users = app(UserRepository::class)->getUsers();
```

**На собеседовании скажешь:**
> "global даёт доступ к глобальным переменным. Избегаю их использования, предпочитаю Dependency Injection. В Laravel все зависимости через Service Container."

---

## Суперглобальные переменные

**Что это:**
Встроенные массивы PHP, доступные везде.

**Как работает:**
```php
// $_GET — параметры из URL (?name=Ivan)
$name = $_GET['name'] ?? 'Гость';

// $_POST — данные из формы
$email = $_POST['email'] ?? null;

// $_SERVER — информация о сервере
$ip = $_SERVER['REMOTE_ADDR'];
$userAgent = $_SERVER['HTTP_USER_AGENT'];
$method = $_SERVER['REQUEST_METHOD'];

// $_SESSION — данные сессии
$_SESSION['user_id'] = 1;
$userId = $_SESSION['user_id'] ?? null;

// $_COOKIE — куки
$token = $_COOKIE['auth_token'] ?? null;

// $_FILES — загруженные файлы
$file = $_FILES['avatar'] ?? null;

// $_ENV — переменные окружения
$dbHost = $_ENV['DB_HOST'];
```

**Когда использовать:**
В legacy PHP. В Laravel используй:
- `$request->input()` вместо `$_GET` / `$_POST`
- `$request->session()` вместо `$_SESSION`
- `$request->cookie()` вместо `$_COOKIE`
- `$request->file()` вместо `$_FILES`
- `env()` или `config()` вместо `$_ENV`

**Пример из практики:**
```php
// СТАРЫЙ СПОСОБ (plain PHP)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? null;
    $password = $_POST['password'] ?? null;

    if ($email && $password) {
        // ...
    }
}

// СОВРЕМЕННЫЙ (Laravel)
public function login(Request $request)
{
    $credentials = $request->only('email', 'password');

    if (Auth::attempt($credentials)) {
        return redirect()->intended('dashboard');
    }
}
```

**На собеседовании скажешь:**
> "Суперглобальные переменные ($_GET, $_POST, $_SERVER, $_SESSION, $_COOKIE, $_FILES) доступны везде. В Laravel не использую их напрямую, работаю через Request объект и фасады."

---

## Константы

**Что это:**
Неизменяемые значения, определённые через `define()` или `const`.

**Как работает:**
```php
// define() — работает везде
define('APP_NAME', 'My App');
echo APP_NAME;  // "My App"

// const — только на верхнем уровне или в классе
const VERSION = '1.0.0';
echo VERSION;

// В классе
class Config
{
    public const DB_HOST = 'localhost';
    public const DB_PORT = 5432;
}

echo Config::DB_HOST;  // "localhost"
```

**Когда использовать:**
Для значений, которые не меняются (конфигурация, версия, константы).

**Пример из практики:**
```php
// Laravel config
// config/app.php
return [
    'name' => env('APP_NAME', 'Laravel'),
    'version' => '10.0',
];

// Использование
$appName = config('app.name');

// Константы в классе (статусы, типы)
class Order
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_SHIPPED = 'shipped';
    public const STATUS_DELIVERED = 'delivered';

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }
}

// Использование
if ($order->status === Order::STATUS_PAID) {
    // ...
}
```

**На собеседовании скажешь:**
> "Константы через define() или const. В классах использую const для статусов, типов. В Laravel конфигурация через config(), не через константы."

---

## Резюме

**Основное:**
- `$var` — переменная (динамическая типизация)
- `isset()` — существует и не null
- `empty()` — falsy значение (0, '0', '', null, [], false)
- `&` — ссылка (изменяет оригинал)
- `global` / `$GLOBALS` — избегай, используй DI
- Суперглобальные: `$_GET`, `$_POST`, `$_SERVER` — в Laravel через Request
- Константы: `define()` или `const`

**Важно на собесе:**
- `empty('0')` = true (частый вопрос)
- После foreach с `&$value` делать `unset($value)`
- Избегай глобальных переменных, используй Dependency Injection
- В Laravel работай через Request, а не суперглобальные переменные

---

## Практические задания

### Задание 1: isset() vs empty()
**Условие:** Определи результат выполнения для разных значений переменной.

<details>
<summary>Решение</summary>

```php
<?php

function testVariable($value): array
{
    return [
        'value' => $value,
        'isset' => isset($value),
        'empty' => empty($value),
        'is_null' => is_null($value),
        'bool_cast' => (bool) $value,
    ];
}

// Тесты
var_dump(testVariable(null));
// ['isset' => false, 'empty' => true, 'is_null' => true, 'bool_cast' => false]

var_dump(testVariable(0));
// ['isset' => true, 'empty' => true, 'is_null' => false, 'bool_cast' => false]

var_dump(testVariable('0'));
// ['isset' => true, 'empty' => true, 'is_null' => false, 'bool_cast' => false]

var_dump(testVariable(''));
// ['isset' => true, 'empty' => true, 'is_null' => false, 'bool_cast' => false]

var_dump(testVariable([]));
// ['isset' => true, 'empty' => true, 'is_null' => false, 'bool_cast' => false]

var_dump(testVariable(false));
// ['isset' => true, 'empty' => true, 'is_null' => false, 'bool_cast' => false]

var_dump(testVariable('false'));
// ['isset' => true, 'empty' => false, 'is_null' => false, 'bool_cast' => true] ⚠️
```

**Ключевые моменты:**
- `isset()`: false только для null и несуществующих переменных
- `empty()`: true для всех falsy значений
- Строка `'false'` НЕ пустая (это truthy значение)
</details>

### Задание 2: Проблема ссылок в foreach
**Условие:** Найди и исправь ошибку в коде.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ НЕПРАВИЛЬНО
$numbers = [1, 2, 3];

foreach ($numbers as &$n) {
    $n *= 2;
}
// Забыли unset($n)!

foreach ($numbers as $n) {
    echo $n . ' ';
}
// Вывод: 2 4 4 (а не 2 4 6)
// Последний элемент перезаписан!

// ✅ ПРАВИЛЬНО
$numbers = [1, 2, 3];

foreach ($numbers as &$n) {
    $n *= 2;
}
unset($n);  // ОБЯЗАТЕЛЬНО!

foreach ($numbers as $n) {
    echo $n . ' ';
}
// Вывод: 2 4 6 ✅

// ✅ ЕЩЁ ЛУЧШЕ (без ссылки)
$numbers = array_map(fn($n) => $n * 2, $numbers);
// Или в Laravel:
$numbers = collect($numbers)->map(fn($n) => $n * 2)->toArray();
```

**Ключевые моменты:**
- После foreach с `&` переменная остаётся ссылкой на последний элемент
- Второй foreach перезаписывает последний элемент
- Всегда делай `unset()` после foreach с ссылкой
- Предпочитай функциональный подход (array_map, Collection)
</details>

### Задание 3: Dependency Injection вместо глобальных переменных
**Условие:** Рефакторинг кода с глобальными переменными на DI.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ ПЛОХО (глобальные переменные)
$db = new PDO('mysql:host=localhost;dbname=test', 'root', '');
$logger = new Logger('app.log');

function getUsers(): array
{
    global $db, $logger;

    $logger->info('Fetching users');
    return $db->query('SELECT * FROM users')->fetchAll();
}

// ✅ ХОРОШО (Dependency Injection)
class UserRepository
{
    public function __construct(
        private PDO $db,
        private Logger $logger
    ) {}

    public function getAll(): array
    {
        $this->logger->info('Fetching users');
        return $this->db->query('SELECT * FROM users')->fetchAll();
    }
}

// Использование
$repository = new UserRepository($db, $logger);
$users = $repository->getAll();

// ✅ LARAVEL (Service Container)
class UserRepository
{
    public function __construct(
        private DB $db,
        private Log $logger
    ) {}

    public function getAll(): array
    {
        $this->logger->info('Fetching users');
        return $this->db->table('users')->get();
    }
}

// Laravel автоматически инжектит зависимости
$repository = app(UserRepository::class);
$users = $repository->getAll();
```

**Ключевые моменты:**
- Глобальные переменные усложняют тестирование
- DI делает зависимости явными
- Laravel Service Container автоматически резолвит зависимости
- Легче мокировать в тестах
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
