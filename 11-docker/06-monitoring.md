# 12.6 Monitoring и Logging

## Краткое резюме

> **Monitoring** — отслеживание состояния приложения. **Logging** — запись событий.
>
> **Laravel Logging:** каналы (single, daily, stack, slack), уровни (emergency, error, info). **APM:** Telescope для dev, New Relic/Sentry для production.
>
> **Centralized logging:** ELK Stack или Loki. Health checks для uptime monitoring. Alerting через Slack/email при критических событиях.

---

## Содержание

- [Что это](#что-это)
- [Laravel Logging](#laravel-logging)
- [Structured Logging](#structured-logging)
- [Application Performance Monitoring (APM)](#application-performance-monitoring-apm)
- [Metrics и Monitoring](#metrics-и-monitoring)
- [Centralized Logging](#centralized-logging)
- [Health Checks и Uptime Monitoring](#health-checks-и-uptime-monitoring)
- [Alerting](#alerting)
- [Практические советы](#практические-советы)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Monitoring — отслеживание состояния приложения. Logging — запись событий.

**Зачем:**
- Обнаружение проблем
- Анализ производительности
- Debugging production ошибок
- Alerting при критических событиях

---

## Laravel Logging

**Конфигурация (config/logging.php):**

```php
'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['single', 'slack'],
    ],

    'single' => [
        'driver' => 'single',
        'path' => storage_path('logs/laravel.log'),
        'level' => 'debug',
    ],

    'daily' => [
        'driver' => 'daily',
        'path' => storage_path('logs/laravel.log'),
        'level' => 'debug',
        'days' => 14,
    ],

    'slack' => [
        'driver' => 'slack',
        'url' => env('LOG_SLACK_WEBHOOK_URL'),
        'level' => 'critical',
    ],
],
```

**Использование:**

```php
use Illuminate\Support\Facades\Log;

// Разные уровни
Log::emergency($message);  // Система недоступна
Log::alert($message);      // Требует немедленного внимания
Log::critical($message);   // Критическая ошибка
Log::error($message);      // Ошибка
Log::warning($message);    // Предупреждение
Log::notice($message);     // Нормальное, но значимое
Log::info($message);       // Информация
Log::debug($message);      // Отладка

// С контекстом
Log::info('User logged in', [
    'user_id' => $user->id,
    'ip' => $request->ip(),
]);

// Конкретный channel
Log::channel('slack')->critical('Payment gateway is down!');
```

**Custom log channel:**

```php
// config/logging.php
'custom' => [
    'driver' => 'daily',
    'path' => storage_path('logs/payments.log'),
    'level' => 'info',
],

// Использование
Log::channel('custom')->info('Payment processed', ['amount' => 100]);
```

---

## Structured Logging

**JSON logging:**

```php
// config/logging.php
'json' => [
    'driver' => 'daily',
    'path' => storage_path('logs/json.log'),
    'formatter' => Monolog\Formatter\JsonFormatter::class,
],

// Лог будет в JSON
Log::channel('json')->info('User action', [
    'user_id' => 123,
    'action' => 'purchase',
    'amount' => 99.99,
]);

// Результат:
// {"message":"User action","context":{"user_id":123,"action":"purchase","amount":99.99},"level":200,"datetime":"2024-01-15T10:30:00+00:00"}
```

**Correlation ID (для трейсинга):**

```php
// app/Http/Middleware/AddCorrelationId.php
public function handle($request, Closure $next)
{
    $correlationId = $request->header('X-Correlation-ID') ?? Str::uuid();

    Log::withContext(['correlation_id' => $correlationId]);

    $response = $next($request);
    $response->headers->set('X-Correlation-ID', $correlationId);

    return $response;
}

// Теперь все логи будут содержать correlation_id
```

---

## Application Performance Monitoring (APM)

**Laravel Telescope (для development):**

```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

```php
// Доступно на /telescope
// Показывает:
// - Requests
// - Commands
// - Queries
// - Jobs
// - Exceptions
// - Logs
// - Cache
```

**New Relic:**

```bash
# Установить PHP extension
sudo apt-get install newrelic-php5

# Конфигурация
newrelic.appname = "My Laravel App"
newrelic.license = "YOUR_LICENSE_KEY"
```

**Sentry (для error tracking):**

```bash
composer require sentry/sentry-laravel
php artisan sentry:publish --dsn=YOUR_DSN
```

```php
// Автоматически ловит все исключения
// Или вручную:
try {
    $this->processPayment();
} catch (\Exception $e) {
    Sentry::captureException($e);
    Log::error('Payment failed', ['exception' => $e]);
}
```

---

## Metrics и Monitoring

**Prometheus + Grafana:**

```bash
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**Laravel metrics endpoint:**

```php
// routes/web.php
Route::get('/metrics', function () {
    return response()->text(
        "# HELP app_requests_total Total number of requests\n" .
        "# TYPE app_requests_total counter\n" .
        "app_requests_total " . Cache::get('metrics:requests', 0) . "\n\n" .

        "# HELP app_users_active Active users count\n" .
        "# TYPE app_users_active gauge\n" .
        "app_users_active " . User::where('last_seen_at', '>', now()->subMinutes(5))->count() . "\n"
    );
})->middleware('auth:sanctum');
```

**Custom metrics:**

```php
// app/Metrics/RequestCounter.php
class RequestCounter
{
    public static function increment(string $endpoint)
    {
        Cache::increment("metrics:requests:$endpoint");
    }
}

// Middleware
public function handle($request, Closure $next)
{
    RequestCounter::increment($request->path());
    return $next($request);
}
```

---

## Centralized Logging

**ELK Stack (Elasticsearch, Logstash, Kibana):**

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

**Logstash config:**

```
# logstash.conf
input {
  file {
    path => "/var/www/html/storage/logs/laravel.log"
    start_position => "beginning"
  }
}

filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level}: %{GREEDYDATA:message}" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "laravel-logs-%{+YYYY.MM.dd}"
  }
}
```

**Loki + Grafana (lightweight альтернатива):**

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

---

## Health Checks и Uptime Monitoring

**Laravel Health Check:**

```php
// routes/web.php
Route::get('/health', function () {
    $checks = [
        'database' => fn() => DB::connection()->getPdo() !== null,
        'cache' => fn() => Cache::has('health-check-test'),
        'queue' => fn() => Queue::size() < 1000,
        'storage' => fn() => is_writable(storage_path()),
    ];

    $results = [];
    $healthy = true;

    foreach ($checks as $name => $check) {
        try {
            $results[$name] = $check() ? 'OK' : 'FAILED';
            if ($results[$name] === 'FAILED') {
                $healthy = false;
            }
        } catch (\Exception $e) {
            $results[$name] = 'ERROR: ' . $e->getMessage();
            $healthy = false;
        }
    }

    return response()->json([
        'status' => $healthy ? 'healthy' : 'unhealthy',
        'checks' => $results,
        'timestamp' => now(),
    ], $healthy ? 200 : 503);
});
```

**Uptime monitoring (UptimeRobot, Pingdom):**

```
Проверяют /health endpoint каждые 5 минут
Алерты при downtime:
- Email
- Slack
- SMS
```

---

## Alerting

**Slack notifications:**

```php
// config/logging.php
'slack' => [
    'driver' => 'slack',
    'url' => env('LOG_SLACK_WEBHOOK_URL'),
    'username' => 'Laravel Bot',
    'emoji' => ':boom:',
    'level' => 'critical',
],

// Отправить алерт
Log::channel('slack')->critical('Database connection lost!', [
    'server' => gethostname(),
    'timestamp' => now(),
]);
```

**Email alerts:**

```php
// app/Notifications/ServerAlert.php
class ServerAlert extends Notification
{
    public function via($notifiable)
    {
        return ['mail', 'slack'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->error()
            ->subject('Server Alert: High Memory Usage')
            ->line('Memory usage is above 90%')
            ->action('Check Dashboard', url('/admin'));
    }
}

// Отправить
$admins = User::where('role', 'admin')->get();
Notification::send($admins, new ServerAlert($details));
```

---

## Практические советы

**Log rotation:**

```bash
# /etc/logrotate.d/laravel
/var/www/html/storage/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        php /var/www/html/artisan cache:clear
    endscript
}
```

**Не логировать sensitive data:**

```php
// ❌ ПЛОХО
Log::info('User logged in', [
    'password' => $request->password,  // Никогда!
    'credit_card' => $card,
]);

// ✅ ХОРОШО
Log::info('User logged in', [
    'user_id' => $user->id,
    'ip' => $request->ip(),
]);
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Laravel Logging:**
- Каналы: single, daily, stack, slack
- Уровни: emergency, alert, critical, error, warning, notice, info, debug
- `Log::channel('name')` для конкретного канала
- Structured logging через JSON formatter

**APM (Application Performance Monitoring):**
- **Telescope** для development (queries, requests, jobs, exceptions)
- **New Relic** для production (performance, errors, transactions)
- **Sentry** для error tracking и stack traces

**Metrics:**
- Prometheus + Grafana для метрик
- Custom metrics через Cache::increment()
- `/metrics` endpoint в Prometheus format

**Centralized Logging:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Loki + Grafana (lightweight альтернатива)
- Парсинг логов через grok patterns

**Health Checks:**
- `/health` endpoint проверяет DB, Cache, Queue, Storage
- UptimeRobot/Pingdom для uptime monitoring
- Alerting через Slack/email при проблемах

**Best Practices:**
- Log rotation для управления размером
- Correlation ID для трейсинга запросов
- Не логировать пароли, токены, credit cards
- JSON формат для удобного парсинга

---

## Практические задания

### Задание 1: Настрой centralized logging с ELK Stack

Создай полный ELK Stack для Laravel: логи → Logstash → Elasticsearch → визуализация в Kibana.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  # Laravel App
  app:
    image: myapp:latest
    volumes:
      - ./storage/logs:/var/www/html/storage/logs
    networks:
      - elk

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
      - "9300:9300"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - elk
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Logstash
  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    container_name: logstash
    volumes:
      - ./elk/logstash/pipeline:/usr/share/logstash/pipeline
      - ./storage/logs:/var/log/laravel
    ports:
      - "5044:5044"
      - "9600:9600"
    environment:
      - "LS_JAVA_OPTS=-Xms256m -Xmx256m"
    networks:
      - elk
    depends_on:
      - elasticsearch

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    networks:
      - elk
    depends_on:
      - elasticsearch

  # Filebeat (альтернатива для отправки логов)
  filebeat:
    image: docker.elastic.co/beats/filebeat:8.5.0
    container_name: filebeat
    user: root
    volumes:
      - ./elk/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - ./storage/logs:/var/log/laravel:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: filebeat -e -strict.perms=false
    networks:
      - elk
    depends_on:
      - elasticsearch
      - logstash

networks:
  elk:
    driver: bridge

volumes:
  elasticsearch-data:
```

```ruby
# elk/logstash/pipeline/laravel.conf
input {
  file {
    path => "/var/log/laravel/laravel.log"
    start_position => "beginning"
    sincedb_path => "/dev/null"
    codec => multiline {
      pattern => "^\[\d{4}-\d{2}-\d{2}"
      negate => true
      what => "previous"
    }
  }
}

filter {
  # Парсинг Laravel логов
  grok {
    match => {
      "message" => "\[%{TIMESTAMP_ISO8601:timestamp}\] %{DATA:environment}\.%{DATA:level}: %{GREEDYDATA:log_message}"
    }
  }

  # Попытка распарсить JSON context
  if [log_message] =~ /\{.*\}/ {
    grok {
      match => {
        "log_message" => "%{DATA:message} %{GREEDYDATA:context_json}"
      }
    }

    if [context_json] {
      json {
        source => "context_json"
        target => "context"
        remove_field => ["context_json"]
      }
    }
  }

  # Дата
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }

  # Добавить метаданные
  mutate {
    add_field => {
      "application" => "laravel"
      "server" => "%{host}"
    }
    remove_field => ["timestamp", "host"]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "laravel-logs-%{+YYYY.MM.dd}"
  }

  # Для отладки
  stdout {
    codec => rubydebug
  }
}
```

```yaml
# elk/filebeat/filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/laravel/*.log
    multiline.pattern: '^\[\d{4}-\d{2}-\d{2}'
    multiline.negate: true
    multiline.match: after
    fields:
      app: laravel
      environment: production

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "laravel-logs-%{+yyyy.MM.dd}"

setup.kibana:
  host: "kibana:5601"

logging.level: info
```

```php
// config/logging.php - JSON формат для удобного парсинга
'json' => [
    'driver' => 'daily',
    'path' => storage_path('logs/laravel.log'),
    'level' => 'debug',
    'days' => 14,
    'formatter' => Monolog\Formatter\JsonFormatter::class,
],

// Обновить в .env
LOG_CHANNEL=json
```

```bash
# Запуск ELK Stack
docker-compose -f docker-compose.elk.yml up -d

# Проверить что Elasticsearch работает
curl http://localhost:9200/_cluster/health

# Открыть Kibana
# http://localhost:5601

# Создать index pattern в Kibana:
# 1. Management → Index Patterns
# 2. Create index pattern: "laravel-logs-*"
# 3. Time field: @timestamp
# 4. Discover → выбрать laravel-logs-*

# Примеры поиска в Kibana:
# - level: "error"
# - context.user_id: 123
# - message: "Payment failed"
# - @timestamp: [now-1h TO now]

# Создать dashboard:
# 1. Dashboard → Create
# 2. Add visualization
# 3. Metrics:
#    - Error count: level:error
#    - Request count by endpoint: context.endpoint
#    - Response time histogram: context.response_time
```

```php
// app/Http/Middleware/LogRequests.php - Логировать все запросы
public function handle($request, Closure $next)
{
    $startTime = microtime(true);

    $response = $next($request);

    $duration = (microtime(true) - $startTime) * 1000;

    Log::info('HTTP Request', [
        'method' => $request->method(),
        'url' => $request->fullUrl(),
        'ip' => $request->ip(),
        'user_id' => auth()->id(),
        'status' => $response->status(),
        'duration_ms' => round($duration, 2),
    ]);

    return $response;
}
```
</details>

### Задание 2: Реализуй comprehensive health checks

Создай полноценный health check endpoint который проверяет все критические компоненты и возвращает детальный статус.

<details>
<summary>Решение</summary>

```php
// app/Services/HealthCheckService.php
<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Http;

class HealthCheckService
{
    private array $checks = [];
    private bool $isHealthy = true;

    public function runAll(): array
    {
        $this->checkDatabase();
        $this->checkCache();
        $this->checkRedis();
        $this->checkQueue();
        $this->checkStorage();
        $this->checkExternalServices();
        $this->checkDiskSpace();
        $this->checkMemory();

        return [
            'status' => $this->isHealthy ? 'healthy' : 'unhealthy',
            'timestamp' => now()->toIso8601String(),
            'checks' => $this->checks,
            'version' => config('app.version'),
            'environment' => config('app.env'),
        ];
    }

    private function checkDatabase(): void
    {
        $this->runCheck('database', function () {
            $startTime = microtime(true);
            DB::connection()->getPdo();
            $latency = (microtime(true) - $startTime) * 1000;

            return [
                'status' => 'ok',
                'latency_ms' => round($latency, 2),
                'connection' => config('database.default'),
            ];
        });
    }

    private function checkCache(): void
    {
        $this->runCheck('cache', function () {
            $testKey = 'health_check_' . time();
            $testValue = 'test';

            Cache::put($testKey, $testValue, 10);
            $result = Cache::get($testKey) === $testValue;
            Cache::forget($testKey);

            if (!$result) {
                throw new \Exception('Cache write/read failed');
            }

            return [
                'status' => 'ok',
                'driver' => config('cache.default'),
            ];
        });
    }

    private function checkRedis(): void
    {
        $this->runCheck('redis', function () {
            $startTime = microtime(true);
            Redis::ping();
            $latency = (microtime(true) - $startTime) * 1000;

            return [
                'status' => 'ok',
                'latency_ms' => round($latency, 2),
            ];
        });
    }

    private function checkQueue(): void
    {
        $this->runCheck('queue', function () {
            $connection = config('queue.default');
            $size = Queue::size();

            // Предупреждение если очередь слишком большая
            $warning = $size > 1000 ? 'Queue size is high' : null;

            return [
                'status' => $size < 10000 ? 'ok' : 'degraded',
                'connection' => $connection,
                'size' => $size,
                'warning' => $warning,
            ];
        });
    }

    private function checkStorage(): void
    {
        $this->runCheck('storage', function () {
            $testFile = 'health_check.txt';
            $testContent = 'health check ' . time();

            Storage::put($testFile, $testContent);
            $readContent = Storage::get($testFile);
            Storage::delete($testFile);

            if ($readContent !== $testContent) {
                throw new \Exception('Storage write/read failed');
            }

            return [
                'status' => 'ok',
                'disk' => config('filesystems.default'),
                'writable' => is_writable(storage_path()),
            ];
        });
    }

    private function checkExternalServices(): void
    {
        $this->runCheck('external_services', function () {
            $services = [];

            // Проверка API
            if (config('services.payment.enabled')) {
                try {
                    $response = Http::timeout(5)->get(config('services.payment.health_url'));
                    $services['payment_gateway'] = [
                        'status' => $response->successful() ? 'ok' : 'down',
                        'latency_ms' => $response->transferStats?->getTransferTime() * 1000 ?? null,
                    ];
                } catch (\Exception $e) {
                    $services['payment_gateway'] = [
                        'status' => 'down',
                        'error' => $e->getMessage(),
                    ];
                }
            }

            return [
                'status' => 'ok',
                'services' => $services,
            ];
        });
    }

    private function checkDiskSpace(): void
    {
        $this->runCheck('disk_space', function () {
            $path = storage_path();
            $totalSpace = disk_total_space($path);
            $freeSpace = disk_free_space($path);
            $usedPercent = (($totalSpace - $freeSpace) / $totalSpace) * 100;

            $status = 'ok';
            if ($usedPercent > 90) {
                $status = 'critical';
            } elseif ($usedPercent > 80) {
                $status = 'warning';
            }

            return [
                'status' => $status,
                'total_gb' => round($totalSpace / 1024 / 1024 / 1024, 2),
                'free_gb' => round($freeSpace / 1024 / 1024 / 1024, 2),
                'used_percent' => round($usedPercent, 2),
            ];
        });
    }

    private function checkMemory(): void
    {
        $this->runCheck('memory', function () {
            $memoryUsage = memory_get_usage(true);
            $memoryLimit = $this->parseMemoryLimit(ini_get('memory_limit'));
            $usedPercent = ($memoryUsage / $memoryLimit) * 100;

            $status = 'ok';
            if ($usedPercent > 90) {
                $status = 'warning';
            }

            return [
                'status' => $status,
                'used_mb' => round($memoryUsage / 1024 / 1024, 2),
                'limit_mb' => round($memoryLimit / 1024 / 1024, 2),
                'used_percent' => round($usedPercent, 2),
            ];
        });
    }

    private function runCheck(string $name, callable $check): void
    {
        try {
            $result = $check();
            $this->checks[$name] = $result;

            // Если статус не 'ok', пометить как unhealthy
            if (isset($result['status']) && $result['status'] !== 'ok') {
                $this->isHealthy = false;
            }
        } catch (\Exception $e) {
            $this->checks[$name] = [
                'status' => 'error',
                'error' => $e->getMessage(),
            ];
            $this->isHealthy = false;
        }
    }

    private function parseMemoryLimit(string $limit): int
    {
        $limit = trim($limit);
        $last = strtolower($limit[strlen($limit) - 1]);
        $value = (int) $limit;

        switch ($last) {
            case 'g':
                $value *= 1024;
            case 'm':
                $value *= 1024;
            case 'k':
                $value *= 1024;
        }

        return $value;
    }
}
```

```php
// routes/web.php
use App\Services\HealthCheckService;

Route::get('/health', function (HealthCheckService $healthCheck) {
    $result = $healthCheck->runAll();

    return response()->json($result, $result['status'] === 'healthy' ? 200 : 503);
});

// Lightweight health check (только database)
Route::get('/health/liveness', function () {
    try {
        DB::connection()->getPdo();
        return response()->json(['status' => 'alive'], 200);
    } catch (\Exception $e) {
        return response()->json(['status' => 'dead', 'error' => $e->getMessage()], 503);
    }
});

// Readiness check (для Kubernetes)
Route::get('/health/readiness', function () {
    try {
        // Проверить критические зависимости
        DB::connection()->getPdo();
        Cache::get('test');

        return response()->json(['status' => 'ready'], 200);
    } catch (\Exception $e) {
        return response()->json(['status' => 'not_ready', 'error' => $e->getMessage()], 503);
    }
});
```

```bash
# Использование

# Полный health check
curl http://localhost/health | jq

# Результат:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T10:30:00+00:00",
#   "checks": {
#     "database": {
#       "status": "ok",
#       "latency_ms": 2.5,
#       "connection": "mysql"
#     },
#     "cache": {
#       "status": "ok",
#       "driver": "redis"
#     },
#     "queue": {
#       "status": "ok",
#       "size": 45
#     },
#     "disk_space": {
#       "status": "ok",
#       "used_percent": 65.2
#     }
#   }
# }

# Liveness check (Kubernetes)
curl http://localhost/health/liveness

# Readiness check (Kubernetes)
curl http://localhost/health/readiness
```

```yaml
# Kubernetes deployment с health checks
apiVersion: apps/v1
kind: Deployment
metadata:
  name: laravel-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 80

        # Liveness probe - перезапустить если не отвечает
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness probe - не направлять трафик если не готов
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
```

```php
// tests/Feature/HealthCheckTest.php
class HealthCheckTest extends TestCase
{
    /** @test */
    public function health_endpoint_returns_healthy_status()
    {
        $response = $this->get('/health');

        $response->assertStatus(200);
        $response->assertJson(['status' => 'healthy']);
        $response->assertJsonStructure([
            'status',
            'timestamp',
            'checks' => [
                'database',
                'cache',
                'queue',
            ],
        ]);
    }

    /** @test */
    public function health_endpoint_returns_unhealthy_when_database_down()
    {
        // Mock database connection to fail
        DB::shouldReceive('connection')->andThrow(new \Exception('Connection refused'));

        $response = $this->get('/health');

        $response->assertStatus(503);
        $response->assertJson(['status' => 'unhealthy']);
    }
}
```
</details>

### Задание 3: Настрой alerting с автоматическим уведомлением

Создай систему alerting которая автоматически уведомляет в Slack при критических ошибках, высокой нагрузке и downtime.

<details>
<summary>Решение</summary>

```php
// app/Services/AlertService.php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class AlertService
{
    private const ALERT_COOLDOWN = 300; // 5 минут между алертами

    public function criticalError(string $message, array $context = []): void
    {
        $alertKey = 'alert:critical:' . md5($message);

        if ($this->shouldSendAlert($alertKey)) {
            $this->sendSlackAlert([
                'level' => 'critical',
                'emoji' => ':fire:',
                'color' => 'danger',
                'title' => 'Critical Error',
                'message' => $message,
                'context' => $context,
            ]);

            $this->sendEmailAlert($message, $context, 'critical');
            $this->markAlertSent($alertKey);
        }

        Log::critical($message, $context);
    }

    public function highLoad(array $metrics): void
    {
        $alertKey = 'alert:high_load';

        if ($this->shouldSendAlert($alertKey)) {
            $this->sendSlackAlert([
                'level' => 'warning',
                'emoji' => ':warning:',
                'color' => 'warning',
                'title' => 'High Server Load',
                'message' => 'Server load is above threshold',
                'context' => $metrics,
            ]);

            $this->markAlertSent($alertKey);
        }
    }

    public function serviceDown(string $service, string $error): void
    {
        $alertKey = "alert:service_down:$service";

        if ($this->shouldSendAlert($alertKey)) {
            $this->sendSlackAlert([
                'level' => 'critical',
                'emoji' => ':x:',
                'color' => 'danger',
                'title' => "Service Down: $service",
                'message' => $error,
                'context' => [
                    'service' => $service,
                    'timestamp' => now()->toIso8601String(),
                ],
            ]);

            $this->sendEmailAlert("Service Down: $service", ['error' => $error], 'critical');
            $this->markAlertSent($alertKey);
        }
    }

    public function slowQuery(string $query, float $time): void
    {
        $alertKey = 'alert:slow_query';

        if ($this->shouldSendAlert($alertKey, 60)) {
            $this->sendSlackAlert([
                'level' => 'warning',
                'emoji' => ':snail:',
                'color' => 'warning',
                'title' => 'Slow Database Query',
                'message' => "Query took {$time}ms",
                'context' => [
                    'query' => substr($query, 0, 200),
                    'time_ms' => $time,
                ],
            ]);

            $this->markAlertSent($alertKey, 60);
        }
    }

    private function shouldSendAlert(string $key, int $cooldown = self::ALERT_COOLDOWN): bool
    {
        return !Cache::has($key);
    }

    private function markAlertSent(string $key, int $cooldown = self::ALERT_COOLDOWN): void
    {
        Cache::put($key, true, $cooldown);
    }

    private function sendSlackAlert(array $alert): void
    {
        $webhookUrl = config('services.slack.webhook_url');

        if (!$webhookUrl) {
            return;
        }

        $payload = [
            'username' => 'Laravel Alert',
            'icon_emoji' => $alert['emoji'],
            'attachments' => [
                [
                    'color' => $alert['color'],
                    'title' => $alert['title'],
                    'text' => $alert['message'],
                    'fields' => $this->formatContextFields($alert['context'] ?? []),
                    'footer' => config('app.name'),
                    'footer_icon' => 'https://laravel.com/img/favicon/favicon.ico',
                    'ts' => now()->timestamp,
                ],
            ],
        ];

        try {
            Http::post($webhookUrl, $payload);
        } catch (\Exception $e) {
            Log::error('Failed to send Slack alert', [
                'error' => $e->getMessage(),
                'alert' => $alert,
            ]);
        }
    }

    private function sendEmailAlert(string $message, array $context, string $level): void
    {
        $admins = config('monitoring.admin_emails', []);

        foreach ($admins as $email) {
            Mail::to($email)->send(new \App\Mail\AlertMail($message, $context, $level));
        }
    }

    private function formatContextFields(array $context): array
    {
        $fields = [];

        foreach ($context as $key => $value) {
            $fields[] = [
                'title' => ucfirst(str_replace('_', ' ', $key)),
                'value' => is_array($value) ? json_encode($value, JSON_PRETTY_PRINT) : $value,
                'short' => strlen($value) < 40,
            ];
        }

        return $fields;
    }
}
```

```php
// app/Listeners/MonitorApplicationHealth.php
<?php

namespace App\Listeners;

use App\Services\AlertService;
use Illuminate\Support\Facades\DB;

class MonitorApplicationHealth
{
    public function __construct(private AlertService $alert)
    {
    }

    public function handle($event): void
    {
        $this->checkDatabaseConnection();
        $this->checkQueueSize();
        $this->checkDiskSpace();
        $this->checkMemoryUsage();
    }

    private function checkDatabaseConnection(): void
    {
        try {
            DB::connection()->getPdo();
        } catch (\Exception $e) {
            $this->alert->serviceDown('Database', $e->getMessage());
        }
    }

    private function checkQueueSize(): void
    {
        $size = Queue::size();

        if ($size > 5000) {
            $this->alert->highLoad([
                'queue_size' => $size,
                'threshold' => 5000,
            ]);
        }
    }

    private function checkDiskSpace(): void
    {
        $path = storage_path();
        $totalSpace = disk_total_space($path);
        $freeSpace = disk_free_space($path);
        $usedPercent = (($totalSpace - $freeSpace) / $totalSpace) * 100;

        if ($usedPercent > 90) {
            $this->alert->criticalError('Disk space critical', [
                'used_percent' => round($usedPercent, 2),
                'free_gb' => round($freeSpace / 1024 / 1024 / 1024, 2),
            ]);
        }
    }

    private function checkMemoryUsage(): void
    {
        $memoryUsage = memory_get_usage(true);
        $memoryLimit = $this->parseMemoryLimit(ini_get('memory_limit'));
        $usedPercent = ($memoryUsage / $memoryLimit) * 100;

        if ($usedPercent > 90) {
            $this->alert->highLoad([
                'memory_used_percent' => round($usedPercent, 2),
                'memory_used_mb' => round($memoryUsage / 1024 / 1024, 2),
            ]);
        }
    }

    private function parseMemoryLimit(string $limit): int
    {
        $limit = trim($limit);
        $last = strtolower($limit[strlen($limit) - 1]);
        $value = (int) $limit;

        switch ($last) {
            case 'g': $value *= 1024;
            case 'm': $value *= 1024;
            case 'k': $value *= 1024;
        }

        return $value;
    }
}
```

```php
// app/Providers/EventServiceProvider.php
protected $listen = [
    \Illuminate\Database\Events\QueryExecuted::class => [
        MonitorSlowQueries::class,
    ],
    \Illuminate\Queue\Events\JobFailed::class => [
        NotifyJobFailed::class,
    ],
];
```

```php
// app/Listeners/MonitorSlowQueries.php
<?php

namespace App\Listeners;

use Illuminate\Database\Events\QueryExecuted;
use App\Services\AlertService;

class MonitorSlowQueries
{
    public function __construct(private AlertService $alert)
    {
    }

    public function handle(QueryExecuted $event): void
    {
        $threshold = config('monitoring.slow_query_threshold', 1000); // 1 second

        if ($event->time > $threshold) {
            $this->alert->slowQuery($event->sql, $event->time);
        }
    }
}
```

```php
// app/Listeners/NotifyJobFailed.php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobFailed;
use App\Services\AlertService;

class NotifyJobFailed
{
    public function __construct(private AlertService $alert)
    {
    }

    public function handle(JobFailed $event): void
    {
        $this->alert->criticalError('Job Failed', [
            'job' => $event->job->resolveName(),
            'connection' => $event->connectionName,
            'queue' => $event->job->getQueue(),
            'exception' => $event->exception->getMessage(),
        ]);
    }
}
```

```php
// app/Console/Commands/MonitorHealth.php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\HealthCheckService;
use App\Services\AlertService;

class MonitorHealth extends Command
{
    protected $signature = 'monitor:health';
    protected $description = 'Monitor application health and send alerts';

    public function handle(HealthCheckService $healthCheck, AlertService $alert): void
    {
        $result = $healthCheck->runAll();

        if ($result['status'] !== 'healthy') {
            $failedChecks = collect($result['checks'])
                ->filter(fn($check) => $check['status'] !== 'ok')
                ->toArray();

            $alert->criticalError('Health check failed', [
                'failed_checks' => array_keys($failedChecks),
                'details' => $failedChecks,
            ]);
        }

        $this->info('Health check completed: ' . $result['status']);
    }
}
```

```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule): void
{
    // Проверять health каждые 5 минут
    $schedule->command('monitor:health')->everyFiveMinutes();

    // Очистить старые alerts
    $schedule->call(function () {
        Cache::tags('alerts')->flush();
    })->daily();
}
```

```php
// config/monitoring.php
return [
    'admin_emails' => env('MONITORING_ADMIN_EMAILS', '').explode(','),

    'slow_query_threshold' => env('MONITORING_SLOW_QUERY_MS', 1000),

    'thresholds' => [
        'disk_usage_percent' => 90,
        'memory_usage_percent' => 90,
        'queue_size' => 5000,
    ],
];
```

```bash
# .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
MONITORING_ADMIN_EMAILS=admin@example.com,ops@example.com
MONITORING_SLOW_QUERY_MS=1000

# Запустить мониторинг вручную
php artisan monitor:health

# Или через cron (уже настроен в schedule)
* * * * * cd /var/www/html && php artisan schedule:run >> /dev/null 2>&1
```

```php
// Использование в коде
use App\Services\AlertService;

// В контроллере или сервисе
public function processPayment(AlertService $alert)
{
    try {
        $payment = $this->gateway->charge($amount);
    } catch (\Exception $e) {
        $alert->criticalError('Payment gateway failed', [
            'amount' => $amount,
            'error' => $e->getMessage(),
        ]);

        throw $e;
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
