# 5.6 Notifications

## Краткое резюме

> **Notifications** — единая система отправки уведомлений через разные каналы (mail, database, SMS, Slack, broadcast).
>
> **Создание:** `make:notification OrderShipped`. Метод `via()` определяет каналы, `toMail()`/`toArray()` — формат.
>
> **Отправка:** `$user->notify(new Notification())`. Database канал сохраняет в БД, `markAsRead()` отмечает прочитанным. `ShouldQueue` для асинхронности.

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
Notifications — система отправки уведомлений через разные каналы (email, SMS, Slack, database). Единый интерфейс для всех типов уведомлений.

**Каналы:**
- Mail (email)
- Database (в БД)
- Broadcast (WebSockets)
- SMS (Vonage/Twilio)
- Slack

---

## Как работает

**Создание Notification:**

```bash
php artisan make:notification OrderShipped
```

```php
namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderShipped extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Order $order)
    {
    }

    // Каналы доставки
    public function via(object $notifiable): array
    {
        // Отправить через email и database
        return ['mail', 'database'];
    }

    // Email уведомление
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Order Shipped')
            ->greeting("Hello {$notifiable->name}!")
            ->line("Your order #{$this->order->id} has been shipped.")
            ->action('View Order', url("/orders/{$this->order->id}"))
            ->line('Thank you for your purchase!');
    }

    // Database уведомление
    public function toArray(object $notifiable): array
    {
        return [
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'message' => "Your order #{$this->order->number} has been shipped.",
        ];
    }
}
```

**Отправка уведомлений:**

```php
use App\Notifications\OrderShipped;

// Отправить одному пользователю
$user = User::find(1);
$user->notify(new OrderShipped($order));

// Отправить нескольким
Notification::send($users, new OrderShipped($order));

// Отправить анонимному (без модели User)
Notification::route('mail', 'guest@example.com')
    ->notify(new OrderShipped($order));
```

**Notifiable trait в модели:**

```php
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    // Кастомный email для уведомлений
    public function routeNotificationForMail(): string
    {
        return $this->notification_email ?: $this->email;
    }

    // Кастомный телефон для SMS
    public function routeNotificationForVonage(): string
    {
        return $this->phone;
    }

    // Кастомный Slack webhook
    public function routeNotificationForSlack(): string
    {
        return $this->slack_webhook_url;
    }
}
```

---

## Когда использовать

**Используй Notifications когда:**
- Нужно отправлять через несколько каналов
- Уведомления пользователям (заказы, комментарии, etc.)
- Нужна очередь (ShouldQueue)
- Нужна история уведомлений (database канал)

**Не используй когда:**
- Простая отправка email (используй Mailable напрямую)
- Системные логи (используй Log)

---

## Пример из практики

**Комплексное уведомление с выбором канала:**

```php
namespace App\Notifications;

use App\Models\Order;
use Illuminate\Notifications\Messages\{MailMessage, SlackMessage};
use Illuminate\Notifications\Notification;

class OrderCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Order $order)
    {
    }

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        // Email для пользователей
        if ($notifiable->email_notifications_enabled) {
            $channels[] = 'mail';
        }

        // SMS для премиум пользователей
        if ($notifiable->isPremium()) {
            $channels[] = 'vonage';
        }

        // Slack для админов
        if ($notifiable->isAdmin()) {
            $channels[] = 'slack';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New Order #' . $this->order->number)
            ->greeting("Hello {$notifiable->name}!")
            ->line("Your order #{$this->order->number} has been created.")
            ->line("Total: ${$this->order->total}")
            ->action('View Order', route('orders.show', $this->order))
            ->line('Thank you for your order!');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'order_id' => $this->order->id,
            'order_number' => $this->order->number,
            'total' => $this->order->total,
            'message' => "Order #{$this->order->number} created.",
        ];
    }

    public function toVonage(object $notifiable): array
    {
        return [
            'content' => "Your order #{$this->order->number} has been created. Total: ${$this->order->total}",
        ];
    }

    public function toSlack(object $notifiable): SlackMessage
    {
        return (new SlackMessage)
            ->from('Order Bot', ':package:')
            ->to('#orders')
            ->content("New order #{$this->order->number}")
            ->attachment(function ($attachment) {
                $attachment->title('Order Details')
                    ->fields([
                        'Order' => $this->order->number,
                        'Customer' => $this->order->user->name,
                        'Total' => '$' . $this->order->total,
                    ])
                    ->action('View Order', route('admin.orders.show', $this->order));
            });
    }
}
```

**Database Notifications (хранение в БД):**

```bash
# Создать таблицу
php artisan notifications:table
php artisan migrate
```

```php
// Получить уведомления пользователя
$notifications = $user->notifications;  // Все
$unread = $user->unreadNotifications;  // Непрочитанные

// Отметить как прочитанное
$notification = $user->notifications()->first();
$notification->markAsRead();

// Отметить все как прочитанные
$user->unreadNotifications->markAsRead();

// Удалить уведомление
$notification->delete();

// Фильтрация
$orderNotifications = $user->notifications()
    ->where('type', OrderShipped::class)
    ->get();
```

**API для уведомлений:**

```php
// Controller
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->notifications()
            ->paginate(20);
    }

    public function unread(Request $request)
    {
        return $request->user()
            ->unreadNotifications()
            ->get();
    }

    public function markAsRead(Request $request, string $id)
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->noContent();
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()
            ->unreadNotifications()
            ->markAsRead();

        return response()->noContent();
    }

    public function destroy(Request $request, string $id)
    {
        $request->user()
            ->notifications()
            ->findOrFail($id)
            ->delete();

        return response()->noContent();
    }
}
```

**On-Demand Notifications (без модели):**

```php
use Illuminate\Support\Facades\Notification;

// Отправить гостю
Notification::route('mail', 'guest@example.com')
    ->route('vonage', '+79001234567')
    ->notify(new InvoicePaid($invoice));

// Отправить нескольким каналам
Notification::route('mail', [
    'support@example.com',
    'admin@example.com',
])->notify(new ErrorOccurred($error));
```

**Custom Notification Channel:**

```bash
php artisan make:notification-channel TelegramChannel
```

```php
namespace App\Channels;

use Illuminate\Notifications\Notification;

class TelegramChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        // Получить Telegram chat ID
        $chatId = $notifiable->routeNotificationFor('telegram');

        if (!$chatId) {
            return;
        }

        // Получить данные из notification
        $message = $notification->toTelegram($notifiable);

        // Отправить в Telegram
        Http::post("https://api.telegram.org/bot{$this->token}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $message,
        ]);
    }
}

// Notification
public function via(object $notifiable): array
{
    return [TelegramChannel::class];
}

public function toTelegram(object $notifiable): string
{
    return "Order #{$this->order->number} created!";
}

// User model
public function routeNotificationForTelegram(): string
{
    return $this->telegram_chat_id;
}
```

**Conditional Notifications:**

```php
class OrderShipped extends Notification
{
    public function via(object $notifiable): array
    {
        $channels = [];

        // Email только если включены уведомления
        if ($notifiable->notify_via_email) {
            $channels[] = 'mail';
        }

        // SMS только для премиум
        if ($notifiable->isPremium() && $notifiable->phone) {
            $channels[] = 'vonage';
        }

        // Всегда в database
        $channels[] = 'database';

        return $channels;
    }
}
```

**Broadcast Notifications (real-time):**

```php
use Illuminate\Notifications\Messages\BroadcastMessage;

class NewMessage extends Notification
{
    public function via(object $notifiable): array
    {
        return ['broadcast', 'database'];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'message' => $this->message,
            'user' => $this->user->name,
        ]);
    }

    // Канал для broadcast
    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->notifiable->id}")];
    }
}

// Frontend (Laravel Echo)
Echo.private(`user.${userId}`)
    .notification((notification) => {
        console.log(notification);
        // Показать уведомление
    });
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Notifications — система для отправки уведомлений через разные каналы
- Единый интерфейс для mail, database, SMS, Slack, broadcast
- Создание: `php artisan make:notification OrderShipped`

**Структура:**
```php
via()      // Определяет каналы ['mail', 'database']
toMail()   // Формат для email
toArray()  // Формат для database/broadcast
```

**Отправка:**
```php
$user->notify(new OrderShipped($order));           // Одному
Notification::send($users, new OrderShipped());    // Нескольким
Notification::route('mail', 'email@example.com')   // Без модели
    ->notify(new OrderShipped());
```

**Database Notifications:**
- Таблица: `notifications:table` + `migrate`
- Получение: `$user->notifications`, `$user->unreadNotifications`
- Прочитано: `$notification->markAsRead()`

**Продвинутое:**
- **ShouldQueue** — асинхронная отправка
- **Custom channels** — свои каналы (Telegram, etc.)
- **Broadcast** — real-time через WebSockets
- **Conditional** — выбор канала по условию

---

## Практические задания

### Задание 1: Notification с выбором канала

Создай `CommentPostedNotification`. Если у пользователя включены email-уведомления — отправь email, если нет — только в database. Премиум пользователям дополнительно в SMS.

<details>
<summary>Решение</summary>

```php
namespace App\Notifications;

use App\Models\Comment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CommentPostedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Comment $comment)
    {
    }

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        // Email если включены уведомления
        if ($notifiable->email_notifications_enabled) {
            $channels[] = 'mail';
        }

        // SMS для премиум
        if ($notifiable->isPremium() && $notifiable->phone) {
            $channels[] = 'vonage';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New comment on your post')
            ->greeting("Hello {$notifiable->name}!")
            ->line("{$this->comment->user->name} commented on your post:")
            ->line("\"{$this->comment->body}\"")
            ->action('View Comment', route('posts.show', $this->comment->post_id))
            ->line('Thank you for using our application!');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'comment_id' => $this->comment->id,
            'post_id' => $this->comment->post_id,
            'author' => $this->comment->user->name,
            'body' => $this->comment->body,
            'message' => "{$this->comment->user->name} commented on your post",
        ];
    }

    public function toVonage(object $notifiable): array
    {
        return [
            'content' => "New comment from {$this->comment->user->name}",
        ];
    }
}

// Отправка
$post->user->notify(new CommentPostedNotification($comment));
```
</details>

### Задание 2: Database Notifications API

Создай API endpoint для получения уведомлений: список всех, только непрочитанных, отметка как прочитанного, удаление.

<details>
<summary>Решение</summary>

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
});

// app/Http/Controllers/NotificationController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = $request->user()
            ->notifications()
            ->paginate(20);

        return response()->json($notifications);
    }

    public function unread(Request $request)
    {
        $notifications = $request->user()
            ->unreadNotifications()
            ->get();

        return response()->json([
            'count' => $notifications->count(),
            'data' => $notifications,
        ]);
    }

    public function markAsRead(Request $request, string $id)
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read',
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()
            ->unreadNotifications()
            ->markAsRead();

        return response()->json([
            'message' => 'All notifications marked as read',
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $request->user()
            ->notifications()
            ->findOrFail($id)
            ->delete();

        return response()->noContent();
    }
}
```
</details>

### Задание 3: Custom Notification Channel (Telegram)

Создай кастомный канал для отправки уведомлений в Telegram.

<details>
<summary>Решение</summary>

```php
// app/Channels/TelegramChannel.php
namespace App\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;

class TelegramChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        // Получить chat_id пользователя
        $chatId = $notifiable->routeNotificationFor('telegram', $notification);

        if (!$chatId) {
            return;
        }

        // Получить сообщение из notification
        $message = $notification->toTelegram($notifiable);

        // Отправить в Telegram API
        Http::post("https://api.telegram.org/bot" . config('services.telegram.bot_token') . "/sendMessage", [
            'chat_id' => $chatId,
            'text' => $message,
            'parse_mode' => 'HTML',
        ]);
    }
}

// app/Notifications/OrderShipped.php
namespace App\Notifications;

use App\Channels\TelegramChannel;
use Illuminate\Notifications\Notification;

class OrderShipped extends Notification
{
    public function __construct(public Order $order)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail', 'database', TelegramChannel::class];
    }

    public function toTelegram(object $notifiable): string
    {
        return "<b>Order Shipped</b>\n\n" .
               "Your order #{$this->order->number} has been shipped!\n" .
               "Track: {$this->order->tracking_number}";
    }

    // ... toMail(), toArray()
}

// app/Models/User.php
public function routeNotificationForTelegram(): ?string
{
    return $this->telegram_chat_id;
}

// config/services.php
'telegram' => [
    'bot_token' => env('TELEGRAM_BOT_TOKEN'),
],

// Использование
$user->notify(new OrderShipped($order));
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
