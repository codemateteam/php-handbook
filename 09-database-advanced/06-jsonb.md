# 9.6 JSONB в PostgreSQL

> **TL;DR:** JSONB — бинарный JSON тип в PostgreSQL для гибкой схемы данных. Операторы: -> (get JSON), ->> (get text), @> (contains), ? (has key). GIN индексы для быстрых запросов. Laravel: where('attributes->brand', 'Dell'), whereJsonContains. Use cases: dynamic attributes, user preferences, audit logs.

## Содержание

- [Что это](#что-это)
- [Создание JSONB колонки](#создание-jsonb-колонки)
- [Запись данных](#запись-данных)
- [Чтение данных](#чтение-данных)
- [Операторы JSONB](#операторы-jsonb)
- [Запросы в Laravel](#запросы-в-laravel)
- [Индексы на JSONB](#индексы-на-jsonb)
- [Практические примеры](#практические-примеры)
- [JSONB Functions](#jsonb-functions)
- [Performance Tips](#performance-tips)
- [JSONB vs Relational](#jsonb-vs-relational)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**JSONB:**
Бинарный JSON тип данных в PostgreSQL. Хранит JSON в разобранном виде, позволяет индексировать и эффективно запрашивать.

**JSON vs JSONB:**
- **JSON**: текст, хранится как есть, медленные запросы
- **JSONB**: binary, parsed, быстрые запросы, поддержка индексов

**Зачем:**
- Гибкая схема (dynamic fields)
- Вложенные структуры
- Запросы внутри JSON
- Миграция с NoSQL

---

## Создание JSONB колонки

**Migration:**

```php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->jsonb('attributes');  // JSONB колонка
    $table->timestamps();
});
```

**Model:**

```php
class Product extends Model
{
    protected $casts = [
        'attributes' => 'array',  // Auto JSON encode/decode
    ];
}
```

---

## Запись данных

```php
Product::create([
    'name' => 'Laptop',
    'attributes' => [
        'brand' => 'Dell',
        'specs' => [
            'cpu' => 'Intel i7',
            'ram' => '16GB',
            'storage' => '512GB SSD',
        ],
        'tags' => ['electronics', 'computers'],
    ],
]);
```

---

## Чтение данных

**Базовое чтение:**

```php
$product = Product::find(1);

// Весь JSON
$attributes = $product->attributes;

// Доступ к полям
$brand = $product->attributes['brand'];  // 'Dell'
$cpu = $product->attributes['specs']['cpu'];  // 'Intel i7'
```

**Eloquent JSON путь:**

```php
// WHERE JSON field
$products = Product::where('attributes->brand', 'Dell')->get();

// Вложенные поля
$products = Product::where('attributes->specs->cpu', 'Intel i7')->get();

// SELECT JSON field
$brands = Product::select('attributes->brand as brand')->get();
```

---

## Операторы JSONB

### 1. `->` Получить JSON объект

```sql
SELECT attributes->'brand' FROM products;
-- Результат: JSON ("Dell")
```

### 2. `->>` Получить text

```sql
SELECT attributes->>'brand' FROM products;
-- Результат: text (Dell)
```

### 3. `@>` Содержит JSON

```sql
-- Найти продукты с brand = 'Dell'
SELECT * FROM products
WHERE attributes @> '{"brand": "Dell"}';
```

**Laravel:**

```php
Product::whereRaw("attributes @> ?", ['{"brand": "Dell"}'])->get();
```

### 4. `?` Есть ключ

```sql
-- Найти продукты у которых есть поле 'warranty'
SELECT * FROM products
WHERE attributes ? 'warranty';
```

### 5. `?|` Есть любой из ключей

```sql
-- Есть 'color' или 'size'
SELECT * FROM products
WHERE attributes ?| array['color', 'size'];
```

### 6. `?&` Есть все ключи

```sql
-- Есть и 'color' и 'size'
SELECT * FROM products
WHERE attributes ?& array['color', 'size'];
```

---

## Запросы в Laravel

**WHERE на JSON поле:**

```php
// Простое условие
Product::where('attributes->brand', 'Dell')->get();

// Вложенное
Product::where('attributes->specs->ram', '16GB')->get();

// Contains
Product::whereJsonContains('attributes->tags', 'electronics')->get();

// Array length
Product::whereJsonLength('attributes->tags', 2)->get();
```

**UPDATE JSON поле:**

```php
// Обновить весь JSON
$product->update([
    'attributes' => ['brand' => 'HP'],
]);

// Обновить конкретное поле через SQL
Product::where('id', 1)->update([
    'attributes->brand' => 'HP',
]);
```

**Increment JSON number:**

```php
DB::table('products')
    ->where('id', 1)
    ->update([
        'attributes->views' => DB::raw("(attributes->>'views')::int + 1"),
    ]);
```

---

## Индексы на JSONB

### 1. GIN Index (General Inverted Index)

**Для `@>` и `?` операторов:**

```php
Schema::table('products', function (Blueprint $table) {
    $table->index('attributes', 'idx_products_attributes', 'gin');
});

// SQL:
// CREATE INDEX idx_products_attributes ON products USING gin (attributes);
```

**Использование:**

```sql
-- Быстро (использует GIN index)
SELECT * FROM products
WHERE attributes @> '{"brand": "Dell"}';
```

---

### 2. GIN Index на конкретный путь

```php
// Raw SQL в migration
DB::statement("
    CREATE INDEX idx_products_brand
    ON products USING gin ((attributes->'brand'))
");
```

**Использование:**

```sql
-- Быстро
SELECT * FROM products
WHERE attributes->'brand' = '"Dell"';
```

---

### 3. B-Tree Index на JSON поле

```php
// Для сортировки и WHERE с операторами сравнения
DB::statement("
    CREATE INDEX idx_products_price
    ON products ((attributes->>'price')::numeric)
");
```

**Использование:**

```sql
-- Быстро
SELECT * FROM products
WHERE (attributes->>'price')::numeric > 1000
ORDER BY (attributes->>'price')::numeric;
```

**Laravel:**

```php
Product::whereRaw("(attributes->>'price')::numeric > ?", [1000])
    ->orderByRaw("(attributes->>'price')::numeric")
    ->get();
```

---

## Практические примеры

### 1. Dynamic Attributes (E-commerce)

```php
// Product с разными атрибутами для разных категорий
Product::create([
    'name' => 'T-Shirt',
    'category' => 'clothing',
    'attributes' => [
        'size' => 'L',
        'color' => 'blue',
        'material' => 'cotton',
    ],
]);

Product::create([
    'name' => 'Laptop',
    'category' => 'electronics',
    'attributes' => [
        'brand' => 'Dell',
        'cpu' => 'Intel i7',
        'ram' => '16GB',
    ],
]);

// Фильтры
Product::where('category', 'clothing')
    ->where('attributes->color', 'blue')
    ->get();

Product::where('category', 'electronics')
    ->where('attributes->brand', 'Dell')
    ->get();
```

---

### 2. User Preferences

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('email');
    $table->jsonb('preferences');
});

User::create([
    'email' => 'user@example.com',
    'preferences' => [
        'theme' => 'dark',
        'language' => 'en',
        'notifications' => [
            'email' => true,
            'push' => false,
        ],
    ],
]);

// Получить пользователей с dark theme
User::where('preferences->theme', 'dark')->get();

// Email notifications enabled
User::where('preferences->notifications->email', true)->get();
```

---

### 3. Audit Log

```php
Schema::create('audit_logs', function (Blueprint $table) {
    $table->id();
    $table->string('model_type');
    $table->unsignedBigInteger('model_id');
    $table->string('action');  // created, updated, deleted
    $table->jsonb('old_values')->nullable();
    $table->jsonb('new_values')->nullable();
    $table->timestamps();
});

// При обновлении
AuditLog::create([
    'model_type' => 'Product',
    'model_id' => 1,
    'action' => 'updated',
    'old_values' => [
        'price' => 1000,
        'stock' => 10,
    ],
    'new_values' => [
        'price' => 1200,
        'stock' => 5,
    ],
]);

// Найти все изменения цены
AuditLog::whereRaw("old_values->>'price' IS DISTINCT FROM new_values->>'price'")
    ->get();
```

---

### 4. Settings/Configuration

```php
Schema::create('settings', function (Blueprint $table) {
    $table->id();
    $table->string('key')->unique();
    $table->jsonb('value');
});

// Хранить сложные настройки
Setting::create([
    'key' => 'payment_gateways',
    'value' => [
        'stripe' => [
            'enabled' => true,
            'api_key' => 'sk_test_...',
            'webhook_secret' => 'whsec_...',
        ],
        'paypal' => [
            'enabled' => false,
            'client_id' => 'xxx',
        ],
    ],
]);

// Получить настройку
$stripeEnabled = Setting::where('key', 'payment_gateways')
    ->value('value->stripe->enabled');
```

---

## JSONB Functions

### 1. jsonb_array_elements

```sql
-- Развернуть JSON array в строки
SELECT jsonb_array_elements(attributes->'tags') as tag
FROM products
WHERE id = 1;

-- tag
-- "electronics"
-- "computers"
```

**Laravel:**

```php
DB::table('products')
    ->selectRaw("jsonb_array_elements(attributes->'tags') as tag")
    ->where('id', 1)
    ->get();
```

---

### 2. jsonb_build_object

```sql
-- Создать JSON объект
SELECT jsonb_build_object(
    'name', name,
    'brand', attributes->>'brand'
) FROM products;
```

---

### 3. jsonb_set

```sql
-- Обновить значение в JSON
UPDATE products
SET attributes = jsonb_set(
    attributes,
    '{specs, ram}',
    '"32GB"'
)
WHERE id = 1;
```

**Laravel:**

```php
DB::table('products')
    ->where('id', 1)
    ->update([
        'attributes' => DB::raw("jsonb_set(attributes, '{specs, ram}', '\"32GB\"')"),
    ]);
```

---

## Performance Tips

```
✓ Используй JSONB вместо JSON (быстрее)
✓ Создавай GIN индексы для частых запросов
✓ Для сортировки используй B-Tree индексы на (field->>'key')::type
✓ Храни только динамические поля в JSONB (не всё подряд)
✓ JSONB хорош для read-heavy (не для write-heavy)
✓ Нормализуй если часто JOIN по этим полям
```

---

## JSONB vs Relational

**JSONB хорош для:**
- ✅ Dynamic/flexible schema
- ✅ Nested data
- ✅ Prototype/MVP
- ✅ Настройки, preferences

**Relational хорош для:**
- ✅ Strict schema
- ✅ JOIN с другими таблицами
- ✅ Referential integrity
- ✅ Complex queries

**Гибридный подход:**

```php
Schema::create('products', function (Blueprint $table) {
    // Relational (для JOIN и WHERE)
    $table->id();
    $table->string('name');
    $table->decimal('price');
    $table->unsignedBigInteger('category_id');

    // JSONB (для динамических полей)
    $table->jsonb('attributes')->nullable();

    $table->foreign('category_id')->references('id')->on('categories');
});
```

---

## Практические задания

### Задание 1: E-commerce с динамическими атрибутами

**Задача:** Реализовать систему продуктов с гибкими атрибутами для разных категорий.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->unsignedBigInteger('category_id');
    $table->decimal('price', 10, 2);
    $table->jsonb('attributes');
    $table->timestamps();

    $table->index('category_id');
    // GIN индекс для JSONB
    $table->index('attributes', 'idx_products_attributes', 'gin');
});

// Также индекс на конкретные поля
DB::statement("CREATE INDEX idx_products_brand ON products USING gin ((attributes->'brand'))");
DB::statement("CREATE INDEX idx_products_price_numeric ON products ((attributes->>'price')::numeric)");

// app/Models/Product.php
class Product extends Model
{
    protected $casts = [
        'attributes' => 'array',
    ];

    // Scope для фильтрации по JSONB полям
    public function scopeWithAttribute($query, string $key, $value)
    {
        return $query->where("attributes->{$key}", $value);
    }

    public function scopeHasAttribute($query, string $key)
    {
        return $query->whereRaw("attributes ? ?", [$key]);
    }

    public function scopeAttributeContains($query, array $data)
    {
        return $query->whereRaw("attributes @> ?", [json_encode($data)]);
    }
}

// app/Http/Controllers/ProductController.php
class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query();

        // Фильтры из query params
        if ($brand = $request->input('brand')) {
            $query->withAttribute('brand', $brand);
        }

        if ($color = $request->input('color')) {
            $query->withAttribute('color', $color);
        }

        if ($minPrice = $request->input('min_price')) {
            $query->whereRaw("(attributes->>'price')::numeric >= ?", [$minPrice]);
        }

        // Фильтр по наличию атрибута
        if ($request->boolean('has_warranty')) {
            $query->hasAttribute('warranty');
        }

        // Комплексный фильтр (contains)
        if ($specs = $request->input('specs')) {
            $query->attributeContains($specs);
        }

        return ProductResource::collection($query->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'category_id' => 'required|exists:categories,id',
            'price' => 'required|numeric',
            'attributes' => 'required|array',
        ]);

        // Разные атрибуты для разных категорий
        $product = Product::create($validated);

        return new ProductResource($product);
    }

    // Массовое обновление JSONB поля
    public function bulkUpdateAttribute(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'attribute_key' => 'required|string',
            'attribute_value' => 'required',
        ]);

        // Обновить конкретное поле в JSONB
        $affected = Product::where('category_id', $validated['category_id'])
            ->update([
                "attributes->{$validated['attribute_key']}" => $validated['attribute_value']
            ]);

        return response()->json([
            'message' => "Updated {$affected} products",
            'affected' => $affected
        ]);
    }
}

// Примеры данных для разных категорий
// Electronics:
Product::create([
    'name' => 'Laptop Dell XPS',
    'category_id' => 1,
    'price' => 1500,
    'attributes' => [
        'brand' => 'Dell',
        'model' => 'XPS 15',
        'specs' => [
            'cpu' => 'Intel i7',
            'ram' => '16GB',
            'storage' => '512GB SSD',
        ],
        'warranty' => '2 years',
    ],
]);

// Clothing:
Product::create([
    'name' => 'T-Shirt Nike',
    'category_id' => 2,
    'price' => 25,
    'attributes' => [
        'brand' => 'Nike',
        'size' => 'L',
        'color' => 'blue',
        'material' => 'cotton',
    ],
]);
```

</details>

### Задание 2: User Preferences & Settings

**Задача:** Система настроек пользователя с JSONB.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::table('users', function (Blueprint $table) {
    $table->jsonb('preferences')->nullable();
    $table->jsonb('metadata')->nullable();
});

// app/Models/User.php
class User extends Model
{
    protected $casts = [
        'preferences' => 'array',
        'metadata' => 'array',
    ];

    // Helper методы для работы с preferences
    public function getPreference(string $key, $default = null)
    {
        return data_get($this->preferences, $key, $default);
    }

    public function setPreference(string $key, $value): void
    {
        $preferences = $this->preferences ?? [];
        data_set($preferences, $key, $value);
        $this->preferences = $preferences;
        $this->save();
    }

    public function updatePreferences(array $updates): void
    {
        $preferences = $this->preferences ?? [];

        foreach ($updates as $key => $value) {
            data_set($preferences, $key, $value);
        }

        $this->preferences = $preferences;
        $this->save();
    }

    // Scopes
    public function scopeWithPreference($query, string $key, $value)
    {
        return $query->where("preferences->{$key}", $value);
    }

    public function scopeNotificationEnabled($query, string $type)
    {
        return $query->where("preferences->notifications->{$type}", true);
    }
}

// app/Http/Controllers/UserPreferencesController.php
class UserPreferencesController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'theme' => 'sometimes|in:light,dark,auto',
            'language' => 'sometimes|string|size:2',
            'notifications.email' => 'sometimes|boolean',
            'notifications.push' => 'sometimes|boolean',
            'notifications.sms' => 'sometimes|boolean',
            'privacy.profile_visible' => 'sometimes|boolean',
            'privacy.show_email' => 'sometimes|boolean',
        ]);

        $user->updatePreferences($validated);

        return response()->json([
            'message' => 'Preferences updated',
            'preferences' => $user->preferences
        ]);
    }

    public function get(Request $request)
    {
        $user = $request->user();

        return response()->json($user->preferences ?? []);
    }

    // Получить пользователей с определенными настройками
    public function getUsersWithEmailNotifications()
    {
        $users = User::notificationEnabled('email')->get();

        return response()->json($users);
    }
}

// Default preferences при регистрации
class RegisterController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
        ]);

        $user = User::create([
            ...$validated,
            'preferences' => [
                'theme' => 'light',
                'language' => 'en',
                'notifications' => [
                    'email' => true,
                    'push' => true,
                    'sms' => false,
                ],
                'privacy' => [
                    'profile_visible' => true,
                    'show_email' => false,
                ],
            ],
        ]);

        return response()->json($user);
    }
}
```

</details>

### Задание 3: Audit Log с JSONB

**Задача:** Система аудита изменений с сохранением diff в JSONB.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::create('audit_logs', function (Blueprint $table) {
    $table->id();
    $table->string('model_type');
    $table->unsignedBigInteger('model_id');
    $table->unsignedBigInteger('user_id')->nullable();
    $table->string('action'); // created, updated, deleted
    $table->jsonb('old_values')->nullable();
    $table->jsonb('new_values')->nullable();
    $table->jsonb('metadata')->nullable();
    $table->timestamp('created_at');

    $table->index(['model_type', 'model_id']);
    $table->index('user_id');
    $table->index('action');
    $table->index('created_at');
});

DB::statement("CREATE INDEX idx_audit_old_values ON audit_logs USING gin (old_values)");
DB::statement("CREATE INDEX idx_audit_new_values ON audit_logs USING gin (new_values)");

// app/Models/AuditLog.php
class AuditLog extends Model
{
    const UPDATED_AT = null;

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'metadata' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getDiff(): array
    {
        $old = $this->old_values ?? [];
        $new = $this->new_values ?? [];

        $changes = [];

        foreach ($new as $key => $value) {
            $oldValue = $old[$key] ?? null;

            if ($oldValue !== $value) {
                $changes[$key] = [
                    'old' => $oldValue,
                    'new' => $value,
                ];
            }
        }

        return $changes;
    }
}

// app/Observers/AuditObserver.php
class AuditObserver
{
    public function created($model)
    {
        AuditLog::create([
            'model_type' => get_class($model),
            'model_id' => $model->id,
            'user_id' => auth()->id(),
            'action' => 'created',
            'new_values' => $model->getAttributes(),
            'metadata' => [
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
        ]);
    }

    public function updated($model)
    {
        $changes = $model->getDirty();

        if (empty($changes)) {
            return;
        }

        $original = $model->getOriginal();

        AuditLog::create([
            'model_type' => get_class($model),
            'model_id' => $model->id,
            'user_id' => auth()->id(),
            'action' => 'updated',
            'old_values' => array_intersect_key($original, $changes),
            'new_values' => $changes,
            'metadata' => [
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
        ]);
    }

    public function deleted($model)
    {
        AuditLog::create([
            'model_type' => get_class($model),
            'model_id' => $model->id,
            'user_id' => auth()->id(),
            'action' => 'deleted',
            'old_values' => $model->getAttributes(),
            'metadata' => [
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ],
        ]);
    }
}

// Регистрация observer
// app/Providers/EventServiceProvider.php
public function boot()
{
    Product::observe(AuditObserver::class);
    User::observe(AuditObserver::class);
    Order::observe(AuditObserver::class);
}

// app/Http/Controllers/AuditLogController.php
class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user');

        if ($modelType = $request->input('model_type')) {
            $query->where('model_type', $modelType);
        }

        if ($modelId = $request->input('model_id')) {
            $query->where('model_id', $modelId);
        }

        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }

        // Поиск по изменениям конкретного поля
        if ($field = $request->input('field')) {
            $query->whereRaw("new_values ? ?", [$field]);
        }

        // Поиск по конкретному значению
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw("old_values::text ILIKE ?", ["%{$search}%"])
                  ->orWhereRaw("new_values::text ILIKE ?", ["%{$search}%"]);
            });
        }

        $logs = $query->latest()->paginate(50);

        return response()->json($logs);
    }

    public function show(AuditLog $auditLog)
    {
        return response()->json([
            'audit_log' => $auditLog->load('user'),
            'diff' => $auditLog->getDiff(),
        ]);
    }
}
```

</details>

---

## На собеседовании скажешь

> "JSONB — бинарный JSON тип в PostgreSQL. Отличие от JSON: parsed, поддержка индексов, быстрые запросы. Операторы: -> (get JSON), ->> (get text), @> (contains), ? (has key). Laravel: where('attributes->brand', 'Dell'), whereJsonContains. GIN индексы для @> и ? операторов, B-Tree для сортировки. Use cases: dynamic attributes, user preferences, audit logs, settings. Trade-off: гибкость vs strict schema. Best practices: JSONB для read-heavy динамических полей, relational для JOIN и strict schema, гибридный подход оптимален."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
