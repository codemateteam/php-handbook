# 9.6 CORS (Cross-Origin Resource Sharing)

## Краткое резюме

> **CORS** — механизм, позволяющий браузерам делать запросы к API на другом домене.
>
> **Laravel:** config/cors.php с настройками allowed_origins, allowed_methods, supports_credentials.
>
> **Важно:** Preflight запросы (OPTIONS), wildcard (*) только для публичных API.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Конфигурация](#конфигурация)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
CORS (Cross-Origin Resource Sharing) — механизм, позволяющий запросы с других доменов. По умолчанию браузеры блокируют cross-origin запросы из соображений безопасности.

**Проблема без CORS:**
```javascript
// Frontend на example.com
fetch('https://api.another-domain.com/posts')
// ❌ CORS error: Access-Control-Allow-Origin missing
```

**Почему нужен:**
- Same-Origin Policy браузеров блокирует запросы
- Защита от CSRF и других атак
- Контролируемый доступ к API

---

## Как работает

### Preflight Request

Для "сложных" запросов браузер сначала отправляет OPTIONS:

```
OPTIONS /api/posts HTTP/1.1
Origin: https://example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### Simple vs Preflight Requests

**Simple Request (без preflight):**
- GET, HEAD, POST
- Content-Type: text/plain, multipart/form-data, application/x-www-form-urlencoded
- Только простые headers

**Preflight Request (требуется OPTIONS):**
- PUT, DELETE, PATCH
- Content-Type: application/json
- Custom headers (Authorization, X-Custom-Header)

---

## Конфигурация

### Laravel (встроенный)

```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],  // или ['GET', 'POST', 'PUT', 'DELETE']

    'allowed_origins' => [
        'https://example.com',
        'https://app.example.com',
    ],

    'allowed_origins_patterns' => [
        '/^https:\/\/.*\.example\.com$/',  // Все поддомены
    ],

    'allowed_headers' => ['*'],  // или ['Content-Type', 'Authorization']

    'exposed_headers' => ['X-Total-Count'],  // Headers доступные клиенту

    'max_age' => 86400,  // Кэш preflight в секундах

    'supports_credentials' => true,  // Cookies/Authorization
];

// Middleware автоматически применяется (HandleCors в global middleware)
```

### Wildcard (разрешить всем)

```php
'allowed_origins' => ['*'],  // ⚠️ Только для публичных API!

// При использовании '*' нельзя:
'supports_credentials' => false,  // Credentials не работают с wildcard
```

---

## Когда использовать

| Сценарий | CORS нужен? |
|----------|------------|
| SPA на другом домене | ✅ Да |
| Мобильное приложение (WebView) | ✅ Да |
| Публичный API | ✅ Да |
| Same-origin (API и фронтенд на одном домене) | ❌ Нет |
| Server-to-server запросы | ❌ Нет |
| Postman/curl | ❌ Нет (CORS только в браузере) |

---

## Пример из практики

### Production конфигурация

```php
// config/cors.php
return [
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'https://example.com'),
        env('ADMIN_URL', 'https://admin.example.com'),
    ],

    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-TOKEN',
    ],

    'exposed_headers' => [
        'X-Total-Count',
        'X-Page-Count',
    ],

    'supports_credentials' => true,
    'max_age' => 86400,
];

// .env
FRONTEND_URL=https://app.example.com
ADMIN_URL=https://admin.example.com
```

### Multiple Origins через Environment

```php
'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', ''))),

// .env
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://staging.example.com
```

### Frontend запрос с credentials

```javascript
// Правильный fetch с credentials
fetch('https://api.example.com/posts', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
    },
    credentials: 'include',  // Отправляет cookies
    body: JSON.stringify(data),
})
.then(response => response.json())
.catch(error => {
    if (error.message.includes('CORS')) {
        console.error('CORS error - check allowed_origins');
    }
});
```

### Debug CORS проблем

```php
// Временный debug middleware
class DebugCors
{
    public function handle(Request $request, Closure $next)
    {
        \Log::info('CORS Debug', [
            'origin' => $request->header('Origin'),
            'method' => $request->method(),
            'path' => $request->path(),
            'headers' => $request->headers->all(),
        ]);

        $response = $next($request);

        \Log::info('CORS Response Headers', [
            'allow_origin' => $response->headers->get('Access-Control-Allow-Origin'),
            'allow_methods' => $response->headers->get('Access-Control-Allow-Methods'),
        ]);

        return $response;
    }
}
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- CORS позволяет браузерам делать cross-origin запросы
- Без CORS браузер блокирует запросы к другому домену
- Защита Same-Origin Policy

**Laravel конфигурация:**
- `config/cors.php` — настройки CORS
- `allowed_origins` — разрешённые домены
- `allowed_methods` — HTTP методы (GET, POST, PUT, DELETE)
- `supports_credentials` — для cookies/auth headers

**Preflight:**
- OPTIONS запрос перед "сложным" запросом
- Браузер проверяет разрешения
- Кэшируется на `max_age` секунд

**Headers:**
- `Access-Control-Allow-Origin` — разрешённый origin
- `Access-Control-Allow-Methods` — разрешённые методы
- `Access-Control-Allow-Credentials` — для cookies

**Best practices:**
- Wildcard (*) только для публичных API
- Explicit origins для production
- `supports_credentials: true` для auth
- HandleCors middleware автоматический в Laravel

---

## Практические задания

### Задание 1: Настрой CORS для multi-tenant SPA

У тебя SPA на поддоменах: app.client1.com, app.client2.com. API на api.example.com. Настрой CORS.

<details>
<summary>Решение</summary>

```php
// config/cors.php
return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Паттерн для всех поддоменов app.*.com
    'allowed_origins_patterns' => [
        '/^https:\/\/app\.[a-z0-9-]+\.com$/',
    ],

    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Tenant-Id',  // Кастомный header для tenant
    ],

    'exposed_headers' => [
        'X-Total-Count',
    ],

    'supports_credentials' => true,
    'max_age' => 86400,
];

// Альтернатива: Dynamic allowed_origins
// app/Http/Middleware/DynamicCors.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class DynamicCors
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->header('Origin');

        // Проверка origin
        if ($this->isAllowedOrigin($origin)) {
            return $next($request)
                ->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Id')
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Max-Age', '86400');
        }

        return $next($request);
    }

    private function isAllowedOrigin(?string $origin): bool
    {
        if (!$origin) {
            return false;
        }

        // Проверка паттерна
        return preg_match('/^https:\/\/app\.[a-z0-9-]+\.com$/', $origin) === 1;
    }
}
```
</details>

### Задание 2: Обработка CORS preflight для custom headers

API требует custom header `X-Api-Key`. Настрой CORS для preflight.

<details>
<summary>Решение</summary>

```php
// config/cors.php
return [
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [
        env('FRONTEND_URL'),
    ],

    // ВАЖНО: Добавить X-Api-Key в allowed_headers
    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Api-Key',  // Custom header
    ],

    'supports_credentials' => true,
    'max_age' => 86400,
];

// Frontend
fetch('https://api.example.com/posts', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'your-api-key',  // Триггерит preflight
    },
    body: JSON.stringify(data),
});

// API Middleware для проверки ключа
namespace App\Http\Middleware;

class ValidateApiKey
{
    public function handle(Request $request, Closure $next)
    {
        // Пропускаем preflight
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        $apiKey = $request->header('X-Api-Key');

        if (!$apiKey || !$this->isValidKey($apiKey)) {
            return response()->json([
                'error' => 'Invalid or missing API key'
            ], 401);
        }

        return $next($request);
    }

    private function isValidKey(string $key): bool
    {
        return hash_equals(
            config('app.api_key'),
            $key
        );
    }
}
```
</details>

### Задание 3: CORS error debugging

Клиент получает CORS error. Создай debug endpoint и middleware для диагностики.

<details>
<summary>Решение</summary>

```php
// routes/api.php (debug endpoint)
Route::get('/debug/cors', function (Request $request) {
    $origin = $request->header('Origin');
    $allowedOrigins = config('cors.allowed_origins');

    return response()->json([
        'request' => [
            'origin' => $origin,
            'method' => $request->method(),
            'headers' => $request->headers->all(),
        ],
        'config' => [
            'allowed_origins' => $allowedOrigins,
            'allowed_methods' => config('cors.allowed_methods'),
            'allowed_headers' => config('cors.allowed_headers'),
            'supports_credentials' => config('cors.supports_credentials'),
        ],
        'diagnosis' => [
            'origin_allowed' => in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins),
            'recommendations' => $this->getRecommendations($origin, $allowedOrigins),
        ],
    ]);
})->middleware('cors');

// app/Http/Middleware/CorsDebugger.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CorsDebugger
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->header('Origin');

        // Log preflight requests
        if ($request->isMethod('OPTIONS')) {
            Log::debug('CORS Preflight Request', [
                'origin' => $origin,
                'method' => $request->header('Access-Control-Request-Method'),
                'headers' => $request->header('Access-Control-Request-Headers'),
                'path' => $request->path(),
            ]);
        }

        $response = $next($request);

        // Log response headers
        Log::debug('CORS Response', [
            'origin' => $origin,
            'allow_origin' => $response->headers->get('Access-Control-Allow-Origin'),
            'allow_methods' => $response->headers->get('Access-Control-Allow-Methods'),
            'allow_headers' => $response->headers->get('Access-Control-Allow-Headers'),
            'allow_credentials' => $response->headers->get('Access-Control-Allow-Credentials'),
        ]);

        // Добавляем debug info в dev окружении
        if (config('app.debug')) {
            $response->headers->set('X-CORS-Debug', json_encode([
                'origin_received' => $origin,
                'origin_allowed' => $response->headers->get('Access-Control-Allow-Origin'),
                'config_origins' => config('cors.allowed_origins'),
            ]));
        }

        return $response;
    }
}

// Добавить в Kernel для debug
protected $middlewareGroups = [
    'api' => [
        // ...
        \App\Http\Middleware\CorsDebugger::class, // Только для dev
    ],
];

// Frontend debug helper
// Добавить в dev tools console
function debugCors(url) {
    fetch(url, { method: 'OPTIONS' })
        .then(response => {
            console.log('Preflight Response:');
            console.log('Allow-Origin:', response.headers.get('Access-Control-Allow-Origin'));
            console.log('Allow-Methods:', response.headers.get('Access-Control-Allow-Methods'));
            console.log('Allow-Headers:', response.headers.get('Access-Control-Allow-Headers'));
            console.log('Allow-Credentials:', response.headers.get('Access-Control-Allow-Credentials'));
        });
}

// debugCors('https://api.example.com/posts');
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
