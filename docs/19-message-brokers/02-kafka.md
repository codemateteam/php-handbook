# 17.2 Apache Kafka

## Краткое резюме

> **Apache Kafka** — distributed streaming platform для обработки миллионов событий в секунду с хранением на диске.
>
> **Архитектура:** Topics разделены на Partitions, Consumer Groups читают параллельно. Offset управляет позицией чтения.
>
> **Use cases:** Event streaming, event sourcing, CDC, real-time analytics, logs aggregation.

---

## Содержание

- [Что это](#что-это)
- [Архитектура](#архитектура)
- [Topics и Partitions](#topics-и-partitions)
- [Producer](#producer)
- [Consumer](#consumer)
- [Laravel + Kafka](#laravel--kafka)
- [Offset Management](#offset-management)
- [Retention (хранение)](#retention-хранение)
- [Replication](#replication)
- [Use Cases](#use-cases)
- [Kafka vs RabbitMQ](#kafka-vs-rabbitmq)
- [Monitoring](#monitoring)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Kafka:**
Distributed streaming platform для обработки потоков событий в реальном времени. Высокая пропускная способность (millions events/sec).

**Зачем:**
- Event streaming (real-time data pipelines)
- Высокая пропускная способность
- Хранение событий (event log)
- Микросервисы коммуникация

**Отличие от RabbitMQ:**

```
RabbitMQ:
- Message broker (задачи удаляются после обработки)
- Low latency
- Complex routing

Kafka:
- Event log (события хранятся)
- High throughput
- Simple pub/sub
```

---

## Архитектура

**Компоненты:**

```
Producer → Topic (partitions) → Consumer Group
                ↓
            (хранится на диске)
```

**Topic:**
- Категория событий (как таблица)
- Разделён на partitions для масштабирования

**Partition:**
- Упорядоченная последовательность сообщений
- Каждое сообщение имеет offset (позицию)

**Consumer Group:**
- Группа consumers для параллельной обработки
- Каждый partition читается только одним consumer в группе

---

## Topics и Partitions

**Пример:**

```
Topic: user-events

Partition 0: [msg1, msg2, msg5, msg7]  ← Consumer 1
Partition 1: [msg3, msg6, msg8]        ← Consumer 2
Partition 2: [msg4, msg9]              ← Consumer 3
```

**Количество partitions:**
- Больше partitions = больше параллелизма
- Рекомендуется: 3-6 partitions на topic
- Max consumers в группе = количество partitions

---

## Producer

**PHP пример:**

```bash
composer require enqueue/rdkafka
```

```php
use Enqueue\RdKafka\RdKafkaConnectionFactory;

$factory = new RdKafkaConnectionFactory([
    'global' => [
        'bootstrap.servers' => 'localhost:9092',
    ],
]);

$context = $factory->createContext();

// Создать producer
$topic = $context->createTopic('user-events');
$producer = $context->createProducer();

// Отправить сообщение
$message = $context->createMessage(json_encode([
    'event' => 'user_created',
    'user_id' => 123,
    'timestamp' => time(),
]));

$producer->send($topic, $message);
```

**С ключом (для partitioning):**

```php
$message = $context->createMessage($body);

// Все сообщения с одним ключом попадут в одну partition
$message->setKey((string)$userId);  // Partition по user_id

$producer->send($topic, $message);
```

---

## Consumer

**Single Consumer:**

```php
$context = $factory->createContext();
$consumer = $context->createConsumer(
    $context->createQueue('user-events')
);

while (true) {
    $message = $consumer->receive(1000);  // Timeout 1 секунда

    if ($message) {
        $data = json_decode($message->getBody(), true);

        echo "Processing: {$data['event']}\n";

        // Обработка...

        // Acknowledge
        $consumer->acknowledge($message);
    }
}
```

**Consumer Group:**

```php
$context = $factory->createContext([
    'global' => [
        'group.id' => 'email-service',  // Consumer group ID
        'enable.auto.commit' => 'false',
    ],
]);

$consumer = $context->createConsumer(
    $context->createQueue('user-events')
);

// Kafka автоматически распределит partitions между consumers в группе
```

---

## Laravel + Kafka

**Package:**

```bash
composer require junges/laravel-kafka
```

**Конфигурация:**

```php
// config/kafka.php
return [
    'brokers' => env('KAFKA_BROKERS', 'localhost:9092'),
];
```

**Producer:**

```php
use Junges\Kafka\Facades\Kafka;

// Простая отправка
Kafka::publishOn('user-events')
    ->withMessage([
        'event' => 'user_created',
        'user_id' => 123,
    ])
    ->send();

// С ключом и headers
Kafka::publishOn('user-events')
    ->withHeaders(['version' => '1.0'])
    ->withBodyKey('user_id', 123)
    ->withMessage([
        'event' => 'user_created',
        'email' => 'user@example.com',
    ])
    ->send();
```

**Consumer:**

```php
use Junges\Kafka\Facades\Kafka;

$consumer = Kafka::createConsumer(['user-events'])
    ->withConsumerGroupId('email-service')
    ->withHandler(function ($message) {
        $data = $message->getBody();

        Log::info('Kafka message', $data);

        // Обработка...
    })
    ->build();

$consumer->consume();
```

**Console Command:**

```php
// app/Console/Commands/ConsumeKafka.php
class ConsumeKafka extends Command
{
    protected $signature = 'kafka:consume';

    public function handle()
    {
        $consumer = Kafka::createConsumer(['user-events'])
            ->withConsumerGroupId('laravel-consumer')
            ->withHandler(function ($message) {
                $this->info('Processing: ' . json_encode($message->getBody()));
            })
            ->build();

        $consumer->consume();
    }
}
```

```bash
php artisan kafka:consume
```

---

## Offset Management

**Что такое offset:**
- Позиция сообщения в partition
- Consumer сохраняет offset для resume

**Auto commit:**

```php
'enable.auto.commit' => 'true',  // Автоматически commit offset
'auto.commit.interval.ms' => 5000,  // Каждые 5 секунд
```

**Manual commit:**

```php
'enable.auto.commit' => 'false',

$consumer = Kafka::createConsumer(['user-events'])
    ->withHandler(function ($message) use ($consumer) {
        try {
            processMessage($message);

            // Успех: commit offset
            $consumer->commit();
        } catch (Exception $e) {
            // Ошибка: не commit (повтор при следующем запуске)
            Log::error('Failed to process', ['error' => $e]);
        }
    })
    ->build();
```

**Reset offset:**

```bash
# Читать с начала
kafka-consumer-groups --bootstrap-server localhost:9092 \
    --group my-group \
    --reset-offsets --to-earliest \
    --topic user-events \
    --execute

# Читать с конкретного offset
kafka-consumer-groups --bootstrap-server localhost:9092 \
    --group my-group \
    --reset-offsets --to-offset 100 \
    --topic user-events:0 \
    --execute
```

---

## Retention (хранение)

**По умолчанию:** 7 дней

```bash
# Настроить retention
kafka-configs --bootstrap-server localhost:9092 \
    --entity-type topics \
    --entity-name user-events \
    --alter \
    --add-config retention.ms=604800000  # 7 дней
```

**Infinite retention:**

```bash
# Хранить навсегда (event sourcing)
--add-config retention.ms=-1
```

**Compaction:**

```bash
# Хранить только последнее значение для каждого ключа
--add-config cleanup.policy=compact
```

---

## Replication

**Зачем:** Отказоустойчивость

```
Broker 1 (leader for partition 0)    ← Producer writes here
Broker 2 (replica for partition 0)
Broker 3 (replica for partition 0)

Если Broker 1 упал → Broker 2 становится leader
```

**Создать topic с репликацией:**

```bash
kafka-topics --create \
    --bootstrap-server localhost:9092 \
    --topic user-events \
    --partitions 3 \
    --replication-factor 3  # 3 копии
```

**min.insync.replicas:**

```bash
# Минимум 2 реплики должны подтвердить запись
--add-config min.insync.replicas=2
```

---

## Use Cases

### 1. Event Sourcing

```php
// Сохранить все события пользователя
Kafka::publishOn('user-events')
    ->withBodyKey('user_id', $userId)
    ->withMessage([
        'event' => 'user_created',
        'data' => $userData,
        'timestamp' => time(),
    ])
    ->send();

Kafka::publishOn('user-events')
    ->withBodyKey('user_id', $userId)
    ->withMessage([
        'event' => 'email_verified',
        'timestamp' => time(),
    ])
    ->send();

// Consumer восстанавливает состояние из событий
```

---

### 2. CDC (Change Data Capture)

```php
// Каждое изменение в БД → Kafka
class UserObserver
{
    public function created(User $user)
    {
        Kafka::publishOn('user-changes')
            ->withMessage([
                'operation' => 'INSERT',
                'table' => 'users',
                'data' => $user->toArray(),
            ])
            ->send();
    }

    public function updated(User $user)
    {
        Kafka::publishOn('user-changes')
            ->withMessage([
                'operation' => 'UPDATE',
                'table' => 'users',
                'before' => $user->getOriginal(),
                'after' => $user->toArray(),
            ])
            ->send();
    }
}

// Другие сервисы синхронизируют свои БД
```

---

### 3. Metrics & Logging

```php
// Real-time метрики
Kafka::publishOn('app-metrics')
    ->withMessage([
        'metric' => 'api.response_time',
        'value' => 150,  // ms
        'timestamp' => microtime(true),
    ])
    ->send();

// Consumer агрегирует и шлёт в InfluxDB/Prometheus
```

---

## Kafka vs RabbitMQ

**Выбирай Kafka когда:**
```
✓ Высокая пропускная способность (millions/sec)
✓ Event log / Event sourcing
✓ Replay событий
✓ Долгое хранение событий
✓ Stream processing (Kafka Streams)
```

**Выбирай RabbitMQ когда:**
```
✓ Low latency
✓ Complex routing (topic exchange, headers)
✓ Priority queues
✓ Задачи удаляются после обработки
✓ Проще в настройке и поддержке
```

**Комбинация:**
```
RabbitMQ: задачи (emails, notifications)
Kafka: события (user_created, order_placed)
```

---

## Monitoring

**CLI:**

```bash
# Список topics
kafka-topics --list --bootstrap-server localhost:9092

# Информация о topic
kafka-topics --describe --topic user-events --bootstrap-server localhost:9092

# Consumer groups
kafka-consumer-groups --list --bootstrap-server localhost:9092

# Lag (отставание consumer)
kafka-consumer-groups --describe --group my-group --bootstrap-server localhost:9092
```

**Kafka Manager / Kafka UI:**
- GUI для управления
- http://localhost:9000

---

## На собеседовании скажешь

> "Kafka — distributed streaming platform для event log. Topics разделены на partitions для параллелизма. Producer отправляет с ключом (для partitioning). Consumer group: каждый partition читается одним consumer. Offset — позиция в partition, manual/auto commit. Retention: по умолчанию 7 дней, может быть infinite (event sourcing). Replication для отказоустойчивости (min.insync.replicas). Laravel: junges/laravel-kafka. Use cases: event sourcing, CDC, real-time metrics. Kafka vs RabbitMQ: Kafka для high throughput и event log, RabbitMQ для задач и complex routing."

---

## Практические задания

### Задание 1: Event Sourcing с Kafka

Реализуй систему event sourcing для заказов используя Kafka. Все события (created, paid, shipped) должны храниться и позволять восстановление состояния.

<details>
<summary>Решение</summary>

```php
// app/Services/OrderEventSourcing.php
namespace App\Services;

use Junges\Kafka\Facades\Kafka;
use App\Models\Order;

class OrderEventSourcing
{
    private const TOPIC = 'order-events';

    public function publishEvent(string $eventType, Order $order, array $data = []): void
    {
        $event = [
            'event_type' => $eventType,
            'order_id' => $order->id,
            'timestamp' => now()->toIso8601String(),
            'data' => $data,
        ];

        Kafka::publishOn(self::TOPIC)
            ->withBodyKey('order_id', $order->id)  // Все события заказа в одну partition
            ->withHeaders([
                'event_type' => $eventType,
                'version' => '1.0',
            ])
            ->withMessage($event)
            ->send();
    }

    public function createOrder(array $data): Order
    {
        $order = Order::create($data);

        $this->publishEvent('order.created', $order, [
            'items' => $data['items'],
            'total' => $data['total'],
        ]);

        return $order;
    }

    public function payOrder(Order $order, string $paymentMethod): void
    {
        $order->update(['status' => 'paid', 'paid_at' => now()]);

        $this->publishEvent('order.paid', $order, [
            'payment_method' => $paymentMethod,
        ]);
    }

    public function shipOrder(Order $order, string $trackingNumber): void
    {
        $order->update(['status' => 'shipped', 'shipped_at' => now()]);

        $this->publishEvent('order.shipped', $order, [
            'tracking_number' => $trackingNumber,
        ]);
    }

    public function rebuildOrderState(int $orderId): array
    {
        // Читаем все события заказа из Kafka
        // В реальности нужно использовать Consumer API для чтения с начала

        $state = [
            'order_id' => $orderId,
            'status' => 'unknown',
            'events' => [],
        ];

        // Псевдокод для восстановления состояния
        // foreach ($events as $event) {
        //     switch ($event['event_type']) {
        //         case 'order.created':
        //             $state['status'] = 'created';
        //             $state['items'] = $event['data']['items'];
        //             break;
        //         case 'order.paid':
        //             $state['status'] = 'paid';
        //             $state['payment_method'] = $event['data']['payment_method'];
        //             break;
        //         case 'order.shipped':
        //             $state['status'] = 'shipped';
        //             $state['tracking_number'] = $event['data']['tracking_number'];
        //             break;
        //     }
        //     $state['events'][] = $event;
        // }

        return $state;
    }
}

// app/Console/Commands/ConsumeOrderEvents.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Junges\Kafka\Facades\Kafka;
use Illuminate\Support\Facades\Log;

class ConsumeOrderEvents extends Command
{
    protected $signature = 'kafka:consume-orders';

    public function handle()
    {
        $consumer = Kafka::createConsumer(['order-events'])
            ->withConsumerGroupId('order-processor')
            ->withAutoCommit()
            ->withHandler(function ($message) {
                $data = $message->getBody();

                Log::info('Order event received', [
                    'event_type' => $data['event_type'],
                    'order_id' => $data['order_id'],
                ]);

                // Обработка событий (обновление read models, аналитика и т.д.)
                match ($data['event_type']) {
                    'order.created' => $this->handleOrderCreated($data),
                    'order.paid' => $this->handleOrderPaid($data),
                    'order.shipped' => $this->handleOrderShipped($data),
                    default => null,
                };
            })
            ->build();

        $consumer->consume();
    }

    private function handleOrderCreated(array $data): void
    {
        // Отправить welcome email
        // Обновить аналитику
        $this->info("Order created: {$data['order_id']}");
    }

    private function handleOrderPaid(array $data): void
    {
        // Начать сборку заказа
        // Обновить статистику продаж
        $this->info("Order paid: {$data['order_id']}");
    }

    private function handleOrderShipped(array $data): void
    {
        // Отправить tracking info
        // Обновить inventory
        $this->info("Order shipped: {$data['order_id']}");
    }
}

// Использование
$service = new OrderEventSourcing();

$order = $service->createOrder([
    'user_id' => 1,
    'items' => [['product_id' => 1, 'quantity' => 2]],
    'total' => 100.00,
]);

$service->payOrder($order, 'credit_card');
$service->shipOrder($order, 'TRACK123');
```
</details>

### Задание 2: Consumer Group для параллельной обработки

Создай систему с несколькими consumers в группе для параллельной обработки логов.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/KafkaLogConsumer.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Junges\Kafka\Facades\Kafka;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class KafkaLogConsumer extends Command
{
    protected $signature = 'kafka:consume-logs {consumer-id}';
    protected $description = 'Consume logs from Kafka';

    public function handle()
    {
        $consumerId = $this->argument('consumer-id');
        $groupId = 'log-processors';

        $this->info("Starting consumer {$consumerId} in group {$groupId}");

        $consumer = Kafka::createConsumer(['application-logs'])
            ->withConsumerGroupId($groupId)
            ->withAutoCommit(false)  // Manual commit
            ->withHandler(function ($message) use ($consumerId) {
                $logData = $message->getBody();

                try {
                    // Обработка лога
                    DB::table('application_logs')->insert([
                        'level' => $logData['level'],
                        'message' => $logData['message'],
                        'context' => json_encode($logData['context'] ?? []),
                        'processed_by' => $consumerId,
                        'created_at' => now(),
                    ]);

                    $this->info("[{$consumerId}] Processed log: {$logData['message']}");

                    // Manual commit после успешной обработки
                    $message->getConsumer()->commit($message);

                } catch (\Exception $e) {
                    $this->error("[{$consumerId}] Failed: {$e->getMessage()}");
                    // Не commit - сообщение будет обработано повторно
                }
            })
            ->build();

        $consumer->consume();
    }
}

// Запуск нескольких consumers
// Terminal 1: php artisan kafka:consume-logs consumer-1
// Terminal 2: php artisan kafka:consume-logs consumer-2
// Terminal 3: php artisan kafka:consume-logs consumer-3

// Kafka автоматически распределит partitions между consumers

// Producer для логов
namespace App\Services;

use Junges\Kafka\Facades\Kafka;

class KafkaLogger
{
    public function log(string $level, string $message, array $context = []): void
    {
        Kafka::publishOn('application-logs')
            ->withMessage([
                'level' => $level,
                'message' => $message,
                'context' => $context,
                'timestamp' => now()->toIso8601String(),
                'hostname' => gethostname(),
            ])
            ->send();
    }

    public function info(string $message, array $context = []): void
    {
        $this->log('info', $message, $context);
    }

    public function error(string $message, array $context = []): void
    {
        $this->log('error', $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->log('warning', $message, $context);
    }
}

// Использование
$logger = new KafkaLogger();
$logger->info('User logged in', ['user_id' => 123]);
$logger->error('Database connection failed', ['host' => 'db.example.com']);
```
</details>

### Задание 3: CDC (Change Data Capture) с Kafka

Реализуй систему для отслеживания изменений в БД и синхронизации с другими сервисами через Kafka.

<details>
<summary>Решение</summary>

```php
// app/Observers/UserObserver.php
namespace App\Observers;

use App\Models\User;
use Junges\Kafka\Facades\Kafka;

class UserObserver
{
    private const TOPIC = 'user-changes';

    public function created(User $user): void
    {
        $this->publishChange('INSERT', $user, null);
    }

    public function updated(User $user): void
    {
        $this->publishChange('UPDATE', $user, $user->getOriginal());
    }

    public function deleted(User $user): void
    {
        $this->publishChange('DELETE', $user, null);
    }

    private function publishChange(string $operation, User $user, ?array $before): void
    {
        $event = [
            'operation' => $operation,
            'table' => 'users',
            'timestamp' => now()->toIso8601String(),
            'before' => $before,
            'after' => $user->toArray(),
        ];

        Kafka::publishOn(self::TOPIC)
            ->withBodyKey('user_id', $user->id)
            ->withHeaders([
                'operation' => $operation,
                'table' => 'users',
            ])
            ->withMessage($event)
            ->send();
    }
}

// Регистрация Observer в AppServiceProvider
use App\Models\User;
use App\Observers\UserObserver;

public function boot(): void
{
    User::observe(UserObserver::class);
}

// Consumer для синхронизации в другой сервис
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Junges\Kafka\Facades\Kafka;
use Illuminate\Support\Facades\Http;

class SyncUserChanges extends Command
{
    protected $signature = 'kafka:sync-users';

    public function handle()
    {
        $consumer = Kafka::createConsumer(['user-changes'])
            ->withConsumerGroupId('analytics-service')
            ->withAutoCommit(false)
            ->withHandler(function ($message) {
                $change = $message->getBody();

                try {
                    // Синхронизация с внешним сервисом
                    match ($change['operation']) {
                        'INSERT' => $this->syncUserCreated($change['after']),
                        'UPDATE' => $this->syncUserUpdated($change['before'], $change['after']),
                        'DELETE' => $this->syncUserDeleted($change['after']),
                    };

                    $this->info("Synced {$change['operation']} for user {$change['after']['id']}");

                    $message->getConsumer()->commit($message);

                } catch (\Exception $e) {
                    $this->error("Sync failed: {$e->getMessage()}");
                }
            })
            ->build();

        $consumer->consume();
    }

    private function syncUserCreated(array $user): void
    {
        // Отправить в аналитический сервис
        Http::post('https://analytics.example.com/users', [
            'id' => $user['id'],
            'email' => $user['email'],
            'created_at' => $user['created_at'],
        ]);
    }

    private function syncUserUpdated(array $before, array $after): void
    {
        // Обновить в аналитическом сервисе
        Http::put("https://analytics.example.com/users/{$after['id']}", [
            'email' => $after['email'],
            'name' => $after['name'],
        ]);
    }

    private function syncUserDeleted(array $user): void
    {
        // Удалить из аналитического сервиса
        Http::delete("https://analytics.example.com/users/{$user['id']}");
    }
}

// Создание topic с правильными настройками для CDC
// bash
// kafka-topics --create \
//   --bootstrap-server localhost:9092 \
//   --topic user-changes \
//   --partitions 3 \
//   --replication-factor 3 \
//   --config retention.ms=-1 \
//   --config cleanup.policy=compact
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

