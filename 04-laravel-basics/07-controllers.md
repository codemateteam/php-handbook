# 4.7 Контроллеры (Controllers)

## Краткое резюме

> **Controllers** — классы для обработки HTTP запросов, группируют логику по действиям.
>
> **Типы:** Resource (CRUD), API Resource (без create/edit), Single Action (__invoke), Nested Resource.
>
> **Важно:** DI через конструктор/метод, бизнес-логику в Service, валидацию в Form Request, авторизацию через authorize().

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
Контроллеры группируют логику обработки HTTP запросов. Принимают Request, обрабатывают и возвращают Response.

**Основное:**
- Находятся в `app/Http/Controllers/`
- Методы соответствуют действиям (index, show, store, update, destroy)
- Resource controllers для CRUD

---

## Как работает

**Базовый контроллер:**

```php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();

        return view('users.index', compact('users'));
    }

    public function show(User $user)
    {
        // Route Model Binding
        return view('users.show', compact('user'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
        ]);

        $user = User::create($validated);

        return redirect()->route('users.show', $user);
    }
}
```

**Resource Controller:**

```php
// Создать resource controller
php artisan make:controller UserController --resource

// Сгенерирует методы:
class UserController extends Controller
{
    public function index()     // GET /users
    public function create()    // GET /users/create
    public function store()     // POST /users
    public function show()      // GET /users/{user}
    public function edit()      // GET /users/{user}/edit
    public function update()    // PUT/PATCH /users/{user}
    public function destroy()   // DELETE /users/{user}
}
```

**API Resource Controller:**

```php
// Без create/edit (для API)
php artisan make:controller Api/UserController --api

class UserController extends Controller
{
    public function index()     // GET /api/users
    public function store()     // POST /api/users
    public function show()      // GET /api/users/{user}
    public function update()    // PUT /PATCH /api/users/{user}
    public function destroy()   // DELETE /api/users/{user}
}
```

**Dependency Injection в контроллере:**

```php
class OrderController extends Controller
{
    // Инъекция через конструктор
    public function __construct(
        private OrderService $orderService,
        private PaymentService $paymentService
    ) {}

    // Инъекция в метод
    public function store(
        CreateOrderRequest $request,
        NotificationService $notificationService
    ) {
        $order = $this->orderService->create(
            $request->user(),
            $request->validated()
        );

        $notificationService->send($request->user(), 'Order created');

        return new OrderResource($order);
    }
}
```

**Middleware в контроллере:**

```php
class UserController extends Controller
{
    public function __construct()
    {
        // Для всех методов
        $this->middleware('auth');

        // Только для некоторых
        $this->middleware('role:admin')->only(['destroy', 'update']);

        // Кроме некоторых
        $this->middleware('guest')->except(['logout']);
    }
}
```

---

## Когда использовать

**Контроллер для:**
- Обработка HTTP запросов
- Валидация (через Form Request)
- Вызов сервисов
- Возврат Response/View/JSON

**НЕ для:**
- ❌ Бизнес-логика (вынести в Service)
- ❌ Работа с БД напрямую (через Repository/Service)
- ❌ Сложные вычисления (в Service)

---

## Пример из практики

**RESTful контроллер с сервисом:**

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\{CreateOrderRequest, UpdateOrderRequest};
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request)
    {
        $orders = $request->user()
            ->orders()
            ->with(['product', 'user'])
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    public function store(CreateOrderRequest $request)
    {
        $order = $this->orderService->create(
            $request->user(),
            $request->validated()
        );

        return new OrderResource($order);
    }

    public function show(Order $order)
    {
        $this->authorize('view', $order);

        return new OrderResource($order->load(['product', 'user']));
    }

    public function update(UpdateOrderRequest $request, Order $order)
    {
        $this->authorize('update', $order);

        $order = $this->orderService->update($order, $request->validated());

        return new OrderResource($order);
    }

    public function destroy(Order $order)
    {
        $this->authorize('delete', $order);

        $this->orderService->cancel($order);

        return response()->noContent();
    }
}
```

**Single Action Controller (одно действие):**

```php
// app/Http/Controllers/SendNewsletterController.php
class SendNewsletterController extends Controller
{
    public function __invoke(Request $request)
    {
        // Логика отправки
        Newsletter::send($request->all());

        return response()->json(['message' => 'Newsletter sent']);
    }
}

// В маршруте (без указания метода)
Route::post('/newsletter', SendNewsletterController::class);
```

**Invokable Controller для сложного действия:**

```php
// app/Http/Controllers/ExportUsersController.php
class ExportUsersController extends Controller
{
    public function __invoke(Request $request)
    {
        $filters = $request->validate([
            'role' => 'nullable|string',
            'from_date' => 'nullable|date',
        ]);

        $export = new UsersExport($filters);

        return Excel::download($export, 'users.xlsx');
    }
}

// Маршрут
Route::get('/users/export', ExportUsersController::class)
    ->middleware('role:admin');
```

**Nested Resource Controller:**

```php
// Комментарии для постов
class PostCommentController extends Controller
{
    // GET /posts/{post}/comments
    public function index(Post $post)
    {
        return CommentResource::collection(
            $post->comments()->paginate(20)
        );
    }

    // POST /posts/{post}/comments
    public function store(Request $request, Post $post)
    {
        $validated = $request->validate([
            'body' => 'required|string|max:1000',
        ]);

        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
        ]);

        return new CommentResource($comment);
    }

    // DELETE /posts/{post}/comments/{comment}
    public function destroy(Post $post, Comment $comment)
    {
        $this->authorize('delete', $comment);

        $comment->delete();

        return response()->noContent();
    }
}

// Маршрут
Route::resource('posts.comments', PostCommentController::class)
    ->only(['index', 'store', 'destroy']);
```

**Controller с кастомными методами:**

```php
class PostController extends Controller
{
    // RESTful методы
    public function index() { /* ... */ }
    public function show(Post $post) { /* ... */ }

    // Кастомные методы
    public function publish(Post $post)
    {
        $this->authorize('publish', $post);

        $post->update(['published_at' => now()]);

        return redirect()->route('posts.show', $post);
    }

    public function unpublish(Post $post)
    {
        $this->authorize('publish', $post);

        $post->update(['published_at' => null]);

        return redirect()->route('posts.show', $post);
    }
}

// Маршруты
Route::resource('posts', PostController::class);
Route::post('/posts/{post}/publish', [PostController::class, 'publish'])
    ->name('posts.publish');
Route::post('/posts/{post}/unpublish', [PostController::class, 'unpublish'])
    ->name('posts.unpublish');
```

**Возврат разных типов Response:**

```php
class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::paginate(20);

        // JSON для API
        if ($request->wantsJson()) {
            return ProductResource::collection($products);
        }

        // View для веба
        return view('products.index', compact('products'));
    }

    public function download(Product $product)
    {
        // Скачать файл
        return Storage::download($product->file_path);
    }

    public function export()
    {
        // Stream для больших файлов
        return response()->streamDownload(function () {
            $products = Product::cursor();

            foreach ($products as $product) {
                echo $product->toJson() . "\n";
            }
        }, 'products.json');
    }
}
```

**Организация контроллеров:**

```
app/Http/Controllers/
├── Api/                      # API контроллеры
│   ├── V1/
│   │   ├── UserController.php
│   │   └── OrderController.php
│   └── V2/
│       └── UserController.php
├── Admin/                    # Админка
│   ├── DashboardController.php
│   ├── UserController.php
│   └── PostController.php
├── Auth/                     # Аутентификация
│   ├── LoginController.php
│   ├── RegisterController.php
│   └── ForgotPasswordController.php
├── HomeController.php
├── PostController.php
└── UserController.php
```

**Form Request в контроллере:**

```php
class OrderController extends Controller
{
    public function store(CreateOrderRequest $request)
    {
        // Валидация уже прошла
        $validated = $request->validated();

        // Создать заказ
        $order = Order::create([
            'user_id' => $request->user()->id,
            ...$validated,
        ]);

        return new OrderResource($order);
    }
}

// app/Http/Requests/CreateOrderRequest.php
class CreateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Order::class);
    }

    public function rules(): array
    {
        return [
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
        ];
    }
}
```

---

## На собеседовании скажешь

> "Контроллеры обрабатывают HTTP запросы. Resource controller для CRUD (index, show, store, update, destroy), API controller без create/edit. DI через конструктор или метод. Бизнес-логику выношу в Service, валидацию в Form Request. authorize() для проверки прав. Single Action Controller с __invoke() для одного действия. Middleware через конструктор this->middleware()."

---

## Практические задания

### Задание 1: Создай Nested Resource Controller

Реализуй контроллер для комментариев к постам: `POST /posts/{post}/comments`, `GET /posts/{post}/comments`, `DELETE /posts/{post}/comments/{comment}`.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/PostCommentController.php
namespace App\Http\Controllers;

use App\Http\Requests\CreateCommentRequest;
use App\Http\Resources\CommentResource;
use App\Models\{Post, Comment};
use Illuminate\Http\Request;

class PostCommentController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum')->except('index');
    }

    // GET /posts/{post}/comments
    public function index(Post $post)
    {
        $comments = $post->comments()
            ->with('user')
            ->latest()
            ->paginate(20);

        return CommentResource::collection($comments);
    }

    // POST /posts/{post}/comments
    public function store(CreateCommentRequest $request, Post $post)
    {
        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $request->validated()['body'],
        ]);

        // Уведомить автора поста
        $post->user->notify(new CommentCreated($comment));

        return new CommentResource($comment->load('user'));
    }

    // DELETE /posts/{post}/comments/{comment}
    public function destroy(Post $post, Comment $comment)
    {
        // Проверить что комментарий принадлежит посту
        if ($comment->post_id !== $post->id) {
            abort(404);
        }

        $this->authorize('delete', $comment);

        $comment->delete();

        return response()->noContent();
    }
}

// routes/api.php
Route::resource('posts.comments', PostCommentController::class)
    ->only(['index', 'store', 'destroy']);

// app/Http/Requests/CreateCommentRequest.php
class CreateCommentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'body' => 'required|string|min:3|max:1000',
        ];
    }
}
```
</details>

### Задание 2: Реализуй Single Action Controller для экспорта

Создай invokable controller для экспорта пользователей в Excel с фильтрацией.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/ExportUsersController.php
namespace App\Http\Controllers;

use App\Exports\UsersExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ExportUsersController extends Controller
{
    public function __invoke(Request $request)
    {
        $this->authorize('export', User::class);

        $filters = $request->validate([
            'role' => 'nullable|string|in:admin,user,moderator',
            'status' => 'nullable|string|in:active,inactive',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date|after_or_equal:from_date',
            'search' => 'nullable|string|max:255',
        ]);

        $export = new UsersExport($filters);

        $filename = 'users_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download($export, $filename);
    }
}

// routes/web.php
Route::get('/admin/users/export', ExportUsersController::class)
    ->middleware(['auth', 'role:admin'])
    ->name('admin.users.export');

// app/Exports/UsersExport.php
namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;

class UsersExport implements FromQuery, WithHeadings
{
    public function __construct(private array $filters) {}

    public function query()
    {
        $query = User::query();

        if (!empty($this->filters['role'])) {
            $query->where('role', $this->filters['role']);
        }

        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        if (!empty($this->filters['from_date'])) {
            $query->whereDate('created_at', '>=', $this->filters['from_date']);
        }

        if (!empty($this->filters['search'])) {
            $query->where(function($q) {
                $q->where('name', 'like', "%{$this->filters['search']}%")
                  ->orWhere('email', 'like', "%{$this->filters['search']}%");
            });
        }

        return $query->select(['id', 'name', 'email', 'role', 'created_at']);
    }

    public function headings(): array
    {
        return ['ID', 'Name', 'Email', 'Role', 'Created At'];
    }
}
```
</details>

### Задание 3: Создай API Controller с Service Layer

Реализуй OrderController, который использует OrderService для бизнес-логики и возвращает API Resources.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/Api/OrderController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\{CreateOrderRequest, UpdateOrderRequest};
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService
    ) {
        $this->middleware('auth:sanctum');
    }

    public function index(Request $request)
    {
        $orders = $request->user()
            ->orders()
            ->with(['items.product'])
            ->latest()
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    public function store(CreateOrderRequest $request)
    {
        $order = $this->orderService->createOrder(
            $request->user(),
            $request->validated()
        );

        return new OrderResource($order->load('items.product'));
    }

    public function show(Order $order)
    {
        $this->authorize('view', $order);

        return new OrderResource($order->load('items.product'));
    }

    public function update(UpdateOrderRequest $request, Order $order)
    {
        $this->authorize('update', $order);

        $order = $this->orderService->updateOrder($order, $request->validated());

        return new OrderResource($order);
    }

    public function destroy(Order $order)
    {
        $this->authorize('delete', $order);

        $this->orderService->cancelOrder($order);

        return response()->noContent();
    }
}

// app/Services/OrderService.php
namespace App\Services;

use App\Models\{User, Order};
use Illuminate\Support\Facades\DB;

class OrderService
{
    public function createOrder(User $user, array $data): Order
    {
        return DB::transaction(function () use ($user, $data) {
            $order = $user->orders()->create([
                'status' => 'pending',
                'total' => 0,
            ]);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'price' => $product->price,
                ]);

                $total += $product->price * $item['quantity'];
            }

            $order->update(['total' => $total]);

            // Отправить уведомление
            $user->notify(new OrderCreated($order));

            return $order;
        });
    }

    public function cancelOrder(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order->update(['status' => 'cancelled']);

            // Вернуть товары на склад
            foreach ($order->items as $item) {
                $item->product->increment('stock', $item->quantity);
            }
        });
    }
}

// app/Http/Requests/CreateOrderRequest.php
class CreateOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
        ];
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
