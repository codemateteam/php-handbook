# 1.3 Операторы в PHP

> **TL;DR**
> Всегда используй === вместо == (строгое сравнение). PHP 8.0 добавил match (улучшенный switch), nullsafe оператор (?>), null coalescing (??). PHP 7.4 — spread оператор (...). Spaceship (<=>) для сортировки. Ленивое вычисление в && и ||. Arrow functions (fn) автоматически захватывают переменные. Тернарный оператор ?: проверяет falsy, ?? проверяет только null.

## Содержание

- [Арифметические операторы](#арифметические-операторы)
- [Операторы сравнения](#операторы-сравнения)
- [Логические операторы](#логические-операторы)
- [Null-операторы (PHP 7+)](#null-операторы-php-7)
- [Тернарный оператор](#тернарный-оператор)
- [match (PHP 8.0+)](#match-php-80)
- [Оператор объединения строк](#оператор-объединения-строк)
- [Оператор распаковки (Spread, PHP 7.4+)](#оператор-распаковки-spread-php-74)
- [Резюме операторов](#резюме-операторов)
- [Практические задания](#практические-задания)

---

## Арифметические операторы

**Что это:**
Операторы для математических вычислений.

**Как работает:**
```php
$a = 10;
$b = 3;

echo $a + $b;   // 13 (сложение)
echo $a - $b;   // 7  (вычитание)
echo $a * $b;   // 30 (умножение)
echo $a / $b;   // 3.333... (деление)
echo $a % $b;   // 1  (остаток от деления)
echo $a ** $b;  // 1000 (возведение в степень, PHP 5.6+)

// Унарные
echo -$a;       // -10 (отрицание)
echo +$a;       // 10  (положительное)

// Инкремент/декремент
$i = 5;
echo ++$i;      // 6 (сначала увеличил, потом вернул)
echo $i++;      // 6 (сначала вернул, потом увеличил)
echo $i;        // 7
```

**Когда использовать:**
Для вычислений (сумма, количество, процент, пагинация).

**Пример из практики:**
```php
// Пагинация
$page = $request->input('page', 1);
$perPage = 20;
$offset = ($page - 1) * $perPage;

$users = User::skip($offset)->take($perPage)->get();

// Расчёт скидки
$price = 1000;
$discount = 15;  // 15%
$finalPrice = $price - ($price * $discount / 100);

// Округление до копеек (цена в центах)
$priceInCents = 1099;
$priceInRubles = $priceInCents / 100;  // 10.99
```

**На собеседовании скажешь:**
> "Арифметические операторы: +, -, *, /, %, **. Для инкремента: ++$i (сначала увеличить) vs $i++ (сначала вернуть). Для денег использую int в копейках, не float."

---

## Операторы сравнения

**Что это:**
Операторы для сравнения значений.

**Как работает:**
```php
// == (равно, с приведением типов)
var_dump(5 == '5');      // true (строка '5' → int 5)
var_dump(0 == false);    // true
var_dump('' == false);   // true

// === (идентично, без приведения типов)
var_dump(5 === '5');     // false (разные типы)
var_dump(0 === false);   // false
var_dump('' === false);  // false

// != (не равно) vs !== (не идентично)
var_dump(5 != '5');      // false
var_dump(5 !== '5');     // true

// Сравнение
var_dump(5 > 3);         // true
var_dump(5 >= 5);        // true
var_dump(3 < 5);         // true
var_dump(3 <= 3);        // true

// <=> (spaceship, PHP 7.0+)
echo 1 <=> 2;   // -1 (левое меньше)
echo 2 <=> 2;   //  0 (равны)
echo 3 <=> 2;   //  1 (левое больше)
```

**Когда использовать:**
- `===` / `!==` — везде, где возможно (строгое сравнение)
- `==` / `!=` — только если нужно приведение типов
- `<=>` — для сортировки

**Пример из практики:**
```php
// Проверка параметра
if ($request->input('status') === 'active') {
    // Строгое сравнение (избегаем '0', false, null)
}

// ПЛОХО
if ($user->role == 'admin') {  // '0' тоже пройдёт!
    // ...
}

// ХОРОШО
if ($user->role === 'admin') {
    // ...
}

// Сортировка с <=>
usort($users, fn($a, $b) => $a['age'] <=> $b['age']);

// Laravel Collection
$sorted = $users->sortBy('age');  // Под капотом использует <=>
```

**На собеседовании скажешь:**
> "== делает приведение типов (5 == '5'), === проверяет тип и значение. Всегда использую ===, кроме случаев, когда нужно приведение. <=> (spaceship) для сортировки, возвращает -1, 0, 1."

---

## Логические операторы

**Что это:**
Операторы для логических выражений.

**Как работает:**
```php
// && (AND) — оба должны быть true
var_dump(true && true);   // true
var_dump(true && false);  // false

// || (OR) — хотя бы одно true
var_dump(true || false);  // true
var_dump(false || false); // false

// ! (NOT) — инверсия
var_dump(!true);          // false
var_dump(!false);         // true

// and, or, xor (низкий приоритет)
$a = true and false;  // $a = true (сначала присваивание, потом and)
$a = true && false;   // $a = false (сначала &&, потом присваивание)
```

**Когда использовать:**
Для условий, валидации, проверок.

**Пример из практики:**
```php
// Проверка прав доступа
if ($user->isAdmin() && $user->isActive()) {
    // Пользователь админ И активен
}

// Проверка наличия
if (isset($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    // Email существует И валидный
}

// Short-circuit evaluation (ленивое вычисление)
if ($user && $user->isAdmin()) {
    // Если $user = null, $user->isAdmin() НЕ вызовется (избегаем ошибки)
}

// Gate в Laravel
if (Gate::allows('update', $post) && $post->isPublished()) {
    // Может редактировать И пост опубликован
}
```

**На собеседовании скажешь:**
> "Логические операторы: && (AND), || (OR), ! (NOT). PHP использует ленивое вычисление: если первое условие в && = false, второе не проверяется. Это полезно для избежания ошибок (null->method())."

---

## Null-операторы (PHP 7+)

**Что это:**
Операторы для работы с null значениями.

**Как работает:**
```php
// ?? (null coalescing, PHP 7.0+)
$name = $user->name ?? 'Гость';
// Если $user->name = null или не существует → 'Гость'

// Эквивалентно:
$name = isset($user->name) ? $user->name : 'Гость';

// Цепочка
$value = $a ?? $b ?? $c ?? 'default';

// ??= (null coalescing assignment, PHP 7.4+)
$config['timeout'] ??= 30;
// Если $config['timeout'] = null или не существует → присвоить 30

// Эквивалентно:
$config['timeout'] = $config['timeout'] ?? 30;

// ?-> (nullsafe operator, PHP 8.0+)
$street = $user?->address?->street;
// Если $user = null → вернёт null (без ошибки)
// Если $address = null → вернёт null (без ошибки)

// Без nullsafe (PHP < 8.0)
$street = $user && $user->address ? $user->address->street : null;
```

**Когда использовать:**
- `??` — для значений по умолчанию
- `??=` — для ленивой инициализации
- `?->` — для безопасного доступа к свойствам/методам

**Пример из практики:**
```php
// Параметры запроса с default значениями
$page = $request->input('page') ?? 1;
$perPage = $request->input('per_page') ?? 20;
$sort = $request->input('sort') ?? 'created_at';

// Конфиг с default
$timeout = config('api.timeout') ?? 30;

// Ленивая инициализация
class Cache
{
    private ?Redis $redis = null;

    public function getRedis(): Redis
    {
        $this->redis ??= new Redis();  // Создаст только 1 раз
        return $this->redis;
    }
}

// Nullsafe для вложенных объектов
$city = $user?->profile?->address?->city ?? 'Не указан';

// Eloquent
$department = $user?->department?->name ?? 'Без департамента';
```

**На собеседовании скажешь:**
> "?? возвращает первое не-null значение. ??= присваивает, если null. ?-> (PHP 8) безопасный доступ к свойствам: если объект null → вернёт null без ошибки. Использую везде вместо isset() ? : default."

---

## Тернарный оператор

**Что это:**
Сокращённая форма if-else.

**Как работает:**
```php
// Полная форма
$status = $isActive ? 'Активен' : 'Неактивен';

// Сокращённая форма (Elvis operator, PHP 5.3+)
$name = $user->name ?: 'Гость';
// Если $user->name = truthy → вернёт его
// Если $user->name = falsy (null, '', 0) → вернёт 'Гость'

// ⚠️ Отличие от ??
$value = 0;
echo $value ?: 'default';   // "default" (0 = falsy)
echo $value ?? 'default';   // "0" (?? проверяет только null)
```

**Когда использовать:**
Для простых условий. Если сложно — лучше if-else.

**Пример из практики:**
```php
// Короткие условия
$role = $user->isAdmin() ? 'Администратор' : 'Пользователь';

// Badge цвета
$badgeClass = match($status) {
    'active' => 'badge-success',
    'pending' => 'badge-warning',
    'blocked' => 'badge-danger',
    default => 'badge-secondary',
};

// В Blade (Laravel)
<span class="{{ $user->isActive() ? 'text-success' : 'text-danger' }}">
    {{ $user->isActive() ? 'Активен' : 'Неактивен' }}
</span>

// ПЛОХО (слишком сложно)
$result = $a > $b ? ($a > $c ? $a : $c) : ($b > $c ? $b : $c);

// ХОРОШО (понятнее)
$result = max($a, $b, $c);
```

**На собеседовании скажешь:**
> "Тернарный оператор: condition ? true : false. Сокращённая форма ?: возвращает truthy значение или default. Отличие: ?: проверяет falsy (0, '', false), ?? проверяет только null."

---

## match (PHP 8.0+)

**Что это:**
Улучшенный switch с возвратом значения и строгим сравнением.

**Как работает:**
```php
// switch (PHP < 8.0)
switch ($status) {
    case 'active':
        $message = 'Активен';
        break;
    case 'pending':
        $message = 'В ожидании';
        break;
    default:
        $message = 'Неизвестно';
}

// match (PHP 8.0+)
$message = match($status) {
    'active' => 'Активен',
    'pending' => 'В ожидании',
    default => 'Неизвестно',
};

// Несколько значений
$type = match($code) {
    200, 201, 204 => 'success',
    400, 404 => 'client_error',
    500, 502, 503 => 'server_error',
    default => 'unknown',
};

// Условия
$category = match(true) {
    $age < 18 => 'child',
    $age < 65 => 'adult',
    default => 'senior',
};
```

**Плюсы vs switch:**
1. **Строгое сравнение** (===, а не ==)
2. **Возвращает значение** (не нужен break)
3. **Ошибка, если нет default** и нет совпадений
4. **Меньше кода**

**Когда использовать:**
Вместо switch, когда нужно вернуть значение.

**Пример из практики:**
```php
// HTTP статус коды
$message = match($response->status()) {
    200 => 'OK',
    201 => 'Created',
    400 => 'Bad Request',
    401 => 'Unauthorized',
    403 => 'Forbidden',
    404 => 'Not Found',
    500 => 'Internal Server Error',
    default => 'Unknown Status',
};

// Enum (PHP 8.1)
enum Status: string {
    case Active = 'active';
    case Pending = 'pending';
    case Blocked = 'blocked';
}

$message = match($user->status) {
    Status::Active => 'Пользователь активен',
    Status::Pending => 'Ожидает подтверждения',
    Status::Blocked => 'Заблокирован',
};

// Права доступа
$canEdit = match(true) {
    $user->isAdmin() => true,
    $user->owns($post) => true,
    $post->isPublished() => false,
    default => false,
};
```

**На собеседовании скажешь:**
> "match — улучшенный switch в PHP 8. Отличия: строгое сравнение (===), возвращает значение, не нужен break. Выбрасывает ошибку, если нет совпадений и default. Использую вместо switch для возврата значений."

---

## Оператор объединения строк

**Что это:**
Конкатенация строк через `.` или интерполяция.

**Как работает:**
```php
// Конкатенация через .
$firstName = 'Иван';
$lastName = 'Иванов';
$fullName = $firstName . ' ' . $lastName;  // "Иван Иванов"

// .= (добавление к строке)
$message = 'Привет, ';
$message .= $firstName;
$message .= '!';
echo $message;  // "Привет, Иван!"

// Интерполяция (в двойных кавычках)
$greeting = "Привет, $firstName!";  // "Привет, Иван!"
$greeting = "Привет, {$firstName}!";  // Явная интерполяция

// Для свойств/методов — обязательны {}
$greeting = "Привет, {$user->name}!";
```

**Когда использовать:**
- Интерполяция — для простых случаев
- Конкатенация — для сложных выражений

**Пример из практики:**
```php
// Email шаблон
$subject = "Здравствуйте, {$user->name}!";
$body = "Ваш заказ #{$order->id} готов к отправке.";

// Query building
$sql = "SELECT * FROM users ";
$sql .= "WHERE is_active = true ";
$sql .= "ORDER BY created_at DESC";

// URL
$url = "/api/users/{$userId}/posts/{$postId}";

// Blade (Laravel)
<h1>Привет, {{ $user->name }}!</h1>
<p>Заказ #{{ $order->id }}</p>
```

**На собеседовании скажешь:**
> "Конкатенация через . или интерполяция в двойных кавычках. Для переменных: $var или {$var}. Для свойств/методов обязательны {}: {$user->name}."

---

## Оператор распаковки (Spread, PHP 7.4+)

**Что это:**
Распаковка массивов через `...`.

**Как работает:**
```php
// Распаковка массива
$arr1 = [1, 2, 3];
$arr2 = [4, 5, 6];
$merged = [...$arr1, ...$arr2];  // [1, 2, 3, 4, 5, 6]

// Эквивалентно array_merge, но быстрее
$merged = array_merge($arr1, $arr2);

// Распаковка в функцию
function sum(int ...$numbers): int {
    return array_sum($numbers);
}

echo sum(1, 2, 3, 4, 5);  // 15

$values = [1, 2, 3];
echo sum(...$values);  // 6 (распаковка массива в аргументы)

// Ассоциативные массивы (PHP 8.1+)
$user = ['name' => 'Иван', 'age' => 25];
$extra = ['city' => 'Москва'];
$merged = [...$user, ...$extra];
// ['name' => 'Иван', 'age' => 25, 'city' => 'Москва']
```

**Когда использовать:**
Для слияния массивов, передачи списка аргументов.

**Пример из практики:**
```php
// Merge query параметров
$defaultFilters = ['status' => 'active', 'per_page' => 20];
$userFilters = $request->only(['search', 'category']);
$filters = [...$defaultFilters, ...$userFilters];

// Eloquent with() с дополнительными отношениями
$baseRelations = ['author', 'category'];
$extraRelations = ['comments', 'tags'];
$posts = Post::with([...$baseRelations, ...$extraRelations])->get();

// Variadic функция
class EventDispatcher
{
    public function fire(string $event, ...$args): void
    {
        foreach ($this->listeners[$event] ?? [] as $listener) {
            $listener(...$args);  // Передаём все аргументы
        }
    }
}

$dispatcher->fire('user.created', $user, $timestamp);
```

**На собеседовании скажешь:**
> "... (spread) распаковывает массив. Использую для слияния массивов (быстрее array_merge), передачи списка аргументов в функцию. PHP 8.1 поддерживает spread для ассоциативных массивов."

---

## Резюме операторов

**Арифметические:**
- `+, -, *, /, %, **`
- `++, --` (инкремент/декремент)

**Сравнение:**
- `==` vs `===` (всегда используй ===)
- `<=>` (spaceship для сортировки)

**Логические:**
- `&&, ||, !` (ленивое вычисление)

**Null-операторы:**
- `??` (null coalescing)
- `??=` (null coalescing assignment)
- `?->` (nullsafe, PHP 8.0)

**Условные:**
- `? :` (тернарный)
- `match` (PHP 8.0, вместо switch)

**Строки:**
- `.` (конкатенация)
- `"$var"` (интерполяция)

**Массивы:**
- `...` (spread, PHP 7.4+)

**Важно на собесе:**
- `===` vs `==` (строгое vs нестрогое)
- `??` vs `?:` (null vs falsy)
- `match` vs `switch` (PHP 8.0)
- `?->` для безопасного доступа (PHP 8.0)

---

## Практические задания

### Задание 1: Разница между == и ===
**Условие:** Предскажи результат сравнений.

<details>
<summary>Решение</summary>

```php
<?php

// == (нестрогое сравнение)
var_dump(5 == '5');       // true (приведёт '5' → 5)
var_dump(0 == false);     // true
var_dump('' == false);    // true
var_dump(null == false);  // true
var_dump('0' == false);   // true
var_dump([] == false);    // true

// === (строгое сравнение)
var_dump(5 === '5');      // false (разные типы)
var_dump(0 === false);    // false
var_dump('' === false);   // false
var_dump(null === false); // false
var_dump('0' === false);  // false
var_dump([] === false);   // false

// Опасная проблема с ==
function findUserById(int $id, array $users): ?array
{
    foreach ($users as $user) {
        // ❌ ОПАСНО
        if ($user['id'] == $id) {
            return $user;
        }
        // Если $id = '1abc', найдёт пользователя с id = 1!
    }
    return null;
}

// ✅ ПРАВИЛЬНО
function findUserByIdCorrect(int $id, array $users): ?array
{
    foreach ($users as $user) {
        if ($user['id'] === $id) {
            return $user;
        }
    }
    return null;
}
```

**Ключевые моменты:**
- `==` приводит типы (type juggling)
- `===` проверяет тип и значение
- Всегда используй `===` для безопасности
</details>

### Задание 2: ?? vs ?:
**Условие:** Объясни разницу между ?? и ?:.

<details>
<summary>Решение</summary>

```php
<?php

$value = 0;

// ?: (Elvis operator) проверяет truthy/falsy
echo $value ?: 'default';   // "default" (0 = falsy)

// ?? (null coalescing) проверяет только null
echo $value ?? 'default';   // "0" (0 не null)

// Примеры
$name = '';
echo $name ?: 'Guest';      // "Guest" ('' = falsy)
echo $name ?? 'Guest';      // "" ('' не null)

$age = null;
echo $age ?: 18;            // 18
echo $age ?? 18;            // 18

// Практический пример
function getConfig(array $config): array
{
    return [
        // ?: для значений, которые могут быть пустыми
        'title' => $config['title'] ?: 'Untitled',

        // ?? для опциональных параметров
        'timeout' => $config['timeout'] ?? 30,
        'retries' => $config['retries'] ?? 3,
    ];
}

// Laravel пример
public function index(Request $request)
{
    // ?? для query параметров
    $page = $request->input('page') ?? 1;
    $perPage = $request->input('per_page') ?? 20;

    // ?: для fallback значений
    $search = $request->input('search') ?: null;
}
```

**Ключевые моменты:**
- `?:` проверяет falsy (0, '', false, null, [])
- `??` проверяет только null
- `??` безопаснее для числовых значений (0, '0')
</details>

### Задание 3: match vs switch
**Условие:** Перепиши switch на match.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ switch (старый способ)
$status = 'pending';
$message = '';

switch ($status) {
    case 'pending':
        $message = 'В ожидании';
        break;
    case 'paid':
        $message = 'Оплачен';
        break;
    case 'shipped':
        $message = 'Отправлен';
        break;
    default:
        $message = 'Неизвестен';
}

echo $message;

// ✅ match (PHP 8.0)
$message = match($status) {
    'pending' => 'В ожидании',
    'paid' => 'Оплачен',
    'shipped' => 'Отправлен',
    default => 'Неизвестен',
};

echo $message;

// Преимущества match
// 1. Строгое сравнение (===)
$value = '1';

switch ($value) {
    case 1:  // Выполнится! (== приведёт '1' → 1)
        echo 'One';
        break;
}

match($value) {
    1 => 'One',  // НЕ выполнится (=== разные типы)
    default => 'Other',
};

// 2. Возвращает значение
$badge = match($status) {
    'pending' => 'badge-warning',
    'paid' => 'badge-success',
    'shipped' => 'badge-info',
    default => 'badge-secondary',
};

// 3. Несколько значений
$httpCategory = match($code) {
    200, 201, 204 => 'success',
    400, 401, 403, 404 => 'client_error',
    500, 502, 503 => 'server_error',
    default => 'unknown',
};

// 4. Условия
$category = match(true) {
    $age < 18 => 'child',
    $age < 65 => 'adult',
    default => 'senior',
};
```

**Ключевые моменты:**
- `match` использует строгое сравнение (===)
- `match` возвращает значение (не нужен break)
- `match` выбрасывает UnhandledMatchError если нет совпадений
- `match` короче и читаемее
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
