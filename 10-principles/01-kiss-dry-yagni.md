# 10.1 KISS, DRY, YAGNI

## Краткое резюме

> **KISS** — простота важнее сложности. Избегать overengineering.
>
> **DRY** — каждое знание в одном месте. Нет дублирования (но не ради случайного сходства).
>
> **YAGNI** — не добавлять функциональность пока не нужна. Избегать "а вдруг понадобится".

---

## Содержание

- [KISS (Keep It Simple, Stupid)](#kiss-keep-it-simple-stupid)
- [Примеры KISS](#примеры-kiss)
- [DRY (Don't Repeat Yourself)](#dry-dont-repeat-yourself)
- [Примеры DRY](#примеры-dry)
- [YAGNI (You Aren't Gonna Need It)](#yagni-you-arent-gonna-need-it)
- [Примеры YAGNI](#примеры-yagni)
- [Когда нарушать принципы](#когда-нарушать-принципы)
- [Комбинация принципов](#комбинация-принципов)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## KISS (Keep It Simple, Stupid)

**Принцип:**
Простота важнее сложности. Код должен быть понятным.

**Зачем:**
- Легче читать
- Легче тестировать
- Легче поддерживать
- Меньше багов

---

### Примеры KISS

**❌ Сложно:**

```php
class OrderProcessor
{
    public function process($order)
    {
        $strategy = $this->strategyFactory->create(
            $this->configResolver->resolve($order->type)
        );

        $pipeline = new Pipeline($this->container);
        $result = $pipeline
            ->send($order)
            ->through([
                ValidateOrderMiddleware::class,
                CalculateTotalsMiddleware::class,
                ApplyDiscountsMiddleware::class,
            ])
            ->then(function ($order) use ($strategy) {
                return $strategy->execute($order);
            });

        return $result;
    }
}

// Overengineering для простой задачи!
```

**✅ Просто:**

```php
class OrderProcessor
{
    public function process(Order $order)
    {
        // 1. Validate
        if ($order->items->isEmpty()) {
            throw new InvalidOrderException('Order is empty');
        }

        // 2. Calculate total
        $order->total = $order->items->sum(fn($item) => $item->price * $item->quantity);

        // 3. Apply discount
        if ($order->discount_code) {
            $order->total -= $this->calculateDiscount($order);
        }

        // 4. Save
        $order->save();

        return $order;
    }
}

// Понятно с первого взгляда!
```

---

**❌ Сложно:**

```php
// Abstract factory для простой логики
interface ShapeFactory
{
    public function createShape(): Shape;
}

class CircleFactory implements ShapeFactory
{
    public function createShape(): Shape
    {
        return new Circle();
    }
}

class SquareFactory implements ShapeFactory
{
    public function createShape(): Shape
    {
        return new Square();
    }
}

$factory = $type === 'circle' ? new CircleFactory() : new SquareFactory();
$shape = $factory->createShape();
```

**✅ Просто:**

```php
// Прямолинейно
$shape = $type === 'circle' ? new Circle() : new Square();

// Или если нужна гибкость
$shapes = [
    'circle' => Circle::class,
    'square' => Square::class,
];

$shape = new $shapes[$type]();
```

---

**Когда KISS нарушается:**
- Преждевременная оптимизация
- Overengineering (паттерны ради паттернов)
- "А вдруг понадобится в будущем"

**Правило:**
> "Всегда пиши код так, будто его будет поддерживать психопат, знающий где ты живёшь"

---

## DRY (Don't Repeat Yourself)

**Принцип:**
Каждый кусок знания должен иметь единственное, однозначное представление в системе.

**Зачем:**
- Изменения в одном месте
- Меньше дублирования
- Проще рефакторинг

---

### Примеры DRY

**❌ WET (Write Everything Twice):**

```php
class UserController
{
    public function store(Request $request)
    {
        $user = new User();
        $user->name = $request->name;
        $user->email = $request->email;
        $user->password = Hash::make($request->password);
        $user->save();

        Mail::to($user->email)->send(new WelcomeEmail($user));
        Log::info("User {$user->id} registered");

        return response()->json($user);
    }

    public function register(Request $request)
    {
        // Дублирование!
        $user = new User();
        $user->name = $request->name;
        $user->email = $request->email;
        $user->password = Hash::make($request->password);
        $user->save();

        Mail::to($user->email)->send(new WelcomeEmail($user));
        Log::info("User {$user->id} registered");

        return redirect('/dashboard');
    }
}
```

**✅ DRY:**

```php
class UserController
{
    public function store(Request $request)
    {
        $user = $this->createUser($request);
        return response()->json($user);
    }

    public function register(Request $request)
    {
        $user = $this->createUser($request);
        return redirect('/dashboard');
    }

    private function createUser(Request $request): User
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        Mail::to($user->email)->send(new WelcomeEmail($user));
        Log::info("User {$user->id} registered");

        return $user;
    }
}
```

---

**❌ Дублирование валидации:**

```php
class OrderController
{
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        // ...
    }
}

class ApiOrderController
{
    public function store(Request $request)
    {
        // Дублирование валидации!
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        // ...
    }
}
```

**✅ DRY (Form Request):**

```php
class StoreOrderRequest extends FormRequest
{
    public function rules()
    {
        return [
            'user_id' => 'required|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ];
    }
}

class OrderController
{
    public function store(StoreOrderRequest $request)
    {
        // Валидация автоматически
    }
}

class ApiOrderController
{
    public function store(StoreOrderRequest $request)
    {
        // Та же валидация
    }
}
```

---

**Но! Не все повторения = DRY нарушение:**

```php
// ❌ Плохой DRY (false abstraction)
class StringHelper
{
    public static function getUserFullName(User $user)
    {
        return $user->first_name . ' ' . $user->last_name;
    }

    public static function getProductFullName(Product $product)
    {
        return $product->brand . ' ' . $product->model;
    }
}

// Случайное сходство, разная бизнес-логика!
```

**✅ Лучше:**

```php
class User
{
    public function getFullNameAttribute()
    {
        return "{$this->first_name} {$this->last_name}";
    }
}

class Product
{
    public function getFullNameAttribute()
    {
        return "{$this->brand} {$this->model}";
    }
}

// Разные контексты, разные методы
```

---

## YAGNI (You Aren't Gonna Need It)

**Принцип:**
Не добавляй функциональность, пока она не нужна.

**Зачем:**
- Меньше кода
- Быстрее разработка
- Проще код

---

### Примеры YAGNI

**❌ Нарушение YAGNI:**

```php
class User extends Model
{
    // "А вдруг понадобится"
    protected $guarded = [];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeInactive($query)
    {
        return $query->where('is_active', false);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    // 20 scopes "на всякий случай"...
}

// Используется только scopeActive!
```

**✅ YAGNI:**

```php
class User extends Model
{
    protected $fillable = ['name', 'email', 'password'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Добавим другие scopes когда понадобятся
}
```

---

**❌ Нарушение YAGNI:**

```php
// "Сделаем гибко, чтобы можно было легко добавить новые типы"
interface PaymentGateway
{
    public function charge($amount);
    public function refund($transactionId);
    public function subscribe($plan);
    public function cancelSubscription($subscriptionId);
    public function updateCard($token);
    public function getTransactionHistory();
    // ... 10 методов
}

class StripeGateway implements PaymentGateway
{
    public function charge($amount) { /* ... */ }
    public function refund($transactionId) { throw new NotImplementedException(); }
    public function subscribe($plan) { throw new NotImplementedException(); }
    // Используется только charge!
}
```

**✅ YAGNI:**

```php
// Просто
class StripeGateway
{
    public function charge($amount)
    {
        // Простая реализация
    }
}

// Если понадобятся другие методы — добавим
// Если понадобятся другие gateways — добавим интерфейс
```

---

**❌ Нарушение YAGNI:**

```php
// Настраиваемость "на будущее"
class OrderProcessor
{
    public function process(
        Order $order,
        ?string $strategy = null,
        ?array $middlewares = null,
        ?LoggerInterface $logger = null,
        ?CacheInterface $cache = null,
        ?EventDispatcher $dispatcher = null
    ) {
        // Complexity никому не нужная
    }
}
```

**✅ YAGNI:**

```php
class OrderProcessor
{
    public function process(Order $order)
    {
        // Простая реализация
        // Если понадобится гибкость — рефакторим
    }
}
```

---

## Когда нарушать принципы

**KISS можно нарушить когда:**
- Производительность критична (оптимизация усложняет код)
- Domain логика сложная по природе

**DRY можно нарушить когда:**
- Случайное сходство (разные контексты)
- Decoupling важнее (микросервисы)

**YAGNI можно нарушить когда:**
- Refactoring стоит дорого (legacy код)
- API contract нужен сразу (библиотеки)

---

## Комбинация принципов

**Хороший код:**

```php
// KISS: просто и понятно
// DRY: нет дублирования
// YAGNI: только нужная функциональность

class OrderService
{
    public function create(array $data): Order
    {
        $order = Order::create([
            'user_id' => $data['user_id'],
            'total' => $this->calculateTotal($data['items']),
        ]);

        foreach ($data['items'] as $item) {
            $order->items()->create($item);
        }

        event(new OrderCreated($order));

        return $order;
    }

    private function calculateTotal(array $items): float
    {
        return array_sum(array_map(
            fn($item) => $item['price'] * $item['quantity'],
            $items
        ));
    }
}
```

---

## На собеседовании скажешь

> "KISS — простота важнее сложности, избегать overengineering. DRY — каждое знание в одном месте, нет дублирования, но не ради случайного сходства. YAGNI — не добавлять функциональность пока не нужна, избегать 'а вдруг понадобится'. Нарушать можно: KISS при оптимизации, DRY при разных контекстах, YAGNI при дорогом рефакторинге. Laravel примеры: Form Requests для DRY валидации, простые сервисы вместо паттернов для KISS, добавлять scopes по мере надобности для YAGNI."

---

## Практические задания

### Задание 1: Упрости overengineered код

Упрости этот код следуя принципу KISS.

```php
// Overengineered
interface ShapeFactoryInterface
{
    public function createShape(): ShapeInterface;
}

class CircleFactory implements ShapeFactoryInterface
{
    public function createShape(): ShapeInterface
    {
        return new Circle();
    }
}

class ShapeManager
{
    private array $factories = [];

    public function registerFactory(string $type, ShapeFactoryInterface $factory): void
    {
        $this->factories[$type] = $factory;
    }

    public function createShape(string $type): ShapeInterface
    {
        if (!isset($this->factories[$type])) {
            throw new InvalidArgumentException("Unknown shape type: $type");
        }

        return $this->factories[$type]->createShape();
    }
}

$manager = new ShapeManager();
$manager->registerFactory('circle', new CircleFactory());
$shape = $manager->createShape('circle');
```

<details>
<summary>Решение</summary>

```php
// ✅ KISS: Просто и понятно

// Вариант 1: Прямолинейно (если не нужна гибкость)
$shape = match($type) {
    'circle' => new Circle(),
    'square' => new Square(),
    'triangle' => new Triangle(),
    default => throw new InvalidArgumentException("Unknown shape: $type"),
};

// Вариант 2: Простая фабрика (если нужна минимальная гибкость)
class ShapeFactory
{
    private const SHAPES = [
        'circle' => Circle::class,
        'square' => Square::class,
        'triangle' => Triangle::class,
    ];

    public static function create(string $type): Shape
    {
        $class = self::SHAPES[$type] ?? throw new InvalidArgumentException("Unknown shape: $type");

        return new $class();
    }
}

$shape = ShapeFactory::create('circle');

// Когда использовать overengineered вариант:
// - Нужна runtime регистрация типов
// - Plugins система
// - DI container
//
// Для простого создания объектов — KISS!
```
</details>

### Задание 2: Исправь дублирование (DRY)

Найди и исправь дублирование кода.

```php
class UserController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        Mail::to($user->email)->send(new WelcomeEmail($user));
        Log::info("User registered: {$user->id}");

        return response()->json($user, 201);
    }

    public function adminStore(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'is_admin' => true,
        ]);

        Mail::to($user->email)->send(new WelcomeEmail($user));
        Log::info("Admin registered: {$user->id}");

        return redirect()->route('admin.users.index');
    }
}
```

<details>
<summary>Решение</summary>

```php
// ✅ DRY: Вынести общую логику

// 1. Form Request для валидации
class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ];
    }
}

// 2. Service для бизнес-логики
class UserService
{
    public function create(array $data, bool $isAdmin = false): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'is_admin' => $isAdmin,
        ]);

        // События вместо прямого вызова
        event(new UserRegistered($user, $isAdmin));

        return $user;
    }
}

// 3. Listener для побочных эффектов
class SendWelcomeEmail
{
    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user->email)->send(new WelcomeEmail($event->user));
    }
}

class LogUserRegistration
{
    public function handle(UserRegistered $event): void
    {
        $type = $event->isAdmin ? 'Admin' : 'User';
        Log::info("$type registered: {$event->user->id}");
    }
}

// 4. Контроллеры (тонкие!)
class UserController extends Controller
{
    public function store(StoreUserRequest $request, UserService $userService)
    {
        $user = $userService->create($request->validated());

        return response()->json($user, 201);
    }

    public function adminStore(StoreUserRequest $request, UserService $userService)
    {
        $user = $userService->create($request->validated(), isAdmin: true);

        return redirect()->route('admin.users.index');
    }
}

// Преимущества:
// - Валидация в одном месте
// - Логика создания в одном месте
// - Легко тестировать
// - Легко добавить новые типы пользователей
```
</details>

### Задание 3: Примени YAGNI

Упрости код убрав ненужную функциональность.

```php
class Product extends Model
{
    protected $fillable = [
        'name', 'description', 'price', 'stock', 'category_id',
        'brand', 'sku', 'weight', 'dimensions', 'color', 'size',
        'material', 'warranty_months', 'is_active', 'is_featured',
        'is_on_sale', 'sale_price', 'sale_starts_at', 'sale_ends_at',
        'meta_title', 'meta_description', 'meta_keywords',
    ];

    // 20+ scopes "на всякий случай"
    public function scopeActive($query) { return $query->where('is_active', true); }
    public function scopeInactive($query) { return $query->where('is_active', false); }
    public function scopeFeatured($query) { return $query->where('is_featured', true); }
    public function scopeOnSale($query) { return $query->where('is_on_sale', true); }
    public function scopeInStock($query) { return $query->where('stock', '>', 0); }
    public function scopeOutOfStock($query) { return $query->where('stock', 0); }
    public function scopeByBrand($query, $brand) { return $query->where('brand', $brand); }
    public function scopeByCategory($query, $categoryId) { return $query->where('category_id', $categoryId); }
    public function scopePriceRange($query, $min, $max) { return $query->whereBetween('price', [$min, $max]); }
    // ... ещё 10 scopes которые никогда не используются
}

// Используются только: active, inStock, byCategory
```

<details>
<summary>Решение</summary>

```php
// ✅ YAGNI: Оставить только используемое

class Product extends Model
{
    // Минимальный fillable (добавим остальное когда понадобится)
    protected $fillable = [
        'name',
        'description',
        'price',
        'stock',
        'category_id',
        'is_active',
    ];

    // Только используемые scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeInStock($query)
    {
        return $query->where('stock', '>', 0);
    }

    public function scopeByCategory($query, int $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    // Relations (только нужные)
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    // Добавим другие scopes/fields когда реально понадобятся!
}

// Использование
Product::active()->inStock()->byCategory(1)->get();

// Если понадобится featured:
// public function scopeFeatured($query)
// {
//     return $query->where('is_featured', true);
// }

// Принцип: Start small, grow when needed
// Не "а вдруг понадобится", а "добавлю когда понадобится"
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
