# 3.6 Рефлексия (Reflection API)

## Краткое резюме

> **Reflection API** — анализ и модификация структуры классов, методов, свойств во время выполнения.
>
> **Основное:** ReflectionClass, ReflectionMethod, ReflectionProperty, setAccessible(true).
>
> **Laravel:** Container использует Reflection для DI, Eloquent для моделей, Attributes (PHP 8.0+).

---

## Содержание

- [Что такое Reflection](#что-такое-reflection)
- [ReflectionClass](#reflectionclass)
- [ReflectionProperty](#reflectionproperty)
- [ReflectionMethod](#reflectionmethod)
- [ReflectionParameter](#reflectionparameter)
- [Атрибуты (Attributes, PHP 8.0+)](#атрибуты-attributes-php-80)
- [Резюме Reflection API](#резюме-reflection-api)
- [Практические задания](#практические-задания)

---

## Что такое Reflection

**Что это:**
API для анализа и модификации структуры классов, методов, свойств во время выполнения.

**Как работает:**
```php
class User
{
    private string $name;
    protected int $age;
    public bool $isActive;

    public function __construct(string $name, int $age)
    {
        $this->name = $name;
        $this->age = $age;
        $this->isActive = true;
    }

    public function getName(): string
    {
        return $this->name;
    }

    protected function getAge(): int
    {
        return $this->age;
    }
}

// Рефлексия класса
$reflection = new ReflectionClass(User::class);

// Информация о классе
echo $reflection->getName();  // "User"
echo $reflection->getShortName();  // "User" (без namespace)
var_dump($reflection->isAbstract());  // false
var_dump($reflection->isFinal());  // false

// Свойства
$properties = $reflection->getProperties();
foreach ($properties as $property) {
    echo $property->getName() . " (" . $property->getType() . ")\n";
}
// name (string)
// age (int)
// isActive (bool)

// Методы
$methods = $reflection->getMethods();
foreach ($methods as $method) {
    echo $method->getName() . "\n";
}
// __construct
// getName
// getAge
```

**Когда использовать:**
Для метапрограммирования, фреймворков, DI контейнеров, ORM.

**Пример из практики:**
```php
// Laravel Service Container (упрощённо)
class Container
{
    public function make(string $class): object
    {
        $reflection = new ReflectionClass($class);

        // Получить конструктор
        $constructor = $reflection->getConstructor();

        if ($constructor === null) {
            return new $class();  // Нет конструктора
        }

        // Получить параметры конструктора
        $parameters = $constructor->getParameters();
        $dependencies = [];

        foreach ($parameters as $parameter) {
            $type = $parameter->getType();

            if ($type && !$type->isBuiltin()) {
                // Рекурсивно разрешить зависимость
                $dependencies[] = $this->make($type->getName());
            }
        }

        // Создать объект с зависимостями
        return $reflection->newInstanceArgs($dependencies);
    }
}

// Использование
$container = new Container();
$service = $container->make(UserService::class);
// Автоматически разрешит все зависимости
```

**На собеседовании скажешь:**
> "Reflection API анализирует структуру классов во время выполнения. Получаю информацию о свойствах, методах, параметрах. Laravel Container использует Reflection для автоматического разрешения зависимостей."

---

## ReflectionClass

**Что это:**
Класс для анализа класса.

**Как работает:**
```php
$reflection = new ReflectionClass(User::class);

// Информация о классе
echo $reflection->getName();  // "App\Models\User"
echo $reflection->getShortName();  // "User"
echo $reflection->getNamespaceName();  // "App\Models"
echo $reflection->getFileName();  // "/path/to/User.php"

// Проверки
var_dump($reflection->isAbstract());  // false
var_dump($reflection->isFinal());  // false
var_dump($reflection->isInterface());  // false
var_dump($reflection->isTrait());  // false
var_dump($reflection->isInstantiable());  // true (можно создать объект)

// Родительский класс
$parent = $reflection->getParentClass();  // ReflectionClass или false

// Интерфейсы
$interfaces = $reflection->getInterfaces();  // ReflectionClass[]

// Трейты
$traits = $reflection->getTraits();  // ReflectionClass[]

// Константы класса
$constants = $reflection->getConstants();  // ['STATUS_ACTIVE' => 'active', ...]

// Создание объекта
$user = $reflection->newInstance('Иван', 25);
// Или с массивом аргументов
$user = $reflection->newInstanceArgs(['Иван', 25]);

// Без вызова конструктора
$user = $reflection->newInstanceWithoutConstructor();
```

**Когда использовать:**
Для анализа структуры класса, создания объектов, DI.

**Пример из практики:**
```php
// Анализ Eloquent модели
$reflection = new ReflectionClass(User::class);

// Проверить, является ли Model
$isModel = $reflection->isSubclassOf(Model::class);

// Получить таблицу (если есть protected $table)
$table = $reflection->hasProperty('table')
    ? $reflection->getProperty('table')->getValue(new User())
    : Str::snake(Str::pluralStudly($reflection->getShortName()));

// Фабрика объектов
class ObjectFactory
{
    public function create(string $class, array $data): object
    {
        $reflection = new ReflectionClass($class);

        if (!$reflection->isInstantiable()) {
            throw new \Exception("Cannot instantiate {$class}");
        }

        $constructor = $reflection->getConstructor();

        if ($constructor === null) {
            return new $class();
        }

        $parameters = $constructor->getParameters();
        $arguments = [];

        foreach ($parameters as $parameter) {
            $name = $parameter->getName();
            $arguments[] = $data[$name] ?? $parameter->getDefaultValue();
        }

        return $reflection->newInstanceArgs($arguments);
    }
}

$factory = new ObjectFactory();
$user = $factory->create(User::class, ['name' => 'Иван', 'age' => 25]);
```

**На собеседовании скажешь:**
> "ReflectionClass анализирует класс. Методы: getName(), getProperties(), getMethods(), getInterfaces(), getTraits(). Создание объектов: newInstance(), newInstanceArgs(). Laravel использует для анализа моделей, DI."

---

## ReflectionProperty

**Что это:**
Класс для анализа свойства класса.

**Как работает:**
```php
class User
{
    private string $name;
    protected int $age;
    public bool $isActive = true;
}

$reflection = new ReflectionClass(User::class);

// Получить свойство
$property = $reflection->getProperty('name');

// Информация о свойстве
echo $property->getName();  // "name"
echo $property->getType();  // "string"
var_dump($property->isPrivate());  // true
var_dump($property->isProtected());  // false
var_dump($property->isPublic());  // false
var_dump($property->isStatic());  // false

// Доступ к private/protected
$user = new User('Иван', 25);

// Без рефлексии
// echo $user->name;  // ❌ Error (private)

// С рефлексией
$property = new ReflectionProperty(User::class, 'name');
$property->setAccessible(true);  // Разрешить доступ
echo $property->getValue($user);  // "Иван"

$property->setValue($user, 'Пётр');
echo $property->getValue($user);  // "Пётр"

// Получить все свойства
$properties = $reflection->getProperties();

foreach ($properties as $property) {
    $property->setAccessible(true);

    echo "{$property->getName()}: ";
    echo $property->getValue($user) . "\n";
}
```

**Когда использовать:**
Для доступа к private свойствам (тестирование, сериализация, ORM).

**Пример из практики:**
```php
// Eloquent toArray() (упрощённо)
class Model
{
    public function toArray(): array
    {
        $reflection = new ReflectionClass($this);
        $result = [];

        foreach ($reflection->getProperties() as $property) {
            if ($property->isStatic()) {
                continue;
            }

            $property->setAccessible(true);
            $result[$property->getName()] = $property->getValue($this);
        }

        return $result;
    }
}

// Unit тестирование private свойств
class UserTest extends TestCase
{
    public function test_name_is_set(): void
    {
        $user = new User('Иван', 25);

        $property = new ReflectionProperty(User::class, 'name');
        $property->setAccessible(true);

        $this->assertEquals('Иван', $property->getValue($user));
    }
}

// Serializer
class Serializer
{
    public function serialize(object $object): array
    {
        $reflection = new ReflectionClass($object);
        $data = [];

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);
            $data[$property->getName()] = $property->getValue($object);
        }

        return $data;
    }
}
```

**На собеседовании скажешь:**
> "ReflectionProperty анализирует свойство. setAccessible(true) для доступа к private/protected. Методы: getValue(), setValue(), getName(), getType(). Использую в тестах, ORM, serialization."

---

## ReflectionMethod

**Что это:**
Класс для анализа метода класса.

**Как работает:**
```php
class User
{
    private string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function getName(): string
    {
        return $this->name;
    }

    protected function setName(string $name): void
    {
        $this->name = $name;
    }

    private function validateName(string $name): bool
    {
        return strlen($name) > 0;
    }
}

$reflection = new ReflectionClass(User::class);

// Получить метод
$method = $reflection->getMethod('getName');

// Информация о методе
echo $method->getName();  // "getName"
echo $method->getReturnType();  // "string"
var_dump($method->isPublic());  // true
var_dump($method->isProtected());  // false
var_dump($method->isPrivate());  // false
var_dump($method->isStatic());  // false
var_dump($method->isAbstract());  // false
var_dump($method->isFinal());  // false

// Вызов protected/private метода
$user = new User('Иван');

$method = new ReflectionMethod(User::class, 'setName');
$method->setAccessible(true);
$method->invoke($user, 'Пётр');  // Вызвать метод

echo $user->getName();  // "Пётр"

// Параметры метода
$parameters = $method->getParameters();
foreach ($parameters as $parameter) {
    echo $parameter->getName() . ": " . $parameter->getType() . "\n";
}
// name: string
```

**Когда использовать:**
Для вызова private методов (тестирование), анализа API.

**Пример из практики:**
```php
// Unit тестирование private методов
class UserTest extends TestCase
{
    public function test_name_validation(): void
    {
        $user = new User('Иван');

        $method = new ReflectionMethod(User::class, 'validateName');
        $method->setAccessible(true);

        $this->assertTrue($method->invoke($user, 'Valid'));
        $this->assertFalse($method->invoke($user, ''));
    }
}

// API анализатор
class ApiAnalyzer
{
    public function analyzeController(string $controller): array
    {
        $reflection = new ReflectionClass($controller);
        $endpoints = [];

        foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->class !== $controller) {
                continue;  // Только методы этого класса
            }

            $endpoints[] = [
                'method' => $method->getName(),
                'parameters' => $this->getParameters($method),
                'return_type' => (string) $method->getReturnType(),
            ];
        }

        return $endpoints;
    }

    private function getParameters(ReflectionMethod $method): array
    {
        $params = [];

        foreach ($method->getParameters() as $parameter) {
            $params[] = [
                'name' => $parameter->getName(),
                'type' => (string) $parameter->getType(),
                'optional' => $parameter->isOptional(),
                'default' => $parameter->isDefaultValueAvailable()
                    ? $parameter->getDefaultValue()
                    : null,
            ];
        }

        return $params;
    }
}

$analyzer = new ApiAnalyzer();
$endpoints = $analyzer->analyzeController(UserController::class);
```

**На собеседовании скажешь:**
> "ReflectionMethod анализирует метод. setAccessible(true) для вызова private/protected. invoke() вызывает метод. getParameters() возвращает параметры. Использую в тестах для private методов."

---

## ReflectionParameter

**Что это:**
Класс для анализа параметра метода/функции.

**Как работает:**
```php
class UserService
{
    public function create(
        string $name,
        int $age = 18,
        ?string $email = null,
        bool $isActive = true
    ): User {
        // ...
    }
}

$reflection = new ReflectionMethod(UserService::class, 'create');
$parameters = $reflection->getParameters();

foreach ($parameters as $parameter) {
    echo "Parameter: {$parameter->getName()}\n";
    echo "  Type: {$parameter->getType()}\n";
    echo "  Position: {$parameter->getPosition()}\n";
    echo "  Optional: " . ($parameter->isOptional() ? 'yes' : 'no') . "\n";

    if ($parameter->isDefaultValueAvailable()) {
        echo "  Default: " . var_export($parameter->getDefaultValue(), true) . "\n";
    }

    echo "  Nullable: " . ($parameter->allowsNull() ? 'yes' : 'no') . "\n";
    echo "\n";
}

// Вывод:
// Parameter: name
//   Type: string
//   Position: 0
//   Optional: no
//   Nullable: no
//
// Parameter: age
//   Type: int
//   Position: 1
//   Optional: yes
//   Default: 18
//   Nullable: no
//
// Parameter: email
//   Type: ?string
//   Position: 2
//   Optional: yes
//   Default: NULL
//   Nullable: yes
```

**Когда использовать:**
Для DI контейнеров, анализа API, автодокументации.

**Пример из практики:**
```php
// Laravel Service Container (упрощённо)
class Container
{
    public function make(string $class): object
    {
        $reflection = new ReflectionClass($class);
        $constructor = $reflection->getConstructor();

        if ($constructor === null) {
            return new $class();
        }

        $dependencies = [];

        foreach ($constructor->getParameters() as $parameter) {
            $type = $parameter->getType();

            if ($type === null || $type->isBuiltin()) {
                // Скалярный тип или нет type hint
                if ($parameter->isDefaultValueAvailable()) {
                    $dependencies[] = $parameter->getDefaultValue();
                } else {
                    throw new \Exception("Cannot resolve {$parameter->getName()}");
                }
            } else {
                // Класс — рекурсивно разрешить
                $dependencies[] = $this->make($type->getName());
            }
        }

        return $reflection->newInstanceArgs($dependencies);
    }
}

// Валидатор параметров
class ParameterValidator
{
    public function validate(ReflectionParameter $parameter, mixed $value): void
    {
        $type = $parameter->getType();

        if ($type === null) {
            return;  // Нет type hint
        }

        $typeName = $type->getName();

        if ($type->isBuiltin()) {
            // Проверка скалярного типа
            if (gettype($value) !== $typeName) {
                throw new \TypeError("Expected {$typeName}, got " . gettype($value));
            }
        } else {
            // Проверка класса
            if (!($value instanceof $typeName)) {
                throw new \TypeError("Expected {$typeName}, got " . get_class($value));
            }
        }

        if (!$parameter->allowsNull() && $value === null) {
            throw new \TypeError("{$parameter->getName()} cannot be null");
        }
    }
}
```

**На собеседовании скажешь:**
> "ReflectionParameter анализирует параметр функции/метода. Методы: getName(), getType(), isOptional(), getDefaultValue(), allowsNull(). Laravel Container использует для автоматического разрешения зависимостей."

---

## Атрибуты (Attributes, PHP 8.0+)

**Что это:**
Метаданные, прикреплённые к классам, методам, свойствам (аналог аннотаций).

**Как работает:**
```php
// Определение атрибута
#[Attribute]
class Route
{
    public function __construct(
        public string $method,
        public string $path,
    ) {}
}

// Использование атрибута
class UserController
{
    #[Route('GET', '/users')]
    public function index() {}

    #[Route('POST', '/users')]
    public function store() {}

    #[Route('GET', '/users/{id}')]
    public function show(int $id) {}
}

// Чтение атрибутов
$reflection = new ReflectionClass(UserController::class);

foreach ($reflection->getMethods() as $method) {
    $attributes = $method->getAttributes(Route::class);

    foreach ($attributes as $attribute) {
        $route = $attribute->newInstance();  // Route объект

        echo "{$route->method} {$route->path} → {$method->getName()}\n";
    }
}

// Вывод:
// GET /users → index
// POST /users → store
// GET /users/{id} → show
```

**Когда использовать:**
Для метаданных (роуты, валидация, кэширование), замена PHPDoc аннотаций.

**Пример из практики:**
```php
// Валидация через атрибуты
#[Attribute(Attribute::TARGET_PROPERTY)]
class Required {}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Email {}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Min
{
    public function __construct(public int $value) {}
}

class CreateUserRequest
{
    #[Required, Email]
    public string $email;

    #[Required, Min(8)]
    public string $password;

    #[Required]
    public string $name;
}

// Валидатор
class AttributeValidator
{
    public function validate(object $object): array
    {
        $reflection = new ReflectionClass($object);
        $errors = [];

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);
            $value = $property->getValue($object);

            foreach ($property->getAttributes() as $attribute) {
                $instance = $attribute->newInstance();

                if ($instance instanceof Required && empty($value)) {
                    $errors[$property->getName()][] = 'Field is required';
                }

                if ($instance instanceof Email && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[$property->getName()][] = 'Invalid email';
                }

                if ($instance instanceof Min && strlen($value) < $instance->value) {
                    $errors[$property->getName()][] = "Minimum length is {$instance->value}";
                }
            }
        }

        return $errors;
    }
}

$request = new CreateUserRequest();
$request->email = 'invalid';
$request->password = '123';
$request->name = 'John';

$validator = new AttributeValidator();
$errors = $validator->validate($request);
// ['email' => ['Invalid email'], 'password' => ['Minimum length is 8']]

// Route registration (Laravel-style)
#[Attribute(Attribute::TARGET_METHOD)]
class Get
{
    public function __construct(public string $path) {}
}

class ApiController
{
    #[Get('/api/users')]
    public function users() {}
}

// Router
class Router
{
    public function registerController(string $controller): void
    {
        $reflection = new ReflectionClass($controller);

        foreach ($reflection->getMethods() as $method) {
            $attributes = $method->getAttributes(Get::class);

            foreach ($attributes as $attribute) {
                $route = $attribute->newInstance();
                $this->get($route->path, [$controller, $method->getName()]);
            }
        }
    }
}
```

**На собеседовании скажешь:**
> "Attributes (PHP 8.0+) — метаданные для классов, методов, свойств. #[AttributeName]. Чтение через getAttributes(). Использую для роутинга, валидации, кэширования. Заменяет PHPDoc аннотации."

---

## Резюме Reflection API

**Основное:**
- **ReflectionClass** — анализ класса
- **ReflectionProperty** — анализ свойства
- **ReflectionMethod** — анализ метода
- **ReflectionParameter** — анализ параметра
- **setAccessible(true)** — доступ к private/protected
- **Attributes (PHP 8.0+)** — метаданные через #[Attr]

**Основные методы:**
- `getName()` — имя элемента
- `getType()` — тип элемента
- `getValue()` / `setValue()` — чтение/запись свойства
- `invoke()` — вызов метода
- `newInstance()` / `newInstanceArgs()` — создание объекта
- `getAttributes()` — чтение атрибутов (PHP 8.0+)

**Важно на собесе:**
- Laravel Container использует Reflection для DI
- setAccessible(true) для тестирования private методов
- Eloquent использует Reflection для моделей
- Attributes (PHP 8.0+) для метаданных
- Reflection медленнее обычного кода (кэшировать результаты)
- Использую в фреймворках, DI, ORM, тестах

---

## Практические задания

### Задание 1: Создай Object Mapper через Reflection

Реализуй класс, который преобразует DTO в массив и обратно, используя Reflection.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Utils;

use ReflectionClass;
use ReflectionProperty;

class ObjectMapper
{
    public function toArray(object $object): array
    {
        $reflection = new ReflectionClass($object);
        $data = [];

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);

            $name = $property->getName();
            $value = $property->getValue($object);

            // Рекурсивно преобразуем вложенные объекты
            if (is_object($value)) {
                $value = $this->toArray($value);
            } elseif (is_array($value)) {
                $value = array_map(function ($item) {
                    return is_object($item) ? $this->toArray($item) : $item;
                }, $value);
            }

            $data[$name] = $value;
        }

        return $data;
    }

    public function fromArray(string $class, array $data): object
    {
        $reflection = new ReflectionClass($class);

        // Создать объект без конструктора
        $object = $reflection->newInstanceWithoutConstructor();

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);

            $name = $property->getName();

            if (!array_key_exists($name, $data)) {
                continue;
            }

            $value = $data[$name];

            // Преобразовать тип если нужно
            $type = $property->getType();

            if ($type && !$type->isBuiltin() && is_array($value)) {
                $value = $this->fromArray($type->getName(), $value);
            }

            $property->setValue($object, $value);
        }

        return $object;
    }
}

// DTO
class Address
{
    public function __construct(
        public string $city,
        public string $street,
    ) {}
}

class UserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public Address $address,
    ) {}
}

// Использование
$mapper = new ObjectMapper();

$user = new UserDTO(
    name: 'Иван',
    email: 'ivan@mail.com',
    address: new Address(
        city: 'Москва',
        street: 'Ленина 1'
    )
);

// DTO → Array
$array = $mapper->toArray($user);
/*
[
    'name' => 'Иван',
    'email' => 'ivan@mail.com',
    'address' => [
        'city' => 'Москва',
        'street' => 'Ленина 1',
    ]
]
*/

// Array → DTO
$restored = $mapper->fromArray(UserDTO::class, $array);

echo $restored->name;  // "Иван"
echo $restored->address->city;  // "Москва"
```
</details>

### Задание 2: Реализуй простой Validator через Attributes

Создай валидатор, который использует PHP 8 Attributes для правил валидации.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Validation;

use Attribute;
use ReflectionClass;

// Attributes
#[Attribute(Attribute::TARGET_PROPERTY)]
class Required {}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Email {}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Min
{
    public function __construct(public int $value) {}
}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Max
{
    public function __construct(public int $value) {}
}

#[Attribute(Attribute::TARGET_PROPERTY)]
class Regex
{
    public function __construct(public string $pattern) {}
}

// Validator
class AttributeValidator
{
    public function validate(object $object): array
    {
        $reflection = new ReflectionClass($object);
        $errors = [];

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);
            $value = $property->getValue($object);
            $propertyName = $property->getName();

            foreach ($property->getAttributes() as $attribute) {
                $rule = $attribute->newInstance();

                $error = $this->validateRule($rule, $value, $propertyName);

                if ($error !== null) {
                    $errors[$propertyName][] = $error;
                }
            }
        }

        return $errors;
    }

    private function validateRule(object $rule, mixed $value, string $propertyName): ?string
    {
        return match (true) {
            $rule instanceof Required => $this->validateRequired($value, $propertyName),
            $rule instanceof Email => $this->validateEmail($value, $propertyName),
            $rule instanceof Min => $this->validateMin($value, $rule->value, $propertyName),
            $rule instanceof Max => $this->validateMax($value, $rule->value, $propertyName),
            $rule instanceof Regex => $this->validateRegex($value, $rule->pattern, $propertyName),
            default => null,
        };
    }

    private function validateRequired(mixed $value, string $property): ?string
    {
        return empty($value) ? "{$property} is required" : null;
    }

    private function validateEmail(mixed $value, string $property): ?string
    {
        return filter_var($value, FILTER_VALIDATE_EMAIL) ? null : "{$property} must be valid email";
    }

    private function validateMin(mixed $value, int $min, string $property): ?string
    {
        $length = is_string($value) ? mb_strlen($value) : $value;
        return $length >= $min ? null : "{$property} must be at least {$min}";
    }

    private function validateMax(mixed $value, int $max, string $property): ?string
    {
        $length = is_string($value) ? mb_strlen($value) : $value;
        return $length <= $max ? null : "{$property} must be at most {$max}";
    }

    private function validateRegex(mixed $value, string $pattern, string $property): ?string
    {
        return preg_match($pattern, $value) ? null : "{$property} format is invalid";
    }
}

// Использование
class RegisterRequest
{
    #[Required, Email]
    public string $email = '';

    #[Required, Min(8), Max(255)]
    public string $password = '';

    #[Required, Min(2), Max(100)]
    public string $name = '';

    #[Regex('/^\+7\d{10}$/')]
    public string $phone = '';
}

// Валидация
$request = new RegisterRequest();
$request->email = 'invalid-email';
$request->password = '123';
$request->name = 'J';
$request->phone = '123';

$validator = new AttributeValidator();
$errors = $validator->validate($request);

/*
[
    'email' => ['email must be valid email'],
    'password' => ['password must be at least 8'],
    'name' => ['name must be at least 2'],
    'phone' => ['phone format is invalid'],
]
*/

// Laravel Controller
public function register(Request $request)
{
    $dto = new RegisterRequest();
    $dto->email = $request->input('email');
    $dto->password = $request->input('password');
    $dto->name = $request->input('name');
    $dto->phone = $request->input('phone');

    $validator = new AttributeValidator();
    $errors = $validator->validate($dto);

    if (!empty($errors)) {
        return response()->json(['errors' => $errors], 422);
    }

    $user = User::create([
        'email' => $dto->email,
        'password' => Hash::make($dto->password),
        'name' => $dto->name,
    ]);

    return response()->json($user, 201);
}
```
</details>

### Задание 3: Создай Auto-Router через Reflection и Attributes

Реализуй автоматическую регистрацию роутов через анализ Controller методов с Attributes.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Routing;

use Attribute;
use ReflectionClass;
use ReflectionMethod;

// Route Attributes
#[Attribute(Attribute::TARGET_METHOD)]
class Get
{
    public function __construct(public string $path) {}
}

#[Attribute(Attribute::TARGET_METHOD)]
class Post
{
    public function __construct(public string $path) {}
}

#[Attribute(Attribute::TARGET_METHOD)]
class Put
{
    public function __construct(public string $path) {}
}

#[Attribute(Attribute::TARGET_METHOD)]
class Delete
{
    public function __construct(public string $path) {}
}

#[Attribute(Attribute::TARGET_METHOD)]
class Middleware
{
    public function __construct(public array $middleware) {}
}

// Auto Router
class AutoRouter
{
    public function registerController(string $controller): void
    {
        $reflection = new ReflectionClass($controller);

        foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            // Пропускаем методы из родительского класса
            if ($method->class !== $controller) {
                continue;
            }

            $this->registerMethod($controller, $method);
        }
    }

    private function registerMethod(string $controller, ReflectionMethod $method): void
    {
        $middleware = $this->getMiddleware($method);

        foreach ($method->getAttributes() as $attribute) {
            $route = $attribute->newInstance();

            $httpMethod = match (true) {
                $route instanceof Get => 'GET',
                $route instanceof Post => 'POST',
                $route instanceof Put => 'PUT',
                $route instanceof Delete => 'DELETE',
                default => null,
            };

            if ($httpMethod === null) {
                continue;
            }

            $this->registerRoute(
                $httpMethod,
                $route->path,
                [$controller, $method->getName()],
                $middleware
            );
        }
    }

    private function getMiddleware(ReflectionMethod $method): array
    {
        $middlewares = [];

        foreach ($method->getAttributes(Middleware::class) as $attribute) {
            $middleware = $attribute->newInstance();
            $middlewares = array_merge($middlewares, $middleware->middleware);
        }

        return $middlewares;
    }

    private function registerRoute(string $method, string $path, array $action, array $middleware): void
    {
        $route = \Illuminate\Support\Facades\Route::{strtolower($method)}($path, $action);

        if (!empty($middleware)) {
            $route->middleware($middleware);
        }

        echo "Registered: {$method} {$path} -> {$action[0]}@{$action[1]}\n";
    }
}

// Controller с Attributes
namespace App\Http\Controllers\Api;

use App\Routing\{Get, Post, Put, Delete, Middleware};

class UserController
{
    #[Get('/api/users')]
    #[Middleware(['auth:api'])]
    public function index()
    {
        return User::all();
    }

    #[Get('/api/users/{id}')]
    #[Middleware(['auth:api'])]
    public function show(int $id)
    {
        return User::findOrFail($id);
    }

    #[Post('/api/users')]
    #[Middleware(['auth:api', 'admin'])]
    public function store(Request $request)
    {
        return User::create($request->all());
    }

    #[Put('/api/users/{id}')]
    #[Middleware(['auth:api'])]
    public function update(Request $request, int $id)
    {
        $user = User::findOrFail($id);
        $user->update($request->all());
        return $user;
    }

    #[Delete('/api/users/{id}')]
    #[Middleware(['auth:api', 'admin'])]
    public function destroy(int $id)
    {
        User::findOrFail($id)->delete();
        return response()->noContent();
    }
}

// Service Provider
namespace App\Providers;

use App\Routing\AutoRouter;
use Illuminate\Support\ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $router = new AutoRouter();

        // Автоматически регистрируем все контроллеры
        $router->registerController(\App\Http\Controllers\Api\UserController::class);
        $router->registerController(\App\Http\Controllers\Api\PostController::class);

        // Или сканируем папку
        $this->registerControllersFromDirectory(app_path('Http/Controllers/Api'));
    }

    private function registerControllersFromDirectory(string $directory): void
    {
        $router = new AutoRouter();

        foreach (glob($directory . '/*Controller.php') as $file) {
            $class = $this->getClassFromFile($file);

            if (class_exists($class)) {
                $router->registerController($class);
            }
        }
    }

    private function getClassFromFile(string $file): string
    {
        $namespace = 'App\\Http\\Controllers\\Api';
        $class = basename($file, '.php');
        return "{$namespace}\\{$class}";
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
