# 5.7 API Resources

> **TL;DR:** API Resources — слой трансформации моделей Eloquent в JSON для API. Контролируют структуру ответа, скрывают внутренние поля, добавляют computed данные. `Resource` для одной модели, `ResourceCollection` для коллекций. Используют `whenLoaded()` для отношений, `when()` для условных полей.

---

## 📚 Содержание

- [Основы](#основы)
- [Resource vs ResourceCollection](#resource-vs-resourcecollection)
- [Работа с отношениями](#работа-с-отношениями)
- [Условные поля](#условные-поля)
- [Пагинация](#пагинация)
- [Частые ошибки](#частые-ошибки)
- [Best Practices](#best-practices)

---

## 🎯 Основы

### Что это?

**API Resource** — класс который определяет как модель Eloquent должна быть преобразована в JSON для API ответа.

### Зачем нужны?

| Проблема | Решение с Resources |
|----------|-------------------|
| Возвращаем все поля модели (включая пароли) | Контролируем какие поля показывать |
| Структура БД = структура API | Независимая структура API |
| Дублирование логики трансформации | Централизованная трансформация |
| Сложно добавить computed поля | Легко добавить любые поля |

### Создание

```bash
# Resource для одной модели
php artisan make:resource UserResource

# ResourceCollection
php artisan make:resource UserCollection --collection
```

### Базовый пример

```php
// app/Http/Resources/UserResource.php
namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
```

```php
// В контроллере
use App\Http\Resources\UserResource;

class UserController extends Controller
{
    public function show(User $user)
    {
        return new UserResource($user);
    }
}
```

**Ответ API:**
```json
{
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00.000000Z"
  }
}
```

---

## 📦 Resource vs ResourceCollection

### Когда что использовать?

| Тип | Использование | Метод |
|-----|--------------|-------|
| **Resource** | Одна модель | `new UserResource($user)` |
| **Resource::collection()** | Коллекция (простая) | `UserResource::collection($users)` |
| **ResourceCollection** | Коллекция (кастомная) | `new UserCollection($users)` |

### Resource для коллекции

```php
class UserController extends Controller
{
    public function index()
    {
        $users = User::paginate(20);

        // Автоматическая коллекция
        return UserResource::collection($users);
    }
}
```

### Кастомная ResourceCollection

```php
namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class UserCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            'meta' => [
                'total' => $this->total(),
                'per_page' => $this->perPage(),
            ],
            'summary' => [
                'active_users' => $this->collection->where('active', true)->count(),
            ],
        ];
    }
}
```

---

## 🔗 Работа с отношениями

### whenLoaded() — избегаем N+1

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,

            // Загрузится ТОЛЬКО если было eager loading
            'author' => new UserResource($this->whenLoaded('user')),
            'comments' => CommentResource::collection($this->whenLoaded('comments')),

            // Счётчик
            'comments_count' => $this->when(
                isset($this->comments_count),
                $this->comments_count
            ),
        ];
    }
}
```

```php
// В контроллере: eager loading
public function show(Post $post)
{
    return new PostResource(
        $post->load(['user', 'comments'])
    );
}
```

---

## 🎭 Условные поля

### when() — одно поле

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,

            // Показать только авторизованным
            'body' => $this->when(
                $request->user(),
                $this->body
            ),

            // Показать только владельцу
            'draft' => $this->when(
                $request->user()?->id === $this->user_id,
                $this->draft
            ),
        ];
    }
}
```

### mergeWhen() — группа полей

```php
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'total' => $this->total,

            // Показать группу полей только владельцу или админу
            $this->mergeWhen($this->canView($request->user()), [
                'payment_method' => $this->payment_method,
                'billing_address' => $this->billing_address,
                'shipping_address' => $this->shipping_address,
            ]),
        ];
    }

    private function canView(?User $user): bool
    {
        return $user && (
            $user->id === $this->user_id ||
            $user->isAdmin()
        );
    }
}
```

---

## 📄 Пагинация

### Автоматическая пагинация

```php
class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with('user')->paginate(20);

        return PostResource::collection($posts);
    }
}
```

**Ответ:**
```json
{
  "data": [...],
  "links": {
    "first": "http://api.com/posts?page=1",
    "last": "http://api.com/posts?page=10",
    "prev": null,
    "next": "http://api.com/posts?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 10,
    "per_page": 20,
    "to": 20,
    "total": 200
  }
}
```

### Дополнительные мета-данные

```php
class PostResource extends JsonResource
{
    public function with(Request $request): array
    {
        return [
            'success' => true,
            'links' => [
                'self' => route('posts.show', $this->id),
                'author' => route('users.show', $this->user_id),
            ],
        ];
    }
}
```

---

## ⚠️ Частые ошибки

### ❌ Ошибка 1: N+1 проблема

```php
// ПЛОХО: N+1 запрос
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'author' => new UserResource($this->user), // N+1!
        ];
    }
}
```

```php
// ХОРОШО: whenLoaded
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'author' => new UserResource($this->whenLoaded('user')),
        ];
    }
}

// В контроллере: eager loading
$posts = Post::with('user')->get();
```

### ❌ Ошибка 2: Возврат модели вместо Resource

```php
// ПЛОХО: возвращаем модель напрямую
public function show(User $user)
{
    return $user; // Показывает ВСЕ поля включая password_hash!
}

// ХОРОШО: через Resource
public function show(User $user)
{
    return new UserResource($user);
}
```

### ❌ Ошибка 3: Не проверять загружены ли отношения

```php
// ПЛОХО
'comments_count' => $this->comments_count

// ХОРОШО
'comments_count' => $this->when(
    isset($this->comments_count),
    $this->comments_count
)
```

---

## ✅ Best Practices

### 1. Убрать обёртку "data" (опционально)

```php
// AppServiceProvider
use Illuminate\Http\Resources\Json\JsonResource;

public function boot(): void
{
    JsonResource::withoutWrapping();
}
```

**Было:**
```json
{"data": {"id": 1, "name": "John"}}
```

**Стало:**
```json
{"id": 1, "name": "John"}
```

### 2. Кастомная обёртка

```php
class PostResource extends JsonResource
{
    public static $wrap = 'post'; // Обернёт в 'post'
}
```

### 3. Computed поля

```php
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'total' => $this->total,

            // Computed поля
            'status_label' => $this->getStatusLabel(),
            'is_shipped' => $this->status === 'shipped',
            'can_cancel' => $this->canBeCancelled(),
        ];
    }

    private function getStatusLabel(): string
    {
        return match($this->status) {
            'pending' => 'В обработке',
            'shipped' => 'Отправлен',
            'delivered' => 'Доставлен',
            default => 'Неизвестно',
        };
    }
}
```

### 4. Версионирование API

```php
// v1/UserResource.php
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
        ];
    }
}

// v2/UserResource.php
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->name, // Переименовали
            'avatar_url' => $this->avatar, // Новое поле
        ];
    }
}
```

---

## 📊 Сравнение подходов

| Подход | Плюсы | Минусы | Когда использовать |
|--------|-------|--------|-------------------|
| **Модель напрямую** | Просто | Показывает ВСЁ, нет контроля | Внутренние API, прототипы |
| **Array вручную** | Гибко | Дублирование кода | Разовые случаи |
| **Resource** | Переиспользование, чистота | Чуть больше кода | Любые публичные API |
| **DTO + Resource** | Максимальная типизация | Больше всего кода | Enterprise проекты |

---

## 🎓 На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- API Resources трансформируют модели Eloquent в JSON для API ответов
- Resource для одной модели, ResourceCollection для коллекций

**Основные методы:**
- `toArray()` — определяет структуру JSON
- `whenLoaded()` — загружать отношения только если были eager loaded (избегает N+1)
- `when()` — условное поле
- `mergeWhen()` — группа условных полей
- `with()` — дополнительные мета-данные

**Использование:**
```php
// Одна модель
return new UserResource($user);

// Коллекция
return UserResource::collection($users);

// Пагинация (автоматически)
return UserResource::collection(User::paginate(20));
```

**Best practices:**
- Всегда `whenLoaded()` для отношений
- Условные поля для чувствительных данных
- Computed поля для бизнес-логики
- Версионирование Resources для API v1, v2

---

## 🚀 Следующий шаг

Изучил API Resources? Отлично! Теперь попрактикуйся:

✅ Создай Resource с вложенными отношениями
✅ Добавь условные поля для разных ролей
✅ Реализуй пагинацию с кастомными мета-данными

**Нужна помощь с подготовкой к собеседованию?**

**[CodeMate](https://codemate.team)** поможет:
- 🎯 Mock interview по Laravel
- 💬 Разбор реальных вопросов
- 📝 Code review твоих проектов

**[Записаться на консультацию →](https://codemate.team/consultation)**

---

<sub>📚 Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)</sub>
