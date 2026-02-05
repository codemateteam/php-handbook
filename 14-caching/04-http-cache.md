# 14.4 HTTP Cache

## Краткое резюме

> **HTTP Cache** — кэширование на уровне browser/CDN/proxy через HTTP headers.
>
> **Cache-Control:** `public` (везде), `private` (только browser), `max-age` (TTL), `no-cache` (revalidate), `no-store` (не кэшировать). **ETag** — fingerprint контента, 304 Not Modified если не изменился. **Last-Modified** — альтернатива ETag.
>
> Static assets: `max-age=31536000, immutable` с hash в URL. Dynamic HTML: `private, no-cache`. CDN: `s-maxage` для CDN, `max-age` для browser. Vary: разные кэши для разных headers (language, user-agent).

---

## Содержание

- [Что это](#что-это)
- [Cache-Control Header](#cache-control-header)
- [Примеры Cache-Control](#примеры-cache-control)
- [ETag](#etag-entity-tag)
- [Last-Modified](#last-modified)
- [CDN Cache](#cdn-cache)
- [Browser Cache Busting](#browser-cache-busting)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**HTTP Cache:**
Кэширование на уровне HTTP (browser, CDN, proxy).

**Зачем:**
- Уменьшить latency (не ходить на сервер)
- Снизить bandwidth
- Снизить нагрузку на сервер

**Levels:**
1. Browser Cache
2. CDN Cache
3. Reverse Proxy Cache (Varnish, Nginx)

---

## Cache-Control Header

**Базовые директивы:**

```php
// Laravel Response
return response($content)
    ->header('Cache-Control', 'public, max-age=3600');
```

**Директивы:**

```
public         — может кэшироваться везде (browser, CDN, proxy)
private        — только browser (не CDN/proxy)
no-cache       — проверить с сервером (revalidation)
no-store       — не кэшировать вообще
max-age=3600   — кэш на 3600 секунд
s-maxage=7200  — для shared caches (CDN, proxy)
must-revalidate — после expiration обязательно revalidate
immutable      — не менялся (perfect для assets с hash)
```

---

## Примеры Cache-Control

### 1. Static Assets (CSS, JS, Images)

```php
// Кэшировать навсегда (с hash в URL)
return response()->file($path)
    ->header('Cache-Control', 'public, max-age=31536000, immutable');

// URL: /css/app.abc123.css (hash меняется при изменении файла)
```

**Vite/Laravel Mix:**

```php
// resources/views/layouts/app.blade.php
@vite(['resources/css/app.css', 'resources/js/app.js'])

// Генерирует: /build/assets/app-abc123.css
```

---

### 2. Dynamic HTML

```php
// Не кэшировать (данные пользователя)
return view('dashboard')
    ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
```

---

### 3. Public Pages

```php
// Кэшировать на 1 час
return view('blog.post', ['post' => $post])
    ->header('Cache-Control', 'public, max-age=3600');
```

---

### 4. API Responses

```php
// Кэшировать на 5 минут
return response()->json($data)
    ->header('Cache-Control', 'public, max-age=300');
```

---

## ETag (Entity Tag)

**Что это:**
Fingerprint контента. Если контент не изменился, возвращаем 304 Not Modified.

**Алгоритм:**

```
1. Client → Server: GET /page
2. Server → Client: 200 OK, ETag: "abc123"
3. Client сохраняет ETag

4. Client → Server: GET /page, If-None-Match: "abc123"
5. Server проверяет ETag
   - Если тот же → 304 Not Modified (no body)
   - Если изменился → 200 OK, ETag: "def456"
```

**Laravel:**

```php
$content = view('blog.post', ['post' => $post])->render();
$etag = md5($content);

if (request()->header('If-None-Match') === $etag) {
    return response('', 304);
}

return response($content)
    ->header('ETag', $etag)
    ->header('Cache-Control', 'public, max-age=3600');
```

---

## Last-Modified

**Альтернатива ETag:**

```php
$post = Post::find($id);
$lastModified = $post->updated_at->toRfc7231String();

if (request()->header('If-Modified-Since') === $lastModified) {
    return response('', 304);
}

return view('blog.post', ['post' => $post])
    ->header('Last-Modified', $lastModified)
    ->header('Cache-Control', 'public, max-age=3600');
```

---

## Laravel Response Cache Package

**Composer:**

```bash
composer require spatie/laravel-responsecache
```

**Middleware:**

```php
// app/Http/Kernel.php
protected $middlewareGroups = [
    'web' => [
        \Spatie\ResponseCache\Middlewares\CacheResponse::class,
    ],
];
```

**Config:**

```php
// config/responsecache.php
return [
    'enabled' => env('RESPONSE_CACHE_ENABLED', true),
    'cache_lifetime_in_seconds' => 60 * 60 * 24 * 7,  // 1 week
    'cache_profile' => CacheAllSuccessfulGetRequests::class,
];
```

**Использование:**

```php
// Все GET requests кэшируются автоматически
Route::get('/blog/{post}', [PostController::class, 'show']);

// Вручную invalidate
ResponseCache::forget('/blog/post-1');

// Или flush всё
ResponseCache::flush();
```

---

## CDN Cache

**CloudFlare, AWS CloudFront, Fastly:**

```php
// Кэшировать на CDN
return response($content)
    ->header('Cache-Control', 'public, s-maxage=86400, max-age=3600');

// s-maxage — для CDN (24 hours)
// max-age — для browser (1 hour)
```

**Purge CDN cache:**

```php
// CloudFlare API
Http::post('https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache', [
    'files' => ['https://example.com/blog/post-1'],
]);
```

---

## Vary Header

**Кэш зависит от заголовка:**

```php
// Разные кэши для разных Accept-Language
return response($content)
    ->header('Cache-Control', 'public, max-age=3600')
    ->header('Vary', 'Accept-Language');

// Разные кэши для desktop/mobile
return response($content)
    ->header('Vary', 'User-Agent');
```

---

## Browser Cache Busting

**Проблема:**
Обновили CSS/JS, но browser использует старый cache.

**Решение: Hash в URL**

```php
// Laravel Mix/Vite
mix('css/app.css')  // /css/app.css?id=abc123

// При изменении файла → новый hash → новый URL → browser загрузит
```

---

## Reverse Proxy Cache (Varnish/Nginx)

**Nginx:**

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g;

server {
    location / {
        proxy_cache my_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        proxy_pass http://backend;

        # Добавить header с cache status
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

**Laravel Application:**

```php
// Просто установить Cache-Control
return response($content)
    ->header('Cache-Control', 'public, max-age=3600');

// Nginx автоматически закэширует
```

---

## Cache Warming

**Прогрев cache после deploy:**

```php
class WarmHttpCacheCommand extends Command
{
    public function handle()
    {
        $urls = [
            'https://example.com/',
            'https://example.com/blog',
            'https://example.com/about',
        ];

        foreach ($urls as $url) {
            Http::get($url);  // Прогреть cache
            $this->info("Warmed: {$url}");
        }
    }
}

// Deploy script
php artisan cache:warm-http
```

---

## Best Practices

```
✓ Static assets: public, max-age=31536000, immutable
✓ Dynamic HTML: private, no-cache
✓ Public pages: public, max-age=3600
✓ API: public, max-age=300
✓ ETag или Last-Modified для revalidation
✓ Hash в URL для cache busting (Laravel Mix/Vite)
✓ CDN для static assets
✓ Vary header для разных версий (language, user-agent)
✓ Monitoring: cache hit rate
✓ Purge CDN после deploy
```

---

## Security

**Не кэшировать:**
- Персональные данные (private)
- Sensitive pages (no-store)
- CSRF tokens (no-cache)

```php
// Личные данные
return view('profile')
    ->header('Cache-Control', 'private, no-store');

// Страницы с формами
return view('checkout')
    ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
```

---

## На собеседовании скажешь

> "HTTP Cache — кэширование на browser/CDN/proxy уровне. Cache-Control: public (везде), private (только browser), max-age (TTL), no-cache (revalidate), no-store (не кэшировать). ETag: fingerprint контента, 304 Not Modified если не изменился. Last-Modified альтернатива. Static assets: max-age=31536000, immutable с hash в URL. Dynamic HTML: private, no-cache. CDN: s-maxage для CDN, max-age для browser. Vary: разные кэши для разных headers. Laravel: Response Cache package, Vite/Mix для cache busting. Best practices: разные стратегии для разных типов контента, не кэшировать персональные данные."

---

## Практические задания

### Задание 1: Middleware для ETag и Conditional Requests

Создай middleware который генерирует ETag для responses и обрабатывает If-None-Match headers (304 Not Modified).

<details>
<summary>Решение</summary>

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ETagMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Только для успешных GET/HEAD запросов
        if (!$request->isMethod('GET') && !$request->isMethod('HEAD')) {
            return $response;
        }

        if ($response->status() !== 200) {
            return $response;
        }

        // Генерировать ETag из контента
        $content = $response->getContent();
        $etag = md5($content);

        // Установить ETag header
        $response->setEtag($etag);

        // Проверить If-None-Match
        $requestEtag = $request->header('If-None-Match');

        if ($requestEtag === $etag) {
            // Контент не изменился - вернуть 304
            $response->setNotModified();
        }

        return $response;
    }
}

// Регистрация в Kernel.php
protected $middlewareGroups = [
    'web' => [
        \App\Http\Middleware\ETagMiddleware::class,
    ],
];

// Продвинутая версия с weak ETags и исключениями
class AdvancedETagMiddleware
{
    /**
     * Routes которые не должны использовать ETag
     */
    protected array $except = [
        'admin/*',
        'api/auth/*',
    ];

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Проверить исключения
        if ($this->shouldExclude($request)) {
            return $response;
        }

        // Только для GET/HEAD
        if (!$request->isMethodCacheable()) {
            return $response;
        }

        // Только для успешных ответов
        if (!$response->isSuccessful()) {
            return $response;
        }

        $content = $response->getContent();

        if (empty($content)) {
            return $response;
        }

        // Strong ETag (точное совпадение контента)
        $etag = '"' . md5($content) . '"';

        // Или Weak ETag (семантическое совпадение)
        // $etag = 'W/"' . md5($content) . '"';

        $response->headers->set('ETag', $etag);

        // Cache-Control для ETag
        if (!$response->headers->has('Cache-Control')) {
            $response->headers->set('Cache-Control', 'private, must-revalidate');
        }

        // Проверить If-None-Match
        $requestEtag = $request->header('If-None-Match');

        if ($requestEtag === $etag) {
            $response->setNotModified();
        }

        return $response;
    }

    protected function shouldExclude(Request $request): bool
    {
        foreach ($this->except as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }

        return false;
    }
}

// Контроллер с явным ETag
class BlogController extends Controller
{
    public function show(Post $post)
    {
        $content = view('blog.post', compact('post'))->render();
        $etag = md5($post->updated_at . $content);

        // Проверить If-None-Match
        if (request()->header('If-None-Match') === $etag) {
            return response('', 304)
                ->header('ETag', $etag);
        }

        return response($content)
            ->header('ETag', $etag)
            ->header('Cache-Control', 'public, max-age=3600')
            ->header('Last-Modified', $post->updated_at->toRfc7231String());
    }
}
```
</details>

### Задание 2: Response Cache Service с CDN Purge

Реализуй сервис для кэширования responses с возможностью purge CDN cache (CloudFlare).

<details>
<summary>Решение</summary>

```php
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ResponseCacheService
{
    private const CACHE_PREFIX = 'response_cache:';
    private const DEFAULT_TTL = 3600; // 1 hour

    /**
     * Получить закэшированный response или создать новый
     */
    public function remember(string $url, callable $callback, int $ttl = null): string
    {
        $cacheKey = $this->getCacheKey($url);
        $ttl = $ttl ?? self::DEFAULT_TTL;

        return Cache::remember($cacheKey, $ttl, $callback);
    }

    /**
     * Сохранить response в cache
     */
    public function put(string $url, string $content, int $ttl = null): void
    {
        $cacheKey = $this->getCacheKey($url);
        $ttl = $ttl ?? self::DEFAULT_TTL;

        Cache::put($cacheKey, $content, $ttl);
    }

    /**
     * Invalidate cache для URL
     */
    public function forget(string $url): void
    {
        $cacheKey = $this->getCacheKey($url);
        Cache::forget($cacheKey);
    }

    /**
     * Flush всего response cache
     */
    public function flush(): void
    {
        // Для Redis с tags
        Cache::tags(['response_cache'])->flush();
    }

    /**
     * Purge CloudFlare CDN cache
     */
    public function purgeCdn(array $urls): array
    {
        $zoneId = config('services.cloudflare.zone_id');
        $apiToken = config('services.cloudflare.api_token');

        if (!$zoneId || !$apiToken) {
            return ['success' => false, 'error' => 'CloudFlare not configured'];
        }

        // Преобразовать относительные URLs в абсолютные
        $absoluteUrls = array_map(function ($url) {
            if (!str_starts_with($url, 'http')) {
                $url = config('app.url') . $url;
            }
            return $url;
        }, $urls);

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$apiToken}",
                'Content-Type' => 'application/json',
            ])->post("https://api.cloudflare.com/client/v4/zones/{$zoneId}/purge_cache", [
                'files' => $absoluteUrls,
            ]);

            if ($response->successful()) {
                return ['success' => true, 'purged' => count($absoluteUrls)];
            }

            return [
                'success' => false,
                'error' => $response->json('errors.0.message', 'Unknown error'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Purge everything на CloudFlare
     */
    public function purgeAllCdn(): array
    {
        $zoneId = config('services.cloudflare.zone_id');
        $apiToken = config('services.cloudflare.api_token');

        try {
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$apiToken}",
                'Content-Type' => 'application/json',
            ])->post("https://api.cloudflare.com/client/v4/zones/{$zoneId}/purge_cache", [
                'purge_everything' => true,
            ]);

            return ['success' => $response->successful()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function getCacheKey(string $url): string
    {
        return self::CACHE_PREFIX . md5($url);
    }
}

// Middleware для автоматического response caching
namespace App\Http\Middleware;

use App\Services\ResponseCacheService;
use Closure;
use Illuminate\Http\Request;

class CacheResponse
{
    public function __construct(
        private ResponseCacheService $cacheService
    ) {}

    public function handle(Request $request, Closure $next, int $ttl = 3600)
    {
        // Только для GET requests
        if (!$request->isMethod('GET')) {
            return $next($request);
        }

        // Только для гостей (не кэшировать персональные данные)
        if ($request->user()) {
            return $next($request);
        }

        $url = $request->fullUrl();

        $content = $this->cacheService->remember($url, function () use ($next, $request) {
            $response = $next($request);
            return $response->getContent();
        }, $ttl);

        return response($content)
            ->header('Cache-Control', "public, max-age={$ttl}")
            ->header('X-Cache', 'HIT');
    }
}

// Observer для автоматического purge при изменении контента
namespace App\Observers;

use App\Models\Post;
use App\Services\ResponseCacheService;

class PostObserver
{
    public function __construct(
        private ResponseCacheService $cacheService
    ) {}

    public function saved(Post $post): void
    {
        $urls = [
            route('blog.show', $post),
            route('blog.index'),
            route('home'),
        ];

        // Invalidate local cache
        foreach ($urls as $url) {
            $this->cacheService->forget($url);
        }

        // Purge CDN
        $this->cacheService->purgeCdn($urls);
    }

    public function deleted(Post $post): void
    {
        $this->saved($post);
    }
}

// Command для purge
class PurgeCacheCommand extends Command
{
    protected $signature = 'cache:purge {--cdn : Purge CDN cache} {--all : Purge all}';
    protected $description = 'Purge response cache and optionally CDN';

    public function handle(ResponseCacheService $cacheService)
    {
        // Purge local cache
        $cacheService->flush();
        $this->info('Local cache purged');

        // Purge CDN
        if ($this->option('cdn')) {
            if ($this->option('all')) {
                $result = $cacheService->purgeAllCdn();
            } else {
                $urls = [
                    config('app.url'),
                    config('app.url') . '/blog',
                ];
                $result = $cacheService->purgeCdn($urls);
            }

            if ($result['success']) {
                $this->info('CDN cache purged');
            } else {
                $this->error('CDN purge failed: ' . ($result['error'] ?? 'Unknown'));
            }
        }
    }
}
```
</details>

### Задание 3: Smart Cache Headers Manager

Создай сервис который автоматически устанавливает правильные Cache-Control headers в зависимости от типа контента.

<details>
<summary>Решение</summary>

```php
namespace App\Services;

class CacheHeadersManager
{
    /**
     * Конфигурация cache headers для разных типов контента
     */
    private array $profiles = [
        'static_assets' => [
            'cache_control' => 'public, max-age=31536000, immutable',
            'patterns' => ['/build/*', '/storage/*', '*.css', '*.js', '*.png', '*.jpg', '*.woff'],
        ],
        'public_pages' => [
            'cache_control' => 'public, max-age=3600',
            'patterns' => ['/blog/*', '/about', '/contact'],
        ],
        'api_responses' => [
            'cache_control' => 'public, max-age=300',
            'patterns' => ['/api/public/*'],
        ],
        'private_pages' => [
            'cache_control' => 'private, no-cache, no-store, must-revalidate',
            'patterns' => ['/dashboard/*', '/profile/*', '/admin/*'],
        ],
        'no_cache' => [
            'cache_control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'patterns' => ['/checkout/*', '/payment/*'],
        ],
    ];

    /**
     * Применить cache headers к response
     */
    public function apply($response, string $url): void
    {
        $profile = $this->detectProfile($url);

        if ($profile) {
            $response->header('Cache-Control', $profile['cache_control']);

            // Vary header для разных версий
            if ($this->shouldVary($url)) {
                $response->header('Vary', 'Accept-Language, User-Agent');
            }
        }
    }

    /**
     * Определить профиль для URL
     */
    private function detectProfile(string $url): ?array
    {
        foreach ($this->profiles as $name => $profile) {
            foreach ($profile['patterns'] as $pattern) {
                if ($this->matchesPattern($url, $pattern)) {
                    return $profile;
                }
            }
        }

        return null;
    }

    private function matchesPattern(string $url, string $pattern): bool
    {
        // Простая проверка wildcards
        $regex = '#^' . str_replace('\*', '.*', preg_quote($pattern, '#')) . '$#';
        return preg_match($regex, $url) === 1;
    }

    private function shouldVary(string $url): bool
    {
        // Vary для многоязычных страниц
        return str_starts_with($url, '/blog/') || str_starts_with($url, '/docs/');
    }
}

// Middleware
namespace App\Http\Middleware;

use App\Services\CacheHeadersManager;
use Closure;
use Illuminate\Http\Request;

class SetCacheHeaders
{
    public function __construct(
        private CacheHeadersManager $cacheManager
    ) {}

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Применить cache headers
        $this->cacheManager->apply($response, $request->path());

        return $response;
    }
}

// Response Macro для удобства
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Response;

class ResponseMacroServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Macro для static assets
        Response::macro('cacheForever', function () {
            return $this->header('Cache-Control', 'public, max-age=31536000, immutable');
        });

        // Macro для public pages
        Response::macro('cachePublic', function (int $seconds = 3600) {
            return $this->header('Cache-Control', "public, max-age={$seconds}");
        });

        // Macro для private pages
        Response::macro('cachePrivate', function (int $seconds = 3600) {
            return $this->header('Cache-Control', "private, max-age={$seconds}");
        });

        // Macro для no-cache
        Response::macro('noCache', function () {
            return $this->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        });

        // Macro для CDN
        Response::macro('cacheCdn', function (int $cdnSeconds = 86400, int $browserSeconds = 3600) {
            return $this->header(
                'Cache-Control',
                "public, s-maxage={$cdnSeconds}, max-age={$browserSeconds}"
            );
        });
    }
}

// Использование в контроллере
class AssetController extends Controller
{
    public function css(string $filename)
    {
        $content = file_get_contents(public_path("css/{$filename}"));

        return response($content, 200, [
            'Content-Type' => 'text/css',
        ])->cacheForever();
    }
}

class BlogController extends Controller
{
    public function show(Post $post)
    {
        return view('blog.post', compact('post'))
            ->cachePublic(3600)
            ->header('Vary', 'Accept-Language');
    }
}

class DashboardController extends Controller
{
    public function index()
    {
        return view('dashboard.index')->noCache();
    }
}

class ApiController extends Controller
{
    public function posts()
    {
        $posts = Post::latest()->limit(10)->get();

        return response()->json($posts)
            ->cacheCdn(cdnSeconds: 86400, browserSeconds: 3600);
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
