# 13.6 Scaling и Load Balancing

## Краткое резюме

> **Scaling** — увеличение мощности системы. Vertical (больше ресурсов) vs Horizontal (больше серверов).
>
> **Load Balancer** — распределяет нагрузку между серверами (Nginx). Стратегии: round-robin, least_conn, ip_hash.
>
> **Проблемы:** сессии (решение: Redis), cache (Redis), files (S3, NFS). Database: read replicas, master-slave.

---

## Содержание

- [Что это](#что-это)
- [Vertical vs Horizontal Scaling](#vertical-vs-horizontal-scaling)
- [Load Balancer](#load-balancer)
- [Session management](#session-management)
- [Cache synchronization](#cache-synchronization)
- [File storage synchronization](#file-storage-synchronization)
- [Database scaling](#database-scaling)
- [Queue workers scaling](#queue-workers-scaling)
- [Практические примеры](#практические-примеры)
- [CDN для scaling](#cdn-для-scaling)
- [Monitoring при scaling](#monitoring-при-scaling)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Масштабирование — увеличение мощности системы для обработки растущей нагрузки.

**Типы:**
- **Vertical scaling** (увеличить ресурсы сервера)
- **Horizontal scaling** (добавить серверы)

**Load Balancing:**
Распределение нагрузки между серверами.

---

## Vertical vs Horizontal Scaling

**Vertical (вертикальное):**

```
Было:
Server: 2 CPU, 4GB RAM

Стало:
Server: 8 CPU, 16GB RAM
```

**Плюсы:**
- ✅ Проще (нет изменений в архитектуре)
- ✅ Не нужна синхронизация

**Минусы:**
- ❌ Предел (нельзя бесконечно увеличивать)
- ❌ Single point of failure
- ❌ Downtime при upgrade

**Horizontal (горизонтальное):**

```
Было:
Server 1 (100% нагрузки)

Стало:
Load Balancer
├─ Server 1 (33%)
├─ Server 2 (33%)
└─ Server 3 (33%)
```

**Плюсы:**
- ✅ Почти бесконечное масштабирование
- ✅ High availability
- ✅ Zero downtime deploy

**Минусы:**
- ❌ Сложнее архитектура
- ❌ Нужна синхронизация (sessions, cache, files)

---

## Load Balancer

**Nginx Load Balancer:**

```nginx
# /etc/nginx/conf.d/load-balancer.conf

upstream backend {
    # Round-robin (по умолчанию)
    server 192.168.1.10:80;
    server 192.168.1.11:80;
    server 192.168.1.12:80;
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
}
```

**Стратегии балансировки:**

```nginx
upstream backend {
    # 1. Round-robin (по очереди)
    server server1.com;
    server server2.com;

    # 2. Least connections (на сервер с меньшим количеством соединений)
    least_conn;
    server server1.com;
    server server2.com;

    # 3. IP hash (один клиент → один сервер)
    ip_hash;
    server server1.com;
    server server2.com;

    # 4. Weighted (с весами)
    server server1.com weight=3;  # 3x больше трафика
    server server2.com weight=1;

    # Health checks
    server server1.com max_fails=3 fail_timeout=30s;
    server server2.com backup;  # Используется если остальные недоступны
}
```

---

## Session management

**Проблема:**
На Server 1 сессия пользователя, но следующий request попал на Server 2.

**Решение 1: Sticky sessions**

```nginx
upstream backend {
    ip_hash;  # Один IP → один сервер
    server server1.com;
    server server2.com;
}
```

**Решение 2: Centralized sessions (Redis)**

```env
# .env
SESSION_DRIVER=redis
```

```php
// config/session.php
'driver' => env('SESSION_DRIVER', 'redis'),

'connection' => 'session',

// config/database.php
'redis' => [
    'session' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 2,
    ],
],
```

Теперь все серверы читают сессии из одного Redis.

---

## Cache synchronization

**Проблема:**
Cache на Server 1 не синхронизирован с Server 2.

**Решение: Centralized cache (Redis)**

```env
CACHE_DRIVER=redis
```

```php
// Все серверы используют один Redis
Cache::put('key', 'value', 3600);  // Доступно на всех серверах
```

---

## File storage synchronization

**Проблема:**
Файл загружен на Server 1, но недоступен на Server 2.

**Решение 1: Shared storage (NFS, GlusterFS)**

```bash
# Монтировать shared storage на всех серверах
mount -t nfs storage-server:/shared /var/www/html/storage
```

**Решение 2: Cloud storage (S3)**

```env
FILESYSTEM_DISK=s3
```

```php
// Файлы хранятся в S3, доступны всем серверам
Storage::disk('s3')->put('avatars/1.jpg', $file);
$url = Storage::disk('s3')->url('avatars/1.jpg');
```

---

## Database scaling

**Read replicas:**

```php
// config/database.php
'mysql' => [
    'read' => [
        'host' => [
            '192.168.1.20',  // Read replica 1
            '192.168.1.21',  // Read replica 2
        ],
    ],
    'write' => [
        'host' => ['192.168.1.10'],  // Master
    ],
    'sticky' => true,  // После записи читать с master
],
```

```php
// Laravel автоматически роутит запросы
User::create($data);  // → write (master)
User::all();          // → read (replica)

// Принудительно использовать write connection
DB::connection('mysql')->useWriteConnection()->select(...);
```

**Database sharding:**

```php
// Разделить данных по шардам (по user_id)
$shard = $userId % 4;  // 4 шарда

DB::connection("mysql_shard_$shard")->table('orders')
    ->where('user_id', $userId)
    ->get();
```

---

## Queue workers scaling

**Supervisor для нескольких workers:**

```ini
; /etc/supervisor/conf.d/laravel-worker.conf
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/html/artisan queue:work redis --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=8  ; 8 параллельных workers
user=www-data
```

**Horizontal scaling workers:**

```
Server 1: 8 workers
Server 2: 8 workers
Server 3: 8 workers
     ↓
Shared Redis Queue
```

Все workers работают с одной очередью в Redis.

---

## Практические примеры

**Laravel Octane (для высокой нагрузки):**

```bash
composer require laravel/octane

# Swoole
pecl install swoole
php artisan octane:install --server=swoole

# Запуск
php artisan octane:start --workers=8 --task-workers=4
```

**Производительность:**

```
Apache + mod_php: 100 req/sec
PHP-FPM: 500 req/sec
Octane (Swoole): 2000+ req/sec
```

**Auto-scaling на AWS:**

```yaml
# aws-autoscaling.yml
Resources:
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      MinSize: 2
      MaxSize: 10
      DesiredCapacity: 2
      TargetGroupARNs:
        - !Ref TargetGroup
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate

      # Scale up когда CPU > 70%
      ScalingPolicies:
        - PolicyName: scale-up
          ScalingAdjustment: 2
          Cooldown: 300
          MetricAggregationType: Average
          TargetValue: 70
```

**Docker Swarm:**

```bash
# Инициализация
docker swarm init

# Deploy с 3 репликами
docker stack deploy -c docker-compose.yml myapp

# docker-compose.yml
services:
  app:
    image: myapp:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
```

**Kubernetes:**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: laravel-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: laravel
  template:
    metadata:
      labels:
        app: laravel
    spec:
      containers:
      - name: app
        image: myapp:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# hpa.yaml (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: laravel-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: laravel-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## CDN для scaling

**CloudFlare:**

```
Users → CloudFlare CDN → Origin Server
        (cache статики)
```

**Кеширование страниц:**

```php
// Добавить cache headers
return response()->view('home')
    ->header('Cache-Control', 'public, max-age=3600')
    ->header('CDN-Cache-Control', 'max-age=86400');
```

---

## Monitoring при scaling

**Metrics для каждого сервера:**

```php
// app/Http/Middleware/MetricsMiddleware.php
public function handle($request, Closure $next)
{
    $start = microtime(true);

    $response = $next($request);

    $duration = microtime(true) - $start;

    // Отправить метрики
    Cache::increment('server.' . gethostname() . '.requests');
    Cache::set('server.' . gethostname() . '.response_time', $duration);

    return $response;
}
```

---

## На собеседовании скажешь

> "Scaling: vertical (больше ресурсов) vs horizontal (больше серверов). Load Balancer (Nginx) распределяет запросы: round-robin, least_conn, ip_hash. Проблемы: сессии (решение: Redis), cache (Redis), files (S3, NFS). Database: read replicas для чтения, master для записи. Queue workers: supervisor с numprocs, shared Redis queue. Laravel Octane для высокой производительности. Auto-scaling в облаке (AWS, K8s HPA). CDN для статики."

---

## Практические задания

### Задание 1: Настрой Nginx Load Balancer

Настрой Nginx как load balancer для 3 Laravel серверов с health checks и sticky sessions.

<details>
<summary>Решение</summary>

```nginx
# /etc/nginx/conf.d/load-balancer.conf

upstream laravel_backend {
    # Стратегия балансировки
    least_conn;  # Наименьшее количество соединений

    # Серверы
    server 192.168.1.10:80 weight=3 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:80 weight=2 max_fails=3 fail_timeout=30s;
    server 192.168.1.12:80 weight=1 max_fails=3 fail_timeout=30s backup;

    # Health check (требует nginx-plus или модуль)
    # health_check interval=5s fails=3 passes=2;

    # Sticky sessions (для stateful приложений)
    # ip_hash;  # Один IP → один сервер
}

server {
    listen 80;
    server_name example.com;

    # Логи
    access_log /var/log/nginx/loadbalancer-access.log;
    error_log /var/log/nginx/loadbalancer-error.log;

    location / {
        proxy_pass http://laravel_backend;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Буферизация
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}

# Тестирование
# sudo nginx -t
# sudo systemctl reload nginx

# Проверка балансировки
# for i in {1..10}; do curl -s http://example.com | grep "Server"; done
```
</details>

### Задание 2: Настрой centralized sessions с Redis

Настрой Laravel для работы с несколькими серверами используя Redis для сессий.

<details>
<summary>Решение</summary>

```bash
# 1. Установить Redis на отдельный сервер
sudo apt-get install redis-server

# /etc/redis/redis.conf
bind 0.0.0.0  # Слушать все интерфейсы
requirepass your_strong_password
maxmemory 2gb
maxmemory-policy allkeys-lru  # Удалять старые ключи

# Запустить
sudo systemctl start redis
sudo systemctl enable redis
```

```env
# .env на всех Laravel серверах
SESSION_DRIVER=redis
SESSION_LIFETIME=120

REDIS_HOST=192.168.1.100  # IP Redis сервера
REDIS_PASSWORD=your_strong_password
REDIS_PORT=6379

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
```

```php
// config/session.php
'driver' => env('SESSION_DRIVER', 'redis'),
'connection' => 'session',

// config/database.php
'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),

    'session' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 2,  # Отдельная БД для сессий
    ],

    'cache' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 1,  # Отдельная БД для кеша
    ],

    'queue' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD'),
        'port' => env('REDIS_PORT', 6379),
        'database' => 0,  # Отдельная БД для queue
    ],
],

// Тестирование
// routes/web.php
Route::get('/test-session', function () {
    session(['test_key' => 'Server: ' . gethostname()]);
    return session('test_key');
});

// Запросить несколько раз через load balancer
// curl http://example.com/test-session
// Должен возвращать одинаковое значение независимо от сервера
```
</details>

### Задание 3: Auto-scaling с Docker Swarm

Настрой auto-scaling для Laravel приложения используя Docker Swarm.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    networks:
      - app-network
    environment:
      - APP_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    deploy:
      replicas: 3  # Начальное количество
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    networks:
      - app-network
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
    configs:
      - source: nginx_config
        target: /etc/nginx/nginx.conf

  mysql:
    image: mysql:8.0
    networks:
      - app-network
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
    volumes:
      - mysql-data:/var/lib/mysql
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.db == true

  redis:
    image: redis:alpine
    networks:
      - app-network
    deploy:
      replicas: 1

networks:
  app-network:
    driver: overlay

volumes:
  mysql-data:

configs:
  nginx_config:
    file: ./nginx.conf
```

```bash
# Инициализация Swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml myapp

# Посмотреть сервисы
docker service ls

# Масштабировать вручную
docker service scale myapp_app=5

# Auto-scaling (через внешний сервис)
# Использовать Prometheus + Alertmanager + Custom script

# Мониторинг
docker service ps myapp_app

# Rolling update
docker service update --image myapp:v2 myapp_app

# Логи
docker service logs myapp_app -f
```

```nginx
# nginx.conf для load balancing
upstream app_backend {
    least_conn;
    server app:9000;  # Docker Swarm DNS round-robin
}

server {
    listen 80;

    location / {
        fastcgi_pass app_backend;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/html/public/index.php;
        include fastcgi_params;
    }
}
```

```bash
# Метрики для auto-scaling
# docker-compose.metrics.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

# prometheus.yml
scrape_configs:
  - job_name: 'docker'
    static_configs:
      - targets: ['cadvisor:8080']

# Auto-scaling script (Python)
# if cpu_usage > 70% → scale up
# if cpu_usage < 30% → scale down
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
