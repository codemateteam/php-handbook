# 3.3 Исключения и ошибки

## Краткое резюме

> **Исключения** — механизм обработки ошибок через try-catch-finally.
>
> **Основное:** `throw new Exception()`, кастомные исключения, Error (PHP 7.0+), Throwable.
>
> **Laravel:** `abort()` для HTTP, `findOrFail()` для моделей, Handler для глобальной обработки.

---

## Содержание

- [try-catch-finally](#try-catch-finally)
- [throw (выброс исключения)](#throw-выброс-исключения)
- [Кастомные исключения](#кастомные-исключения)
- [Exception методы](#exception-методы)
- [Error (PHP 7.0+)](#error-php-70)
- [set_exception_handler и set_error_handler](#set_exception_handler-и-set_error_handler)
- [Резюме исключений и ошибок](#резюме-исключений-и-ошибок)
- [Практические задания](#практические-задания)

---

## try-catch-finally

**Что это:**
Механизм обработки исключений.

**Как работает:**
```php
try {
    // Код, который может выбросить исключение
    $user = User::findOrFail($id);  // Выбросит ModelNotFoundException
    $user->delete();
} catch (ModelNotFoundException $e) {
    // Обработка конкретного исключения
    echo "User not found: {$e->getMessage()}";
} catch (Exception $e) {
    // Обработка всех остальных исключений
    echo "Error: {$e->getMessage()}";
} finally {
    // Выполняется всегда (даже если было исключение)
    DB::disconnect();
    Log::info('Operation completed');
}

// finally (PHP 5.5+)
try {
    $file = fopen('file.txt', 'r');
    // Работа с файлом
} finally {
    if (isset($file)) {
        fclose($file);  // Закроется в любом случае
    }
}
```

**Когда использовать:**
Для обработки ошибок, которые можно предвидеть (файл не найден, нет соединения с БД).

**Пример из практики:**
```php
// API запрос с обработкой ошибок
public function store(Request $request)
{
    try {
        DB::beginTransaction();

        $user = User::create($request->validated());
        $user->roles()->attach($request->input('roles'));

        // Внешний API
        $this->notificationService->send($user);

        DB::commit();

        return response()->json($user, 201);
    } catch (ValidationException $e) {
        DB::rollBack();
        return response()->json(['errors' => $e->errors()], 422);
    } catch (ApiException $e) {
        DB::rollBack();
        Log::error('API error', ['message' => $e->getMessage()]);
        return response()->json(['error' => 'Notification failed'], 500);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Unexpected error', ['message' => $e->getMessage()]);
        return response()->json(['error' => 'Internal error'], 500);
    }
}

// Освобождение ресурсов
public function processFile(string $path): array
{
    $handle = fopen($path, 'r');

    try {
        $data = [];
        while (($line = fgets($handle)) !== false) {
            $data[] = json_decode($line, true);
        }

        return $data;
    } finally {
        fclose($handle);  // Закроется в любом случае
    }
}
```

**На собеседовании скажешь:**
> "try-catch обрабатывает исключения. Можно несколько catch для разных типов. finally выполняется всегда (для освобождения ресурсов). В Laravel использую для транзакций, внешних API, файловых операций."

---

## throw (выброс исключения)

**Что это:**
Создание и выброс исключения.

**Как работает:**
```php
function divide(int $a, int $b): float
{
    if ($b === 0) {
        throw new InvalidArgumentException('Division by zero');
    }

    return $a / $b;
}

try {
    $result = divide(10, 0);
} catch (InvalidArgumentException $e) {
    echo $e->getMessage();  // "Division by zero"
}

// Встроенные исключения PHP
throw new Exception('General error');
throw new RuntimeException('Runtime error');
throw new LogicException('Logic error');
throw new InvalidArgumentException('Invalid argument');
throw new OutOfBoundsException('Out of bounds');
throw new BadMethodCallException('Bad method call');

// С кодом ошибки и previous exception
try {
    $result = externalApi();
} catch (ApiException $e) {
    throw new RuntimeException('Failed to call API', 500, $e);
}
```

**Когда использовать:**
Когда метод не может продолжить выполнение (валидация не прошла, ресурс недоступен).

**Пример из практики:**
```php
// Валидация в сервисе
class OrderService
{
    public function create(array $data): Order
    {
        if (empty($data['user_id'])) {
            throw new InvalidArgumentException('User ID is required');
        }

        if ($data['amount'] <= 0) {
            throw new InvalidArgumentException('Amount must be positive');
        }

        $user = User::find($data['user_id']);

        if ($user === null) {
            throw new RuntimeException("User {$data['user_id']} not found");
        }

        return Order::create($data);
    }
}

// Eloquent findOrFail
$user = User::findOrFail($id);  // Выбросит ModelNotFoundException

// abort() в Laravel (выбрасывает HttpException)
if (!auth()->check()) {
    abort(401, 'Unauthorized');
}

if (!Gate::allows('update', $post)) {
    abort(403, 'Forbidden');
}

// Кастомное исключение с контекстом
class InsufficientFundsException extends Exception
{
    public function __construct(
        string $message,
        private int $balance,
        private int $required,
    ) {
        parent::__construct($message);
    }

    public function getBalance(): int
    {
        return $this->balance;
    }

    public function getRequired(): int
    {
        return $this->required;
    }
}

if ($wallet->balance < $amount) {
    throw new InsufficientFundsException(
        'Insufficient funds',
        $wallet->balance,
        $amount
    );
}
```

**На собеседовании скажешь:**
> "throw выбрасывает исключение. Встроенные: Exception, RuntimeException, InvalidArgumentException. Laravel: abort() для HTTP ошибок, findOrFail() выбрасывает ModelNotFoundException. Создаю кастомные исключения для бизнес-логики."

---

## Кастомные исключения

**Что это:**
Собственные классы исключений для специфичных ошибок.

**Как работает:**
```php
// Базовое кастомное исключение
class OrderException extends Exception {}

class PaymentFailedException extends OrderException {}

class InsufficientStockException extends OrderException {}

// Использование
try {
    $order = $this->createOrder($data);
    $this->processPayment($order);
    $this->reserveStock($order);
} catch (PaymentFailedException $e) {
    // Обработка ошибки оплаты
    $this->refundOrder($order);
    throw $e;
} catch (InsufficientStockException $e) {
    // Обработка нехватки товара
    $this->notifySupplier($e->getProduct());
} catch (OrderException $e) {
    // Общая обработка ошибок заказа
    Log::error('Order error', ['message' => $e->getMessage()]);
}

// С дополнительным контекстом
class ValidationException extends Exception
{
    public function __construct(
        string $message,
        private array $errors,
    ) {
        parent::__construct($message);
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}

throw new ValidationException('Validation failed', [
    'email' => ['Email is invalid'],
    'password' => ['Password is too short'],
]);
```

**Когда использовать:**
Для доменных ошибок, бизнес-логики, специфичных случаев.

**Пример из практики:**
```php
// Laravel HTTP исключения
namespace App\Exceptions;

use Exception;

class ApiException extends Exception
{
    protected int $statusCode;

    public function __construct(
        string $message,
        int $statusCode = 500,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
        $this->statusCode = $statusCode;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function render()
    {
        return response()->json([
            'error' => $this->getMessage(),
        ], $this->statusCode);
    }
}

// Использование
if (!$token) {
    throw new ApiException('Token is required', 401);
}

// Доменные исключения
class UserAlreadyExistsException extends Exception
{
    public function __construct(string $email)
    {
        parent::__construct("User with email {$email} already exists");
    }
}

class OrderNotFoundException extends Exception
{
    public function __construct(int $orderId)
    {
        parent::__construct("Order {$orderId} not found");
    }
}

// Сервис
public function register(array $data): User
{
    $exists = User::where('email', $data['email'])->exists();

    if ($exists) {
        throw new UserAlreadyExistsException($data['email']);
    }

    return User::create($data);
}

// Handler
public function render($request, Throwable $exception)
{
    if ($exception instanceof UserAlreadyExistsException) {
        return response()->json([
            'error' => $exception->getMessage(),
        ], 409);
    }

    if ($exception instanceof OrderNotFoundException) {
        return response()->json([
            'error' => $exception->getMessage(),
        ], 404);
    }

    return parent::render($request, $exception);
}
```

**На собеседовании скажешь:**
> "Кастомные исключения для доменных ошибок. Наследую от Exception или RuntimeException. Добавляю контекст (balance, product). В Laravel создаю ApiException, DomainException. Handler обрабатывает и возвращает JSON."

---

## Exception методы

**Что это:**
Методы объекта Exception для получения информации об ошибке.

**Как работает:**
```php
try {
    throw new Exception('Error message', 500);
} catch (Exception $e) {
    // Методы Exception
    echo $e->getMessage();     // "Error message"
    echo $e->getCode();        // 500
    echo $e->getFile();        // /path/to/file.php
    echo $e->getLine();        // 42
    echo $e->getTrace();       // Array (stack trace)
    echo $e->getTraceAsString(); // String (formatted stack trace)
    echo $e->getPrevious();    // Previous exception (или null)

    // __toString()
    echo $e;  // Полная информация об исключении
}

// Previous exception (цепочка)
try {
    throw new Exception('Original error');
} catch (Exception $original) {
    throw new RuntimeException('Wrapped error', 0, $original);
}

// Получение цепочки
try {
    // ...
} catch (Exception $e) {
    while ($e !== null) {
        echo $e->getMessage() . "\n";
        $e = $e->getPrevious();
    }
}
```

**Когда использовать:**
Для логирования, дебаггинга, создания цепочки исключений.

**Пример из практики:**
```php
// Логирование исключений
try {
    $this->externalApi->call();
} catch (ApiException $e) {
    Log::error('API call failed', [
        'message' => $e->getMessage(),
        'code' => $e->getCode(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString(),
    ]);

    throw new RuntimeException('External API failed', 0, $e);
}

// Laravel Exception Handler
public function report(Throwable $exception)
{
    if ($this->shouldReport($exception)) {
        Log::error($exception->getMessage(), [
            'exception' => get_class($exception),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ]);

        // Отправка в Sentry
        if (app()->bound('sentry')) {
            app('sentry')->captureException($exception);
        }
    }
}

// Custom exception с дополнительной информацией
class DatabaseException extends Exception
{
    public function __construct(
        string $message,
        private string $query,
        private array $bindings,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function getQuery(): string
    {
        return $this->query;
    }

    public function getBindings(): array
    {
        return $this->bindings;
    }

    public function getContext(): array
    {
        return [
            'message' => $this->getMessage(),
            'query' => $this->query,
            'bindings' => $this->bindings,
            'file' => $this->getFile(),
            'line' => $this->getLine(),
        ];
    }
}

// Логирование с контекстом
try {
    DB::select($query, $bindings);
} catch (QueryException $e) {
    $exception = new DatabaseException(
        'Database query failed',
        $query,
        $bindings,
        $e
    );

    Log::error('Database error', $exception->getContext());
    throw $exception;
}
```

**На собеседовании скажешь:**
> "Exception методы: getMessage(), getCode(), getFile(), getLine(), getTrace(). getPrevious() для цепочки исключений. Использую для логирования, отправки в Sentry. В кастомных исключениях добавляю getContext() для дополнительной информации."

---

## Error (PHP 7.0+)

**Что это:**
Фатальные ошибки PHP теперь выбрасывают Error (можно ловить).

**Как работает:**
```php
// PHP < 7.0: фатальная ошибка (нельзя поймать)
// PHP 7.0+: выбрасывает Error (можно поймать)

try {
    nonExistentFunction();  // ParseError
} catch (Error $e) {
    echo "Error: {$e->getMessage()}";
}

try {
    $obj->nonExistentMethod();  // Error
} catch (Error $e) {
    echo "Error: {$e->getMessage()}";
}

// Типы Error
try {
    // Разные ошибки
} catch (ParseError $e) {
    // Синтаксическая ошибка
} catch (TypeError $e) {
    // Ошибка типизации
} catch (ArithmeticError $e) {
    // Арифметическая ошибка
} catch (DivisionByZeroError $e) {
    // Деление на ноль
} catch (Error $e) {
    // Все остальные Error
}

// Error vs Exception
// Error — внутренние ошибки PHP
// Exception — пользовательские исключения

// Throwable (PHP 7.0+)
try {
    // ...
} catch (Throwable $e) {
    // Ловит И Exception, И Error
}
```

**Когда использовать:**
Для обработки фатальных ошибок, которые раньше убивали скрипт.

**Пример из практики:**
```php
// Обработка TypeError
function add(int $a, int $b): int
{
    return $a + $b;
}

try {
    $result = add(5, 'string');  // TypeError
} catch (TypeError $e) {
    Log::error('Type error', ['message' => $e->getMessage()]);
    return 0;
}

// Обработка DivisionByZeroError
try {
    $result = intdiv(10, 0);  // DivisionByZeroError
} catch (DivisionByZeroError $e) {
    Log::error('Division by zero');
    return null;
}

// Laravel Exception Handler (ловит всё)
public function render($request, Throwable $exception)
{
    // Throwable ловит Exception и Error

    if ($exception instanceof ModelNotFoundException) {
        return response()->json(['error' => 'Not found'], 404);
    }

    if ($exception instanceof TypeError) {
        Log::error('Type error', [
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
        ]);

        return response()->json(['error' => 'Internal error'], 500);
    }

    return parent::render($request, $exception);
}

// Универсальный обработчик
set_exception_handler(function (Throwable $e) {
    Log::error('Unhandled exception', [
        'type' => get_class($e),
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ]);

    echo "An error occurred";
    exit(1);
});
```

**На собеседовании скажешь:**
> "Error (PHP 7.0+) — фатальные ошибки PHP, которые можно ловить. TypeError, ParseError, DivisionByZeroError. Throwable — базовый интерфейс для Exception и Error. В Laravel Handler использую Throwable для обработки всех ошибок."

---

## set_exception_handler и set_error_handler

**Что это:**
Глобальные обработчики исключений и ошибок.

**Как работает:**
```php
// Обработчик неперехваченных исключений
set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage());
    echo "An error occurred. Please try again later.";
    exit(1);
});

throw new Exception('Unhandled exception');
// Выведет: "An error occurred. Please try again later."

// Обработчик ошибок PHP (warnings, notices)
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

// Теперь warnings становятся исключениями
try {
    $file = fopen('nonexistent.txt', 'r');  // Warning → Exception
} catch (ErrorException $e) {
    echo "File error: {$e->getMessage()}";
}

// Восстановление обработчиков
restore_exception_handler();
restore_error_handler();
```

**Когда использовать:**
Для глобальной обработки ошибок (логирование, отправка в Sentry).

**Пример из практики:**
```php
// Laravel bootstrap/app.php (упрощённо)
$app->singleton(
    Illuminate\Contracts\Debug\ExceptionHandler::class,
    App\Exceptions\Handler::class
);

// app/Exceptions/Handler.php
namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    // Обработка всех неперехваченных исключений
    public function render($request, Throwable $exception)
    {
        // Логирование
        $this->report($exception);

        // JSON для API
        if ($request->expectsJson()) {
            return response()->json([
                'error' => $exception->getMessage(),
            ], $this->getStatusCode($exception));
        }

        // HTML для браузера
        return parent::render($request, $exception);
    }

    public function report(Throwable $exception)
    {
        // Отправка в Sentry
        if (app()->bound('sentry') && $this->shouldReport($exception)) {
            app('sentry')->captureException($exception);
        }

        parent::report($exception);
    }

    private function getStatusCode(Throwable $exception): int
    {
        return method_exists($exception, 'getStatusCode')
            ? $exception->getStatusCode()
            : 500;
    }
}

// Custom error handler
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    // Пропустить подавленные ошибки (@operator)
    if (!(error_reporting() & $errno)) {
        return false;
    }

    Log::warning('PHP error', [
        'type' => $errno,
        'message' => $errstr,
        'file' => $errfile,
        'line' => $errline,
    ]);

    // Преобразовать в исключение
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});
```

**На собеседовании скажешь:**
> "set_exception_handler обрабатывает неперехваченные исключения. set_error_handler преобразует warnings/notices в исключения. Laravel использует Handler класс для глобальной обработки. Отправляю в Sentry, логирую, возвращаю JSON для API."

---

## Резюме исключений и ошибок

**Основное:**
- `try-catch-finally` — обработка исключений
- `throw` — выброс исключения
- Встроенные: Exception, RuntimeException, InvalidArgumentException
- Кастомные исключения для доменных ошибок
- Методы: getMessage(), getCode(), getFile(), getLine(), getTrace()
- `Error` (PHP 7.0+) — фатальные ошибки (можно ловить)
- `Throwable` — базовый интерфейс (Exception + Error)
- `set_exception_handler` — глобальный обработчик

**Error vs Exception:**
- Error — внутренние ошибки PHP (TypeError, ParseError)
- Exception — пользовательские исключения

**Важно на собесе:**
- finally выполняется всегда (освобождение ресурсов)
- Throwable ловит Exception и Error
- Laravel: abort() для HTTP, findOrFail() для моделей
- Кастомные исключения с контекстом (getContext())
- Handler для глобальной обработки, отправки в Sentry
- Цепочка исключений через getPrevious()

---

## Практические задания

### Задание 1: Создай кастомное исключение с контекстом

Создай исключение `InsufficientFundsException`, которое хранит баланс, требуемую сумму и предоставляет метод `getContext()`.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Exceptions;

use Exception;

class InsufficientFundsException extends Exception
{
    public function __construct(
        string $message,
        private int $balance,
        private int $required,
        private string $currency = 'RUB',
    ) {
        parent::__construct($message);
    }

    public function getBalance(): int
    {
        return $this->balance;
    }

    public function getRequired(): int
    {
        return $this->required;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function getShortage(): int
    {
        return $this->required - $this->balance;
    }

    public function getContext(): array
    {
        return [
            'message' => $this->getMessage(),
            'balance' => $this->balance,
            'required' => $this->required,
            'shortage' => $this->getShortage(),
            'currency' => $this->currency,
            'file' => $this->getFile(),
            'line' => $this->getLine(),
        ];
    }

    public function render()
    {
        return response()->json([
            'error' => 'insufficient_funds',
            'message' => $this->getMessage(),
            'balance' => $this->balance,
            'required' => $this->required,
            'shortage' => $this->getShortage(),
        ], 422);
    }
}

// Использование
class WalletService
{
    public function withdraw(Wallet $wallet, int $amount): void
    {
        if ($wallet->balance < $amount) {
            throw new InsufficientFundsException(
                'Недостаточно средств на счёте',
                $wallet->balance,
                $amount,
                $wallet->currency
            );
        }

        $wallet->balance -= $amount;
        $wallet->save();
    }
}

// Обработка
try {
    $walletService->withdraw($wallet, 10000);
} catch (InsufficientFundsException $e) {
    Log::warning('Insufficient funds', $e->getContext());

    return response()->json([
        'error' => 'Недостаточно средств',
        'shortage' => $e->getShortage(),
    ], 422);
}
```
</details>

### Задание 2: Реализуй глобальную обработку ошибок

Создай Laravel Exception Handler, который логирует все ошибки, отправляет критичные в Telegram, и возвращает JSON для API.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        //
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            // Логирование всех ошибок
            Log::error($e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Критичные ошибки в Telegram
            if ($this->shouldReportToTelegram($e)) {
                $this->sendToTelegram($e);
            }
        });
    }

    public function render($request, Throwable $e): JsonResponse|\Symfony\Component\HttpFoundation\Response
    {
        // JSON для API запросов
        if ($request->expectsJson()) {
            return $this->renderJsonException($request, $e);
        }

        return parent::render($request, $e);
    }

    private function renderJsonException($request, Throwable $e): JsonResponse
    {
        $status = $this->getStatusCode($e);

        $response = [
            'error' => $this->getErrorMessage($e),
        ];

        // В debug режиме добавляем детали
        if (config('app.debug')) {
            $response['exception'] = get_class($e);
            $response['file'] = $e->getFile();
            $response['line'] = $e->getLine();
            $response['trace'] = explode("\n", $e->getTraceAsString());
        }

        return response()->json($response, $status);
    }

    private function getStatusCode(Throwable $e): int
    {
        if (method_exists($e, 'getStatusCode')) {
            return $e->getStatusCode();
        }

        return match (true) {
            $e instanceof NotFoundHttpException => 404,
            $e instanceof \Illuminate\Auth\AuthenticationException => 401,
            $e instanceof \Illuminate\Auth\Access\AuthorizationException => 403,
            $e instanceof \Illuminate\Validation\ValidationException => 422,
            default => 500,
        };
    }

    private function getErrorMessage(Throwable $e): string
    {
        return match (true) {
            $e instanceof NotFoundHttpException => 'Resource not found',
            $e instanceof \Illuminate\Auth\AuthenticationException => 'Unauthenticated',
            $e instanceof \Illuminate\Auth\Access\AuthorizationException => 'Forbidden',
            default => config('app.debug') ? $e->getMessage() : 'Internal server error',
        };
    }

    private function shouldReportToTelegram(Throwable $e): bool
    {
        // Только критичные ошибки
        return $e instanceof \Error
            || $e instanceof \PDOException
            || $this->getStatusCode($e) >= 500;
    }

    private function sendToTelegram(Throwable $e): void
    {
        try {
            $message = "🔴 *Error in " . config('app.name') . "*\n\n";
            $message .= "*Type:* " . get_class($e) . "\n";
            $message .= "*Message:* " . $e->getMessage() . "\n";
            $message .= "*File:* " . $e->getFile() . ":" . $e->getLine() . "\n";
            $message .= "*URL:* " . request()->fullUrl();

            // Отправка в Telegram (используя пакет или HTTP клиент)
            // TelegramService::send($message);
        } catch (\Exception $telegramException) {
            // Игнорируем ошибки отправки в Telegram
            Log::warning('Failed to send to Telegram', [
                'error' => $telegramException->getMessage(),
            ]);
        }
    }
}
```
</details>

### Задание 3: Обработка транзакций с исключениями

Создай сервис для создания заказа с оплатой. Если оплата не прошла - откатить транзакцию и выбросить исключение.

<details>
<summary>Решение</summary>

```php
<?php

namespace App\Services;

use App\Exceptions\PaymentFailedException;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OrderService
{
    public function __construct(
        private PaymentGateway $paymentGateway,
    ) {}

    public function createAndPay(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            try {
                // 1. Создать заказ
                $order = Order::create([
                    'user_id' => $data['user_id'],
                    'amount' => $data['amount'],
                    'status' => 'pending',
                ]);

                Log::info('Order created', ['order_id' => $order->id]);

                // 2. Зарезервировать товары
                $this->reserveProducts($order, $data['products']);

                // 3. Провести оплату
                $payment = $this->paymentGateway->charge(
                    $order->amount,
                    $data['payment_method']
                );

                // 4. Обновить статус
                $order->update([
                    'status' => 'paid',
                    'payment_id' => $payment->id,
                ]);

                Log::info('Order paid', ['order_id' => $order->id]);

                return $order;

            } catch (PaymentFailedException $e) {
                // Оплата не прошла - откатываем транзакцию
                Log::error('Payment failed', [
                    'order_id' => $order->id ?? null,
                    'error' => $e->getMessage(),
                ]);

                throw $e;  // Транзакция откатится автоматически

            } catch (\Exception $e) {
                // Любая другая ошибка
                Log::error('Order creation failed', [
                    'error' => $e->getMessage(),
                    'data' => $data,
                ]);

                throw new \RuntimeException(
                    'Failed to create order: ' . $e->getMessage(),
                    0,
                    $e
                );
            }
        });
    }

    private function reserveProducts(Order $order, array $products): void
    {
        foreach ($products as $productData) {
            $product = Product::find($productData['id']);

            if ($product->stock < $productData['quantity']) {
                throw new \RuntimeException(
                    "Product {$product->name} is out of stock"
                );
            }

            $order->products()->attach($product->id, [
                'quantity' => $productData['quantity'],
                'price' => $product->price,
            ]);

            $product->decrement('stock', $productData['quantity']);
        }
    }
}

// Использование
try {
    $order = $orderService->createAndPay([
        'user_id' => 1,
        'amount' => 5000,
        'products' => [
            ['id' => 1, 'quantity' => 2],
            ['id' => 2, 'quantity' => 1],
        ],
        'payment_method' => 'card',
    ]);

    return response()->json($order, 201);

} catch (PaymentFailedException $e) {
    return response()->json([
        'error' => 'payment_failed',
        'message' => $e->getMessage(),
    ], 422);

} catch (\RuntimeException $e) {
    return response()->json([
        'error' => 'order_creation_failed',
        'message' => $e->getMessage(),
    ], 500);
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
