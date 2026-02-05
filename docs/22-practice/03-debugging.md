# 16.3 Debugging Scenarios

## Сценарии debugging на собеседованиях

### Сценарий 1: N+1 Query Problem

**Проблема:**

```php
// Пользователь жалуется: "Страница со списком постов грузится 5 секунд"

class PostController extends Controller
{
    public function index()
    {
        $posts = Post::all();  // 1 query

        return view('posts.index', compact('posts'));
    }
}

// posts/index.blade.php
@foreach ($posts as $post)
    <div>
        <h2>{{ $post->title }}</h2>
        <p>By: {{ $post->user->name }}</p>  // N queries!
        <p>Comments: {{ $post->comments->count() }}</p>  // N queries!
    </div>
@endforeach

// Итого: 1 + 100 + 100 = 201 query для 100 постов
```

**Debugging:**

```php
// 1. Включить Query Log
DB::enableQueryLog();

// Загрузить страницу

// 2. Посмотреть queries
dd(DB::getQueryLog());

// Увидим:
// SELECT * FROM posts
// SELECT * FROM users WHERE id = 1
// SELECT * FROM users WHERE id = 2
// SELECT * FROM users WHERE id = 3
// ...
```

**Решение:**

```php
class PostController extends Controller
{
    public function index()
    {
        // Eager loading
        $posts = Post::with(['user', 'comments'])->get();  // 3 queries

        return view('posts.index', compact('posts'));
    }
}

// Теперь: 3 queries вместо 201
```

---

### Сценарий 2: Memory Limit Exceeded

**Проблема:**

```php
// Fatal error: Allowed memory size of 134217728 bytes exhausted

class ExportController extends Controller
{
    public function exportUsers()
    {
        $users = User::all();  // 1 миллион пользователей в памяти!

        $csv = '';
        foreach ($users as $user) {
            $csv .= "{$user->id},{$user->name},{$user->email}\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv');
    }
}
```

**Debugging:**

```php
// Посмотреть текущее использование памяти
echo memory_get_usage() / 1024 / 1024 . ' MB';

// Проверить limit
echo ini_get('memory_limit'); // 128M
```

**Решение:**

```php
class ExportController extends Controller
{
    public function exportUsers()
    {
        $fileName = 'users_' . date('Y-m-d') . '.csv';

        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');

            // Header
            fputcsv($handle, ['ID', 'Name', 'Email']);

            // Chunk вместо all()
            User::chunk(1000, function ($users) use ($handle) {
                foreach ($users as $user) {
                    fputcsv($handle, [
                        $user->id,
                        $user->name,
                        $user->email
                    ]);
                }
            });

            fclose($handle);
        }, $fileName);
    }
}

// Теперь: постоянная память ~5 MB
```

---

### Сценарий 3: Slow Database Query

**Проблема:**

```php
// Запрос выполняется 10+ секунд

$orders = Order::where('status', 'pending')
    ->where('created_at', '>=', now()->subDays(30))
    ->orderBy('total', 'desc')
    ->get();
```

**Debugging:**

```sql
-- 1. EXPLAIN
EXPLAIN SELECT * FROM orders
WHERE status = 'pending'
AND created_at >= '2024-01-01'
ORDER BY total DESC;

-- Результат:
-- type: ALL (full table scan - плохо!)
-- rows: 1000000 (сканирует всю таблицу)
-- Extra: Using where; Using filesort (нет индекса)
```

**Решение:**

```php
// Миграция: добавить индексы
Schema::table('orders', function (Blueprint $table) {
    $table->index(['status', 'created_at', 'total']);
    // Composite index в порядке WHERE, ORDER BY
});

// Теперь EXPLAIN покажет:
// type: range (использует индекс)
// rows: 1000 (только нужные строки)
// Extra: Using index condition (быстро!)
```

---

### Сценарий 4: Race Condition

**Проблема:**

```php
// Два пользователя одновременно покупают последний товар

class CheckoutController extends Controller
{
    public function checkout(Request $request, Product $product)
    {
        // User A и User B одновременно здесь
        if ($product->stock > 0) {
            // Оба видят stock = 1

            // Создать заказ
            Order::create([
                'user_id' => auth()->id(),
                'product_id' => $product->id,
            ]);

            // Уменьшить stock
            $product->decrement('stock');
            // Теперь stock = -1 (oversold!)
        }
    }
}
```

**Debugging:**

```bash
# Воспроизвести race condition
ab -n 100 -c 10 http://localhost/checkout/1

# После: stock = -5 (oversold на 5 штук)
```

**Решение 1: Database Lock**

```php
DB::transaction(function () use ($product, $request) {
    // Lock для чтения
    $product = Product::where('id', $product->id)
        ->lockForUpdate()
        ->first();

    if ($product->stock > 0) {
        Order::create([...]);
        $product->decrement('stock');
    } else {
        throw new OutOfStockException();
    }
});
```

**Решение 2: Optimistic Locking**

```php
class Product extends Model
{
    protected $casts = [
        'version' => 'integer',
    ];
}

// Checkout
$product = Product::find($id);
$originalVersion = $product->version;

if ($product->stock > 0) {
    Order::create([...]);

    // Update только если version не изменился
    $updated = Product::where('id', $product->id)
        ->where('version', $originalVersion)
        ->update([
            'stock' => DB::raw('stock - 1'),
            'version' => DB::raw('version + 1'),
        ]);

    if (!$updated) {
        throw new ConcurrentUpdateException('Product was updated by another user');
    }
}
```

---

### Сценарий 5: Session Issues After Deployment

**Проблема:**

```
После деплоя на production пользователи жалуются:
"Постоянно выкидывает из системы"
```

**Debugging:**

```php
// 1. Проверить driver
// config/session.php
'driver' => env('SESSION_DRIVER', 'file'),

// 2. Проверить где хранятся файлы
'files' => storage_path('framework/sessions'),

// 3. Проверить права
ls -la storage/framework/sessions
# drwxr-xr-x  www-data www-data
```

**Проблема:**

```
Load Balancer
├─ Server 1 (sessions в /var/www/storage)
├─ Server 2 (sessions в /var/www/storage)
└─ Server 3 (sessions в /var/www/storage)

Request 1 → Server 1 (создал session)
Request 2 → Server 2 (нет session - logout)
```

**Решение:**

```env
# .env
SESSION_DRIVER=redis
REDIS_HOST=redis-cluster.example.com

# Теперь все серверы используют общий Redis
```

---

### Сценарий 6: Memory Leak in Queue Worker

**Проблема:**

```php
// Queue worker использует всё больше памяти
// После 1000 jobs: 2GB памяти

class ProcessImageJob implements ShouldQueue
{
    public function handle()
    {
        $image = Image::find($this->imageId);

        // Обработка изображения
        $processed = $this->processImage($image->path);

        // Сохранение
        $image->update(['processed_path' => $processed]);

        // ❌ НЕ очищается из памяти!
    }

    private function processImage($path)
    {
        $img = imagecreatefromjpeg($path);  // Большой объект в памяти
        // ... обработка ...
        return $newPath;
        // $img НЕ освобождён!
    }
}
```

**Debugging:**

```bash
# Мониторинг памяти worker
watch -n 1 'ps aux | grep "queue:work"'

# Память растёт: 50MB → 100MB → 500MB → 2GB
```

**Решение:**

```php
class ProcessImageJob implements ShouldQueue
{
    public function handle()
    {
        $image = Image::find($this->imageId);
        $processed = $this->processImage($image->path);
        $image->update(['processed_path' => $processed]);

        // Очистить память
        unset($image);
        gc_collect_cycles();
    }

    private function processImage($path)
    {
        $img = imagecreatefromjpeg($path);
        // ... обработка ...
        $newPath = $this->save($img);

        // ✅ Освободить ресурс
        imagedestroy($img);

        return $newPath;
    }
}

// Или перезапускать worker после N jobs
php artisan queue:work --max-jobs=1000
```

---

### Сценарий 7: CORS Error

**Проблема:**

```javascript
// Frontend
fetch('http://api.example.com/users')
    .then(res => res.json())
    .then(data => console.log(data));

// Console:
// Access to fetch at 'http://api.example.com/users' from origin
// 'http://frontend.example.com' has been blocked by CORS policy
```

**Debugging:**

```bash
# Проверить headers
curl -H "Origin: http://frontend.example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://api.example.com/users -v

# Response headers:
# (пусто - CORS не настроен)
```

**Решение:**

```php
// config/cors.php
return [
    'paths' => ['api/*'],
    'allowed_origins' => ['http://frontend.example.com'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE'],
    'allowed_headers' => ['Content-Type', 'Authorization'],
    'supports_credentials' => true,
];

// Или middleware
class CorsMiddleware
{
    public function handle($request, Closure $next)
    {
        return $next($request)
            ->header('Access-Control-Allow-Origin', 'http://frontend.example.com')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
}
```

---

## Общие debugging техники

**1. Логирование:**

```php
// Добавить логи
Log::info('User checkout', [
    'user_id' => auth()->id(),
    'product_id' => $product->id,
    'stock' => $product->stock,
]);

// Tail logs в реальном времени
tail -f storage/logs/laravel.log
```

**2. dd() и dump():**

```php
// Stop execution
dd($variable);

// Continue execution
dump($variable);

// Ray (paid tool)
ray($variable);
```

**3. Laravel Telescope:**

```bash
composer require laravel/telescope --dev
php artisan telescope:install

# http://localhost/telescope
# Queries, Jobs, Exceptions, Logs
```

**4. Xdebug:**

```ini
; php.ini
xdebug.mode=debug
xdebug.start_with_request=yes

# Breakpoint в PhpStorm
# Step through code
```

---

## На собеседовании скажешь

> "Debugging: N+1 решается через eager loading (with). Memory limit: chunk вместо all(), stream для export. Slow query: EXPLAIN для анализа, добавить индексы. Race condition: lockForUpdate или optimistic locking. Session issues на multiple серверах: Redis вместо file. Memory leak: unset(), imagedestroy(), --max-jobs. CORS: config/cors.php или middleware. Инструменты: Query Log, Telescope, Xdebug, logs (tail -f)."

