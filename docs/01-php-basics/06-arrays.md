# 1.6 Массивы в PHP

> **TL;DR**
> PHP массивы — упорядоченная хеш-таблица с copy-on-write. in_array по умолчанию нестрогое (нужен третий параметр true). unset() не переиндексирует (нужен array_values). array_key_exists работает с null, isset() нет. Spread (...) быстрее array_merge. В Laravel предпочитай Collection методы (map, filter, reduce) вместо array_*.

## Содержание

- [Создание массивов](#создание-массивов)
- [Добавление и удаление элементов](#добавление-и-удаление-элементов)
- [array_map, array_filter, array_reduce](#array_map-array_filter-array_reduce)
- [Сортировка массивов](#сортировка-массивов)
- [array_merge, array_combine, array_diff](#array_merge-array_combine-array_diff)
- [in_array, array_key_exists, array_search](#in_array-array_key_exists-array_search)
- [array_column, array_unique, array_flip](#array_column-array_unique-array_flip)
- [Деструктуризация массивов (PHP 7.1+)](#деструктуризация-массивов-php-71)
- [Spread Operator (PHP 7.4+)](#spread-operator-php-74)
- [Резюме массивов](#резюме-массивов)
- [Практические задания](#практические-задания)

---

## Создание массивов

**Что это:**
Упорядоченная коллекция пар ключ-значение.

**Как работает:**
```php
// Индексный массив (numeric keys)
$numbers = [1, 2, 3, 4, 5];
$numbers = array(1, 2, 3, 4, 5);  // Старый синтаксис

// Ассоциативный массив (string keys)
$user = [
    'id' => 1,
    'name' => 'Иван',
    'email' => 'ivan@mail.com',
];

// Смешанный массив
$mixed = [
    0 => 'first',
    'key' => 'value',
    1 => 'second',
];

// Вложенные массивы
$users = [
    ['id' => 1, 'name' => 'Иван'],
    ['id' => 2, 'name' => 'Пётр'],
];

// Доступ к элементам
echo $numbers[0];      // 1
echo $user['name'];    // "Иван"
echo $users[0]['id'];  // 1
```

**Когда использовать:**
Для списков, коллекций, конфигураций, параметров запросов.

**Пример из практики:**
```php
// Request data
$data = $request->only(['name', 'email', 'password']);

// Config
$dbConfig = [
    'host' => env('DB_HOST'),
    'port' => env('DB_PORT'),
    'database' => env('DB_DATABASE'),
];

// Response
return response()->json([
    'status' => 'success',
    'data' => $users->toArray(),
    'meta' => [
        'total' => $total,
        'page' => $page,
    ],
]);
```

**На собеседовании скажешь:**
> "PHP массивы — упорядоченная хеш-таблица. Поддерживают индексные (numeric keys) и ассоциативные (string keys) ключи. Внутренне это одна структура данных."

---

## Добавление и удаление элементов

**Как работает:**
```php
$arr = [1, 2, 3];

// Добавление в конец
$arr[] = 4;  // [1, 2, 3, 4]
array_push($arr, 5, 6);  // [1, 2, 3, 4, 5, 6]

// Добавление в начало
array_unshift($arr, 0);  // [0, 1, 2, 3, 4, 5, 6]

// Удаление с конца
$last = array_pop($arr);  // 6, массив [0, 1, 2, 3, 4, 5]

// Удаление с начала
$first = array_shift($arr);  // 0, массив [1, 2, 3, 4, 5]

// Удаление по ключу
unset($arr[2]);  // [1, 2, 4, 5] (ключи: 0, 1, 3, 4)

// Удаление с переиндексацией
$arr = array_values($arr);  // [1, 2, 4, 5] (ключи: 0, 1, 2, 3)

// Ассоциативные массивы
$user = ['name' => 'Иван', 'email' => 'ivan@mail.com'];
$user['age'] = 25;  // Добавить
unset($user['email']);  // Удалить
```

**Пример из практики:**
```php
// Добавление фильтров
$filters = [];

if ($request->has('status')) {
    $filters['status'] = $request->input('status');
}

if ($request->has('department_id')) {
    $filters['department_id'] = $request->input('department_id');
}

// Merge массивов
$defaultParams = ['per_page' => 20, 'sort' => 'created_at'];
$params = array_merge($defaultParams, $request->only(['search', 'status']));

// Удаление пустых значений
$data = array_filter($request->all(), fn($value) => $value !== null && $value !== '');
```

**На собеседовании скажешь:**
> "Добавление: [] или array_push (конец), array_unshift (начало). Удаление: array_pop (конец), array_shift (начало), unset (по ключу). unset не переиндексирует, нужен array_values."

---

## array_map, array_filter, array_reduce

**Что это:**
Функции высшего порядка для работы с массивами.

**Как работает:**
```php
$numbers = [1, 2, 3, 4, 5];

// array_map — преобразование каждого элемента
$squared = array_map(fn($n) => $n ** 2, $numbers);
// [1, 4, 9, 16, 25]

// array_filter — фильтрация элементов
$even = array_filter($numbers, fn($n) => $n % 2 === 0);
// [2, 4] (ключи сохраняются: [1 => 2, 3 => 4])

// array_reduce — свёртка в одно значение
$sum = array_reduce($numbers, fn($carry, $n) => $carry + $n, 0);
// 15 (1 + 2 + 3 + 4 + 5)

// Комбинация
$result = array_reduce(
    array_filter($numbers, fn($n) => $n % 2 === 0),
    fn($carry, $n) => $carry + $n ** 2,
    0
);
// 20 (2² + 4² = 4 + 16)
```

**Когда использовать:**
Для преобразования, фильтрации, агрегации данных.

**Пример из практики:**
```php
// Преобразование в ID массив
$userIds = array_map(fn($user) => $user['id'], $users);

// Фильтрация активных пользователей
$active = array_filter($users, fn($user) => $user['is_active']);

// Расчёт суммы заказов
$total = array_reduce($orders, fn($sum, $order) => $sum + $order['amount'], 0);

// Laravel Collection (лучше использовать вместо array_*)
$users = User::all();

$ids = $users->map(fn($user) => $user->id);
$active = $users->filter(fn($user) => $user->is_active);
$total = $orders->sum('amount');

// Плюсы Collection: цепочки, ленивое выполнение, читаемость
$result = $users
    ->filter(fn($u) => $u->is_active)
    ->map(fn($u) => $u->name)
    ->sort()
    ->values();
```

**На собеседовании скажешь:**
> "array_map — преобразование, array_filter — фильтрация, array_reduce — свёртка. В Laravel предпочитаю Collection методы (map, filter, reduce) — читаемее, поддерживают цепочки."

---

## Сортировка массивов

**Как работает:**
```php
$numbers = [3, 1, 4, 1, 5, 9];

// sort — по значению (ключи переиндексируются)
sort($numbers);  // [1, 1, 3, 4, 5, 9]

// rsort — по значению (обратный порядок)
rsort($numbers);  // [9, 5, 4, 3, 1, 1]

// asort — по значению (ключи сохраняются)
$ages = ['Иван' => 25, 'Пётр' => 30, 'Мария' => 20];
asort($ages);  // ['Мария' => 20, 'Иван' => 25, 'Пётр' => 30]

// arsort — по значению обратный порядок (ключи сохраняются)
arsort($ages);  // ['Пётр' => 30, 'Иван' => 25, 'Мария' => 20]

// ksort — по ключу
ksort($ages);  // ['Иван' => 25, 'Мария' => 20, 'Пётр' => 30]

// krsort — по ключу обратный порядок
krsort($ages);  // ['Пётр' => 30, 'Мария' => 20, 'Иван' => 25]

// usort — custom сортировка
$users = [
    ['name' => 'Иван', 'age' => 25],
    ['name' => 'Пётр', 'age' => 30],
    ['name' => 'Мария', 'age' => 20],
];

usort($users, fn($a, $b) => $a['age'] <=> $b['age']);
// [['Мария', 20], ['Иван', 25], ['Пётр', 30]]
```

**Когда использовать:**
Для упорядочивания данных по критерию.

**Пример из практики:**
```php
// Сортировка товаров по цене
usort($products, fn($a, $b) => $a['price'] <=> $b['price']);

// Сортировка по убыванию
usort($products, fn($a, $b) => $b['price'] <=> $a['price']);

// Многоуровневая сортировка
usort($products, function($a, $b) {
    // Сначала по категории, потом по цене
    $categoryCompare = $a['category'] <=> $b['category'];
    if ($categoryCompare !== 0) {
        return $categoryCompare;
    }
    return $a['price'] <=> $b['price'];
});

// Laravel Collection
$sorted = $products->sortBy('price');
$sorted = $products->sortByDesc('price');
$sorted = $products->sortBy([
    ['category', 'asc'],
    ['price', 'asc'],
]);
```

**На собеседовании скажешь:**
> "sort — по значению (переиндексирует), asort — по значению (сохраняет ключи), ksort — по ключу. usort — custom сортировка через callback. В Laravel использую Collection::sortBy()."

---

## array_merge, array_combine, array_diff

**Как работает:**
```php
// array_merge — слияние массивов
$arr1 = [1, 2, 3];
$arr2 = [4, 5, 6];
$merged = array_merge($arr1, $arr2);  // [1, 2, 3, 4, 5, 6]

// Ассоциативные — последнее значение перезаписывает
$user1 = ['name' => 'Иван', 'age' => 25];
$user2 = ['age' => 30, 'email' => 'ivan@mail.com'];
$merged = array_merge($user1, $user2);
// ['name' => 'Иван', 'age' => 30, 'email' => 'ivan@mail.com']

// Spread operator (PHP 7.4+)
$merged = [...$arr1, ...$arr2];

// array_combine — создать массив из ключей и значений
$keys = ['name', 'age', 'email'];
$values = ['Иван', 25, 'ivan@mail.com'];
$user = array_combine($keys, $values);
// ['name' => 'Иван', 'age' => 25, 'email' => 'ivan@mail.com']

// array_diff — разница между массивами (по значению)
$arr1 = [1, 2, 3, 4, 5];
$arr2 = [3, 4, 5, 6, 7];
$diff = array_diff($arr1, $arr2);  // [1, 2]

// array_intersect — пересечение
$intersect = array_intersect($arr1, $arr2);  // [3, 4, 5]
```

**Когда использовать:**
Для объединения, сравнения, создания массивов.

**Пример из практики:**
```php
// Merge параметров запроса с default значениями
$defaults = ['per_page' => 20, 'sort' => 'created_at', 'order' => 'desc'];
$params = array_merge($defaults, $request->only(['per_page', 'sort', 'order']));

// Spread для merge (быстрее)
$params = [...$defaults, ...$request->only(['per_page', 'sort', 'order'])];

// Создание массива из результатов запроса
$users = User::all();
$ids = $users->pluck('id')->toArray();
$names = $users->pluck('name')->toArray();
$usersById = array_combine($ids, $names);
// [1 => 'Иван', 2 => 'Пётр', ...]

// Найти удалённые роли пользователя
$oldRoles = [1, 2, 3, 4];
$newRoles = [2, 3, 5];
$removed = array_diff($oldRoles, $newRoles);  // [1, 4]
$added = array_diff($newRoles, $oldRoles);    // [5]

// Синхронизация ролей
$user->roles()->sync($newRoles);  // Laravel автоматически найдёт diff
```

**На собеседовании скажешь:**
> "array_merge объединяет массивы (последнее значение перезаписывает). array_combine создаёт массив из ключей и значений. array_diff — разница, array_intersect — пересечение. Spread (...) быстрее array_merge."

---

## in_array, array_key_exists, array_search

**Как работает:**
```php
$numbers = [1, 2, 3, 4, 5];
$user = ['name' => 'Иван', 'age' => 25];

// in_array — проверка значения (НЕстрогая по умолчанию)
var_dump(in_array(3, $numbers));     // true
var_dump(in_array('3', $numbers));   // true (приведёт '3' → 3)

// Строгая проверка (third parameter)
var_dump(in_array('3', $numbers, true));  // false

// array_key_exists — проверка ключа
var_dump(array_key_exists('name', $user));  // true
var_dump(array_key_exists('email', $user)); // false

// isset() vs array_key_exists()
$arr = ['key' => null];
var_dump(isset($arr['key']));              // false (значение null)
var_dump(array_key_exists('key', $arr));   // true (ключ существует)

// array_search — поиск ключа по значению
$fruits = ['apple', 'banana', 'orange'];
$key = array_search('banana', $fruits);  // 1
$key = array_search('grape', $fruits);   // false (не найдено)
```

**Когда использовать:**
Для проверки наличия значения, ключа, поиска позиции.

**Пример из практики:**
```php
// Проверка ролей пользователя
$userRoles = ['editor', 'author'];

if (in_array('admin', $userRoles, true)) {
    // Пользователь админ
}

// Laravel Collection
if ($user->roles->contains('name', 'admin')) {
    // ...
}

// Проверка наличия параметра
if (array_key_exists('status', $request->query())) {
    $status = $request->query('status');
}

// Laravel
if ($request->has('status')) {
    $status = $request->input('status');
}

// Поиск индекса элемента
$statuses = ['pending', 'paid', 'shipped', 'delivered'];
$currentIndex = array_search($order->status, $statuses);
$nextStatus = $statuses[$currentIndex + 1] ?? null;
```

**На собеседовании скажешь:**
> "in_array проверяет значение (по умолчанию нестрогое, нужен третий параметр true). array_key_exists проверяет ключ (работает с null). array_search возвращает ключ по значению. В Laravel использую Collection::contains()."

---

## array_column, array_unique, array_flip

**Как работает:**
```php
$users = [
    ['id' => 1, 'name' => 'Иван', 'age' => 25],
    ['id' => 2, 'name' => 'Пётр', 'age' => 30],
    ['id' => 3, 'name' => 'Мария', 'age' => 20],
];

// array_column — извлечь колонку
$names = array_column($users, 'name');  // ['Иван', 'Пётр', 'Мария']
$ids = array_column($users, 'id');      // [1, 2, 3]

// С индексом по другой колонке
$usersById = array_column($users, null, 'id');
// [1 => [...], 2 => [...], 3 => [...]]

$nameById = array_column($users, 'name', 'id');
// [1 => 'Иван', 2 => 'Пётр', 3 => 'Мария']

// array_unique — удалить дубликаты
$numbers = [1, 2, 2, 3, 3, 3, 4];
$unique = array_unique($numbers);  // [1, 2, 3, 4] (ключи сохраняются!)

// array_flip — поменять ключи и значения местами
$map = ['a' => 'apple', 'b' => 'banana'];
$flipped = array_flip($map);  // ['apple' => 'a', 'banana' => 'b']
```

**Когда использовать:**
- `array_column` — извлечь определённые поля из массива объектов/массивов
- `array_unique` — убрать дубликаты
- `array_flip` — создать reverse map (значение → ключ)

**Пример из практики:**
```php
// Получить ID всех пользователей
$users = User::all()->toArray();
$ids = array_column($users, 'id');

// Laravel Collection (лучше)
$ids = User::all()->pluck('id')->toArray();

// Индексировать по ID
$usersById = array_column($users, null, 'id');

// Laravel Collection
$usersById = User::all()->keyBy('id');

// Убрать дубликаты категорий
$categories = [1, 2, 2, 3, 3, 3];
$unique = array_unique($categories);

// Laravel Collection
$unique = collect($categories)->unique()->values();

// Reverse map для быстрого поиска
$statusNames = ['pending' => 'В ожидании', 'paid' => 'Оплачен'];
$nameToStatus = array_flip($statusNames);
// ['В ожидании' => 'pending', 'Оплачен' => 'paid']
```

**На собеседовании скажешь:**
> "array_column извлекает колонку из массива массивов. array_unique удаляет дубликаты (ключи сохраняются). array_flip меняет ключи и значения местами. В Laravel использую Collection методы (pluck, unique, keyBy)."

---

## Деструктуризация массивов (PHP 7.1+)

**Как работает:**
```php
// Индексный массив
$user = ['Иван', 'ivan@mail.com', 25];

// Старый способ
$name = $user[0];
$email = $user[1];
$age = $user[2];

// Деструктуризация (PHP 7.1+)
[$name, $email, $age] = $user;

// Пропуск элементов
[$name, , $age] = $user;  // Пропустили $email

// Ассоциативный массив (PHP 7.1+)
$user = ['name' => 'Иван', 'email' => 'ivan@mail.com', 'age' => 25];
['name' => $name, 'age' => $age] = $user;

// В foreach
$users = [
    ['name' => 'Иван', 'age' => 25],
    ['name' => 'Пётр', 'age' => 30],
];

foreach ($users as ['name' => $name, 'age' => $age]) {
    echo "$name: $age лет";
}

// В параметрах функции
function greet(['name' => $name, 'age' => $age]): string
{
    return "Привет, $name! Тебе $age лет.";
}

echo greet(['name' => 'Иван', 'age' => 25]);
```

**Когда использовать:**
Для распаковки массивов, возвращающих несколько значений.

**Пример из практики:**
```php
// Получение min/max
$prices = [100, 200, 150, 300];
[$min, $max] = [min($prices), max($prices)];

// Пагинация
function paginate(int $page, int $perPage): array
{
    $offset = ($page - 1) * $perPage;
    $total = User::count();

    return [
        'data' => User::skip($offset)->take($perPage)->get(),
        'meta' => ['total' => $total, 'page' => $page],
    ];
}

['data' => $users, 'meta' => $meta] = paginate(1, 20);

// Laravel
[$users, $total] = [User::paginate(20)->items(), User::count()];

// Координаты
$point = [55.7558, 37.6173];  // Москва
[$lat, $lng] = $point;
```

**На собеседовании скажешь:**
> "Деструктуризация (PHP 7.1+) распаковывает массив в переменные: [$a, $b] = [1, 2]. Работает с индексными и ассоциативными массивами. Использую для распаковки результатов функций, в foreach."

---

## Spread Operator (PHP 7.4+)

**Как работает:**
```php
// Распаковка массивов
$arr1 = [1, 2, 3];
$arr2 = [4, 5, 6];

// array_merge
$merged = array_merge($arr1, $arr2);  // [1, 2, 3, 4, 5, 6]

// Spread (быстрее и короче)
$merged = [...$arr1, ...$arr2];  // [1, 2, 3, 4, 5, 6]

// Добавление элементов
$extended = [...$arr1, 99, ...$arr2];  // [1, 2, 3, 99, 4, 5, 6]

// Ассоциативные массивы (PHP 8.1+)
$user = ['name' => 'Иван', 'age' => 25];
$extra = ['city' => 'Москва'];
$merged = [...$user, ...$extra];
// ['name' => 'Иван', 'age' => 25, 'city' => 'Москва']

// Variadic функции
function sum(int ...$numbers): int
{
    return array_sum($numbers);
}

$numbers = [1, 2, 3, 4, 5];
echo sum(...$numbers);  // 15
```

**Когда использовать:**
Для слияния массивов (быстрее array_merge), передачи списка аргументов.

**Пример из практики:**
```php
// Merge конфигов
$defaults = ['timeout' => 30, 'retries' => 3];
$custom = ['timeout' => 60];
$config = [...$defaults, ...$custom];  // timeout будет 60

// Добавление middleware
$baseMiddleware = ['auth', 'verified'];
$adminMiddleware = [...$baseMiddleware, 'admin'];

Route::middleware($adminMiddleware)->group(function() {
    // ...
});

// Передача параметров
$params = ['status' => 'active', 'department_id' => 5];
$users = User::where(...$params)->get();  // ❌ Не работает так

// Правильно
$users = User::where($params)->get();
// или
foreach ($params as $key => $value) {
    $query->where($key, $value);
}
```

**На собеседовании скажешь:**
> "Spread (...) распаковывает массив (PHP 7.4+). Быстрее array_merge. PHP 8.1 добавил поддержку ассоциативных массивов. Использую для слияния массивов, передачи списка аргументов в функцию."

---

## Резюме массивов

**Основное:**
- Создание: `[1, 2, 3]` или `['key' => 'value']`
- Добавление: `[]` (конец), `array_push`, `array_unshift`
- Удаление: `array_pop`, `array_shift`, `unset`
- Функции высшего порядка: `array_map`, `array_filter`, `array_reduce`
- Сортировка: `sort`, `asort`, `ksort`, `usort`
- Слияние: `array_merge`, spread `[...$a, ...$b]`
- Поиск: `in_array`, `array_key_exists`, `array_search`
- Утилиты: `array_column`, `array_unique`, `array_flip`
- Деструктуризация: `[$a, $b] = [1, 2]` (PHP 7.1+)
- Spread: `...$array` (PHP 7.4+)

**Важно на собесе:**
- PHP массивы — это хеш-таблица (поддерживает и индексы, и ключи)
- `in_array` по умолчанию нестрогое сравнение (нужен третий параметр `true`)
- `unset()` не переиндексирует, нужен `array_values()`
- `array_key_exists()` работает с `null`, `isset()` — нет
- Spread `...` быстрее `array_merge`
- В Laravel предпочитаю Collection методы вместо array_* функций

---

## Практические задания

### Задание 1: in_array с нестрогим сравнением
**Условие:** Найди и исправь проблему безопасности в коде проверки ролей.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ ОПАСНО (нестрогое сравнение)
function hasRole(User $user, string $role): bool
{
    $userRoles = $user->roles->pluck('name')->toArray();
    return in_array($role, $userRoles);  // Небезопасно!
}

// Проблема:
$userRoles = ['editor', 'author'];

var_dump(in_array('admin', $userRoles));      // false ✅
var_dump(in_array('0', $userRoles));          // false ✅
var_dump(in_array(0, $userRoles));            // TRUE! ❌ (0 == 'editor' = false, но...)
var_dump(in_array(true, $userRoles));         // TRUE! ❌ (true == 'editor' = true)

// ✅ ПРАВИЛЬНО (строгое сравнение)
function hasRoleCorrect(User $user, string $role): bool
{
    $userRoles = $user->roles->pluck('name')->toArray();
    return in_array($role, $userRoles, true);  // Строгое сравнение
}

// Или Laravel Collection
function hasRoleCollection(User $user, string $role): bool
{
    return $user->roles->contains('name', $role);  // Использует ===
}

// Тесты
$admin = new User(['roles' => ['admin', 'editor']]);
$guest = new User(['roles' => ['guest']]);

var_dump(hasRoleCorrect($admin, 'admin'));    // true
var_dump(hasRoleCorrect($admin, 'moderator')); // false
var_dump(hasRoleCorrect($admin, '0'));         // false
var_dump(hasRoleCorrect($admin, 0));           // TypeError (strict_types)
```

**Ключевые моменты:**
- `in_array()` по умолчанию использует `==` (нестрогое)
- Третий параметр `true` включает строгое сравнение `===`
- Без строгого сравнения: `0`, `true` могут пройти проверку
- В Laravel Collection методы используют строгое сравнение
</details>

### Задание 2: array_key_exists vs isset
**Условие:** Объясни разницу между array_key_exists и isset.

<details>
<summary>Решение</summary>

```php
<?php

$data = [
    'name' => 'John',
    'age' => 0,
    'email' => null,
    'active' => false,
];

// isset() - проверяет существование И !== null
var_dump(isset($data['name']));     // true
var_dump(isset($data['age']));      // true (0 не null)
var_dump(isset($data['email']));    // false (null)
var_dump(isset($data['active']));   // true (false не null)
var_dump(isset($data['missing']));  // false (не существует)

// array_key_exists() - проверяет только существование ключа
var_dump(array_key_exists('name', $data));     // true
var_dump(array_key_exists('age', $data));      // true
var_dump(array_key_exists('email', $data));    // true (ключ есть!)
var_dump(array_key_exists('active', $data));   // true
var_dump(array_key_exists('missing', $data));  // false

// Практический пример
function getConfig(array $config, string $key, mixed $default = null): mixed
{
    // ❌ НЕПРАВИЛЬНО
    if (isset($config[$key])) {
        return $config[$key];
    }
    // Если $config[$key] = null, вернёт default (неожиданно!)

    // ✅ ПРАВИЛЬНО
    if (array_key_exists($key, $config)) {
        return $config[$key];
    }

    return $default;
}

$config = [
    'timeout' => null,  // Явно установлен в null
    'retries' => 3,
];

echo getConfig($config, 'timeout', 30);  // null (не 30!)
echo getConfig($config, 'missing', 30);  // 30

// Laravel helper (использует array_key_exists)
$timeout = data_get($config, 'timeout', 30);  // null
$missing = data_get($config, 'missing', 30);  // 30
```

**Ключевые моменты:**
- `isset()` возвращает false для null значений
- `array_key_exists()` проверяет только наличие ключа
- Для конфигов с null значениями используй `array_key_exists()`
- Laravel `data_get()` использует `array_key_exists()`
</details>

### Задание 3: Spread оператор vs array_merge
**Условие:** Сравни производительность и поведение spread и array_merge.

<details>
<summary>Решение</summary>

```php
<?php

// Индексные массивы
$arr1 = [1, 2, 3];
$arr2 = [4, 5, 6];

// array_merge
$merged1 = array_merge($arr1, $arr2);  // [1, 2, 3, 4, 5, 6]

// Spread (быстрее)
$merged2 = [...$arr1, ...$arr2];       // [1, 2, 3, 4, 5, 6]

// Ассоциативные массивы
$user1 = ['name' => 'John', 'age' => 25];
$user2 = ['age' => 30, 'city' => 'Moscow'];

// array_merge (последнее значение перезаписывает)
$merged3 = array_merge($user1, $user2);
// ['name' => 'John', 'age' => 30, 'city' => 'Moscow']

// Spread (PHP 8.1+)
$merged4 = [...$user1, ...$user2];
// ['name' => 'John', 'age' => 30, 'city' => 'Moscow']

// Spread с числовыми ключами
$arr1 = [0 => 'a', 1 => 'b'];
$arr2 = [0 => 'c', 1 => 'd'];

array_merge($arr1, $arr2);  // [0 => 'a', 1 => 'b', 2 => 'c', 3 => 'd'] (переиндексация)
[...$arr1, ...$arr2];       // [0 => 'a', 1 => 'b', 2 => 'c', 3 => 'd'] (тоже переиндексация)

// Spread со строковыми ключами (сохраняет)
$arr1 = ['a' => 1, 'b' => 2];
$arr2 = ['c' => 3];

[...$arr1, ...$arr2];  // ['a' => 1, 'b' => 2, 'c' => 3]

// Практический пример (Laravel)
class UserController
{
    public function store(Request $request)
    {
        $defaults = [
            'is_active' => true,
            'email_verified' => false,
        ];

        // Spread (быстрее и короче)
        $data = [...$defaults, ...$request->validated()];

        // array_merge (старый способ)
        $data = array_merge($defaults, $request->validated());

        return User::create($data);
    }
}

// Benchmark (приблизительно)
// array_merge: ~1.5x медленнее
// spread: ~1.5x быстрее
```

**Ключевые моменты:**
- Spread `...` быстрее `array_merge`
- Spread для ассоциативных массивов требует PHP 8.1+
- Оба переиндексируют числовые ключи
- Последнее значение перезаписывает предыдущие
- Spread короче и читаемее
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
