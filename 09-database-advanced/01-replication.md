# 9.1 Репликация БД

> **TL;DR:** Репликация копирует данные с Master на Slaves для масштабирования чтения и отказоустойчивости. Master-Slave: запись в master, чтение со slaves. Асинхронная репликация быстро, но replication lag. Laravel: read/write hosts, sticky sessions. Failover через Patroni/MHA.

## Содержание

- [Что это](#что-это)
- [Типы репликации](#типы-репликации)
  - [Master-Slave (Single Leader)](#1-master-slave-single-leader)
  - [Master-Master (Multi-Leader)](#2-master-master-multi-leader)
  - [Multi-Master с partitioning](#3-multi-master-с-partitioning)
- [Синхронная vs Асинхронная](#синхронная-vs-асинхронная)
- [Laravel конфигурация](#laravel-конфигурация)
- [MySQL Репликация](#mysql-репликация)
- [PostgreSQL Репликация](#postgresql-репликация)
- [Replication Lag](#replication-lag)
- [Мониторинг репликации](#мониторинг-репликации)
- [Failover](#failover-переключение-на-реплику)
- [Практические советы](#практические-советы)
- [Практические задания](#практические-задания)
- [На собеседовании скажешь](#на-собеседовании-скажешь)

## Что это

**Репликация:**
Копирование данных с одной БД (master) на одну или несколько других БД (replicas) для обеспечения отказоустойчивости и масштабирования чтения.

**Зачем:**
- Масштабирование чтения (читать с реплик)
- Отказоустойчивость (если master упал)
- Географическое распределение
- Бэкапы без нагрузки на master

---

## Типы репликации

### 1. Master-Slave (Single Leader)

**Схема:**

```
Master (Write)
  ↓ replicate
Slave 1 (Read)
Slave 2 (Read)
Slave 3 (Read)
```

**Как работает:**

```
1. Client пишет в Master
2. Master записывает в binlog
3. Slaves читают binlog и применяют изменения
4. Clients читают со Slaves
```

**Преимущества:**
- ✅ Простая настройка
- ✅ Масштабирование чтения
- ✅ Можно делать бэкапы с Slave

**Недостатки:**
- ❌ Single point of failure (master)
- ❌ Replication lag (задержка)
- ❌ Все записи только в master

---

### 2. Master-Master (Multi-Leader)

**Схема:**

```
Master 1 (Read/Write) ←→ Master 2 (Read/Write)
```

**Преимущества:**
- ✅ Нет single point of failure
- ✅ Можно писать в любой master
- ✅ Географическое распределение

**Недостатки:**
- ❌ Конфликты при одновременной записи
- ❌ Сложная настройка
- ❌ Сложное разрешение конфликтов

**Конфликты:**

```sql
-- В одно время на разных masters:
-- Master 1:
UPDATE users SET name = 'John' WHERE id = 1;

-- Master 2:
UPDATE users SET name = 'Jane' WHERE id = 1;

-- Конфликт! Кто победит?
-- Стратегии:
-- 1. Last Write Wins (LWW) - по timestamp
-- 2. Version vectors
-- 3. Application level resolution
```

---

### 3. Multi-Master с partitioning

**Схема:**

```
Master 1 (users 1-1000) ←→ Master 2 (users 1001-2000)
```

Каждый master отвечает за свою часть данных.

---

## Синхронная vs Асинхронная

### Синхронная репликация:

```
Client → Master
         ↓
      [WAIT] пока Slave подтвердит
         ↓
      Response → Client
```

**Плюсы:**
- ✅ Данные гарантированно на реплике
- ✅ Нет потери данных

**Минусы:**
- ❌ Медленнее (ждём реплику)
- ❌ Если реплика недоступна → запись блокируется

### Асинхронная репликация:

```
Client → Master → Response (сразу)
         ↓
      Slave (позже)
```

**Плюсы:**
- ✅ Быстро (не ждём реплику)
- ✅ Master не зависит от реплик

**Минусы:**
- ❌ Replication lag
- ❌ Можно потерять данные если master упал

---

## Laravel конфигурация

**config/database.php:**

```php
'mysql' => [
    'read' => [
        'host' => [
            '192.168.1.2',  // Slave 1
            '192.168.1.3',  // Slave 2
        ],
    ],
    'write' => [
        'host' => ['192.168.1.1'],  // Master
    ],
    'sticky' => true,  // Читать с write после записи
    'driver' => 'mysql',
    'database' => 'myapp',
    'username' => 'root',
    'password' => 'secret',
],
```

**Использование:**

```php
// Автоматический routing
User::create([...]);  // → Master (write)
User::all();          // → Slave (read)

// Явно использовать write connection
DB::connection('mysql')->useWriteConnection()
    ->select('SELECT * FROM users');

// Sticky session: читать с master после записи
$user = User::create([...]);  // Write → Master
$user->fresh();  // Read → Master (из-за sticky=true)
```

---

## MySQL Репликация

**Настройка Master:**

```ini
# /etc/mysql/my.cnf
[mysqld]
server-id = 1
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW  # or MIXED
```

```sql
-- Создать replication user
CREATE USER 'repl'@'%' IDENTIFIED BY 'password';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
FLUSH PRIVILEGES;

-- Посмотреть позицию binlog
SHOW MASTER STATUS;
-- File: mysql-bin.000001, Position: 154
```

**Настройка Slave:**

```ini
# /etc/mysql/my.cnf
[mysqld]
server-id = 2
relay_log = /var/log/mysql/relay-bin.log
read_only = 1  # Slave только для чтения
```

```sql
-- Подключить к master
CHANGE MASTER TO
  MASTER_HOST='192.168.1.1',
  MASTER_USER='repl',
  MASTER_PASSWORD='password',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=154;

-- Запустить репликацию
START SLAVE;

-- Проверить статус
SHOW SLAVE STATUS\G

-- Seconds_Behind_Master: 0 (нет задержки)
-- Slave_IO_Running: Yes
-- Slave_SQL_Running: Yes
```

---

## PostgreSQL Репликация

**Streaming Replication (асинхронная):**

**Master (primary):**

```ini
# postgresql.conf
wal_level = replica
max_wal_senders = 3
```

```
# pg_hba.conf
host replication repl 192.168.1.2/32 md5
```

```sql
-- Создать replication user
CREATE ROLE repl WITH REPLICATION LOGIN PASSWORD 'password';
```

**Slave (standby):**

```bash
# Создать base backup
pg_basebackup -h 192.168.1.1 -D /var/lib/postgresql/data -U repl -P

# standby.signal (создать пустой файл)
touch /var/lib/postgresql/data/standby.signal
```

```ini
# postgresql.conf
primary_conninfo = 'host=192.168.1.1 port=5432 user=repl password=password'
```

---

## Replication Lag

**Проблема:**

```php
// User создаёт post
$post = Post::create(['title' => 'Hello']);  // Write → Master

// Redirect и сразу читаем
return redirect("/posts/{$post->id}");

// Read → Slave (но replication lag!)
$post = Post::find($id);  // null или старые данные
```

**Решение 1: Sticky sessions**

```php
'sticky' => true,  // Читать с master после записи в сессии
```

**Решение 2: Явно читать с master**

```php
$post = Post::create([...]);

// Читать с master
$post = DB::connection('mysql')
    ->useWriteConnection()
    ->table('posts')
    ->find($post->id);
```

**Решение 3: Retry с задержкой**

```php
$post = Post::create([...]);

// Подождать репликацию
sleep(1);

$post = Post::find($post->id);
```

---

## Мониторинг репликации

**MySQL:**

```sql
SHOW SLAVE STATUS\G

-- Важные поля:
-- Seconds_Behind_Master: задержка в секундах
-- Slave_IO_Running: получение binlog
-- Slave_SQL_Running: применение изменений
-- Last_Error: ошибки репликации
```

**PostgreSQL:**

```sql
-- На master
SELECT * FROM pg_stat_replication;

-- pg_wal_lsn_diff показывает задержку
SELECT pg_wal_lsn_diff(sent_lsn, write_lsn) AS lag_bytes
FROM pg_stat_replication;
```

---

## Failover (переключение на реплику)

**Автоматический failover:**

```
Master (down!) → Slave 1 (promoted to Master)
                 Slave 2 (reconnect to new Master)
```

**Инструменты:**
- MySQL: MHA (Master High Availability)
- PostgreSQL: Patroni, repmgr
- ProxySQL / HAProxy для автоматического routing

**Ручной failover:**

```sql
-- На Slave:
STOP SLAVE;
RESET SLAVE ALL;

-- Сделать Master
SET GLOBAL read_only = 0;

-- Переключить приложение на новый Master
```

---

## Практические советы

**Когда использовать:**

```
✓ > 70% read operations
✓ Нужна высокая доступность
✓ Географическое распределение
✓ Бэкапы без нагрузки на master
```

**Когда НЕ использовать:**

```
❌ 50/50 read/write (не даст прироста)
❌ Маленькая БД (< 1GB)
❌ Нет expertise в поддержке
```

**Best practices:**

```
✓ Мониторинг replication lag
✓ Автоматический failover (Patroni, MHA)
✓ Regular failover drills (тестировать переключение)
✓ Consistent backups (pg_basebackup, mysqldump)
```

---

## Практические задания

### Задание 1: Настройка Read/Write Splitting в Laravel

**Задача:** Настроить Laravel приложение для чтения с реплик и записи в master.

<details>
<summary>Решение</summary>

```php
// config/database.php
'mysql' => [
    'read' => [
        'host' => [
            '192.168.1.2',  // Slave 1
            '192.168.1.3',  // Slave 2
        ],
    ],
    'write' => [
        'host' => ['192.168.1.1'],  // Master
    ],
    'sticky' => true,  // Читать с write после записи в сессии
    'driver' => 'mysql',
    'database' => env('DB_DATABASE', 'forge'),
    'username' => env('DB_USERNAME', 'forge'),
    'password' => env('DB_PASSWORD', ''),
],

// Использование
class UserController extends Controller
{
    public function store(Request $request)
    {
        // Запись → Master
        $user = User::create($request->validated());

        // Чтение → Master (из-за sticky=true)
        return new UserResource($user->fresh());
    }

    public function index()
    {
        // Чтение → Slave (случайная реплика)
        return UserResource::collection(User::paginate(20));
    }

    public function forceWriteConnection()
    {
        // Явно читать с master
        $users = DB::connection('mysql')
            ->useWriteConnection()
            ->table('users')
            ->get();

        return response()->json($users);
    }
}
```

</details>

### Задание 2: Обработка Replication Lag

**Задача:** Реализовать безопасное чтение после записи при наличии replication lag.

<details>
<summary>Решение</summary>

```php
class PostController extends Controller
{
    public function store(Request $request)
    {
        // Создаём пост (запись в master)
        $post = Post::create($request->validated());

        // Решение 1: Читать с master после записи
        $freshPost = DB::connection('mysql')
            ->useWriteConnection()
            ->table('posts')
            ->find($post->id);

        return response()->json($freshPost);
    }

    // Решение 2: Использовать sticky sessions
    public function storeWithSticky(Request $request)
    {
        $post = Post::create($request->validated());

        // С sticky=true автоматически читает с master
        return new PostResource($post);
    }

    // Решение 3: Retry с задержкой
    public function storeWithRetry(Request $request)
    {
        $post = Post::create($request->validated());

        // Подождать репликацию
        $maxAttempts = 3;
        $attempt = 0;

        while ($attempt < $maxAttempts) {
            $found = Post::find($post->id);

            if ($found) {
                return new PostResource($found);
            }

            usleep(100000); // 100ms
            $attempt++;
        }

        // Fallback: читать с master
        return new PostResource(
            Post::on('mysql')->useWriteConnection()->find($post->id)
        );
    }
}
```

</details>

### Задание 3: Мониторинг Replication Lag

**Задача:** Создать Artisan команду для проверки задержки репликации.

<details>
<summary>Решение</summary>

```php
// app/Console/Commands/CheckReplicationLag.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckReplicationLag extends Command
{
    protected $signature = 'db:check-replication';
    protected $description = 'Check database replication lag';

    public function handle()
    {
        $driver = config('database.default');

        if ($driver === 'mysql') {
            $this->checkMySQLReplication();
        } elseif ($driver === 'pgsql') {
            $this->checkPostgreSQLReplication();
        }
    }

    private function checkMySQLReplication()
    {
        $status = DB::select('SHOW SLAVE STATUS')[0] ?? null;

        if (!$status) {
            $this->error('Replication is not configured');
            return;
        }

        $lag = $status->Seconds_Behind_Master;
        $ioRunning = $status->Slave_IO_Running;
        $sqlRunning = $status->Slave_SQL_Running;

        $this->info("Replication Status:");
        $this->line("IO Running: {$ioRunning}");
        $this->line("SQL Running: {$sqlRunning}");
        $this->line("Lag: {$lag} seconds");

        if ($lag > 60) {
            $this->warn("⚠️  High replication lag: {$lag} seconds");
        } elseif ($lag > 10) {
            $this->comment("⚡ Moderate lag: {$lag} seconds");
        } else {
            $this->info("✓ Replication is healthy");
        }

        if ($status->Last_Error) {
            $this->error("Error: {$status->Last_Error}");
        }
    }

    private function checkPostgreSQLReplication()
    {
        $replicas = DB::select('SELECT * FROM pg_stat_replication');

        if (empty($replicas)) {
            $this->error('No replicas found');
            return;
        }

        $this->info("Replication Status:");

        foreach ($replicas as $replica) {
            $lag = DB::selectOne(
                'SELECT pg_wal_lsn_diff(sent_lsn, write_lsn) as lag_bytes FROM pg_stat_replication WHERE pid = ?',
                [$replica->pid]
            )->lag_bytes;

            $lagMB = round($lag / 1024 / 1024, 2);

            $this->line("Replica: {$replica->application_name}");
            $this->line("  State: {$replica->state}");
            $this->line("  Lag: {$lagMB} MB");

            if ($lagMB > 100) {
                $this->warn("  ⚠️  High lag");
            } else {
                $this->info("  ✓ Healthy");
            }
        }
    }
}

// Регистрация в Kernel.php
protected function schedule(Schedule $schedule)
{
    // Проверять каждые 5 минут
    $schedule->command('db:check-replication')
        ->everyFiveMinutes()
        ->emailOutputOnFailure('admin@example.com');
}
```

</details>

---

## На собеседовании скажешь

> "Репликация копирует данные с Master на Slaves для масштабирования чтения и отказоустойчивости. Master-Slave: запись в master, чтение со slaves. Асинхронная репликация: быстро но replication lag. Синхронная: медленнее но без потери данных. Laravel: read/write hosts, sticky sessions. MySQL: binlog репликация, server-id. PostgreSQL: streaming replication, WAL. Failover: автоматически через Patroni/MHA или вручную promote slave. Мониторинг: Seconds_Behind_Master, pg_stat_replication."

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

