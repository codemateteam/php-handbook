# 18.4 Service Discovery

> **TL;DR**
> Service Discovery — механизм для автоматического обнаружения микросервисов в распределенной системе. Типы: Client-Side (клиент сам находит сервис через Registry) и Server-Side (Load Balancer делает discovery). Consul: регистрация через HTTP API, health checks, client-side load balancing. Kubernetes: DNS-based discovery автоматически. Health checks: liveness (жив?) и readiness (готов?). Fallback на статический конфиг при недоступности Registry.

## Содержание
- [Что это](#что-это)
- [Типы Service Discovery](#типы-service-discovery)
- [Consul (HashiCorp)](#consul-hashicorp)
- [Kubernetes Service Discovery](#kubernetes-service-discovery)
- [Eureka (Netflix)](#eureka-netflix)
- [Laravel Package для Service Discovery](#laravel-package-для-service-discovery)
- [Caching Service Discovery](#caching-service-discovery)
- [Graceful Degradation](#graceful-degradation)
- [Health Checks](#health-checks)
- [Best Practices](#best-practices)
- [Альтернативы](#альтернативы)
- [Практические задания](#практические-задания)

## Что это

**Service Discovery:**
Механизм для автоматического обнаружения сетевых адресов сервисов в распределённой системе.

**Проблема:**
В микросервисной архитектуре сервисы динамически масштабируются, IP/порты меняются.

```
Раньше (монолит):
Order Service → http://payment-service:8080

Теперь (микросервисы):
Order Service → Payment Service (где он?)
                ├ instance-1: 10.0.1.5:8080
                ├ instance-2: 10.0.1.7:8080 (автоскейлинг добавил)
                └ instance-3: 10.0.1.9:8080
```

**Зачем:**
- Динамическая маршрутизация
- Автоскейлинг (добавление/удаление instances)
- Health checks
- Load balancing

---

## Типы Service Discovery

### 1. Client-Side Discovery

**Клиент сам находит сервис:**

```
1. Client → Service Registry: "Где Payment Service?"
2. Service Registry → Client: [10.0.1.5:8080, 10.0.1.7:8080]
3. Client выбирает instance (client-side load balancing)
4. Client → Payment Service instance
```

**Примеры:** Consul, Eureka

---

### 2. Server-Side Discovery

**Load Balancer находит сервис:**

```
1. Client → Load Balancer
2. Load Balancer → Service Registry: "Где Payment Service?"
3. Service Registry → Load Balancer: [instances]
4. Load Balancer выбирает instance
5. Load Balancer → Payment Service instance
```

**Примеры:** Kubernetes Service, AWS ELB, Nginx

---

## Consul (HashiCorp)

**Что это:**
Service mesh с service discovery, health checks, KV store.

**Установка:**

```bash
docker run -d --name=consul \
  -p 8500:8500 \
  -p 8600:8600/udp \
  consul agent -server -ui -bootstrap-expect=1 -client=0.0.0.0
```

**Web UI:** http://localhost:8500

---

### Регистрация сервиса

**Laravel Service Provider:**

```php
// app/Providers/ConsulServiceProvider.php
class ConsulServiceProvider extends ServiceProvider
{
    public function boot()
    {
        $this->registerService();
    }

    private function registerService()
    {
        $serviceId = config('app.name') . '-' . gethostname();

        $data = [
            'ID' => $serviceId,
            'Name' => config('app.name'),
            'Address' => gethostname(),
            'Port' => (int) config('app.port', 8000),
            'Check' => [
                'HTTP' => url('/health'),
                'Interval' => '10s',
                'Timeout' => '5s',
            ],
        ];

        Http::put('http://consul:8500/v1/agent/service/register', $data);

        // Deregister при shutdown
        register_shutdown_function(function () use ($serviceId) {
            Http::put("http://consul:8500/v1/agent/service/deregister/{$serviceId}");
        });
    }
}
```

**Health Check Endpoint:**

```php
// routes/web.php
Route::get('/health', function () {
    // Проверить БД, Redis, etc.
    try {
        DB::connection()->getPdo();
        Redis::ping();

        return response()->json(['status' => 'healthy']);
    } catch (Exception $e) {
        return response()->json(['status' => 'unhealthy'], 503);
    }
});
```

---

### Service Discovery (получить сервис)

```php
class ConsulServiceDiscovery
{
    public function getService(string $serviceName): ?string
    {
        // Получить все healthy instances
        $response = Http::get("http://consul:8500/v1/health/service/{$serviceName}", [
            'passing' => true,  // только healthy
        ]);

        $instances = $response->json();

        if (empty($instances)) {
            throw new ServiceNotFoundException("Service {$serviceName} not found");
        }

        // Client-side load balancing (random)
        $instance = $instances[array_rand($instances)];

        $address = $instance['Service']['Address'];
        $port = $instance['Service']['Port'];

        return "http://{$address}:{$port}";
    }
}

// Использование
$discovery = new ConsulServiceDiscovery();
$paymentUrl = $discovery->getService('payment-service');

$response = Http::post("{$paymentUrl}/api/charge", [
    'amount' => 100,
]);
```

---

### Load Balancing Strategies

**Round Robin:**

```php
class ConsulServiceDiscovery
{
    private array $counters = [];

    public function getService(string $serviceName): string
    {
        $instances = $this->getInstances($serviceName);

        // Round Robin
        if (!isset($this->counters[$serviceName])) {
            $this->counters[$serviceName] = 0;
        }

        $index = $this->counters[$serviceName] % count($instances);
        $this->counters[$serviceName]++;

        $instance = $instances[$index];

        return "http://{$instance['address']}:{$instance['port']}";
    }
}
```

**Weighted (по нагрузке):**

```php
public function getService(string $serviceName): string
{
    $instances = $this->getInstances($serviceName);

    // Выбрать instance с наименьшей нагрузкой
    usort($instances, fn($a, $b) => $a['load'] <=> $b['load']);

    $instance = $instances[0];

    return "http://{$instance['address']}:{$instance['port']}";
}
```

---

## Kubernetes Service Discovery

**Kubernetes DNS:**

```yaml
# payment-service deployment
apiVersion: v1
kind: Service
metadata:
  name: payment-service
spec:
  selector:
    app: payment
  ports:
    - port: 80
      targetPort: 8000
```

**DNS name:** `payment-service.default.svc.cluster.local`

**Laravel:**

```php
// Просто используй имя сервиса
$response = Http::post('http://payment-service/api/charge', [
    'amount' => 100,
]);

// Kubernetes автоматически резолвит DNS и балансирует
```

**Как работает:**
1. Kubernetes создаёт DNS запись для Service
2. DNS запись указывает на ClusterIP
3. kube-proxy балансирует между Pods

---

## Eureka (Netflix)

**Spring Boot ecosystem, для Java/Kotlin.**

**PHP клиент не существует, но можно REST API:**

```php
// Регистрация в Eureka
Http::post('http://eureka:8761/eureka/apps/PAYMENT-SERVICE', [
    'instance' => [
        'hostName' => gethostname(),
        'app' => 'PAYMENT-SERVICE',
        'ipAddr' => '10.0.1.5',
        'port' => ['$' => 8000, '@enabled' => true],
        'healthCheckUrl' => url('/health'),
    ],
]);

// Получить instances
$response = Http::get('http://eureka:8761/eureka/apps/PAYMENT-SERVICE');
$instances = $response->json()['application']['instance'];
```

---

## Laravel Package для Service Discovery

**Composer:**

```bash
composer require illuminate/http-client
```

**Service Provider:**

```php
class ServiceDiscoveryServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(ServiceDiscovery::class, function () {
            $driver = config('services.discovery.driver');

            return match ($driver) {
                'consul' => new ConsulServiceDiscovery(),
                'kubernetes' => new KubernetesServiceDiscovery(),
                'static' => new StaticServiceDiscovery(),
                default => throw new Exception("Unknown driver: {$driver}"),
            };
        });
    }
}

// config/services.php
'discovery' => [
    'driver' => env('SERVICE_DISCOVERY_DRIVER', 'consul'),
    'consul' => [
        'host' => env('CONSUL_HOST', 'consul:8500'),
    ],
],
```

**Использование:**

```php
class PaymentService
{
    public function __construct(private ServiceDiscovery $discovery) {}

    public function charge(int $amount): Payment
    {
        $url = $this->discovery->getService('payment-service');

        $response = Http::post("{$url}/api/charge", ['amount' => $amount]);

        return new Payment($response->json());
    }
}
```

---

## Caching Service Discovery

**Проблема:**
Каждый запрос к Consul/Eureka замедляет систему.

**Решение: Cache**

```php
class CachedServiceDiscovery implements ServiceDiscovery
{
    public function __construct(
        private ServiceDiscovery $discovery,
        private CacheInterface $cache
    ) {}

    public function getService(string $serviceName): string
    {
        $cacheKey = "service_discovery:{$serviceName}";

        return $this->cache->remember($cacheKey, 60, function () use ($serviceName) {
            return $this->discovery->getService($serviceName);
        });
    }
}
```

---

## Graceful Degradation

**Fallback при unavailable Service Registry:**

```php
class ResilientServiceDiscovery implements ServiceDiscovery
{
    public function getService(string $serviceName): string
    {
        try {
            // Попытка через Consul
            return $this->consulDiscovery->getService($serviceName);

        } catch (ConsulUnavailableException $e) {
            // Fallback: статический конфиг
            Log::warning("Consul unavailable, using static config");

            return config("services.static.{$serviceName}");
        }
    }
}

// config/services.php
'static' => [
    'payment-service' => 'http://payment.internal:8080',
    'user-service' => 'http://user.internal:8080',
],
```

---

## Health Checks

**Типы:**

### 1. Liveness Probe

**Проверка: "сервис жив?"**

```php
// /health/live
Route::get('/health/live', function () {
    return response()->json(['status' => 'alive']);
});
```

### 2. Readiness Probe

**Проверка: "сервис готов принимать запросы?"**

```php
// /health/ready
Route::get('/health/ready', function () {
    try {
        // Проверить зависимости
        DB::connection()->getPdo();
        Redis::ping();

        return response()->json(['status' => 'ready']);
    } catch (Exception $e) {
        return response()->json(['status' => 'not ready'], 503);
    }
});
```

---

## Best Practices

```
✓ Health checks с зависимостями (БД, Redis, etc.)
✓ Graceful shutdown (deregister перед остановкой)
✓ Client-side caching (не спамить Service Registry)
✓ Fallback на статический конфиг
✓ Retry с exponential backoff
✓ Load balancing strategy (round robin, weighted)
✓ Monitoring: регистрация/deregistration events
✓ TTL для health checks
```

---

## Альтернативы

**Для простых случаев:**

### 1. Env Variables

```env
PAYMENT_SERVICE_URL=http://payment-service:8080
USER_SERVICE_URL=http://user-service:8080
```

```php
Http::post(config('services.payment.url') . '/api/charge');
```

**Плюсы:**
- ✅ Просто
- ✅ Нет зависимостей

**Минусы:**
- ❌ Нет автоскейлинга
- ❌ Нет health checks
- ❌ Нужен redeploy при изменении

---

### 2. DNS Round Robin

```
payment-service.example.com → 10.0.1.5
payment-service.example.com → 10.0.1.7
payment-service.example.com → 10.0.1.9
```

```php
Http::post('http://payment-service.example.com/api/charge');
```

**Плюсы:**
- ✅ Простой load balancing

**Минусы:**
- ❌ Нет health checks (может роутить на мёртвый instance)
- ❌ DNS caching проблемы

---

## Практические задания

<details>
<summary>Задание 1: Consul Service Registration</summary>

**Задача:**
Создайте Service Provider для автоматической регистрации Laravel приложения в Consul при старте.

**Решение:**

```php
// app/Providers/ConsulServiceProvider.php
namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;

class ConsulServiceProvider extends ServiceProvider
{
    public function boot()
    {
        if (!app()->environment('local')) {
            $this->registerInConsul();
            $this->deregisterOnShutdown();
        }
    }

    private function registerInConsul(): void
    {
        $serviceId = config('app.name') . '-' . gethostname();
        $port = config('app.port', 8000);

        $data = [
            'ID' => $serviceId,
            'Name' => config('app.name'),
            'Address' => gethostbyname(gethostname()),
            'Port' => (int) $port,
            'Check' => [
                'HTTP' => url('/health/ready'),
                'Interval' => '10s',
                'Timeout' => '5s',
                'DeregisterCriticalServiceAfter' => '30s',
            ],
            'Tags' => ['laravel', 'api', config('app.env')],
        ];

        try {
            Http::put('http://consul:8500/v1/agent/service/register', $data);
            logger()->info("Registered in Consul as {$serviceId}");
        } catch (\Exception $e) {
            logger()->error("Failed to register in Consul: {$e->getMessage()}");
        }
    }

    private function deregisterOnShutdown(): void
    {
        $serviceId = config('app.name') . '-' . gethostname();

        register_shutdown_function(function () use ($serviceId) {
            try {
                Http::put("http://consul:8500/v1/agent/service/deregister/{$serviceId}");
                logger()->info("Deregistered from Consul: {$serviceId}");
            } catch (\Exception $e) {
                logger()->error("Failed to deregister from Consul: {$e->getMessage()}");
            }
        });
    }
}

// config/app.php - добавить в providers
'providers' => [
    // ...
    App\Providers\ConsulServiceProvider::class,
],
```
</details>

<details>
<summary>Задание 2: Service Discovery с кешированием</summary>

**Задача:**
Реализуйте Service Discovery клиент с кешированием результатов и round-robin load balancing.

**Решение:**

```php
class ConsulServiceDiscovery
{
    private array $counters = [];

    public function getServiceUrl(string $serviceName): string
    {
        $cacheKey = "service_discovery:{$serviceName}";

        // Кеш на 60 секунд
        $instances = Cache::remember($cacheKey, 60, function () use ($serviceName) {
            return $this->fetchHealthyInstances($serviceName);
        });

        if (empty($instances)) {
            throw new ServiceNotFoundException("Service {$serviceName} not found");
        }

        // Round-robin load balancing
        if (!isset($this->counters[$serviceName])) {
            $this->counters[$serviceName] = 0;
        }

        $index = $this->counters[$serviceName] % count($instances);
        $this->counters[$serviceName]++;

        $instance = $instances[$index];

        return "http://{$instance['address']}:{$instance['port']}";
    }

    private function fetchHealthyInstances(string $serviceName): array
    {
        try {
            $response = Http::timeout(3)->get("http://consul:8500/v1/health/service/{$serviceName}", [
                'passing' => true, // только healthy instances
            ]);

            return collect($response->json())->map(function ($item) {
                return [
                    'address' => $item['Service']['Address'],
                    'port' => $item['Service']['Port'],
                ];
            })->toArray();

        } catch (\Exception $e) {
            logger()->error("Failed to fetch service from Consul: {$e->getMessage()}");
            return [];
        }
    }
}

// Использование
$discovery = app(ConsulServiceDiscovery::class);
$url = $discovery->getServiceUrl('payment-service');
$response = Http::post("{$url}/api/charge", ['amount' => 100]);
```
</details>

<details>
<summary>Задание 3: Health Check Endpoints</summary>

**Задача:**
Создайте health check endpoints для liveness и readiness проверок.

**Решение:**

```php
// routes/web.php
Route::get('/health/live', [HealthController::class, 'live']);
Route::get('/health/ready', [HealthController::class, 'ready']);

// app/Http/Controllers/HealthController.php
class HealthController extends Controller
{
    // Liveness: приложение живо?
    public function live()
    {
        return response()->json([
            'status' => 'alive',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    // Readiness: готов принимать запросы?
    public function ready()
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'redis' => $this->checkRedis(),
            'queue' => $this->checkQueue(),
        ];

        $allHealthy = collect($checks)->every(fn($check) => $check === true);

        return response()->json([
            'status' => $allHealthy ? 'ready' : 'not ready',
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
        ], $allHealthy ? 200 : 503);
    }

    private function checkDatabase(): bool
    {
        try {
            DB::connection()->getPdo();
            return true;
        } catch (\Exception $e) {
            logger()->error("Database health check failed: {$e->getMessage()}");
            return false;
        }
    }

    private function checkRedis(): bool
    {
        try {
            Redis::ping();
            return true;
        } catch (\Exception $e) {
            logger()->error("Redis health check failed: {$e->getMessage()}");
            return false;
        }
    }

    private function checkQueue(): bool
    {
        try {
            // Проверить что queue worker работает
            return Cache::store('redis')->get('queue:heartbeat', 0) > (time() - 60);
        } catch (\Exception $e) {
            return false;
        }
    }
}
```
</details>

---

## На собеседовании скажешь

> "Service Discovery — механизм для автоматического обнаружения сервисов в микросервисах. Типы: Client-Side (клиент получает список instances от Registry и выбирает сам) и Server-Side (Load Balancer делает discovery). Consul: регистрация через HTTP API, health checks, client-side load balancing (random, round robin, weighted). Kubernetes: DNS-based discovery, Service автоматически резолвит в ClusterIP. Laravel: ServiceProvider регистрирует сервис при старте, deregister при shutdown, cache для discovery запросов. Health checks: liveness (жив ли), readiness (готов принимать запросы). Best practices: caching, fallback на статический конфиг, graceful shutdown, monitoring."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
