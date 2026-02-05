# 1.4 Управляющие конструкции

> **TL;DR**
> Предпочитай guard clauses (ранний return) вместо вложенных if. match вместо switch (PHP 8.0). while для неизвестного количества итераций, for для счётчика, foreach для массивов. После foreach с &$var обязательно unset($var). break выходит из цикла, continue пропускает итерацию. Избегай exit/die в контроллерах. Всегда используй declare(strict_types=1).

## Содержание

- [if, elseif, else](#if-elseif-else)
- [switch vs match](#switch-vs-match)
- [while, do-while](#while-do-while)
- [for](#for)
- [foreach](#foreach)
- [break, continue](#break-continue)
- [return, exit, die](#return-exit-die)
- [declare (strict_types)](#declare-strict_types)
- [Резюме управляющих конструкций](#резюме-управляющих-конструкций)
- [Практические задания](#практические-задания)

---

## if, elseif, else

**Что это:**
Условное выполнение кода.

**Как работает:**
```php
$age = 25;

if ($age < 18) {
    echo 'Несовершеннолетний';
} elseif ($age < 65) {
    echo 'Взрослый';
} else {
    echo 'Пенсионер';
}

// Без фигурных скобок (не рекомендуется)
if ($isActive)
    echo 'Активен';

// С фигурными скобками (рекомендуется)
if ($isActive) {
    echo 'Активен';
}

// Альтернативный синтаксис (для шаблонов)
<?php if ($user->isAdmin()): ?>
    <div>Панель администратора</div>
<?php endif; ?>
```

**Когда использовать:**
Для любых условных проверок.

**Пример из практики:**
```php
// Проверка прав доступа
public function update(Request $request, Post $post)
{
    if (!auth()->check()) {
        abort(401, 'Требуется авторизация');
    }

    if (!Gate::allows('update', $post)) {
        abort(403, 'Нет прав на редактирование');
    }

    $post->update($request->validated());

    return response()->json($post);
}

// Guard clauses (ранний выход)
public function process(?User $user)
{
    // ХОРОШО (guard clause)
    if ($user === null) {
        return;
    }

    if (!$user->isActive()) {
        throw new InactiveUserException();
    }

    // Основная логика
    $this->doSomething($user);
}

// ПЛОХО (глубокая вложенность)
public function processBad(?User $user)
{
    if ($user !== null) {
        if ($user->isActive()) {
            // Основная логика на 3-м уровне вложенности
            $this->doSomething($user);
        }
    }
}
```

**На собеседовании скажешь:**
> "if-elseif-else для условий. Предпочитаю guard clauses (ранний выход) вместо глубокой вложенности. В шаблонах использую альтернативный синтаксис (if: ... endif;)."

---

## switch vs match

**Что это:**
Множественный выбор на основе значения.

**Как работает:**
```php
// switch (старый способ)
$status = 'active';

switch ($status) {
    case 'active':
        $message = 'Активен';
        break;
    case 'pending':
        $message = 'В ожидании';
        break;
    case 'blocked':
        $message = 'Заблокирован';
        break;
    default:
        $message = 'Неизвестен';
}

// ⚠️ Без break — выполнятся все case ниже (fall-through)
switch ($role) {
    case 'admin':
        $permissions[] = 'delete';
    case 'editor':
        $permissions[] = 'edit';
    case 'viewer':
        $permissions[] = 'view';
        break;
}
// Если $role = 'editor' → $permissions = ['edit', 'view']

// match (PHP 8.0+)
$message = match($status) {
    'active' => 'Активен',
    'pending' => 'В ожидании',
    'blocked' => 'Заблокирован',
    default => 'Неизвестен',
};

// Несколько значений
$httpCategory = match($statusCode) {
    200, 201, 204 => 'success',
    400, 401, 403, 404 => 'client_error',
    500, 502, 503 => 'server_error',
    default => 'unknown',
};
```

**Когда использовать:**
- `match` — всегда, когда возможно (PHP 8.0+)
- `switch` — для legacy кода или сложной логики в case

**Пример из практики:**
```php
// Обработка HTTP статусов
$result = match($response->status()) {
    200 => $response->json(),
    201 => ['message' => 'Created', 'id' => $response->json('id')],
    400 => throw new BadRequestException($response->body()),
    401 => throw new UnauthorizedException(),
    404 => throw new NotFoundException(),
    default => throw new HttpException($response->status()),
};

// Права доступа
$canEdit = match(true) {
    $user->isAdmin() => true,
    $user->owns($post) && !$post->isPublished() => true,
    default => false,
};

// Enum (PHP 8.1)
enum OrderStatus: string {
    case Pending = 'pending';
    case Paid = 'paid';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
}

$badge = match($order->status) {
    OrderStatus::Pending => 'badge-warning',
    OrderStatus::Paid => 'badge-info',
    OrderStatus::Shipped => 'badge-primary',
    OrderStatus::Delivered => 'badge-success',
    OrderStatus::Cancelled => 'badge-danger',
};
```

**На собеседовании скажешь:**
> "switch — множественный выбор с break. match (PHP 8.0) — улучшенный switch: строгое сравнение, возвращает значение, не нужен break. Предпочитаю match для возврата значений."

---

## while, do-while

**Что это:**
Циклы с условием.

**Как работает:**
```php
// while — проверка ДО выполнения
$i = 0;
while ($i < 5) {
    echo $i;
    $i++;
}
// Выведет: 01234

// do-while — проверка ПОСЛЕ выполнения (выполнится минимум 1 раз)
$i = 10;
do {
    echo $i;
    $i++;
} while ($i < 5);
// Выведет: 10 (хотя условие false, выполнилось 1 раз)

// Бесконечный цикл
while (true) {
    $job = $queue->pop();

    if ($job === null) {
        break;  // Выход из цикла
    }

    $job->handle();
}
```

**Когда использовать:**
- `while` — когда не знаешь количество итераций заранее
- `do-while` — когда нужно выполнить минимум 1 раз
- `for` / `foreach` — когда знаешь количество итераций

**Пример из практики:**
```php
// Построчное чтение большого файла
$handle = fopen('large-file.csv', 'r');

while (($line = fgets($handle)) !== false) {
    $data = str_getcsv($line);
    // Обработка строки
    $this->processRow($data);
}

fclose($handle);

// Queue worker
while (true) {
    $job = $this->queue->pop();

    if ($job === null) {
        usleep(100000);  // 100ms
        continue;
    }

    try {
        $job->handle();
        $this->queue->acknowledge($job);
    } catch (\Exception $e) {
        $this->queue->reject($job);
        $this->logger->error($e);
    }
}

// Retry logic
$attempts = 0;
$maxAttempts = 3;

while ($attempts < $maxAttempts) {
    try {
        $result = $this->apiClient->request();
        break;  // Успех — выходим
    } catch (ApiException $e) {
        $attempts++;
        if ($attempts >= $maxAttempts) {
            throw $e;
        }
        sleep(2);  // Задержка перед повтором
    }
}
```

**На собеседовании скажешь:**
> "while проверяет условие ДО выполнения, do-while — ПОСЛЕ (минимум 1 раз). Использую для retry logic, построчного чтения файлов, queue workers."

---

## for

**Что это:**
Цикл с счётчиком.

**Как работает:**
```php
// for (инициализация; условие; инкремент)
for ($i = 0; $i < 5; $i++) {
    echo $i;
}
// Выведет: 01234

// Обратный порядок
for ($i = 5; $i > 0; $i--) {
    echo $i;
}
// Выведет: 54321

// Шаг 2
for ($i = 0; $i <= 10; $i += 2) {
    echo $i;
}
// Выведет: 0246810

// Несколько переменных
for ($i = 0, $j = 10; $i < $j; $i++, $j--) {
    echo "$i-$j ";
}
// Выведет: 0-10 1-9 2-8 3-7 4-6

// Бесконечный цикл
for (;;) {
    // Выполняется вечно
    if ($shouldStop) {
        break;
    }
}
```

**Когда использовать:**
Когда нужен счётчик или известно количество итераций.

**Пример из практики:**
```php
// Генерация номеров страниц
$totalPages = 10;
$currentPage = 5;

for ($i = 1; $i <= $totalPages; $i++) {
    if ($i === $currentPage) {
        echo "<span class='active'>$i</span> ";
    } else {
        echo "<a href='?page=$i'>$i</a> ";
    }
}

// Batch обработка
$total = User::count();  // 100 000
$batchSize = 1000;

for ($offset = 0; $offset < $total; $offset += $batchSize) {
    $users = User::skip($offset)->take($batchSize)->get();

    foreach ($users as $user) {
        // Обработка
        $this->processUser($user);
    }

    // Освобождаем память
    unset($users);
}

// Генерация диапазона дат
$start = new DateTime('2024-01-01');
$end = new DateTime('2024-01-31');
$dates = [];

for ($date = clone $start; $date <= $end; $date->modify('+1 day')) {
    $dates[] = $date->format('Y-m-d');
}
```

**На собеседовании скажешь:**
> "for для циклов со счётчиком. Использую для batch обработки, генерации диапазонов, когда нужен индекс. Для массивов предпочитаю foreach."

---

## foreach

**Что это:**
Итерация по массивам и объектам.

**Как работает:**
```php
$users = ['Иван', 'Пётр', 'Мария'];

// Только значения
foreach ($users as $user) {
    echo $user;
}

// Ключ + значение
$ages = ['Иван' => 25, 'Пётр' => 30];

foreach ($ages as $name => $age) {
    echo "$name: $age лет";
}

// Изменение через ссылку
$numbers = [1, 2, 3];

foreach ($numbers as &$number) {
    $number *= 2;
}
unset($number);  // ⚠️ ВАЖНО! Очистить ссылку

var_dump($numbers);  // [2, 4, 6]

// Ошибка без unset
foreach ($numbers as &$number) {
    $number *= 2;
}
// Забыли unset($number)

foreach ($numbers as $number) {
    // $number всё ещё ссылка на последний элемент!
    // Последний элемент будет перезаписан
}
```

**Когда использовать:**
Для итерации по массивам, коллекциям, объектам с Iterator.

**Пример из практики:**
```php
// Eloquent Collection
$users = User::where('is_active', true)->get();

foreach ($users as $user) {
    echo $user->name;
}

// Изменение массива через ссылку
$data = [
    ['name' => 'Товар 1', 'price' => 100],
    ['name' => 'Товар 2', 'price' => 200],
];

foreach ($data as &$item) {
    $item['price'] *= 1.1;  // Увеличить цену на 10%
}
unset($item);

// Laravel Collection (лучше использовать map)
$discounted = collect($data)->map(function ($item) {
    $item['price'] *= 0.9;  // Скидка 10%
    return $item;
});

// Группировка
$usersByDepartment = [];

foreach ($users as $user) {
    $usersByDepartment[$user->department_id][] = $user;
}

// Laravel Collection (лучше groupBy)
$grouped = $users->groupBy('department_id');
```

**На собеседовании скажешь:**
> "foreach для итерации по массивам и коллекциям. Для изменения элементов использую &$var, но ОБЯЗАТЕЛЬНО unset() после цикла. В Laravel предпочитаю методы Collection (map, filter, groupBy)."

---

## break, continue

**Что это:**
Управление выполнением цикла.

**Как работает:**
```php
// break — выход из цикла
for ($i = 0; $i < 10; $i++) {
    if ($i === 5) {
        break;  // Выход при i = 5
    }
    echo $i;
}
// Выведет: 01234

// continue — пропустить текущую итерацию
for ($i = 0; $i < 10; $i++) {
    if ($i % 2 === 0) {
        continue;  // Пропустить чётные
    }
    echo $i;
}
// Выведет: 13579

// break с уровнем (выход из вложенных циклов)
for ($i = 0; $i < 3; $i++) {
    for ($j = 0; $j < 3; $j++) {
        if ($i === 1 && $j === 1) {
            break 2;  // Выход из ОБОИХ циклов
        }
        echo "$i-$j ";
    }
}
// Выведет: 0-0 0-1 0-2 1-0
```

**Когда использовать:**
- `break` — выход при выполнении условия (найден результат, ошибка)
- `continue` — пропустить элемент (фильтрация)

**Пример из практики:**
```php
// Поиск пользователя
$found = null;

foreach ($users as $user) {
    if ($user->email === $searchEmail) {
        $found = $user;
        break;  // Нашли — выходим
    }
}

// Лучше через Collection
$found = $users->firstWhere('email', $searchEmail);

// Валидация с ранним выходом
public function validate(array $data): array
{
    $errors = [];

    foreach ($data as $field => $value) {
        if (empty($value)) {
            $errors[$field] = 'Поле обязательно';
            continue;  // Пропустить остальные проверки для этого поля
        }

        if ($field === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $errors[$field] = 'Неверный email';
        }
    }

    return $errors;
}

// Batch обработка с ошибками
foreach ($items as $item) {
    try {
        $this->process($item);
    } catch (ProcessException $e) {
        Log::error("Ошибка обработки: {$e->getMessage()}");
        continue;  // Пропустить элемент с ошибкой, продолжить обработку
    }
}
```

**На собеседовании скажешь:**
> "break выходит из цикла, continue пропускает итерацию. break 2 выходит из вложенных циклов. Использую break для раннего выхода при нахождении результата, continue для пропуска элементов с ошибками."

---

## return, exit, die

**Что это:**
Прерывание выполнения функции или скрипта.

**Как работает:**
```php
// return — выход из функции с возвратом значения
function findUser(int $id): ?User
{
    $user = User::find($id);

    if ($user === null) {
        return null;  // Ранний выход
    }

    return $user;
}

// exit / die — полная остановка скрипта
if (!auth()->check()) {
    exit('Требуется авторизация');  // Остановка выполнения
}

// exit() = die() (алиасы)
die('Fatal error');

// С кодом выхода (для CLI)
exit(0);   // Успех
exit(1);   // Ошибка
```

**Когда использовать:**
- `return` — всегда для выхода из функции
- `exit` / `die` — только для критических ошибок (не в продакшене!)

**Пример из практики:**
```php
// ПЛОХО (не используй exit в контроллере)
public function show(int $id)
{
    $user = User::find($id);

    if ($user === null) {
        exit('User not found');  // ❌ Плохо
    }

    return view('user.show', compact('user'));
}

// ХОРОШО (используй abort или исключения)
public function show(int $id)
{
    $user = User::findOrFail($id);  // 404 если не найден

    return view('user.show', compact('user'));
}

// Guard clauses (ранний return)
public function update(Request $request, Post $post)
{
    if (!Gate::allows('update', $post)) {
        return response()->json(['error' => 'Forbidden'], 403);
    }

    $post->update($request->validated());

    return response()->json($post);
}

// CLI команда
public function handle()
{
    if (!$this->confirm('Удалить все данные?')) {
        $this->info('Отменено');
        return 0;  // Код успеха
    }

    try {
        DB::table('logs')->truncate();
        return 0;
    } catch (\Exception $e) {
        $this->error($e->getMessage());
        return 1;  // Код ошибки
    }
}
```

**На собеседовании скажешь:**
> "return выходит из функции. exit/die останавливают скрипт (не использую в продакшене, только для критических ошибок). Предпочитаю guard clauses (ранний return) вместо вложенных if."

---

## declare (strict_types)

**Что это:**
Объявление директив для PHP.

**Как работает:**
```php
<?php
declare(strict_types=1);

// strict_types — строгая типизация
function add(int $a, int $b): int
{
    return $a + $b;
}

add(5, 10);      // OK
add(5, '10');    // ❌ TypeError (без strict_types приведёт '10' → 10)

// Без strict_types (по умолчанию)
add(5, '10');    // OK, '10' → 10 (автоматическое приведение)
add(5, 'abc');   // ❌ TypeError ('abc' нельзя привести к int)
```

**Когда использовать:**
**Всегда** используй `declare(strict_types=1)` в начале файла.

**Пример из практики:**
```php
<?php
declare(strict_types=1);

namespace App\Services;

class OrderService
{
    public function create(int $userId, float $amount): Order
    {
        // $userId и $amount строго типизированы
        return Order::create([
            'user_id' => $userId,
            'amount' => $amount,
        ]);
    }
}

// Без strict_types
$service->create('5', '100.50');  // OK (приведёт к int и float)

// С strict_types
$service->create('5', '100.50');  // ❌ TypeError

// Правильно
$service->create(5, 100.50);  // ✅ OK
```

**На собеседовании скажешь:**
> "declare(strict_types=1) включает строгую типизацию. Без неё PHP автоматически приводит типы ('5' → 5). Всегда использую strict_types для избежания ошибок типизации."

---

## Резюме управляющих конструкций

**Условия:**
- `if-elseif-else` — для любых условий
- `match` (PHP 8.0) — вместо switch
- Guard clauses (ранний return) — вместо вложенных if

**Циклы:**
- `for` — когда нужен счётчик
- `foreach` — для массивов и коллекций
- `while` — когда неизвестно количество итераций
- `do-while` — минимум 1 выполнение

**Управление:**
- `break` — выход из цикла
- `continue` — пропустить итерацию
- `return` — выход из функции
- `exit` / `die` — остановка скрипта (не использовать!)

**Важно на собесе:**
- `match` vs `switch` (PHP 8.0)
- Guard clauses (ранний выход)
- `&$var` в foreach + обязательный `unset()`
- `declare(strict_types=1)` — всегда использовать
- Избегай `exit` / `die` в контроллерах

---

## Практические задания

### Задание 1: Guard Clauses vs Вложенные if
**Условие:** Рефакторинг вложенных if на guard clauses.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ ПЛОХО (глубокая вложенность)
function processOrder(?Order $order, ?User $user): void
{
    if ($order !== null) {
        if ($user !== null) {
            if ($user->isActive()) {
                if ($order->isPending()) {
                    if ($user->hasEnoughBalance($order->total)) {
                        // Основная логика на 5-м уровне вложенности
                        $order->process();
                        $user->deductBalance($order->total);
                    } else {
                        throw new InsufficientBalanceException();
                    }
                } else {
                    throw new InvalidOrderStatusException();
                }
            } else {
                throw new InactiveUserException();
            }
        } else {
            throw new UserNotFoundException();
        }
    } else {
        throw new OrderNotFoundException();
    }
}

// ✅ ХОРОШО (guard clauses)
function processOrderRefactored(?Order $order, ?User $user): void
{
    // Ранние выходы
    if ($order === null) {
        throw new OrderNotFoundException();
    }

    if ($user === null) {
        throw new UserNotFoundException();
    }

    if (!$user->isActive()) {
        throw new InactiveUserException();
    }

    if (!$order->isPending()) {
        throw new InvalidOrderStatusException();
    }

    if (!$user->hasEnoughBalance($order->total)) {
        throw new InsufficientBalanceException();
    }

    // Основная логика на 1-м уровне вложенности
    $order->process();
    $user->deductBalance($order->total);
}
```

**Ключевые моменты:**
- Guard clauses уменьшают вложенность
- Основная логика на верхнем уровне
- Легче читать и поддерживать
- Явные условия ошибок
</details>

### Задание 2: Цикл с break и continue
**Условие:** Обработка массива заказов с пропуском и остановкой.

<details>
<summary>Решение</summary>

```php
<?php

function processOrders(array $orders, int $maxAmount): array
{
    $processed = [];
    $totalAmount = 0;

    foreach ($orders as $order) {
        // Пропустить отменённые заказы
        if ($order['status'] === 'cancelled') {
            continue;
        }

        // Пропустить заказы с ошибками
        if (empty($order['items'])) {
            Log::warning("Order #{$order['id']} has no items");
            continue;
        }

        // Остановиться, если достигнут лимит
        if ($totalAmount + $order['total'] > $maxAmount) {
            Log::info("Reached max amount limit");
            break;
        }

        // Обработка заказа
        try {
            $this->processOrder($order);
            $processed[] = $order['id'];
            $totalAmount += $order['total'];
        } catch (ProcessException $e) {
            Log::error("Failed to process order #{$order['id']}: {$e->getMessage()}");
            continue;  // Пропустить неудачный заказ
        }
    }

    return [
        'processed' => $processed,
        'total_amount' => $totalAmount,
        'count' => count($processed),
    ];
}

// Пример использования
$orders = [
    ['id' => 1, 'status' => 'pending', 'total' => 1000, 'items' => ['A', 'B']],
    ['id' => 2, 'status' => 'cancelled', 'total' => 500, 'items' => ['C']],
    ['id' => 3, 'status' => 'pending', 'total' => 1500, 'items' => []],
    ['id' => 4, 'status' => 'pending', 'total' => 2000, 'items' => ['D']],
];

$result = processOrders($orders, 5000);
// processed: [1, 4], total_amount: 3000
```

**Ключевые моменты:**
- `continue` пропускает текущую итерацию
- `break` полностью выходит из цикла
- Подходит для batch обработки с лимитами
- Логирование ошибок без остановки всего процесса
</details>

### Задание 3: Генератор для больших данных
**Условие:** Построчное чтение большого CSV файла.

<details>
<summary>Решение</summary>

```php
<?php

// ❌ ПЛОХО (загружает весь файл в память)
function readCsvBad(string $filePath): array
{
    $data = [];
    $handle = fopen($filePath, 'r');

    while (($line = fgets($handle)) !== false) {
        $data[] = str_getcsv($line);
    }

    fclose($handle);
    return $data;  // Весь файл в памяти!
}

// ✅ ХОРОШО (генератор, экономит память)
function readCsv(string $filePath): Generator
{
    $handle = fopen($filePath, 'r');

    // Пропустить заголовок
    fgets($handle);

    while (($line = fgets($handle)) !== false) {
        $row = str_getcsv($line);

        // Пропустить пустые строки
        if (empty($row[0])) {
            continue;
        }

        yield $row;  // Возвращаем по одной строке
    }

    fclose($handle);
}

// Использование
function importUsers(string $csvPath): array
{
    $imported = [];
    $errors = [];
    $count = 0;

    foreach (readCsv($csvPath) as $index => $row) {
        try {
            [$name, $email, $age] = $row;

            // Валидация
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Row $index: Invalid email";
                continue;
            }

            // Импорт
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'age' => (int) $age,
            ]);

            $imported[] = $user->id;
            $count++;

            // Остановиться после 1000 записей
            if ($count >= 1000) {
                Log::info('Reached import limit');
                break;
            }

        } catch (\Exception $e) {
            $errors[] = "Row $index: {$e->getMessage()}";
            continue;
        }
    }

    return [
        'imported' => $imported,
        'count' => $count,
        'errors' => $errors,
    ];
}
```

**Ключевые моменты:**
- Генератор (yield) не загружает весь файл в память
- `continue` пропускает невалидные строки
- `break` ограничивает количество обработанных записей
- Подходит для импорта больших файлов
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
