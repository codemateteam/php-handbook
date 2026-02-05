# 10.7 Event Sourcing

## Краткое резюме

> **Event Sourcing** — сохранение всех изменений как последовательность событий.
>
> **Принцип:** Не храним текущее состояние, храним события. Состояние = применение всех событий.
>
> **Важно:** EventStore хранит события, Aggregate восстанавливается из событий. Snapshot для оптимизации.

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
Event Sourcing — сохранение всех изменений как последовательность событий (events). Состояние восстанавливается из событий.

**Принцип:**
- Не храним текущее состояние
- Храним все события изменения
- Состояние = применение всех событий

---

## Как работает

**Event:**

```php
// app/Domain/Order/Events/OrderCreated.php
class OrderCreated
{
    public function __construct(
        public readonly string $orderId,
        public readonly string $userId,
        public readonly array $items,
        public readonly DateTimeImmutable $occurredAt
    ) {}

    public function toArray(): array
    {
        return [
            'order_id' => $this->orderId,
            'user_id' => $this->userId,
            'items' => $this->items,
            'occurred_at' => $this->occurredAt->format('Y-m-d H:i:s'),
        ];
    }
}

class OrderItemAdded
{
    public function __construct(
        public readonly string $orderId,
        public readonly int $productId,
        public readonly int $quantity,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}

class OrderPaid
{
    public function __construct(
        public readonly string $orderId,
        public readonly float $amount,
        public readonly DateTimeImmutable $occurredAt
    ) {}
}
```

**Event Store:**

```php
// app/EventSourcing/EventStore.php
class EventStore
{
    public function append(string $aggregateId, object $event): void
    {
        DB::table('events')->insert([
            'aggregate_id' => $aggregateId,
            'event_type' => get_class($event),
            'event_data' => json_encode($event->toArray()),
            'occurred_at' => $event->occurredAt,
        ]);
    }

    public function getEventsForAggregate(string $aggregateId): array
    {
        $rows = DB::table('events')
            ->where('aggregate_id', $aggregateId)
            ->orderBy('occurred_at')
            ->get();

        return $rows->map(function ($row) {
            $eventClass = $row->event_type;
            $data = json_decode($row->event_data, true);

            return $eventClass::fromArray($data);
        })->toArray();
    }
}
```

**Aggregate:**

```php
// app/Domain/Order/Order.php
class Order
{
    private string $id;
    private string $userId;
    private array $items = [];
    private string $status = 'pending';
    private float $total = 0;

    // События для сохранения
    private array $uncommittedEvents = [];

    public static function create(string $id, string $userId, array $items): self
    {
        $order = new self();
        $order->recordThat(new OrderCreated(
            orderId: $id,
            userId: $userId,
            items: $items,
            occurredAt: new DateTimeImmutable()
        ));

        return $order;
    }

    public function addItem(int $productId, int $quantity): void
    {
        $this->recordThat(new OrderItemAdded(
            orderId: $this->id,
            productId: $productId,
            quantity: $quantity,
            occurredAt: new DateTimeImmutable()
        ));
    }

    public function markAsPaid(float $amount): void
    {
        $this->recordThat(new OrderPaid(
            orderId: $this->id,
            amount: $amount,
            occurredAt: new DateTimeImmutable()
        ));
    }

    // Восстановление из событий
    public static function reconstituteFrom(array $events): self
    {
        $order = new self();

        foreach ($events as $event) {
            $order->applyThat($event);
        }

        return $order;
    }

    private function recordThat(object $event): void
    {
        $this->applyThat($event);
        $this->uncommittedEvents[] = $event;
    }

    private function applyThat(object $event): void
    {
        match (get_class($event)) {
            OrderCreated::class => $this->applyOrderCreated($event),
            OrderItemAdded::class => $this->applyOrderItemAdded($event),
            OrderPaid::class => $this->applyOrderPaid($event),
        };
    }

    private function applyOrderCreated(OrderCreated $event): void
    {
        $this->id = $event->orderId;
        $this->userId = $event->userId;
        $this->items = $event->items;
    }

    private function applyOrderItemAdded(OrderItemAdded $event): void
    {
        $this->items[] = [
            'product_id' => $event->productId,
            'quantity' => $event->quantity,
        ];
    }

    private function applyOrderPaid(OrderPaid $event): void
    {
        $this->status = 'paid';
        $this->total = $event->amount;
    }

    public function getUncommittedEvents(): array
    {
        return $this->uncommittedEvents;
    }

    public function clearUncommittedEvents(): void
    {
        $this->uncommittedEvents = [];
    }
}
```

**Repository:**

```php
class OrderRepository
{
    public function __construct(
        private EventStore $eventStore
    ) {}

    public function save(Order $order): void
    {
        foreach ($order->getUncommittedEvents() as $event) {
            $this->eventStore->append($order->getId(), $event);
        }

        $order->clearUncommittedEvents();
    }

    public function find(string $orderId): ?Order
    {
        $events = $this->eventStore->getEventsForAggregate($orderId);

        if (empty($events)) {
            return null;
        }

        return Order::reconstituteFrom($events);
    }
}
```

---

## Когда использовать

**Event Sourcing для:**
- Аудит всех изменений
- Восстановление состояния на любой момент
- Сложная бизнес-логика
- Temporal queries ("как было вчера?")

**НЕ для:**
- Простые CRUD
- Быстрый прототип
- Маленькие проекты

---

## Пример из практики

**Миграция для events:**

```php
Schema::create('events', function (Blueprint $table) {
    $table->id();
    $table->uuid('aggregate_id')->index();
    $table->string('event_type');
    $table->json('event_data');
    $table->timestamp('occurred_at');
    $table->timestamps();
});
```

**Projection (Read Model):**

```php
// app/Projections/OrderProjection.php
class OrderProjection
{
    public function __construct(
        private EventStore $eventStore
    ) {}

    public function projectOrder(string $orderId): array
    {
        $events = $this->eventStore->getEventsForAggregate($orderId);

        $projection = [
            'id' => $orderId,
            'status' => 'pending',
            'items' => [],
            'total' => 0,
        ];

        foreach ($events as $event) {
            match (get_class($event)) {
                OrderCreated::class => $projection['items'] = $event->items,
                OrderItemAdded::class => $projection['items'][] = [
                    'product_id' => $event->productId,
                    'quantity' => $event->quantity,
                ],
                OrderPaid::class => [
                    $projection['status'] = 'paid',
                    $projection['total'] = $event->amount,
                ],
                default => null,
            };
        }

        return $projection;
    }
}
```

**Snapshot (оптимизация):**

```php
// Сохранять snapshot каждые N событий
class SnapshotStore
{
    public function saveSnapshot(string $aggregateId, object $aggregate, int $version): void
    {
        DB::table('snapshots')->updateOrInsert(
            ['aggregate_id' => $aggregateId],
            [
                'aggregate_data' => serialize($aggregate),
                'version' => $version,
                'created_at' => now(),
            ]
        );
    }

    public function getSnapshot(string $aggregateId): ?array
    {
        return DB::table('snapshots')
            ->where('aggregate_id', $aggregateId)
            ->first();
    }
}

// Восстановление из snapshot + события после него
public function find(string $orderId): ?Order
{
    $snapshot = $this->snapshotStore->getSnapshot($orderId);

    if ($snapshot) {
        $order = unserialize($snapshot->aggregate_data);
        $events = $this->eventStore->getEventsAfterVersion(
            $orderId,
            $snapshot->version
        );
    } else {
        $order = new Order();
        $events = $this->eventStore->getEventsForAggregate($orderId);
    }

    return Order::reconstituteFrom($events, $order);
}
```

---

## На собеседовании скажешь

> "Event Sourcing сохраняет все изменения как события. Aggregate записывает события (`recordThat`), применяет (`applyThat`). EventStore хранит события. Состояние восстанавливается из событий. Projection для Read Model. Snapshot для оптимизации (не перечитывать все события). Плюсы: полный аудит, temporal queries, восстановление. Минусы: сложность, eventual consistency. Используется с CQRS. Подходит для сложной бизнес-логики, аудита."

---

## Практические задания

### Задание 1: Реализуй простой EventStore

Создай EventStore с методами сохранения и получения событий.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::create('domain_events', function (Blueprint $table) {
    $table->id();
    $table->uuid('aggregate_id')->index();
    $table->string('aggregate_type');
    $table->string('event_type');
    $table->json('event_data');
    $table->integer('version');
    $table->timestamp('occurred_at');
    $table->timestamps();

    $table->unique(['aggregate_id', 'version']);
});

// app/EventSourcing/EventStore.php
namespace App\EventSourcing;

use Illuminate\Support\Facades\DB;

class EventStore
{
    public function append(
        string $aggregateId,
        string $aggregateType,
        object $event
    ): void {
        $version = $this->getNextVersion($aggregateId);

        DB::table('domain_events')->insert([
            'aggregate_id' => $aggregateId,
            'aggregate_type' => $aggregateType,
            'event_type' => get_class($event),
            'event_data' => json_encode($event->toArray()),
            'version' => $version,
            'occurred_at' => $event->occurredAt ?? now(),
            'created_at' => now(),
        ]);
    }

    public function getEventsForAggregate(string $aggregateId): array
    {
        $rows = DB::table('domain_events')
            ->where('aggregate_id', $aggregateId)
            ->orderBy('version')
            ->get();

        return $rows->map(function ($row) {
            $eventClass = $row->event_type;
            $data = json_decode($row->event_data, true);

            return $eventClass::fromArray($data);
        })->toArray();
    }

    public function getEventsAfterVersion(
        string $aggregateId,
        int $afterVersion
    ): array {
        $rows = DB::table('domain_events')
            ->where('aggregate_id', $aggregateId)
            ->where('version', '>', $afterVersion)
            ->orderBy('version')
            ->get();

        return $rows->map(function ($row) {
            $eventClass = $row->event_type;
            $data = json_decode($row->event_data, true);

            return $eventClass::fromArray($data);
        })->toArray();
    }

    private function getNextVersion(string $aggregateId): int
    {
        $latest = DB::table('domain_events')
            ->where('aggregate_id', $aggregateId)
            ->max('version');

        return ($latest ?? 0) + 1;
    }

    public function getAllEvents(int $limit = 100, int $offset = 0): array
    {
        $rows = DB::table('domain_events')
            ->orderBy('id')
            ->limit($limit)
            ->offset($offset)
            ->get();

        return $rows->map(function ($row) {
            return [
                'id' => $row->id,
                'aggregate_id' => $row->aggregate_id,
                'event_type' => $row->event_type,
                'occurred_at' => $row->occurred_at,
            ];
        })->toArray();
    }
}
```
</details>

### Задание 2: Создай Projection для статистики

Реализуй Projection который подсчитывает общую статистику по заказам.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::create('order_statistics', function (Blueprint $table) {
    $table->id();
    $table->integer('total_orders')->default(0);
    $table->decimal('total_revenue', 12, 2)->default(0);
    $table->integer('pending_orders')->default(0);
    $table->integer('paid_orders')->default(0);
    $table->integer('cancelled_orders')->default(0);
    $table->timestamp('updated_at');
});

// app/Projections/OrderStatisticsProjection.php
namespace App\Projections;

use App\Domain\Order\Events\OrderCreated;
use App\Domain\Order\Events\OrderPaid;
use App\Domain\Order\Events\OrderCancelled;
use Illuminate\Support\Facades\DB;

class OrderStatisticsProjection
{
    public function projectOrderCreated(OrderCreated $event): void
    {
        DB::table('order_statistics')
            ->updateOrInsert(
                ['id' => 1],
                [
                    'total_orders' => DB::raw('total_orders + 1'),
                    'pending_orders' => DB::raw('pending_orders + 1'),
                    'updated_at' => now(),
                ]
            );
    }

    public function projectOrderPaid(OrderPaid $event): void
    {
        DB::table('order_statistics')
            ->where('id', 1)
            ->update([
                'total_revenue' => DB::raw("total_revenue + {$event->amount}"),
                'pending_orders' => DB::raw('pending_orders - 1'),
                'paid_orders' => DB::raw('paid_orders + 1'),
                'updated_at' => now(),
            ]);
    }

    public function projectOrderCancelled(OrderCancelled $event): void
    {
        DB::table('order_statistics')
            ->where('id', 1)
            ->update([
                'pending_orders' => DB::raw('pending_orders - 1'),
                'cancelled_orders' => DB::raw('cancelled_orders + 1'),
                'updated_at' => now(),
            ]);
    }

    public function rebuild(): void
    {
        // Очистка
        DB::table('order_statistics')->truncate();

        // Восстановление из всех событий
        $events = DB::table('domain_events')
            ->where('aggregate_type', 'Order')
            ->orderBy('id')
            ->get();

        foreach ($events as $eventRow) {
            $eventClass = $eventRow->event_type;
            $event = $eventClass::fromArray(
                json_decode($eventRow->event_data, true)
            );

            match (get_class($event)) {
                OrderCreated::class => $this->projectOrderCreated($event),
                OrderPaid::class => $this->projectOrderPaid($event),
                OrderCancelled::class => $this->projectOrderCancelled($event),
                default => null,
            };
        }
    }

    public function getStatistics(): array
    {
        $stats = DB::table('order_statistics')->first();

        return [
            'total_orders' => $stats->total_orders ?? 0,
            'total_revenue' => $stats->total_revenue ?? 0,
            'pending_orders' => $stats->pending_orders ?? 0,
            'paid_orders' => $stats->paid_orders ?? 0,
            'cancelled_orders' => $stats->cancelled_orders ?? 0,
        ];
    }
}

// Listener для автоматического обновления
class UpdateOrderStatistics
{
    public function __construct(
        private OrderStatisticsProjection $projection
    ) {}

    public function handle(object $event): void
    {
        match (get_class($event)) {
            OrderCreated::class => $this->projection->projectOrderCreated($event),
            OrderPaid::class => $this->projection->projectOrderPaid($event),
            OrderCancelled::class => $this->projection->projectOrderCancelled($event),
            default => null,
        };
    }
}
```
</details>

### Задание 3: Реализуй Snapshot механизм

Создай Snapshot систему для оптимизации восстановления больших агрегатов.

<details>
<summary>Решение</summary>

```php
// Migration
Schema::create('aggregate_snapshots', function (Blueprint $table) {
    $table->uuid('aggregate_id')->primary();
    $table->string('aggregate_type');
    $table->text('aggregate_data');
    $table->integer('version');
    $table->timestamps();
});

// app/EventSourcing/SnapshotStore.php
namespace App\EventSourcing;

use Illuminate\Support\Facades\DB;

class SnapshotStore
{
    private const SNAPSHOT_FREQUENCY = 10; // Каждые 10 событий

    public function saveSnapshot(
        string $aggregateId,
        string $aggregateType,
        object $aggregate,
        int $version
    ): void {
        DB::table('aggregate_snapshots')->updateOrInsert(
            ['aggregate_id' => $aggregateId],
            [
                'aggregate_type' => $aggregateType,
                'aggregate_data' => serialize($aggregate),
                'version' => $version,
                'updated_at' => now(),
            ]
        );
    }

    public function getSnapshot(string $aggregateId): ?object
    {
        $row = DB::table('aggregate_snapshots')
            ->where('aggregate_id', $aggregateId)
            ->first();

        if (!$row) {
            return null;
        }

        return (object) [
            'aggregate' => unserialize($row->aggregate_data),
            'version' => $row->version,
        ];
    }

    public function shouldCreateSnapshot(int $eventCount): bool
    {
        return $eventCount % self::SNAPSHOT_FREQUENCY === 0;
    }
}

// app/Repositories/EventSourcedOrderRepository.php
namespace App\Repositories;

use App\Domain\Order\Order;
use App\EventSourcing\EventStore;
use App\EventSourcing\SnapshotStore;

class EventSourcedOrderRepository
{
    public function __construct(
        private EventStore $eventStore,
        private SnapshotStore $snapshotStore
    ) {}

    public function save(Order $order): void
    {
        $events = $order->getUncommittedEvents();

        foreach ($events as $event) {
            $this->eventStore->append(
                $order->getId(),
                'Order',
                $event
            );
        }

        $order->clearUncommittedEvents();

        // Создать snapshot если нужно
        $eventCount = count(
            $this->eventStore->getEventsForAggregate($order->getId())
        );

        if ($this->snapshotStore->shouldCreateSnapshot($eventCount)) {
            $this->snapshotStore->saveSnapshot(
                $order->getId(),
                'Order',
                $order,
                $eventCount
            );
        }
    }

    public function find(string $orderId): ?Order
    {
        // Попытка загрузить snapshot
        $snapshot = $this->snapshotStore->getSnapshot($orderId);

        if ($snapshot) {
            // Восстановить из snapshot
            $order = clone $snapshot->aggregate;

            // Загрузить только новые события после snapshot
            $events = $this->eventStore->getEventsAfterVersion(
                $orderId,
                $snapshot->version
            );
        } else {
            // Создать новый и загрузить все события
            $order = new Order();
            $events = $this->eventStore->getEventsForAggregate($orderId);
        }

        if (empty($events) && !$snapshot) {
            return null;
        }

        // Применить события
        foreach ($events as $event) {
            $order->applyThat($event);
        }

        return $order;
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
