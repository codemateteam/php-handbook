# 12.5 Deployment Strategies

## Краткое резюме

> **Deployment strategies** — стратегии развёртывания приложения без простоя.
>
> **Blue-Green:** две идентичные среды, деплой в неактивную, потом переключение. **Rolling:** постепенная замена инстансов. **Canary:** новая версия на малый процент трафика.
>
> **Database migrations:** backward-compatible, Expand-Contract pattern. Health checks для проверки готовности. Rollback через symlink на предыдущий релиз.

---

## Содержание

- [Что это](#что-это)
- [Blue-Green Deployment](#blue-green-deployment)
- [Rolling Deployment](#rolling-deployment)
- [Canary Deployment](#canary-deployment)
- [Recreate](#recreate-с-простоем)
- [Database Migrations в Production](#database-migrations-в-production)
- [Практические примеры](#практические-примеры)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Deployment strategies — стратегии развёртывания приложения на production без простоя.

**Основные стратегии:**
- Blue-Green Deployment
- Rolling Deployment
- Canary Deployment
- Recreate (с простоем)

---

## Blue-Green Deployment

**Принцип:**
Две идентичные среды (Blue и Green). Деплой в неактивную, потом переключение.

**Схема:**

```
Users → Load Balancer → Blue (current, v1.0)
                     → Green (idle, v1.1)

После деплоя:
Users → Load Balancer → Blue (idle, v1.0)
                     → Green (current, v1.1)
```

**Реализация с Docker:**

```bash
# docker-compose.blue.yml
version: '3.8'
services:
  app:
    image: myapp:1.0
    ports:
      - "8000:80"

# docker-compose.green.yml
version: '3.8'
services:
  app:
    image: myapp:1.1
    ports:
      - "8001:80"
```

**Deploy script:**

```bash
#!/bin/bash
set -e

# Определить текущий цвет
if docker ps | grep -q "blue"; then
    CURRENT="blue"
    NEW="green"
    NEW_PORT=8001
else
    CURRENT="green"
    NEW="blue"
    NEW_PORT=8000
fi

echo "Deploying to $NEW"

# Запустить новую версию
docker-compose -f docker-compose.$NEW.yml up -d

# Подождать готовности
sleep 10

# Health check
if curl -f http://localhost:$NEW_PORT/health; then
    echo "Health check passed"

    # Переключить nginx
    sed -i "s/proxy_pass http:\/\/localhost:[0-9]\+/proxy_pass http:\/\/localhost:$NEW_PORT/g" /etc/nginx/sites-available/default
    nginx -s reload

    # Остановить старую версию
    sleep 30  # Подождать завершения текущих запросов
    docker-compose -f docker-compose.$CURRENT.yml down

    echo "Deployment completed"
else
    echo "Health check failed, rolling back"
    docker-compose -f docker-compose.$NEW.yml down
    exit 1
fi
```

**Плюсы:**
- ✅ Zero downtime
- ✅ Instant rollback
- ✅ Testing в production-like среде

**Минусы:**
- ❌ Двойные ресурсы
- ❌ Сложность с database migrations

---

## Rolling Deployment

**Принцип:**
Постепенная замена инстансов по одному.

**Схема:**

```
Было:
Server 1 (v1.0) → v1.1
Server 2 (v1.0)
Server 3 (v1.0)

Шаг 1:
Server 1 (v1.1)
Server 2 (v1.0) → v1.1
Server 3 (v1.0)

Шаг 2:
Server 1 (v1.1)
Server 2 (v1.1)
Server 3 (v1.0) → v1.1

Готово:
Server 1 (v1.1)
Server 2 (v1.1)
Server 3 (v1.1)
```

**Kubernetes Rolling Update:**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: laravel-app
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1  # Максимум 1 под недоступен
      maxSurge: 1        # Максимум 1 под сверх replicas
  template:
    spec:
      containers:
      - name: app
        image: myapp:1.1
```

**Capistrano (для PHP):**

```ruby
# config/deploy.rb
set :application, 'myapp'
set :repo_url, 'git@github.com:user/myapp.git'
set :deploy_to, '/var/www/html'

# Rolling deploy на 3 серверах
server 'server1.example.com', roles: [:app, :web, :db]
server 'server2.example.com', roles: [:app, :web]
server 'server3.example.com', roles: [:app, :web]

namespace :deploy do
  task :restart do
    on roles(:app), in: :sequence, wait: 30 do
      execute :sudo, :systemctl, :reload, 'php8.2-fpm'
    end
  end
end
```

**Плюсы:**
- ✅ Zero downtime
- ✅ Не нужны двойные ресурсы
- ✅ Постепенный rollout

**Минусы:**
- ❌ Медленнее чем blue-green
- ❌ Две версии работают одновременно

---

## Canary Deployment

**Принцип:**
Новая версия на небольшой процент трафика, потом постепенно увеличиваем.

**Схема:**

```
Users (95%) → v1.0
Users (5%)  → v1.1 (canary)

Если OK:
Users (50%) → v1.0
Users (50%) → v1.1

Затем:
Users (100%) → v1.1
```

**Nginx canary:**

```nginx
upstream backend {
    server backend1.example.com weight=95;  # v1.0
    server backend2.example.com weight=5;   # v1.1 (canary)
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

**Kubernetes canary:**

```yaml
# v1 deployment (90% трафика)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-v1
spec:
  replicas: 9

---

# v2 deployment (10% трафика)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-v2
spec:
  replicas: 1
```

**Плюсы:**
- ✅ Тестирование на реальных пользователях
- ✅ Низкий риск
- ✅ Можно откатить для небольшого процента

**Минусы:**
- ❌ Сложная настройка
- ❌ Нужен мониторинг метрик

---

## Recreate (с простоем)

**Принцип:**
Остановить старую версию, запустить новую.

**Реализация:**

```bash
#!/bin/bash
# Простой деплой с downtime

php artisan down  # Maintenance mode

git pull origin main
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

sudo systemctl reload php8.2-fpm

php artisan up  # Выйти из maintenance
```

**Плюсы:**
- ✅ Просто
- ✅ Нет проблем с migrations

**Минусы:**
- ❌ Downtime

---

## Database Migrations в Production

**Проблема:**
Blue-Green и Rolling deployment с несовместимыми migrations.

**Решение: Backward-compatible migrations**

```php
// ❌ ПЛОХО: ломает старую версию
Schema::table('users', function (Blueprint $table) {
    $table->dropColumn('old_field');
    $table->renameColumn('name', 'full_name');
});

// ✅ ХОРОШО: совместимо со старой версией
// Шаг 1: добавить новое поле
Schema::table('users', function (Blueprint $table) {
    $table->string('full_name')->nullable();
});

// Шаг 2 (следующий деплой): заполнить данные
DB::table('users')->whereNull('full_name')->update([
    'full_name' => DB::raw('name')
]);

// Шаг 3 (следующий деплой): удалить старое поле
Schema::table('users', function (Blueprint $table) {
    $table->dropColumn('name');
});
```

**Expand-Contract Pattern:**

```
1. Expand: добавить новые поля/таблицы
   → Deploy новую версию (работает с обоими полями)
2. Migrate: перенести данные
3. Contract: удалить старые поля
   → Deploy финальную версию
```

---

## Практические примеры

**Health check endpoint:**

```php
// routes/web.php
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        Cache::get('health-check');

        return response()->json([
            'status' => 'healthy',
            'version' => config('app.version'),
            'timestamp' => now(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'unhealthy',
            'error' => $e->getMessage(),
        ], 500);
    }
});
```

**Graceful shutdown:**

```php
// app/Console/Commands/GracefulShutdown.php
public function handle()
{
    // Остановить приём новых jobs
    Artisan::call('queue:restart');

    // Подождать завершения текущих
    while (Queue::size() > 0) {
        $this->info('Waiting for ' . Queue::size() . ' jobs...');
        sleep(5);
    }

    $this->info('Shutdown complete');
}
```

**Feature flags:**

```php
// Включить новую функцию только для 10%
if (random_int(1, 100) <= 10) {
    // Новая функция
} else {
    // Старая функция
}

// Или через конфиг
if (config('features.new_payment_flow')) {
    // Новая функция
}
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Blue-Green:**
- Две идентичные среды (Blue и Green)
- Деплой в неактивную среду, тестирование
- Переключение load balancer на новую среду
- Instant rollback — вернуть на старую среду
- Минус: двойные ресурсы, сложность с DB migrations

**Rolling:**
- Постепенная замена инстансов по одному
- maxUnavailable — сколько может быть недоступно
- maxSurge — сколько может быть сверх нормы
- Не нужны двойные ресурсы
- Минус: две версии работают одновременно

**Canary:**
- Новая версия на малый процент трафика (5-10%)
- Постепенное увеличение при успехе
- Мониторинг метрик (ошибки, latency)
- Rollback если метрики ухудшаются
- Для critical изменений

**Database migrations:**
- Backward-compatible migrations обязательны
- Expand-Contract pattern:
  1. Добавить новое поле
  2. Deploy (работает с обоими полями)
  3. Мигрировать данные
  4. Удалить старое поле
- Никогда не делать breaking changes в одном деплое

**Health checks:**
- `/health` endpoint для проверки готовности
- Проверка DB, Cache, Queue
- Graceful shutdown для завершения текущих jobs
- Feature flags для постепенного rollout функций

---

## Практические задания

### Задание 1: Реализуй Blue-Green deployment с Docker

Создай Blue-Green deployment для Laravel с автоматическим health check и переключением nginx.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.blue.yml
version: '3.8'

services:
  app-blue:
    image: myapp:${VERSION}
    container_name: app-blue
    environment:
      - APP_ENV=production
      - APP_VERSION=${VERSION}
      - DB_HOST=mysql
    ports:
      - "8000:80"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 3

networks:
  app-network:
    external: true
```

```yaml
# docker-compose.green.yml
version: '3.8'

services:
  app-green:
    image: myapp:${VERSION}
    container_name: app-green
    environment:
      - APP_ENV=production
      - APP_VERSION=${VERSION}
      - DB_HOST=mysql
    ports:
      - "8001:80"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 3

networks:
  app-network:
    external: true
```

```nginx
# /etc/nginx/sites-available/myapp
upstream backend {
    server localhost:8000;  # Будет меняться на 8000/8001
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        access_log off;
        proxy_pass http://backend/health;
    }
}
```

```bash
#!/bin/bash
# deploy-blue-green.sh
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

echo "🚀 Starting Blue-Green deployment for version $VERSION"

# Определить текущий цвет
CURRENT_COLOR="blue"
if docker ps | grep -q "app-blue"; then
    CURRENT_COLOR="blue"
    NEW_COLOR="green"
    NEW_PORT=8001
else
    CURRENT_COLOR="green"
    NEW_COLOR="blue"
    NEW_PORT=8000
fi

echo "Current: $CURRENT_COLOR"
echo "Deploying to: $NEW_COLOR on port $NEW_PORT"

# Запустить новую версию
echo "📦 Pulling image version $VERSION..."
docker pull myapp:$VERSION

echo "🚀 Starting $NEW_COLOR environment..."
VERSION=$VERSION docker-compose -f docker-compose.$NEW_COLOR.yml up -d

# Подождать готовности
echo "⏳ Waiting for $NEW_COLOR to be ready..."
MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:$NEW_PORT/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        break
    fi

    RETRY=$((RETRY+1))
    echo "Retry $RETRY/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "❌ Health check failed after $MAX_RETRIES attempts"
    echo "🔄 Rolling back..."
    docker-compose -f docker-compose.$NEW_COLOR.yml down
    exit 1
fi

# Запустить миграции
echo "🗄️  Running database migrations..."
docker-compose -f docker-compose.$NEW_COLOR.yml exec -T app-$NEW_COLOR php artisan migrate --force

# Проверить ещё раз после миграций
sleep 3
if ! curl -f http://localhost:$NEW_PORT/health > /dev/null 2>&1; then
    echo "❌ Health check failed after migrations"
    echo "🔄 Rolling back migrations and container..."
    docker-compose -f docker-compose.$NEW_COLOR.yml exec -T app-$NEW_COLOR php artisan migrate:rollback --force
    docker-compose -f docker-compose.$NEW_COLOR.yml down
    exit 1
fi

# Переключить nginx на новый порт
echo "🔄 Switching nginx to $NEW_COLOR (port $NEW_PORT)..."
sudo sed -i "s/server localhost:[0-9]\+;/server localhost:$NEW_PORT;/" /etc/nginx/sites-available/myapp
sudo nginx -t && sudo nginx -s reload

echo "✅ Nginx switched to $NEW_COLOR"

# Подождать завершения текущих запросов
echo "⏳ Waiting for current requests to complete (30s)..."
sleep 30

# Остановить старую версию
echo "🛑 Stopping $CURRENT_COLOR environment..."
docker-compose -f docker-compose.$CURRENT_COLOR.yml down

echo "======================================"
echo "🎉 Deployment completed successfully!"
echo "======================================"
echo "Version: $VERSION"
echo "Active environment: $NEW_COLOR"
echo "Port: $NEW_PORT"
```

```bash
# rollback-blue-green.sh
#!/bin/bash
set -e

echo "⏪ Starting rollback..."

# Определить текущий и предыдущий цвет
if docker ps | grep -q "app-blue"; then
    CURRENT_COLOR="blue"
    PREVIOUS_COLOR="green"
    CURRENT_PORT=8000
    PREVIOUS_PORT=8001
else
    CURRENT_COLOR="green"
    PREVIOUS_COLOR="blue"
    CURRENT_PORT=8001
    PREVIOUS_PORT=8000
fi

echo "Current: $CURRENT_COLOR (port $CURRENT_PORT)"
echo "Rolling back to: $PREVIOUS_COLOR (port $PREVIOUS_PORT)"

# Проверить что предыдущая версия всё ещё существует
if ! docker ps -a | grep -q "app-$PREVIOUS_COLOR"; then
    echo "❌ Previous environment ($PREVIOUS_COLOR) not found!"
    exit 1
fi

# Если предыдущая версия остановлена — запустить
if ! docker ps | grep -q "app-$PREVIOUS_COLOR"; then
    echo "🚀 Starting $PREVIOUS_COLOR environment..."
    docker-compose -f docker-compose.$PREVIOUS_COLOR.yml up -d

    # Подождать готовности
    sleep 10
fi

# Health check
if ! curl -f http://localhost:$PREVIOUS_PORT/health > /dev/null 2>&1; then
    echo "❌ Health check failed for $PREVIOUS_COLOR"
    exit 1
fi

# Переключить nginx обратно
echo "🔄 Switching nginx to $PREVIOUS_COLOR..."
sudo sed -i "s/server localhost:[0-9]\+;/server localhost:$PREVIOUS_PORT;/" /etc/nginx/sites-available/myapp
sudo nginx -t && sudo nginx -s reload

sleep 10

# Остановить текущую (неработающую) версию
echo "🛑 Stopping $CURRENT_COLOR environment..."
docker-compose -f docker-compose.$CURRENT_COLOR.yml down

# Откатить миграции
echo "🗄️  Rolling back database migrations..."
docker-compose -f docker-compose.$PREVIOUS_COLOR.yml exec -T app-$PREVIOUS_COLOR php artisan migrate:rollback --force

echo "======================================"
echo "✅ Rollback completed!"
echo "======================================"
echo "Active environment: $PREVIOUS_COLOR"
```

```bash
# Использование:

# Deploy новой версии
./deploy-blue-green.sh v1.2.0

# Rollback к предыдущей версии
./rollback-blue-green.sh

# Проверить текущий статус
docker ps
curl http://localhost/health
```
</details>

### Задание 2: Реализуй backward-compatible migrations

У тебя есть поле `users.name`, нужно разбить на `first_name` и `last_name` без downtime.

<details>
<summary>Решение</summary>

```php
// database/migrations/2024_01_01_000001_add_first_last_name_to_users.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Шаг 1: Добавить новые поля
     * Deploy: v1.0 → v1.1 (поддерживает оба варианта)
     */
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            // Добавляем новые поля как nullable
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name']);
        });
    }
};
```

```php
// app/Models/User.php (v1.1 - работает с обоими вариантами)
class User extends Authenticatable
{
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'password',
    ];

    // Accessor для обратной совместимости
    public function getNameAttribute($value)
    {
        // Если есть name — используем его
        if ($value) {
            return $value;
        }

        // Иначе собираем из first_name + last_name
        if ($this->first_name && $this->last_name) {
            return $this->first_name . ' ' . $this->last_name;
        }

        return $this->first_name ?? $this->last_name ?? '';
    }

    // Mutator для синхронизации
    public function setFirstNameAttribute($value)
    {
        $this->attributes['first_name'] = $value;

        // Синхронизируем name если есть last_name
        if (isset($this->attributes['last_name'])) {
            $this->attributes['name'] = $value . ' ' . $this->attributes['last_name'];
        }
    }

    public function setLastNameAttribute($value)
    {
        $this->attributes['last_name'] = $value;

        // Синхронизируем name если есть first_name
        if (isset($this->attributes['first_name'])) {
            $this->attributes['name'] = $this->attributes['first_name'] . ' ' . $value;
        }
    }
}
```

```php
// database/migrations/2024_01_02_000001_migrate_name_data.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Шаг 2: Мигрировать данные (после деплоя v1.1)
     * Deploy: v1.1 остаётся, просто мигрируем данные
     */
    public function up()
    {
        // Мигрировать данные порциями для больших таблиц
        DB::table('users')
            ->whereNull('first_name')
            ->whereNull('last_name')
            ->whereNotNull('name')
            ->chunk(1000, function ($users) {
                foreach ($users as $user) {
                    $parts = explode(' ', $user->name, 2);

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'first_name' => $parts[0] ?? '',
                            'last_name' => $parts[1] ?? '',
                        ]);
                }
            });
    }

    public function down()
    {
        // Восстановить name из first_name + last_name
        DB::table('users')
            ->whereNotNull('first_name')
            ->chunk(1000, function ($users) {
                foreach ($users as $user) {
                    $name = trim($user->first_name . ' ' . ($user->last_name ?? ''));

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['name' => $name]);
                }
            });
    }
};
```

```php
// app/Models/User.php (v1.2 - используем только новые поля)
class User extends Authenticatable
{
    protected $fillable = [
        'first_name',  // name удалён из fillable
        'last_name',
        'email',
        'password',
    ];

    // Accessor для обратной совместимости (если кто-то ещё использует name)
    public function getNameAttribute()
    {
        return $this->first_name . ' ' . $this->last_name;
    }
}
```

```php
// database/migrations/2024_01_03_000001_remove_name_from_users.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Шаг 3: Удалить старое поле (после деплоя v1.2)
     * Deploy: v1.2 → v1.3 (использует только new fields)
     */
    public function up()
    {
        // Убедиться что все данные мигрированы
        $unmigrated = DB::table('users')
            ->whereNull('first_name')
            ->whereNull('last_name')
            ->whereNotNull('name')
            ->count();

        if ($unmigrated > 0) {
            throw new \Exception("Found $unmigrated users with unmigrated names. Run migration 2024_01_02_000001 first.");
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable();
        });

        // Восстановить данные
        DB::table('users')->chunk(1000, function ($users) {
            foreach ($users as $user) {
                $name = trim($user->first_name . ' ' . ($user->last_name ?? ''));
                DB::table('users')->where('id', $user->id)->update(['name' => $name]);
            }
        });
    }
};
```

```bash
# Процесс деплоя:

# Деплой v1.1 (добавляет новые поля)
git pull
composer install
php artisan migrate  # Запустит 2024_01_01_000001
# Приложение теперь поддерживает оба варианта (name и first_name/last_name)

# Деплой v1.1 (мигрируем данные) - можно сразу или через некоторое время
php artisan migrate  # Запустит 2024_01_02_000001
# Данные мигрированы, но name поле ещё не удалено

# Деплой v1.2 (обновляем код для использования новых полей)
git pull
composer install
# Код теперь использует first_name/last_name, но name ещё есть

# Деплой v1.3 (удаляем старое поле)
php artisan migrate  # Запустит 2024_01_03_000001
# name поле удалено

# Важно: между каждым шагом можно делать паузу для проверки
```

```php
// Тесты для проверки backward compatibility
// tests/Feature/UserMigrationTest.php
class UserMigrationTest extends TestCase
{
    /** @test */
    public function it_supports_old_name_field()
    {
        // Создать через старое API
        $user = User::create([
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => bcrypt('password'),
        ]);

        // Проверить что работает
        $this->assertEquals('John', $user->first_name);
        $this->assertEquals('Doe', $user->last_name);
        $this->assertEquals('John Doe', $user->name);
    }

    /** @test */
    public function it_supports_new_fields()
    {
        // Создать через новое API
        $user = User::create([
            'first_name' => 'Jane',
            'last_name' => 'Smith',
            'email' => 'jane@example.com',
            'password' => bcrypt('password'),
        ]);

        // Проверить что работает
        $this->assertEquals('Jane Smith', $user->name);
    }
}
```
</details>

### Задание 3: Canary deployment с метриками

Реализуй canary deployment: запусти новую версию для 10% пользователей, мониторь ошибки, автоматически откатывай если error rate > 5%.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.canary.yml
version: '3.8'

services:
  # Production v1 (90%)
  app-v1-1:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-2:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-3:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-4:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-5:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-6:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-7:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-8:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  app-v1-9:
    image: myapp:1.0.0
    environment:
      - APP_VERSION=1.0.0
    networks:
      - app-network
    labels:
      - "version=1.0.0"
      - "canary=false"

  # Canary v2 (10%)
  app-v2-canary:
    image: myapp:2.0.0
    environment:
      - APP_VERSION=2.0.0
      - CANARY=true
    networks:
      - app-network
    labels:
      - "version=2.0.0"
      - "canary=true"

networks:
  app-network:
```

```nginx
# /etc/nginx/sites-available/myapp-canary
upstream backend_v1 {
    # 90% трафика на v1
    server app-v1-1:80;
    server app-v1-2:80;
    server app-v1-3:80;
    server app-v1-4:80;
    server app-v1-5:80;
    server app-v1-6:80;
    server app-v1-7:80;
    server app-v1-8:80;
    server app-v1-9:80;
}

upstream backend_v2 {
    # 10% трафика на v2 (canary)
    server app-v2-canary:80;
}

# Выбор backend на основе random
split_clients "${remote_addr}${http_user_agent}${date_gmt}" $backend {
    90%     backend_v1;
    *       backend_v2;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Добавить версию в заголовок для отладки
        add_header X-App-Version $upstream_addr always;
    }

    location /metrics {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

```php
// app/Http/Middleware/CanaryMetrics.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CanaryMetrics
{
    public function handle($request, Closure $next)
    {
        $version = config('app.version');
        $isCanary = config('app.canary', false);

        $startTime = microtime(true);

        try {
            $response = $next($request);

            // Записать успешный запрос
            $this->recordRequest($version, $isCanary, 'success');

            // Записать latency
            $latency = (microtime(true) - $startTime) * 1000;
            $this->recordLatency($version, $latency);

            return $response;

        } catch (\Exception $e) {
            // Записать ошибку
            $this->recordRequest($version, $isCanary, 'error');

            Log::error('Request failed', [
                'version' => $version,
                'canary' => $isCanary,
                'error' => $e->getMessage(),
                'path' => $request->path(),
            ]);

            throw $e;
        }
    }

    private function recordRequest(string $version, bool $isCanary, string $status)
    {
        $key = "metrics:{$version}:{$status}";
        Cache::increment($key);
        Cache::expire($key, 3600); // 1 hour TTL

        if ($isCanary) {
            Cache::increment("metrics:canary:{$status}");
        }
    }

    private function recordLatency(string $version, float $latency)
    {
        $key = "metrics:{$version}:latency";
        $latencies = Cache::get($key, []);
        $latencies[] = $latency;

        // Хранить только последние 1000 значений
        if (count($latencies) > 1000) {
            $latencies = array_slice($latencies, -1000);
        }

        Cache::put($key, $latencies, 3600);
    }
}
```

```php
// routes/web.php - Metrics endpoint
Route::get('/canary/metrics', function () {
    $v1Metrics = [
        'success' => Cache::get('metrics:1.0.0:success', 0),
        'error' => Cache::get('metrics:1.0.0:error', 0),
        'latency' => Cache::get('metrics:1.0.0:latency', []),
    ];

    $v2Metrics = [
        'success' => Cache::get('metrics:2.0.0:success', 0),
        'error' => Cache::get('metrics:2.0.0:error', 0),
        'latency' => Cache::get('metrics:2.0.0:latency', []),
    ];

    // Вычислить error rate
    $v1Total = $v1Metrics['success'] + $v1Metrics['error'];
    $v1ErrorRate = $v1Total > 0 ? ($v1Metrics['error'] / $v1Total) * 100 : 0;

    $v2Total = $v2Metrics['success'] + $v2Metrics['error'];
    $v2ErrorRate = $v2Total > 0 ? ($v2Metrics['error'] / $v2Total) * 100 : 0;

    // Средняя latency
    $v1AvgLatency = count($v1Metrics['latency']) > 0
        ? array_sum($v1Metrics['latency']) / count($v1Metrics['latency'])
        : 0;

    $v2AvgLatency = count($v2Metrics['latency']) > 0
        ? array_sum($v2Metrics['latency']) / count($v2Metrics['latency'])
        : 0;

    return response()->json([
        'v1' => [
            'requests' => $v1Total,
            'errors' => $v1Metrics['error'],
            'error_rate' => round($v1ErrorRate, 2),
            'avg_latency_ms' => round($v1AvgLatency, 2),
        ],
        'v2_canary' => [
            'requests' => $v2Total,
            'errors' => $v2Metrics['error'],
            'error_rate' => round($v2ErrorRate, 2),
            'avg_latency_ms' => round($v2AvgLatency, 2),
        ],
        'comparison' => [
            'error_rate_diff' => round($v2ErrorRate - $v1ErrorRate, 2),
            'latency_diff_ms' => round($v2AvgLatency - $v1AvgLatency, 2),
        ],
    ]);
})->middleware('auth:sanctum');
```

```bash
#!/bin/bash
# canary-monitor.sh - Мониторинг canary и автоматический rollback

set -e

CANARY_ERROR_THRESHOLD=5.0  # 5% error rate
CANARY_LATENCY_THRESHOLD=150  # 150% от baseline
CHECK_INTERVAL=60  # Проверять каждые 60 секунд
MIN_REQUESTS=100  # Минимум запросов для статистики

echo "🔍 Starting canary monitoring..."
echo "Error threshold: ${CANARY_ERROR_THRESHOLD}%"
echo "Latency threshold: ${CANARY_LATENCY_THRESHOLD}%"

while true; do
    # Получить метрики
    METRICS=$(curl -s http://localhost/canary/metrics)

    V1_ERROR_RATE=$(echo $METRICS | jq -r '.v1.error_rate')
    V2_ERROR_RATE=$(echo $METRICS | jq -r '.v2_canary.error_rate')
    V2_REQUESTS=$(echo $METRICS | jq -r '.v2_canary.requests')

    V1_LATENCY=$(echo $METRICS | jq -r '.v1.avg_latency_ms')
    V2_LATENCY=$(echo $METRICS | jq -r '.v2_canary.avg_latency_ms')

    echo "$(date '+%Y-%m-%d %H:%M:%S') - v1: ${V1_ERROR_RATE}% errors, ${V1_LATENCY}ms | v2: ${V2_ERROR_RATE}% errors, ${V2_LATENCY}ms (${V2_REQUESTS} requests)"

    # Проверить минимум запросов
    if [ $(echo "$V2_REQUESTS < $MIN_REQUESTS" | bc) -eq 1 ]; then
        echo "⏳ Waiting for more requests ($V2_REQUESTS/$MIN_REQUESTS)..."
        sleep $CHECK_INTERVAL
        continue
    fi

    # Проверить error rate
    if [ $(echo "$V2_ERROR_RATE > $CANARY_ERROR_THRESHOLD" | bc) -eq 1 ]; then
        echo "❌ ALERT: Canary error rate too high: ${V2_ERROR_RATE}% (threshold: ${CANARY_ERROR_THRESHOLD}%)"
        echo "🔄 Starting automatic rollback..."

        # Rollback
        docker-compose stop app-v2-canary

        # Уведомить в Slack
        curl -X POST $SLACK_WEBHOOK \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 Canary rollback triggered! Error rate: ${V2_ERROR_RATE}%\"}"

        exit 1
    fi

    # Проверить latency (должна быть не более 150% от baseline)
    LATENCY_PERCENT=$(echo "scale=2; ($V2_LATENCY / $V1_LATENCY) * 100" | bc)

    if [ $(echo "$LATENCY_PERCENT > $CANARY_LATENCY_THRESHOLD" | bc) -eq 1 ]; then
        echo "⚠️  WARNING: Canary latency high: ${V2_LATENCY}ms vs ${V1_LATENCY}ms (${LATENCY_PERCENT}%)"
        # Не rollback автоматически, только предупреждение
    fi

    # Проверить если всё хорошо после достаточного числа запросов
    if [ $(echo "$V2_REQUESTS > 1000" | bc) -eq 1 ] && \
       [ $(echo "$V2_ERROR_RATE < $V1_ERROR_RATE" | bc) -eq 1 ] && \
       [ $(echo "$LATENCY_PERCENT < 110" | bc) -eq 1 ]; then
        echo "✅ Canary is performing well! Ready to promote."
        echo "Requests: $V2_REQUESTS"
        echo "Error rate: $V2_ERROR_RATE% (vs $V1_ERROR_RATE%)"
        echo "Latency: $V2_LATENCY ms (vs $V1_LATENCY ms)"

        # Уведомить о успехе
        curl -X POST $SLACK_WEBHOOK \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"✅ Canary deployment successful! Ready to promote to 100%.\"}"
    fi

    sleep $CHECK_INTERVAL
done
```

```bash
# Запуск canary deployment

# 1. Запустить canary (10%)
docker-compose -f docker-compose.canary.yml up -d

# 2. Запустить мониторинг
./canary-monitor.sh

# 3. Если всё ОК через несколько часов — увеличить до 50%
# Изменить nginx upstream и перезапустить

# 4. Если всё ОК — promote до 100%
# Заменить все v1 на v2
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
