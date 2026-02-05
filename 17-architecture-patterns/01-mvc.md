# 10.1 MVC (Model-View-Controller)

## Краткое резюме

> **MVC** — архитектурный паттерн, разделяющий приложение на три компонента.
>
> **Компоненты:** Model (данные/Eloquent), View (отображение/Blade), Controller (логика обработки).
>
> **Важно:** Контроллеры должны быть тонкими — бизнес-логика выносится в Service Layer.

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
MVC — архитектурный паттерн, разделяющий приложение на три компонента: Model (данные), View (отображение), Controller (логика обработки).

**Компоненты:**
- **Model** — работа с данными (Eloquent)
- **View** — отображение (Blade)
- **Controller** — обработка запросов

---

## Как работает

**Схема MVC:**

```
Request → Router → Controller → Model → Database
                      ↓
                    View → Response
```

**Model (Eloquent):**

```php
// app/Models/Post.php
class Post extends Model
{
    protected $fillable = ['title', 'body', 'user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}
```

**Controller:**

```php
// app/Http/Controllers/PostController.php
class PostController extends Controller
{
    public function index()
    {
        $posts = Post::with('user')->paginate(20);

        return view('posts.index', compact('posts'));
    }

    public function show(Post $post)
    {
        $post->load('user', 'comments');

        return view('posts.show', compact('post'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|max:255',
            'body' => 'required',
        ]);

        $post = Post::create([
            'user_id' => auth()->id(),
            ...$validated,
        ]);

        return redirect()->route('posts.show', $post);
    }
}
```

**View (Blade):**

```blade
{{-- resources/views/posts/index.blade.php --}}
@extends('layouts.app')

@section('content')
    <h1>Posts</h1>

    @foreach($posts as $post)
        <article>
            <h2>{{ $post->title }}</h2>
            <p>By {{ $post->user->name }}</p>
            <p>{{ $post->excerpt }}</p>
            <a href="{{ route('posts.show', $post) }}">Read more</a>
        </article>
    @endforeach

    {{ $posts->links() }}
@endsection
```

---

## Когда использовать

**MVC подходит для:**
- Веб-приложения
- CRUD операции
- Традиционные server-side приложения

**Проблемы MVC:**
- Контроллеры могут разрастаться (Fat Controllers)
- Бизнес-логика в контроллерах
- Решение: Service Layer, Repository

---

## Пример из практики

**Тонкий контроллер (правильно):**

```php
class PostController extends Controller
{
    public function __construct(
        private PostService $postService
    ) {}

    public function store(CreatePostRequest $request)
    {
        // Делегируем логику сервису
        $post = $this->postService->create(
            $request->user(),
            $request->validated()
        );

        return redirect()->route('posts.show', $post)
            ->with('success', 'Post created!');
    }
}

// app/Services/PostService.php
class PostService
{
    public function create(User $user, array $data): Post
    {
        DB::beginTransaction();

        try {
            $post = Post::create([
                'user_id' => $user->id,
                ...$data,
            ]);

            // Дополнительная логика
            event(new PostCreated($post));
            Cache::forget('posts.latest');

            DB::commit();

            return $post;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

**View Composers (для общих данных):**

```php
// app/Providers/ViewServiceProvider.php
class ViewServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Для всех views
        View::composer('*', function ($view) {
            $view->with('appName', config('app.name'));
        });

        // Для конкретного view
        View::composer('posts.*', function ($view) {
            $view->with('categories', Category::all());
        });
    }
}
```

---

## На собеседовании скажешь

> "MVC разделяет на Model (данные), View (отображение), Controller (логика). В Laravel: Eloquent для Model, Blade для View, Controller для обработки запросов. Контроллер получает запрос, взаимодействует с Model, возвращает View. Проблема Fat Controllers решается через Service Layer. View Composers для общих данных. Route → Controller → Model → View → Response."

---

## Практические задания

### Задание 1: Рефакторинг Fat Controller

У тебя есть контроллер с бизнес-логикой. Вынеси её в Service Layer.

```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create([
            'user_id' => auth()->id(),
            'total' => $request->total,
        ]);

        foreach ($request->items as $item) {
            $order->items()->create($item);
        }

        Mail::to($order->user)->send(new OrderConfirmation($order));
        Cache::forget('orders.latest');
        event(new OrderCreated($order));

        return redirect()->route('orders.show', $order);
    }
}
```

<details>
<summary>Решение</summary>

```php
// app/Services/OrderService.php
class OrderService
{
    public function __construct(
        private OrderRepository $orderRepository
    ) {}

    public function create(User $user, array $data): Order
    {
        DB::beginTransaction();

        try {
            $order = $this->orderRepository->create([
                'user_id' => $user->id,
                'total' => $data['total'],
            ]);

            foreach ($data['items'] as $item) {
                $order->items()->create($item);
            }

            Mail::to($user)->send(new OrderConfirmation($order));
            Cache::forget('orders.latest');
            event(new OrderCreated($order));

            DB::commit();

            return $order;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

// app/Http/Controllers/OrderController.php
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

        return redirect()->route('orders.show', $order)
            ->with('success', 'Order created successfully!');
    }
}
```
</details>

### Задание 2: Настрой View Composer

Создай View Composer который будет добавлять список категорий во все views начинающиеся с `posts.*`.

<details>
<summary>Решение</summary>

```php
// app/Providers/ViewServiceProvider.php
namespace App\Providers;

use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use App\Models\Category;

class ViewServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Для конкретного паттерна views
        View::composer('posts.*', function ($view) {
            $view->with('categories', Category::all());
        });

        // Для нескольких views
        View::composer(['posts.*', 'admin.posts.*'], function ($view) {
            $view->with('categories', Category::orderBy('name')->get());
        });

        // Или через класс
        View::composer('posts.*', PostViewComposer::class);
    }
}

// app/View/Composers/PostViewComposer.php
namespace App\View\Composers;

use App\Models\Category;
use Illuminate\View\View;

class PostViewComposer
{
    public function compose(View $view): void
    {
        $view->with('categories', Category::cached()->get());
    }
}

// config/app.php - добавить в providers
'providers' => [
    // ...
    App\Providers\ViewServiceProvider::class,
],

// resources/views/posts/create.blade.php
<select name="category_id">
    @foreach($categories as $category)
        <option value="{{ $category->id }}">{{ $category->name }}</option>
    @endforeach
</select>
```
</details>

### Задание 3: Реализуй Resource Controller

Создай полноценный CRUD контроллер для модели `Article` с валидацией.

<details>
<summary>Решение</summary>

```php
// app/Http/Controllers/ArticleController.php
class ArticleController extends Controller
{
    public function index()
    {
        $articles = Article::with('user')->latest()->paginate(20);

        return view('articles.index', compact('articles'));
    }

    public function create()
    {
        return view('articles.create');
    }

    public function store(StoreArticleRequest $request)
    {
        $article = Article::create([
            'user_id' => auth()->id(),
            ...$request->validated(),
        ]);

        return redirect()->route('articles.show', $article)
            ->with('success', 'Article created successfully!');
    }

    public function show(Article $article)
    {
        $article->load('user', 'comments');

        return view('articles.show', compact('article'));
    }

    public function edit(Article $article)
    {
        $this->authorize('update', $article);

        return view('articles.edit', compact('article'));
    }

    public function update(UpdateArticleRequest $request, Article $article)
    {
        $this->authorize('update', $article);

        $article->update($request->validated());

        return redirect()->route('articles.show', $article)
            ->with('success', 'Article updated successfully!');
    }

    public function destroy(Article $article)
    {
        $this->authorize('delete', $article);

        $article->delete();

        return redirect()->route('articles.index')
            ->with('success', 'Article deleted successfully!');
    }
}

// app/Http/Requests/StoreArticleRequest.php
class StoreArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|max:255',
            'slug' => 'required|unique:articles',
            'body' => 'required',
            'published' => 'boolean',
        ];
    }
}

// routes/web.php
Route::resource('articles', ArticleController::class);
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
