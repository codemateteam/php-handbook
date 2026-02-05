# 18.3 Circuit Breaker

> **TL;DR**
> Circuit Breaker защищает от каскадных сбоев в микросервисах. 3 состояния: CLOSED (работает нормально), OPEN (fail fast без вызова сервиса), HALF-OPEN (проверка восстановления). При failures > threshold переходит в OPEN, после timeout пробует HALF-OPEN. Fallback strategies: default value, cached data, degraded mode, queue. Bulkhead Pattern для изоляции ресурсов.

## Содержание
- [Что это](#что-это)
- [Проблема без Circuit Breaker](#проблема-без-circuit-breaker)
- [Состояния Circuit Breaker](#состояния-circuit-breaker)
- [Реализация на PHP](#реализация-на-php)
- [Laravel Package](#laravel-package)
- [Fallback Strategy](#fallback-strategy)
- [Bulkhead Pattern (дополнение)](#bulkhead-pattern-дополнение)
- [Monitoring](#monitoring)
- [Best Practices](#best-practices)
- [Circuit Breaker + Retry](#circuit-breaker--retry)
- [Практические задания](#практические-задания)

## Что это

**Circuit Breaker:**
Паттерн для защиты от каскадных сбоев в распределённых системах. Предотвращает вызовы к недоступному сервису.

**Зачем:**
- Защита от cascade failures
- Fast fail вместо timeout
- Дать времени сервису восстановиться
- Graceful degradation

**Аналогия:**
Как автоматический выключатель в электрической сети. Если короткое замыкание → выключатель разрывает цепь.

---

## Проблема без Circuit Breaker

**Scenario:**

```
Order Service → Payment Service (медленный/упал)
   ↓
Каждый request ждёт 30 секунд timeout
   ↓
Threads блокируются
   ↓
Order Service перестаёт отвечать
   ↓
Cascade failure: вся система упала
```

**С Circuit Breaker:**

```
Order Service → Circuit Breaker → Payment Service
                    ↓
        если Payment упал:
        open circuit → fast fail
                    ↓
        Order Service продолжает работать
```

---

## Состояния Circuit Breaker

```
      ┌───────────┐
      │  CLOSED   │ ← Нормальная работа
      │ (working) │
      └─────┬─────┘
            │
    Failures > threshold
            │
            ↓
      ┌───────────┐
      │   OPEN    │ ← Все requests fail fast
      │  (broken) │
      └─────┬─────┘
            │
      After timeout
            │
            ↓
      ┌───────────┐
      │ HALF-OPEN │ ← Пробуем 1 request
      │  (testing)│
      └─────┬─────┘
            │
    ┌───────┴───────┐
Success           Failure
    │                │
    ↓                ↓
CLOSED            OPEN
```

### 1. CLOSED (Закрыт)

**Нормальная работа:**
- Requests проходят к сервису
- Считаются failures
- Если failures > threshold → OPEN

---

### 2. OPEN (Открыт)

**Сервис недоступен:**
- Все requests fail fast (без вызова сервиса)
- Не нагружаем упавший сервис
- После timeout → HALF-OPEN

---

### 3. HALF-OPEN (Полуоткрыт)

**Проверка восстановления:**
- Пропустить 1 пробный request
- Если success → CLOSED
- Если failure → OPEN

---

## Реализация на PHP

**Базовая реализация:**

```php
class CircuitBreaker
{
    private string $service;
    private int $failureThreshold = 5;
    private int $timeout = 60;  // seconds

    public function call(callable $callback)
    {
        $state = $this->getState();

        // OPEN: fail fast
        if ($state === 'open') {
            if ($this->shouldAttemptReset()) {
                return $this->attemptReset($callback);
            }

            throw new CircuitBreakerOpenException("Service {$this->service} is unavailable");
        }

        // CLOSED or HALF-OPEN: try call
        try {
            $result = $callback();

            // Success: reset failures
            $this->onSuccess();

            return $result;

        } catch (Exception $e) {
            // Failure: increment counter
            $this->onFailure();

            throw $e;
        }
    }

    private function getState(): string
    {
        $failures = Cache::get("circuit:{$this->service}:failures", 0);
        $openedAt = Cache::get("circuit:{$this->service}:opened_at");

        if ($failures >= $this->failureThreshold) {
            return 'open';
        }

        return 'closed';
    }

    private function shouldAttemptReset(): bool
    {
        $openedAt = Cache::get("circuit:{$this->service}:opened_at");

        if (!$openedAt) {
            return false;
        }

        return (time() - $openedAt) >= $this->timeout;
    }

    private function attemptReset(callable $callback)
    {
        try {
            $result = $callback();

            // Success: close circuit
            $this->reset();

            return $result;

        } catch (Exception $e) {
            // Still failing: reopen
            Cache::put("circuit:{$this->service}:opened_at", time(), 3600);

            throw $e;
        }
    }

    private function onSuccess(): void
    {
        $this->reset();
    }

    private function onFailure(): void
    {
        $failures = Cache::increment("circuit:{$this->service}:failures");

        if ($failures >= $this->failureThreshold) {
            Cache::put("circuit:{$this->service}:opened_at", time(), 3600);
        }
    }

    private function reset(): void
    {
        Cache::forget("circuit:{$this->service}:failures");
        Cache::forget("circuit:{$this->service}:opened_at");
    }
}
```

**Использование:**

```php
$circuitBreaker = new CircuitBreaker('payment-service');

try {
    $result = $circuitBreaker->call(function () {
        return Http::timeout(5)
            ->post('http://payment-service/api/charge', [...])
            ->throw()
            ->json();
    });

} catch (CircuitBreakerOpenException $e) {
    // Circuit open: fail fast
    Log::warning('Payment service unavailable');

    return response()->json([
        'error' => 'Payment service temporarily unavailable'
    ], 503);

} catch (Exception $e) {
    // Other error
    Log::error('Payment failed', ['error' => $e->getMessage()]);

    return response()->json([
        'error' => 'Payment failed'
    ], 500);
}
```

---

## Laravel Package

**Composer:**

```bash
composer require opis/circuit-breaker
```

**Использование:**

```php
use Opis\CircuitBreaker\CircuitBreaker;

$breaker = new CircuitBreaker();

$result = $breaker->call('payment-service', function () {
    return Http::post('http://payment-service/api/charge', [...])->json();
}, [
    'failure_threshold' => 5,
    'success_threshold' => 2,
    'timeout' => 60,
]);
```

---

## Fallback Strategy

**Что делать когда Circuit открыт?**

### 1. Вернуть дефолтное значение

```php
try {
    $recommendations = $circuitBreaker->call(function () {
        return Http::get('http://recommendation-service/api/products')->json();
    });
} catch (CircuitBreakerOpenException $e) {
    // Fallback: популярные товары
    $recommendations = Product::orderBy('views', 'desc')->limit(10)->get();
}
```

---

### 2. Cached data

```php
try {
    $user = $circuitBreaker->call(function () use ($userId) {
        return Http::get("http://user-service/api/users/{$userId}")->json();
    });
} catch (CircuitBreakerOpenException $e) {
    // Fallback: данные из кеша
    $user = Cache::get("user:{$userId}");

    if (!$user) {
        throw new UserNotFoundException();
    }
}
```

---

### 3. Degraded mode

```php
try {
    $analytics = $circuitBreaker->call(function () {
        return Http::get('http://analytics-service/api/stats')->json();
    });
} catch (CircuitBreakerOpenException $e) {
    // Degraded: показать страницу без аналитики
    $analytics = null;
}

return view('dashboard', [
    'analytics' => $analytics,  // может быть null
]);
```

---

### 4. Queue для retry

```php
try {
    $circuitBreaker->call(function () use ($email) {
        Http::post('http://notification-service/api/send', ['email' => $email]);
    });
} catch (CircuitBreakerOpenException $e) {
    // Fallback: добавить в queue
    SendEmailJob::dispatch($email)->delay(now()->addMinutes(5));
}
```

---

## Bulkhead Pattern (дополнение)

**Проблема:**
Один медленный сервис забирает все threads.

**Решение:**
Изолировать ресурсы для каждого сервиса.

```php
class BulkheadCircuitBreaker extends CircuitBreaker
{
    private int $maxConcurrentCalls = 10;

    public function call(callable $callback)
    {
        $currentCalls = Cache::get("bulkhead:{$this->service}:calls", 0);

        if ($currentCalls >= $this->maxConcurrentCalls) {
            throw new BulkheadFullException("Too many concurrent calls to {$this->service}");
        }

        Cache::increment("bulkhead:{$this->service}:calls");

        try {
            return parent::call($callback);
        } finally {
            Cache::decrement("bulkhead:{$this->service}:calls");
        }
    }
}
```

---

## Monitoring

**Метрики:**

```php
class CircuitBreaker
{
    private function onSuccess(): void
    {
        $this->reset();

        // Метрики
        Metrics::increment("circuit_breaker.{$this->service}.success");
    }

    private function onFailure(): void
    {
        $failures = Cache::increment("circuit:{$this->service}:failures");

        // Метрики
        Metrics::increment("circuit_breaker.{$this->service}.failure");

        if ($failures >= $this->failureThreshold) {
            Cache::put("circuit:{$this->service}:opened_at", time(), 3600);

            // Alert
            Log::critical("Circuit breaker opened for {$this->service}");
            Metrics::increment("circuit_breaker.{$this->service}.opened");
        }
    }
}
```

**Dashboard (Grafana):**

```
Метрики:
- circuit_breaker.{service}.success_rate (%)
- circuit_breaker.{service}.state (closed/open/half-open)
- circuit_breaker.{service}.failures (count)
```

---

## Best Practices

```
✓ Timeout: устанавливай разумный timeout (3-5 секунд)
✓ Failure threshold: 5-10 failures
✓ Reset timeout: 30-60 секунд
✓ Exponential backoff: увеличивай timeout после каждой неудачи
✓ Fallback: всегда имей plan B
✓ Monitoring: следи за состоянием circuits
✓ Alerts: уведомляй когда circuit opens
✓ Granularity: отдельный circuit для каждого сервиса/endpoint
```

---

## Circuit Breaker + Retry

**Комбинация:**

```php
class ResilientHttpClient
{
    public function call(string $service, callable $callback, int $maxRetries = 3)
    {
        $circuitBreaker = new CircuitBreaker($service);

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                return $circuitBreaker->call($callback);

            } catch (CircuitBreakerOpenException $e) {
                // Circuit open: не retry
                throw $e;

            } catch (Exception $e) {
                if ($attempt === $maxRetries) {
                    throw $e;
                }

                // Exponential backoff
                sleep(pow(2, $attempt));
            }
        }
    }
}

// Использование
$client = new ResilientHttpClient();

$result = $client->call('payment-service', function () {
    return Http::post('http://payment-service/api/charge', [...])->json();
});
```

---

## Практические задания

<details>
<summary>Задание 1: Базовый Circuit Breaker</summary>

**Задача:**
Реализуйте простой Circuit Breaker с тремя состояниями для защиты от сбоев Payment Service.

**Решение:**

```php
class SimpleCircuitBreaker
{
    private string $service;
    private int $failureThreshold = 3;
    private int $timeout = 30; // seconds

    public function __construct(string $service)
    {
        $this->service = $service;
    }

    public function call(callable $callback)
    {
        $failures = Cache::get("cb:{$this->service}:failures", 0);
        $openedAt = Cache::get("cb:{$this->service}:opened_at");

        // OPEN state
        if ($failures >= $this->failureThreshold) {
            if ($openedAt && (time() - $openedAt) >= $this->timeout) {
                // HALF-OPEN: пробуем один запрос
                return $this->attemptReset($callback);
            }

            throw new CircuitBreakerOpenException("Service {$this->service} is down");
        }

        // CLOSED state: normal operation
        try {
            $result = $callback();
            Cache::forget("cb:{$this->service}:failures");
            return $result;
        } catch (Exception $e) {
            $failures = Cache::increment("cb:{$this->service}:failures");

            if ($failures >= $this->failureThreshold) {
                Cache::put("cb:{$this->service}:opened_at", time(), 3600);
                Log::error("Circuit breaker opened for {$this->service}");
            }

            throw $e;
        }
    }

    private function attemptReset(callable $callback)
    {
        try {
            $result = $callback();
            // Success: close circuit
            Cache::forget("cb:{$this->service}:failures");
            Cache::forget("cb:{$this->service}:opened_at");
            Log::info("Circuit breaker closed for {$this->service}");
            return $result;
        } catch (Exception $e) {
            Cache::put("cb:{$this->service}:opened_at", time(), 3600);
            throw $e;
        }
    }
}

// Использование
$cb = new SimpleCircuitBreaker('payment-service');

try {
    $result = $cb->call(fn() => Http::timeout(5)->post('http://payment-service/api/charge')->json());
} catch (CircuitBreakerOpenException $e) {
    // Fallback
    return ['status' => 'queued'];
}
```
</details>

<details>
<summary>Задание 2: Fallback Strategy с кешем</summary>

**Задача:**
Реализуйте Circuit Breaker с fallback на кешированные данные при недоступности сервиса.

**Решение:**

```php
class RecommendationService
{
    public function __construct(private CircuitBreaker $cb) {}

    public function getRecommendations(int $userId): array
    {
        $cacheKey = "recommendations:{$userId}";

        try {
            $recommendations = $this->cb->call(function () use ($userId) {
                return Http::timeout(3)
                    ->get("http://recommendation-service/api/users/{$userId}/recommendations")
                    ->json();
            });

            // Обновить кеш при успехе
            Cache::put($cacheKey, $recommendations, 3600);

            return $recommendations;

        } catch (CircuitBreakerOpenException $e) {
            // Fallback: данные из кеша
            $cached = Cache::get($cacheKey);

            if ($cached) {
                Log::info("Using cached recommendations for user {$userId}");
                return $cached;
            }

            // Ultimate fallback: популярные товары
            return Product::orderBy('views', 'desc')->limit(10)->pluck('id')->toArray();
        }
    }
}
```
</details>

<details>
<summary>Задание 3: Circuit Breaker с Retry и Exponential Backoff</summary>

**Задача:**
Комбинируйте Circuit Breaker с retry логикой и exponential backoff.

**Решение:**

```php
class ResilientHttpClient
{
    public function call(string $service, callable $callback, int $maxRetries = 3)
    {
        $circuitBreaker = new CircuitBreaker($service);

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                return $circuitBreaker->call($callback);

            } catch (CircuitBreakerOpenException $e) {
                // Circuit открыт: не retry
                Log::warning("Circuit breaker open for {$service}, skipping retry");
                throw $e;

            } catch (RequestException $e) {
                if ($attempt === $maxRetries) {
                    Log::error("All {$maxRetries} attempts failed for {$service}");
                    throw $e;
                }

                // Exponential backoff: 2^attempt seconds
                $delay = pow(2, $attempt);
                Log::info("Retry {$attempt}/{$maxRetries} for {$service} in {$delay}s");
                sleep($delay);
            }
        }
    }
}

// Использование
$client = new ResilientHttpClient();

$result = $client->call('user-service', function () use ($userId) {
    return Http::timeout(5)->get("http://user-service/api/users/{$userId}")->throw()->json();
}, maxRetries: 3);
```
</details>

---

## На собеседовании скажешь

> "Circuit Breaker защищает от каскадных сбоев. 3 состояния: CLOSED (работает), OPEN (fail fast), HALF-OPEN (проверка восстановления). Параметры: failure threshold (5-10), timeout (30-60s). Transitions: CLOSED → OPEN при failures > threshold, OPEN → HALF-OPEN после timeout, HALF-OPEN → CLOSED при success. Fallback strategies: default value, cached data, degraded mode, queue для retry. Bulkhead Pattern для изоляции ресурсов. Monitoring: метрики успеха/failures, alerts при open. Best practices: timeout, exponential backoff, granular circuits, fallbacks."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

