# 18.2 API Gateway

> **TL;DR**
> API Gateway — единая точка входа для всех клиентов в микросервисной архитектуре. Функции: routing к микросервисам, authentication/authorization, rate limiting, request aggregation (1 запрос вместо N), caching, protocol translation. Популярные решения: Kong (Nginx-based), AWS API Gateway, custom на Laravel. Backend for Frontend (BFF) — разные gateways для разных типов клиентов (mobile/web).

## Содержание
- [Что это](#что-это)
- [Функции API Gateway](#функции-api-gateway)
- [Популярные API Gateways](#популярные-api-gateways)
- [Backend for Frontend (BFF)](#backend-for-frontend-bff)
- [Service Discovery](#service-discovery)
- [Best Practices](#best-practices)
- [Практические задания](#практические-задания)

## Что это

**API Gateway:**
Единая точка входа для всех клиентов. Маршрутизирует запросы к соответствующим микросервисам.

**Зачем:**
- Централизованный routing
- Authentication/Authorization
- Rate limiting
- Request/Response transformation
- Caching
- Load balancing

**Без API Gateway:**

```
Mobile App ──┐
Web App ────┤
             ├──→ User Service
Desktop ────┤    Order Service
API ────────┘    Payment Service
                 Notification Service

Проблемы:
❌ Clients знают о всех микросервисах
❌ Дублирование auth логики
❌ CORS для каждого сервиса
❌ Сложный client код
```

**С API Gateway:**

```
Mobile App ──┐
Web App ────┤
             ├──→ API Gateway ──┬──→ User Service
Desktop ────┤                   ├──→ Order Service
API ────────┘                   ├──→ Payment Service
                                └──→ Notification Service

Преимущества:
✅ Один endpoint для clients
✅ Централизованная auth
✅ Routing логика в одном месте
✅ Простой client код
```

---

## Функции API Gateway

### 1. Routing (маршрутизация)

```
GET  /api/users/*       → User Service
GET  /api/orders/*      → Order Service
POST /api/payments/*    → Payment Service
```

**Kong конфигурация:**

```yaml
services:
  - name: user-service
    url: http://user-service:8080
    routes:
      - name: user-route
        paths:
          - /api/users

  - name: order-service
    url: http://order-service:8081
    routes:
      - name: order-route
        paths:
          - /api/orders
```

---

### 2. Authentication

**API Gateway проверяет JWT:**

```
Client → API Gateway (verify JWT) → Microservice
                ↓
           if invalid → 401 Unauthorized
```

**Kong JWT plugin:**

```yaml
plugins:
  - name: jwt
    config:
      key_claim_name: iss
```

**Laravel (Custom Gateway):**

```php
// routes/api.php (Gateway)
Route::middleware('auth:sanctum')->group(function () {
    Route::any('/users/{any}', function (Request $request) {
        return Http::asForm()
            ->withToken($request->bearerToken())
            ->send(
                $request->method(),
                "http://user-service/api/{$request->path()}"
            );
    })->where('any', '.*');
});
```

---

### 3. Rate Limiting

```yaml
# Kong
plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 10000
      policy: local
```

**Laravel:**

```php
Route::middleware('throttle:100,1')->group(function () {
    Route::any('/api/{service}/{path}', [GatewayController::class, 'proxy'])
        ->where('path', '.*');
});
```

---

### 4. Request Aggregation

**Проблема:**

```
Mobile App нужно:
- User data
- User orders
- User notifications

Без Gateway: 3 requests
С Gateway: 1 request
```

**Реализация:**

```php
// API Gateway
class ProfileController extends Controller
{
    public function show($userId)
    {
        // Parallel requests
        [$user, $orders, $notifications] = Promise\Utils::unwrap([
            Http::async()->get("http://user-service/api/users/{$userId}"),
            Http::async()->get("http://order-service/api/users/{$userId}/orders"),
            Http::async()->get("http://notif-service/api/users/{$userId}/notifications"),
        ]);

        return response()->json([
            'user' => $user->json(),
            'orders' => $orders->json(),
            'notifications' => $notifications->json(),
        ]);
    }
}

// Client делает 1 запрос
GET /api/profile/123
```

---

### 5. Protocol Translation

```
Client (HTTP/REST) → API Gateway → Microservice (gRPC)
                                → Microservice (GraphQL)
                                → Microservice (SOAP)
```

---

### 6. Caching

```php
class GatewayController extends Controller
{
    public function proxy($service, $path)
    {
        $cacheKey = "gateway:{$service}:{$path}:" . request()->query();

        return Cache::remember($cacheKey, 300, function () use ($service, $path) {
            return Http::get("http://{$service}/{$path}", request()->query())->json();
        });
    }
}
```

---

## Популярные API Gateways

### 1. Kong

**Что это:** Open-source API Gateway на базе Nginx.

**Установка:**

```bash
docker run -d --name kong \
  -e "KONG_DATABASE=off" \
  -e "KONG_PROXY_ACCESS_LOG=/dev/stdout" \
  -e "KONG_ADMIN_ACCESS_LOG=/dev/stdout" \
  -p 8000:8000 \
  -p 8443:8443 \
  -p 8001:8001 \
  kong:latest
```

**Добавить сервис:**

```bash
curl -i -X POST http://localhost:8001/services/ \
  --data "name=user-service" \
  --data "url=http://user-service:8080"

curl -i -X POST http://localhost:8001/services/user-service/routes \
  --data "paths[]=/api/users"
```

**Plugins:**
- JWT authentication
- Rate limiting
- CORS
- Request/Response transformation
- Caching
- Logging

---

### 2. AWS API Gateway

**Managed service от AWS.**

**Terraform:**

```hcl
resource "aws_api_gateway_rest_api" "api" {
  name = "my-api"
}

resource "aws_api_gateway_resource" "users" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "users"
}

resource "aws_api_gateway_method" "get_users" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.get_users.http_method
  type        = "AWS_PROXY"
  uri         = aws_lambda_function.user_service.invoke_arn
}
```

---

### 3. Nginx

**Custom Gateway на Nginx:**

```nginx
upstream user_service {
    server user-service:8080;
}

upstream order_service {
    server order-service:8081;
}

server {
    listen 80;

    # JWT auth
    location / {
        auth_request /auth;
        auth_request_set $user_id $upstream_http_x_user_id;
        proxy_set_header X-User-Id $user_id;
    }

    location = /auth {
        internal;
        proxy_pass http://auth-service/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
    }

    # Routing
    location /api/users/ {
        proxy_pass http://user_service/;
    }

    location /api/orders/ {
        proxy_pass http://order_service/;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req zone=api burst=20;
}
```

---

### 4. Laravel Custom Gateway

**GatewayController:**

```php
class GatewayController extends Controller
{
    private array $serviceMap = [
        'users' => 'http://user-service',
        'orders' => 'http://order-service',
        'payments' => 'http://payment-service',
    ];

    public function proxy(Request $request, string $service, string $path)
    {
        // 1. Auth check
        if (!$request->bearerToken()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // 2. Service discovery
        $serviceUrl = $this->serviceMap[$service] ?? null;
        if (!$serviceUrl) {
            return response()->json(['error' => 'Service not found'], 404);
        }

        // 3. Forward request
        $response = Http::asForm()
            ->withToken($request->bearerToken())
            ->withHeaders([
                'X-Forwarded-For' => $request->ip(),
                'X-Request-Id' => Str::uuid(),
            ])
            ->send(
                $request->method(),
                "$serviceUrl/$path",
                [
                    'query' => $request->query(),
                    'json' => $request->json()->all(),
                ]
            );

        // 4. Return response
        return response($response->body(), $response->status())
            ->withHeaders($response->headers());
    }
}

// routes/api.php
Route::middleware(['auth:sanctum', 'throttle:100,1'])->group(function () {
    Route::any('/{service}/{path}', [GatewayController::class, 'proxy'])
        ->where('path', '.*');
});
```

---

## Backend for Frontend (BFF)

**Проблема:**
Mobile и Web нужны разные данные.

**Решение:**
Отдельный Gateway для каждого типа клиента.

```
Mobile App → Mobile BFF ──┬──→ User Service
                          ├──→ Order Service
                          └──→ Payment Service

Web App → Web BFF ────────┬──→ User Service
                          ├──→ Order Service
                          └──→ Analytics Service
```

**Mobile BFF (меньше данных):**

```php
class MobileGatewayController extends Controller
{
    public function profile($userId)
    {
        $user = Http::get("http://user-service/api/users/{$userId}")->json();
        $orders = Http::get("http://order-service/api/users/{$userId}/orders")->json();

        // Минимальные данные для мобилки
        return response()->json([
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'avatar' => $user['avatar'],
            ],
            'orders_count' => count($orders),
        ]);
    }
}
```

**Web BFF (больше данных):**

```php
class WebGatewayController extends Controller
{
    public function profile($userId)
    {
        [$user, $orders, $analytics] = Promise\Utils::unwrap([
            Http::async()->get("http://user-service/api/users/{$userId}"),
            Http::async()->get("http://order-service/api/users/{$userId}/orders"),
            Http::async()->get("http://analytics-service/api/users/{$userId}"),
        ]);

        // Полные данные для веба
        return response()->json([
            'user' => $user->json(),
            'orders' => $orders->json(),
            'analytics' => $analytics->json(),
        ]);
    }
}
```

---

## Service Discovery

**Проблема:**
Сервисы могут перемещаться (динамические IP в Kubernetes).

**Решение:**
Service Discovery (Consul, Eureka, Kubernetes DNS).

**Consul пример:**

```php
class ServiceDiscovery
{
    public function getServiceUrl(string $service): string
    {
        // Запросить Consul
        $response = Http::get("http://consul:8500/v1/catalog/service/{$service}");
        $instances = $response->json();

        // Выбрать случайный instance (client-side load balancing)
        $instance = $instances[array_rand($instances)];

        return "http://{$instance['Address']}:{$instance['ServicePort']}";
    }
}

// Использование
$serviceUrl = $this->serviceDiscovery->getServiceUrl('user-service');
$user = Http::get("$serviceUrl/api/users/{$id}")->json();
```

---

## Best Practices

```
✓ Stateless: Gateway не хранит состояние (можно масштабировать)
✓ Timeout: устанавливай timeout для requests к сервисам
✓ Circuit Breaker: не спамить упавший сервис
✓ Monitoring: логировать все requests (request ID для trace)
✓ Caching: кешировать где возможно
✓ Compression: gzip response
✓ CORS: настроить для frontend
✓ Versioning: /api/v1, /api/v2
```

---

## Практические задания

<details>
<summary>Задание 1: Простой API Gateway на Laravel</summary>

**Задача:**
Создайте базовый API Gateway с маршрутизацией к двум микросервисам: users и orders.

**Решение:**

```php
// routes/api.php
Route::middleware(['auth:sanctum', 'throttle:100,1'])->group(function () {
    Route::any('/{service}/{path}', [GatewayController::class, 'proxy'])
        ->where('service', 'users|orders')
        ->where('path', '.*');
});

// app/Http/Controllers/GatewayController.php
class GatewayController extends Controller
{
    private array $serviceMap = [
        'users' => 'http://user-service:8080',
        'orders' => 'http://order-service:8081',
    ];

    public function proxy(Request $request, string $service, string $path)
    {
        $serviceUrl = $this->serviceMap[$service] ?? null;

        if (!$serviceUrl) {
            return response()->json(['error' => 'Service not found'], 404);
        }

        $response = Http::timeout(5)
            ->withToken($request->bearerToken())
            ->withHeaders(['X-Request-Id' => Str::uuid()])
            ->send(
                $request->method(),
                "{$serviceUrl}/{$path}",
                ['query' => $request->query(), 'json' => $request->json()->all()]
            );

        return response($response->body(), $response->status())
            ->withHeaders($response->headers());
    }
}
```
</details>

<details>
<summary>Задание 2: Request Aggregation</summary>

**Задача:**
Реализуйте endpoint в API Gateway, который агрегирует данные с трех микросервисов параллельно.

**Решение:**

```php
class ProfileController extends Controller
{
    public function show(Request $request, int $userId)
    {
        // Параллельные запросы к трем сервисам
        $responses = Http::pool(fn (Pool $pool) => [
            $pool->as('user')->get("http://user-service/api/users/{$userId}"),
            $pool->as('orders')->get("http://order-service/api/users/{$userId}/orders"),
            $pool->as('notifications')->get("http://notification-service/api/users/{$userId}/notifications"),
        ]);

        return response()->json([
            'user' => $responses['user']->json(),
            'orders' => $responses['orders']->json(),
            'notifications' => $responses['notifications']->json(),
        ]);
    }
}

// 1 запрос от клиента вместо 3!
// GET /api/profile/123
```
</details>

<details>
<summary>Задание 3: Backend for Frontend (BFF)</summary>

**Задача:**
Создайте разные endpoints для Mobile и Web приложений с разным объемом данных.

**Решение:**

```php
// routes/api.php
Route::prefix('mobile')->group(function () {
    Route::get('/profile/{id}', [MobileBFFController::class, 'profile']);
});

Route::prefix('web')->group(function () {
    Route::get('/profile/{id}', [WebBFFController::class, 'profile']);
});

// Mobile BFF (минимум данных)
class MobileBFFController extends Controller
{
    public function profile(int $id)
    {
        $user = Http::get("http://user-service/api/users/{$id}")->json();

        return response()->json([
            'id' => $user['id'],
            'name' => $user['name'],
            'avatar' => $user['avatar'], // только аватар
        ]);
    }
}

// Web BFF (полные данные)
class WebBFFController extends Controller
{
    public function profile(int $id)
    {
        $responses = Http::pool(fn (Pool $pool) => [
            $pool->as('user')->get("http://user-service/api/users/{$id}"),
            $pool->as('analytics')->get("http://analytics-service/api/users/{$id}"),
            $pool->as('preferences')->get("http://preference-service/api/users/{$id}"),
        ]);

        return response()->json([
            'user' => $responses['user']->json(),
            'analytics' => $responses['analytics']->json(),
            'preferences' => $responses['preferences']->json(),
        ]);
    }
}
```
</details>

---

## На собеседовании скажешь

> "API Gateway — единая точка входа для clients. Функции: routing к микросервисам, authentication (JWT), rate limiting, request aggregation (1 request вместо N), protocol translation, caching. Популярные: Kong (Nginx-based), AWS API Gateway, custom на Laravel/Nginx. Backend for Frontend (BFF): разные gateways для mobile/web. Service Discovery (Consul, K8s DNS) для динамических IP. Best practices: stateless, timeout, circuit breaker, monitoring, compression."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

