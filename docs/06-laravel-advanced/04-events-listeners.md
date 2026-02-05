# 5.4 Events & Listeners

## Краткое резюме

> **Events** — события в приложении (OrderCreated, UserRegistered). **Listeners** — обработчики этих событий (SendEmail, LogActivity).
>
> **Паттерн:** Event-Listener разделяет логику на модули. Одно событие → несколько обработчиков.
>
> **Регистрация:** в `EventServiceProvider`. **Dispatch:** `EventName::dispatch()`.

---

## Содержание

- [Что это](#что-это)
- [Создание Events/Listeners](#как-работает)
- [Регистрация](#как-работает)
- [Dispatch событий](#как-работает)
- [Model Events/Observers](#пример-из-практики)
- [Queued Listeners](#пример-из-практики)
- [Когда использовать](#когда-использовать)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Events — события в приложении (создан пользователь, отправлен заказ). Listeners — обработчики событий (отправить email, записать лог).

**Основное:**
- Event — что произошло
- Listener — что сделать
- Регистрация в EventServiceProvider

---

## Как работает

**Создание Event:**

```bash
php artisan make:event OrderCreated
```

```php
namespace App\Events;

use App\Models\Order;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(public Order $order)
    {
    }
}
```

**Создание Listener:**

```bash
php artisan make:listener SendOrderConfirmation --event=OrderCreated
```

```php
namespace App\Listeners;

use App\Events\OrderCreated;
use App\Notifications\OrderConfirmation;

class SendOrderConfirmation
{
    public function handle(OrderCreated $event): void
    {
        $event->order->user->notify(
            new OrderConfirmation($event->order)
        );
    }
}
```

**Регистрация в EventServiceProvider:**

```php
namespace App\Providers;

use App\Events\OrderCreated;
use App\Listeners\{SendOrderConfirmation, UpdateInventory, NotifyAdmin};
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        OrderCreated::class => [
            SendOrderConfirmation::class,
            UpdateInventory::class,
            NotifyAdmin::class,
        ],
    ];

    public function boot(): void
    {
        //
    }
}
```

**Dispatch (вызов) события:**

```php
use App\Events\OrderCreated;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        // Вызвать событие
        OrderCreated::dispatch($order);

        // Или через helper
        event(new OrderCreated($order));

        return response()->json($order, 201);
    }
}
```

---

## Когда использовать

**Используй Events когда:**
- Одно действие вызывает несколько последствий
- Разные части приложения должны реагировать на событие
- Нужна асинхронная обработка (queue)
- Модульность (разделение логики)

**Не используй когда:**
- Простая последовательная логика (вызови сервис напрямую)
- Только один обработчик (лучше прямой вызов)

---

## Пример из практики

**Комплексная обработка заказа:**

```php
// Event
namespace App\Events;

class OrderCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(public Order $order) {}
}

// Listeners
namespace App\Listeners;

class SendOrderConfirmation
{
    public function handle(OrderCreated $event): void
    {
        $event->order->user->notify(
            new OrderConfirmation($event->order)
        );
    }
}

class UpdateInventory
{
    public function handle(OrderCreated $event): void
    {
        foreach ($event->order->items as $item) {
            $item->product->decrement('stock', $item->quantity);
        }
    }
}

class NotifyAdmin implements ShouldQueue  // Асинхронно
{
    public function handle(OrderCreated $event): void
    {
        if ($event->order->total > 10000) {
            // Отправить уведомление админу о крупном заказе
            Admin::notify(new LargeOrderNotification($event->order));
        }
    }
}

class RecordAnalytics implements ShouldQueue
{
    public function handle(OrderCreated $event): void
    {
        Analytics::track('order_created', [
            'order_id' => $event->order->id,
            'amount' => $event->order->total,
        ]);
    }
}

// Регистрация
class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        OrderCreated::class => [
            SendOrderConfirmation::class,
            UpdateInventory::class,
            NotifyAdmin::class,
            RecordAnalytics::class,
        ],
    ];
}

// Использование
class OrderService
{
    public function create(User $user, array $data): Order
    {
        DB::beginTransaction();

        try {
            $order = Order::create([
                'user_id' => $user->id,
                'total' => $this->calculateTotal($data),
            ]);

            foreach ($data['items'] as $item) {
                $order->items()->create($item);
            }

            DB::commit();

            // Вызвать все listeners
            OrderCreated::dispatch($order);

            return $order;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

**Event Subscribers (группировка listeners):**

```php
namespace App\Listeners;

use App\Events\{OrderCreated, OrderPaid, OrderShipped};
use Illuminate\Events\Dispatcher;

class OrderEventSubscriber
{
    public function handleOrderCreated(OrderCreated $event): void
    {
        // Логика для OrderCreated
    }

    public function handleOrderPaid(OrderPaid $event): void
    {
        // Логика для OrderPaid
    }

    public function handleOrderShipped(OrderShipped $event): void
    {
        // Логика для OrderShipped
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(
            OrderCreated::class,
            [OrderEventSubscriber::class, 'handleOrderCreated']
        );

        $events->listen(
            OrderPaid::class,
            [OrderEventSubscriber::class, 'handleOrderPaid']
        );

        $events->listen(
            OrderShipped::class,
            [OrderEventSubscriber::class, 'handleOrderShipped']
        );
    }
}

// Регистрация в EventServiceProvider
class EventServiceProvider extends ServiceProvider
{
    protected $subscribe = [
        OrderEventSubscriber::class,
    ];
}
```

**Model Events (встроенные):**

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    // Автоматические события: creating, created, updating, updated, deleting, deleted, etc.

    protected static function booted(): void
    {
        // Событие при создании
        static::creating(function (Post $post) {
            $post->slug = Str::slug($post->title);
        });

        // Событие после создания
        static::created(function (Post $post) {
            Cache::forget('posts.all');
        });

        // Событие при обновлении
        static::updating(function (Post $post) {
            if ($post->isDirty('status') && $post->status === 'published') {
                // Опубликован
                event(new PostPublished($post));
            }
        });

        // Событие при удалении
        static::deleting(function (Post $post) {
            // Удалить связанные комментарии
            $post->comments()->delete();
        });
    }
}
```

**Observer (альтернатива model events):**

```bash
php artisan make:observer UserObserver --model=User
```

```php
namespace App\Observers;

use App\Models\User;

class UserObserver
{
    public function creating(User $user): void
    {
        $user->uuid = Str::uuid();
    }

    public function created(User $user): void
    {
        // Отправить welcome email
        $user->notify(new WelcomeNotification());
    }

    public function updating(User $user): void
    {
        if ($user->isDirty('email')) {
            // Email изменён, отправить подтверждение
            $user->email_verified_at = null;
        }
    }

    public function deleted(User $user): void
    {
        // Удалить связанные данные
        $user->posts()->delete();
        $user->orders()->delete();
    }
}

// Регистрация в EventServiceProvider или AppServiceProvider
public function boot(): void
{
    User::observe(UserObserver::class);
}
```

**Queued Listeners (асинхронные):**

```php
namespace App\Listeners;

use App\Events\OrderCreated;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendOrderConfirmation implements ShouldQueue
{
    // Очередь для выполнения
    public $queue = 'emails';

    // Задержка перед выполнением
    public $delay = 60;  // 60 секунд

    // Количество попыток
    public $tries = 3;

    public function handle(OrderCreated $event): void
    {
        // Отправить email
    }

    // Обработка ошибок
    public function failed(OrderCreated $event, \Throwable $exception): void
    {
        Log::error('Failed to send order confirmation', [
            'order_id' => $event->order->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

**Условный Dispatch:**

```php
// Dispatch только если условие истинно
OrderCreated::dispatchIf(
    $order->total > 1000,
    $order
);

// Dispatch только если условие ложно
OrderCreated::dispatchUnless(
    $order->isFree(),
    $order
);
```

**After Response (выполнить после отправки ответа):**

```php
namespace App\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

class OrderCreated implements ShouldDispatchAfterCommit
{
    // Dispatch после DB::commit()
}
```

**Closure Listeners (без класса):**

```php
// В EventServiceProvider
use App\Events\OrderCreated;
use Illuminate\Support\Facades\Event;

public function boot(): void
{
    Event::listen(OrderCreated::class, function (OrderCreated $event) {
        // Простая логика без создания класса
        Log::info('Order created', ['order_id' => $event->order->id]);
    });

    // Wildcard listener
    Event::listen('order.*', function (string $eventName, array $data) {
        // Слушать все события order.*
    });
}
```

---

## На собеседовании скажешь

> "Events — события (OrderCreated), Listeners — обработчики (SendEmail, UpdateInventory). Регистрация в EventServiceProvider через $listen. Dispatch через EventName::dispatch() или event(). Queued Listeners с ShouldQueue выполняются асинхронно. Model events (creating, created, updating) через booted() или Observer. Event Subscriber группирует listeners. dispatchIf/dispatchUnless для условного вызова. ShouldDispatchAfterCommit для вызова после commit."

---

## Практические задания

### Задание 1: Создай Event + Listeners

При регистрации пользователя нужно: отправить welcome email, создать профиль, записать в лог. Реализуй через Events.

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

    public function __construct(public User $user) {}
}

// app/Listeners/SendWelcomeEmail.php
namespace App\Listeners;

use App\Events\UserRegistered;
use App\Notifications\WelcomeNotification;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendWelcomeEmail implements ShouldQueue
{
    public function handle(UserRegistered $event): void
    {
        $event->user->notify(new WelcomeNotification());
    }
}

// app/Listeners/CreateUserProfile.php
class CreateUserProfile
{
    public function handle(UserRegistered $event): void
    {
        $event->user->profile()->create([
            'bio' => '',
            'avatar' => 'default.png',
        ]);
    }
}

// app/Listeners/LogUserRegistration.php
class LogUserRegistration
{
    public function handle(UserRegistered $event): void
    {
        Log::info('New user registered', [
            'user_id' => $event->user->id,
            'email' => $event->user->email,
        ]);
    }
}

// app/Providers/EventServiceProvider.php
protected $listen = [
    UserRegistered::class => [
        SendWelcomeEmail::class,
        CreateUserProfile::class,
        LogUserRegistration::class,
    ],
];

// В контроллере
public function register(Request $request)
{
    $user = User::create($request->validated());

    UserRegistered::dispatch($user);

    return response()->json($user, 201);
}
```
</details>

### Задание 2: Observer для Post

Создай Observer для модели Post который автоматически генерирует slug при создании и очищает кэш при обновлении.

<details>
<summary>Решение</summary>

```php
// app/Observers/PostObserver.php
namespace App\Observers;

use App\Models\Post;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;

class PostObserver
{
    public function creating(Post $post): void
    {
        // Автоматически генерировать slug
        if (empty($post->slug)) {
            $post->slug = Str::slug($post->title);

            // Проверить уникальность
            $originalSlug = $post->slug;
            $count = 1;

            while (Post::where('slug', $post->slug)->exists()) {
                $post->slug = "{$originalSlug}-{$count}";
                $count++;
            }
        }
    }

    public function created(Post $post): void
    {
        // Очистить кэш после создания
        Cache::forget('posts.all');
        Cache::forget("posts.category.{$post->category_id}");
    }

    public function updating(Post $post): void
    {
        // Если меняется статус на published
        if ($post->isDirty('status') && $post->status === 'published') {
            $post->published_at = now();
        }
    }

    public function updated(Post $post): void
    {
        // Очистить кэш после обновления
        Cache::forget("posts.{$post->id}");
        Cache::forget('posts.all');
    }

    public function deleted(Post $post): void
    {
        // Удалить комментарии и лайки
        $post->comments()->delete();
        $post->likes()->delete();

        // Очистить кэш
        Cache::forget("posts.{$post->id}");
        Cache::forget('posts.all');
    }
}

// Регистрация в AppServiceProvider или EventServiceProvider
use App\Models\Post;
use App\Observers\PostObserver;

public function boot(): void
{
    Post::observe(PostObserver::class);
}
```
</details>

### Задание 3: Queued Listener с повторами

Создай Listener для отправки SMS который выполняется в очереди, делает 3 попытки с задержкой 60 секунд, и логирует ошибки.

<details>
<summary>Решение</summary>

```php
// app/Events/OrderShipped.php
namespace App\Events;

use App\Models\Order;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderShipped
{
    use Dispatchable, SerializesModels;

    public function __construct(public Order $order) {}
}

// app/Listeners/SendShippingSms.php
namespace App\Listeners;

use App\Events\OrderShipped;
use App\Services\SmsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SendShippingSms implements ShouldQueue
{
    use InteractsWithQueue;

    // Очередь для выполнения
    public $queue = 'notifications';

    // Количество попыток
    public $tries = 3;

    // Задержка между попытками (секунды)
    public $backoff = 60;

    // Таймаут выполнения (секунды)
    public $timeout = 30;

    public function __construct(
        private SmsService $smsService
    ) {}

    public function handle(OrderShipped $event): void
    {
        $order = $event->order;

        $this->smsService->send(
            $order->user->phone,
            "Your order #{$order->id} has been shipped!"
        );

        Log::info('Shipping SMS sent', [
            'order_id' => $order->id,
            'phone' => $order->user->phone,
        ]);
    }

    // Обработка ошибки после всех попыток
    public function failed(OrderShipped $event, \Throwable $exception): void
    {
        Log::error('Failed to send shipping SMS after all retries', [
            'order_id' => $event->order->id,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);

        // Можно отправить уведомление админу
        // Admin::notify(new SmsFailedNotification($event->order));
    }
}

// Регистрация в EventServiceProvider
protected $listen = [
    OrderShipped::class => [
        SendShippingSms::class,
    ],
];
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
