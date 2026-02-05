# 17.4 Сравнение Message Brokers

## Краткое резюме

> **RabbitMQ** — message broker для task queues с гибкой маршрутизацией. **Kafka** — event streaming platform для high throughput. **Redis Pub/Sub** — fire-and-forget для real-time.
>
> **Выбор:** RabbitMQ для background jobs, Kafka для event sourcing и logs, Redis для WebSockets и notifications.
>
> **Delivery:** Redis at-most-once, RabbitMQ/Kafka at-least-once, Kafka exactly-once.

---

## Содержание

- [Краткое сравнение](#краткое-сравнение)
- [RabbitMQ](#rabbitmq)
- [Kafka](#kafka)
- [Redis Pub/Sub](#redis-pubsub)
- [Delivery Guarantees](#delivery-guarantees)
- [Performance](#performance)
- [Message Ordering](#message-ordering)
- [Scaling](#scaling)
- [Use Cases](#use-cases)
- [Комбинирование](#комбинирование)
- [Migration Path](#migration-path)
- [Decision Tree](#decision-tree)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Краткое сравнение

| Критерий | RabbitMQ | Kafka | Redis Pub/Sub |
|----------|----------|-------|---------------|
| **Тип** | Message Broker | Event Streaming | Pub/Sub |
| **Гарантии доставки** | At-least-once, Exactly-once | At-least-once | At-most-once (fire-and-forget) |
| **Хранение** | В очереди до ACK | На диске (retention) | Не хранит |
| **Скорость** | ~20k msg/s | ~1M msg/s | ~1M msg/s |
| **Consumers** | Competing | Consumer Groups | Все subscribers |
| **Сложность** | Средняя | Высокая | Низкая |
| **Use case** | Task queues, RPC | Event streaming, logs | Real-time, notifications |

---

## RabbitMQ

**Архитектура: Message Broker**

```
Producer → Exchange → Queue → Consumer(s)
```

**Strengths:**
- ✅ Flexible routing (direct, topic, fanout, headers)
- ✅ Dead Letter Exchange (DLX)
- ✅ Priority queues
- ✅ Retry logic
- ✅ Message TTL
- ✅ At-least-once, Exactly-once delivery

**Weaknesses:**
- ❌ Не для high-throughput (slower than Kafka)
- ❌ Не для event streaming
- ❌ Сложнее масштабировать

**Когда использовать:**
- Task queues (email, image processing)
- RPC (request-reply)
- Сложная маршрутизация
- Background jobs

**Laravel:**

```php
// config/queue.php
'rabbitmq' => [
    'driver' => 'rabbitmq',
    'queue' => 'default',
    'connection' => 'default',
],

// Job
SendEmailJob::dispatch($user)->onQueue('emails');
```

---

## Kafka

**Архитектура: Event Streaming Platform**

```
Producer → Topic (Partitions) → Consumer Group → Consumer(s)
```

**Strengths:**
- ✅ High throughput (millions msg/s)
- ✅ Хранение на диске (retention 7 days+)
- ✅ Replay events (offset control)
- ✅ Event sourcing
- ✅ Horizontal scaling (partitions)
- ✅ Exactly-once semantics

**Weaknesses:**
- ❌ Сложная настройка
- ❌ Overkill для simple tasks
- ❌ Нет routing (только topics)
- ❌ Больше ресурсов (JVM)

**Когда использовать:**
- Event streaming
- Logs aggregation
- CDC (Change Data Capture)
- Real-time analytics
- Event sourcing

**Laravel:**

```php
// Publish event
event(new OrderCreated($order));

// Consume event
class OrderCreatedListener
{
    public function handle(OrderCreated $event)
    {
        // Process event
    }
}
```

---

## Redis Pub/Sub

**Архитектура: Fire-and-Forget Pub/Sub**

```
Publisher → Channel → All Subscribers
```

**Strengths:**
- ✅ Очень быстрый (in-memory)
- ✅ Простой API
- ✅ Real-time (low latency)
- ✅ Встроен в Redis (уже используется для кэша)

**Weaknesses:**
- ❌ Fire-and-forget (нет гарантий)
- ❌ Не хранит messages
- ❌ Нет retry
- ❌ Все subscribers получают все messages

**Когда использовать:**
- Real-time notifications
- WebSockets broadcasting
- Chat
- Live updates
- Cache invalidation

**Laravel:**

```php
// config/broadcasting.php
'redis' => [
    'driver' => 'redis',
    'connection' => 'default',
],

// Broadcast event
event(new MessageSent($message));

// Frontend (Laravel Echo)
Echo.channel('chat')
    .listen('MessageSent', (e) => {
        console.log(e.message);
    });
```

---

## Delivery Guarantees

### At-most-once (Redis Pub/Sub)

```
Publisher → Redis → Subscriber
                 ↓
            может потеряться
```

**Пример:**

```php
// Redis Pub/Sub
Redis::publish('notifications', json_encode($notification));

// Если subscriber offline → message потерян
```

---

### At-least-once (RabbitMQ, Kafka)

```
Publisher → Broker → Consumer
                    ↓
              ACK после обработки
```

**RabbitMQ:**

```php
// Consumer
public function handle()
{
    try {
        $this->process($message);
        $this->ack();  // ACK после успешной обработки
    } catch (Exception $e) {
        $this->nack();  // Не ACK → RabbitMQ переотправит
    }
}
```

**Kafka:**

```php
// Consumer
public function handle()
{
    $this->process($message);
    $this->commit();  // Commit offset после обработки
}
```

---

### Exactly-once (Kafka, RabbitMQ with deduplication)

**Kafka:**

```java
// Producer
props.put("enable.idempotence", "true");

// Consumer
props.put("isolation.level", "read_committed");
```

**RabbitMQ (deduplication):**

```php
class ProcessOrderJob implements ShouldQueue
{
    public function handle()
    {
        $idempotencyKey = "order:{$this->orderId}";

        if (Cache::has($idempotencyKey)) {
            return;  // Уже обработано
        }

        $this->process($this->orderId);

        Cache::put($idempotencyKey, true, 3600);
    }
}
```

---

## Performance

**Throughput (messages/second):**

```
Redis Pub/Sub:   ~1,000,000 msg/s
Kafka:           ~1,000,000 msg/s (with batching)
RabbitMQ:        ~20,000 msg/s (single queue)
```

**Latency:**

```
Redis Pub/Sub:   < 1ms
RabbitMQ:        ~5-10ms
Kafka:           ~10-50ms
```

---

## Message Ordering

**RabbitMQ:**
- Гарантия: в пределах одной queue
- Для параллельных consumers: нет гарантий

**Kafka:**
- Гарантия: в пределах partition
- Key-based partitioning для ordering

**Redis Pub/Sub:**
- Нет гарантий ordering

---

## Scaling

**RabbitMQ:**
- Vertical scaling (более мощный сервер)
- Clustering (limited horizontal scaling)
- Sharding вручную

**Kafka:**
- Horizontal scaling (add partitions)
- Consumer groups (parallel consumption)
- Distributed by design

**Redis Pub/Sub:**
- Vertical scaling
- Redis Cluster (но Pub/Sub не distributed)

---

## Use Cases

### 1. Email Sending (RabbitMQ)

```php
// RabbitMQ идеален для task queues
SendEmailJob::dispatch($user, $email)->onQueue('emails');

// Retry, DLX, Priority
```

**Почему не Kafka:**
- Overkill
- Email не нужен в истории

**Почему не Redis:**
- Email критичен (нужна гарантия доставки)

---

### 2. Event Sourcing (Kafka)

```php
// Kafka идеален для event streaming
event(new OrderCreated($order));
event(new PaymentProcessed($payment));
event(new OrderShipped($order));

// Можно replay events, audit log
```

**Почему не RabbitMQ:**
- Не хранит историю
- Нет replay

**Почему не Redis:**
- Fire-and-forget (нет истории)

---

### 3. Real-time Chat (Redis Pub/Sub)

```php
// Redis идеален для real-time
Redis::publish('chat.room.1', json_encode($message));

// WebSocket broadcasting
```

**Почему не RabbitMQ:**
- Медленнее
- Overkill

**Почему не Kafka:**
- Overkill
- Сложнее

---

### 4. CDC (Change Data Capture) (Kafka)

```php
// Kafka Connect + Debezium
// Слушать изменения в БД и реплицировать в другие сервисы
```

**Почему Kafka:**
- Event streaming
- Retention (можно replay)

---

### 5. Background Jobs (RabbitMQ или Laravel Queues)

```php
ProcessVideoJob::dispatch($video)->onQueue('video');
```

**RabbitMQ:**
- Если нужны Retry, DLX, Priority

**Laravel Database Queue:**
- Для простых случаев

---

## Комбинирование

**Часто используют несколько:**

```php
// RabbitMQ для background jobs
SendEmailJob::dispatch($user);

// Kafka для event streaming
event(new OrderCreated($order));

// Redis Pub/Sub для real-time
Redis::publish('notifications', $notification);
```

---

## Migration Path

**Стартап (простое):**

```
Laravel Database Queue → Redis Queue
```

**Рост (средняя нагрузка):**

```
Redis Queue → RabbitMQ
```

**Large scale (high throughput):**

```
RabbitMQ → Kafka (для event streaming)
RabbitMQ + Kafka (разные use cases)
```

---

## Decision Tree

```
Нужна гарантия доставки?
├─ Да
│  ├─ High throughput (millions msg/s)?
│  │  ├─ Да → Kafka
│  │  └─ Нет → RabbitMQ
│  └─ Event streaming / History?
│     ├─ Да → Kafka
│     └─ Нет → RabbitMQ
└─ Нет
   └─ Real-time / Low latency?
      ├─ Да → Redis Pub/Sub
      └─ Нет → RabbitMQ (safer)
```

---

## На собеседовании скажешь

> "RabbitMQ — message broker для task queues, flexible routing, retry, DLX, at-least-once delivery. Kafka — event streaming platform для high throughput (millions msg/s), retention на диске, replay events, event sourcing. Redis Pub/Sub — fire-and-forget для real-time (WebSockets, chat), in-memory, очень быстрый. RabbitMQ для background jobs, Kafka для event streaming и CDC, Redis для real-time notifications. Delivery guarantees: Redis at-most-once, RabbitMQ/Kafka at-least-once, Kafka exactly-once. Ordering: RabbitMQ в queue, Kafka в partition. Laravel: RabbitMQ для queues, Redis для broadcasting."

---

## Практические задания

### Задание 1: Выбери правильный Message Broker

Для каждого сценария выбери подходящий message broker (RabbitMQ, Kafka или Redis Pub/Sub) и объясни почему.

**Сценарии:**
1. Отправка email уведомлений после оформления заказа
2. Синхронизация данных между микросервисами (CDC)
3. Real-time чат для веб-приложения
4. Обработка миллионов логов в секунду
5. Уведомление пользователей онлайн о новых сообщениях

<details>
<summary>Решение</summary>

**1. Email уведомления — RabbitMQ**

**Почему:**
- Нужна гарантия доставки (at-least-once)
- Retry логика при ошибках
- Dead Letter Exchange для failed jobs
- Не критична высокая пропускная способность
- Background job processing

```php
// app/Jobs/SendOrderConfirmationEmail.php
class SendOrderConfirmationEmail implements ShouldQueue
{
    public $connection = 'rabbitmq';
    public $queue = 'emails';
    public $tries = 3;
    public $backoff = [60, 300, 900];

    public function __construct(public Order $order) {}

    public function handle()
    {
        Mail::to($this->order->user)->send(
            new OrderConfirmation($this->order)
        );
    }
}
```

**2. CDC (Change Data Capture) — Kafka**

**Почему:**
- Нужна история изменений (retention)
- Replay для восстановления состояния
- Высокая пропускная способность
- Event sourcing pattern
- Ordering гарантирован в partition

```php
// Kafka для CDC
class UserObserver
{
    public function created(User $user)
    {
        Kafka::publishOn('user-changes')
            ->withBodyKey('user_id', $user->id)
            ->withMessage([
                'operation' => 'INSERT',
                'data' => $user->toArray(),
            ])
            ->send();
    }
}
```

**3. Real-time чат — Redis Pub/Sub**

**Почему:**
- Очень низкая latency (< 1ms)
- Fire-and-forget подходит для чата
- Простая интеграция с Laravel Broadcasting
- WebSocket backend
- Не критична потеря сообщений (можно загрузить из БД)

```php
// Laravel Broadcasting + Redis
class MessageSent implements ShouldBroadcast
{
    public function broadcastOn()
    {
        return new PresenceChannel('chat.' . $this->chatId);
    }
}
```

**4. Обработка логов — Kafka**

**Почему:**
- High throughput (millions msg/s)
- Retention для анализа
- Consumer groups для параллельной обработки
- Horizontal scaling через partitions
- Stream processing

```php
// Kafka для логов
Kafka::publishOn('application-logs')
    ->withMessage([
        'level' => 'error',
        'message' => $exception->getMessage(),
        'trace' => $exception->getTraceAsString(),
    ])
    ->send();
```

**5. Online уведомления — Redis Pub/Sub**

**Почему:**
- Real-time delivery
- Только online пользователи получают
- Low latency
- Простота
- Offline пользователи получат из БД при входе

```php
// Redis Pub/Sub для notifications
event(new NewNotification($notification));

// Frontend
Echo.private(`user.${userId}`)
    .notification((notification) => {
        showToast(notification.message);
    });
```

**Комбинированный подход (best practice):**

```php
// Email отправка: RabbitMQ
SendEmailJob::dispatch($user)->onQueue('emails');

// Логи и события: Kafka
event(new OrderCreated($order)); // → Kafka

// Real-time notifications: Redis
broadcast(new NewMessage($message)); // → Redis Pub/Sub

// Offline notification: сохранить в БД
$user->notifications()->create([...]);
```
</details>

### Задание 2: Реализуй Idempotency для разных brokers

Создай idempotent обработчики для RabbitMQ, Kafka и Redis чтобы избежать duplicate processing.

<details>
<summary>Решение</summary>

```php
// 1. RabbitMQ с Idempotency Key
namespace App\Jobs;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProcessPaymentJob implements ShouldQueue
{
    public $connection = 'rabbitmq';
    public $tries = 3;

    public function __construct(
        public int $orderId,
        public string $idempotencyKey
    ) {}

    public function handle()
    {
        $lockKey = "payment:{$this->orderId}:{$this->idempotencyKey}";

        // Atomic lock для предотвращения duplicate processing
        $lock = Cache::lock($lockKey, 10);

        if (!$lock->get()) {
            // Уже обрабатывается или обработано
            return;
        }

        try {
            // Проверить что не обработано
            if (Cache::has("payment:processed:{$this->idempotencyKey}")) {
                return;
            }

            // Обработка
            DB::transaction(function () {
                $order = Order::lockForUpdate()->find($this->orderId);

                if ($order->status !== 'pending') {
                    return; // Уже обработан
                }

                // Процессинг платежа
                $payment = PaymentGateway::charge($order->total);

                $order->update([
                    'status' => 'paid',
                    'payment_id' => $payment->id,
                ]);
            });

            // Пометить как обработанное
            Cache::put(
                "payment:processed:{$this->idempotencyKey}",
                true,
                3600
            );

        } finally {
            $lock->release();
        }
    }
}

// Использование
ProcessPaymentJob::dispatch(
    $order->id,
    Str::uuid() // Unique idempotency key
);

// 2. Kafka с Offset Tracking
namespace App\Console\Commands;

use Illuminate\Support\Facades\DB;

class ConsumeKafkaOrders extends Command
{
    public function handle()
    {
        $consumer = Kafka::createConsumer(['orders'])
            ->withConsumerGroupId('order-processor')
            ->withAutoCommit(false)
            ->withHandler(function ($message) {
                $offset = $message->getOffset();
                $partition = $message->getPartition();
                $data = $message->getBody();

                // Проверить что offset не обработан
                $processed = DB::table('kafka_offsets')
                    ->where('topic', 'orders')
                    ->where('partition', $partition)
                    ->where('offset', $offset)
                    ->exists();

                if ($processed) {
                    // Уже обработан
                    $message->getConsumer()->commit($message);
                    return;
                }

                DB::transaction(function () use ($data, $partition, $offset, $message) {
                    // Обработка
                    Order::create($data);

                    // Сохранить offset
                    DB::table('kafka_offsets')->insert([
                        'topic' => 'orders',
                        'partition' => $partition,
                        'offset' => $offset,
                        'processed_at' => now(),
                    ]);

                    // Commit
                    $message->getConsumer()->commit($message);
                });
            })
            ->build();

        $consumer->consume();
    }
}

// 3. Redis Pub/Sub с Message Deduplication
namespace App\Services;

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Cache;

class IdempotentRedisPublisher
{
    public function publish(string $channel, array $data, ?string $messageId = null)
    {
        $messageId = $messageId ?? Str::uuid();

        // Проверить что не опубликовано недавно
        $cacheKey = "redis:published:{$channel}:{$messageId}";

        if (Cache::has($cacheKey)) {
            return false; // Duplicate
        }

        // Publish
        $payload = array_merge($data, [
            'message_id' => $messageId,
            'timestamp' => now()->toIso8601String(),
        ]);

        Redis::publish($channel, json_encode($payload));

        // Пометить как опубликованное (TTL 5 минут)
        Cache::put($cacheKey, true, 300);

        return true;
    }
}

class IdempotentRedisSubscriber
{
    private $processedMessages = [];

    public function subscribe(string $channel, callable $callback)
    {
        Redis::subscribe([$channel], function ($message) use ($callback) {
            $data = json_decode($message, true);
            $messageId = $data['message_id'] ?? null;

            if (!$messageId) {
                return; // Нет message_id
            }

            // Проверить дубликат в памяти (для текущей сессии)
            if (isset($this->processedMessages[$messageId])) {
                return;
            }

            // Проверить в кэше
            $cacheKey = "redis:processed:{$channel}:{$messageId}";

            if (Cache::has($cacheKey)) {
                return; // Уже обработано
            }

            // Обработка
            $callback($data);

            // Пометить как обработанное
            $this->processedMessages[$messageId] = true;
            Cache::put($cacheKey, true, 300);

            // Очистить старые из памяти
            if (count($this->processedMessages) > 1000) {
                $this->processedMessages = array_slice(
                    $this->processedMessages,
                    -500,
                    null,
                    true
                );
            }
        });
    }
}

// Использование
$publisher = new IdempotentRedisPublisher();

$messageId = Str::uuid();
$publisher->publish('notifications', [
    'user_id' => 123,
    'message' => 'Hello',
], $messageId);

// При повторной отправке с тем же messageId - не отправится
$publisher->publish('notifications', [
    'user_id' => 123,
    'message' => 'Hello',
], $messageId); // false

// Subscriber
$subscriber = new IdempotentRedisSubscriber();
$subscriber->subscribe('notifications', function ($data) {
    // Обработка (гарантированно один раз)
    Log::info('Notification', $data);
});
```

**Migration для Kafka offsets:**

```php
Schema::create('kafka_offsets', function (Blueprint $table) {
    $table->id();
    $table->string('topic');
    $table->integer('partition');
    $table->bigInteger('offset');
    $table->timestamp('processed_at');

    $table->unique(['topic', 'partition', 'offset']);
    $table->index(['topic', 'partition']);
});
```
</details>

### Задание 3: Построй гибридную систему

Создай систему обработки заказов которая использует все три broker для разных задач.

<details>
<summary>Решение</summary>

```php
// app/Services/OrderProcessingService.php
namespace App\Services;

use App\Models\Order;
use App\Jobs\SendOrderEmailJob;
use App\Events\OrderCreatedEvent;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\DB;
use Junges\Kafka\Facades\Kafka;

class OrderProcessingService
{
    public function createOrder(User $user, array $data): Order
    {
        return DB::transaction(function () use ($user, $data) {
            // 1. Создать заказ
            $order = Order::create([
                'user_id' => $user->id,
                'total' => $this->calculateTotal($data['items']),
                'status' => 'pending',
            ]);

            foreach ($data['items'] as $item) {
                $order->items()->create($item);
            }

            // 2. Event Sourcing через Kafka
            // Сохранить событие для history и audit
            $this->publishToKafka('order.created', $order, $data);

            // 3. Background Jobs через RabbitMQ
            // Асинхронные задачи с гарантией доставки
            $this->dispatchBackgroundJobs($order);

            // 4. Real-time Notification через Redis Pub/Sub
            // Уведомить пользователя онлайн
            $this->notifyUserRealtime($order);

            return $order;
        });
    }

    private function publishToKafka(string $eventType, Order $order, array $data): void
    {
        // Kafka: Event Sourcing + CDC
        Kafka::publishOn('order-events')
            ->withBodyKey('order_id', $order->id)
            ->withHeaders([
                'event_type' => $eventType,
                'version' => '1.0',
            ])
            ->withMessage([
                'event_type' => $eventType,
                'order_id' => $order->id,
                'user_id' => $order->user_id,
                'total' => $order->total,
                'items' => $data['items'],
                'timestamp' => now()->toIso8601String(),
            ])
            ->send();
    }

    private function dispatchBackgroundJobs(Order $order): void
    {
        // RabbitMQ: Background Jobs с retry
        SendOrderEmailJob::dispatch($order)
            ->onQueue('emails')
            ->onConnection('rabbitmq');

        UpdateInventoryJob::dispatch($order)
            ->onQueue('inventory')
            ->onConnection('rabbitmq');

        GenerateInvoiceJob::dispatch($order)
            ->onQueue('invoices')
            ->onConnection('rabbitmq')
            ->delay(now()->addMinutes(5));

        NotifyWarehouseJob::dispatch($order)
            ->onQueue('warehouse')
            ->onConnection('rabbitmq');
    }

    private function notifyUserRealtime(Order $order): void
    {
        // Redis Pub/Sub: Real-time notifications
        broadcast(new OrderCreatedEvent($order));

        // Также отправить админам
        Redis::publish('admin-notifications', json_encode([
            'type' => 'new_order',
            'order_id' => $order->id,
            'total' => $order->total,
            'user' => $order->user->name,
        ]));
    }

    public function payOrder(Order $order, array $paymentData): void
    {
        DB::transaction(function () use ($order, $paymentData) {
            // Обработать платёж
            $payment = PaymentGateway::charge($order->total, $paymentData);

            $order->update([
                'status' => 'paid',
                'paid_at' => now(),
                'payment_id' => $payment->id,
            ]);

            // Kafka: Event для истории
            Kafka::publishOn('order-events')
                ->withBodyKey('order_id', $order->id)
                ->withMessage([
                    'event_type' => 'order.paid',
                    'order_id' => $order->id,
                    'payment_id' => $payment->id,
                    'timestamp' => now()->toIso8601String(),
                ])
                ->send();

            // RabbitMQ: Background jobs
            SendPaymentConfirmationJob::dispatch($order)
                ->onConnection('rabbitmq');

            StartFulfillmentJob::dispatch($order)
                ->onConnection('rabbitmq');

            // Redis: Real-time notification
            broadcast(new OrderPaidEvent($order));
        });
    }
}

// app/Console/Commands/ConsumeOrderEvents.php
// Kafka Consumer для аналитики и синхронизации
class ConsumeOrderEvents extends Command
{
    protected $signature = 'kafka:consume-orders';

    public function handle()
    {
        $consumer = Kafka::createConsumer(['order-events'])
            ->withConsumerGroupId('analytics-service')
            ->withAutoCommit(false)
            ->withHandler(function ($message) {
                $event = $message->getBody();

                // Обработка для аналитики
                match ($event['event_type']) {
                    'order.created' => $this->trackOrderCreated($event),
                    'order.paid' => $this->trackOrderPaid($event),
                    'order.shipped' => $this->trackOrderShipped($event),
                    default => null,
                };

                // Синхронизация с внешними системами
                $this->syncToExternalService($event);

                $message->getConsumer()->commit($message);
            })
            ->build();

        $consumer->consume();
    }

    private function trackOrderCreated(array $event): void
    {
        // Отправить в аналитику
        Analytics::track('order_created', [
            'order_id' => $event['order_id'],
            'total' => $event['total'],
        ]);
    }

    private function syncToExternalService(array $event): void
    {
        // Синхронизация с CRM, ERP, etc.
        Http::post('https://crm.example.com/orders/sync', $event);
    }
}

// config/queue.php
'connections' => [
    // RabbitMQ для background jobs
    'rabbitmq' => [
        'driver' => 'rabbitmq',
        'queue' => 'default',
        'connection' => [
            'host' => env('RABBITMQ_HOST', '127.0.0.1'),
            'port' => env('RABBITMQ_PORT', 5672),
            'user' => env('RABBITMQ_USER', 'guest'),
            'password' => env('RABBITMQ_PASSWORD', 'guest'),
        ],
    ],
],

// config/broadcasting.php
'connections' => [
    // Redis для real-time
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
    ],
],

// config/kafka.php
return [
    // Kafka для event sourcing
    'brokers' => env('KAFKA_BROKERS', 'localhost:9092'),
];

// Итого архитектура:
// - RabbitMQ: Email, PDF generation, inventory updates (background jobs)
// - Kafka: Event sourcing, CDC, analytics, audit log
// - Redis Pub/Sub: Real-time notifications, WebSockets, live updates
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
