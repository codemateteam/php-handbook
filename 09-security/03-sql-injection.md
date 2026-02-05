# 8.3 SQL Injection

## Краткое резюме

> **SQL Injection** — внедрение SQL кода через пользовательский ввод для чтения, изменения или удаления данных в базе данных.
>
> **Защита:** Laravel Query Builder и Eloquent автоматически параметризуют запросы. Всегда использовать prepared statements с placeholders (?, :name).
>
> **Важно:** НИКОГДА не конкатенировать SQL строки. DB::raw() использовать только с whitelist или параметрами.

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
SQL Injection — внедрение SQL кода через пользовательский ввод. Атакующий может читать/изменять/удалять данные в БД.

**Пример атаки:**
```sql
-- Запрос с инъекцией
SELECT * FROM users WHERE email = 'user@example.com' OR '1'='1'

-- Всегда true → вернёт всех пользователей
```

---

## Как работает

**Уязвимый код:**

```php
// ❌ ОПАСНО: конкатенация SQL
Route::get('/users', function (Request $request) {
    $email = $request->input('email');

    $users = DB::select("SELECT * FROM users WHERE email = '{$email}'");
    // Атака: ?email=' OR '1'='1
    // Вернёт всех пользователей

    return $users;
});

// ❌ ОПАСНО: raw query без параметров
$userId = $request->input('id');
DB::statement("DELETE FROM users WHERE id = {$userId}");
// Атака: ?id=1 OR 1=1
// Удалит всех пользователей
```

**Безопасный код (Parameter Binding):**

```php
// ✅ БЕЗОПАСНО: prepared statements
Route::get('/users', function (Request $request) {
    $email = $request->input('email');

    // Query Builder (автоматически параметризует)
    $users = DB::table('users')
        ->where('email', $email)
        ->get();

    return $users;
});

// ✅ БЕЗОПАСНО: параметры в raw query
$users = DB::select('SELECT * FROM users WHERE email = ?', [$email]);

// ✅ БЕЗОПАСНО: именованные параметры
$users = DB::select('SELECT * FROM users WHERE email = :email', [
    'email' => $email
]);
```

---

## Когда использовать защиту

**Всегда используй Parameter Binding:**
- ✅ Query Builder (автоматически)
- ✅ Eloquent (автоматически)
- ✅ Prepared statements для raw SQL

**НИКОГДА не делай:**
- ❌ Конкатенация SQL
- ❌ Raw query без параметров
- ❌ DB::raw() с пользовательским вводом

---

## Пример из практики

**Eloquent защищает автоматически:**

```php
// ✅ БЕЗОПАСНО
$user = User::where('email', $request->input('email'))->first();

// ✅ БЕЗОПАСНО: массовая вставка
User::create($request->validated());

// ✅ БЕЗОПАСНО: where in
User::whereIn('id', $request->input('ids'))->get();
```

**Query Builder защищает автоматически:**

```php
// ✅ БЕЗОПАСНО
DB::table('users')
    ->where('email', $email)
    ->where('active', true)
    ->get();

// ✅ БЕЗОПАСНО: сложные условия
DB::table('orders')
    ->where('status', $status)
    ->whereBetween('created_at', [$from, $to])
    ->orderBy($sortBy, $order)
    ->get();
```

**DB::raw() с осторожностью:**

```php
// ❌ ОПАСНО: пользовательский ввод в raw()
$column = $request->input('sort_by');
DB::table('users')->orderByRaw($column)->get();
// Атака: ?sort_by=id; DELETE FROM users; --

// ✅ БЕЗОПАСНО: whitelist
$allowedColumns = ['id', 'name', 'created_at'];
$column = $request->input('sort_by', 'id');

if (!in_array($column, $allowedColumns)) {
    $column = 'id';
}

DB::table('users')->orderBy($column)->get();

// ✅ БЕЗОПАСНО: параметры в raw()
DB::table('orders')
    ->selectRaw('COUNT(*) as count, status')
    ->where('user_id', $userId)  // Параметризовано
    ->groupBy('status')
    ->get();
```

**Безопасный поиск:**

```php
// ❌ ОПАСНО
$query = $request->input('q');
$users = DB::select("SELECT * FROM users WHERE name LIKE '%{$query}%'");

// ✅ БЕЗОПАСНО: параметры
$query = $request->input('q');
$users = DB::table('users')
    ->where('name', 'like', "%{$query}%")
    ->get();

// ✅ БЕЗОПАСНО: fulltext search
$users = DB::table('users')
    ->whereRaw('MATCH(name, email) AGAINST(? IN BOOLEAN MODE)', [$query])
    ->get();
```

**Безопасная динамическая сортировка:**

```php
class UserController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'sort_by' => 'sometimes|in:id,name,email,created_at',
            'order' => 'sometimes|in:asc,desc',
        ]);

        $users = User::query()
            ->orderBy(
                $validated['sort_by'] ?? 'created_at',
                $validated['order'] ?? 'desc'
            )
            ->paginate(20);

        return view('users.index', compact('users'));
    }
}
```

**Безопасное использование IN clause:**

```php
// ✅ БЕЗОПАСНО: whereIn автоматически параметризует
$ids = $request->input('ids');  // [1, 2, 3]
$users = User::whereIn('id', $ids)->get();

// ✅ БЕЗОПАСНО: subquery
$activeUserIds = User::where('active', true)->pluck('id');
$orders = Order::whereIn('user_id', $activeUserIds)->get();
```

**Second-order SQL Injection:**

```php
// Атака в два этапа
// 1. Сохранить вредоносный payload
User::create([
    'name' => "'; DROP TABLE users; --",  // Сохранено в БД
]);

// 2. Использовать в raw query
$user = User::find(1);
DB::statement("INSERT INTO logs (message) VALUES ('{$user->name}')");
// ❌ ОПАСНО

// ✅ БЕЗОПАСНО: всегда параметризуй
DB::statement('INSERT INTO logs (message) VALUES (?)', [$user->name]);
```

**Тестирование на SQL Injection:**

```php
// tests/Feature/SqlInjectionTest.php
class SqlInjectionTest extends TestCase
{
    public function test_search_escapes_sql_injection(): void
    {
        $sqlPayload = "' OR '1'='1";

        $response = $this->get('/users?email=' . urlencode($sqlPayload));

        // Не должно вернуть всех пользователей
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }

    public function test_sort_parameter_is_validated(): void
    {
        $response = $this->get('/users?sort_by=id; DROP TABLE users');

        // Должно вернуть ошибку валидации
        $response->assertStatus(422);
    }
}
```

**WAF (Web Application Firewall):**

```php
// Middleware для базовой защиты
class SqlInjectionDetection
{
    private array $patterns = [
        '/(\b(SELECT|UNION|INSERT|UPDATE|DELETE|DROP|CREATE)\b)/i',
        '/(\b(OR|AND)\b.*=)/i',
        '/(--|#|\/\*|\*\/)/i',
    ];

    public function handle($request, Closure $next)
    {
        $input = json_encode($request->all());

        foreach ($this->patterns as $pattern) {
            if (preg_match($pattern, $input)) {
                Log::warning('SQL Injection attempt detected', [
                    'ip' => $request->ip(),
                    'input' => $input,
                ]);

                abort(403, 'Forbidden');
            }
        }

        return $next($request);
    }
}
```

---

## На собеседовании скажешь

> "SQL Injection — внедрение SQL через пользовательский ввод. Laravel защищает через Query Builder и Eloquent (автоматическая параметризация). Prepared statements с placeholders (?, :name). НИКОГДА не конкатенировать SQL. DB::raw() только с whitelist или параметрами. Валидация для динамических колонок (sort_by in:id,name). whereIn() безопасен. Second-order injection — когда данные из БД используются в raw query. WAF middleware для дополнительной защиты."

---

## Практические задания

### Задание 1: Найди и исправь SQL Injection

Что не так в этом коде? Исправь уязвимости.

```php
class ProductController extends Controller
{
    public function search(Request $request)
    {
        $query = $request->input('q');
        $category = $request->input('category');
        $sortBy = $request->input('sort', 'name');

        $products = DB::select("
            SELECT * FROM products
            WHERE name LIKE '%{$query}%'
            AND category = '{$category}'
            ORDER BY {$sortBy}
        ");

        return view('products.index', compact('products'));
    }
}
```

<details>
<summary>Решение</summary>

```php
// Проблемы:
// 1. Конкатенация $query — SQL Injection через LIKE
// 2. Конкатенация $category — SQL Injection
// 3. Конкатенация $sortBy — возможность инъекции через ORDER BY

// Решение
class ProductController extends Controller
{
    public function search(Request $request)
    {
        // 1. Валидация входных данных
        $validated = $request->validate([
            'q' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:50',
            'sort' => 'nullable|in:name,price,created_at',
        ]);

        // 2. Использовать Query Builder (автоматически параметризует)
        $query = DB::table('products');

        // Безопасный LIKE
        if (!empty($validated['q'])) {
            $query->where('name', 'like', '%' . $validated['q'] . '%');
        }

        // Безопасный WHERE
        if (!empty($validated['category'])) {
            $query->where('category', $validated['category']);
        }

        // Безопасный ORDER BY (whitelist через валидацию)
        $sortBy = $validated['sort'] ?? 'name';
        $query->orderBy($sortBy);

        $products = $query->get();

        return view('products.index', compact('products'));
    }
}

// Альтернатива: Eloquent
class ProductController extends Controller
{
    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:50',
            'sort' => 'nullable|in:name,price,created_at',
        ]);

        $products = Product::query()
            ->when($validated['q'] ?? null, fn($query, $search) =>
                $query->where('name', 'like', "%{$search}%")
            )
            ->when($validated['category'] ?? null, fn($query, $cat) =>
                $query->where('category', $cat)
            )
            ->orderBy($validated['sort'] ?? 'name')
            ->get();

        return view('products.index', compact('products'));
    }
}
```
</details>

### Задание 2: Безопасная динамическая сортировка

Реализуй endpoint для получения пользователей с возможностью сортировки по разным полям.

<details>
<summary>Решение</summary>

```php
// UserController
class UserController extends Controller
{
    private const SORTABLE_COLUMNS = [
        'id',
        'name',
        'email',
        'created_at',
        'updated_at',
    ];

    private const SORT_DIRECTIONS = ['asc', 'desc'];

    public function index(Request $request)
    {
        $validated = $request->validate([
            'sort_by' => 'nullable|in:' . implode(',', self::SORTABLE_COLUMNS),
            'direction' => 'nullable|in:' . implode(',', self::SORT_DIRECTIONS),
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $sortBy = $validated['sort_by'] ?? 'created_at';
        $direction = $validated['direction'] ?? 'desc';
        $perPage = $validated['per_page'] ?? 15;

        // Whitelist гарантирует безопасность
        if (!in_array($sortBy, self::SORTABLE_COLUMNS)) {
            $sortBy = 'created_at';
        }

        if (!in_array($direction, self::SORT_DIRECTIONS)) {
            $direction = 'desc';
        }

        $users = User::orderBy($sortBy, $direction)
            ->paginate($perPage);

        return UserResource::collection($users);
    }
}

// Альтернатива: Использовать пакет spatie/laravel-query-builder
composer require spatie/laravel-query-builder

use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedSort;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = QueryBuilder::for(User::class)
            ->allowedSorts([
                'id',
                'name',
                'email',
                'created_at',
            ])
            ->allowedFilters([
                'name',
                'email',
            ])
            ->paginate($request->input('per_page', 15));

        return UserResource::collection($users);
    }
}

// Использование:
// GET /users?sort=name
// GET /users?sort=-created_at (desc)
// GET /users?filter[name]=John&sort=email
```
</details>

### Задание 3: Защити от Second-Order SQL Injection

Реализуй безопасное логирование пользовательских действий.

<details>
<summary>Решение</summary>

```php
// ❌ УЯЗВИМЫЙ код
class ActivityLogger
{
    public function log(User $user, string $action, array $data)
    {
        // Second-order injection: $user->name из БД может содержать SQL
        $message = "User {$user->name} performed {$action}";

        DB::statement("INSERT INTO activity_log (message, data) VALUES ('{$message}', '{$data}')");
    }
}

// ✅ БЕЗОПАСНЫЙ код
class ActivityLogger
{
    public function log(User $user, string $action, array $data)
    {
        // Решение 1: Использовать Query Builder
        DB::table('activity_log')->insert([
            'user_id' => $user->id,
            'action' => $action,
            'data' => json_encode($data),
            'created_at' => now(),
        ]);
    }
}

// Решение 2: Eloquent Model
class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

class ActivityLogger
{
    public function log(User $user, string $action, array $data): void
    {
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => $action,
            'data' => $data,
        ]);
    }
}

// Решение 3: Prepared statements для raw SQL
class ActivityLogger
{
    public function log(User $user, string $action, array $data): void
    {
        $message = "User {$user->name} performed {$action}";

        DB::statement(
            'INSERT INTO activity_log (message, data, created_at) VALUES (?, ?, ?)',
            [$message, json_encode($data), now()]
        );
    }
}

// Использование
$logger = new ActivityLogger();
$logger->log(
    auth()->user(),
    'updated_profile',
    ['field' => 'email', 'old' => 'old@example.com', 'new' => 'new@example.com']
);
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
