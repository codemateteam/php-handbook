# 8.8 OWASP Top 10

## Краткое резюме

> **OWASP Top 10** — список десяти самых критичных уязвимостей веб-приложений, обновляемый каждые 3-4 года.
>
> **Основные угрозы:** Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration.
>
> **Важно:** composer audit для проверки зависимостей, APP_DEBUG=false в production, Gate/Policy для контроля доступа, Query Builder против SQL Injection.

---

## Содержание

- [Что это](#что-это)
- [Как защищаться](#как-защищаться)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
OWASP Top 10 — список 10 самых критичных уязвимостей веб-приложений. Обновляется каждые 3-4 года.

**OWASP Top 10 (2021):**
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)

---

## Как защищаться

**1. Broken Access Control:**

```php
// ❌ ПЛОХО: нет проверки прав
Route::put('/posts/{post}', function (Post $post) {
    $post->update(request()->all());
});

// ✅ ХОРОШО: проверка через Policy
Route::put('/posts/{post}', function (Post $post) {
    Gate::authorize('update', $post);
    $post->update(request()->validated());
});

// ✅ Middleware
Route::middleware('can:update,post')->put('/posts/{post}', ...);
```

**2. Cryptographic Failures:**

```php
// ❌ ПЛОХО: plain text пароли
User::create(['password' => $request->password]);

// ✅ ХОРОШО: хеширование
User::create(['password' => Hash::make($request->password)]);

// ✅ Шифрование чувствительных данных
$user->credit_card = Crypt::encryptString($request->credit_card);

// ✅ HTTPS обязательно
// Middleware ForceHttps
```

**3. Injection (SQL, XSS, Command):**

```php
// ❌ SQL Injection
DB::select("SELECT * FROM users WHERE email = '{$email}'");

// ✅ Prepared statements
DB::table('users')->where('email', $email)->get();

// ❌ XSS
{!! $user->bio !!}

// ✅ Экранирование
{{ $user->bio }}

// ❌ Command Injection
exec("ping -c 4 {$request->host}");

// ✅ Валидация и экранирование
$host = escapeshellarg($request->host);
exec("ping -c 4 {$host}");
```

**4. Insecure Design:**

```php
// ❌ ПЛОХО: отсутствие rate limiting
Route::post('/login', [AuthController::class, 'login']);

// ✅ ХОРОШО: rate limiting
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');  // 5 попыток в минуту

// ✅ Email verification
class User extends Authenticatable implements MustVerifyEmail {}

// ✅ 2FA
// Использовать google2fa или аналог
```

**5. Security Misconfiguration:**

```php
// ❌ ПЛОХО: debug в production
// .env
APP_DEBUG=true  // ❌

// ✅ ХОРОШО
APP_DEBUG=false

// ❌ Default credentials
DB_USERNAME=root
DB_PASSWORD=

// ✅ Сильные пароли
DB_PASSWORD=random_strong_password

// ✅ Отключить ненужные методы HTTP
// Nginx
limit_except GET POST { deny all; }

// ✅ Удалить неиспользуемые зависимости
composer remove unused/package
```

**6. Vulnerable Components:**

```bash
# ✅ Регулярно обновлять зависимости
composer update

# ✅ Проверка уязвимостей
composer audit

# ✅ Обновить Laravel
composer require laravel/framework:^10.0

# ✅ Обновить PHP
# Использовать последнюю стабильную версию PHP
```

**7. Authentication Failures:**

```php
// ❌ ПЛОХО: слабые пароли
'password' => 'required|min:6'

// ✅ ХОРОШО: сильные пароли
'password' => 'required|min:8|confirmed|regex:/[A-Z]/|regex:/[0-9]/'

// ✅ Rate limiting
RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->ip());
});

// ✅ MFA
// Использовать 2FA через google2fa

// ✅ Session timeout
// config/session.php
'lifetime' => 120,  // 2 часа
```

**8. Software and Data Integrity Failures:**

```php
// ✅ Проверка целостности загружаемых файлов
$request->validate([
    'file' => 'required|file|mimes:pdf,docx|max:10240',
]);

// ✅ Signed URLs
$url = URL::temporarySignedRoute('download', now()->addMinutes(30), ['file' => $fileId]);

// ✅ CSRF токены
@csrf

// ✅ Subresource Integrity (SRI) для CDN
<script src="https://cdn.example.com/script.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

**9. Security Logging and Monitoring:**

```php
// ✅ Логирование критичных событий
use Illuminate\Support\Facades\Log;

// Логин
Log::info('User logged in', ['user_id' => $user->id, 'ip' => $request->ip()]);

// Неудачная попытка
Log::warning('Failed login attempt', ['email' => $email, 'ip' => $request->ip()]);

// Изменение пароля
Log::info('Password changed', ['user_id' => $user->id]);

// Удаление важных данных
Log::warning('Post deleted', ['post_id' => $post->id, 'user_id' => $user->id]);

// ✅ Мониторинг с алертами
// Sentry, Bugsnag, Laravel Telescope

// ✅ Ротация логов
// config/logging.php
'daily' => [
    'driver' => 'daily',
    'path' => storage_path('logs/laravel.log'),
    'level' => 'debug',
    'days' => 14,  // Хранить 14 дней
],
```

**10. Server-Side Request Forgery (SSRF):**

```php
// ❌ ПЛОХО: загрузка из user-provided URL
$url = $request->input('url');
$content = file_get_contents($url);  // SSRF уязвимость

// ✅ ХОРОШО: whitelist доменов
$allowedDomains = ['example.com', 'api.example.com'];
$parsedUrl = parse_url($url);

if (!in_array($parsedUrl['host'], $allowedDomains)) {
    abort(403, 'Invalid domain');
}

$content = file_get_contents($url);

// ✅ Блокировать internal IPs
$ip = gethostbyname($parsedUrl['host']);

if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    $content = file_get_contents($url);
} else {
    abort(403, 'Internal IP blocked');
}
```

**Общие Security Headers:**

```php
// app/Http/Middleware/SecurityHeaders.php
class SecurityHeaders
{
    public function handle($request, Closure $next)
    {
        $response = $next($request);

        return $response
            ->header('X-Content-Type-Options', 'nosniff')
            ->header('X-Frame-Options', 'SAMEORIGIN')
            ->header('X-XSS-Protection', '1; mode=block')
            ->header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
            ->header('Content-Security-Policy', "default-src 'self'")
            ->header('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->header('Permissions-Policy', 'geolocation=(), microphone=()');
    }
}
```

**Security Checklist:**

```php
// .env
APP_DEBUG=false  ✅
APP_ENV=production  ✅
SESSION_SECURE_COOKIE=true  ✅
SESSION_SAME_SITE=lax  ✅

// Composer
composer audit  ✅

// Permissions
chmod 644 .env  ✅
chmod 755 storage bootstrap/cache  ✅

// HTTPS
Force HTTPS middleware  ✅
HSTS header  ✅

// Защита
CSRF tokens  ✅
XSS escaping  ✅
SQL injection (Query Builder)  ✅
Rate limiting  ✅
Strong passwords  ✅
Email verification  ✅

// Логирование
Security events logging  ✅
Monitoring (Sentry)  ✅
```

---

## На собеседовании скажешь

> "OWASP Top 10 — критичные уязвимости. 1) Access Control — Gate/Policy. 2) Crypto — Hash::make(), Crypt::encrypt(). 3) Injection — Query Builder, {{ }}. 4) Design — rate limiting, 2FA. 5) Misconfiguration — APP_DEBUG=false. 6) Components — composer audit. 7) Auth — сильные пароли, MFA. 8) Integrity — signed URLs, CSRF. 9) Logging — Log::info() для критичных событий. 10) SSRF — whitelist доменов, блокировать internal IP. Security headers: X-Frame-Options, CSP, HSTS."

---

## Практические задания

### Задание 1: Проведи Security Audit приложения

Создай checklist и проверь Laravel приложение на основные уязвимости из OWASP Top 10.

<details>
<summary>Решение</summary>

```php
// security-audit.php (консольная команда)
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class SecurityAudit extends Command
{
    protected $signature = 'security:audit';
    protected $description = 'Проверка безопасности приложения';

    private array $issues = [];

    public function handle()
    {
        $this->info('🔍 Начинаю проверку безопасности...');
        $this->newLine();

        $this->checkEnvironment();
        $this->checkDependencies();
        $this->checkConfiguration();
        $this->checkFiles();
        $this->checkDatabase();
        $this->checkRoutes();

        $this->newLine();
        $this->displayResults();
    }

    private function checkEnvironment(): void
    {
        $this->info('1. Проверка окружения...');

        // APP_DEBUG
        if (config('app.debug') === true && app()->environment('production')) {
            $this->addIssue('HIGH', 'APP_DEBUG=true в production');
        } else {
            $this->success('APP_DEBUG корректно');
        }

        // APP_KEY
        if (empty(config('app.key'))) {
            $this->addIssue('CRITICAL', 'APP_KEY не установлен');
        } else {
            $this->success('APP_KEY установлен');
        }

        // SESSION_SECURE_COOKIE
        if (!config('session.secure') && app()->environment('production')) {
            $this->addIssue('MEDIUM', 'SESSION_SECURE_COOKIE должен быть true');
        } else {
            $this->success('SESSION_SECURE_COOKIE корректно');
        }
    }

    private function checkDependencies(): void
    {
        $this->info('2. Проверка зависимостей...');

        // Запустить composer audit
        exec('composer audit --format=json 2>&1', $output, $returnCode);

        if ($returnCode !== 0) {
            $this->addIssue('HIGH', 'Найдены уязвимые зависимости (composer audit)');
        } else {
            $this->success('Зависимости безопасны');
        }

        // Проверить версию PHP
        if (version_compare(PHP_VERSION, '8.1.0', '<')) {
            $this->addIssue('MEDIUM', 'Устаревшая версия PHP: ' . PHP_VERSION);
        } else {
            $this->success('PHP версия: ' . PHP_VERSION);
        }
    }

    private function checkConfiguration(): void
    {
        $this->info('3. Проверка конфигурации...');

        // CSRF protection
        $csrfMiddleware = file_get_contents(app_path('Http/Kernel.php'));
        if (!str_contains($csrfMiddleware, 'VerifyCsrfToken')) {
            $this->addIssue('CRITICAL', 'CSRF middleware не найден');
        } else {
            $this->success('CSRF protection включен');
        }

        // CORS настройки
        if (config('cors.supports_credentials') && config('cors.allowed_origins')[0] === '*') {
            $this->addIssue('HIGH', 'CORS: supports_credentials=true с allowed_origins=*');
        } else {
            $this->success('CORS настроен корректно');
        }
    }

    private function checkFiles(): void
    {
        $this->info('4. Проверка файлов...');

        // .env в публичной директории
        if (File::exists(public_path('.env'))) {
            $this->addIssue('CRITICAL', '.env файл в public директории');
        } else {
            $this->success('.env не в public');
        }

        // Права на файлы
        $permissions = substr(sprintf('%o', fileperms(base_path('.env'))), -4);
        if ($permissions !== '0644') {
            $this->addIssue('MEDIUM', ".env имеет права {$permissions} (должно быть 0644)");
        } else {
            $this->success('Права на .env корректны');
        }
    }

    private function checkDatabase(): void
    {
        $this->info('5. Проверка базы данных...');

        // Default credentials
        if (config('database.connections.mysql.username') === 'root' &&
            empty(config('database.connections.mysql.password'))) {
            $this->addIssue('CRITICAL', 'БД использует root без пароля');
        } else {
            $this->success('БД credentials корректны');
        }

        // Проверить наличие пользователей без пароля
        try {
            $usersWithoutPassword = DB::table('users')
                ->whereNull('password')
                ->orWhere('password', '')
                ->count();

            if ($usersWithoutPassword > 0) {
                $this->addIssue('HIGH', "{$usersWithoutPassword} пользователей без пароля");
            } else {
                $this->success('Все пользователи имеют пароли');
            }
        } catch (\Exception $e) {
            $this->warn('Не удалось проверить пользователей: ' . $e->getMessage());
        }
    }

    private function checkRoutes(): void
    {
        $this->info('6. Проверка маршрутов...');

        $routes = \Route::getRoutes();
        $unprotectedRoutes = [];

        foreach ($routes as $route) {
            $middleware = $route->middleware();

            // Проверить POST/PUT/DELETE без CSRF
            if (in_array($route->methods()[0], ['POST', 'PUT', 'DELETE', 'PATCH'])) {
                if (!in_array('web', $middleware) && !in_array('api', $middleware)) {
                    $unprotectedRoutes[] = $route->uri();
                }
            }
        }

        if (!empty($unprotectedRoutes)) {
            $this->addIssue('HIGH', 'Маршруты без middleware: ' . implode(', ', $unprotectedRoutes));
        } else {
            $this->success('Все маршруты защищены');
        }
    }

    private function addIssue(string $severity, string $message): void
    {
        $this->issues[] = compact('severity', 'message');

        $color = match($severity) {
            'CRITICAL' => 'red',
            'HIGH' => 'yellow',
            'MEDIUM' => 'blue',
            default => 'gray',
        };

        $this->line("  <fg={$color}>[{$severity}]</> {$message}");
    }

    private function success(string $message): void
    {
        $this->line("  <fg=green>✓</> {$message}");
    }

    private function displayResults(): void
    {
        if (empty($this->issues)) {
            $this->info('✅ Проблем не найдено!');
            return;
        }

        $this->error('❌ Найдено проблем: ' . count($this->issues));
        $this->newLine();

        $critical = array_filter($this->issues, fn($i) => $i['severity'] === 'CRITICAL');
        $high = array_filter($this->issues, fn($i) => $i['severity'] === 'HIGH');
        $medium = array_filter($this->issues, fn($i) => $i['severity'] === 'MEDIUM');

        $this->table(
            ['Severity', 'Count'],
            [
                ['CRITICAL', count($critical)],
                ['HIGH', count($high)],
                ['MEDIUM', count($medium)],
            ]
        );

        $this->newLine();
        $this->warn('Рекомендуется исправить все критические проблемы перед деплоем!');
    }
}

// Запуск
php artisan security:audit
```
</details>

### Задание 2: Реализуй защиту от SSRF

Создай сервис для безопасного fetch внешних URL с защитой от SSRF атак.

<details>
<summary>Решение</summary>

```php
// app/Services/SafeHttpClient.php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

class SafeHttpClient
{
    private const ALLOWED_SCHEMES = ['http', 'https'];
    private const BLOCKED_IP_RANGES = [
        // Приватные сети
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8',
        // Loopback
        '::1/128',
        // Link-local
        '169.254.0.0/16',
        'fe80::/10',
    ];

    private array $allowedDomains = [];
    private int $timeout = 5;

    public function __construct(array $allowedDomains = [])
    {
        $this->allowedDomains = $allowedDomains;
    }

    /**
     * Безопасный GET запрос
     */
    public function get(string $url): array
    {
        $this->validateUrl($url);

        try {
            $response = Http::timeout($this->timeout)
                ->withOptions([
                    'allow_redirects' => [
                        'max' => 3,
                        'protocols' => ['https'], // Только HTTPS редиректы
                    ],
                ])
                ->get($url);

            return [
                'success' => true,
                'status' => $response->status(),
                'body' => $response->body(),
                'headers' => $response->headers(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Валидация URL
     */
    private function validateUrl(string $url): void
    {
        // 1. Базовая валидация URL
        $validator = Validator::make(['url' => $url], [
            'url' => 'required|url|max:2048',
        ]);

        if ($validator->fails()) {
            throw new \InvalidArgumentException('Invalid URL format');
        }

        // 2. Парсинг URL
        $parsed = parse_url($url);

        if (!$parsed || !isset($parsed['host'])) {
            throw new \InvalidArgumentException('Invalid URL');
        }

        // 3. Проверка схемы
        if (!in_array($parsed['scheme'] ?? '', self::ALLOWED_SCHEMES)) {
            throw new \InvalidArgumentException('Invalid URL scheme');
        }

        // 4. Whitelist доменов (если задан)
        if (!empty($this->allowedDomains)) {
            if (!in_array($parsed['host'], $this->allowedDomains)) {
                throw new \InvalidArgumentException('Domain not allowed');
            }
        }

        // 5. Блокировать приватные IP
        $this->validateIp($parsed['host']);

        // 6. Блокировать специальные домены
        $blockedDomains = ['localhost', 'metadata.google.internal', '169.254.169.254'];
        if (in_array(strtolower($parsed['host']), $blockedDomains)) {
            throw new \InvalidArgumentException('Blocked domain');
        }
    }

    /**
     * Проверка IP адреса
     */
    private function validateIp(string $host): void
    {
        // Получить IP адрес хоста
        $ip = gethostbyname($host);

        // Если хост не резолвится, gethostbyname возвращает сам хост
        if ($ip === $host && !filter_var($ip, FILTER_VALIDATE_IP)) {
            return; // Это не IP адрес
        }

        // Проверить что IP не приватный
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new \InvalidArgumentException('Private IP addresses are blocked');
        }

        // Проверить IP в блок-листе
        foreach (self::BLOCKED_IP_RANGES as $range) {
            if ($this->ipInRange($ip, $range)) {
                throw new \InvalidArgumentException("IP {$ip} is in blocked range");
            }
        }
    }

    /**
     * Проверка IP в диапазоне CIDR
     */
    private function ipInRange(string $ip, string $range): bool
    {
        if (str_contains($range, '/')) {
            [$subnet, $bits] = explode('/', $range);
            $ip = ip2long($ip);
            $subnet = ip2long($subnet);
            $mask = -1 << (32 - $bits);
            $subnet &= $mask;
            return ($ip & $mask) == $subnet;
        }

        return $ip === $range;
    }
}

// Использование
class WebhookController extends Controller
{
    public function fetchExternal(Request $request)
    {
        $validated = $request->validate([
            'url' => 'required|url',
        ]);

        // Разрешить только определённые домены
        $client = new SafeHttpClient([
            'api.example.com',
            'webhook.example.com',
        ]);

        $result = $client->get($validated['url']);

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to fetch URL',
            ], 400);
        }

        return response()->json([
            'data' => $result['body'],
        ]);
    }
}

// Тесты
class SafeHttpClientTest extends TestCase
{
    public function test_blocks_private_ips(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $client = new SafeHttpClient();
        $client->get('http://127.0.0.1');
    }

    public function test_blocks_metadata_endpoint(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $client = new SafeHttpClient();
        $client->get('http://169.254.169.254/latest/meta-data/');
    }

    public function test_allows_whitelisted_domain(): void
    {
        $client = new SafeHttpClient(['example.com']);

        $result = $client->get('https://example.com');

        $this->assertTrue($result['success']);
    }

    public function test_blocks_non_whitelisted_domain(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $client = new SafeHttpClient(['example.com']);
        $client->get('https://evil.com');
    }
}
```
</details>

### Задание 3: Создай comprehensive security middleware

Реализуй middleware который проверяет все основные аспекты безопасности запроса.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/ComprehensiveSecurity.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class ComprehensiveSecurity
{
    private const SUSPICIOUS_PATTERNS = [
        'sql' => '/(\b(SELECT|UNION|INSERT|UPDATE|DELETE|DROP)\b)/i',
        'xss' => '/<script|javascript:|onerror=|onload=/i',
        'path_traversal' => '/\.\.(\/|\\\\)/i',
        'command_injection' => '/[;&|`$]/i',
    ];

    public function handle(Request $request, Closure $next)
    {
        // 1. Rate Limiting по IP
        $this->checkRateLimit($request);

        // 2. Проверка User-Agent
        $this->validateUserAgent($request);

        // 3. Проверка на подозрительные паттерны
        $this->scanForThreats($request);

        // 4. Проверка размера запроса
        $this->validateRequestSize($request);

        // 5. Валидация Referer (для критичных операций)
        if ($this->isCriticalOperation($request)) {
            $this->validateReferer($request);
        }

        $response = $next($request);

        // 6. Добавить security headers
        $this->addSecurityHeaders($response);

        // 7. Логирование подозрительной активности
        $this->logSuspiciousActivity($request);

        return $response;
    }

    private function checkRateLimit(Request $request): void
    {
        $key = 'security:' . $request->ip();

        if (RateLimiter::tooManyAttempts($key, 100)) {
            $this->blockIp($request->ip());

            Log::warning('Rate limit exceeded', [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            abort(429, 'Too many requests');
        }

        RateLimiter::hit($key, 60);
    }

    private function validateUserAgent(Request $request): void
    {
        $userAgent = $request->userAgent();

        // Блокировать запросы без User-Agent
        if (empty($userAgent)) {
            $this->logThreat('Missing User-Agent', $request);
            abort(403, 'Invalid request');
        }

        // Блокировать подозрительные боты
        $blockedAgents = ['sqlmap', 'nikto', 'nmap', 'masscan'];

        foreach ($blockedAgents as $agent) {
            if (stripos($userAgent, $agent) !== false) {
                $this->logThreat("Blocked bot: {$agent}", $request);
                $this->blockIp($request->ip());
                abort(403, 'Forbidden');
            }
        }
    }

    private function scanForThreats(Request $request): void
    {
        $input = json_encode($request->all());

        foreach (self::SUSPICIOUS_PATTERNS as $type => $pattern) {
            if (preg_match($pattern, $input)) {
                $this->logThreat("Potential {$type} attack detected", $request);

                // Увеличить счётчик подозрительной активности
                $key = 'threats:' . $request->ip();
                $threats = RateLimiter::hit($key, 3600);

                // Блокировать после 5 угроз за час
                if ($threats > 5) {
                    $this->blockIp($request->ip());
                    abort(403, 'Suspicious activity detected');
                }

                // Не блокировать сразу, но залогировать
                return;
            }
        }
    }

    private function validateRequestSize(Request $request): void
    {
        $maxSize = 10 * 1024 * 1024; // 10 MB

        if ($request->header('Content-Length') > $maxSize) {
            $this->logThreat('Request too large', $request);
            abort(413, 'Request entity too large');
        }
    }

    private function validateReferer(Request $request): void
    {
        $referer = $request->headers->get('referer');
        $appUrl = config('app.url');

        if ($referer && !str_starts_with($referer, $appUrl)) {
            $this->logThreat('Invalid referer for critical operation', $request);
            abort(403, 'Invalid referer');
        }
    }

    private function isCriticalOperation(Request $request): bool
    {
        $criticalPaths = [
            '/admin/',
            '/api/users/delete',
            '/api/payments',
        ];

        $path = $request->path();

        foreach ($criticalPaths as $criticalPath) {
            if (str_starts_with($path, $criticalPath)) {
                return true;
            }
        }

        return false;
    }

    private function addSecurityHeaders($response): void
    {
        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'X-XSS-Protection' => '1; mode=block',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ];

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }
    }

    private function logThreat(string $message, Request $request): void
    {
        Log::warning('Security threat detected', [
            'message' => $message,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'path' => $request->path(),
            'method' => $request->method(),
            'input' => $request->except(['password', 'password_confirmation']),
        ]);
    }

    private function logSuspiciousActivity(Request $request): void
    {
        // Логировать неудачные попытки аутентификации
        if ($request->is('login') && $request->isMethod('POST')) {
            if (!auth()->check()) {
                Log::info('Failed login attempt', [
                    'ip' => $request->ip(),
                    'email' => $request->input('email'),
                ]);
            }
        }
    }

    private function blockIp(string $ip): void
    {
        // Сохранить в кеш на 24 часа
        cache()->put("blocked_ip:{$ip}", true, now()->addHours(24));

        Log::alert('IP blocked', ['ip' => $ip]);

        // Опционально: отправить уведомление администратору
        // Notification::send(User::admin()->first(), new IpBlockedNotification($ip));
    }
}

// Регистрация
protected $middleware = [
    // ...
    \App\Http\Middleware\ComprehensiveSecurity::class,
];

// Middleware для проверки блокировки IP
class CheckBlockedIp
{
    public function handle(Request $request, Closure $next)
    {
        $ip = $request->ip();

        if (cache()->has("blocked_ip:{$ip}")) {
            abort(403, 'Your IP has been blocked');
        }

        return $next($request);
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
