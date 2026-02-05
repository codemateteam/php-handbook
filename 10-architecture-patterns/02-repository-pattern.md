# 10.2 Repository Pattern

## Краткое резюме

> **Repository Pattern** — слой абстракции между бизнес-логикой и доступом к данным.
>
> **Зачем:** Изоляция от ORM, переиспользование запросов, тестируемость через mock.
>
> **Важно:** Interface определяет контракт, Implementation содержит запросы. Регистрация через Service Provider.

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
Repository — слой абстракции между бизнес-логикой и доступом к данным. Инкапсулирует запросы к БД.

**Зачем:**
- Изоляция от ORM
- Переиспользование запросов
- Тестируемость (mock repository)

---

## Как работает

**Interface:**

```php
// app/Contracts/PostRepositoryInterface.php
interface PostRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Post;
    public function create(array $data): Post;
    public function update(Post $post, array $data): Post;
    public function delete(Post $post): bool;
}
```

**Implementation:**

```php
// app/Repositories/PostRepository.php
class PostRepository implements PostRepositoryInterface
{
    public function all(): Collection
    {
        return Post::with('user')->latest()->get();
    }

    public function find(int $id): ?Post
    {
        return Post::with('user', 'comments')->find($id);
    }

    public function create(array $data): Post
    {
        return Post::create($data);
    }

    public function update(Post $post, array $data): Post
    {
        $post->update($data);
        return $post;
    }

    public function delete(Post $post): bool
    {
        return $post->delete();
    }

    // Кастомные методы
    public function findPublished(): Collection
    {
        return Post::where('published', true)->get();
    }

    public function findByUser(User $user): Collection
    {
        return Post::where('user_id', $user->id)->get();
    }
}
```

**Service Provider (регистрация):**

```php
// app/Providers/RepositoryServiceProvider.php
class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            PostRepositoryInterface::class,
            PostRepository::class
        );
    }
}
```

**Использование в Service:**

```php
class PostService
{
    public function __construct(
        private PostRepositoryInterface $postRepository
    ) {}

    public function getAll(): Collection
    {
        return $this->postRepository->all();
    }

    public function create(User $user, array $data): Post
    {
        return $this->postRepository->create([
            'user_id' => $user->id,
            ...$data,
        ]);
    }
}
```

---

## Когда использовать

**Плюсы:**
- ✅ Переиспользование запросов
- ✅ Тестируемость
- ✅ Изоляция от ORM

**Минусы:**
- ❌ Больше кода (boilerplate)
- ❌ Может быть избыточным для простых CRUD

**Используй когда:**
- Сложные запросы
- Нужна смена ORM
- Много переиспользуемых запросов

---

## Пример из практики

**Repository с фильтрацией:**

```php
class PostRepository implements PostRepositoryInterface
{
    public function filter(array $filters): Collection
    {
        $query = Post::query();

        if (isset($filters['category'])) {
            $query->where('category_id', $filters['category']);
        }

        if (isset($filters['search'])) {
            $query->where('title', 'like', "%{$filters['search']}%");
        }

        if (isset($filters['published'])) {
            $query->where('published', $filters['published']);
        }

        return $query->with('user')->paginate(20);
    }
}
```

**Mock для тестов:**

```php
// tests/Unit/PostServiceTest.php
class PostServiceTest extends TestCase
{
    public function test_creates_post(): void
    {
        $repository = Mockery::mock(PostRepositoryInterface::class);
        $repository->shouldReceive('create')
            ->once()
            ->with(Mockery::type('array'))
            ->andReturn(new Post(['id' => 1, 'title' => 'Test']));

        $service = new PostService($repository);
        $post = $service->create($user, ['title' => 'Test']);

        $this->assertEquals('Test', $post->title);
    }
}
```

---

## На собеседовании скажешь

> "Repository инкапсулирует доступ к данным. Interface определяет контракт, Implementation содержит запросы. Bind в Service Provider. Плюсы: переиспользование, тестируемость, изоляция от ORM. Используется в Service Layer. Mock repository в тестах. Может быть избыточным для простых CRUD. Подходит для сложных запросов и смены источника данных."

---

## Практические задания

### Задание 1: Создай Repository с фильтрацией

Реализуй `UserRepository` с методом `filter()` который принимает массив фильтров: `role`, `status`, `search` (по имени/email).

<details>
<summary>Решение</summary>

```php
// app/Contracts/UserRepositoryInterface.php
namespace App\Contracts;

use App\Models\User;
use Illuminate\Support\Collection;

interface UserRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?User;
    public function filter(array $filters): Collection;
    public function create(array $data): User;
}

// app/Repositories/UserRepository.php
namespace App\Repositories;

use App\Contracts\UserRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Collection;

class UserRepository implements UserRepositoryInterface
{
    public function all(): Collection
    {
        return User::all();
    }

    public function find(int $id): ?User
    {
        return User::find($id);
    }

    public function filter(array $filters): Collection
    {
        $query = User::query();

        if (isset($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return $query->get();
    }

    public function create(array $data): User
    {
        return User::create($data);
    }
}

// app/Providers/RepositoryServiceProvider.php
namespace App\Providers;

use App\Contracts\UserRepositoryInterface;
use App\Repositories\UserRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            UserRepositoryInterface::class,
            UserRepository::class
        );
    }
}

// Использование
class UserService
{
    public function __construct(
        private UserRepositoryInterface $userRepository
    ) {}

    public function getFilteredUsers(array $filters): Collection
    {
        return $this->userRepository->filter($filters);
    }
}
```
</details>

### Задание 2: Напиши тест с Mock Repository

Протестируй `OrderService::create()` используя mock `OrderRepository`.

<details>
<summary>Решение</summary>

```php
// tests/Unit/OrderServiceTest.php
namespace Tests\Unit;

use App\Contracts\OrderRepositoryInterface;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Mockery;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_creates_order_successfully(): void
    {
        // Arrange
        $user = User::factory()->make(['id' => 1]);
        $orderData = [
            'total' => 100.50,
            'items' => [
                ['product_id' => 1, 'quantity' => 2],
            ],
        ];

        $expectedOrder = new Order([
            'id' => 1,
            'user_id' => $user->id,
            'total' => 100.50,
        ]);

        // Mock repository
        $repository = Mockery::mock(OrderRepositoryInterface::class);
        $repository->shouldReceive('create')
            ->once()
            ->with([
                'user_id' => $user->id,
                'total' => 100.50,
            ])
            ->andReturn($expectedOrder);

        // Act
        $service = new OrderService($repository);
        $order = $service->create($user, $orderData);

        // Assert
        $this->assertEquals(1, $order->id);
        $this->assertEquals(100.50, $order->total);
        $this->assertEquals($user->id, $order->user_id);
    }

    public function test_handles_creation_failure(): void
    {
        $user = User::factory()->make(['id' => 1]);
        $orderData = ['total' => 100];

        $repository = Mockery::mock(OrderRepositoryInterface::class);
        $repository->shouldReceive('create')
            ->once()
            ->andThrow(new \Exception('Database error'));

        $service = new OrderService($repository);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Database error');

        $service->create($user, $orderData);
    }
}
```
</details>

### Задание 3: Реализуй смену источника данных

У тебя есть `ProductRepository` работающий с БД. Реализуй `ApiProductRepository` который берёт данные из внешнего API.

<details>
<summary>Решение</summary>

```php
// app/Contracts/ProductRepositoryInterface.php
interface ProductRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Product;
}

// app/Repositories/EloquentProductRepository.php
class EloquentProductRepository implements ProductRepositoryInterface
{
    public function all(): Collection
    {
        return Product::all();
    }

    public function find(int $id): ?Product
    {
        return Product::find($id);
    }
}

// app/Repositories/ApiProductRepository.php
use Illuminate\Support\Facades\Http;

class ApiProductRepository implements ProductRepositoryInterface
{
    public function __construct(
        private string $apiUrl
    ) {}

    public function all(): Collection
    {
        $response = Http::get("{$this->apiUrl}/products");

        return collect($response->json('data'))->map(
            fn($item) => new Product($item)
        );
    }

    public function find(int $id): ?Product
    {
        $response = Http::get("{$this->apiUrl}/products/{$id}");

        if ($response->failed()) {
            return null;
        }

        return new Product($response->json('data'));
    }
}

// app/Providers/RepositoryServiceProvider.php
class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Выбор реализации по конфигу
        $this->app->bind(
            ProductRepositoryInterface::class,
            function ($app) {
                return match (config('products.source')) {
                    'api' => new ApiProductRepository(
                        config('products.api_url')
                    ),
                    'database' => new EloquentProductRepository(),
                    default => new EloquentProductRepository(),
                };
            }
        );
    }
}

// config/products.php
return [
    'source' => env('PRODUCTS_SOURCE', 'database'), // 'database' или 'api'
    'api_url' => env('PRODUCTS_API_URL', 'https://api.example.com'),
];

// Использование (код не меняется!)
class ProductService
{
    public function __construct(
        private ProductRepositoryInterface $productRepository
    ) {}

    public function getAllProducts(): Collection
    {
        return $this->productRepository->all();
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
