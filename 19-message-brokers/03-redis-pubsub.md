# 17.3 Redis Pub/Sub

## Краткое резюме

> **Redis Pub/Sub** — fire-and-forget система для real-time сообщений. Publisher отправляет в channel, все online subscribers получают мгновенно.
>
> **Особенность:** Нет гарантий доставки и persistence. Если subscriber offline — сообщение теряется.
>
> **Use cases:** Real-time notifications, WebSockets, chat, live updates, cache invalidation.

---

## Содержание

- [Что это](#что-это)
- [Основы](#основы)
- [PHP пример](#php-пример)
- [Laravel Broadcasting](#laravel-broadcasting)
- [Private Channels](#private-channels)
- [Presence Channels](#presence-channels)
- [Laravel Reverb](#laravel-reverb-новое-в-laravel-11)
- [Практические примеры](#практические-примеры)
- [Ограничения Redis Pub/Sub](#ограничения-redis-pubsub)
- [Redis Pub/Sub vs Streams](#redis-pubsub-vs-streams)
- [Monitoring](#monitoring)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Redis Pub/Sub:**
Простая система publish/subscribe для real-time сообщений через Redis.

**Зачем:**
- Real-time уведомления
- Broadcasting событий
- WebSocket backend
- Простая альтернатива RabbitMQ/Kafka для simple cases

**Отличие от Queue:**
```
Queue (Redis List):
- Сообщение удаляется после получения
- Гарантия доставки
- Persistence

Pub/Sub:
- Fire and forget (нет гарантии доставки)
- Subscribers получают только если online
- Нет persistence
```

---

## Основы

**Компоненты:**

```
Publisher → Channel → Subscriber 1
                    → Subscriber 2
                    → Subscriber 3
```

**Команды:**

```bash
# Publisher
PUBLISH channel "message"

# Subscriber
SUBSCRIBE channel

# Pattern subscription
PSUBSCRIBE news.*  # Подписка на news.sport, news.tech, etc.
```

---

## PHP пример

**Publisher:**

```php
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

// Publish сообщение в channel
$redis->publish('notifications', json_encode([
    'type' => 'new_message',
    'user_id' => 123,
    'message' => 'Hello!'
]));

// Возвращает количество подписчиков которые получили
```

**Subscriber:**

```php
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

// Подписаться на channel
$redis->subscribe(['notifications'], function ($redis, $channel, $message) {
    echo "Channel: $channel\n";
    echo "Message: $message\n";

    $data = json_decode($message, true);

    // Обработка...
});

// Блокирует выполнение и слушает
```

**Pattern Subscribe:**

```php
$redis->psubscribe(['user.*'], function ($redis, $pattern, $channel, $message) {
    // Получит сообщения из:
    // user.123, user.456, user.created, etc.

    echo "Pattern: $pattern\n";
    echo "Channel: $channel\n";
    echo "Message: $message\n";
});
```

---

## Laravel Broadcasting

**config/broadcasting.php:**

```php
'connections' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
    ],
],
```

**.env:**

```env
BROADCAST_DRIVER=redis
```

**Event:**

```php
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class NewMessage implements ShouldBroadcast
{
    public function __construct(
        public string $message,
        public int $userId
    ) {}

    public function broadcastOn()
    {
        return new Channel('notifications');
    }

    public function broadcastAs()
    {
        return 'new.message';
    }

    public function broadcastWith()
    {
        return [
            'message' => $this->message,
            'user_id' => $this->userId,
        ];
    }
}

// Trigger
event(new NewMessage('Hello!', 123));
```

**Frontend (Laravel Echo):**

```javascript
import Echo from 'laravel-echo';
import io from 'socket.io-client';

window.Echo = new Echo({
    broadcaster: 'socket.io',
    host: window.location.hostname + ':6001'
});

// Подписаться на channel
Echo.channel('notifications')
    .listen('.new.message', (e) => {
        console.log('New message:', e);
    });
```

---

## Private Channels

**Event:**

```php
class NewMessage implements ShouldBroadcast
{
    public function broadcastOn()
    {
        // Private channel для конкретного пользователя
        return new PrivateChannel('user.' . $this->userId);
    }
}
```

**routes/channels.php:**

```php
// Авторизация для private channels
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
```

**Frontend:**

```javascript
// Private channel требует auth
Echo.private('user.123')
    .listen('.new.message', (e) => {
        console.log(e);
    });
```

---

## Presence Channels

**Для "who's online":**

**Event:**

```php
class UserTyping implements ShouldBroadcast
{
    public function broadcastOn()
    {
        return new PresenceChannel('chat.' . $this->chatId);
    }
}
```

**Frontend:**

```javascript
Echo.join('chat.1')
    .here((users) => {
        // Список users online сейчас
        console.log('Online:', users);
    })
    .joining((user) => {
        // User зашёл
        console.log('Joining:', user);
    })
    .leaving((user) => {
        // User вышел
        console.log('Leaving:', user);
    })
    .listen('.user.typing', (e) => {
        console.log('User typing:', e.user);
    });
```

---

## Laravel Reverb (новое в Laravel 11)

**Что это:**
Официальный WebSocket server для Laravel (альтернатива Pusher, Socket.io).

**Установка:**

```bash
php artisan install:broadcasting
```

**Запуск:**

```bash
php artisan reverb:start
```

**Конфигурация:**

```env
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=my-app
REVERB_APP_KEY=local-key
REVERB_APP_SECRET=local-secret
REVERB_HOST=localhost
REVERB_PORT=8080
```

**Frontend:**

```javascript
window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT,
});
```

---

## Практические примеры

### 1. Real-time Notifications

**Backend:**

```php
// Когда user получает notification
class NotificationSent
{
    public function handle(DatabaseNotification $notification)
    {
        broadcast(new NewNotification($notification));
    }
}

class NewNotification implements ShouldBroadcast
{
    public function __construct(
        public DatabaseNotification $notification
    ) {}

    public function broadcastOn()
    {
        return new PrivateChannel('user.' . $this->notification->notifiable_id);
    }
}
```

**Frontend:**

```javascript
Echo.private(`user.${userId}`)
    .notification((notification) => {
        // Показать toast
        toastr.success(notification.message);

        // Обновить badge
        updateNotificationBadge();
    });
```

---

### 2. Chat Application

**Backend:**

```php
class MessageSent implements ShouldBroadcast
{
    public function __construct(
        public Message $message
    ) {}

    public function broadcastOn()
    {
        return new PresenceChannel('chat.' . $this->message->chat_id);
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->message->id,
            'user' => $this->message->user->only(['id', 'name', 'avatar']),
            'text' => $this->message->text,
            'created_at' => $this->message->created_at->toIso8601String(),
        ];
    }
}

// Отправка сообщения
public function sendMessage(Request $request, Chat $chat)
{
    $message = $chat->messages()->create([
        'user_id' => auth()->id(),
        'text' => $request->text,
    ]);

    broadcast(new MessageSent($message))->toOthers();  // Не отправлять себе

    return response()->json($message);
}
```

**Frontend:**

```javascript
// Join chat
Echo.join(`chat.${chatId}`)
    .here((users) => {
        renderOnlineUsers(users);
    })
    .joining((user) => {
        addOnlineUser(user);
    })
    .leaving((user) => {
        removeOnlineUser(user);
    })
    .listen('MessageSent', (e) => {
        appendMessage(e.message);
    });

// Отправить сообщение
function sendMessage(text) {
    axios.post(`/chats/${chatId}/messages`, { text })
        .then(response => {
            // Добавить своё сообщение локально
            appendMessage(response.data);
        });
}
```

---

### 3. Live Dashboard Updates

**Backend:**

```php
// Каждую минуту
class UpdateDashboardMetrics
{
    public function handle()
    {
        $metrics = [
            'users_online' => Cache::get('users:online:count'),
            'revenue_today' => Order::whereDate('created_at', today())->sum('total'),
            'orders_today' => Order::whereDate('created_at', today())->count(),
        ];

        broadcast(new DashboardMetricsUpdated($metrics));
    }
}
```

**Frontend:**

```javascript
Echo.channel('dashboard')
    .listen('DashboardMetricsUpdated', (e) => {
        document.getElementById('users-online').textContent = e.users_online;
        document.getElementById('revenue').textContent = e.revenue_today;
        document.getElementById('orders').textContent = e.orders_today;
    });
```

---

## Ограничения Redis Pub/Sub

**❌ Что НЕ может:**

```
1. Нет гарантии доставки
   - Если subscriber offline → сообщение потеряно

2. Нет persistence
   - Сообщения не сохраняются

3. Нет replay
   - Нельзя прочитать старые сообщения

4. At-most-once delivery
   - Сообщение может быть потеряно, но не дублировано
```

**✅ Когда использовать:**

```
- Real-time notifications (можно потерять)
- Live updates (dashboard, chat)
- Pub/Sub внутри одного приложения
- Простые use cases без strict guarantees
```

**❌ Когда НЕ использовать:**

```
- Критичные сообщения (billing, orders)
- Нужна гарантия доставки
- Нужен replay событий
- Высокая нагрузка (> 10k msg/sec)
```

---

## Redis Pub/Sub vs Streams

**Redis Streams (альтернатива):**

```redis
# Streams = persistent pub/sub
XADD mystream * field1 value1 field2 value2

# Consumer groups
XREADGROUP GROUP mygroup consumer1 STREAMS mystream >
```

**Преимущества Streams:**
- ✅ Persistence (сообщения сохраняются)
- ✅ Consumer groups
- ✅ Acknowledgments
- ✅ Replay старых сообщений

**Используй Streams когда:**
- Нужна гарантия доставки
- Consumer может быть offline
- Нужен replay

---

## Monitoring

**Redis CLI:**

```bash
# Список channels
PUBSUB CHANNELS

# Количество subscribers на channel
PUBSUB NUMSUB channel_name

# Количество pattern subscriptions
PUBSUB NUMPAT
```

**Laravel Horizon:**
```bash
composer require laravel/horizon
php artisan horizon:install

# http://localhost/horizon
# Показывает broadcasting events
```

---

## На собеседовании скажешь

> "Redis Pub/Sub — простая система real-time сообщений. Publisher отправляет в channel, subscribers получают если online. Fire-and-forget: нет гарантии доставки, нет persistence. Laravel Broadcasting: events с ShouldBroadcast, private/presence channels. Laravel Echo на frontend. Laravel Reverb — официальный WebSocket server. Use cases: notifications, chat, live dashboard. Ограничения: at-most-once, нет replay. Redis Streams для persistence и guarantees. Мониторинг через PUBSUB команды и Horizon."

---

## Практические задания

### Задание 1: Real-time уведомления с Broadcasting

Создай систему real-time уведомлений для пользователей через Laravel Broadcasting и Redis.

<details>
<summary>Решение</summary>

```php
// app/Events/NewNotification.php
namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewNotification implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Notification $notification
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('user.' . $this->notification->user_id);
    }

    public function broadcastAs(): string
    {
        return 'notification.new';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->notification->id,
            'type' => $this->notification->type,
            'message' => $this->notification->message,
            'created_at' => $this->notification->created_at->toIso8601String(),
        ];
    }
}

// routes/channels.php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// config/broadcasting.php
'connections' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
    ],
],

// .env
BROADCAST_DRIVER=redis

// app/Http/Controllers/NotificationController.php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Notification;
use App\Events\NewNotification;

class NotificationController extends Controller
{
    public function send(User $user, array $data)
    {
        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => $data['type'],
            'message' => $data['message'],
        ]);

        // Broadcast в real-time
        broadcast(new NewNotification($notification));

        return response()->json($notification);
    }
}

// resources/js/notifications.js
import Echo from 'laravel-echo';
import io from 'socket.io-client';

window.Echo = new Echo({
    broadcaster: 'socket.io',
    host: window.location.hostname + ':6001'
});

// Подписаться на private channel
Echo.private(`user.${userId}`)
    .listen('.notification.new', (e) => {
        // Показать toast notification
        showToast(e.message, e.type);

        // Обновить счётчик
        updateNotificationBadge();

        // Добавить в список
        addNotificationToList(e);
    });

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    const count = parseInt(badge.textContent) + 1;
    badge.textContent = count;
    badge.style.display = 'block';
}
```
</details>

### Задание 2: Live Chat с Presence Channel

Реализуй систему чата с отображением онлайн пользователей и индикатором печати.

<details>
<summary>Решение</summary>

```php
// app/Events/MessageSent.php
namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public Message $message
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel('chat.' . $this->message->chat_id);
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'user' => [
                'id' => $this->message->user->id,
                'name' => $this->message->user->name,
                'avatar' => $this->message->user->avatar_url,
            ],
            'text' => $this->message->text,
            'created_at' => $this->message->created_at->diffForHumans(),
        ];
    }
}

// app/Events/UserTyping.php
class UserTyping implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public int $chatId,
        public int $userId,
        public string $userName
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel('chat.' . $this->chatId);
    }

    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->userId,
            'user_name' => $this->userName,
        ];
    }
}

// routes/channels.php
Broadcast::channel('chat.{chatId}', function ($user, $chatId) {
    // Проверить что пользователь участник чата
    return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar_url,
    ];
});

// app/Http/Controllers/ChatController.php
namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Events\MessageSent;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function sendMessage(Request $request, Chat $chat)
    {
        $request->validate([
            'text' => 'required|string|max:1000',
        ]);

        $message = Message::create([
            'chat_id' => $chat->id,
            'user_id' => auth()->id(),
            'text' => $request->text,
        ]);

        // Broadcast только другим пользователям
        broadcast(new MessageSent($message))->toOthers();

        return response()->json($message);
    }

    public function typing(Request $request, Chat $chat)
    {
        broadcast(new UserTyping(
            $chat->id,
            auth()->id(),
            auth()->user()->name
        ))->toOthers();

        return response()->json(['status' => 'ok']);
    }
}

// resources/js/chat.js
const chatId = 1;
const currentUserId = window.userId;

// Подключиться к Presence Channel
Echo.join(`chat.${chatId}`)
    .here((users) => {
        // Пользователи онлайн сейчас
        renderOnlineUsers(users);
    })
    .joining((user) => {
        // Пользователь зашёл
        addOnlineUser(user);
        showSystemMessage(`${user.name} joined the chat`);
    })
    .leaving((user) => {
        // Пользователь вышел
        removeOnlineUser(user);
        showSystemMessage(`${user.name} left the chat`);
    })
    .listen('MessageSent', (e) => {
        // Новое сообщение
        appendMessage(e);
    })
    .listenForWhisper('typing', (e) => {
        // Кто-то печатает
        showTypingIndicator(e.user_name);
    });

// Отправка сообщения
document.getElementById('send-btn').addEventListener('click', () => {
    const text = document.getElementById('message-input').value;

    axios.post(`/chats/${chatId}/messages`, { text })
        .then(response => {
            // Добавить своё сообщение
            appendMessage({
                ...response.data,
                user: {
                    id: currentUserId,
                    name: 'You',
                }
            });

            document.getElementById('message-input').value = '';
        });
});

// Индикатор печати
let typingTimeout;
document.getElementById('message-input').addEventListener('input', () => {
    clearTimeout(typingTimeout);

    // Whisper событие (client-to-client через Redis)
    Echo.join(`chat.${chatId}`)
        .whisper('typing', {
            user_name: window.userName,
        });

    typingTimeout = setTimeout(() => {
        hideTypingIndicator();
    }, 2000);
});

function renderOnlineUsers(users) {
    const list = document.getElementById('online-users');
    list.innerHTML = users.map(user => `
        <div class="user-online">
            <img src="${user.avatar}" alt="${user.name}">
            <span>${user.name}</span>
            <span class="status-dot"></span>
        </div>
    `).join('');
}

function showTypingIndicator(userName) {
    const indicator = document.getElementById('typing-indicator');
    indicator.textContent = `${userName} is typing...`;
    indicator.style.display = 'block';
}

function hideTypingIndicator() {
    document.getElementById('typing-indicator').style.display = 'none';
}

function appendMessage(message) {
    const messageHtml = `
        <div class="message ${message.user.id === currentUserId ? 'own' : ''}">
            <img src="${message.user.avatar}" class="avatar">
            <div class="content">
                <div class="header">
                    <span class="name">${message.user.name}</span>
                    <span class="time">${message.created_at}</span>
                </div>
                <div class="text">${message.text}</div>
            </div>
        </div>
    `;

    document.getElementById('messages').insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
}
```
</details>

### Задание 3: Live Dashboard с метриками

Создай live dashboard который обновляет метрики в реальном времени через Broadcasting.

<details>
<summary>Решение</summary>

```php
// app/Events/MetricsUpdated.php
namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MetricsUpdated implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public array $metrics
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('dashboard');
    }

    public function broadcastWith(): array
    {
        return $this->metrics;
    }
}

// app/Console/Commands/UpdateDashboardMetrics.php
namespace App\Console\Commands;

use App\Events\MetricsUpdated;
use App\Models\Order;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class UpdateDashboardMetrics extends Command
{
    protected $signature = 'dashboard:update-metrics';

    public function handle()
    {
        $metrics = [
            'users_online' => $this->getUsersOnline(),
            'revenue_today' => $this->getRevenueToday(),
            'revenue_this_month' => $this->getRevenueThisMonth(),
            'orders_today' => $this->getOrdersToday(),
            'orders_pending' => $this->getOrdersPending(),
            'new_users_today' => $this->getNewUsersToday(),
            'conversion_rate' => $this->getConversionRate(),
        ];

        // Broadcast метрики
        broadcast(new MetricsUpdated($metrics));

        $this->info('Metrics updated and broadcasted');
    }

    private function getUsersOnline(): int
    {
        return Cache::get('users:online:count', 0);
    }

    private function getRevenueToday(): float
    {
        return Order::whereDate('created_at', today())
            ->where('status', 'paid')
            ->sum('total');
    }

    private function getRevenueThisMonth(): float
    {
        return Order::whereMonth('created_at', now()->month)
            ->where('status', 'paid')
            ->sum('total');
    }

    private function getOrdersToday(): int
    {
        return Order::whereDate('created_at', today())->count();
    }

    private function getOrdersPending(): int
    {
        return Order::where('status', 'pending')->count();
    }

    private function getNewUsersToday(): int
    {
        return User::whereDate('created_at', today())->count();
    }

    private function getConversionRate(): float
    {
        $visitors = Cache::get('visitors:today', 1);
        $orders = $this->getOrdersToday();

        return round(($orders / $visitors) * 100, 2);
    }
}

// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    // Обновлять метрики каждую минуту
    $schedule->command('dashboard:update-metrics')->everyMinute();
}

// routes/channels.php
Broadcast::channel('dashboard', function ($user) {
    // Только админы могут подписаться
    return $user->isAdmin();
});

// resources/views/dashboard.blade.php
<!DOCTYPE html>
<html>
<head>
    <title>Live Dashboard</title>
    <script src="{{ mix('js/app.js') }}"></script>
</head>
<body>
    <div class="dashboard">
        <div class="metric-card">
            <h3>Users Online</h3>
            <div class="value" id="users-online">0</div>
        </div>

        <div class="metric-card">
            <h3>Revenue Today</h3>
            <div class="value" id="revenue-today">$0</div>
        </div>

        <div class="metric-card">
            <h3>Revenue This Month</h3>
            <div class="value" id="revenue-month">$0</div>
        </div>

        <div class="metric-card">
            <h3>Orders Today</h3>
            <div class="value" id="orders-today">0</div>
        </div>

        <div class="metric-card">
            <h3>Pending Orders</h3>
            <div class="value" id="orders-pending">0</div>
        </div>

        <div class="metric-card">
            <h3>New Users Today</h3>
            <div class="value" id="new-users">0</div>
        </div>

        <div class="metric-card">
            <h3>Conversion Rate</h3>
            <div class="value" id="conversion-rate">0%</div>
        </div>
    </div>

    <script>
        Echo.channel('dashboard')
            .listen('MetricsUpdated', (e) => {
                updateMetrics(e);
            });

        function updateMetrics(metrics) {
            animateValue('users-online', metrics.users_online);
            animateValue('revenue-today', '$' + formatNumber(metrics.revenue_today));
            animateValue('revenue-month', '$' + formatNumber(metrics.revenue_this_month));
            animateValue('orders-today', metrics.orders_today);
            animateValue('orders-pending', metrics.orders_pending);
            animateValue('new-users', metrics.new_users_today);
            animateValue('conversion-rate', metrics.conversion_rate + '%');
        }

        function animateValue(elementId, newValue) {
            const element = document.getElementById(elementId);
            element.classList.add('updated');
            element.textContent = newValue;

            setTimeout(() => {
                element.classList.remove('updated');
            }, 500);
        }

        function formatNumber(num) {
            return num.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // Загрузить начальные метрики
        axios.get('/api/dashboard/metrics')
            .then(response => updateMetrics(response.data));
    </script>
</body>
</html>
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

