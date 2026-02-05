# 16.4 Code Refactoring

## Примеры рефакторинга на собеседованиях

### Пример 1: God Controller

**❌ Было (плохо):**

```php
class UserController extends Controller
{
    public function store(Request $request)
    {
        // 1. Валидация
        if (!$request->has('name') || strlen($request->name) < 3) {
            return back()->withErrors(['name' => 'Name too short']);
        }
        if (!filter_var($request->email, FILTER_VALIDATE_EMAIL)) {
            return back()->withErrors(['email' => 'Invalid email']);
        }
        if (User::where('email', $request->email)->exists()) {
            return back()->withErrors(['email' => 'Email taken']);
        }

        // 2. Создание пользователя
        $user = new User();
        $user->name = $request->name;
        $user->email = $request->email;
        $user->password = Hash::make($request->password);
        $user->save();

        // 3. Создание профиля
        $profile = new Profile();
        $profile->user_id = $user->id;
        $profile->avatar = 'default.png';
        $profile->bio = '';
        $profile->save();

        // 4. Отправка email
        $to = $user->email;
        $subject = 'Welcome!';
        $message = "Hi {$user->name}, welcome to our site!";
        mail($to, $subject, $message);

        // 5. Логирование
        Log::info("User registered: {$user->id}");

        // 6. Increment counter
        Cache::increment('users.total');

        return redirect('/dashboard');
    }
}
```

**Проблемы:**

```
- Слишком много ответственностей
- Нет тестов (сложно)
- Дублирование логики
- Нет переиспользования
- Нарушение SOLID
```

**✅ Стало (хорошо):**

```php
// 1. Request validation
class StoreUserRequest extends FormRequest
{
    public function rules()
    {
        return [
            'name' => 'required|min:3|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ];
    }
}

// 2. Service
class UserService
{
    public function __construct(
        private UserRepository $users,
        private MailService $mail
    ) {}

    public function register(array $data): User
    {
        DB::beginTransaction();

        try {
            // Создать user
            $user = $this->users->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);

            // Создать profile
            $user->profile()->create([
                'avatar' => 'default.png',
                'bio' => '',
            ]);

            // Email через queue
            $this->mail->sendWelcome($user);

            // Event
            event(new UserRegistered($user));

            DB::commit();

            return $user;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

// 3. Observer для side effects
class UserObserver
{
    public function created(User $user)
    {
        Log::info("User registered: {$user->id}");
        Cache::increment('users.total');
    }
}

// 4. Controller (тонкий)
class UserController extends Controller
{
    public function __construct(
        private UserService $userService
    ) {}

    public function store(StoreUserRequest $request)
    {
        $user = $this->userService->register($request->validated());

        return redirect('/dashboard');
    }
}
```

**Преимущества:**

```
✓ Единая ответственность
✓ Переиспользуемый код
✓ Легко тестировать
✓ Следует SOLID
✓ DRY
```

---

### Пример 2: Nested If-Else Hell

**❌ Было:**

```php
public function calculateDiscount(User $user, Order $order)
{
    if ($user->isActive()) {
        if ($user->isVip()) {
            if ($order->total > 100) {
                if ($order->items->count() > 5) {
                    return $order->total * 0.25;
                } else {
                    return $order->total * 0.20;
                }
            } else {
                return $order->total * 0.10;
            }
        } else {
            if ($order->total > 50) {
                return $order->total * 0.05;
            } else {
                return 0;
            }
        }
    } else {
        return 0;
    }
}
```

**✅ Стало (Early Return):**

```php
public function calculateDiscount(User $user, Order $order): float
{
    // Guard clauses
    if (!$user->isActive()) {
        return 0;
    }

    if (!$user->isVip()) {
        return $order->total > 50 ? $order->total * 0.05 : 0;
    }

    // VIP logic
    if ($order->total <= 100) {
        return $order->total * 0.10;
    }

    return $order->items->count() > 5
        ? $order->total * 0.25
        : $order->total * 0.20;
}
```

**Ещё лучше (Strategy Pattern):**

```php
interface DiscountStrategy
{
    public function calculate(Order $order): float;
}

class VipLargeOrderDiscount implements DiscountStrategy
{
    public function calculate(Order $order): float
    {
        return $order->total * 0.25;
    }
}

class VipRegularOrderDiscount implements DiscountStrategy
{
    public function calculate(Order $order): float
    {
        return $order->total * 0.20;
    }
}

class RegularUserDiscount implements DiscountStrategy
{
    public function calculate(Order $order): float
    {
        return $order->total > 50 ? $order->total * 0.05 : 0;
    }
}

class DiscountCalculator
{
    public function calculate(User $user, Order $order): float
    {
        $strategy = $this->resolveStrategy($user, $order);
        return $strategy->calculate($order);
    }

    private function resolveStrategy(User $user, Order $order): DiscountStrategy
    {
        if (!$user->isActive()) {
            return new NoDiscount();
        }

        if ($user->isVip() && $order->total > 100 && $order->items->count() > 5) {
            return new VipLargeOrderDiscount();
        }

        if ($user->isVip() && $order->total > 100) {
            return new VipRegularOrderDiscount();
        }

        return new RegularUserDiscount();
    }
}
```

---

### Пример 3: Duplicate Code

**❌ Было:**

```php
class OrderController extends Controller
{
    public function adminIndex()
    {
        $orders = Order::where('status', 'pending')
            ->with('user', 'items')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return view('admin.orders', compact('orders'));
    }

    public function userOrders()
    {
        $orders = Order::where('status', 'pending')
            ->where('user_id', auth()->id())
            ->with('user', 'items')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return view('user.orders', compact('orders'));
    }

    public function apiOrders()
    {
        $orders = Order::where('status', 'pending')
            ->with('user', 'items')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($orders);
    }
}
```

**✅ Стало:**

```php
// Repository
class OrderRepository
{
    public function getPending(?int $userId = null)
    {
        return Order::where('status', 'pending')
            ->when($userId, fn($q) => $q->where('user_id', $userId))
            ->with('user', 'items')
            ->orderBy('created_at', 'desc')
            ->paginate(20);
    }
}

// Controller
class OrderController extends Controller
{
    public function __construct(
        private OrderRepository $orders
    ) {}

    public function adminIndex()
    {
        $orders = $this->orders->getPending();
        return view('admin.orders', compact('orders'));
    }

    public function userOrders()
    {
        $orders = $this->orders->getPending(auth()->id());
        return view('user.orders', compact('orders'));
    }

    public function apiOrders()
    {
        return response()->json($this->orders->getPending());
    }
}
```

---

### Пример 4: Long Method

**❌ Было:**

```php
public function processOrder(Order $order)
{
    // 150 строк кода...

    // Валидация
    if ($order->total < 0) {
        throw new InvalidOrderException();
    }
    if ($order->items->isEmpty()) {
        throw new EmptyOrderException();
    }

    // Inventory check
    foreach ($order->items as $item) {
        $product = Product::find($item->product_id);
        if ($product->stock < $item->quantity) {
            throw new InsufficientStockException();
        }
    }

    // Payment
    $stripe = new \Stripe\StripeClient(config('stripe.key'));
    try {
        $charge = $stripe->charges->create([
            'amount' => $order->total * 100,
            'currency' => 'usd',
            'source' => $order->payment_method_id,
        ]);
    } catch (\Stripe\Exception\CardException $e) {
        throw new PaymentFailedException($e->getMessage());
    }

    // Update inventory
    foreach ($order->items as $item) {
        $product = Product::find($item->product_id);
        $product->stock -= $item->quantity;
        $product->save();
    }

    // Create shipment
    $shipment = new Shipment();
    $shipment->order_id = $order->id;
    $shipment->address = $order->shipping_address;
    $shipment->save();

    // Send emails
    Mail::to($order->user)->send(new OrderConfirmation($order));
    Mail::to('admin@example.com')->send(new NewOrderNotification($order));

    // Update order
    $order->status = 'paid';
    $order->paid_at = now();
    $order->save();

    return $order;
}
```

**✅ Стало:**

```php
class OrderProcessor
{
    public function __construct(
        private OrderValidator $validator,
        private InventoryService $inventory,
        private PaymentService $payment,
        private ShipmentService $shipment,
        private NotificationService $notifications
    ) {}

    public function process(Order $order): Order
    {
        DB::transaction(function () use ($order) {
            $this->validator->validate($order);
            $this->inventory->reserve($order);
            $this->payment->charge($order);
            $this->inventory->deduct($order);
            $this->shipment->create($order);
            $this->updateOrderStatus($order);
            $this->notifications->sendOrderConfirmation($order);
        });

        return $order;
    }

    private function updateOrderStatus(Order $order): void
    {
        $order->update([
            'status' => 'paid',
            'paid_at' => now(),
        ]);
    }
}
```

---

### Пример 5: Magic Numbers

**❌ Было:**

```php
if ($user->age >= 18) {
    // ...
}

if ($order->total > 100) {
    $discount = $order->total * 0.10;
}

if ($subscription->type === 1) {
    // Pro subscription
}

Cache::remember('products', 3600, fn() => Product::all());
```

**✅ Стало:**

```php
class User extends Model
{
    public const ADULT_AGE = 18;

    public function isAdult(): bool
    {
        return $this->age >= self::ADULT_AGE;
    }
}

class Order extends Model
{
    public const DISCOUNT_THRESHOLD = 100;
    public const DISCOUNT_PERCENTAGE = 0.10;

    public function calculateDiscount(): float
    {
        if ($this->total > self::DISCOUNT_THRESHOLD) {
            return $this->total * self::DISCOUNT_PERCENTAGE;
        }

        return 0;
    }
}

enum SubscriptionType: int
{
    case FREE = 0;
    case PRO = 1;
    case ENTERPRISE = 2;
}

if ($subscription->type === SubscriptionType::PRO) {
    // Pro subscription
}

// Config для времени кеша
Cache::remember('products', config('cache.ttl.products'), fn() => Product::all());
```

---

### Пример 6: Primitive Obsession

**❌ Было:**

```php
class User
{
    public string $email;
}

function sendEmail(string $email)
{
    // Нет валидации, можно передать "invalid-email"
    mail($email, ...);
}
```

**✅ Стало:**

```php
class Email
{
    private string $value;

    public function __construct(string $value)
    {
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidEmailException();
        }

        $this->value = $value;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}

class User
{
    public Email $email;
}

function sendEmail(Email $email)
{
    // Email гарантированно валидный
    mail($email->getValue(), ...);
}
```

---

## Принципы рефакторинга

**1. DRY (Don't Repeat Yourself):**

```
Дублирующийся код → Функция/Метод/Класс
```

**2. KISS (Keep It Simple, Stupid):**

```
Сложный код → Простые маленькие функции
```

**3. YAGNI (You Aren't Gonna Need It):**

```
Удали неиспользуемый код
```

**4. Extract Method:**

```
Длинный метод → Несколько коротких
```

**5. Replace Conditional with Polymorphism:**

```
if/else → Strategy Pattern / Inheritance
```

**6. Introduce Parameter Object:**

```
Много параметров → Объект
```

---

## Code Smells

**1. Long Method** (> 20 строк)
**2. Large Class** (> 200 строк)
**3. Long Parameter List** (> 3-4 параметра)
**4. Duplicate Code**
**5. Dead Code** (неиспользуемый)
**6. Comments** (вместо читаемого кода)
**7. Magic Numbers**
**8. Temporary Field**
**9. Feature Envy** (метод использует больше данных другого класса)
**10. Data Clumps** (группы данных всегда вместе)

---

## На собеседовании скажешь

> "Refactoring: God Controller → тонкий контроллер + Service + Repository. Nested if-else → Early Return или Strategy Pattern. Duplicate code → Extract Method, DRY. Long Method → разбить на маленькие методы. Magic Numbers → константы или enum. Primitive Obsession → Value Objects. Принципы: DRY, KISS, YAGNI, SOLID. Code smells: Long Method, Large Class, Duplicate Code, Dead Code. Рефакторинг должен сохранять функциональность (тесты!)."

