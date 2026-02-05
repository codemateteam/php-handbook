# 9.1 Нормализация базы данных

> **TL;DR**
> Нормализация устраняет избыточность данных путем разделения на связанные таблицы. Основные формы: 1NF (атомарные значения), 2NF (зависимость от всего ключа), 3NF (нет транзитивных зависимостей). На практике достаточно 3NF. Преимущества: целостность, простота обновлений. Недостатки: больше JOIN'ов. Используй для OLTP, денормализуй для OLAP.

## Содержание

- [Что это](#что-это)
- [1NF (First Normal Form)](#1nf-first-normal-form)
- [2NF (Second Normal Form)](#2nf-second-normal-form)
- [3NF (Third Normal Form)](#3nf-third-normal-form)
- [BCNF (Boyce-Codd Normal Form)](#bcnf-boyce-codd-normal-form)
- [Примеры нормализации](#примеры-нормализации)
- [Аномалии без нормализации](#аномалии-без-нормализации)
- [Преимущества нормализации](#преимущества-нормализации)
- [Недостатки нормализации](#недостатки-нормализации)
- [Когда нормализовать](#когда-нормализовать)
- [Когда НЕ нормализовать (денормализация)](#когда-не-нормализовать-денормализация)
- [Laravel Migrations для normalized schema](#laravel-migrations-для-normalized-schema)
- [Best Practices](#best-practices)
- [Практические задания](#практические-задания)

## Что это

**Нормализация:**
Процесс организации данных в БД для уменьшения избыточности и улучшения целостности данных.

**Цели:**
- Устранить дублирование данных
- Обеспечить consistency
- Упростить изменение структуры
- Уменьшить anomalies (insert/update/delete)

**Нормальные формы:**
1NF → 2NF → 3NF → BCNF → 4NF → 5NF

**На практике чаще всего используется 3NF.**

---

## 1NF (First Normal Form)

**Правила:**
- Каждое поле содержит атомарное значение (не массивы, не списки)
- Нет повторяющихся групп
- Есть primary key

**❌ Не 1NF:**

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255),
    products VARCHAR(255)  -- 'Laptop, Mouse, Keyboard'
);
```

**Проблема:**
- Нельзя запросить заказы с конкретным продуктом
- Сложно добавить/удалить продукт

**✅ 1NF:**

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_name VARCHAR(255)
);
```

---

## 2NF (Second Normal Form)

**Правила:**
- Соблюдает 1NF
- Нет частичной зависимости (non-key поля зависят от ВСЕГО primary key)

**❌ Не 2NF:**

```sql
CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    customer_name VARCHAR(255),  -- зависит только от order_id!
    product_name VARCHAR(255),    -- зависит только от product_id!
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);
```

**Проблема:**
- Дублирование customer_name для каждого товара
- Изменение customer требует UPDATE всех строк

**✅ 2NF:**

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255)
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE order_items (
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);
```

---

## 3NF (Third Normal Form)

**Правила:**
- Соблюдает 2NF
- Нет транзитивной зависимости (non-key поля не зависят от других non-key полей)

**❌ Не 3NF:**

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    department_id INT,
    department_name VARCHAR(255)  -- зависит от department_id!
);
```

**Проблема:**
- Дублирование department_name
- Изменение department требует UPDATE всех сотрудников

**✅ 3NF:**

```sql
CREATE TABLE departments (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    department_id INT REFERENCES departments(id)
);
```

**Laravel Eloquent:**

```php
class Employee extends Model
{
    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}

// Использование
$employee = Employee::with('department')->find(1);
echo $employee->department->name;
```

---

## BCNF (Boyce-Codd Normal Form)

**Правила:**
- Соблюдает 3NF
- Каждый determinant (определяющий атрибут) должен быть candidate key

**Редко нарушается, на практике 3NF обычно достаточно.**

---

## Примеры нормализации

### E-commerce: До нормализации

```sql
-- ❌ Denormalized (всё в одной таблице)
CREATE TABLE orders_denormalized (
    order_id INT,
    order_date DATE,
    customer_id INT,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_address TEXT,
    product_id INT,
    product_name VARCHAR(255),
    product_price DECIMAL(10, 2),
    category_name VARCHAR(255),
    quantity INT,
    total DECIMAL(10, 2)
);
```

**Проблемы:**
- Дублирование customer data для каждого товара в заказе
- Дублирование product data для каждого заказа
- Изменение email клиента требует UPDATE тысяч строк
- Insert anomaly: нельзя добавить продукт без заказа
- Delete anomaly: удаление последнего заказа удалит информацию о клиенте

---

### E-commerce: После нормализации (3NF)

```sql
-- ✅ Normalized (3NF)
CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    address TEXT
);

CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10, 2),
    category_id INT REFERENCES categories(id)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    created_at TIMESTAMP,
    total DECIMAL(10, 2)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT,
    price DECIMAL(10, 2)  -- цена на момент заказа
);
```

**Laravel Models:**

```php
class Customer extends Model
{
    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}

class Order extends Model
{
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}

class OrderItem extends Model
{
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

class Product extends Model
{
    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
```

---

## Аномалии без нормализации

### 1. Insert Anomaly

```sql
-- ❌ Нельзя добавить продукт без заказа
INSERT INTO orders_denormalized (product_name, product_price)
VALUES ('New Product', 99.99);
-- ERROR: order_id cannot be NULL
```

**Решение: отдельная таблица products**

```sql
-- ✅ Можем добавить продукт без заказа
INSERT INTO products (name, price) VALUES ('New Product', 99.99);
```

---

### 2. Update Anomaly

```sql
-- ❌ Изменить email клиента = UPDATE всех его заказов
UPDATE orders_denormalized
SET customer_email = 'newemail@example.com'
WHERE customer_id = 123;
-- Может быть тысячи строк!
```

**Решение: отдельная таблица customers**

```sql
-- ✅ UPDATE одной строки
UPDATE customers
SET email = 'newemail@example.com'
WHERE id = 123;
```

---

### 3. Delete Anomaly

```sql
-- ❌ Удаление последнего заказа клиента удалит всю информацию о клиенте
DELETE FROM orders_denormalized
WHERE order_id = 999;
-- Потеряли customer_name, customer_email, customer_address!
```

**Решение: отдельная таблица customers**

```sql
-- ✅ Клиент остаётся после удаления заказа
DELETE FROM orders WHERE id = 999;
-- Customer всё ещё в таблице customers
```

---

## Преимущества нормализации

```
✅ Нет дублирования данных (меньше места)
✅ Consistency (один источник правды)
✅ Проще UPDATE (изменение в одном месте)
✅ Нет anomalies (insert/update/delete)
✅ Гибкость (проще добавлять новые поля/таблицы)
✅ Referential integrity (foreign keys)
```

---

## Недостатки нормализации

```
❌ Больше JOIN'ов (медленнее SELECT)
❌ Сложнее запросы
❌ Больше таблиц (сложнее понимать схему)
```

**Решение: денормализация для performance-critical запросов** (см. следующую тему).

---

## Когда нормализовать

```
✓ OLTP (транзакционные системы): INSERT/UPDATE часто
✓ E-commerce, CRM, ERP
✓ Данные часто изменяются
✓ Нужна strong consistency
```

---

## Когда НЕ нормализовать (денормализация)

```
✓ OLAP (аналитика): SELECT часто, INSERT редко
✓ Reporting, dashboards
✓ Read-heavy workload
✓ Performance критична
✓ Data Warehouses
```

---

## Laravel Migrations для normalized schema

```php
// Migration: customers
Schema::create('customers', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->text('address')->nullable();
    $table->timestamps();
});

// Migration: orders
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id')->constrained()->onDelete('cascade');
    $table->decimal('total', 10, 2);
    $table->timestamps();
});

// Migration: products
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->decimal('price', 10, 2);
    $table->foreignId('category_id')->constrained();
    $table->timestamps();
});

// Migration: order_items
Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->onDelete('cascade');
    $table->foreignId('product_id')->constrained();
    $table->integer('quantity');
    $table->decimal('price', 10, 2);  // цена на момент заказа
    $table->timestamps();
});
```

---

## Best Practices

```
✓ Стремись к 3NF для транзакционных систем
✓ BCNF, 4NF, 5NF редко нужны на практике
✓ Используй foreign keys для referential integrity
✓ Индексы на foreign keys для быстрых JOIN'ов
✓ Денормализация допустима для performance
✓ Используй Laravel relationships вместо ручных JOIN'ов
✓ Migrations для версионирования схемы
```

---

## Практические задания

### Задание 1: Привести таблицу к 1NF

Дана денормализованная таблица:

```sql
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255),
    phone_numbers VARCHAR(255),  -- '555-1234, 555-5678'
    products VARCHAR(500)         -- 'Laptop, Mouse, Keyboard'
);
```

Приведите её к 1NF.

<details>
<summary>Решение</summary>

```sql
-- Таблица заказов
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_name VARCHAR(255)
);

-- Таблица телефонов
CREATE TABLE customer_phones (
    id INT PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    phone_number VARCHAR(20)
);

-- Таблица товаров в заказе
CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_name VARCHAR(255)
);

-- Laravel Eloquent
class Order extends Model
{
    public function phones()
    {
        return $this->hasMany(CustomerPhone::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
```

**Объяснение:** 1NF требует атомарные значения. Разбили CSV-списки на отдельные строки в связанных таблицах.
</details>

---

### Задание 2: Привести таблицу к 3NF

Дана таблица:

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    department_id INT,
    department_name VARCHAR(255),
    department_location VARCHAR(255)
);
```

Приведите её к 3NF.

<details>
<summary>Решение</summary>

```sql
-- Таблица отделов
CREATE TABLE departments (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    location VARCHAR(255)
);

-- Таблица сотрудников
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    department_id INT REFERENCES departments(id)
);

-- Laravel Models
class Department extends Model
{
    protected $fillable = ['name', 'location'];

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }
}

class Employee extends Model
{
    protected $fillable = ['name', 'department_id'];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}

// Использование
$employee = Employee::with('department')->find(1);
echo $employee->department->name;
echo $employee->department->location;
```

**Объяснение:** 3NF устраняет транзитивные зависимости. `department_name` и `department_location` зависят от `department_id`, а не от `employee.id` напрямую. Выносим в отдельную таблицу.
</details>

---

### Задание 3: Найти аномалии

Имеется таблица:

```sql
CREATE TABLE student_courses (
    student_id INT,
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    course_id INT,
    course_name VARCHAR(255),
    instructor_name VARCHAR(255),
    grade CHAR(2),
    PRIMARY KEY (student_id, course_id)
);
```

Какие аномалии возможны? Как исправить?

<details>
<summary>Решение</summary>

**Аномалии:**

1. **Insert Anomaly:** Нельзя добавить курс без студента
2. **Update Anomaly:** Изменение email студента требует UPDATE всех его курсов
3. **Delete Anomaly:** Удаление последней записи студента удаляет информацию о студенте

**Решение: нормализация до 3NF**

```sql
CREATE TABLE students (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE
);

CREATE TABLE courses (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    instructor_name VARCHAR(255)
);

CREATE TABLE enrollments (
    student_id INT REFERENCES students(id),
    course_id INT REFERENCES courses(id),
    grade CHAR(2),
    PRIMARY KEY (student_id, course_id)
);
```

**Laravel Models:**

```php
class Student extends Model
{
    public function courses()
    {
        return $this->belongsToMany(Course::class, 'enrollments')
            ->withPivot('grade');
    }
}

class Course extends Model
{
    public function students()
    {
        return $this->belongsToMany(Student::class, 'enrollments')
            ->withPivot('grade');
    }
}

// Использование
$student = Student::with('courses')->find(1);
foreach ($student->courses as $course) {
    echo $course->name . ': ' . $course->pivot->grade;
}
```

**Преимущества:**
- Можно добавить курс без студентов
- Изменение email в одном месте
- Удаление enrollment не удаляет студента/курс
</details>

---

## На собеседовании скажешь

> "Нормализация — организация данных для уменьшения избыточности. Нормальные формы: 1NF (атомарные значения, нет массивов), 2NF (нет частичной зависимости от составного ключа), 3NF (нет транзитивной зависимости). На практике чаще всего 3NF. Преимущества: нет дублирования, consistency, проще UPDATE, нет anomalies (insert/update/delete). Недостатки: больше JOIN'ов, медленнее SELECT. Нормализация для OLTP (транзакции), денормализация для OLAP (аналитика). Laravel: relationships вместо JOIN'ов, foreign keys в migrations."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
