# 8.5 Авторизация (Gates, Policies)

## Краткое резюме

> **Авторизация** — проверка прав доступа (что можешь делать?).
>
> **Инструменты:** Gates для простых проверок (closure), Policies для группировки логики вокруг модели (класс).
>
> **Важно:** `authorize()` в контроллере выбрасывает 403 при отсутствии прав. `@can` в Blade для условного отображения. Spatie Permission для ролей и прав.

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
Авторизация — проверка прав доступа (что можешь делать?). Laravel предоставляет Gates и Policies.

**Разница:**
- **Gates** — простые проверки (closure)
- **Policies** — группировка логики для модели (класс)

---

## Как работает

**Gates (простые проверки):**

```php
// app/Providers/AuthServiceProvider.php
use Illuminate\Support\Facades\Gate;

public function boot(): void
{
    // Простой gate
    Gate::define('view-admin', function (User $user) {
        return $user->isAdmin();
    });

    // С моделью
    Gate::define('update-post', function (User $user, Post $post) {
        return $user->id === $post->user_id;
    });
}

// Использование в контроллере
if (Gate::allows('view-admin')) {
    // Пользователь админ
}

if (Gate::denies('update-post', $post)) {
    abort(403);
}

// Через middleware
Route::middleware('can:view-admin')->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
});

// Через authorize()
$this->authorize('update-post', $post);  // 403 если нет прав
```

**Policies (для моделей):**

```bash
php artisan make:policy PostPolicy --model=Post
```

```php
// app/Policies/PostPolicy.php
class PostPolicy
{
    public function viewAny(User $user): bool
    {
        return true;  // Все могут смотреть список
    }

    public function view(User $user, Post $post): bool
    {
        return $post->published || $user->id === $post->user_id;
    }

    public function create(User $user): bool
    {
        return $user->isVerified();
    }

    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->isAdmin();
    }
}

// Регистрация в AuthServiceProvider
protected $policies = [
    Post::class => PostPolicy::class,
];

// Использование
class PostController extends Controller
{
    public function update(Request $request, Post $post)
    {
        $this->authorize('update', $post);  // 403 если нет прав

        $post->update($request->validated());

        return redirect()->route('posts.show', $post);
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);

        $post->delete();

        return redirect()->route('posts.index');
    }
}
```

---

## Когда использовать

**Gates для:**
- Простые проверки (isAdmin)
- Не привязаны к модели
- Глобальные права

**Policies для:**
- Права на модели (CRUD)
- Группировка логики
- Автоматическое связывание

---

## Пример из практики

**Policy с разными ролями:**

```php
class PostPolicy
{
    // Выполняется перед всеми методами
    public function before(User $user): ?bool
    {
        if ($user->isAdmin()) {
            return true;  // Админ может всё
        }

        return null;  // Продолжить проверку
    }

    public function update(User $user, Post $post): bool
    {
        // Автор или модератор
        return $user->id === $post->user_id || $user->isModerator();
    }

    public function delete(User $user, Post $post): bool
    {
        // Только автор
        return $user->id === $post->user_id;
    }

    public function publish(User $user, Post $post): bool
    {
        // Автор или модератор
        return $user->id === $post->user_id || $user->isModerator();
    }
}
```

**Проверка в Blade:**

```blade
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Edit</a>
@endcan

@cannot('delete', $post)
    <p>You cannot delete this post</p>
@endcannot

{{-- Без модели --}}
@can('view-admin')
    <a href="/admin">Admin Panel</a>
@endcan
```

**API Resource с проверкой прав:**

```php
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,

            // Условные поля в зависимости от прав
            'can_edit' => $request->user()?->can('update', $this->resource),
            'can_delete' => $request->user()?->can('delete', $this->resource),
        ];
    }
}
```

**Authorization Middleware:**

```php
// В маршруте
Route::put('/posts/{post}', [PostController::class, 'update'])
    ->middleware('can:update,post');  // post = Route parameter

// Или в контроллере
public function __construct()
{
    $this->authorizeResource(Post::class, 'post');
}
// Автоматически проверяет права для всех CRUD методов
```

**Guest проверки:**

```php
class PostPolicy
{
    public function view(?User $user, Post $post): bool
    {
        // Гости могут видеть только опубликованные
        if (!$user) {
            return $post->published;
        }

        // Авторизованные могут видеть свои черновики
        return $post->published || $user->id === $post->user_id;
    }
}

// Использование
Gate::check('view', $post);  // Работает для гостей
```

**Response (вместо 403):**

```php
class PostPolicy
{
    use HandlesAuthorization;

    public function update(User $user, Post $post): Response
    {
        if ($user->id !== $post->user_id) {
            return Response::deny('You do not own this post.');
        }

        return Response::allow();
    }
}

// В контроллере
try {
    $this->authorize('update', $post);
} catch (AuthorizationException $e) {
    // $e->getMessage() = 'You do not own this post.'
}
```

**Abilities (Sanctum для API):**

```php
// Создать токен с abilities
$token = $user->createToken('token-name', ['post:create', 'post:update'])->plainTextToken;

// Проверить ability
if ($user->tokenCan('post:create')) {
    // Может создавать посты
}

// Middleware
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/posts', [PostController::class, 'store'])
        ->middleware('ability:post:create');

    Route::put('/posts/{post}', [PostController::class, 'update'])
        ->middleware('ability:post:update');
});
```

**Role-based авторизация:**

```php
// User model
class User extends Authenticatable
{
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where('name', $role)->exists();
    }

    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('name', $roles)->exists();
    }
}

// Gates
Gate::define('view-admin', fn(User $user) => $user->hasRole('admin'));
Gate::define('moderate-posts', fn(User $user) => $user->hasAnyRole(['admin', 'moderator']));

// Middleware
Route::middleware('can:view-admin')->group(function () {
    // Только для админов
});
```

**Spatie Permission (популярный пакет):**

```bash
composer require spatie/laravel-permission
```

```php
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

// Создать роли и права
$role = Role::create(['name' => 'admin']);
$permission = Permission::create(['name' => 'edit posts']);

$role->givePermissionTo($permission);
$user->assignRole('admin');

// Проверка
if ($user->can('edit posts')) {
    // Может редактировать
}

if ($user->hasRole('admin')) {
    // Админ
}

// Middleware
Route::middleware(['role:admin'])->group(function () {
    // ...
});

Route::middleware(['permission:edit posts'])->group(function () {
    // ...
});
```

---

## На собеседовании скажешь

> "Авторизация проверяет права доступа. Gates для простых проверок (Gate::define()), Policies для моделей (PostPolicy). authorize() в контроллере выбрасывает 403. @can в Blade. Middleware can:update,post. before() в Policy для админов (return true). Guest проверки через ?User. Spatie Permission для ролей и прав. Sanctum abilities для API токенов. authorizeResource() автоматически проверяет CRUD."

---

## Практические задания

### Задание 1: Создай Policy для комментариев

Реализуй `CommentPolicy` с правилами: автор может редактировать/удалять свои комментарии, модераторы могут удалять любые, админы могут всё.

<details>
<summary>Решение</summary>

```php
// 1. Создать Policy
php artisan make:policy CommentPolicy --model=Comment

// app/Policies/CommentPolicy.php
class CommentPolicy
{
    /**
     * Выполняется перед всеми методами
     * Админы могут всё
     */
    public function before(User $user): ?bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return null; // Продолжить проверку
    }

    public function viewAny(User $user): bool
    {
        return true; // Все могут видеть список
    }

    public function view(?User $user, Comment $comment): bool
    {
        return true; // Комментарии публичные
    }

    public function create(User $user): bool
    {
        return $user->email_verified_at !== null; // Только верифицированные
    }

    public function update(User $user, Comment $comment): bool
    {
        // Только автор может редактировать
        return $user->id === $comment->user_id;
    }

    public function delete(User $user, Comment $comment): bool
    {
        // Автор или модератор могут удалять
        return $user->id === $comment->user_id || $user->role === 'moderator';
    }
}

// 2. Регистрация в AuthServiceProvider
protected $policies = [
    Comment::class => CommentPolicy::class,
];

// 3. Использование в контроллере
class CommentController extends Controller
{
    public function update(Request $request, Comment $comment)
    {
        $this->authorize('update', $comment);

        $validated = $request->validate([
            'body' => 'required|string|max:1000',
        ]);

        $comment->update($validated);

        return redirect()->back()->with('success', 'Комментарий обновлён');
    }

    public function destroy(Comment $comment)
    {
        $this->authorize('delete', $comment);

        $comment->delete();

        return redirect()->back()->with('success', 'Комментарий удалён');
    }
}

// 4. В Blade
@can('update', $comment)
    <a href="{{ route('comments.edit', $comment) }}">Редактировать</a>
@endcan

@can('delete', $comment)
    <form method="POST" action="{{ route('comments.destroy', $comment) }}">
        @csrf
        @method('DELETE')
        <button type="submit">Удалить</button>
    </form>
@endcan

// 5. User Model (роли)
class User extends Authenticatable
{
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isModerator(): bool
    {
        return $this->role === 'moderator';
    }
}
```
</details>

### Задание 2: Реализуй role-based авторизацию

Создай систему ролей (admin, editor, viewer) с разными правами доступа к постам.

<details>
<summary>Решение</summary>

```php
// 1. Migration для ролей
Schema::create('roles', function (Blueprint $table) {
    $table->id();
    $table->string('name')->unique();
    $table->string('display_name');
    $table->timestamps();
});

Schema::create('role_user', function (Blueprint $table) {
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->foreignId('role_id')->constrained()->onDelete('cascade');
    $table->timestamps();

    $table->primary(['user_id', 'role_id']);
});

// 2. Models
class Role extends Model
{
    protected $fillable = ['name', 'display_name'];

    public function users()
    {
        return $this->belongsToMany(User::class);
    }
}

class User extends Authenticatable
{
    public function roles()
    {
        return $this->belongsToMany(Role::class)->withTimestamps();
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where('name', $role)->exists();
    }

    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('name', $roles)->exists();
    }

    public function assignRole(string $role): void
    {
        $roleModel = Role::where('name', $role)->firstOrFail();
        $this->roles()->syncWithoutDetaching([$roleModel->id]);
    }
}

// 3. Gates в AuthServiceProvider
public function boot(): void
{
    Gate::define('manage-posts', function (User $user) {
        return $user->hasAnyRole(['admin', 'editor']);
    });

    Gate::define('view-admin', function (User $user) {
        return $user->hasRole('admin');
    });

    Gate::define('edit-posts', function (User $user) {
        return $user->hasAnyRole(['admin', 'editor']);
    });

    Gate::define('delete-posts', function (User $user) {
        return $user->hasRole('admin');
    });
}

// 4. PostPolicy с ролями
class PostPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // Все могут видеть
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['admin', 'editor']);
    }

    public function update(User $user, Post $post): bool
    {
        // Автор или редактор
        return $user->id === $post->user_id || $user->hasRole('editor');
    }

    public function delete(User $user, Post $post): bool
    {
        // Только админ
        return $user->hasRole('admin');
    }
}

// 5. Middleware для ролей
class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        if (!$request->user() || !$request->user()->hasAnyRole($roles)) {
            abort(403, 'Нет доступа');
        }

        return $next($request);
    }
}

// Регистрация в Kernel.php
protected $middlewareAliases = [
    'role' => \App\Http\Middleware\CheckRole::class,
];

// 6. Использование в маршрутах
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
});

Route::middleware(['auth', 'role:admin,editor'])->group(function () {
    Route::resource('posts', PostController::class);
});

// 7. Seeder для ролей
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        Role::create(['name' => 'admin', 'display_name' => 'Administrator']);
        Role::create(['name' => 'editor', 'display_name' => 'Editor']);
        Role::create(['name' => 'viewer', 'display_name' => 'Viewer']);

        // Назначить роль первому пользователю
        $admin = User::first();
        $admin->assignRole('admin');
    }
}
```
</details>

### Задание 3: Используй Spatie Permission

Настрой систему прав и ролей с помощью пакета Spatie Permission.

<details>
<summary>Решение</summary>

```php
// 1. Установка
composer require spatie/laravel-permission

// 2. Публикация миграций и конфига
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate

// 3. User Model
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasRoles;

    // Остальной код...
}

// 4. Создание ролей и прав (Seeder)
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Сбросить кеш
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Создать права
        Permission::create(['name' => 'view posts']);
        Permission::create(['name' => 'create posts']);
        Permission::create(['name' => 'edit posts']);
        Permission::create(['name' => 'delete posts']);
        Permission::create(['name' => 'publish posts']);

        Permission::create(['name' => 'view users']);
        Permission::create(['name' => 'edit users']);
        Permission::create(['name' => 'delete users']);

        // Создать роли и назначить права
        $viewer = Role::create(['name' => 'viewer']);
        $viewer->givePermissionTo('view posts');

        $editor = Role::create(['name' => 'editor']);
        $editor->givePermissionTo(['view posts', 'create posts', 'edit posts']);

        $admin = Role::create(['name' => 'admin']);
        $admin->givePermissionTo(Permission::all());
    }
}

// 5. Назначение ролей пользователям
$user = User::find(1);
$user->assignRole('admin');

$user->assignRole(['editor', 'viewer']); // Несколько ролей

// Прямое назначение прав (без роли)
$user->givePermissionTo('edit posts');

// 6. Проверка прав
if ($user->can('edit posts')) {
    // Может редактировать
}

if ($user->hasRole('admin')) {
    // Админ
}

if ($user->hasAnyRole(['admin', 'editor'])) {
    // Админ или редактор
}

// 7. Policy с Spatie
class PostPolicy
{
    public function update(User $user, Post $post): bool
    {
        return $user->can('edit posts') &&
               ($user->id === $post->user_id || $user->hasRole('admin'));
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->can('delete posts');
    }

    public function publish(User $user, Post $post): bool
    {
        return $user->can('publish posts');
    }
}

// 8. Middleware
Route::middleware(['role:admin'])->group(function () {
    Route::get('/admin', [AdminController::class, 'index']);
});

Route::middleware(['permission:edit posts'])->group(function () {
    Route::resource('posts', PostController::class);
});

// Или несколько
Route::middleware(['role_or_permission:admin|edit posts'])->group(function () {
    // ...
});

// 9. Blade директивы
@role('admin')
    <a href="/admin">Admin Panel</a>
@endrole

@hasrole('editor')
    <a href="/posts/create">Create Post</a>
@endhasrole

@can('edit posts')
    <a href="{{ route('posts.edit', $post) }}">Edit</a>
@endcan

// 10. API Resource с правами
class PostResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'permissions' => [
                'can_edit' => $request->user()?->can('edit posts'),
                'can_delete' => $request->user()?->can('delete posts'),
                'can_publish' => $request->user()?->can('publish posts'),
            ],
        ];
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
