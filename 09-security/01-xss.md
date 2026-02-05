# 8.1 XSS (Cross-Site Scripting)

## Краткое резюме

> **XSS (Cross-Site Scripting)** — внедрение вредоносного JavaScript в веб-страницу для кражи cookies, токенов или выполнения действий от имени пользователя.
>
> **Типы:** Reflected (через URL), Stored (в БД), DOM-based (через JavaScript).
>
> **Защита:** Blade `{{ }}` автоматически экранирует, HTMLPurifier для rich text, Content Security Policy, HTTPOnly cookies.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать защиту](#когда-использовать-защиту)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
XSS — внедрение вредоносного JavaScript в веб-страницу. Атакующий может украсть cookies, токены, выполнить действия от имени пользователя.

**Типы XSS:**
- **Reflected XSS** — через URL параметры
- **Stored XSS** — сохранён в БД
- **DOM-based XSS** — через JavaScript

---

## Как работает

**Reflected XSS (через URL):**

```php
// ❌ УЯЗВИМЫЙ код
Route::get('/search', function (Request $request) {
    $query = $request->input('q');
    return "Результаты поиска: {$query}";
});

// Атака:
// /search?q=<script>alert('XSS')</script>
// Выполнится JavaScript

// ✅ ЗАЩИТА: экранирование
Route::get('/search', function (Request $request) {
    $query = htmlspecialchars($request->input('q'), ENT_QUOTES, 'UTF-8');
    return "Результаты поиска: {$query}";
});

// Или через Blade (автоматически экранирует)
return view('search', ['query' => $request->input('q')]);
// В Blade: Результаты: {{ $query }}
```

**Stored XSS (сохранён в БД):**

```php
// ❌ УЯЗВИМЫЙ код
class CommentController extends Controller
{
    public function store(Request $request)
    {
        Comment::create([
            'body' => $request->input('body'),  // Не валидируется
        ]);
    }

    public function show(Comment $comment)
    {
        return view('comments.show', ['comment' => $comment]);
    }
}

// В Blade (без экранирования)
{!! $comment->body !!}  // ❌ Выполнит <script>

// Атакующий отправляет:
// body: <script>fetch('/steal-token?token='+document.cookie)</script>

// ✅ ЗАЩИТА 1: Валидация
public function store(Request $request)
{
    $validated = $request->validate([
        'body' => 'required|string|max:1000',
    ]);

    Comment::create($validated);
}

// ✅ ЗАЩИТА 2: Экранирование в Blade
{{ $comment->body }}  // Автоматически htmlspecialchars()

// ✅ ЗАЩИТА 3: Очистка HTML (если нужен rich text)
use Mews\Purifier\Facades\Purifier;

public function store(Request $request)
{
    Comment::create([
        'body' => Purifier::clean($request->input('body')),
    ]);
}
```

**DOM-based XSS:**

```javascript
// ❌ УЯЗВИМЫЙ JavaScript
const params = new URLSearchParams(window.location.search);
const message = params.get('msg');
document.getElementById('output').innerHTML = message;  // Опасно!

// Атака:
// ?msg=<img src=x onerror="alert('XSS')">

// ✅ ЗАЩИТА
document.getElementById('output').textContent = message;  // Безопасно
```

---

## Когда использовать защиту

**Всегда защищайся от XSS:**
- ✅ Любой пользовательский ввод
- ✅ URL параметры
- ✅ Формы
- ✅ API данные

**Laravel защищает автоматически:**
- Blade {{ }} экранирует HTML
- Form Request валидирует
- CSRF токены

---

## Пример из практики

**Безопасный вывод в Blade:**

```blade
{{-- ✅ Автоматически экранирует --}}
<h1>{{ $post->title }}</h1>
<p>{{ $comment->body }}</p>

{{-- ❌ НЕ экранирует (только для доверенного HTML) --}}
{!! $post->body !!}

{{-- ✅ Безопасный rich text --}}
{!! Purifier::clean($post->body) !!}

{{-- ✅ Экранирование в атрибутах --}}
<input type="text" value="{{ $user->name }}">
<a href="{{ $url }}">Link</a>

{{-- ❌ ОПАСНО: JavaScript контекст --}}
<script>
    var name = "{{ $user->name }}";  // Может сломать JS
</script>

{{-- ✅ Безопасно: JSON encode --}}
<script>
    var user = @json($user);  // Laravel helper
</script>
```

**HTMLPurifier для rich text:**

```bash
composer require mews/purifier
```

```php
// config/purifier.php (опубликовать)
php artisan vendor:publish --provider="Mews\Purifier\PurifierServiceProvider"

// Использование
use Mews\Purifier\Facades\Purifier;

class PostController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        Post::create([
            'title' => $validated['title'],
            'body' => Purifier::clean($validated['body']),  // Очистка
        ]);
    }
}

// В Blade
{!! $post->body !!}  // Безопасно (уже очищен)
```

**Content Security Policy (CSP):**

```php
// app/Http/Middleware/AddSecurityHeaders.php
class AddSecurityHeaders
{
    public function handle($request, Closure $next)
    {
        $response = $next($request);

        // Запретить inline scripts
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        );

        // Предотвратить XSS
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Предотвратить clickjacking
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Запретить MIME sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        return $response;
    }
}

// Зарегистрировать в Kernel.php
protected $middleware = [
    \App\Http\Middleware\AddSecurityHeaders::class,
];
```

**HTTPOnly cookies:**

```php
// config/session.php
'http_only' => true,  // JavaScript не может прочитать cookie

// Установить cookie вручную
return response('Content')->cookie(
    'token',
    $value,
    $minutes = 60,
    $path = '/',
    $domain = null,
    $secure = true,  // Только HTTPS
    $httpOnly = true  // Защита от XSS
);
```

**Sanitize пользовательский ввод:**

```php
class CommentController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'body' => 'required|string|max:1000',
        ]);

        // Удалить HTML теги (если не нужен rich text)
        $body = strip_tags($validated['body']);

        // Или оставить только определённые теги
        $body = strip_tags($validated['body'], '<b><i><u><a>');

        Comment::create(['body' => $body]);
    }
}
```

**Vue.js / React защита:**

```javascript
// Vue автоматически экранирует
<div>{{ message }}</div>  // Безопасно

// v-html опасен
<div v-html="message"></div>  // ❌ XSS уязвимость

// React автоматически экранирует
<div>{message}</div>  // Безопасно

// dangerouslySetInnerHTML опасен
<div dangerouslySetInnerHTML={{__html: message}} />  // ❌ XSS
```

**Тестирование на XSS:**

```php
// tests/Feature/XssTest.php
class XssTest extends TestCase
{
    public function test_xss_payload_is_escaped(): void
    {
        $xssPayload = '<script>alert("XSS")</script>';

        $response = $this->post('/comments', [
            'body' => $xssPayload,
        ]);

        $comment = Comment::latest()->first();

        // Проверить, что сохранён как есть
        $this->assertEquals($xssPayload, $comment->body);

        // Проверить, что экранирован при выводе
        $response = $this->get("/comments/{$comment->id}");
        $response->assertDontSee('<script>', false);  // false = не экранировать в поиске
        $response->assertSee('&lt;script&gt;', false);  // Экранированная версия
    }
}
```

---

## На собеседовании скажешь

> "XSS — внедрение JavaScript в страницу. Типы: Reflected (через URL), Stored (в БД), DOM-based (через JS). Защита: Blade {{ }} автоматически экранирует, {!! !!} не экранирует. HTMLPurifier для rich text (Purifier::clean()). Content Security Policy запрещает inline scripts. HTTPOnly cookies защищают от кражи через JS. strip_tags() удаляет HTML. Всегда валидировать и экранировать пользовательский ввод. @json() для безопасной передачи в JavaScript."

---

## Практические задания

### Задание 1: Исправь XSS уязвимость

Что не так в этом коде? Исправь.

```php
Route::get('/search', function (Request $request) {
    $query = $request->input('q');
    return view('search', compact('query'));
});

// search.blade.php
<h1>Результаты поиска: {!! $query !!}</h1>
```

<details>
<summary>Решение</summary>

```php
// Проблема: {!! !!} не экранирует HTML, возможна XSS атака через ?q=<script>alert('XSS')</script>

// Решение 1: Использовать {{ }} (автоматически экранирует)
Route::get('/search', function (Request $request) {
    $query = $request->input('q');
    return view('search', compact('query'));
});

// search.blade.php
<h1>Результаты поиска: {{ $query }}</h1>

// Решение 2: Валидация и очистка
Route::get('/search', function (Request $request) {
    $validated = $request->validate([
        'q' => 'required|string|max:255',
    ]);

    $query = strip_tags($validated['q']);
    return view('search', compact('query'));
});

// search.blade.php
<h1>Результаты поиска: {{ $query }}</h1>
```
</details>

### Задание 2: Реализуй безопасный rich text редактор

Создай контроллер для сохранения HTML контента из WYSIWYG редактора с защитой от XSS.

<details>
<summary>Решение</summary>

```php
// 1. Установить HTMLPurifier
composer require mews/purifier

// 2. Опубликовать конфиг
php artisan vendor:publish --provider="Mews\Purifier\PurifierServiceProvider"

// 3. PostController
use Mews\Purifier\Facades\Purifier;

class PostController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        // Очистить HTML от опасных тегов
        $cleanBody = Purifier::clean($validated['body'], [
            'HTML.Allowed' => 'p,b,i,u,a[href],ul,ol,li,strong,em',
        ]);

        $post = Post::create([
            'title' => $validated['title'],
            'body' => $cleanBody,
            'user_id' => auth()->id(),
        ]);

        return redirect()->route('posts.show', $post);
    }
}

// 4. В Blade (безопасно, т.к. уже очищен)
<div class="post-body">
    {!! $post->body !!}
</div>

// 5. config/purifier.php (настройка)
return [
    'default' => [
        'HTML.Allowed' => 'p,b,i,u,a[href|title],ul,ol,li,strong,em,h2,h3',
        'AutoFormat.RemoveEmpty' => true,
    ],
];
```
</details>

### Задание 3: Добавь Content Security Policy

Реализуй middleware для добавления CSP заголовков.

<details>
<summary>Решение</summary>

```php
// app/Http/Middleware/ContentSecurityPolicy.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ContentSecurityPolicy
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // CSP заголовок
        $csp = [
            "default-src 'self'",
            "script-src 'self' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self'",
            "frame-ancestors 'none'",
        ];

        $response->headers->set('Content-Security-Policy', implode('; ', $csp));

        // Дополнительные security headers
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        return $response;
    }
}

// Регистрация в app/Http/Kernel.php
protected $middleware = [
    // ...
    \App\Http\Middleware\ContentSecurityPolicy::class,
];

// Альтернатива: использовать пакет
composer require spatie/laravel-csp

// config/csp.php
return [
    'enabled' => env('CSP_ENABLED', true),

    'policy' => [
        'default-src' => ['self'],
        'script-src' => ['self', 'https://cdn.jsdelivr.net'],
        'style-src' => ['self', 'unsafe-inline'],
    ],
];
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
