# 8.2 CSRF (Cross-Site Request Forgery)

## Краткое резюме

> **CSRF (Cross-Site Request Forgery)** — атака, при которой злоумышленник заставляет авторизованного пользователя выполнить нежелательное действие на другом сайте.
>
> **Защита:** Laravel автоматически проверяет CSRF токен через middleware `VerifyCsrfToken`. Blade директива `@csrf` добавляет скрытое поле с токеном. Для AJAX используется заголовок `X-CSRF-TOKEN`.
>
> **Важно:** SameSite cookies обеспечивают дополнительную защиту. API с токенами (Sanctum) не требуют CSRF защиты.

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
CSRF — подделка межсайтовых запросов. Атакующий заставляет пользователя выполнить нежелательное действие на сайте, где он авторизован.

**Как работает атака:**
1. Пользователь залогинен на site.com
2. Открывает evil.com
3. evil.com отправляет POST запрос на site.com
4. Запрос выполняется от имени пользователя

---

## Как работает

**Пример CSRF атаки:**

```html
<!-- evil.com -->
<form action="https://bank.com/transfer" method="POST">
    <input type="hidden" name="to" value="attacker">
    <input type="hidden" name="amount" value="10000">
</form>
<script>
    document.forms[0].submit();  // Автоматически отправить
</script>

<!-- Если пользователь залогинен на bank.com,
     перевод выполнится без его ведома -->
```

**Защита через CSRF токен:**

```php
// ❌ УЯЗВИМЫЙ код (без CSRF)
Route::post('/transfer', function (Request $request) {
    $user = auth()->user();
    $user->balance -= $request->input('amount');
    // Перевод выполнится
});

// ✅ ЗАЩИТА: CSRF токен (Laravel по умолчанию)
// В форме
<form method="POST" action="/transfer">
    @csrf  <!-- Генерирует скрытое поле с токеном -->
    <input type="number" name="amount">
    <button type="submit">Перевести</button>
</form>

// Laravel автоматически проверяет токен через middleware
// app/Http/Kernel.php
protected $middlewareGroups = [
    'web' => [
        \App\Http\Middleware\VerifyCsrfToken::class,  // CSRF защита
    ],
];
```

**CSRF токен в JavaScript:**

```javascript
// Laravel автоматически добавляет токен в meta tag
<meta name="csrf-token" content="{{ csrf_token() }}">

// Axios автоматически добавляет в заголовок
// resources/js/bootstrap.js
window.axios.defaults.headers.common['X-CSRF-TOKEN'] = document
    .querySelector('meta[name="csrf-token"]')
    .getAttribute('content');

// Fetch вручную
fetch('/api/endpoint', {
    method: 'POST',
    headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
});
```

---

## Когда использовать

**CSRF защита нужна для:**
- ✅ POST, PUT, DELETE запросов
- ✅ Изменение данных (перевод, покупка, удаление)
- ✅ Веб-формы

**CSRF НЕ нужна для:**
- ❌ GET запросов (только чтение)
- ❌ API с токенами (Sanctum, Passport)
- ❌ Stateless API

---

## Пример из практики

**Исключение из CSRF проверки:**

```php
// app/Http/Middleware/VerifyCsrfToken.php
class VerifyCsrfToken extends Middleware
{
    // Исключить из CSRF проверки
    protected $except = [
        'webhook/*',  // Webhooks от внешних сервисов
        'api/*',      // API endpoints (используют токены)
    ];
}
```

**CSRF для AJAX:**

```javascript
// Vue.js компонент
export default {
    methods: {
        async submitForm() {
            try {
                const response = await axios.post('/api/posts', {
                    title: this.title,
                    body: this.body,
                });
                // CSRF токен добавлен автоматически через Axios
            } catch (error) {
                if (error.response.status === 419) {
                    alert('CSRF token mismatch. Refresh the page.');
                }
            }
        }
    }
}
```

**SameSite cookies (дополнительная защита):**

```php
// config/session.php
'same_site' => 'lax',  // Или 'strict'

// SameSite атрибуты:
// - 'strict' — cookie не отправляется с внешних сайтов (сильная защита)
// - 'lax' — cookie отправляется только для GET (баланс)
// - 'none' — cookie отправляется всегда (нужен для iframe)
```

**Double Submit Cookie (альтернатива):**

```php
// Альтернативный метод CSRF защиты
class DoubleSubmitCsrfMiddleware
{
    public function handle($request, Closure $next)
    {
        if ($request->isMethod('POST')) {
            $cookieToken = $request->cookie('csrf_token');
            $headerToken = $request->header('X-CSRF-TOKEN');

            if ($cookieToken !== $headerToken) {
                abort(419, 'CSRF token mismatch');
            }
        }

        return $next($request);
    }
}
```

**Sanctum для API (без CSRF):**

```php
// API использует токены вместо сессий
Route::middleware('auth:sanctum')->post('/posts', function (Request $request) {
    // CSRF не нужен (stateless)
    return Post::create($request->all());
});

// Клиент отправляет Bearer token
fetch('/api/posts', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,  // Вместо CSRF
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
});
```

**Проверка referer (дополнительно):**

```php
class CheckRefererMiddleware
{
    public function handle($request, Closure $next)
    {
        $referer = $request->headers->get('referer');

        if ($referer && !str_starts_with($referer, config('app.url'))) {
            abort(403, 'Invalid referer');
        }

        return $next($request);
    }
}
```

**Тестирование CSRF:**

```php
// tests/Feature/CsrfTest.php
class CsrfTest extends TestCase
{
    public function test_post_without_csrf_token_fails(): void
    {
        $response = $this->post('/posts', [
            'title' => 'Test',
            'body' => 'Content',
        ]);

        $response->assertStatus(419);  // CSRF token mismatch
    }

    public function test_post_with_csrf_token_succeeds(): void
    {
        $response = $this->post('/posts', [
            'title' => 'Test',
            'body' => 'Content',
            '_token' => csrf_token(),
        ]);

        $response->assertStatus(302);
    }

    public function test_csrf_token_regenerates_on_login(): void
    {
        $oldToken = csrf_token();

        $this->post('/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $newToken = csrf_token();

        $this->assertNotEquals($oldToken, $newToken);
    }
}
```

**CSRF в SPA (Single Page Application):**

```php
// routes/web.php
Route::get('/sanctum/csrf-cookie', function () {
    // Инициализирует CSRF cookie для SPA
    return response()->noContent();
});

// JavaScript (первый запрос)
await axios.get('/sanctum/csrf-cookie');

// Теперь все запросы будут с CSRF
await axios.post('/api/posts', data);
```

---

## На собеседовании скажешь

> "CSRF — подделка запросов с другого сайта. Laravel защищает через CSRF токен (@csrf в формах). VerifyCsrfToken middleware проверяет токен в POST/PUT/DELETE. X-CSRF-TOKEN header для AJAX (Axios добавляет автоматически). SameSite cookies дополнительная защита. API с токенами (Sanctum) не нужна CSRF защита (stateless). Исключения через $except в VerifyCsrfToken. Ошибка 419 при несовпадении токена. Токен регенерируется при логине."

---

## Практические задания

### Задание 1: Исправь CSRF ошибку в AJAX

У тебя есть Vue компонент который отправляет POST запрос, но получает 419 ошибку. Исправь.

```javascript
// PostForm.vue
export default {
    data() {
        return {
            title: '',
            body: '',
        }
    },
    methods: {
        async submit() {
            const response = await fetch('/api/posts', {
                method: 'POST',
                body: JSON.stringify({
                    title: this.title,
                    body: this.body,
                }),
            });
        }
    }
}
```

<details>
<summary>Решение</summary>

```javascript
// Решение 1: Добавить CSRF токен в заголовок
export default {
    data() {
        return {
            title: '',
            body: '',
        }
    },
    methods: {
        async submit() {
            const token = document.querySelector('meta[name="csrf-token"]').content;

            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                },
                body: JSON.stringify({
                    title: this.title,
                    body: this.body,
                }),
            });
        }
    }
}

// В layout.blade.php (добавить meta tag)
<head>
    <meta name="csrf-token" content="{{ csrf_token() }}">
</head>

// Решение 2: Использовать Axios (автоматически добавляет токен)
// resources/js/bootstrap.js
import axios from 'axios';
window.axios = axios;
window.axios.defaults.headers.common['X-CSRF-TOKEN'] =
    document.querySelector('meta[name="csrf-token"]').content;

// В компоненте
export default {
    methods: {
        async submit() {
            const response = await axios.post('/api/posts', {
                title: this.title,
                body: this.body,
            });
        }
    }
}
```
</details>

### Задание 2: Настрой CSRF исключения для webhook

У тебя есть webhook endpoint от Stripe который не проходит CSRF проверку. Настрой исключение.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/VerifyCsrfToken.php
<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * URIs которые исключены из CSRF проверки
     */
    protected $except = [
        'webhooks/stripe',         // Конкретный endpoint
        'webhooks/*',              // Все webhooks
        'api/*',                   // Все API routes (если используют токены)
    ];
}

// routes/web.php
Route::post('/webhooks/stripe', [StripeWebhookController::class, 'handle'])
    ->name('webhooks.stripe');

// StripeWebhookController
class StripeWebhookController extends Controller
{
    public function handle(Request $request)
    {
        // Проверка подписи Stripe вместо CSRF
        $signature = $request->header('Stripe-Signature');
        $webhookSecret = config('services.stripe.webhook_secret');

        try {
            $event = \Stripe\Webhook::constructEvent(
                $request->getContent(),
                $signature,
                $webhookSecret
            );

            // Обработка webhook
            match ($event->type) {
                'payment_intent.succeeded' => $this->handlePaymentSucceeded($event),
                'customer.subscription.deleted' => $this->handleSubscriptionDeleted($event),
                default => null,
            };

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
```
</details>

### Задание 3: Реализуй CSRF для SPA

Настрой CSRF защиту для Single Page Application с Laravel Sanctum.

<details>
<summary>Решение</summary>

```php
// 1. Настройка Sanctum
// config/sanctum.php
return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
    ))),

    'middleware' => [
        'verify_csrf_token' => App\Http\Middleware\VerifyCsrfToken::class,
        'encrypt_cookies' => App\Http\Middleware\EncryptCookies::class,
    ],
];

// 2. Route для инициализации CSRF cookie
// routes/web.php
Route::get('/sanctum/csrf-cookie', function () {
    return response()->noContent();
});

// 3. Axios setup в SPA
// src/api/client.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000',
    withCredentials: true, // Важно! Отправлять cookies
});

// Инициализация CSRF перед первым запросом
let csrfInitialized = false;

api.interceptors.request.use(async (config) => {
    if (!csrfInitialized && config.method !== 'get') {
        await axios.get('http://localhost:8000/sanctum/csrf-cookie', {
            withCredentials: true,
        });
        csrfInitialized = true;
    }
    return config;
});

export default api;

// 4. Использование в компоненте
// src/components/LoginForm.vue
import api from '@/api/client';

export default {
    methods: {
        async login() {
            try {
                // CSRF cookie будет добавлен автоматически
                const response = await api.post('/api/login', {
                    email: this.email,
                    password: this.password,
                });

                console.log('Logged in:', response.data);
            } catch (error) {
                console.error('Login failed:', error);
            }
        }
    }
}

// 5. config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:3000')],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true, // Важно!
];
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
