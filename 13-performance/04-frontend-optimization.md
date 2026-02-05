# 13.4 Frontend Optimization

## Краткое резюме

> **Frontend Optimization** — ускорение загрузки страниц через минификацию, сжатие, CDN, lazy loading.
>
> **Метрики:** FCP (First Contentful Paint), LCP (Largest Contentful Paint), TTI (Time to Interactive), CLS (Layout Shift).
>
> **Методы:** Vite для сборки, Gzip/Brotli, lazy loading изображений, CDN для статики, code splitting, defer/async скрипты.

---

## Содержание

- [Что это](#что-это)
- [Laravel Mix / Vite](#laravel-mix--vite)
- [Минификация и сжатие](#минификация-и-сжатие)
- [Оптимизация изображений](#оптимизация-изображений)
- [CDN](#cdn)
- [Кеширование фронтенда](#кеширование-фронтенда)
- [Code Splitting](#code-splitting)
- [Практические примеры](#практические-примеры)
- [Performance monitoring](#performance-monitoring)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Оптимизация фронтенда для быстрой загрузки страниц. Минификация, сжатие, CDN, lazy loading.

**Метрики:**
- **FCP** (First Contentful Paint) — первый контент
- **LCP** (Largest Contentful Paint) — основной контент
- **TTI** (Time to Interactive) — интерактивность
- **CLS** (Cumulative Layout Shift) — стабильность

---

## Laravel Mix / Vite

**Vite (Laravel 9+):**

```js
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['vue', 'axios'],
                },
            },
        },
    },
});
```

**Build для production:**

```bash
# Сборка с минификацией
npm run build

# Результат в public/build/
# - assets/app-[hash].js
# - assets/app-[hash].css
```

**В Blade:**

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!DOCTYPE html>
<html>
<head>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    {{ $slot }}
</body>
</html>
```

---

## Минификация и сжатие

**Gzip/Brotli (Nginx):**

```nginx
# /etc/nginx/nginx.conf
http {
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;
    gzip_comp_level 6;

    # Brotli (если установлен модуль)
    brotli on;
    brotli_types text/plain text/css application/json application/javascript text/xml application/xml;
    brotli_comp_level 6;
}
```

**Проверка:**

```bash
# Проверить gzip
curl -H "Accept-Encoding: gzip" -I http://example.com/app.js

# Должен вернуть:
# Content-Encoding: gzip
```

---

## Оптимизация изображений

**Lazy loading:**

```blade
{{-- Native lazy loading --}}
<img src="/images/photo.jpg" loading="lazy" alt="Photo">

{{-- Для фонового изображения --}}
<div class="lazy-bg" data-bg="/images/hero.jpg"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const lazyBg = document.querySelectorAll('.lazy-bg');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.backgroundImage = `url(${entry.target.dataset.bg})`;
                observer.unobserve(entry.target);
            }
        });
    });

    lazyBg.forEach(el => observer.observe(el));
});
</script>
```

**Responsive images:**

```blade
<picture>
    <source srcset="/images/photo.webp" type="image/webp">
    <source srcset="/images/photo.jpg" type="image/jpeg">
    <img src="/images/photo.jpg" alt="Photo">
</picture>

{{-- Разные размеры --}}
<img srcset="/images/photo-320.jpg 320w,
             /images/photo-640.jpg 640w,
             /images/photo-1280.jpg 1280w"
     sizes="(max-width: 640px) 100vw, 640px"
     src="/images/photo-640.jpg"
     alt="Photo">
```

**Image optimization package:**

```bash
composer require spatie/laravel-image-optimizer
```

```php
use Spatie\ImageOptimizer\OptimizerChainFactory;

$optimizerChain = OptimizerChainFactory::create();
$optimizerChain->optimize($pathToImage);
```

---

## CDN

**Конфигурация:**

```env
# .env
ASSET_URL=https://cdn.example.com
```

```php
// config/filesystems.php
'cloud' => env('FILESYSTEM_CLOUD', 's3'),

's3' => [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT'),
],
```

**Использование:**

```php
// Загрузить на CDN
Storage::disk('s3')->put('avatars/1.jpg', $file);

// URL с CDN
$url = Storage::disk('s3')->url('avatars/1.jpg');
// https://cdn.example.com/avatars/1.jpg
```

**Blade helper:**

```blade
{{-- Автоматически использует ASSET_URL --}}
<link rel="stylesheet" href="{{ asset('css/app.css') }}">
<script src="{{ asset('js/app.js') }}"></script>
```

---

## Кеширование фронтенда

**HTTP Cache headers:**

```php
// routes/web.php
Route::get('/images/{file}', function ($file) {
    $path = storage_path("app/public/images/$file");

    return response()->file($path, [
        'Cache-Control' => 'public, max-age=31536000',  // 1 год
        'Expires' => now()->addYear()->toRfc7231String(),
    ]);
});
```

**Service Worker (PWA):**

```js
// public/sw.js
const CACHE_NAME = 'v1';
const urlsToCache = [
    '/',
    '/css/app.css',
    '/js/app.js',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
```

---

## Code Splitting

**Динамический import:**

```js
// resources/js/app.js

// ❌ ПЛОХО: загружает всё сразу
import Chart from 'chart.js';

// ✅ ХОРОШО: загружает когда нужно
document.getElementById('show-chart').addEventListener('click', async () => {
    const { Chart } = await import('chart.js');
    // Используем Chart
});
```

**Vue lazy loading:**

```js
// router/index.js
const routes = [
    {
        path: '/dashboard',
        // ❌ ПЛОХО
        component: require('./views/Dashboard.vue').default
    },
    {
        path: '/admin',
        // ✅ ХОРОШО: lazy load
        component: () => import('./views/Admin.vue')
    }
];
```

---

## Практические примеры

**Оптимизация fonts:**

```blade
{{-- Preload критичных шрифтов --}}
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

{{-- CSS --}}
<style>
@font-face {
    font-family: 'Inter';
    src: url('/fonts/inter.woff2') format('woff2');
    font-display: swap;  /* Показывать fallback пока грузится */
}
</style>
```

**Critical CSS:**

```blade
{{-- Инлайн критичный CSS --}}
<style>
    /* Стили для above-the-fold контента */
    body { font-family: sans-serif; }
    .header { background: #fff; }
</style>

{{-- Остальной CSS асинхронно --}}
<link rel="preload" href="{{ asset('css/app.css') }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ asset('css/app.css') }}"></noscript>
```

**Defer/Async скрипты:**

```blade
{{-- Async: загружается параллельно, выполняется сразу --}}
<script async src="https://www.google-analytics.com/analytics.js"></script>

{{-- Defer: загружается параллельно, выполняется после DOM --}}
<script defer src="{{ asset('js/app.js') }}"></script>

{{-- Обычный: блокирует парсинг --}}
<script src="{{ asset('js/app.js') }}"></script>
```

**Prefetch/Preload:**

```blade
{{-- Preload: загрузить сейчас (высокий приоритет) --}}
<link rel="preload" href="/js/app.js" as="script">
<link rel="preload" href="/fonts/font.woff2" as="font" type="font/woff2" crossorigin>

{{-- Prefetch: загрузить когда браузер свободен (низкий приоритет) --}}
<link rel="prefetch" href="/admin/dashboard.js">

{{-- DNS prefetch --}}
<link rel="dns-prefetch" href="https://cdn.example.com">

{{-- Preconnect --}}
<link rel="preconnect" href="https://api.example.com">
```

---

## Performance monitoring

**Lighthouse:**

```bash
# CLI
npm install -g lighthouse
lighthouse https://example.com --view

# В Chrome DevTools
# Lighthouse tab → Generate report
```

**Web Vitals:**

```js
// resources/js/app.js
import {getCLS, getFID, getFCP, getLCP, getTTFB} from 'web-vitals';

function sendToAnalytics(metric) {
    fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify(metric),
    });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## На собеседовании скажешь

> "Frontend optimization: Vite для сборки с минификацией. Gzip/Brotli сжатие. Lazy loading изображений (loading=lazy). Responsive images (srcset). CDN для статики. HTTP cache headers. Code splitting (динамический import). Critical CSS inline. Defer/async скрипты. Preload для критичных ресурсов. Service Worker для PWA. Web Vitals для мониторинга. Lighthouse для аудита."

---

## Практические задания

### Задание 1: Настрой Vite с code splitting

Настрой Vite для автоматического разделения vendor кода и async chunks.

<details>
<summary>Решение</summary>

```js
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
            ],
            refresh: true,
        }),
        vue(),
    ],
    build: {
        rollupOptions: {
            output: {
                // Разделить vendor код
                manualChunks: {
                    'vendor': ['vue', 'axios'],
                    'ui': ['primevue', '@headlessui/vue'],
                    'charts': ['chart.js', 'vue-chartjs'],
                },
            },
        },
        // Размер chunk для split
        chunkSizeWarningLimit: 1000,
    },
});

// resources/js/app.js
import { createApp } from 'vue';

const app = createApp({});

// Lazy load компонентов
app.component('UserDashboard', () => import('./components/UserDashboard.vue'));
app.component('AdminPanel', () => import('./components/AdminPanel.vue'));

app.mount('#app');

// Результат после build:
// public/build/assets/
// ├── app-[hash].js          (основной код)
// ├── vendor-[hash].js       (vue, axios)
// ├── ui-[hash].js           (UI библиотеки)
// ├── charts-[hash].js       (графики)
// └── UserDashboard-[hash].js (lazy chunk)
```
</details>

### Задание 2: Оптимизация изображений с lazy loading

Реализуй компонент для оптимизированной загрузки изображений с WebP, responsive sizes, и lazy loading.

<details>
<summary>Решение</summary>

```blade
{{-- resources/views/components/optimized-image.blade.php --}}
@props([
    'src',
    'alt',
    'width' => null,
    'height' => null,
    'sizes' => '100vw',
    'lazy' => true,
])

@php
    $srcWithoutExt = pathinfo($src, PATHINFO_DIRNAME) . '/' . pathinfo($src, PATHINFO_FILENAME);
    $ext = pathinfo($src, PATHINFO_EXTENSION);
@endphp

<picture>
    {{-- WebP для современных браузеров --}}
    <source
        type="image/webp"
        srcset="{{ $srcWithoutExt }}-320.webp 320w,
                {{ $srcWithoutExt }}-640.webp 640w,
                {{ $srcWithoutExt }}-1280.webp 1280w"
        sizes="{{ $sizes }}"
    >

    {{-- Fallback для старых браузеров --}}
    <source
        type="image/{{ $ext }}"
        srcset="{{ $srcWithoutExt }}-320.{{ $ext }} 320w,
                {{ $srcWithoutExt }}-640.{{ $ext }} 640w,
                {{ $srcWithoutExt }}-1280.{{ $ext }} 1280w"
        sizes="{{ $sizes }}"
    >

    {{-- Основное изображение --}}
    <img
        src="{{ $src }}"
        alt="{{ $alt }}"
        @if($width) width="{{ $width }}" @endif
        @if($height) height="{{ $height }}" @endif
        @if($lazy) loading="lazy" @endif
        {{ $attributes->merge(['class' => 'w-full h-auto']) }}
    >
</picture>

{{-- Использование --}}
<x-optimized-image
    src="/images/hero.jpg"
    alt="Hero image"
    sizes="(max-width: 640px) 100vw, 50vw"
    class="rounded-lg"
/>

{{-- Service для генерации оптимизированных версий --}}
// app/Services/ImageOptimizationService.php
use Intervention\Image\Facades\Image;

class ImageOptimizationService
{
    private array $sizes = [320, 640, 1280];

    public function optimize(string $path): void
    {
        $image = Image::make($path);
        $pathInfo = pathinfo($path);

        foreach ($this->sizes as $width) {
            // Resize
            $resized = $image->resize($width, null, function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            });

            // Save as WebP
            $webpPath = "{$pathInfo['dirname']}/{$pathInfo['filename']}-{$width}.webp";
            $resized->save($webpPath, 80, 'webp');

            // Save as original format
            $originalPath = "{$pathInfo['dirname']}/{$pathInfo['filename']}-{$width}.{$pathInfo['extension']}";
            $resized->save($originalPath, 80);
        }
    }
}
```
</details>

### Задание 3: Critical CSS и async loading

Реализуй загрузку критичного CSS inline, а остального асинхронно.

<details>
<summary>Решение</summary>

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'My App')</title>

    {{-- Critical CSS inline для above-the-fold контента --}}
    <style>
        /* Минимальные стили для первого экрана */
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.5;
        }
        .header {
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            padding: 1rem;
        }
        .container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 1rem;
        }
    </style>

    {{-- Preload критичных ресурсов --}}
    <link rel="preload" href="{{ asset('fonts/inter.woff2') }}" as="font" type="font/woff2" crossorigin>

    {{-- Async загрузка основного CSS --}}
    <link rel="preload" href="{{ mix('css/app.css') }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="{{ mix('css/app.css') }}"></noscript>

    {{-- Inline скрипт для async CSS (polyfill) --}}
    <script>
        !function(e){"use strict";var t=function(t,n,r){var o,i=e.document,c=i.createElement("link");if(n)o=n;else{var a=(i.body||i.getElementsByTagName("head")[0]).childNodes;o=a[a.length-1]}var d=i.styleSheets;c.rel="stylesheet",c.href=t,c.media="only x",function e(t){if(i.body)return t();setTimeout(function(){e(t)})}(function(){o.parentNode.insertBefore(c,n?o:o.nextSibling)});var f=function(e){for(var t=c.href,n=d.length;n--;)if(d[n].href===t)return e();setTimeout(function(){f(e)})};return c.addEventListener&&c.addEventListener("load",r),c.onloadcssdefined=f,f(r),c};"undefined"!=typeof exports?exports.loadCSS=t:e.loadCSS=t}("undefined"!=typeof global?global:this);
    </script>

    {{-- DNS prefetch для внешних ресурсов --}}
    <link rel="dns-prefetch" href="//cdn.example.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
</head>
<body>
    <header class="header">
        <div class="container">
            {{-- Header content --}}
        </div>
    </header>

    <main>
        @yield('content')
    </main>

    {{-- Defer скрипты --}}
    <script src="{{ mix('js/app.js') }}" defer></script>

    {{-- Analytics async --}}
    <script async src="https://www.google-analytics.com/analytics.js"></script>
</body>
</html>

{{-- Команда для генерации critical CSS --}}
// npm install --save-dev critical

// package.json
{
    "scripts": {
        "critical": "critical http://localhost:8000 --base public --inline --minify > resources/views/critical.css"
    }
}

// Результат:
// - FCP улучшен на 40%
// - LCP улучшен на 30%
// - Lighthouse score: 95+
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
