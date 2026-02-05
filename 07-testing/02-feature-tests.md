# 7.2 Feature тесты

## Краткое резюме

> **Feature тесты** — тестирование полных сценариев через HTTP. Проверяют реальный user flow от запроса до ответа с БД.
>
> **Создание:** `php artisan make:test UserControllerTest`. RefreshDatabase откатывает транзакции после теста.
>
> **Важно:** `actingAs($user)` для авторизации. Assertions: `assertStatus()`, `assertJson()`, `assertDatabaseHas()`. Fakes: `Storage::fake()`, `Queue::fake()`, `Mail::fake()`.

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
Feature тесты — тестирование функциональности приложения целиком (HTTP запросы, БД, аутентификация). Тестируют реальные сценарии пользователя.

**Основное:**
- Тестируют HTTP endpoints
- Используют БД (transactions)
- Проверяют весь flow

---

## Как работает

**Создание теста:**

```bash
# Feature тест (с БД)
php artisan make:test UserControllerTest

# Создаётся в tests/Feature/
```

**Базовый Feature тест:**

```php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class UserControllerTest extends TestCase
{
    use RefreshDatabase;  // Откатывает транзакции после теста

    public function test_user_can_view_profile(): void
    {
        // Arrange: создать пользователя
        $user = User::factory()->create();

        // Act: отправить GET запрос
        $response = $this->actingAs($user)->get('/profile');

        // Assert: проверить ответ
        $response->assertStatus(200);
        $response->assertSee($user->name);
    }

    public function test_guest_cannot_view_profile(): void
    {
        $response = $this->get('/profile');

        $response->assertStatus(302);  // Redirect
        $response->assertRedirect('/login');
    }
}
```

**HTTP Assertions:**

```php
// Статус код
$response->assertStatus(200);
$response->assertOk();  // 200
$response->assertCreated();  // 201
$response->assertNoContent();  // 204
$response->assertNotFound();  // 404
$response->assertForbidden();  // 403
$response->assertUnauthorized();  // 401

// Redirect
$response->assertRedirect('/login');
$response->assertRedirectToRoute('login');

// View
$response->assertViewIs('users.index');
$response->assertViewHas('users');

// JSON
$response->assertJson(['success' => true]);
$response->assertJsonStructure(['data' => ['id', 'name']]);
$response->assertJsonPath('data.name', 'John');

// Заголовки
$response->assertHeader('Content-Type', 'application/json');

// Cookies
$response->assertCookie('name', 'value');

// Session
$response->assertSessionHas('status', 'success');
$response->assertSessionHasErrors(['email']);
```

**Database Assertions:**

```php
// Проверить запись в БД
$this->assertDatabaseHas('users', [
    'email' => 'test@example.com',
]);

$this->assertDatabaseMissing('users', [
    'email' => 'deleted@example.com',
]);

// Количество записей
$this->assertDatabaseCount('users', 10);

// Soft deletes
$this->assertSoftDeleted('users', ['id' => 1]);
```

---

## Когда использовать

**Feature тесты для:**
- API endpoints
- CRUD операции
- Аутентификация/авторизация
- Form validation
- Полные user flows

**Unit тесты для:**
- Бизнес-логика (Services)
- Вычисления
- Изолированные компоненты

---

## Пример из практики

**CRUD тестирование:**

```php
class PostControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_posts_list(): void
    {
        Post::factory()->count(5)->create();

        $response = $this->get('/posts');

        $response->assertStatus(200);
        $response->assertViewIs('posts.index');
        $response->assertViewHas('posts');
    }

    public function test_user_can_create_post(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/posts', [
            'title' => 'Test Post',
            'body' => 'Test content',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/posts');

        $this->assertDatabaseHas('posts', [
            'title' => 'Test Post',
            'user_id' => $user->id,
        ]);
    }

    public function test_guest_cannot_create_post(): void
    {
        $response = $this->post('/posts', [
            'title' => 'Test Post',
            'body' => 'Test content',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/login');

        $this->assertDatabaseCount('posts', 0);
    }

    public function test_validates_required_fields(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/posts', [
            'title' => '',  // Empty
        ]);

        $response->assertSessionHasErrors(['title', 'body']);
    }

    public function test_user_can_update_own_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)->put("/posts/{$post->id}", [
            'title' => 'Updated Title',
            'body' => 'Updated content',
        ]);

        $response->assertStatus(302);

        $this->assertDatabaseHas('posts', [
            'id' => $post->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_user_cannot_update_others_post(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->actingAs($user)->put("/posts/{$post->id}", [
            'title' => 'Hacked',
        ]);

        $response->assertStatus(403);  // Forbidden
    }

    public function test_user_can_delete_own_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)->delete("/posts/{$post->id}");

        $response->assertStatus(302);

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }
}
```

**API тестирование:**

```php
class ApiPostControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_paginated_posts(): void
    {
        Post::factory()->count(25)->create();

        $response = $this->getJson('/api/posts');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'title', 'body', 'created_at'],
            ],
            'meta' => ['current_page', 'total'],
        ]);
        $response->assertJsonCount(20, 'data');  // Default pagination
    }

    public function test_creates_post_with_valid_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/posts', [
                'title' => 'API Post',
                'body' => 'Created via API',
            ]);

        $response->assertStatus(201);
        $response->assertJson([
            'data' => [
                'title' => 'API Post',
            ],
        ]);

        $this->assertDatabaseHas('posts', [
            'title' => 'API Post',
            'user_id' => $user->id,
        ]);
    }

    public function test_returns_422_for_invalid_data(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/posts', [
            'title' => '',  // Invalid
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['title', 'body']);
    }

    public function test_filters_posts_by_status(): void
    {
        Post::factory()->count(5)->create(['published' => true]);
        Post::factory()->count(3)->create(['published' => false]);

        $response = $this->getJson('/api/posts?status=published');

        $response->assertStatus(200);
        $response->assertJsonCount(5, 'data');
    }
}
```

**Authentication тестирование:**

```php
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
    }

    public function test_user_cannot_login_with_invalid_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(302);
        $response->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $response->assertStatus(302);
        $response->assertRedirect('/');
        $this->assertGuest();
    }
}
```

**File Upload тестирование:**

```php
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class FileUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_upload_avatar(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $file = UploadedFile::fake()->image('avatar.jpg');

        $response = $this->actingAs($user)->post('/avatar', [
            'avatar' => $file,
        ]);

        $response->assertStatus(302);

        // Проверить, что файл сохранён
        Storage::disk('public')->assertExists('avatars/' . $file->hashName());

        // Проверить запись в БД
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'avatar_path' => 'avatars/' . $file->hashName(),
        ]);
    }

    public function test_validates_file_type(): void
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('document.pdf');

        $response = $this->actingAs($user)->post('/avatar', [
            'avatar' => $file,
        ]);

        $response->assertSessionHasErrors('avatar');
    }
}
```

**Queue/Job тестирование:**

```php
use Illuminate\Support\Facades\Queue;

class OrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_creation_dispatches_job(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        $this->actingAs($user)->post('/orders', [
            'product_id' => 1,
            'quantity' => 2,
        ]);

        Queue::assertPushed(ProcessOrder::class, function ($job) use ($user) {
            return $job->order->user_id === $user->id;
        });
    }
}
```

**Notification тестирование:**

```php
use Illuminate\Support\Facades\Notification;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_receives_welcome_notification(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        event(new UserRegistered($user));

        Notification::assertSentTo($user, WelcomeNotification::class);
    }
}
```

---

## На собеседовании скажешь

> "Feature тесты проверяют полные сценарии через HTTP. RefreshDatabase откатывает транзакции после теста. actingAs($user) для авторизованных запросов. Assertions: assertStatus, assertJson, assertDatabaseHas. Тестирую CRUD, authentication, validation, file upload. Storage::fake() для файлов, Queue::fake() для jobs, Notification::fake() для уведомлений. Factory для создания тестовых данных. API тесты через getJson/postJson."

---

## Практические задания

### Задание 1: CRUD тесты для Article

Напиши полный набор Feature тестов для ArticleController: index, create, update, delete. Проверь авторизацию и валидацию.

<details>
<summary>Решение</summary>

```php
// tests/Feature/ArticleControllerTest.php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\{User, Article};
use Illuminate\Foundation\Testing\RefreshDatabase;

class ArticleControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_articles_list(): void
    {
        Article::factory()->count(5)->create(['published' => true]);

        $response = $this->get('/articles');

        $response->assertStatus(200);
        $response->assertViewIs('articles.index');
        $response->assertViewHas('articles');
    }

    public function test_user_can_create_article(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/articles', [
            'title' => 'Test Article',
            'content' => 'This is test content',
            'published' => true,
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/articles');

        $this->assertDatabaseHas('articles', [
            'title' => 'Test Article',
            'user_id' => $user->id,
        ]);
    }

    public function test_guest_cannot_create_article(): void
    {
        $response = $this->post('/articles', [
            'title' => 'Test Article',
            'content' => 'Content',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/login');
        $this->assertDatabaseCount('articles', 0);
    }

    public function test_validates_required_fields(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/articles', [
            'title' => '',  // Empty
            'content' => '',
        ]);

        $response->assertSessionHasErrors(['title', 'content']);
    }

    public function test_user_can_update_own_article(): void
    {
        $user = User::factory()->create();
        $article = Article::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)->put("/articles/{$article->id}", [
            'title' => 'Updated Title',
            'content' => 'Updated content',
            'published' => true,
        ]);

        $response->assertStatus(302);

        $this->assertDatabaseHas('articles', [
            'id' => $article->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_user_cannot_update_others_article(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $article = Article::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->actingAs($user)->put("/articles/{$article->id}", [
            'title' => 'Hacked Title',
        ]);

        $response->assertStatus(403);

        $this->assertDatabaseMissing('articles', [
            'id' => $article->id,
            'title' => 'Hacked Title',
        ]);
    }

    public function test_user_can_delete_own_article(): void
    {
        $user = User::factory()->create();
        $article = Article::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)->delete("/articles/{$article->id}");

        $response->assertStatus(302);
        $this->assertDatabaseMissing('articles', ['id' => $article->id]);
    }
}
```
</details>

### Задание 2: API тесты с Pagination и Filtering

Создай API endpoint `/api/products` с пагинацией и фильтрацией по категории. Напиши тесты для всех сценариев.

<details>
<summary>Решение</summary>

```php
// tests/Feature/Api/ProductControllerTest.php
namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\{Product, Category, User};
use Illuminate\Foundation\Testing\RefreshDatabase;

class ProductControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_paginated_products(): void
    {
        Product::factory()->count(30)->create();

        $response = $this->getJson('/api/products');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'price', 'created_at'],
            ],
            'meta' => [
                'current_page',
                'total',
                'per_page',
            ],
            'links',
        ]);

        $response->assertJsonCount(15, 'data');  // Default 15 per page
    }

    public function test_filters_products_by_category(): void
    {
        $category1 = Category::factory()->create(['name' => 'Electronics']);
        $category2 = Category::factory()->create(['name' => 'Books']);

        Product::factory()->count(5)->create(['category_id' => $category1->id]);
        Product::factory()->count(3)->create(['category_id' => $category2->id]);

        $response = $this->getJson("/api/products?category={$category1->id}");

        $response->assertStatus(200);
        $response->assertJsonCount(5, 'data');
    }

    public function test_filters_products_by_price_range(): void
    {
        Product::factory()->create(['price' => 50]);
        Product::factory()->create(['price' => 150]);
        Product::factory()->create(['price' => 250]);

        $response = $this->getJson('/api/products?min_price=100&max_price=200');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.price', 150);
    }

    public function test_creates_product_with_valid_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/products', [
                'name' => 'New Product',
                'price' => 99.99,
                'description' => 'Test description',
            ]);

        $response->assertStatus(201);
        $response->assertJson([
            'data' => [
                'name' => 'New Product',
                'price' => 99.99,
            ],
        ]);

        $this->assertDatabaseHas('products', [
            'name' => 'New Product',
        ]);
    }

    public function test_returns_401_without_token(): void
    {
        $response = $this->postJson('/api/products', [
            'name' => 'Product',
            'price' => 50,
        ]);

        $response->assertStatus(401);
    }

    public function test_validates_product_data(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/products', [
            'name' => '',  // Required
            'price' => 'invalid',  // Should be numeric
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'price']);
    }

    public function test_shows_single_product(): void
    {
        $product = Product::factory()->create([
            'name' => 'Test Product',
            'price' => 123.45,
        ]);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'id' => $product->id,
                'name' => 'Test Product',
                'price' => 123.45,
            ],
        ]);
    }

    public function test_returns_404_for_nonexistent_product(): void
    {
        $response = $this->getJson('/api/products/99999');

        $response->assertStatus(404);
    }
}
```
</details>

### Задание 3: File Upload с фейковым Storage

Напиши тест для загрузки аватара пользователя. Проверь валидацию типов файлов и размера.

<details>
<summary>Решение</summary>

```php
// tests/Feature/AvatarUploadTest.php
namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AvatarUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_user_can_upload_avatar(): void
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->image('avatar.jpg', 500, 500);

        $response = $this->actingAs($user)->post('/profile/avatar', [
            'avatar' => $file,
        ]);

        $response->assertStatus(302);
        $response->assertSessionHas('success');

        // Проверить, что файл сохранён
        $avatarPath = 'avatars/' . $file->hashName();
        Storage::disk('public')->assertExists($avatarPath);

        // Проверить запись в БД
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'avatar_path' => $avatarPath,
        ]);
    }

    public function test_validates_file_is_image(): void
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('document.pdf', 100);

        $response = $this->actingAs($user)->post('/profile/avatar', [
            'avatar' => $file,
        ]);

        $response->assertSessionHasErrors('avatar');
        Storage::disk('public')->assertMissing('avatars/' . $file->hashName());
    }

    public function test_validates_file_size(): void
    {
        $user = User::factory()->create();
        // 5MB (максимум 2MB)
        $file = UploadedFile::fake()->image('large.jpg')->size(5000);

        $response = $this->actingAs($user)->post('/profile/avatar', [
            'avatar' => $file,
        ]);

        $response->assertSessionHasErrors('avatar');
    }

    public function test_validates_image_dimensions(): void
    {
        $user = User::factory()->create();
        // Слишком маленькое изображение
        $file = UploadedFile::fake()->image('tiny.jpg', 50, 50);

        $response = $this->actingAs($user)->post('/profile/avatar', [
            'avatar' => $file,
        ]);

        $response->assertSessionHasErrors('avatar');
    }

    public function test_deletes_old_avatar_when_uploading_new(): void
    {
        $user = User::factory()->create();

        // Загрузить первый аватар
        $oldFile = UploadedFile::fake()->image('old.jpg');
        $this->actingAs($user)->post('/profile/avatar', ['avatar' => $oldFile]);
        $oldPath = 'avatars/' . $oldFile->hashName();

        // Загрузить новый аватар
        $newFile = UploadedFile::fake()->image('new.jpg');
        $this->actingAs($user)->post('/profile/avatar', ['avatar' => $newFile]);
        $newPath = 'avatars/' . $newFile->hashName();

        // Старый файл удалён
        Storage::disk('public')->assertMissing($oldPath);
        // Новый файл существует
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_guest_cannot_upload_avatar(): void
    {
        $file = UploadedFile::fake()->image('avatar.jpg');

        $response = $this->post('/profile/avatar', ['avatar' => $file]);

        $response->assertStatus(302);
        $response->assertRedirect('/login');
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
