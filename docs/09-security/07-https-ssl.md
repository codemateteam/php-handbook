# 8.7 HTTPS / SSL

## Краткое резюме

> **HTTPS (SSL/TLS)** — протокол защищённой передачи данных через интернет с шифрованием трафика между клиентом и сервером.
>
> **Защита:** Предотвращает Man-in-the-Middle атаки, прослушивание трафика, кражу паролей и cookies.
>
> **Важно:** Let's Encrypt для бесплатных сертификатов, HSTS header для принудительного HTTPS, TrustProxies middleware для корректной работы за load balancer.

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
HTTPS — HTTP поверх SSL/TLS. Шифрует трафик между клиентом и сервером. Защищает от прослушивания и MITM атак.

**Зачем нужен:**
- Шифрование данных
- Защита от Man-in-the-Middle
- SEO boost (Google)
- Доверие пользователей

---

## Как работает

**Получить SSL сертификат:**

```bash
# Let's Encrypt (бесплатный)
sudo certbot --nginx -d example.com -d www.example.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

**Настройка в Laravel:**

```php
// .env
APP_URL=https://example.com

// config/app.php
'url' => env('APP_URL', 'https://example.com'),

// Middleware для принудительного HTTPS
// app/Http/Middleware/ForceHttps.php
class ForceHttps
{
    public function handle($request, Closure $next)
    {
        if (!$request->secure() && app()->environment('production')) {
            return redirect()->secure($request->getRequestUri());
        }

        return $next($request);
    }
}

// Зарегистрировать в Kernel.php
protected $middleware = [
    \App\Http\Middleware\ForceHttps::class,
];
```

**Trust Proxies (для load balancers):**

```php
// app/Http/Middleware/TrustProxies.php
class TrustProxies extends Middleware
{
    protected $proxies = '*';  // Доверять всем прокси

    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
```

---

## Когда использовать

**Всегда используй HTTPS:**
- ✅ Production (обязательно)
- ✅ Staging (рекомендуется)
- ❌ Local dev (необязательно, но можно)

---

## Пример из практики

**Nginx конфигурация:**

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP → HTTPS
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    root /var/www/html/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
    }
}
```

**HSTS (HTTP Strict Transport Security):**

```php
// app/Http/Middleware/AddSecurityHeaders.php
class AddSecurityHeaders
{
    public function handle($request, Closure $next)
    {
        $response = $next($request);

        // Принудительный HTTPS на 1 год
        $response->headers->set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );

        return $response;
    }
}
```

**Mixed Content (HTTP на HTTPS странице):**

```blade
{{-- ❌ ПЛОХО: HTTP на HTTPS странице --}}
<script src="http://example.com/script.js"></script>

{{-- ✅ ХОРОШО: HTTPS --}}
<script src="https://example.com/script.js"></script>

{{-- ✅ ХОРОШО: Protocol-relative URL --}}
<script src="//example.com/script.js"></script>

{{-- ✅ ХОРОШО: asset() автоматически использует правильный протокол --}}
<script src="{{ asset('js/app.js') }}"></script>
```

**SSL для локальной разработки:**

```bash
# Valet (macOS)
valet secure example.test

# Laravel Homestead (автоматически)
# https://homestead.test

# mkcert (любая ОС)
brew install mkcert
mkcert -install
mkcert example.test "*.example.test"

# Использовать в nginx
ssl_certificate example.test.pem;
ssl_certificate_key example.test-key.pem;
```

**Проверка SSL конфигурации:**

```bash
# SSL Labs
https://www.ssllabs.com/ssltest/analyze.html?d=example.com

# OpenSSL
openssl s_client -connect example.com:443

# Curl
curl -I https://example.com

# Проверить сертификат
openssl x509 -in cert.pem -text -noout
```

**Обработка ошибок SSL:**

```php
// app/Exceptions/Handler.php
public function render($request, Throwable $exception)
{
    if ($exception instanceof \Illuminate\Http\Client\RequestException) {
        if (str_contains($exception->getMessage(), 'SSL')) {
            Log::error('SSL Error', ['message' => $exception->getMessage()]);
            return response()->json(['error' => 'SSL connection failed'], 500);
        }
    }

    return parent::render($request, $exception);
}
```

**CloudFlare (CDN с SSL):**

```nginx
# Получить реальный IP через CloudFlare
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
# ... другие CloudFlare IP ranges
real_ip_header CF-Connecting-IP;
```

```php
// TrustProxies для CloudFlare
protected $proxies = [
    '103.21.244.0/22',
    '103.22.200.0/22',
    // ...
];
```

**Cookies через HTTPS:**

```php
// config/session.php
'secure' => env('SESSION_SECURE_COOKIE', true),  // Только HTTPS

// Вручную
return response('Content')->cookie(
    'name',
    'value',
    $minutes = 60,
    $path = '/',
    $domain = null,
    $secure = true,  // Только HTTPS
    $httpOnly = true
);
```

---

## На собеседовании скажешь

> "HTTPS шифрует трафик через SSL/TLS. Let's Encrypt для бесплатных сертификатов. Force HTTPS через middleware (redirect()->secure()). HSTS header принудительно использует HTTPS (max-age). Trust Proxies для правильного определения протокола за load balancer. asset() автоматически генерирует правильный URL. Mixed Content — HTTP ресурсы на HTTPS странице (блокируются). SESSION_SECURE_COOKIE=true для cookies только через HTTPS. SSL Labs для проверки конфигурации."

---

## Практические задания

### Задание 1: Создай middleware для принудительного HTTPS

Реализуй middleware который редиректит все HTTP запросы на HTTPS в production.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/ForceHttps.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceHttps
{
    /**
     * Редирект на HTTPS в production
     */
    public function handle(Request $request, Closure $next)
    {
        // Проверка только в production
        if (!app()->environment('local')) {
            // Проверить, что запрос не через HTTPS
            if (!$request->secure()) {
                return redirect()->secure($request->getRequestUri(), 301);
            }
        }

        return $next($request);
    }
}

// Альтернатива: проверка через заголовки (для load balancers)
class ForceHttps
{
    public function handle(Request $request, Closure $next)
    {
        if (!app()->environment('local')) {
            // Проверить X-Forwarded-Proto header (от load balancer)
            $proto = $request->header('X-Forwarded-Proto');

            if ($proto !== 'https' && !$request->secure()) {
                return redirect()->secure($request->getRequestUri(), 301);
            }
        }

        return $next($request);
    }
}

// Регистрация в app/Http/Kernel.php
protected $middleware = [
    // ...
    \App\Http\Middleware\ForceHttps::class,
];

// Альтернатива 2: использовать встроенный метод
class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (!app()->environment('local')) {
            URL::forceScheme('https');
        }
    }
}

// Альтернатива 3: Nginx редирект
// nginx.conf
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

// Альтернатива 4: через .htaccess (Apache)
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
</IfModule>
```
</details>

### Задание 2: Настрой Security Headers

Создай middleware для добавления всех необходимых security заголовков включая HSTS.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/SecurityHeaders.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // HSTS: Принудительный HTTPS на 1 год
        $response->headers->set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );

        // Предотвратить clickjacking
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Предотвратить MIME type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // XSS Protection (устарело, но для старых браузеров)
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Content Security Policy
        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]);
        $response->headers->set('Content-Security-Policy', $csp);

        // Referrer Policy
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions Policy (замена Feature-Policy)
        $permissions = implode(', ', [
            'geolocation=()',
            'microphone=()',
            'camera=()',
            'payment=()',
            'usb=()',
        ]);
        $response->headers->set('Permissions-Policy', $permissions);

        return $response;
    }
}

// Регистрация
protected $middleware = [
    // ...
    \App\Http\Middleware\SecurityHeaders::class,
];

// Альтернатива: использовать пакет
composer require bepsvpt/secure-headers

// config/secure-headers.php (после publish)
return [
    'hsts' => [
        'enable' => true,
        'max-age' => 31536000,
        'include-sub-domains' => true,
        'preload' => true,
    ],

    'x-frame-options' => 'SAMEORIGIN',

    'x-content-type-options' => 'nosniff',

    'csp' => [
        'enable' => true,
        'default-src' => [
            'self',
        ],
        'script-src' => [
            'self',
            'unsafe-inline',
        ],
    ],
];

// Тест заголовков
class SecurityHeadersTest extends TestCase
{
    public function test_security_headers_are_present(): void
    {
        $response = $this->get('/');

        $response->assertHeader('Strict-Transport-Security');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Content-Security-Policy');
    }
}
```
</details>

### Задание 3: Настрой TrustProxies для AWS/CloudFlare

Настрой корректную работу приложения за load balancer или CloudFlare.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/TrustProxies.php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * Доверенные прокси
     *
     * Вариант 1: Доверять всем прокси (для AWS ELB, GCP Load Balancer)
     */
    protected $proxies = '*';

    /**
     * Вариант 2: Конкретные IP адреса (для CloudFlare)
     */
    // protected $proxies = [
    //     // CloudFlare IPv4
    //     '173.245.48.0/20',
    //     '103.21.244.0/22',
    //     '103.22.200.0/22',
    //     '103.31.4.0/22',
    //     '141.101.64.0/18',
    //     '108.162.192.0/18',
    //     '190.93.240.0/20',
    //     '188.114.96.0/20',
    //     '197.234.240.0/22',
    //     '198.41.128.0/17',
    //     '162.158.0.0/15',
    //     '104.16.0.0/13',
    //     '104.24.0.0/14',
    //     '172.64.0.0/13',
    //     '131.0.72.0/22',
    // ];

    /**
     * Заголовки которые должны быть доверены
     */
    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}

// .env настройки
APP_URL=https://example.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

// Nginx конфигурация (за load balancer)
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}

// CloudFlare настройки
// 1. В CloudFlare: SSL/TLS -> Full (Strict)
// 2. Включить "Always Use HTTPS"
// 3. Включить HSTS

// app/Http/Middleware/CloudFlareProxies.php
class CloudFlareProxies extends Middleware
{
    protected $proxies;

    public function __construct()
    {
        // Динамически получить IP CloudFlare
        $this->proxies = $this->getCloudFlareIPs();
    }

    private function getCloudFlareIPs(): array
    {
        // Кешировать на 1 день
        return cache()->remember('cloudflare_ips', 86400, function () {
            try {
                $ipv4 = file_get_contents('https://www.cloudflare.com/ips-v4');
                $ipv6 = file_get_contents('https://www.cloudflare.com/ips-v6');

                return array_merge(
                    explode("\n", trim($ipv4)),
                    explode("\n", trim($ipv6))
                );
            } catch (\Exception $e) {
                // Fallback на все прокси если не удалось получить
                return ['*'];
            }
        });
    }

    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_CF_CONNECTING_IP; // CloudFlare header
}

// Проверка правильности определения IP и протокола
Route::get('/debug-request', function (Request $request) {
    return response()->json([
        'ip' => $request->ip(),
        'scheme' => $request->getScheme(),
        'secure' => $request->secure(),
        'host' => $request->getHost(),
        'headers' => [
            'X-Forwarded-For' => $request->header('X-Forwarded-For'),
            'X-Forwarded-Proto' => $request->header('X-Forwarded-Proto'),
            'X-Forwarded-Host' => $request->header('X-Forwarded-Host'),
            'CF-Connecting-IP' => $request->header('CF-Connecting-IP'),
        ],
    ]);
})->middleware('auth');

// Test
class TrustProxiesTest extends TestCase
{
    public function test_https_is_detected_behind_proxy(): void
    {
        $response = $this->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-For' => '1.2.3.4',
        ])->get('/');

        $this->assertTrue($response->baseResponse->isSecure());
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
