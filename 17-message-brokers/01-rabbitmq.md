# 17.1 RabbitMQ

## Краткое резюме

> **RabbitMQ** — message broker для асинхронной коммуникации между сервисами по протоколу AMQP.
>
> **Компоненты:** Producer отправляет сообщения в Exchange, который маршрутизирует их в Queue, откуда Consumer забирает и обрабатывает.
>
> **Типы Exchange:** Direct (точный routing key), Fanout (broadcast всем), Topic (pattern matching), Headers (по заголовкам).

---

## Содержание

- [Что это](#что-это)
- [Типы Exchanges](#типы-exchanges)
- [Laravel + RabbitMQ](#laravel--rabbitmq)
- [Direct PHP (без Laravel)](#direct-php-без-laravel)
- [Гарантии доставки](#гарантии-доставки)
- [Dead Letter Exchange (DLX)](#dead-letter-exchange-dlx)
- [Priority Queues](#priority-queues)
- [Мониторинг](#мониторинг)
- [Best Practices](#best-practices)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**RabbitMQ:**
Message broker для асинхронной коммуникации между сервисами. Реализует AMQP протокол.

**Зачем:**
- Асинхронная обработка задач
- Декаплинг сервисов
- Load leveling (сглаживание нагрузки)
- Гарантия доставки сообщений

**Компоненты:**

```
Producer → Exchange → Queue → Consumer

Producer: отправляет сообщения
Exchange: маршрутизирует сообщения в очереди
Queue: хранит сообщения
Consumer: обрабатывает сообщения
```

---

## Типы Exchanges

### 1. Direct Exchange

**Принцип:** Сообщение идёт в queue с точным routing key.

```
Producer → [Direct Exchange] → Queue "emails"
                    ↓              (routing_key: email)
                Queue "sms"
                (routing_key: sms)
```

**Пример:**

```php
// Producer
$channel->basic_publish(
    $message,
    'notifications',      // exchange
    'email'              // routing_key
);

// Queue привязана с routing_key = 'email'
// Сообщение попадёт только в эту queue
```

---

### 2. Fanout Exchange

**Принцип:** Broadcast всем подключённым queues.

```
Producer → [Fanout Exchange] → Queue 1
                     ↓          Queue 2
                                Queue 3
```

**Пример:**

```php
// Producer
$channel->basic_publish(
    $message,
    'logs',  // fanout exchange
    ''       // routing_key игнорируется
);

// Все queues получат сообщение
```

**Use case:** Логирование, мониторинг.

---

### 3. Topic Exchange

**Принцип:** Pattern matching для routing key.

```
Routing keys:
- user.created
- user.updated
- order.created
- order.shipped

Pattern bindings:
Queue 1: user.*          (получит user.created, user.updated)
Queue 2: order.*         (получит order.created, order.shipped)
Queue 3: *.created       (получит user.created, order.created)
Queue 4: #               (получит всё)
```

**Wildcards:**
- `*` — один сегмент
- `#` — любое количество сегментов

**Пример:**

```php
// Producer
$channel->basic_publish(
    $message,
    'events',            // topic exchange
    'order.shipped'      // routing_key
);

// Queue с pattern 'order.*' получит сообщение
```

---

### 4. Headers Exchange

**Принцип:** Routing по headers, не по routing key.

```php
// Producer
$message->set('application_headers', [
    'format' => 'pdf',
    'type' => 'report'
]);

// Queue привязана с условием:
// headers: {format: pdf, type: report}
```

---

## Laravel + RabbitMQ

**Установка:**

```bash
composer require vladimir-yuldashev/laravel-queue-rabbitmq
```

**config/queue.php:**

```php
'connections' => [
    'rabbitmq' => [
        'driver' => 'rabbitmq',
        'queue' => env('RABBITMQ_QUEUE', 'default'),
        'connection' => [
            'host' => env('RABBITMQ_HOST', '127.0.0.1'),
            'port' => env('RABBITMQ_PORT', 5672),
            'user' => env('RABBITMQ_USER', 'guest'),
            'password' => env('RABBITMQ_PASSWORD', 'guest'),
            'vhost' => env('RABBITMQ_VHOST', '/'),
        ],
        'options' => [
            'exchange' => [
                'name' => 'laravel-exchange',
                'type' => 'topic',  // direct, fanout, topic, headers
            ],
        ],
    ],
],
```

**Job:**

```php
class SendEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public $connection = 'rabbitmq';
    public $queue = 'emails';

    public function __construct(
        public string $email,
        public string $message
    ) {}

    public function handle()
    {
        Mail::raw($this->message, function ($mail) {
            $mail->to($this->email);
        });
    }
}

// Dispatch
SendEmailJob::dispatch('user@example.com', 'Hello!');
```

**Worker:**

```bash
php artisan queue:work rabbitmq --queue=emails
```

---

## Direct PHP (без Laravel)

**Producer:**

```php
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

$connection = new AMQPStreamConnection('localhost', 5672, 'guest', 'guest');
$channel = $connection->channel();

// Создать exchange
$channel->exchange_declare(
    'logs',      // exchange name
    'fanout',    // type
    false,       // passive
    true,        // durable
    false        // auto_delete
);

// Отправить сообщение
$message = new AMQPMessage(
    json_encode(['event' => 'user_created', 'user_id' => 123]),
    ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]
);

$channel->basic_publish($message, 'logs');

$channel->close();
$connection->close();
```

**Consumer:**

```php
$connection = new AMQPStreamConnection('localhost', 5672, 'guest', 'guest');
$channel = $connection->channel();

// Создать queue
$channel->queue_declare(
    'email_queue',  // queue name
    false,          // passive
    true,           // durable
    false,          // exclusive
    false           // auto_delete
);

// Привязать queue к exchange
$channel->queue_bind('email_queue', 'notifications', 'email');

// Callback для обработки
$callback = function ($msg) {
    $data = json_decode($msg->body, true);

    echo "Processing: {$data['email']}\n";

    // Обработка...

    // Acknowledge (подтверждение)
    $msg->ack();
};

// Подписаться на queue
$channel->basic_qos(null, 1, null);  // Prefetch 1 сообщение
$channel->basic_consume(
    'email_queue',
    '',
    false,        // no_ack
    false,        // exclusive
    false,        // no_local
    false,        // no_wait
    $callback
);

// Слушать
while ($channel->is_consuming()) {
    $channel->wait();
}

$channel->close();
$connection->close();
```

---

## Гарантии доставки

### 1. Publisher Confirms

**Проблема:** Producer не знает дошло ли сообщение.

**Решение:**

```php
$channel->confirm_select();

$channel->basic_publish($message, 'exchange');

$channel->wait_for_pending_acks(5);  // Timeout 5 секунд

// Если timeout → сообщение не доставлено
```

---

### 2. Consumer Acknowledgments

**Manual ACK:**

```php
$callback = function ($msg) {
    try {
        processMessage($msg->body);

        // ✅ Успех: acknowledge
        $msg->ack();
    } catch (Exception $e) {
        // ❌ Ошибка: reject и requeue
        $msg->nack(false, true);  // requeue = true
    }
};

$channel->basic_consume('queue', '', false, false, false, false, $callback);
//                                     ↑
//                                  no_ack = false (manual)
```

**Auto ACK (опасно):**

```php
// Сообщение удаляется сразу после отправки consumer
// Если consumer упал → сообщение потеряно
$channel->basic_consume('queue', '', false, true, ...);
//                                          ↑
//                                       no_ack = true
```

---

### 3. Persistent Messages

```php
// Сообщение сохраняется на диск
$message = new AMQPMessage(
    $body,
    ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]
);

// Queue тоже должна быть durable
$channel->queue_declare('queue', false, true, false, false);
//                                       ↑
//                                    durable = true
```

---

## Dead Letter Exchange (DLX)

**Что это:** Queue для "мёртвых" сообщений (не обработались после N попыток).

**Настройка:**

```php
// Основная queue
$channel->queue_declare('emails', false, true, false, false, false, [
    'x-dead-letter-exchange' => ['S', 'dlx'],
    'x-dead-letter-routing-key' => ['S', 'emails.failed'],
    'x-message-ttl' => ['I', 300000],  // 5 минут
]);

// Dead Letter Exchange
$channel->exchange_declare('dlx', 'direct', false, true, false);

// Dead Letter Queue
$channel->queue_declare('emails.failed', false, true, false, false);
$channel->queue_bind('emails.failed', 'dlx', 'emails.failed');
```

**Использование:**

```php
$callback = function ($msg) {
    try {
        processEmail($msg->body);
        $msg->ack();
    } catch (Exception $e) {
        // Reject без requeue → идёт в DLX
        $msg->nack(false, false);
    }
};
```

---

## Priority Queues

```php
// Queue с приоритетами
$channel->queue_declare('tasks', false, true, false, false, false, [
    'x-max-priority' => ['I', 10]  // Приоритеты 0-10
]);

// Отправить с приоритетом
$message = new AMQPMessage($body, [
    'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
    'priority' => 5  // Приоритет 5
]);

// High priority сообщения обрабатываются первыми
```

---

## Мониторинг

**Management UI:**

```bash
# Включить management plugin
rabbitmq-plugins enable rabbitmq_management

# http://localhost:15672
# Login: guest / guest
```

**CLI:**

```bash
# Список queues
rabbitmqctl list_queues name messages consumers

# Список exchanges
rabbitmqctl list_exchanges name type

# Список bindings
rabbitmqctl list_bindings

# Статус
rabbitmqctl status
```

---

## Best Practices

```
✓ Всегда используй durable queues и persistent messages
✓ Manual ACK с try/catch
✓ Dead Letter Exchange для failed messages
✓ Publisher confirms для критичных сообщений
✓ Prefetch limit (1-10) для равномерной нагрузки
✓ Monitoring (queue size, consumer lag)
✓ Idempotency (сообщение может прийти дважды)
✓ TTL для message expiration
```

---

## На собеседовании скажешь

> "RabbitMQ — message broker для асинхронной коммуникации. Компоненты: Producer, Exchange (direct/fanout/topic), Queue, Consumer. Direct exchange: точный routing key. Fanout: broadcast. Topic: pattern matching (user.*, #). Laravel: vladimir-yuldashev/laravel-queue-rabbitmq, jobs с connection=rabbitmq. Гарантии: publisher confirms, manual ACK, persistent messages. DLX для failed messages. Priority queues. Management UI для мониторинга. Best practices: durable queues, manual ACK, idempotency."

---

## Практические задания

### Задание 1: Создай Job для RabbitMQ

Создай Job который отправляет email через RabbitMQ с retry логикой и обработкой ошибок.

<details>
<summary>Решение</summary>

```php
// app/Jobs/SendEmailJob.php
namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $connection = 'rabbitmq';
    public $queue = 'emails';

    // Количество попыток
    public $tries = 3;

    // Задержка между попытками (секунды)
    public $backoff = [60, 300, 900]; // 1 мин, 5 мин, 15 мин

    // Таймаут
    public $timeout = 120;

    public function __construct(
        public string $email,
        public string $subject,
        public string $message
    ) {}

    public function handle(): void
    {
        Mail::raw($this->message, function ($mail) {
            $mail->to($this->email)
                 ->subject($this->subject);
        });

        Log::info('Email sent successfully', [
            'email' => $this->email,
            'attempts' => $this->attempts(),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Failed to send email after all retries', [
            'email' => $this->email,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);

        // Можно отправить в Dead Letter Exchange
        // или уведомить админа
    }
}

// config/queue.php
'connections' => [
    'rabbitmq' => [
        'driver' => 'rabbitmq',
        'queue' => env('RABBITMQ_QUEUE', 'default'),
        'connection' => [
            'host' => env('RABBITMQ_HOST', '127.0.0.1'),
            'port' => env('RABBITMQ_PORT', 5672),
            'user' => env('RABBITMQ_USER', 'guest'),
            'password' => env('RABBITMQ_PASSWORD', 'guest'),
            'vhost' => env('RABBITMQ_VHOST', '/'),
        ],
        'options' => [
            'exchange' => [
                'name' => 'laravel-exchange',
                'type' => 'direct',
                'declare' => true,
            ],
            'queue' => [
                'declare' => true,
                'bind' => true,
            ],
        ],
    ],
],

// Использование
SendEmailJob::dispatch('user@example.com', 'Welcome', 'Hello World!');
```
</details>

### Задание 2: Настрой Topic Exchange для событий

Создай Topic Exchange для маршрутизации событий пользователей (user.created, user.updated, user.deleted) по разным очередям.

<details>
<summary>Решение</summary>

```php
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

class RabbitMQService
{
    private $connection;
    private $channel;

    public function __construct()
    {
        $this->connection = new AMQPStreamConnection(
            'localhost', 5672, 'guest', 'guest'
        );
        $this->channel = $this->connection->channel();
    }

    public function setupTopicExchange(): void
    {
        // Создать Topic Exchange
        $this->channel->exchange_declare(
            'user_events',  // exchange name
            'topic',        // type
            false,          // passive
            true,           // durable
            false           // auto_delete
        );

        // Queue для всех событий создания
        $this->channel->queue_declare('user_creations', false, true, false, false);
        $this->channel->queue_bind('user_creations', 'user_events', '*.created');

        // Queue для всех событий пользователя с ID 123
        $this->channel->queue_declare('user_123_events', false, true, false, false);
        $this->channel->queue_bind('user_123_events', 'user_events', 'user.123.*');

        // Queue для всех событий
        $this->channel->queue_declare('all_user_events', false, true, false, false);
        $this->channel->queue_bind('all_user_events', 'user_events', 'user.#');
    }

    public function publishUserEvent(string $routingKey, array $data): void
    {
        $message = new AMQPMessage(
            json_encode($data),
            ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]
        );

        $this->channel->basic_publish($message, 'user_events', $routingKey);
    }

    public function consume(string $queueName, callable $callback): void
    {
        $this->channel->basic_qos(null, 1, null);

        $this->channel->basic_consume(
            $queueName,
            '',
            false,  // no_ack
            false,  // exclusive
            false,  // no_local
            false,  // no_wait
            function ($msg) use ($callback) {
                try {
                    $data = json_decode($msg->body, true);
                    $callback($data);
                    $msg->ack();
                } catch (\Exception $e) {
                    $msg->nack(false, true); // requeue
                }
            }
        );

        while ($this->channel->is_consuming()) {
            $this->channel->wait();
        }
    }

    public function __destruct()
    {
        $this->channel->close();
        $this->connection->close();
    }
}

// Использование
$service = new RabbitMQService();
$service->setupTopicExchange();

// Публикация событий
$service->publishUserEvent('user.created', ['user_id' => 123, 'email' => 'test@test.com']);
$service->publishUserEvent('user.123.updated', ['user_id' => 123, 'name' => 'New Name']);

// Consumer для всех созданий
$service->consume('user_creations', function ($data) {
    echo "User created: " . $data['user_id'] . "\n";
});
```
</details>

### Задание 3: Реализуй Dead Letter Exchange

Создай систему с Dead Letter Exchange для обработки failed сообщений.

<details>
<summary>Решение</summary>

```php
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

class DLXService
{
    private $connection;
    private $channel;

    public function __construct()
    {
        $this->connection = new AMQPStreamConnection(
            'localhost', 5672, 'guest', 'guest'
        );
        $this->channel = $this->connection->channel();
    }

    public function setup(): void
    {
        // Dead Letter Exchange
        $this->channel->exchange_declare(
            'dlx',
            'direct',
            false,
            true,
            false
        );

        // Dead Letter Queue
        $this->channel->queue_declare(
            'failed_jobs',
            false,
            true,    // durable
            false,
            false
        );
        $this->channel->queue_bind('failed_jobs', 'dlx', 'failed');

        // Основная queue с DLX настройками
        $args = new AMQPTable([
            'x-dead-letter-exchange' => 'dlx',
            'x-dead-letter-routing-key' => 'failed',
            'x-message-ttl' => 300000,  // 5 минут TTL
        ]);

        $this->channel->queue_declare(
            'main_queue',
            false,
            true,
            false,
            false,
            false,
            $args
        );
    }

    public function publishToMainQueue(array $data): void
    {
        $message = new AMQPMessage(
            json_encode($data),
            ['delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT]
        );

        $this->channel->basic_publish($message, '', 'main_queue');
    }

    public function consumeMainQueue(): void
    {
        $callback = function ($msg) {
            $data = json_decode($msg->body, true);

            try {
                // Имитация обработки
                if (rand(0, 1) === 0) {
                    throw new \Exception('Processing failed');
                }

                echo "Processed: " . json_encode($data) . "\n";
                $msg->ack();
            } catch (\Exception $e) {
                echo "Failed: " . $e->getMessage() . "\n";

                // Reject без requeue → идёт в DLX
                $msg->nack(false, false);
            }
        };

        $this->channel->basic_qos(null, 1, null);
        $this->channel->basic_consume('main_queue', '', false, false, false, false, $callback);

        while ($this->channel->is_consuming()) {
            $this->channel->wait();
        }
    }

    public function consumeDeadLetterQueue(): void
    {
        $callback = function ($msg) {
            $data = json_decode($msg->body, true);

            echo "Dead letter: " . json_encode($data) . "\n";

            // Логировать, отправить админу, сохранить в БД
            file_put_contents(
                'failed_jobs.log',
                date('Y-m-d H:i:s') . " - " . $msg->body . "\n",
                FILE_APPEND
            );

            $msg->ack();
        };

        $this->channel->basic_consume('failed_jobs', '', false, false, false, false, $callback);

        while ($this->channel->is_consuming()) {
            $this->channel->wait();
        }
    }

    public function __destruct()
    {
        $this->channel->close();
        $this->connection->close();
    }
}

// Использование
$service = new DLXService();
$service->setup();

// Публикация
$service->publishToMainQueue(['task' => 'send_email', 'email' => 'test@test.com']);

// Worker для основной очереди
// $service->consumeMainQueue();

// Worker для failed jobs
// $service->consumeDeadLetterQueue();
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

