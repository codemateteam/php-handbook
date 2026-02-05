# 6.3 Индексы

## Краткое резюме

> **Индекс** — структура данных, ускоряющая поиск в таблице как оглавление в книге.
>
> **Типы:** PRIMARY KEY (уникальный, не NULL), UNIQUE (уникальные значения), INDEX (обычный), COMPOSITE (несколько столбцов).
>
> **Важно:** Индексы ускоряют SELECT, но замедляют INSERT/UPDATE/DELETE. Composite index (A, B) работает для WHERE A, но не для WHERE B.

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
Индекс — структура данных, ускоряющая поиск в таблице. Аналог оглавления в книге.

**Типы индексов:**
- PRIMARY KEY — первичный ключ (уникальный, не NULL)
- UNIQUE — уникальные значения
- INDEX — обычный индекс
- FULLTEXT — полнотекстовый поиск
- COMPOSITE — составной (несколько столбцов)

---

## Как работает

**Создание индексов:**

```sql
-- PRIMARY KEY (автоматически при создании таблицы)
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL
);

-- UNIQUE индекс
CREATE UNIQUE INDEX idx_users_email ON users(email);
ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email);

-- Обычный INDEX
CREATE INDEX idx_users_status ON users(status);
ALTER TABLE users ADD INDEX idx_users_status (status);

-- COMPOSITE индекс (несколько столбцов)
CREATE INDEX idx_users_status_created ON users(status, created_at);

-- FULLTEXT (для поиска по тексту)
CREATE FULLTEXT INDEX idx_posts_title_body ON posts(title, body);

-- Удаление индекса
DROP INDEX idx_users_status ON users;
ALTER TABLE users DROP INDEX idx_users_status;
```

**В Laravel миграциях:**

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();  // PRIMARY KEY
    $table->string('email')->unique();  // UNIQUE INDEX
    $table->string('status')->index();  // INDEX
    $table->string('first_name');
    $table->string('last_name');
    $table->timestamps();

    // Composite index
    $table->index(['status', 'created_at']);

    // Именованный индекс
    $table->index('email', 'idx_users_email');

    // Полнотекстовый
    $table->fullText(['title', 'body']);
});

// Добавить индекс к существующей таблице
Schema::table('users', function (Blueprint $table) {
    $table->index('status');
});

// Удалить индекс
Schema::table('users', function (Blueprint $table) {
    $table->dropIndex(['status']);
    $table->dropIndex('idx_users_email');  // По имени
});
```

---

## Когда использовать

**Плюсы индексов:**
- ✅ Ускоряют SELECT (WHERE, ORDER BY, JOIN)
- ✅ Ускоряют UNIQUE проверки
- ✅ Ускоряют MIN/MAX

**Минусы индексов:**
- ❌ Замедляют INSERT/UPDATE/DELETE
- ❌ Занимают место на диске
- ❌ Требуют обслуживания

**Когда создавать:**
- Частые WHERE условия
- JOIN столбцы
- ORDER BY столбцы
- Foreign keys

**Когда НЕ создавать:**
- Маленькие таблицы (< 1000 строк)
- Столбцы с малой селективностью (например, boolean)
- Редко используемые столбцы
- Частые INSERT/UPDATE

---

## Пример из практики

**Оптимизация запросов индексами:**

```sql
-- ❌ Медленно (без индекса)
SELECT * FROM users WHERE email = 'john@example.com';
-- Сканирует всю таблицу (Full Table Scan)

-- ✅ Быстро (с индексом на email)
CREATE UNIQUE INDEX idx_users_email ON users(email);
SELECT * FROM users WHERE email = 'john@example.com';
-- Использует индекс (Index Seek)

-- ❌ Медленно (без составного индекса)
SELECT * FROM orders
WHERE status = 'completed'
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 100;

-- ✅ Быстро (с составным индексом)
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
-- Индекс покрывает WHERE, ORDER BY, фильтрацию
```

**Composite Index (порядок важен):**

```sql
-- Индекс (status, created_at)
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- ✅ Использует индекс (начинается с status)
SELECT * FROM orders WHERE status = 'completed';
SELECT * FROM orders WHERE status = 'completed' AND created_at > '2024-01-01';

-- ❌ НЕ использует индекс (не начинается с status)
SELECT * FROM orders WHERE created_at > '2024-01-01';

-- Правило: порядок столбцов в индексе важен
-- Индекс (A, B, C) работает для:
-- - WHERE A
-- - WHERE A AND B
-- - WHERE A AND B AND C
-- НЕ работает для:
-- - WHERE B
-- - WHERE C
-- - WHERE B AND C
```

**EXPLAIN (анализ запроса):**

```sql
-- Проверить, использует ли индекс
EXPLAIN SELECT * FROM users WHERE email = 'john@example.com';

-- Результат:
-- type: const (лучший) — по PRIMARY KEY или UNIQUE
-- type: ref — по индексу
-- type: range — диапазон (BETWEEN, >, <)
-- type: index — сканирование индекса
-- type: ALL — полное сканирование таблицы (ПЛОХО)

-- key: имя используемого индекса
-- rows: примерное количество проверяемых строк

-- В Laravel
DB::connection()->enableQueryLog();
User::where('email', 'john@example.com')->get();
dd(DB::getQueryLog());
```

**Covering Index (покрывающий индекс):**

```sql
-- Запрос выбирает только email и status
SELECT email, status FROM users WHERE status = 'active';

-- Создать индекс, включающий все нужные столбцы
CREATE INDEX idx_users_status_email ON users(status, email);

-- Теперь MySQL может получить все данные из индекса
-- без обращения к таблице (Index-Only Scan)
```

**Foreign Key индексы:**

```php
// Laravel автоматически создаёт индекс для foreign key
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained();  // Создаёт INDEX на user_id
    $table->timestamps();
});

// Эквивалентно:
$table->unsignedBigInteger('user_id')->index();
$table->foreign('user_id')->references('id')->on('users');
```

**Fulltext поиск:**

```php
// Миграция
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->string('title');
    $table->text('body');
    $table->timestamps();

    // Полнотекстовый индекс
    $table->fullText(['title', 'body']);
});

// Поиск
$posts = Post::whereFullText(['title', 'body'], 'search query')->get();

// SQL
SELECT * FROM posts
WHERE MATCH(title, body) AGAINST('search query' IN NATURAL LANGUAGE MODE);
```

**Когда индексы НЕ используются:**

```sql
-- Функции в WHERE (индекс не используется)
-- ❌ ПЛОХО
SELECT * FROM users WHERE YEAR(created_at) = 2024;

-- ✅ ХОРОШО (индекс используется)
SELECT * FROM users
WHERE created_at >= '2024-01-01'
  AND created_at < '2025-01-01';

-- OR условия (может не использовать индекс)
-- ❌ ПЛОХО
SELECT * FROM users WHERE status = 'active' OR age > 18;

-- ✅ ХОРОШО (UNION)
SELECT * FROM users WHERE status = 'active'
UNION
SELECT * FROM users WHERE age > 18;

-- LIKE с % в начале (индекс не используется)
-- ❌ ПЛОХО
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- ✅ ХОРОШО (FULLTEXT или поиск справа)
SELECT * FROM users WHERE email LIKE 'john%';
```

**Мониторинг и обслуживание:**

```sql
-- Показать индексы таблицы
SHOW INDEXES FROM users;

-- Неиспользуемые индексы (MySQL 8.0+)
SELECT * FROM sys.schema_unused_indexes;

-- Дублирующиеся индексы
SELECT * FROM sys.schema_redundant_indexes;

-- Оптимизировать таблицу
OPTIMIZE TABLE users;

-- Перестроить индекс
ALTER TABLE users DROP INDEX idx_users_status, ADD INDEX idx_users_status (status);
```

---

## На собеседовании скажешь

> "Индекс ускоряет поиск как оглавление в книге. PRIMARY KEY уникальный и не NULL, UNIQUE для уникальных значений, INDEX обычный. Composite index (A, B) работает для WHERE A или WHERE A AND B, но не WHERE B. EXPLAIN показывает plan запроса, type: const/ref/range (хорошо), ALL (плохо). Индексы замедляют INSERT/UPDATE, занимают место. Foreign keys автоматически индексируются. Fulltext для текстового поиска. Covering index содержит все нужные столбцы."

---

## Практические задания

### Задание 1: Оптимизируй запрос индексами

У тебя медленный запрос. Какие индексы нужно создать?

```sql
SELECT * FROM orders
WHERE status = 'pending'
  AND user_id = 123
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

<details>
<summary>Решение</summary>

```sql
-- Оптимальный составной индекс (порядок важен!)
CREATE INDEX idx_orders_user_status_created
ON orders(user_id, status, created_at);

-- Почему в таком порядке?
-- 1. user_id - самая селективная колонка (= условие)
-- 2. status - второе условие (=)
-- 3. created_at - используется в ORDER BY

-- Этот индекс покроет:
-- - WHERE user_id = 123 (первая колонка)
-- - WHERE user_id = 123 AND status = 'pending' (первые две)
-- - WHERE user_id = 123 AND status = 'pending' AND created_at > X (все три)
-- - ORDER BY created_at (последняя колонка уже в индексе)

-- В миграции Laravel
Schema::table('orders', function (Blueprint $table) {
    $table->index(['user_id', 'status', 'created_at'], 'idx_orders_user_status_created');
});

-- Проверить использование индекса
EXPLAIN SELECT * FROM orders
WHERE status = 'pending'
  AND user_id = 123
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 20;

-- Должно показать:
-- type: ref или range
-- key: idx_orders_user_status_created
-- Extra: Using index condition (хорошо)
```
</details>

### Задание 2: Найди проблемы с индексами

Что не так с этими индексами?

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);

CREATE INDEX idx_posts_created ON posts(created_at);
CREATE INDEX idx_posts_status_created ON posts(status, created_at);
```

<details>
<summary>Решение</summary>

```sql
-- Проблема 1: Дублирующиеся индексы на email
-- UNIQUE индекс уже работает как обычный INDEX
-- Решение: удалить idx_users_email
DROP INDEX idx_users_email ON users;
-- Оставить только UNIQUE

-- Проблема 2: Избыточный индекс на created_at
-- Индекс (status, created_at) уже покрывает запросы с created_at
-- если они используют status
-- Индекс idx_posts_created нужен только если есть запросы
-- WHERE created_at без status

-- Анализ:
-- Если есть запрос: WHERE created_at > '2024-01-01'
--   -> Нужен idx_posts_created

-- Если только: WHERE status = 'published' AND created_at > '2024-01-01'
--   -> Достаточно idx_posts_status_created
--   -> Можно удалить idx_posts_created

-- В Laravel миграции
Schema::table('users', function (Blueprint $table) {
    // Правильно: один UNIQUE индекс
    $table->string('email')->unique();
});

Schema::table('posts', function (Blueprint $table) {
    // Составной индекс для частого запроса
    $table->index(['status', 'created_at']);

    // Отдельный индекс только если нужен
    // $table->index('created_at'); // Только если есть запросы без status
});

-- Проверить дубликаты индексов
SELECT * FROM sys.schema_redundant_indexes;
```
</details>

### Задание 3: Когда индекс НЕ используется?

Почему эти запросы не используют индекс на email?

```sql
-- Индекс существует
CREATE INDEX idx_users_email ON users(email);

-- Запрос 1
SELECT * FROM users WHERE LOWER(email) = 'john@example.com';

-- Запрос 2
SELECT * FROM users WHERE email LIKE '%@gmail.com';
```

<details>
<summary>Решение</summary>

```sql
-- Запрос 1: Функция в WHERE
-- ❌ Проблема: LOWER(email) - функция на колонке
-- MySQL не может использовать индекс, т.к. нужно вычислить функцию для каждой строки

-- ✅ Решение 1: Убрать функцию (если данные в одном регистре)
SELECT * FROM users WHERE email = 'john@example.com';

-- ✅ Решение 2: Функциональный индекс (MySQL 8.0+)
CREATE INDEX idx_users_email_lower ON users((LOWER(email)));
-- Теперь запрос будет использовать индекс

-- ✅ Решение 3: Хранить normalized версию (Laravel)
Schema::table('users', function (Blueprint $table) {
    $table->string('email_normalized')->virtualAs('LOWER(email)');
    $table->index('email_normalized');
});

-- Запрос 2: LIKE с % в начале
-- ❌ Проблема: '%@gmail.com' - поиск с конца строки
-- Индекс работает как книга: можно быстро найти слова на "A",
-- но нельзя быстро найти слова заканчивающиеся на "A"

-- ✅ Решение 1: LIKE без % в начале
SELECT * FROM users WHERE email LIKE 'john%';  -- Использует индекс

-- ✅ Решение 2: FULLTEXT индекс
CREATE FULLTEXT INDEX idx_users_email_fulltext ON users(email);
SELECT * FROM users
WHERE MATCH(email) AGAINST('@gmail.com' IN BOOLEAN MODE);

-- ✅ Решение 3: Реверсивный индекс (для поиска по окончанию)
Schema::table('users', function (Blueprint $table) {
    $table->string('email_reversed')->virtualAs('REVERSE(email)');
    $table->index('email_reversed');
});

SELECT * FROM users
WHERE email_reversed LIKE REVERSE('%@gmail.com');

-- В Laravel
// ❌ Плохо
User::whereRaw('LOWER(email) = ?', ['john@example.com'])->get();

// ✅ Хорошо
User::where('email', 'john@example.com')->get();
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
