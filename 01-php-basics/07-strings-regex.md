# 1.7 Строки и регулярные выражения

> **TL;DR**
> Для кириллицы используй mb_* функции (mb_strlen, mb_substr, mb_strtolower). strpos() возвращает 0 (falsy), проверяй !== false. PHP 8.0 добавил str_contains, str_starts_with, str_ends_with. Для email используй filter_var, не regex. preg_match ищет первое совпадение, preg_match_all — все. В Laravel есть Str helper и валидация regex.

## Содержание

- [Работа со строками](#работа-со-строками)
- [substr, mb_substr, str_replace](#substr-mb_substr-str_replace)
- [explode, implode, str_split](#explode-implode-str_split)
- [strpos, str_contains, str_starts_with (PHP 8.0+)](#strpos-str_contains-str_starts_with-php-80)
- [Регулярные выражения: preg_match, preg_replace](#регулярные-выражения-preg_match-preg_replace)
- [Основные паттерны регулярных выражений](#основные-паттерны-регулярных-выражений)
- [Популярные регулярки](#популярные-регулярки)
- [Резюме строк и регулярных выражений](#резюме-строк-и-регулярных-выражений)
- [Практические задания](#практические-задания)

---

## Работа со строками

**Что это:**
Функции для манипуляции текстом.

**Как работает:**
```php
$str = 'Hello, World!';

// strlen — длина строки (байты, НЕ символы!)
echo strlen($str);  // 13

// mb_strlen — длина в символах (Unicode)
$russian = 'Привет';
echo strlen($russian);     // 12 (байты UTF-8)
echo mb_strlen($russian);  // 6 (символы)

// strtolower / strtoupper — регистр
echo strtolower($str);  // "hello, world!"
echo strtoupper($str);  // "HELLO, WORLD!"

// mb_* для Unicode
$text = 'ПРИВЕТ';
echo strtolower($text);     // "ПРИВЕТ" (не работает!)
echo mb_strtolower($text);  // "привет" ✅

// ucfirst / ucwords — первая буква в верхнем регистре
echo ucfirst('hello');   // "Hello"
echo ucwords('hello world');  // "Hello World"

// trim — удаление пробелов с краёв
$input = '  hello  ';
echo trim($input);   // "hello"
echo ltrim($input);  // "hello  " (только слева)
echo rtrim($input);  // "  hello" (только справа)
```

**Когда использовать:**
Для обработки пользовательского ввода, форматирования текста.

**Пример из практики:**
```php
// Валидация и очистка ввода
$email = trim($request->input('email'));
$email = strtolower($email);

// Форматирование имени
$name = ucwords(mb_strtolower($request->input('name')));

// Подготовка для БД
$search = trim($request->input('search'));
$search = preg_replace('/\s+/', ' ', $search);  // Убрать лишние пробелы

// Laravel Request
$validated = $request->validate([
    'email' => 'required|email|max:255',
]);
```

**На собеседовании скажешь:**
> "strlen возвращает байты, mb_strlen — символы (для Unicode). Для кириллицы всегда использую mb_* функции (mb_strlen, mb_strtolower, mb_substr). trim удаляет пробелы с краёв."

---

## substr, mb_substr, str_replace

**Как работает:**
```php
$str = 'Hello, World!';

// substr — извлечение подстроки
echo substr($str, 0, 5);   // "Hello"
echo substr($str, 7);      // "World!"
echo substr($str, -6);     // "World!" (с конца)
echo substr($str, 0, -7);  // "Hello" (до -7 с конца)

// mb_substr для Unicode
$text = 'Привет, мир!';
echo substr($text, 0, 6);     // "Пр" (обрежет по байтам!)
echo mb_substr($text, 0, 6);  // "Привет" ✅

// str_replace — замена подстроки
echo str_replace('World', 'PHP', $str);  // "Hello, PHP!"

// Множественная замена
$text = 'Hello, World! Hello, PHP!';
echo str_replace('Hello', 'Hi', $text);  // "Hi, World! Hi, PHP!"

// Массив замен
$text = str_replace(['Hello', 'World'], ['Hi', 'PHP'], $text);
// "Hi, PHP! Hi, PHP!"

// str_ireplace — без учёта регистра
echo str_ireplace('hello', 'Hi', $text);  // "Hi, World!"
```

**Когда использовать:**
Для извлечения частей строки, замены текста.

**Пример из практики:**
```php
// Обрезка описания
$description = 'Очень длинное описание товара...';
$short = mb_substr($description, 0, 100) . '...';

// Замена плейсхолдеров в шаблоне
$template = 'Привет, {name}! Ваш заказ #{order_id} готов.';
$message = str_replace(
    ['{name}', '{order_id}'],
    [$user->name, $order->id],
    $template
);

// Очистка номера телефона
$phone = '+7 (999) 123-45-67';
$clean = str_replace(['+', ' ', '(', ')', '-'], '', $phone);
// "79991234567"

// Laravel Str helper
use Illuminate\Support\Str;

$short = Str::limit($description, 100);
$slug = Str::slug('Название статьи');  // "nazvanie-stati"
```

**На собеседовании скажешь:**
> "substr извлекает подстроку (по байтам), mb_substr — по символам. str_replace заменяет подстроки (можно массив). Для Unicode использую mb_substr. В Laravel есть Str helper с полезными методами."

---

## explode, implode, str_split

**Как работает:**
```php
// explode — разбить строку в массив
$csv = 'apple,banana,orange';
$fruits = explode(',', $csv);  // ['apple', 'banana', 'orange']

// Ограничение количества элементов
$text = 'one:two:three:four';
$parts = explode(':', $text, 2);  // ['one', 'two:three:four']

// implode (join) — объединить массив в строку
$fruits = ['apple', 'banana', 'orange'];
$csv = implode(',', $fruits);  // "apple,banana,orange"

// str_split — разбить на символы
$str = 'hello';
$chars = str_split($str);  // ['h', 'e', 'l', 'l', 'o']

// Разбить по N символов
$chunks = str_split($str, 2);  // ['he', 'll', 'o']

// mb_str_split для Unicode (PHP 7.4+)
$text = 'Привет';
$chars = mb_str_split($text);  // ['П', 'р', 'и', 'в', 'е', 'т']
```

**Когда использовать:**
Для парсинга CSV, объединения массивов, разбиения строк.

**Пример из практики:**
```php
// Парсинг тегов
$tagString = 'php, laravel, mysql';
$tags = explode(',', $tagString);
$tags = array_map('trim', $tags);  // ['php', 'laravel', 'mysql']

// Генерация CSV
$users = User::all();
$csv = "name,email,age\n";

foreach ($users as $user) {
    $csv .= implode(',', [$user->name, $user->email, $user->age]) . "\n";
}

// Laravel Collection
$tagString = $post->tags->pluck('name')->implode(', ');

// URL segments
$url = '/api/v1/users/123';
$segments = explode('/', trim($url, '/'));  // ['api', 'v1', 'users', '123']

// Laravel
$segments = request()->segments();  // ['api', 'v1', 'users', '123']
```

**На собеседовании скажешь:**
> "explode разбивает строку в массив по разделителю. implode (join) объединяет массив в строку. str_split разбивает на символы (по байтам), mb_str_split — по символам Unicode."

---

## strpos, str_contains, str_starts_with (PHP 8.0+)

**Как работает:**
```php
$str = 'Hello, World!';

// strpos — позиция подстроки (или false)
$pos = strpos($str, 'World');  // 7
$pos = strpos($str, 'PHP');    // false

// Проверка наличия (НЕ используй == для проверки!)
if (strpos($str, 'Hello') !== false) {
    echo 'Найдено';
}

// ⚠️ Частая ошибка
if (strpos($str, 'Hello')) {  // ❌ Вернёт 0 (falsy!)
    echo 'Никогда не выполнится';
}

// PHP 8.0: str_contains (удобнее)
if (str_contains($str, 'World')) {
    echo 'Найдено';
}

// str_starts_with (PHP 8.0+)
if (str_starts_with($str, 'Hello')) {
    echo 'Начинается с Hello';
}

// str_ends_with (PHP 8.0+)
if (str_ends_with($str, '!')) {
    echo 'Заканчивается на !';
}

// stripos — без учёта регистра
$pos = stripos($str, 'hello');  // 0
```

**Когда использовать:**
Для проверки наличия подстроки, валидации, парсинга.

**Пример из практики:**
```php
// Проверка расширения файла
$filename = 'document.pdf';

// PHP < 8.0
if (strpos($filename, '.pdf') !== false) {
    // ...
}

// PHP 8.0+
if (str_ends_with($filename, '.pdf')) {
    // Это PDF
}

// Проверка URL
$url = 'https://example.com/api/users';

if (str_starts_with($url, 'https://')) {
    // Безопасное соединение
}

// Фильтрация по префиксу
$routes = ['admin/users', 'admin/posts', 'api/users'];
$adminRoutes = array_filter($routes, fn($r) => str_starts_with($r, 'admin/'));

// Laravel Str helper
use Illuminate\Support\Str;

if (Str::startsWith($url, 'https://')) {
    // ...
}

if (Str::endsWith($filename, '.pdf')) {
    // ...
}

if (Str::contains($email, '@gmail.com')) {
    // ...
}
```

**На собеседовании скажешь:**
> "strpos возвращает позицию или false (проверять !== false, не ==). PHP 8.0 добавил str_contains, str_starts_with, str_ends_with — удобнее для проверок. В Laravel есть Str::startsWith, Str::endsWith, Str::contains."

---

## Регулярные выражения: preg_match, preg_replace

**Что это:**
Паттерны для поиска и замены в строках.

**Как работает:**
```php
$text = 'Мой email: test@mail.com';

// preg_match — поиск первого совпадения
if (preg_match('/\w+@\w+\.\w+/', $text, $matches)) {
    echo $matches[0];  // "test@mail.com"
}

// Группы захвата
$text = 'Дата: 2024-01-15';
if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $text, $matches)) {
    $year = $matches[1];   // "2024"
    $month = $matches[2];  // "01"
    $day = $matches[3];    // "15"
}

// Именованные группы
if (preg_match('/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/', $text, $matches)) {
    $year = $matches['year'];
}

// preg_match_all — все совпадения
$text = 'Email: test@mail.com, admin@site.com';
preg_match_all('/\w+@\w+\.\w+/', $text, $matches);
var_dump($matches[0]);  // ["test@mail.com", "admin@site.com"]

// preg_replace — замена по паттерну
$text = 'Цена: 1000 рублей';
$text = preg_replace('/\d+/', '2000', $text);  // "Цена: 2000 рублей"

// С группами захвата
$text = '2024-01-15';
$text = preg_replace('/(\d{4})-(\d{2})-(\d{2})/', '$3.$2.$1', $text);
// "15.01.2024"
```

**Когда использовать:**
Для валидации email, телефонов, URL, парсинга сложных форматов.

**Пример из практики:**
```php
// Валидация email
if (preg_match('/^[\w\.\-]+@[\w\.\-]+\.\w+$/', $email)) {
    // Email валидный
}

// Лучше использовать filter_var
if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
    // Email валидный
}

// Парсинг номера телефона
$phone = '+7 (999) 123-45-67';
if (preg_match('/\+7 \((\d{3})\) (\d{3})-(\d{2})-(\d{2})/', $phone, $matches)) {
    $code = $matches[1];  // "999"
    $number = $matches[2] . $matches[3] . $matches[4];  // "1234567"
}

// Очистка HTML тегов
$text = '<p>Hello <b>World</b></p>';
$clean = preg_replace('/<[^>]*>/', '', $text);  // "Hello World"

// Лучше strip_tags
$clean = strip_tags($text);

// Laravel Validation (использует regex)
$validated = $request->validate([
    'phone' => 'required|regex:/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/',
]);
```

**На собеседовании скажешь:**
> "preg_match ищет первое совпадение, preg_match_all — все. preg_replace заменяет по паттерну. Использую для валидации сложных форматов (телефоны, даты). Для email лучше filter_var, для HTML — strip_tags."

---

## Основные паттерны регулярных выражений

**Что это:**
Синтаксис для описания шаблонов.

**Как работает:**
```php
// Базовые метасимволы
// . — любой символ (кроме \n)
// \d — цифра [0-9]
// \w — буква, цифра, _ [a-zA-Z0-9_]
// \s — пробельный символ (space, tab, newline)
// \D, \W, \S — отрицание

// Квантификаторы
// * — 0 или больше
// + — 1 или больше
// ? — 0 или 1
// {n} — ровно n
// {n,} — n или больше
// {n,m} — от n до m

// Примеры
preg_match('/\d+/', 'abc123');        // true (одна или больше цифр)
preg_match('/\d{4}/', '2024');        // true (ровно 4 цифры)
preg_match('/\w{3,10}/', 'hello');    // true (3-10 букв/цифр)

// Якоря
// ^ — начало строки
// $ — конец строки
preg_match('/^\d{4}$/', '2024');      // true (ТОЛЬКО 4 цифры)
preg_match('/^\d{4}$/', '2024abc');   // false

// Классы символов
// [abc] — a, b или c
// [a-z] — любая строчная буква
// [^abc] — НЕ a, b, c

preg_match('/[0-9]+/', 'abc123');     // true
preg_match('/[a-z]+/', 'Hello');      // true ("ello")
preg_match('/[^0-9]+/', 'abc123');    // true ("abc")

// Группы и альтернативы
// (abc) — группа
// a|b — a ИЛИ b

preg_match('/(http|https):\/\//', 'https://example.com');  // true
```

**Когда использовать:**
Для валидации форматов, парсинга, очистки данных.

**Пример из практики:**
```php
// Валидация логина (буквы, цифры, _, 3-20 символов)
if (preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    // OK
}

// Валидация пароля (минимум 8 символов, буква + цифра)
if (preg_match('/^(?=.*[A-Za-z])(?=.*\d).{8,}$/', $password)) {
    // OK
}

// Извлечение хештегов
$text = 'Привет #php #laravel #coding';
preg_match_all('/#(\w+)/', $text, $matches);
$hashtags = $matches[1];  // ["php", "laravel", "coding"]

// Замена URL на ссылки
$text = 'Сайт: https://example.com';
$text = preg_replace(
    '/(https?:\/\/[^\s]+)/',
    '<a href="$1">$1</a>',
    $text
);
// "Сайт: <a href="https://example.com">https://example.com</a>"

// Laravel Validation
$validated = $request->validate([
    'username' => 'required|regex:/^[a-zA-Z0-9_]{3,20}$/',
    'password' => 'required|min:8|regex:/^(?=.*[A-Za-z])(?=.*\d)/',
]);
```

**На собеседовании скажешь:**
> "Регулярные выражения: метасимволы (\d, \w, \s), квантификаторы (+, *, ?), якоря (^, $), классы ([a-z]). Использую для валидации сложных форматов. В Laravel есть валидация regex для форм."

---

## Популярные регулярки

**Что это:**
Готовые паттерны для частых задач.

```php
// Email
$email = '/^[\w\.\-]+@[\w\.\-]+\.\w+$/';
// Лучше: filter_var($email, FILTER_VALIDATE_EMAIL)

// Телефон (РФ)
$phone = '/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/';
// +7 (999) 123-45-67

// URL
$url = '/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/';

// IP адрес
$ip = '/^(\d{1,3}\.){3}\d{1,3}$/';
// Не валидирует диапазон (0-255)

// Дата (YYYY-MM-DD)
$date = '/^\d{4}-\d{2}-\d{2}$/';

// Время (HH:MM)
$time = '/^([01]\d|2[0-3]):([0-5]\d)$/';

// Пароль (минимум 8 символов, буква + цифра + спецсимвол)
$password = '/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/';

// Слаг (URL-friendly)
$slug = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

// Хештег
$hashtag = '/#[a-zA-Z0-9_]+/';

// Mention (@username)
$mention = '/@[a-zA-Z0-9_]+/';
```

**Пример из практики:**
```php
// Валидация формы
class RegistrationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'username' => [
                'required',
                'regex:/^[a-zA-Z0-9_]{3,20}$/',
                'unique:users',
            ],
            'email' => 'required|email|unique:users',
            'password' => [
                'required',
                'min:8',
                'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])/',
            ],
            'phone' => 'required|regex:/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/',
        ];
    }
}

// Извлечение упоминаний
$text = '@ivan написал @petr привет';
preg_match_all('/@(\w+)/', $text, $matches);
$mentions = $matches[1];  // ["ivan", "petr"]

// Автоматическая замена URL
function linkify(string $text): string
{
    return preg_replace(
        '/(https?:\/\/[^\s]+)/',
        '<a href="$1" target="_blank">$1</a>',
        $text
    );
}
```

**На собеседовании скажешь:**
> "Для частых задач (email, URL, телефон) использую готовые паттерны или встроенные функции (filter_var для email). В Laravel валидация regex для сложных форматов. Извлекаю @mentions и #hashtags через preg_match_all."

---

## Резюме строк и регулярных выражений

**Строки:**
- `strlen` (байты) vs `mb_strlen` (символы)
- `mb_*` функции для Unicode (mb_strtolower, mb_substr)
- `trim` — удаление пробелов
- `substr`, `str_replace` — извлечение и замена
- `explode` / `implode` — разбиение и объединение
- `strpos` (PHP < 8.0) vs `str_contains`, `str_starts_with` (PHP 8.0+)

**Регулярные выражения:**
- `preg_match` — поиск первого совпадения
- `preg_match_all` — все совпадения
- `preg_replace` — замена по паттерну
- Метасимволы: `\d`, `\w`, `\s`, `.`
- Квантификаторы: `+`, `*`, `?`, `{n,m}`
- Якоря: `^`, `$`
- Классы: `[a-z]`, `[^0-9]`

**Важно на собесе:**
- Для кириллицы используй `mb_*` функции
- `strpos()` возвращает `0` (falsy!), проверяй `!== false`
- PHP 8.0: `str_contains`, `str_starts_with`, `str_ends_with`
- Для email используй `filter_var`, не regex
- В Laravel есть `Str` helper и валидация `regex`

---

## Практические задания

### Задание 1: Проблема с strpos
**Условие:** Найди и исправь ошибку в проверке подстроки.

<details>
<summary>Решение</summary>

```php
<?php

$url = 'https://example.com/api/users';

// ❌ НЕПРАВИЛЬНО
if (strpos($url, 'https')) {
    echo 'Secure connection';
} else {
    echo 'Insecure connection';
}
// Выведет: "Insecure connection" ❌
// strpos вернул 0 (позицию), а 0 = falsy!

// ✅ ПРАВИЛЬНО (строгая проверка)
if (strpos($url, 'https') !== false) {
    echo 'Secure connection';
}

// ✅ PHP 8.0+ (str_contains)
if (str_contains($url, 'https')) {
    echo 'Secure connection';
}

// ✅ PHP 8.0+ (str_starts_with)
if (str_starts_with($url, 'https://')) {
    echo 'Secure connection';
}

// Практический пример
function validateImageExtension(string $filename): bool
{
    $allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    // ❌ НЕПРАВИЛЬНО
    foreach ($allowedExtensions as $ext) {
        if (strpos($filename, $ext)) {  // Проблема с файлом "0.jpg"
            return true;
        }
    }

    // ✅ ПРАВИЛЬНО (PHP < 8.0)
    foreach ($allowedExtensions as $ext) {
        if (strpos($filename, $ext) !== false) {
            return true;
        }
    }

    // ✅ ПРАВИЛЬНО (PHP 8.0+)
    foreach ($allowedExtensions as $ext) {
        if (str_ends_with($filename, $ext)) {
            return true;
        }
    }

    // ✅ ЕЩЁ ЛУЧШЕ (Laravel)
    return Str::endsWith($filename, $allowedExtensions);
}

// Laravel Validation
$request->validate([
    'avatar' => 'required|image|mimes:jpg,jpeg,png,gif,webp',
]);
```

**Ключевые моменты:**
- `strpos()` возвращает `0` при совпадении с началом строки
- `0` — falsy значение, проверка `if (strpos(...))` не работает
- Всегда используй `!== false`
- PHP 8.0: `str_contains`, `str_starts_with`, `str_ends_with` безопаснее
</details>

### Задание 2: mb_* функции для кириллицы
**Условие:** Обрежь русский текст до 100 символов корректно.

<details>
<summary>Решение</summary>

```php
<?php

$text = 'Очень длинное описание товара на русском языке с кириллическими символами';

// ❌ НЕПРАВИЛЬНО (обрезает по байтам)
$short = substr($text, 0, 50);
echo $short;  // "Очень длинное описание товара на р" (обрезано некорректно)
echo strlen($short);  // 50 байт, но меньше 50 символов

// ✅ ПРАВИЛЬНО (обрезает по символам)
$short = mb_substr($text, 0, 50);
echo $short;  // "Очень длинное описание товара на русском языке с к"
echo mb_strlen($short);  // 50 символов

// Функция для обрезки с многоточием
function truncate(string $text, int $length, string $suffix = '...'): string
{
    if (mb_strlen($text) <= $length) {
        return $text;
    }

    $truncated = mb_substr($text, 0, $length);

    // Обрезать до последнего пробела
    $lastSpace = mb_strrpos($truncated, ' ');
    if ($lastSpace !== false) {
        $truncated = mb_substr($truncated, 0, $lastSpace);
    }

    return $truncated . $suffix;
}

echo truncate($text, 30);
// "Очень длинное описание..."

// Laravel Str helper
use Illuminate\Support\Str;

echo Str::limit($text, 30);  // "Очень длинное описание товара..."
echo Str::words($text, 5);   // "Очень длинное описание товара на..."

// Сравнение с учётом регистра (кириллица)
$search = 'ТОВАР';
$text = 'Описание товара';

// ❌ НЕПРАВИЛЬНО
var_dump(stripos($text, $search));  // false (не работает для кириллицы)

// ✅ ПРАВИЛЬНО
var_dump(mb_stripos($text, $search));  // 9 (позиция)

// Или через strtolower
$textLower = mb_strtolower($text);
$searchLower = mb_strtolower($search);
var_dump(strpos($textLower, $searchLower));  // 9
```

**Ключевые моменты:**
- `strlen()` возвращает байты, `mb_strlen()` — символы
- UTF-8: русская буква = 2 байта
- Всегда используй `mb_*` для кириллицы
- Laravel `Str` helper использует `mb_*` под капотом
</details>

### Задание 3: Валидация и очистка пользовательского ввода
**Условие:** Создай функцию для валидации и очистки данных формы.

<details>
<summary>Решение</summary>

```php
<?php

class InputSanitizer
{
    /**
     * Очистка и валидация email
     */
    public function sanitizeEmail(string $email): ?string
    {
        // Очистка пробелов и приведение к нижнему регистру
        $email = trim($email);
        $email = mb_strtolower($email);

        // Валидация
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $email;
        }

        return null;
    }

    /**
     * Очистка имени
     */
    public function sanitizeName(string $name): string
    {
        // Убрать лишние пробелы
        $name = trim($name);
        $name = preg_replace('/\s+/', ' ', $name);

        // Первая буква заглавная для каждого слова
        return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Очистка телефона
     */
    public function sanitizePhone(string $phone): ?string
    {
        // Убрать всё кроме цифр и +
        $phone = preg_replace('/[^\d+]/', '', $phone);

        // Валидация формата
        if (preg_match('/^\+7\d{10}$/', $phone)) {
            return $phone;
        }

        return null;
    }

    /**
     * Очистка URL slug
     */
    public function sanitizeSlug(string $slug): string
    {
        // Транслитерация кириллицы
        $slug = $this->transliterate($slug);

        // Нижний регистр
        $slug = mb_strtolower($slug);

        // Заменить всё кроме букв, цифр и дефиса
        $slug = preg_replace('/[^a-z0-9-]+/', '-', $slug);

        // Убрать повторяющиеся дефисы
        $slug = preg_replace('/-+/', '-', $slug);

        // Убрать дефисы с краёв
        return trim($slug, '-');
    }

    private function transliterate(string $text): string
    {
        $transliteration = [
            'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
            'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
            'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
            'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
            'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch',
            'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
            'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        ];

        return strtr(mb_strtolower($text), $transliteration);
    }
}

// Использование
$sanitizer = new InputSanitizer();

// Email
$email = $sanitizer->sanitizeEmail('  JoHn@Example.COM  ');
// "john@example.com"

// Имя
$name = $sanitizer->sanitizeName('  иван   иванов  ');
// "Иван Иванов"

// Телефон
$phone = $sanitizer->sanitizePhone('+7 (999) 123-45-67');
// "+79991234567"

// Slug
$slug = $sanitizer->sanitizeSlug('Название статьи на русском!');
// "nazvanie-stati-na-russkom"

// Laravel (встроенные валидаторы)
$request->validate([
    'email' => 'required|email|max:255',
    'name' => 'required|string|max:100',
    'phone' => 'required|regex:/^\+7\d{10}$/',
]);

// Laravel Str helper
use Illuminate\Support\Str;

$slug = Str::slug('Название статьи');  // "nazvanie-stati"
$name = Str::title('иван иванов');     // "Иван Иванов"
```

**Ключевые моменты:**
- Всегда очищай пользовательский ввод (trim, регистр)
- Используй `filter_var` для валидации email
- Регулярные выражения для сложных форматов (телефон)
- Laravel имеет встроенные валидаторы
- `Str::slug()` автоматически транслитерирует кириллицу
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
