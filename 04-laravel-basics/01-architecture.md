# 4.1 Архитектура Laravel

## Краткое резюме

> **Laravel** — MVC фреймворк с архитектурой на Service Container и Service Providers.
>
> **Request Lifecycle:** index.php → Bootstrap → Kernel → Service Providers → Router → Middleware → Controller → Model → View → Response.
>
> **Важно:** Service Container для DI, Facades для статического доступа к сервисам.

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
Laravel — MVC фреймворк с архитектурой, построенной на Service Container и Service Providers. Основные компоненты: Router → Middleware → Controller → Model → View.

**Основные принципы:**
- **MVC паттерн** (Model-View-Controller)
- **Service Container** (IoC контейнер для DI)
- **Facades** (статический интерфейс к сервисам)
- **Request Lifecycle** (жизненный цикл запроса)

---

## Как работает

**Request Lifecycle:**

```
1. public/index.php (точка входа)
   ↓
2. Bootstrap (загрузка фреймворка)
   ↓
3. Kernel (HTTP Kernel)
   ↓
4. Service Providers (регистрация сервисов)
   ↓
5. Router (маршрутизация)
   ↓
6. Middleware (обработка запроса)
   ↓
7. Controller (бизнес-логика)
   ↓
8. Model (работа с данными)
   ↓
9. View (отображение)
   ↓
10. Response (ответ клиенту)
```

**Структура директорий:**

```
app/
├── Console/          # Artisan команды
├── Exceptions/       # Обработка исключений
├── Http/
│   ├── Controllers/  # Контроллеры
│   ├── Middleware/   # Middleware
│   └── Requests/     # Form Requests
├── Models/           # Eloquent модели
├── Providers/        # Service Providers
└── Services/         # Бизнес-логика

bootstrap/           # Загрузка фреймворка
config/             # Конфигурация
database/
├── migrations/     # Миграции БД
├── seeders/        # Сидеры
└── factories/      # Фабрики

public/             # Публичные файлы
├── index.php       # Точка входа

resources/
├── views/          # Blade шаблоны
└── js/             # Frontend ресурсы

routes/
├── web.php         # Веб-маршруты
├── api.php         # API маршруты
└── console.php     # Artisan команды

storage/            # Логи, кеш, сессии
tests/              # Тесты
vendor/             # Composer зависимости
```

**MVC в Laravel:**

```php
// Model (app/Models/User.php)
class User extends Model
{
    protected $fillable = ['name', 'email'];

    public function posts()
    {
        return $this->hasMany(Post::class);
    }
}

// Controller (app/Http/Controllers/UserController.php)
class UserController extends Controller
{
    public function show(User $user)
    {
        return view('users.show', [
            'user' => $user,
            'posts' => $user->posts
        ]);
    }
}

// View (resources/views/users/show.blade.php)
<h1>{{ $user->name }}</h1>
<p>{{ $user->email }}</p>

@foreach ($posts as $post)
    <article>{{ $post->title }}</article>
@endforeach

// Route (routes/web.php)
Route::get('/users/{user}', [UserController::class, 'show']);
```

**Service Container (IoC):**

```php
// Регистрация в AppServiceProvider
public function register(): void
{
    $this->app->singleton(PaymentService::class, function ($app) {
        return new PaymentService(
            $app->make(PaymentGateway::class)
        );
    });
}

// Автоматическая инъекция в контроллер
class OrderController extends Controller
{
    public function __construct(
        private PaymentService $paymentService
    ) {}

    public function store(Request $request)
    {
        // $paymentService автоматически внедрён
        $this->paymentService->charge($request->amount);
    }
}
```

---

## Когда использовать

**Используй Laravel когда:**
- Нужен полнофункциональный фреймворк (не микрофреймворк)
- Проект средний/большой размер
- Важна скорость разработки
- Нужен ORM (Eloquent), роутинг, middleware из коробки
- Команда знает Laravel

**НЕ используй когда:**
- Микросервис с минимальными зависимостями (Lumen, Slim)
- Высоконагруженный проект требует максимальной производительности (Symfony components, RoadRunner)
- Legacy проект на другом фреймворке

---

## Пример из практики

**Типичная архитектура приложения:**

```php
// 1. Route (routes/api.php)
Route::post('/orders', [OrderController::class, 'store'])
    ->middleware(['auth:sanctum', 'throttle:60,1']);

// 2. Middleware (app/Http/Middleware/Authenticate.php)
class Authenticate extends Middleware
{
    protected function redirectTo($request)
    {
        if (!$request->expectsJson()) {
            return route('login');
        }
    }
}

// 3. Controller (app/Http/Controllers/OrderController.php)
class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {}

    public function store(CreateOrderRequest $request)
    {
        $order = $this->orderService->create(
            $request->user(),
            $request->validated()
        );

        return new OrderResource($order);
    }
}

// 4. Form Request (app/Http/Requests/CreateOrderRequest.php)
class CreateOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
        ];
    }
}

// 5. Service (app/Services/OrderService.php)
class OrderService
{
    public function __construct(
        private PaymentService $paymentService,
        private NotificationService $notificationService
    ) {}

    public function create(User $user, array $data): Order
    {
        DB::beginTransaction();

        try {
            $order = Order::create([
                'user_id' => $user->id,
                'product_id' => $data['product_id'],
                'quantity' => $data['quantity'],
                'total' => $this->calculateTotal($data),
            ]);

            $this->paymentService->charge($order);
            $this->notificationService->sendOrderConfirmation($order);

            DB::commit();

            return $order;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

// 6. Model (app/Models/Order.php)
class Order extends Model
{
    protected $fillable = ['user_id', 'product_id', 'quantity', 'total'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}

// 7. Resource (app/Http/Resources/OrderResource.php)
class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'user' => new UserResource($this->whenLoaded('user')),
            'product' => new ProductResource($this->whenLoaded('product')),
            'quantity' => $this->quantity,
            'total' => $this->total,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
```

**Service Provider для инициализации:**

```php
// app/Providers/AppServiceProvider.php
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Регистрация сервисов
        $this->app->singleton(PaymentService::class, function ($app) {
            return new PaymentService(
                config('services.payment.key'),
                $app->make(HttpClient::class)
            );
        });
    }

    public function boot(): void
    {
        // Валидаторы, макросы, event listeners
        Validator::extend('phone', function ($attribute, $value) {
            return preg_match('/^\+7\d{10}$/', $value);
        });

        // Model observers
        Order::observe(OrderObserver::class);
    }
}
```

**Lifecycle в деталях:**

```php
// public/index.php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

// app/Http/Kernel.php
class Kernel extends HttpKernel
{
    // Глобальные middleware (выполняются всегда)
    protected $middleware = [
        \App\Http\Middleware\TrustProxies::class,
        \Illuminate\Http\Middleware\HandleCors::class,
    ];

    // Middleware группы (по имени)
    protected $middlewareGroups = [
        'web' => [
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
        ],

        'api' => [
            'throttle:60,1',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];
}
```

---

## На собеседовании скажешь

> "Laravel использует MVC архитектуру. Request lifecycle: index.php → Bootstrap → Kernel → Service Providers → Router → Middleware → Controller → Model → View → Response. Service Container (IoC) для DI. Структура: app/ (код), routes/ (маршруты), resources/views/ (шаблоны), database/ (миграции). В проектах использую Service слой для бизнес-логики, Form Requests для валидации, Resources для API ответов."

---

## Практические задания

### Задание 1: Объясни Request Lifecycle

У тебя есть маршрут `POST /api/orders`. Опиши полный путь запроса от `index.php` до ответа клиенту.

<details>
<summary>Решение</summary>

```
1. public/index.php
   - Точка входа, загрузка автозагрузчика Composer
   - Создание Application экземпляра

2. bootstrap/app.php
   - Создание Service Container
   - Регистрация ядра (HTTP Kernel)

3. app/Http/Kernel.php
   - Загрузка middleware стека
   - Глобальные middleware (TrustProxies, HandleCors)

4. Service Providers (config/app.php)
   - AppServiceProvider::register()
   - RouteServiceProvider::register()
   - EventServiceProvider::register()
   - ...boot() для всех providers

5. Router (routes/api.php)
   - Поиск маршрута POST /api/orders
   - Применение route middleware группы 'api'

6. Middleware группы 'api'
   - throttle:60,1 (rate limiting)
   - SubstituteBindings (route model binding)
   - Authenticate (если указан auth:sanctum)

7. Controller (OrderController::store)
   - Dependency Injection (OrderService)
   - Form Request валидация (CreateOrderRequest)

8. Service Layer (OrderService::create)
   - Бизнес-логика
   - DB транзакции
   - Event dispatching

9. Model (Order::create)
   - Eloquent ORM
   - Database запрос

10. Response
    - API Resource (OrderResource)
    - JSON serialization
    - HTTP Response

11. Middleware (в обратном порядке)
    - Финальная обработка Response

12. Клиенту
    - JSON ответ
```
</details>

### Задание 2: Организуй структуру для новой функции

Нужна функция "Экспорт заказов в PDF". Какие файлы/классы создашь и где?

<details>
<summary>Решение</summary>

```php
// 1. Route (routes/api.php)
Route::get('/orders/export', [OrderExportController::class, 'export'])
    ->middleware(['auth:sanctum', 'throttle:10,1']);

// 2. Controller (app/Http/Controllers/OrderExportController.php)
class OrderExportController extends Controller
{
    public function __construct(
        private OrderExportService $exportService
    ) {}

    public function export(Request $request)
    {
        $pdf = $this->exportService->exportToPdf(
            $request->user(),
            $request->validated()
        );

        return response()->download($pdf, 'orders.pdf');
    }
}

// 3. Form Request (app/Http/Requests/ExportOrdersRequest.php)
class ExportOrdersRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'status' => 'nullable|in:pending,completed,cancelled',
        ];
    }
}

// 4. Service (app/Services/OrderExportService.php)
class OrderExportService
{
    public function __construct(
        private PdfGenerator $pdfGenerator
    ) {}

    public function exportToPdf(User $user, array $filters): string
    {
        $orders = Order::where('user_id', $user->id)
            ->whereBetween('created_at', [$filters['start_date'], $filters['end_date']])
            ->when($filters['status'] ?? null, fn($q, $status) => $q->where('status', $status))
            ->with(['items.product'])
            ->get();

        return $this->pdfGenerator->generate('exports.orders', [
            'orders' => $orders,
            'user' => $user,
        ]);
    }
}

// 5. PDF Generator (app/Services/PdfGenerator.php)
class PdfGenerator
{
    public function generate(string $view, array $data): string
    {
        $pdf = PDF::loadView($view, $data);
        $filename = storage_path('app/exports/' . Str::uuid() . '.pdf');
        $pdf->save($filename);
        return $filename;
    }
}

// 6. View (resources/views/exports/orders.blade.php)
<!DOCTYPE html>
<html>
<body>
    <h1>Orders for {{ $user->name }}</h1>
    @foreach($orders as $order)
        <div>
            Order #{{ $order->id }} - {{ $order->total }}
        </div>
    @endforeach
</body>
</html>

// 7. Service Provider (app/Providers/AppServiceProvider.php)
public function register(): void
{
    $this->app->singleton(PdfGenerator::class);
}

// 8. Test (tests/Feature/OrderExportTest.php)
public function test_user_can_export_orders_to_pdf()
{
    $user = User::factory()->create();
    Order::factory()->count(5)->create(['user_id' => $user->id]);

    $response = $this->actingAs($user)->getJson('/api/orders/export', [
        'start_date' => now()->subDays(30),
        'end_date' => now(),
    ]);

    $response->assertStatus(200);
    $response->assertHeader('content-type', 'application/pdf');
}
```

**Структура директорий:**
```
app/
├── Http/
│   ├── Controllers/
│   │   └── OrderExportController.php
│   └── Requests/
│       └── ExportOrdersRequest.php
├── Services/
│   ├── OrderExportService.php
│   └── PdfGenerator.php
resources/
└── views/
    └── exports/
        └── orders.blade.php
tests/
└── Feature/
    └── OrderExportTest.php
```
</details>

### Задание 3: Какой паттерн лучше?

У тебя контроллер с 10 методами и 500 строк кода. Как рефакторить?

<details>
<summary>Решение</summary>

**Проблема:**
```php
// ❌ ПЛОХО: Fat Controller
class OrderController extends Controller
{
    public function store(Request $request)
    {
        // 50 строк валидации
        // 100 строк бизнес-логики
        // 50 строк отправки уведомлений
        // 30 строк логирования
    }
}
```

**Решение 1: Service Layer (рекомендуется)**
```php
// ✅ ХОРОШО: Тонкий контроллер + Service
class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {}

    public function store(CreateOrderRequest $request)
    {
        $order = $this->orderService->create(
            $request->user(),
            $request->validated()
        );

        return new OrderResource($order);
    }
}

// Service для бизнес-логики
class OrderService
{
    public function __construct(
        private PaymentService $paymentService,
        private NotificationService $notificationService
    ) {}

    public function create(User $user, array $data): Order
    {
        DB::beginTransaction();
        try {
            $order = Order::create([...]);
            $this->paymentService->charge($order);
            $this->notificationService->sendOrderConfirmation($order);
            DB::commit();
            return $order;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

**Решение 2: Action Pattern (для сложных операций)**
```php
// Single Action Controller
class CreateOrderAction extends Controller
{
    public function __invoke(
        CreateOrderRequest $request,
        OrderService $orderService
    ) {
        $order = $orderService->create(
            $request->user(),
            $request->validated()
        );

        return new OrderResource($order);
    }
}

// Route
Route::post('/orders', CreateOrderAction::class);
```

**Решение 3: Repository Pattern (для сложных запросов)**
```php
interface OrderRepository
{
    public function create(array $data): Order;
    public function findByUser(User $user): Collection;
}

class EloquentOrderRepository implements OrderRepository
{
    public function create(array $data): Order
    {
        return Order::create($data);
    }

    public function findByUser(User $user): Collection
    {
        return Order::where('user_id', $user->id)
            ->with(['items.product'])
            ->get();
    }
}
```

**Итоговая структура:**
```
app/
├── Http/
│   ├── Controllers/
│   │   └── OrderController.php (тонкий)
│   └── Requests/
│       └── CreateOrderRequest.php
├── Services/
│   ├── OrderService.php (бизнес-логика)
│   ├── PaymentService.php
│   └── NotificationService.php
├── Repositories/
│   ├── OrderRepository.php (интерфейс)
│   └── EloquentOrderRepository.php (реализация)
└── Http/Resources/
    └── OrderResource.php
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
