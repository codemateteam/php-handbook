# 4.8 Request / Response

## Краткое резюме

> **Request** — объект HTTP запроса с данными формы, файлами, заголовками, cookies.
>
> **Response** — объект ответа, возвращает view, json, redirect, download, stream.
>
> **Важно:** Валидация через $request->validate(), работа с файлами через file(), макросы для расширения, JSON для API.

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
Request — объект HTTP запроса (данные, заголовки, файлы). Response — объект ответа (контент, статус, заголовки).

**Основное:**
- `Request` — входные данные ($request->input(), $request->file())
- `Response` — возврат данных (view, json, download)

---

## Как работает

**Request (получение данных):**

```php
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function store(Request $request)
    {
        // Получить значение
        $name = $request->input('name');
        $email = $request->input('email', 'default@example.com');  // С дефолтом

        // Все данные
        $all = $request->all();
        $only = $request->only(['name', 'email']);
        $except = $request->except(['password']);

        // Query параметры (?page=1)
        $page = $request->query('page', 1);

        // Route параметры (/users/{id})
        $id = $request->route('id');

        // Headers
        $token = $request->header('Authorization');
        $userAgent = $request->userAgent();

        // Метод запроса
        $method = $request->method();  // GET, POST, etc.
        $isPost = $request->isMethod('post');

        // URL
        $url = $request->url();        // http://example.com/users
        $fullUrl = $request->fullUrl();  // http://example.com/users?page=1
        $path = $request->path();      // users

        // IP адрес
        $ip = $request->ip();

        // JSON запрос
        if ($request->isJson()) {
            $data = $request->json()->all();
        }

        // Проверка наличия
        if ($request->has('name')) {
            // name присутствует
        }

        if ($request->filled('name')) {
            // name присутствует и не пустое
        }
    }
}
```

**Файлы в Request:**

```php
public function upload(Request $request)
{
    // Получить файл
    $file = $request->file('photo');

    // Проверка загрузки
    if ($request->hasFile('photo')) {
        // Информация о файле
        $extension = $file->extension();
        $size = $file->getSize();
        $originalName = $file->getClientOriginalName();

        // Сохранить файл
        $path = $file->store('photos');  // storage/app/photos/
        $path = $file->storeAs('photos', 'custom-name.jpg');

        // Публичное хранилище
        $path = $file->storePublicly('avatars', 's3');
    }
}
```

**Response (возврат данных):**

```php
use Illuminate\Http\Response;

class UserController extends Controller
{
    // View (HTML)
    public function index()
    {
        return view('users.index', ['users' => User::all()]);
    }

    // JSON
    public function apiIndex()
    {
        return response()->json([
            'data' => User::all(),
            'message' => 'Success'
        ]);
    }

    // Кастомный статус
    public function show(User $user)
    {
        if (!$user->isActive()) {
            return response()->json(['error' => 'User inactive'], 403);
        }

        return response()->json($user);
    }

    // Redirect
    public function store(Request $request)
    {
        $user = User::create($request->validated());

        return redirect()->route('users.show', $user);
    }

    // Download файла
    public function download()
    {
        return response()->download(storage_path('app/file.pdf'));
    }

    // Stream файла
    public function stream()
    {
        return response()->file(storage_path('app/video.mp4'));
    }

    // No content (204)
    public function destroy(User $user)
    {
        $user->delete();

        return response()->noContent();
    }
}
```

**Headers в Response:**

```php
return response()->json($data)
    ->header('X-Custom-Header', 'Value')
    ->header('Content-Type', 'application/json')
    ->withHeaders([
        'X-Header-One' => 'Value 1',
        'X-Header-Two' => 'Value 2',
    ]);
```

**Cookies в Response:**

```php
return response('Content')
    ->cookie('name', 'value', $minutes, $path, $domain, $secure, $httpOnly);

// Или
return response('Content')->withCookie(cookie('name', 'value', 60));
```

---

## Когда использовать

**Request:**
- `$request->input()` — форма данные
- `$request->query()` — query параметры
- `$request->file()` — загрузка файлов
- `$request->header()` — заголовки

**Response:**
- `response()->json()` — API ответы
- `view()` — HTML страницы
- `redirect()` — перенаправления
- `response()->download()` — скачивание файлов

---

## Пример из практики

**API Controller с JSON Response:**

```php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query();

        // Фильтрация
        if ($request->filled('category')) {
            $query->where('category_id', $request->input('category'));
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->input('search')}%");
        }

        // Сортировка
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Пагинация
        $perPage = $request->input('per_page', 20);
        $products = $query->paginate($perPage);

        return ProductResource::collection($products);
    }

    public function store(CreateProductRequest $request)
    {
        $product = Product::create($request->validated());

        // Загрузка изображения
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('products', 'public');
            $product->update(['image_path' => $path]);
        }

        return new ProductResource($product);
    }

    public function show(Product $product)
    {
        // Вернуть с relationships
        return new ProductResource($product->load(['category', 'reviews']));
    }

    public function update(CreateProductRequest $request, Product $product)
    {
        $product->update($request->validated());

        return new ProductResource($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->noContent();
    }
}
```

**Загрузка файлов:**

```php
class AvatarController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|max:2048',  // 2MB max
        ]);

        $user = $request->user();

        // Удалить старый аватар
        if ($user->avatar_path) {
            Storage::delete($user->avatar_path);
        }

        // Сохранить новый
        $path = $request->file('avatar')->store('avatars', 'public');

        $user->update(['avatar_path' => $path]);

        return response()->json([
            'message' => 'Avatar uploaded',
            'url' => Storage::url($path),
        ]);
    }
}
```

**Stream больших файлов:**

```php
class ExportController extends Controller
{
    public function exportUsers(Request $request)
    {
        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');

            // CSV заголовки
            fputcsv($handle, ['ID', 'Name', 'Email', 'Created At']);

            // Загрузка по одному (экономия памяти)
            User::cursor()->each(function ($user) use ($handle) {
                fputcsv($handle, [
                    $user->id,
                    $user->name,
                    $user->email,
                    $user->created_at,
                ]);
            });

            fclose($handle);
        }, 'users.csv');
    }
}
```

**Кастомные Response классы:**

```php
// app/Http/Responses/ApiResponse.php
class ApiResponse
{
    public static function success($data, string $message = 'Success', int $status = 200)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    public static function error(string $message, int $status = 400, array $errors = [])
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status);
    }
}

// Использование
class ProductController extends Controller
{
    public function store(Request $request)
    {
        $product = Product::create($request->validated());

        return ApiResponse::success($product, 'Product created', 201);
    }

    public function destroy(Product $product)
    {
        if ($product->orders()->exists()) {
            return ApiResponse::error('Cannot delete product with orders', 422);
        }

        $product->delete();

        return ApiResponse::success(null, 'Product deleted');
    }
}
```

**Request Macro (расширение):**

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Http\Request;

public function boot(): void
{
    // Кастомный метод для Request
    Request::macro('isMobile', function () {
        return str_contains($this->userAgent(), 'Mobile');
    });

    Request::macro('ipInfo', function () {
        return [
            'ip' => $this->ip(),
            'user_agent' => $this->userAgent(),
            'is_mobile' => $this->isMobile(),
        ];
    });
}

// Использование
if ($request->isMobile()) {
    return view('mobile.index');
}

Log::info('User info', $request->ipInfo());
```

**Response Macro:**

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Support\Facades\Response;

public function boot(): void
{
    Response::macro('success', function ($data, $message = 'Success') {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ]);
    });

    Response::macro('error', function ($message, $status = 400) {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $status);
    });
}

// Использование
return response()->success($user, 'User created');
return response()->error('Invalid credentials', 401);
```

**Валидация и ошибки в Request:**

```php
class UserController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8|confirmed',
        ]);

        // Если валидация провалилась:
        // - Веб: redirect назад с ошибками
        // - API: JSON с ошибками (422)
    }
}

// Кастомная обработка ошибок валидации
public function store(Request $request)
{
    $validator = Validator::make($request->all(), [
        'email' => 'required|email',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'errors' => $validator->errors()
        ], 422);
    }

    // Продолжить...
}
```

---

## На собеседовании скажешь

> "Request содержит данные запроса: input() для формы, query() для query параметров, file() для файлов, header() для заголовков. Response возвращает данные: json() для API, view() для HTML, redirect() для перенаправлений, download() для файлов. response()->streamDownload() для больших файлов (экономия памяти). Request/Response макросы для расширения функциональности. Валидация через $request->validate() возвращает 422 для API, redirect для веба."

---

## Практические задания

### Задание 1: Реализуй загрузку аватара с валидацией и оптимизацией

Пользователь загружает аватар. Необходимо: валидация (image, max 2MB), изменение размера до 300x300, сохранение в public storage, удаление старого.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/AvatarController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;

class AvatarController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $user = $request->user();

        // Удалить старый аватар
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        // Получить файл
        $file = $request->file('avatar');

        // Оптимизировать изображение
        $image = Image::make($file)
            ->fit(300, 300)
            ->encode('jpg', 85);

        // Генерировать уникальное имя
        $filename = 'avatars/' . $user->id . '_' . time() . '.jpg';

        // Сохранить в public storage
        Storage::disk('public')->put($filename, $image->stream());

        // Обновить пользователя
        $user->update(['avatar_path' => $filename]);

        return response()->json([
            'message' => 'Avatar uploaded successfully',
            'url' => Storage::url($filename),
        ]);
    }

    public function delete(Request $request)
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->update(['avatar_path' => null]);
        }

        return response()->json([
            'message' => 'Avatar deleted successfully',
        ]);
    }
}

// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/avatar', [AvatarController::class, 'upload']);
    Route::delete('/avatar', [AvatarController::class, 'delete']);
});
```
</details>

### Задание 2: Создай API Response Helper с консистентной структурой

Реализуй helper для унифицированных API ответов: success, error, validation error.

<details>
<summary>Решение</summary>

```php
// app/Http/Responses/ApiResponse.php
namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function success(
        mixed $data = null,
        string $message = 'Success',
        int $status = 200
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    public static function error(
        string $message,
        int $status = 400,
        array $errors = []
    ): JsonResponse {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $status);
    }

    public static function validationError(
        array $errors,
        string $message = 'Validation failed'
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], 422);
    }

    public static function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return self::error($message, 404);
    }

    public static function unauthorized(string $message = 'Unauthorized'): JsonResponse
    {
        return self::error($message, 401);
    }

    public static function forbidden(string $message = 'Forbidden'): JsonResponse
    {
        return self::error($message, 403);
    }
}

// Использование в контроллере
namespace App\Http\Controllers\Api;

use App\Http\Responses\ApiResponse;
use App\Http\Requests\CreateProductRequest;
use App\Models\Product;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::paginate(20);

        return ApiResponse::success($products, 'Products retrieved successfully');
    }

    public function store(CreateProductRequest $request)
    {
        $product = Product::create($request->validated());

        return ApiResponse::success($product, 'Product created', 201);
    }

    public function show(Product $product)
    {
        return ApiResponse::success($product);
    }

    public function destroy(Product $product)
    {
        if ($product->orders()->exists()) {
            return ApiResponse::error(
                'Cannot delete product with existing orders',
                422
            );
        }

        $product->delete();

        return ApiResponse::success(null, 'Product deleted');
    }
}

// app/Exceptions/Handler.php - для обработки ошибок
public function render($request, Throwable $exception)
{
    if ($request->wantsJson()) {
        if ($exception instanceof ModelNotFoundException) {
            return ApiResponse::notFound();
        }

        if ($exception instanceof AuthenticationException) {
            return ApiResponse::unauthorized();
        }

        if ($exception instanceof AuthorizationException) {
            return ApiResponse::forbidden();
        }

        if ($exception instanceof ValidationException) {
            return ApiResponse::validationError($exception->errors());
        }
    }

    return parent::render($request, $exception);
}
```
</details>

### Задание 3: Реализуй Stream Export для больших данных

Создай endpoint для экспорта пользователей в CSV с использованием streaming (без загрузки всех данных в память).

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/ExportController.php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

class ExportController extends Controller
{
    public function exportUsers(Request $request)
    {
        $filters = $request->validate([
            'role' => 'nullable|string',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $filename = 'users_' . now()->format('Y-m-d_His') . '.csv';

        return Response::streamDownload(function () use ($filters) {
            $handle = fopen('php://output', 'w');

            // CSV заголовки
            fputcsv($handle, [
                'ID',
                'Name',
                'Email',
                'Role',
                'Created At',
                'Last Login',
            ]);

            // Построить query
            $query = User::query();

            if (!empty($filters['role'])) {
                $query->where('role', $filters['role']);
            }

            if (!empty($filters['from_date'])) {
                $query->whereDate('created_at', '>=', $filters['from_date']);
            }

            if (!empty($filters['to_date'])) {
                $query->whereDate('created_at', '<=', $filters['to_date']);
            }

            // Cursor для экономии памяти (по одной записи)
            $query->cursor()->each(function ($user) use ($handle) {
                fputcsv($handle, [
                    $user->id,
                    $user->name,
                    $user->email,
                    $user->role,
                    $user->created_at->format('Y-m-d H:i:s'),
                    $user->last_login_at?->format('Y-m-d H:i:s') ?? 'Never',
                ]);
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    public function exportJson(Request $request)
    {
        return Response::streamDownload(function () {
            echo "[\n";

            $first = true;

            User::cursor()->each(function ($user) use (&$first) {
                if (!$first) {
                    echo ",\n";
                }

                echo json_encode([
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ]);

                $first = false;
            });

            echo "\n]";
        }, 'users.json', [
            'Content-Type' => 'application/json',
        ]);
    }
}

// routes/api.php
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/export/users', [ExportController::class, 'exportUsers']);
    Route::get('/export/users/json', [ExportController::class, 'exportJson']);
});
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
