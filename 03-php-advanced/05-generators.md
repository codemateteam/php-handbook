# 3.5 Генераторы (Generators)

## Краткое резюме

> **Генераторы** — функции с `yield`, возвращающие итератор без загрузки всех данных в память.
>
> **Основное:** `yield` вместо `return`, `yield from` для делегирования, методы: send(), getReturn().
>
> **Laravel:** `Eloquent::cursor()` использует генераторы для экономии памяти.

---

## Содержание

- [Что такое генератор](#что-такое-генератор)
- [yield ключевое слово](#yield-ключевое-слово)
- [Generator методы](#generator-методы)
- [yield from (PHP 7.0+)](#yield-from-php-70)
- [Генераторы vs массивы](#генераторы-vs-массивы)
- [Резюме генераторов](#резюме-генераторов)
- [Практические задания](#практические-задания)

---

## Что такое генератор

**Что это:**
Функция, которая возвращает итератор через `yield` вместо `return`. Не загружает все данные в память сразу.

**Как работает:**
```php
// Обычная функция (загружает всё в память)
function getNumbers(): array
{
    $result = [];
    for ($i = 1; $i <= 1000000; $i++) {
        $result[] = $i;
    }
    return $result;  // 1M чисел в памяти
}

$numbers = getNumbers();  // Займёт много памяти

// Генератор (по одному элементу)
function getNumbersGenerator(): Generator
{
    for ($i = 1; $i <= 1000000; $i++) {
        yield $i;  // Возвращает по одному
    }
}

foreach (getNumbersGenerator() as $number) {
    echo $number;  // Обрабатываем по одному (экономия памяти)
}

// Генератор возвращает объект Generator
$gen = getNumbersGenerator();
var_dump($gen);  // object(Generator)
```

**Когда использовать:**
Для больших выборок из БД, файлов, API (экономия памяти).

**Пример из практики:**
```php
// Обработка большого CSV файла
function readCsv(string $filePath): Generator
{
    $handle = fopen($filePath, 'r');

    try {
        while (($line = fgets($handle)) !== false) {
            yield str_getcsv($line);  // По одной строке
        }
    } finally {
        fclose($handle);
    }
}

// Обработка (не загружает весь файл)
foreach (readCsv('large-file.csv') as $row) {
    // Обработать строку
    processRow($row);
}

// Eloquent cursor() использует генераторы
foreach (User::cursor() as $user) {
    // Загружает по одному пользователю из БД
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
            yield $item;  // Отдаём по одному элементу
        }

        $page++;
    } while (!empty($data));
}

foreach (fetchAllPages('/api/products') as $product) {
    // Обработка по одному
}
```

**На собеседовании скажешь:**
> "Генератор возвращает итератор через yield. Не загружает всё в память, отдаёт по одному элементу. Экономия памяти для больших выборок. Eloquent::cursor() использует генераторы."

---

## yield ключевое слово

**Что это:**
Возвращает значение и приостанавливает выполнение функции.

**Как работает:**
```php
function simpleGenerator(): Generator
{
    echo "Start\n";
    yield 1;
    echo "After first yield\n";
    yield 2;
    echo "After second yield\n";
    yield 3;
    echo "End\n";
}

foreach (simpleGenerator() as $value) {
    echo "Value: {$value}\n";
}

// Вывод:
// Start
// Value: 1
// After first yield
// Value: 2
// After second yield
// Value: 3
// End

// yield с ключом
function getKeyValue(): Generator
{
    yield 'name' => 'Иван';
    yield 'age' => 25;
    yield 'email' => 'ivan@mail.com';
}

foreach (getKeyValue() as $key => $value) {
    echo "{$key}: {$value}\n";
}
// name: Иван
// age: 25
// email: ivan@mail.com
```

**Когда использовать:**
Для ленивого вычисления, бесконечных последовательностей.

**Пример из практики:**
```php
// Генерация ID
function generateIds(): Generator
{
    $id = 1;
    while (true) {
        yield $id++;
    }
}

$idGenerator = generateIds();
echo $idGenerator->current();  // 1
$idGenerator->next();
echo $idGenerator->current();  // 2

// Fibonacci sequence
function fibonacci(): Generator
{
    $a = 0;
    $b = 1;

    while (true) {
        yield $a;
        [$a, $b] = [$b, $a + $b];
    }
}

$fib = fibonacci();
for ($i = 0; $i < 10; $i++) {
    echo $fib->current() . " ";
    $fib->next();
}
// 0 1 1 2 3 5 8 13 21 34

// Построчное чтение лога
function tailLog(string $filePath): Generator
{
    $handle = fopen($filePath, 'r');

    // Перейти в конец
    fseek($handle, 0, SEEK_END);

    while (true) {
        $line = fgets($handle);

        if ($line !== false) {
            yield $line;
        } else {
            usleep(100000);  // 100ms задержка
        }
    }
}

foreach (tailLog('/var/log/app.log') as $line) {
    echo $line;  // Выводит новые строки по мере появления
}
```

**На собеседовании скажешь:**
> "yield возвращает значение и приостанавливает функцию. Продолжает с того же места при следующей итерации. yield key => value для ассоциативных данных. Бесконечные генераторы для последовательностей."

---

## Generator методы

**Что это:**
Методы объекта Generator для управления итерацией.

**Как работает:**
```php
function simpleGenerator(): Generator
{
    yield 1;
    yield 2;
    yield 3;
}

$gen = simpleGenerator();

// current() — текущее значение
echo $gen->current();  // 1

// next() — перейти к следующему
$gen->next();
echo $gen->current();  // 2

// key() — текущий ключ
echo $gen->key();  // 1

// valid() — есть ли ещё элементы
var_dump($gen->valid());  // true

// rewind() — перезапустить (работает только для некоторых генераторов)
$gen->rewind();
echo $gen->current();  // 1

// send() — отправить значение в генератор
function echoGenerator(): Generator
{
    while (true) {
        $value = yield;  // Получить значение
        echo "Received: {$value}\n";
    }
}

$gen = echoGenerator();
$gen->send(null);  // Первый вызов с null
$gen->send('Hello');  // Received: Hello
$gen->send('World');  // Received: World

// getReturn() — получить return значение (PHP 7.0+)
function generatorWithReturn(): Generator
{
    yield 1;
    yield 2;
    return 'Done';
}

$gen = generatorWithReturn();
foreach ($gen as $value) {
    echo $value;  // 1, 2
}
echo $gen->getReturn();  // "Done"
```

**Когда использовать:**
Для управления генераторами, двусторонней связи.

**Пример из практики:**
```php
// Обработка с контролем
function processItems(array $items): Generator
{
    foreach ($items as $item) {
        $result = yield $item;  // Получить результат обработки

        if ($result === 'skip') {
            continue;
        }

        if ($result === 'stop') {
            return 'Stopped';
        }
    }

    return 'Completed';
}

$gen = processItems([1, 2, 3, 4, 5]);
$gen->send(null);  // Первый вызов

foreach ($gen as $item) {
    if ($item === 3) {
        $gen->send('skip');  // Пропустить 3
    } elseif ($item === 5) {
        $gen->send('stop');  // Остановить на 5
        break;
    } else {
        $gen->send('continue');
    }
}

echo $gen->getReturn();  // "Stopped"

// Пауза и возобновление
class Batch Processor
{
    private Generator $generator;

    public function start(array $items): void
    {
        $this->generator = $this->processItems($items);
        $this->generator->rewind();
    }

    public function processNext(): bool
    {
        if (!$this->generator->valid()) {
            return false;
        }

        $item = $this->generator->current();
        $this->process($item);
        $this->generator->next();

        return $this->generator->valid();
    }

    private function processItems(array $items): Generator
    {
        foreach ($items as $item) {
            yield $item;
        }
    }

    private function process($item): void
    {
        // Обработка элемента
    }
}

// Использование
$processor = new BatchProcessor();
$processor->start($items);

while ($processor->processNext()) {
    // Обработать один элемент
    // Можно прервать и продолжить потом
}
```

**На собеседовании скажешь:**
> "Generator методы: current(), next(), key(), valid(), send(), getReturn(). send() отправляет значение в генератор (двусторонняя связь). getReturn() получает return значение после завершения."

---

## yield from (PHP 7.0+)

**Что это:**
Делегирование другому генератору или массиву.

**Как работает:**
```php
// Без yield from
function numbers(): Generator
{
    yield 1;
    yield 2;
    yield 3;
}

function letters(): Generator
{
    yield 'a';
    yield 'b';
    yield 'c';
}

function combined(): Generator
{
    foreach (numbers() as $number) {
        yield $number;
    }

    foreach (letters() as $letter) {
        yield $letter;
    }
}

// С yield from (короче)
function combined(): Generator
{
    yield from numbers();
    yield from letters();
}

foreach (combined() as $value) {
    echo $value;  // 1, 2, 3, a, b, c
}

// yield from с массивом
function generator(): Generator
{
    yield from [1, 2, 3];
    yield 4;
    yield from range(5, 7);
}

foreach (generator() as $value) {
    echo $value;  // 1, 2, 3, 4, 5, 6, 7
}
```

**Когда использовать:**
Для композиции генераторов, делегирования.

**Пример из практики:**
```php
// Рекурсивный обход директории
function scanDirectory(string $dir): Generator
{
    $items = scandir($dir);

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $item;

        if (is_file($path)) {
            yield $path;
        } elseif (is_dir($path)) {
            yield from scanDirectory($path);  // Рекурсия
        }
    }
}

foreach (scanDirectory('/app') as $file) {
    echo $file . "\n";
}

// Объединение данных из разных источников
function fetchUsersFromDb(): Generator
{
    foreach (User::cursor() as $user) {
        yield $user;
    }
}

function fetchUsersFromApi(): Generator
{
    $response = Http::get('/api/users');

    foreach ($response->json() as $userData) {
        yield User::make($userData);
    }
}

function getAllUsers(): Generator
{
    yield from fetchUsersFromDb();
    yield from fetchUsersFromApi();
}

foreach (getAllUsers() as $user) {
    // Обработка пользователей из БД и API
}

// Chunk processing
function processInChunks(array $items, int $chunkSize): Generator
{
    $chunks = array_chunk($items, $chunkSize);

    foreach ($chunks as $chunk) {
        yield from $this->processChunk($chunk);
    }
}

function processChunk(array $chunk): Generator
{
    foreach ($chunk as $item) {
        yield $this->process($item);
    }
}
```

**На собеседовании скажешь:**
> "yield from делегирует другому генератору или массиву. Короче, чем foreach + yield. Использую для композиции генераторов, рекурсивного обхода, объединения источников данных."

---

## Генераторы vs массивы

**Сравнение:**

| Массив | Генератор |
|--------|-----------|
| Всё в памяти | По одному элементу |
| return массив | yield элемент |
| Быстрый доступ по индексу | Только последовательный |
| Можно многократно итерировать | Итерируется один раз* |
| array_map, array_filter | Только foreach |

**Когда использовать генератор:**
- Большие данные (БД, файлы)
- Бесконечные последовательности
- Ленивое вычисление

**Когда использовать массив:**
- Маленькие данные
- Нужен быстрый доступ
- Нужна многократная итерация

**Пример из практики:**
```php
// ПЛОХО: весь результат в памяти
function getAllUsers(): array
{
    return User::all()->toArray();  // 100k+ записей в памяти
}

$users = getAllUsers();
foreach ($users as $user) {
    processUser($user);
}

// ХОРОШО: генератор (экономия памяти)
function getAllUsers(): Generator
{
    foreach (User::cursor() as $user) {
        yield $user;  // По одному
    }
}

foreach (getAllUsers() as $user) {
    processUser($user);
}

// Когда нужен массив
$numbers = [1, 2, 3, 4, 5];  // Маленький массив — OK

// Можно несколько раз итерировать
foreach ($numbers as $n) { /* ... */ }
foreach ($numbers as $n) { /* ... */ }  // ✅ OK

// Генератор нельзя
$gen = getNumbers();
foreach ($gen as $n) { /* ... */ }
foreach ($gen as $n) { /* ... */ }  // ❌ Пустой (уже итерировали)

// Если нужно многократно — создать заново
foreach (getNumbers() as $n) { /* ... */ }
foreach (getNumbers() as $n) { /* ... */ }  // ✅ OK (новый генератор)

// Или преобразовать в массив (но теряем экономию памяти)
$gen = getNumbers();
$array = iterator_to_array($gen);
foreach ($array as $n) { /* ... */ }
foreach ($array as $n) { /* ... */ }  // ✅ OK
```

**На собеседовании скажешь:**
> "Генераторы экономят память (по одному элементу), массивы — всё сразу. Генераторы для больших данных, массивы для маленьких. Генератор итерируется один раз (нужно создавать заново). iterator_to_array() преобразует в массив."

---

## Резюме генераторов

**Основное:**
- `yield` возвращает значение и приостанавливает функцию
- Генератор не загружает всё в память (по одному элементу)
- `yield key => value` для ассоциативных данных
- Методы: current(), next(), key(), valid(), send(), getReturn()
- `yield from` делегирует другому генератору
- `Generator` объект (возвращается из функции с yield)

**Генератор vs массив:**
- Генератор — экономия памяти, последовательный доступ
- Массив — всё в памяти, быстрый доступ по индексу

**Важно на собесе:**
- Eloquent::cursor() использует генераторы
- Генераторы итерируются один раз (создавать заново для повтора)
- yield from для композиции генераторов
- send() для двусторонней связи
- Бесконечные генераторы (while true + yield)
- Экономия памяти для больших файлов, БД, API

---

## Практические задания

### Задание 1: Создай генератор для обработки большого CSV

Напиши генератор, который читает большой CSV файл построчно и возвращает обработанные данные.

<details>
<summary>Решение</summary>

```php
<?php

function readCsvGenerator(string $filePath, bool $hasHeader = true): Generator
{
    if (!file_exists($filePath)) {
        throw new \RuntimeException("File {$filePath} not found");
    }

    $handle = fopen($filePath, 'r');

    if ($handle === false) {
        throw new \RuntimeException("Cannot open file {$filePath}");
    }

    try {
        $headers = null;

        if ($hasHeader) {
            $headers = fgetcsv($handle);
        }

        $lineNumber = $hasHeader ? 1 : 0;

        while (($row = fgetcsv($handle)) !== false) {
            $lineNumber++;

            if ($headers) {
                // Создать ассоциативный массив
                if (count($row) !== count($headers)) {
                    throw new \RuntimeException("Invalid row at line {$lineNumber}");
                }

                yield $lineNumber => array_combine($headers, $row);
            } else {
                yield $lineNumber => $row;
            }
        }
    } finally {
        fclose($handle);
    }
}

// Использование
// users.csv:
// name,email,age
// Иван,ivan@mail.com,25
// Пётр,petr@mail.com,30

foreach (readCsvGenerator('users.csv') as $lineNumber => $user) {
    echo "Line {$lineNumber}: {$user['name']} ({$user['email']})\n";

    // Обработка по одной строке (не загружаем весь файл в память)
    User::create($user);
}

// Или с фильтрацией
function processCsvWithFilter(string $filePath): Generator
{
    foreach (readCsvGenerator($filePath) as $lineNumber => $row) {
        // Фильтрация: только взрослые
        if (isset($row['age']) && (int) $row['age'] >= 18) {
            yield $lineNumber => $row;
        }
    }
}

foreach (processCsvWithFilter('users.csv') as $lineNumber => $user) {
    echo "Adult user: {$user['name']}\n";
}

// Laravel Command для импорта
class ImportUsersCommand extends Command
{
    public function handle(): void
    {
        $file = $this->argument('file');

        $this->output->progressStart();

        foreach (readCsvGenerator($file) as $lineNumber => $userData) {
            try {
                User::create($userData);
                $this->output->progressAdvance();
            } catch (\Exception $e) {
                $this->error("Error at line {$lineNumber}: {$e->getMessage()}");
            }
        }

        $this->output->progressFinish();
        $this->info('Import completed');
    }
}
```
</details>

### Задание 2: Реализуй пагинацию API через генератор

Создай генератор для получения всех страниц API (автоматическая пагинация).

<details>
<summary>Решение</summary>

```php
<?php

use Illuminate\Support\Facades\Http;

function fetchAllPagesGenerator(string $url, array $queryParams = []): Generator
{
    $page = 1;
    $perPage = 100;

    do {
        $response = Http::get($url, [
            ...$queryParams,
            'page' => $page,
            'per_page' => $perPage,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException("API request failed: {$response->status()}");
        }

        $data = $response->json();
        $items = $data['data'] ?? $data;

        if (empty($items)) {
            break;
        }

        foreach ($items as $item) {
            yield $item;  // Отдаём по одному элементу
        }

        $page++;

        // Проверка на последнюю страницу
        $hasMore = isset($data['meta']['current_page']) && isset($data['meta']['last_page'])
            ? $data['meta']['current_page'] < $data['meta']['last_page']
            : !empty($items);

    } while ($hasMore);
}

// Использование
foreach (fetchAllPagesGenerator('https://api.example.com/users') as $user) {
    // Обработка по одному пользователю
    // Не нужно загружать все страницы сразу
    echo "Processing user: {$user['name']}\n";

    LocalUser::updateOrCreate(
        ['external_id' => $user['id']],
        ['name' => $user['name'], 'email' => $user['email']]
    );
}

// С фильтрацией
function fetchActiveUsersGenerator(string $url): Generator
{
    foreach (fetchAllPagesGenerator($url) as $user) {
        if ($user['is_active'] ?? false) {
            yield $user;
        }
    }
}

// Laravel Job для синхронизации
class SyncUsersFromApiJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function handle(): void
    {
        $count = 0;

        foreach (fetchAllPagesGenerator('https://api.example.com/users') as $userData) {
            User::updateOrCreate(
                ['external_id' => $userData['id']],
                [
                    'name' => $userData['name'],
                    'email' => $userData['email'],
                ]
            );

            $count++;

            // Чтобы не перегружать память, делаем паузу каждые 1000 записей
            if ($count % 1000 === 0) {
                sleep(1);
            }
        }

        Log::info("Synced {$count} users from API");
    }
}
```
</details>

### Задание 3: Создай генератор для обхода дерева категорий

Реализуй рекурсивный генератор для обхода дерева категорий (вложенные структуры).

<details>
<summary>Решение</summary>

```php
<?php

// Model
class Category extends Model
{
    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }
}

// Генератор для обхода дерева (depth-first)
function traverseCategoryTreeGenerator(Category $category, int $depth = 0): Generator
{
    // Отдаём текущую категорию
    yield ['category' => $category, 'depth' => $depth];

    // Рекурсивно обходим детей
    foreach ($category->children as $child) {
        yield from traverseCategoryTreeGenerator($child, $depth + 1);
    }
}

// Использование
$rootCategory = Category::with('children.children.children')->find(1);

foreach (traverseCategoryTreeGenerator($rootCategory) as $item) {
    $indent = str_repeat('  ', $item['depth']);
    echo "{$indent}- {$item['category']->name}\n";
}

// Вывод:
// - Electronics
//   - Phones
//     - iPhone
//     - Samsung
//   - Laptops
//     - MacBook
//     - Dell

// Генератор с фильтрацией (только активные)
function traverseActiveCategoriesGenerator(Category $category, int $depth = 0): Generator
{
    if (!$category->is_active) {
        return;  // Пропускаем неактивные
    }

    yield ['category' => $category, 'depth' => $depth];

    foreach ($category->children as $child) {
        yield from traverseActiveCategoriesGenerator($child, $depth + 1);
    }
}

// Собрать все ID категорий в плоский массив
function getAllCategoryIds(Category $category): array
{
    $ids = [];

    foreach (traverseCategoryTreeGenerator($category) as $item) {
        $ids[] = $item['category']->id;
    }

    return $ids;
}

// Использование для удаления со всеми детьми
$category = Category::find(1);
$ids = getAllCategoryIds($category);
Category::whereIn('id', $ids)->delete();

// Генератор breadcrumbs (путь к категории)
function getCategoryPathGenerator(Category $category): Generator
{
    $current = $category;

    while ($current !== null) {
        yield $current;
        $current = $current->parent;
    }
}

// Breadcrumbs
$category = Category::find(5);
$path = iterator_to_array(getCategoryPathGenerator($category));
$breadcrumbs = array_reverse($path);

foreach ($breadcrumbs as $item) {
    echo "{$item->name} > ";
}
// Electronics > Phones > iPhone >
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
