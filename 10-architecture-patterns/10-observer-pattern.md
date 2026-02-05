# 10.10 Observer Pattern

## Краткое резюме

> **Observer Pattern** — подписка объектов на события с автоматическим уведомлением.
>
> **Компоненты:** Subject (издатель), Observer (подписчик), Event (событие).
>
> **Важно:** Laravel: Event + Listeners, Model Observers для Eloquent. ShouldQueue для асинхронных listeners.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Laravel Events и Listeners](#laravel-events-и-listeners)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Observer Pattern — подписка объектов на события. Когда событие происходит, все подписчики получают уведомление.

**Компоненты:**
- Subject (издатель)
- Observer (подписчик)
- Event (событие)

---

## Как работает

**Базовый Observer:**

```php
// Subject (издатель)
interface Subject
{
    public function attach(Observer $observer): void;
    public function detach(Observer $observer): void;
    public function notify(): void;
}

// Observer (подписчик)
interface Observer
{
    public function update(Subject $subject): void;
}

// Реализация Subject
class Order implements Subject
{
    private array $observers = [];
    private string $status;

    public function attach(Observer $observer): void
    {
        $this->observers[] = $observer;
    }

    public function detach(Observer $observer): void
    {
        $key = array_search($observer, $this->observers, true);
        if ($key !== false) {
            unset($this->observers[$key]);
        }
    }

    public function notify(): void
    {
        foreach ($this->observers as $observer) {
            $observer->update($this);
        }
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
        $this->notify();  // Уведомляем всех подписчиков
    }

    public function getStatus(): string
    {
        return $this->status;
    }
}

// Реализация Observer
class EmailNotificationObserver implements Observer
{
    public function update(Subject $subject): void
    {
        if ($subject instanceof Order) {
            echo "Email sent: Order status changed to {$subject->getStatus()}\n";
        }
    }
}

class SmsNotificationObserver implements Observer
{
    public function update(Subject $subject): void
    {
        if ($subject instanceof Order) {
            echo "SMS sent: Order status changed to {$subject->getStatus()}\n";
        }
    }
}

// Использование
$order = new Order();
$order->attach(new EmailNotificationObserver());
$order->attach(new SmsNotificationObserver());

$order->setStatus('paid');  // Оба наблюдателя получат уведомление
```

---

## Laravel Events и Listeners

**Event:**

```php
// app/Events/OrderCreated.php
class OrderCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Order $order
    ) {}
}
```

**Listeners:**

```php
// app/Listeners/SendOrderConfirmation.php
class SendOrderConfirmation
{
    public function handle(OrderCreated $event): void
    {
        Mail::to($event->order->user->email)
            ->send(new OrderConfirmationMail($event->order));
    }
}

// app/Listeners/UpdateInventory.php
class UpdateInventory
{
    public function handle(OrderCreated $event): void
    {
        foreach ($event->order->items as $item) {
            $item->product->decrement('stock', $item->quantity);
        }
    }
}

// app/Listeners/SendAdminNotification.php
class SendAdminNotification
{
    public function handle(OrderCreated $event): void
    {
        Notification::send(
            User::where('role', 'admin')->get(),
            new NewOrderNotification($event->order)
        );
    }
}
```

**EventServiceProvider:**

```php
// app/Providers/EventServiceProvider.php
protected $listen = [
    OrderCreated::class => [
        SendOrderConfirmation::class,
        UpdateInventory::class,
        SendAdminNotification::class,
    ],
];
```

**Dispatch события:**

```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        // Dispatch события — все listeners будут вызваны
        event(new OrderCreated($order));

        return response()->json($order, 201);
    }
}
```

---

## Когда использовать

**Observer для:**
- Уведомления
- Логирование
- Обновление связанных данных
- Асинхронные операции

**НЕ для:**
- Прямая зависимость между объектами

---

## Пример из практики

**Model Observers:**

```php
// app/Observers/UserObserver.php
class UserObserver
{
    public function creating(User $user): void
    {
        // Перед созданием
        $user->uuid = Str::uuid();
    }

    public function created(User $user): void
    {
        // После создания
        event(new UserRegistered($user));
    }

    public function updating(User $user): void
    {
        // Перед обновлением
        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }
    }

    public function updated(User $user): void
    {
        // После обновления
        Cache::forget("user.{$user->id}");
    }

    public function deleted(User $user): void
    {
        // После удаления
        $user->posts()->delete();
        $user->comments()->delete();
    }
}

// app/Providers/EventServiceProvider.php
public function boot(): void
{
    User::observe(UserObserver::class);
}
```

**Queue Listeners (асинхронно):**

```php
// app/Listeners/SendOrderConfirmation.php
class SendOrderConfirmation implements ShouldQueue
{
    use InteractsWithQueue;

    public $queue = 'emails';
    public $tries = 3;
    public $backoff = [10, 30, 60];

    public function handle(OrderCreated $event): void
    {
        Mail::to($event->order->user->email)
            ->send(new OrderConfirmationMail($event->order));
    }

    public function failed(OrderCreated $event, Throwable $exception): void
    {
        Log::error("Failed to send order confirmation", [
            'order_id' => $event->order->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

**Event Subscribers (несколько событий):**

```php
// app/Listeners/UserEventSubscriber.php
class UserEventSubscriber
{
    public function handleUserLogin(UserLoggedIn $event): void
    {
        $event->user->update(['last_login_at' => now()]);
    }

    public function handleUserLogout(UserLoggedOut $event): void
    {
        Cache::forget("user.session.{$event->user->id}");
    }

    public function subscribe(Dispatcher $events): array
    {
        return [
            UserLoggedIn::class => 'handleUserLogin',
            UserLoggedOut::class => 'handleUserLogout',
        ];
    }
}

// EventServiceProvider
protected $subscribe = [
    UserEventSubscriber::class,
];
```

**Conditional Listeners:**

```php
class SendInvoiceEmail implements ShouldQueue
{
    public function handle(OrderCreated $event): void
    {
        Mail::to($event->order->user->email)
            ->send(new InvoiceEmail($event->order));
    }

    // Условие: выполнить только для оплаченных заказов
    public function shouldQueue(OrderCreated $event): bool
    {
        return $event->order->status === 'paid';
    }
}
```

---

## На собеседовании скажешь

> "Observer Pattern — подписка на события. Subject уведомляет Observers. Laravel: Event + Listeners. Event dispatch через `event()`. Listeners регистрируются в EventServiceProvider. Model Observers для Eloquent событий (creating, created, updating, deleted). ShouldQueue для асинхронных listeners. Event Subscribers для нескольких событий. Плюсы: слабая связанность, расширяемость. Используется для уведомлений, логирования, очистки кеша, обновления связанных данных."

---

## Практические задания

### Задание 1: Создай Model Observer для Product

Реализуй `ProductObserver` который автоматически создаёт slug, очищает кеш и логирует изменения.

<details>
<summary>Решение</summary>

```php
// app/Observers/ProductObserver.php
namespace App\Observers;

use App\Models\Product;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProductObserver
{
    public function creating(Product $product): void
    {
        // Автоматически создать slug перед созданием
        if (empty($product->slug)) {
            $product->slug = Str::slug($product->name);
        }

        // Установить значения по умолчанию
        if (!isset($product->is_active)) {
            $product->is_active = true;
        }

        Log::info('Creating product', ['name' => $product->name]);
    }

    public function created(Product $product): void
    {
        // После создания очистить кеш
        Cache::forget('products.all');
        Cache::forget('products.featured');

        Log::info('Product created', [
            'id' => $product->id,
            'name' => $product->name
        ]);

        // Отправить событие
        event(new \App\Events\ProductCreated($product));
    }

    public function updating(Product $product): void
    {
        // Если меняется имя, обновить slug
        if ($product->isDirty('name')) {
            $product->slug = Str::slug($product->name);
        }

        // Если деактивируется, обнулить stock
        if ($product->isDirty('is_active') && !$product->is_active) {
            $product->stock = 0;
        }

        Log::info('Updating product', [
            'id' => $product->id,
            'changes' => $product->getDirty()
        ]);
    }

    public function updated(Product $product): void
    {
        // Очистить кеш конкретного продукта
        Cache::forget("product.{$product->id}");
        Cache::forget('products.all');

        // Если изменилась цена, уведомить подписчиков
        if ($product->wasChanged('price')) {
            event(new \App\Events\ProductPriceChanged($product));
        }

        Log::info('Product updated', ['id' => $product->id]);
    }

    public function deleted(Product $product): void
    {
        // Удалить связанные данные
        $product->reviews()->delete();
        $product->images()->delete();

        // Очистить кеш
        Cache::forget("product.{$product->id}");
        Cache::forget('products.all');

        Log::warning('Product deleted', [
            'id' => $product->id,
            'name' => $product->name
        ]);
    }

    public function restored(Product $product): void
    {
        // При восстановлении из soft delete
        Cache::forget('products.all');

        Log::info('Product restored', ['id' => $product->id]);
    }

    public function forceDeleted(Product $product): void
    {
        // При окончательном удалении
        // Удалить файлы изображений
        if ($product->image_url) {
            Storage::delete($product->image_url);
        }

        Log::warning('Product force deleted', ['id' => $product->id]);
    }
}

// app/Providers/EventServiceProvider.php
namespace App\Providers;

use App\Models\Product;
use App\Observers\ProductObserver;

class EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Product::observe(ProductObserver::class);
    }
}
```
</details>

### Задание 2: Создай Event с несколькими Listeners

Реализуй `UserRegistered` Event с 3 Listeners: отправка email, создание профиля, начисление бонусов.

<details>
<summary>Решение</summary>

```php
// app/Events/UserRegistered.php
namespace App\Events;

use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserRegistered
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public User $user
    ) {}
}

// app/Listeners/SendWelcomeEmail.php
namespace App\Listeners;

use App\Events\UserRegistered;
use App\Mail\WelcomeEmail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;

class SendWelcomeEmail implements ShouldQueue
{
    use InteractsWithQueue;

    public $queue = 'emails';
    public $tries = 3;
    public $backoff = [10, 30, 60];

    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user->email)
            ->send(new WelcomeEmail($event->user));
    }

    public function failed(UserRegistered $event, \Throwable $exception): void
    {
        Log::error('Failed to send welcome email', [
            'user_id' => $event->user->id,
            'error' => $exception->getMessage()
        ]);
    }
}

// app/Listeners/CreateUserProfile.php
namespace App\Listeners;

use App\Events\UserRegistered;
use App\Models\UserProfile;

class CreateUserProfile
{
    public function handle(UserRegistered $event): void
    {
        UserProfile::create([
            'user_id' => $event->user->id,
            'bio' => '',
            'avatar' => 'default-avatar.png',
            'theme' => 'light',
            'language' => 'en',
            'notifications_enabled' => true,
        ]);
    }
}

// app/Listeners/GiveWelcomeBonus.php
namespace App\Listeners;

use App\Events\UserRegistered;
use App\Models\UserBonus;

class GiveWelcomeBonus
{
    public function handle(UserRegistered $event): void
    {
        UserBonus::create([
            'user_id' => $event->user->id,
            'amount' => 100,
            'type' => 'welcome',
            'description' => 'Welcome bonus',
            'expires_at' => now()->addDays(30),
        ]);
    }
}

// app/Providers/EventServiceProvider.php
protected $listen = [
    UserRegistered::class => [
        SendWelcomeEmail::class,
        CreateUserProfile::class,
        GiveWelcomeBonus::class,
    ],
];

// Использование в Controller
class RegisterController extends Controller
{
    public function register(Request $request)
    {
        $user = User::create($request->validated());

        // Dispatch события - все listeners будут вызваны
        event(new UserRegistered($user));

        return redirect()->route('dashboard')
            ->with('success', 'Welcome! Check your email.');
    }
}
```
</details>

### Задание 3: Реализуй Event Subscriber

Создай `UserActivitySubscriber` который слушает несколько событий пользователя.

<details>
<summary>Решение</summary>

```php
// События
namespace App\Events;

class UserLoggedIn
{
    public function __construct(public User $user) {}
}

class UserLoggedOut
{
    public function __construct(public User $user) {}
}

class UserProfileUpdated
{
    public function __construct(public User $user) {}
}

class UserPasswordChanged
{
    public function __construct(public User $user) {}
}

// app/Listeners/UserActivitySubscriber.php
namespace App\Listeners;

use App\Events\UserLoggedIn;
use App\Events\UserLoggedOut;
use App\Events\UserProfileUpdated;
use App\Events\UserPasswordChanged;
use Illuminate\Events\Dispatcher;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class UserActivitySubscriber
{
    public function handleUserLogin(UserLoggedIn $event): void
    {
        // Обновить last_login_at
        $event->user->update([
            'last_login_at' => now(),
            'last_login_ip' => request()->ip(),
        ]);

        // Логирование
        Log::info('User logged in', [
            'user_id' => $event->user->id,
            'ip' => request()->ip(),
        ]);

        // Сохранить в кеше
        Cache::put(
            "user.session.{$event->user->id}",
            true,
            now()->addHours(2)
        );
    }

    public function handleUserLogout(UserLoggedOut $event): void
    {
        // Очистить сессию из кеша
        Cache::forget("user.session.{$event->user->id}");

        Log::info('User logged out', [
            'user_id' => $event->user->id,
        ]);
    }

    public function handleProfileUpdate(UserProfileUpdated $event): void
    {
        // Очистить кеш профиля
        Cache::forget("user.profile.{$event->user->id}");

        Log::info('User profile updated', [
            'user_id' => $event->user->id,
            'changes' => $event->user->getChanges(),
        ]);

        // Если изменился email, требуется верификация
        if ($event->user->wasChanged('email')) {
            $event->user->update(['email_verified_at' => null]);
            event(new \App\Events\EmailVerificationRequired($event->user));
        }
    }

    public function handlePasswordChange(UserPasswordChanged $event): void
    {
        // Уведомить пользователя о смене пароля
        Mail::to($event->user->email)
            ->send(new \App\Mail\PasswordChangedMail($event->user));

        Log::warning('User password changed', [
            'user_id' => $event->user->id,
            'ip' => request()->ip(),
        ]);

        // Инвалидировать все сессии кроме текущей
        $event->user->sessions()
            ->where('id', '!=', session()->getId())
            ->delete();
    }

    // Регистрация событий
    public function subscribe(Dispatcher $events): array
    {
        return [
            UserLoggedIn::class => 'handleUserLogin',
            UserLoggedOut::class => 'handleUserLogout',
            UserProfileUpdated::class => 'handleProfileUpdate',
            UserPasswordChanged::class => 'handlePasswordChange',
        ];
    }
}

// app/Providers/EventServiceProvider.php
protected $subscribe = [
    UserActivitySubscriber::class,
];

// Альтернативный способ регистрации в subscribe()
public function subscribe(Dispatcher $events): void
{
    $events->listen(
        UserLoggedIn::class,
        [UserActivitySubscriber::class, 'handleUserLogin']
    );

    $events->listen(
        UserLoggedOut::class,
        [UserActivitySubscriber::class, 'handleUserLogout']
    );

    $events->listen(
        UserProfileUpdated::class,
        [UserActivitySubscriber::class, 'handleProfileUpdate']
    );

    $events->listen(
        UserPasswordChanged::class,
        [UserActivitySubscriber::class, 'handlePasswordChange']
    );
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
