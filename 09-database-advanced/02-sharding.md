# 9.2 Шардинг (Sharding)

> **TL;DR:** Шардинг делит данные на независимые БД для масштабирования записи. Range-based по диапазону ID, Hash-based равномерно. Проблемы: cross-shard queries, unique constraints, resharding. Laravel: multiple connections, ShardManager. Использовать когда > 1TB и write bottleneck.

## Содержание

- [Что это](#что-это)
- [Типы шардинга](#типы-шардинга)
  - [Range-based](#1-range-based-по-диапазону)
  - [Hash-based](#2-hash-based-по-хешу)
  - [Geographic](#3-geographic-географический)
  - [Directory-based](#4-directory-based-справочник)
- [Реализация в Laravel](#реализация-в-laravel)
- [Проблемы шардинга](#проблемы-шардинга)
  - [Cross-shard queries](#1-cross-shard-queries)
  - [Unique constraints](#2-unique-constraints)
  - [Resharding](#3-resharding-добавление-шардов)
- [Шардирование vs Репликация](#шардирование-vs-репликация)
- [Vitess](#vitess-mysql-sharding-solution)
- [Когда использовать шардинг](#когда-использовать-шардинг)
- [Практический пример](#практический-пример)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Шардинг:**
Горизонтальное разделение данных на несколько независимых БД (шардов). Каждый шард содержит часть данных.

**Зачем:**
- Масштабирование записи (write scaling)
- Обход лимитов одной БД
- Географическое распределение
- Изоляция данных

```
До шардинга:
Single DB (10TB, 10M users)

После шардинга:
Shard 1: users 1-2.5M    (2.5TB)
Shard 2: users 2.5M-5M   (2.5TB)
Shard 3: users 5M-7.5M   (2.5TB)
Shard 4: users 7.5M-10M  (2.5TB)
```

---

## Типы шардинга

### 1. Range-based (по диапазону)

**Принцип:**

```
user_id 1-1000      → Shard 1
user_id 1001-2000   → Shard 2
user_id 2001-3000   → Shard 3
```

**Плюсы:**
- ✅ Просто понять
- ✅ Range queries работают (WHERE id BETWEEN 100 AND 200)
- ✅ Легко добавить новый шард

**Минусы:**
- ❌ Неравномерное распределение (hotspots)
- ❌ Старые данные на одном шарде

**Пример:**

```php
function getShardByUserId(int $userId): string
{
    if ($userId <= 1000) return 'shard1';
    if ($userId <= 2000) return 'shard2';
    if ($userId <= 3000) return 'shard3';
    return 'shard4';
}

$shard = getShardByUserId($userId);
DB::connection($shard)->table('users')->find($userId);
```

---

### 2. Hash-based (по хешу)

**Принцип:**

```
user_id 123  → hash(123) % 4 = 3 → Shard 3
user_id 456  → hash(456) % 4 = 0 → Shard 0
user_id 789  → hash(789) % 4 = 1 → Shard 1
```

**Плюсы:**
- ✅ Равномерное распределение
- ✅ Нет hotspots

**Минусы:**
- ❌ Нельзя делать range queries
- ❌ Сложно добавить новый шард (rehashing)

**Пример:**

```php
function getShardByHash(int $userId): string
{
    $shardIndex = $userId % 4;  // 4 шарда
    return "shard$shardIndex";
}

$shard = getShardByHash($userId);
DB::connection($shard)->table('users')->find($userId);
```

---

### 3. Geographic (географический)

**Принцип:**

```
users в USA    → Shard US
users в Europe → Shard EU
users в Asia   → Shard ASIA
```

**Плюсы:**
- ✅ Низкая latency для пользователей
- ✅ Compliance (GDPR - данные в EU)

**Минусы:**
- ❌ Неравномерное распределение
- ❌ Cross-region queries сложные

**Пример:**

```php
function getShardByCountry(string $country): string
{
    return match($country) {
        'US', 'CA', 'MX' => 'shard_americas',
        'GB', 'DE', 'FR' => 'shard_europe',
        'CN', 'JP', 'IN' => 'shard_asia',
        default => 'shard_default'
    };
}
```

---

### 4. Directory-based (справочник)

**Принцип:**

Отдельная таблица mapping:

```sql
CREATE TABLE shard_directory (
    user_id INT PRIMARY KEY,
    shard_id VARCHAR(50)
);

-- user_id 123 → shard2
-- user_id 456 → shard1
```

**Плюсы:**
- ✅ Гибкое распределение
- ✅ Легко переместить user между шардами

**Минусы:**
- ❌ Дополнительный lookup
- ❌ Single point of failure (directory)

---

## Реализация в Laravel

**config/database.php:**

```php
'connections' => [
    'shard_0' => [
        'driver' => 'mysql',
        'host' => '192.168.1.10',
        'database' => 'myapp_shard_0',
        // ...
    ],
    'shard_1' => [
        'driver' => 'mysql',
        'host' => '192.168.1.11',
        'database' => 'myapp_shard_1',
        // ...
    ],
    'shard_2' => [
        'driver' => 'mysql',
        'host' => '192.168.1.12',
        'database' => 'myapp_shard_2',
        // ...
    ],
    'shard_3' => [
        'driver' => 'mysql',
        'host' => '192.168.1.13',
        'database' => 'myapp_shard_3',
        // ...
    ],
],
```

**ShardManager:**

```php
class ShardManager
{
    private const SHARD_COUNT = 4;

    public static function getShardConnection(int $userId): string
    {
        $shardId = $userId % self::SHARD_COUNT;
        return "shard_$shardId";
    }

    public static function getAllShards(): array
    {
        return ['shard_0', 'shard_1', 'shard_2', 'shard_3'];
    }
}
```

**Repository с шардингом:**

```php
class UserRepository
{
    public function find(int $userId): ?User
    {
        $shard = ShardManager::getShardConnection($userId);

        return DB::connection($shard)
            ->table('users')
            ->where('id', $userId)
            ->first();
    }

    public function create(array $data): User
    {
        $userId = $this->generateUserId();
        $shard = ShardManager::getShardConnection($userId);

        DB::connection($shard)
            ->table('users')
            ->insert([...$data, 'id' => $userId]);

        return $this->find($userId);
    }

    public function all(): Collection
    {
        // ❌ Проблема: нужно запросить ВСЕ шарды
        $results = [];

        foreach (ShardManager::getAllShards() as $shard) {
            $users = DB::connection($shard)
                ->table('users')
                ->get();

            $results = array_merge($results, $users->toArray());
        }

        return collect($results);
    }
}
```

---

## Проблемы шардинга

### 1. Cross-shard queries

**Проблема:**

```sql
-- Невозможно сделать JOIN между шардами
SELECT users.name, orders.total
FROM users
JOIN orders ON users.id = orders.user_id
WHERE orders.status = 'pending';
```

**Решение 1: Дублировать данные**

```php
// В каждом шарде хранить нужные данные
// orders table содержит user_name (денормализация)
```

**Решение 2: Application-level JOIN**

```php
// 1. Получить orders со всех шардов
$orders = [];
foreach (ShardManager::getAllShards() as $shard) {
    $shardOrders = DB::connection($shard)
        ->table('orders')
        ->where('status', 'pending')
        ->get();

    $orders = array_merge($orders, $shardOrders->toArray());
}

// 2. Получить users
$userIds = array_unique(array_column($orders, 'user_id'));
$users = [];
foreach ($userIds as $userId) {
    $shard = ShardManager::getShardConnection($userId);
    $user = DB::connection($shard)->table('users')->find($userId);
    $users[$userId] = $user;
}

// 3. Объединить в приложении
foreach ($orders as &$order) {
    $order->user = $users[$order->user_id];
}
```

---

### 2. Unique constraints

**Проблема:**

```sql
-- email должен быть уникальным глобально
-- Но каждый шард - отдельная БД
```

**Решение 1: Global lookup table**

```sql
-- Отдельная БД для уникальных значений
CREATE TABLE global_emails (
    email VARCHAR(255) PRIMARY KEY,
    user_id INT,
    shard_id VARCHAR(50)
);
```

**Решение 2: Distributed ID generation**

```php
// Snowflake ID: timestamp + shard_id + sequence
// Гарантирует уникальность без координации
function generateSnowflakeId(int $shardId): int
{
    $timestamp = (int)(microtime(true) * 1000);
    $sequence = $this->getSequence();

    return ($timestamp << 22) | ($shardId << 12) | $sequence;
}
```

---

### 3. Resharding (добавление шардов)

**Проблема:**

```
Было 4 шарда → Нужно 8 шардов
user_id % 4 → user_id % 8
Данные нужно перераспределить!
```

**Решение: Consistent Hashing**

```php
class ConsistentHashing
{
    private array $ring = [];

    public function addNode(string $node): void
    {
        // Добавить node в несколько позиций (virtual nodes)
        for ($i = 0; $i < 100; $i++) {
            $hash = crc32("$node:$i");
            $this->ring[$hash] = $node;
        }
        ksort($this->ring);
    }

    public function getNode(int $userId): string
    {
        $hash = crc32((string)$userId);

        foreach ($this->ring as $ringHash => $node) {
            if ($hash <= $ringHash) {
                return $node;
            }
        }

        return reset($this->ring);  // First node
    }
}

// При добавлении нового шарда перемещается только ~1/N данных
```

---

## Шардирование vs Репликация

**Репликация:**
- Копия данных на каждом сервере
- Масштабирование чтения
- Master пишет, Slaves читают

**Шардинг:**
- Разные данные на каждом сервере
- Масштабирование записи
- Каждый шард независим

**Комбинация (рекомендуется):**

```
Shard 1 (Master) → Shard 1 (Slave)
Shard 2 (Master) → Shard 2 (Slave)
Shard 3 (Master) → Shard 3 (Slave)
```

---

## Vitess (MySQL sharding solution)

**Что это:**
Open-source система для шардинга MySQL (используется в YouTube, Slack).

**Возможности:**
- Автоматический шардинг
- Resharding без downtime
- Connection pooling
- Query routing

**Архитектура:**

```
Application
    ↓
VTGate (query router)
    ↓
VTTablet → MySQL Shard 1
VTTablet → MySQL Shard 2
VTTablet → MySQL Shard 3
```

---

## Когда использовать шардинг

**Используй когда:**

```
✓ > 1TB данных
✓ > 100M записей
✓ Write bottleneck (не помогает репликация)
✓ Географическое распределение
✓ Regulatory compliance (данные в регионе)
```

**НЕ используй когда:**

```
❌ < 100GB данных (преждевременная оптимизация)
❌ Много cross-shard queries
❌ Нет expertise (сложность возрастает 10x)
❌ Можно вертикально масштабировать
```

**Альтернативы шардингу:**

```
1. Вертикальное масштабирование (больше RAM/CPU)
2. Партиционирование (partition tables)
3. Архив старых данных
4. Денормализация
5. NoSQL (MongoDB, Cassandra - built-in sharding)
```

---

## Практический пример

**Instagram sharding:**

```
Шардинг по user_id:
- 4000+ PostgreSQL шардов
- ~1000 users на шард
- Photos хранятся на том же шарде что user

Lookup:
user_id → shard_id (consistent hashing)

Следствия:
✓ Все photos одного user на одном шарде (локальные JOIN)
✓ Feed generation сложный (нужно запросить N шардов для N followings)
✓ Celebrity problem (шард с Beyoncé перегружен)
```

---

## Практические задания

### Задание 1: Реализация ShardManager

**Задача:** Создать ShardManager с hash-based шардингом для пользователей.

<details>
<parameter name="summary">Решение</summary>

```php
// app/Services/ShardManager.php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class ShardManager
{
    private const SHARD_COUNT = 4;
    private array $shards = ['shard_0', 'shard_1', 'shard_2', 'shard_3'];

    public function getShardConnection(int $userId): string
    {
        $shardId = $userId % self::SHARD_COUNT;
        return "shard_{$shardId}";
    }

    public function getAllShards(): array
    {
        return $this->shards;
    }

    public function query(int $userId, callable $callback)
    {
        $connection = $this->getShardConnection($userId);
        return $callback(DB::connection($connection));
    }

    public function queryAllShards(callable $callback): array
    {
        $results = [];

        foreach ($this->shards as $shard) {
            $shardResults = $callback(DB::connection($shard));
            $results = array_merge($results, $shardResults);
        }

        return $results;
    }
}

// app/Repositories/UserRepository.php
namespace App\Repositories;

use App\Services\ShardManager;

class UserRepository
{
    public function __construct(
        private ShardManager $shardManager
    ) {}

    public function find(int $userId): ?array
    {
        return $this->shardManager->query($userId, function ($db) use ($userId) {
            return $db->table('users')->where('id', $userId)->first();
        });
    }

    public function create(array $data): array
    {
        $userId = $this->generateUserId();
        $data['id'] = $userId;

        $this->shardManager->query($userId, function ($db) use ($data) {
            $db->table('users')->insert($data);
        });

        return $this->find($userId);
    }

    public function findByEmail(string $email): ?array
    {
        // Проблема: нужно искать по всем шардам
        $results = $this->shardManager->queryAllShards(function ($db) use ($email) {
            return $db->table('users')
                ->where('email', $email)
                ->get()
                ->toArray();
        });

        return $results[0] ?? null;
    }

    private function generateUserId(): int
    {
        // Snowflake-like ID generation
        return (int)(microtime(true) * 10000);
    }
}

// config/database.php
'connections' => [
    'shard_0' => [
        'driver' => 'mysql',
        'host' => env('DB_SHARD_0_HOST', '127.0.0.1'),
        'database' => env('DB_SHARD_0_DATABASE', 'app_shard_0'),
        // ...
    ],
    'shard_1' => [
        'driver' => 'mysql',
        'host' => env('DB_SHARD_1_HOST', '127.0.0.1'),
        'database' => env('DB_SHARD_1_DATABASE', 'app_shard_1'),
        // ...
    ],
    // shard_2, shard_3...
],
```

</details>

### Задание 2: Решение проблемы Unique Constraints

**Задача:** Реализовать глобальную уникальность email при шардинге пользователей.

<details>
<parameter name="summary">Решение</summary>

```php
// Migration для global lookup table
Schema::create('global_emails', function (Blueprint $table) {
    $table->string('email')->primary();
    $table->unsignedBigInteger('user_id');
    $table->string('shard_id');
    $table->timestamps();
});

// app/Services/EmailRegistry.php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Exception;

class EmailRegistry
{
    public function register(string $email, int $userId, string $shardId): void
    {
        try {
            DB::table('global_emails')->insert([
                'email' => $email,
                'user_id' => $userId,
                'shard_id' => $shardId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000') { // Duplicate entry
                throw new Exception("Email {$email} is already registered");
            }
            throw $e;
        }
    }

    public function lookup(string $email): ?array
    {
        return DB::table('global_emails')
            ->where('email', $email)
            ->first();
    }

    public function delete(string $email): void
    {
        DB::table('global_emails')->where('email', $email)->delete();
    }
}

// Updated UserRepository
class UserRepository
{
    public function __construct(
        private ShardManager $shardManager,
        private EmailRegistry $emailRegistry
    ) {}

    public function create(array $data): array
    {
        $email = $data['email'];

        // Проверить уникальность
        if ($this->emailRegistry->lookup($email)) {
            throw new Exception("Email {$email} already exists");
        }

        $userId = $this->generateUserId();
        $shardId = $this->shardManager->getShardConnection($userId);

        DB::transaction(function () use ($email, $userId, $shardId, $data) {
            // 1. Зарегистрировать email
            $this->emailRegistry->register($email, $userId, $shardId);

            // 2. Создать пользователя в шарде
            $this->shardManager->query($userId, function ($db) use ($data, $userId) {
                $db->table('users')->insert([...$data, 'id' => $userId]);
            });
        });

        return $this->find($userId);
    }

    public function findByEmail(string $email): ?array
    {
        // Быстрый lookup через registry
        $lookup = $this->emailRegistry->lookup($email);

        if (!$lookup) {
            return null;
        }

        return $this->find($lookup->user_id);
    }
}
```

</details>

### Задание 3: Consistent Hashing для Resharding

**Задача:** Реализовать consistent hashing для минимизации перемещения данных при добавлении шардов.

<details>
<parameter name="summary">Решение</summary>

```php
// app/Services/ConsistentHashing.php
namespace App\Services;

class ConsistentHashing
{
    private array $ring = [];
    private const VIRTUAL_NODES = 150;

    public function __construct(array $nodes = [])
    {
        foreach ($nodes as $node) {
            $this->addNode($node);
        }
    }

    public function addNode(string $node): void
    {
        // Добавляем виртуальные узлы для равномерного распределения
        for ($i = 0; $i < self::VIRTUAL_NODES; $i++) {
            $hash = crc32("{$node}:{$i}");
            $this->ring[$hash] = $node;
        }

        ksort($this->ring);
    }

    public function removeNode(string $node): void
    {
        for ($i = 0; $i < self::VIRTUAL_NODES; $i++) {
            $hash = crc32("{$node}:{$i}");
            unset($this->ring[$hash]);
        }
    }

    public function getNode(int $key): string
    {
        if (empty($this->ring)) {
            throw new \Exception('No nodes available');
        }

        $hash = crc32((string)$key);

        // Найти первый узел >= hash
        foreach ($this->ring as $ringHash => $node) {
            if ($hash <= $ringHash) {
                return $node;
            }
        }

        // Если не нашли, вернуть первый узел (wrap around)
        return reset($this->ring);
    }

    public function getNodes(): array
    {
        return array_unique(array_values($this->ring));
    }
}

// app/Services/ConsistentShardManager.php
namespace App\Services;

class ConsistentShardManager
{
    private ConsistentHashing $hashing;

    public function __construct()
    {
        $this->hashing = new ConsistentHashing([
            'shard_0',
            'shard_1',
            'shard_2',
            'shard_3',
        ]);
    }

    public function getShardConnection(int $userId): string
    {
        return $this->hashing->getNode($userId);
    }

    public function addShard(string $shardId): void
    {
        $this->hashing->addNode($shardId);

        // После добавления нового шарда нужно мигрировать ~1/N данных
        $this->migrateData($shardId);
    }

    private function migrateData(string $newShardId): void
    {
        // Пример: проверить каждого пользователя и переместить если нужно
        // В продакшене делать через background job

        foreach ($this->hashing->getNodes() as $oldShard) {
            if ($oldShard === $newShardId) {
                continue;
            }

            $users = DB::connection($oldShard)
                ->table('users')
                ->select(['id', 'email', 'name'])
                ->get();

            foreach ($users as $user) {
                $correctShard = $this->getShardConnection($user->id);

                if ($correctShard !== $oldShard) {
                    // Переместить на правильный шард
                    DB::connection($correctShard)
                        ->table('users')
                        ->insert((array)$user);

                    DB::connection($oldShard)
                        ->table('users')
                        ->where('id', $user->id)
                        ->delete();
                }
            }
        }
    }
}
```

</details>

---

## На собеседовании скажешь

> "Шардинг делит данные на независимые БД для масштабирования записи. Range-based: по диапазону ID, просто но hotspots. Hash-based: равномерно но нет range queries. Geographic: по регионам для latency. Проблемы: cross-shard queries (application-level JOIN), unique constraints (global lookup table), resharding (consistent hashing). Laravel: multiple connections, ShardManager для routing. Комбинировать с репликацией. Vitess для MySQL sharding. Использовать когда > 1TB и write bottleneck. Альтернативы: вертикальное масштабирование, партиционирование, NoSQL."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

