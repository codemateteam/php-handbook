# 12.3 Docker Compose

## Краткое резюме

> **Docker Compose** — инструмент для управления multi-container приложениями через YAML файл.
>
> **Основные секции:** services (контейнеры), networks (сети), volumes (данные). `docker-compose up -d` запускает все сервисы в фоне.
>
> **Для Laravel:** nginx + php + mysql + redis + queue worker в одном docker-compose.yml. `docker-compose exec` для выполнения команд в контейнерах.

---

## Содержание

- [Что это](#что-это)
- [Базовый docker-compose.yml](#базовый-docker-composeyml)
- [Laravel docker-compose.yml](#laravel-docker-composeyml)
- [Настройки services](#настройки-services)
- [Практические примеры](#практические-примеры)
- [Полезные команды](#полезные-команды)
- [Override файлы](#override-файлы)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Docker Compose — инструмент для управления multi-container приложениями. Описывает сервисы в YAML файле.

**Зачем:**
- Запуск нескольких контейнеров одной командой
- Настройка связей между контейнерами
- Управление сетями и volumes

---

## Базовый docker-compose.yml

**Простой пример:**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - .:/var/www/html
    depends_on:
      - mysql

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

**Команды:**

```bash
# Запустить все сервисы
docker-compose up

# Запустить в фоне
docker-compose up -d

# Пересобрать образы
docker-compose up --build

# Остановить
docker-compose down

# Остановить и удалить volumes
docker-compose down -v

# Посмотреть логи
docker-compose logs

# Логи конкретного сервиса
docker-compose logs app

# Выполнить команду
docker-compose exec app php artisan migrate
```

---

## Laravel docker-compose.yml

**Полный стек:**

```yaml
version: '3.8'

services:
  # Nginx
  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
    networks:
      - laravel

  # PHP-FPM
  php:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./:/var/www/html
    environment:
      - DB_HOST=mysql
      - DB_DATABASE=laravel
      - DB_USERNAME=laravel
      - DB_PASSWORD=secret
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    networks:
      - laravel

  # MySQL
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
      MYSQL_USER: laravel
      MYSQL_PASSWORD: secret
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - laravel

  # Redis
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    networks:
      - laravel

  # Queue Worker
  queue:
    build:
      context: .
      dockerfile: Dockerfile
    command: php artisan queue:work --tries=3
    volumes:
      - ./:/var/www/html
    depends_on:
      - mysql
      - redis
    networks:
      - laravel

networks:
  laravel:
    driver: bridge

volumes:
  mysql-data:
```

**Nginx config (docker/nginx/default.conf):**

```nginx
server {
    listen 80;
    index index.php index.html;
    root /var/www/html/public;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

---

## Настройки services

**build:**

```yaml
services:
  app:
    # Простой build
    build: .

    # С параметрами
    build:
      context: .
      dockerfile: Dockerfile.prod
      args:
        PHP_VERSION: 8.2

    # Или использовать готовый образ
    image: php:8.2-fpm
```

**environment:**

```yaml
services:
  app:
    # Переменные окружения
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
      - DB_HOST=mysql

    # Или из файла
    env_file:
      - .env
```

**volumes:**

```yaml
services:
  app:
    volumes:
      # Bind mount (локальная папка)
      - ./:/var/www/html

      # Named volume
      - app-storage:/var/www/html/storage

      # Read-only
      - ./config:/config:ro

volumes:
  app-storage:
```

**ports:**

```yaml
services:
  app:
    ports:
      # host:container
      - "8080:80"

      # Только container (случайный host port)
      - "80"

      # IP:host:container
      - "127.0.0.1:8080:80"
```

**depends_on:**

```yaml
services:
  app:
    depends_on:
      - mysql
      - redis
    # Запустит mysql и redis перед app
    # НО не ждёт готовности MySQL!
```

**networks:**

```yaml
services:
  app:
    networks:
      - frontend
      - backend

networks:
  frontend:
  backend:
```

---

## Практические примеры

**Development setup:**

```yaml
version: '3.8'

services:
  php:
    build: .
    volumes:
      - ./:/var/www/html
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
    ports:
      - "8000:8000"
    command: php artisan serve --host=0.0.0.0

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  mysql-data:
```

**Команды:**

```bash
# Запустить
docker-compose up -d

# Установить зависимости
docker-compose exec php composer install

# Миграции
docker-compose exec php php artisan migrate

# Создать контроллер
docker-compose exec php php artisan make:controller UserController

# Тесты
docker-compose exec php php artisan test

# Посмотреть почту
# http://localhost:8025
```

**Production setup:**

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./public:/var/www/html/public:ro
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro
    depends_on:
      - php

  php:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: always
    volumes:
      - ./storage:/var/www/html/storage
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
    env_file:
      - .env.production

  mysql:
    image: mysql:8
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE}
    volumes:
      - mysql-data:/var/lib/mysql

  redis:
    image: redis:alpine
    restart: always

  queue:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: always
    command: php artisan queue:work --tries=3 --timeout=90
    depends_on:
      - mysql
      - redis

volumes:
  mysql-data:
```

---

## Полезные команды

**Управление:**

```bash
# Пересоздать контейнеры
docker-compose up -d --force-recreate

# Остановить без удаления
docker-compose stop

# Запустить остановленные
docker-compose start

# Перезапустить
docker-compose restart

# Посмотреть статус
docker-compose ps

# Выполнить одноразовую команду
docker-compose run --rm php composer install
```

**Логи:**

```bash
# Все логи
docker-compose logs

# Последние 100 строк
docker-compose logs --tail=100

# В реальном времени
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f php
```

**Масштабирование:**

```bash
# Запустить 3 экземпляра queue worker
docker-compose up -d --scale queue=3
```

---

## Override файлы

**docker-compose.override.yml (автоматически применяется):**

```yaml
# docker-compose.yml
version: '3.8'
services:
  php:
    image: php:8.2-fpm

# docker-compose.override.yml (для локальной разработки)
version: '3.8'
services:
  php:
    volumes:
      - ./:/var/www/html
    environment:
      - XDEBUG_MODE=debug
```

**Использовать конкретный файл:**

```bash
# Production файл
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Docker Compose управляет multi-container приложениями
- Описание всех сервисов в одном YAML файле
- Запуск всего стека одной командой

**Основные секции:**
- **services** — контейнеры (app, mysql, redis)
- **networks** — сети для связи между контейнерами
- **volumes** — персистентные данные

**Команды:**
- `docker-compose up -d` — запустить в фоне
- `docker-compose down` — остановить и удалить
- `docker-compose exec` — выполнить команду в контейнере
- `docker-compose logs` — посмотреть логи
- `--scale` — масштабирование сервисов

**Настройки services:**
- **depends_on** — зависимости (порядок запуска)
- **environment** — переменные окружения
- **volumes** — монтирование папок
- **ports** — проброс портов (host:container)
- **restart: always** — автоматический перезапуск

**Override файлы:**
- `docker-compose.override.yml` — автоматически применяется
- Разные конфиги для dev/prod
- `-f` для указания конкретного файла

**Laravel:**
- Стек: nginx + php + mysql + redis + queue
- Общая сеть для связи по именам (DB_HOST=mysql)
- Named volumes для данных MySQL

---

## Практические задания

### Задание 1: Создай полный Laravel стек с docker-compose

Создай docker-compose.yml для Laravel с nginx, php, mysql, redis и queue worker. Добавь Mailhog для тестирования почты.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Nginx
  nginx:
    image: nginx:alpine
    container_name: laravel-nginx
    ports:
      - "8080:80"
    volumes:
      - ./:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
    networks:
      - laravel

  # PHP-FPM
  php:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: laravel-php
    volumes:
      - ./:/var/www/html
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
      - DB_HOST=mysql
      - DB_DATABASE=laravel
      - DB_USERNAME=laravel
      - DB_PASSWORD=secret
      - REDIS_HOST=redis
      - MAIL_MAILER=smtp
      - MAIL_HOST=mailhog
      - MAIL_PORT=1025
    depends_on:
      - mysql
      - redis
    networks:
      - laravel

  # MySQL
  mysql:
    image: mysql:8
    container_name: laravel-mysql
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
      MYSQL_USER: laravel
      MYSQL_PASSWORD: secret
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - laravel

  # Redis
  redis:
    image: redis:alpine
    container_name: laravel-redis
    ports:
      - "6379:6379"
    networks:
      - laravel

  # Queue Worker
  queue:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: laravel-queue
    command: php artisan queue:work --tries=3 --timeout=90
    volumes:
      - ./:/var/www/html
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    networks:
      - laravel
    restart: unless-stopped

  # Mailhog
  mailhog:
    image: mailhog/mailhog
    container_name: laravel-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    networks:
      - laravel

networks:
  laravel:
    driver: bridge

volumes:
  mysql-data:
```

```nginx
# docker/nginx/default.conf
server {
    listen 80;
    index index.php index.html;
    root /var/www/html/public;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

```dockerfile
# Dockerfile
FROM php:8.2-fpm-alpine

# Установить зависимости
RUN apk add --no-cache \
    git \
    curl \
    zip \
    unzip

# Установить PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Установить Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Создать рабочую директорию
WORKDIR /var/www/html

# Права
RUN chown -R www-data:www-data /var/www/html

USER www-data
```

```bash
# Запустить весь стек
docker-compose up -d

# Установить зависимости
docker-compose exec php composer install

# Создать .env
docker-compose exec php cp .env.example .env

# Сгенерировать ключ
docker-compose exec php php artisan key:generate

# Запустить миграции
docker-compose exec php php artisan migrate

# Проверить приложение
# http://localhost:8080

# Посмотреть почту
# http://localhost:8025

# Логи всех сервисов
docker-compose logs -f

# Остановить всё
docker-compose down

# Остановить и удалить volumes
docker-compose down -v
```
</details>

### Задание 2: Создай override файлы для dev и prod

У тебя базовый docker-compose.yml. Создай docker-compose.override.yml для dev с Xdebug и docker-compose.prod.yml для production без лишних сервисов.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.yml (базовая конфигурация)
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
    networks:
      - laravel

  php:
    build:
      context: .
      dockerfile: Dockerfile
    networks:
      - laravel
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: laravel
    networks:
      - laravel

  redis:
    image: redis:alpine
    networks:
      - laravel

networks:
  laravel:

volumes:
  mysql-data:
```

```yaml
# docker-compose.override.yml (dev - применяется автоматически)
version: '3.8'

services:
  nginx:
    ports:
      - "8080:80"
    volumes:
      - ./:/var/www/html  # Bind mount для hot reload

  php:
    build:
      dockerfile: Dockerfile.dev  # Dev Dockerfile с Xdebug
    volumes:
      - ./:/var/www/html
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
      - XDEBUG_MODE=debug
      - XDEBUG_CONFIG=client_host=host.docker.internal

  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_USER: laravel
      MYSQL_PASSWORD: secret
    ports:
      - "3306:3306"  # Доступ извне для GUI клиентов
    volumes:
      - mysql-data:/var/lib/mysql

  redis:
    ports:
      - "6379:6379"

  # Только для dev
  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"
    networks:
      - laravel

  # Только для dev
  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    environment:
      PMA_HOST: mysql
      PMA_USER: laravel
      PMA_PASSWORD: secret
    ports:
      - "8081:80"
    depends_on:
      - mysql
    networks:
      - laravel
```

```yaml
# docker-compose.prod.yml (production)
version: '3.8'

services:
  nginx:
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      # Read-only для безопасности
      - ./public:/var/www/html/public:ro
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro

  php:
    build:
      dockerfile: Dockerfile.prod  # Prod Dockerfile без Xdebug
    restart: always
    volumes:
      # Только storage (для логов/кеша)
      - ./storage:/var/www/html/storage
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
    env_file:
      - .env.production

  mysql:
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_USER: ${DB_USERNAME}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    # Не пробрасываем порты (доступ только изнутри)

  redis:
    restart: always
    # Не пробрасываем порты

  # Queue worker для production
  queue:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: always
    command: php artisan queue:work --tries=3 --timeout=90
    volumes:
      - ./storage:/var/www/html/storage
    env_file:
      - .env.production
    depends_on:
      - mysql
      - redis
    networks:
      - laravel

  # Scheduler для production
  scheduler:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: always
    command: sh -c "while true; do php artisan schedule:run; sleep 60; done"
    volumes:
      - ./storage:/var/www/html/storage
    env_file:
      - .env.production
    depends_on:
      - mysql
    networks:
      - laravel
```

```bash
# Development (автоматически использует override)
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Build production образы
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Посмотреть итоговую конфигурацию
docker-compose config

# Для production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config
```
</details>

### Задание 3: Масштабируй queue workers

У тебя Laravel приложение с очередями. Настрой docker-compose для запуска нескольких queue workers и настрой балансировку нагрузки для веб-серверов.

<details>
<summary>Решение</summary>

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Nginx Load Balancer
  nginx-lb:
    image: nginx:alpine
    container_name: nginx-loadbalancer
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/lb.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - nginx-1
      - nginx-2
    networks:
      - laravel

  # Nginx Server 1
  nginx-1:
    image: nginx:alpine
    volumes:
      - ./:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
    networks:
      - laravel

  # Nginx Server 2
  nginx-2:
    image: nginx:alpine
    volumes:
      - ./:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
    networks:
      - laravel

  # PHP-FPM (общий для всех nginx)
  php:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./:/var/www/html
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    networks:
      - laravel

  # MySQL
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: laravel
      MYSQL_USER: laravel
      MYSQL_PASSWORD: secret
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - laravel

  # Redis
  redis:
    image: redis:alpine
    networks:
      - laravel

  # Queue Worker (масштабируемый)
  queue:
    build:
      context: .
      dockerfile: Dockerfile
    command: php artisan queue:work --tries=3 --timeout=90 --sleep=3
    volumes:
      - ./:/var/www/html
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    networks:
      - laravel
    restart: unless-stopped
    # НЕ указываем container_name - для масштабирования

  # Horizon (альтернатива множественным queue workers)
  horizon:
    build:
      context: .
      dockerfile: Dockerfile
    command: php artisan horizon
    volumes:
      - ./:/var/www/html
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    networks:
      - laravel
    restart: unless-stopped

networks:
  laravel:

volumes:
  mysql-data:
```

```nginx
# docker/nginx/lb.conf (Load Balancer)
events {
    worker_connections 1024;
}

http {
    upstream backend {
        least_conn;  # Балансировка по наименьшей нагрузке
        server nginx-1:80;
        server nginx-2:80;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
```

```bash
# Запустить с 3 queue workers
docker-compose up -d --scale queue=3

# Проверить что запустилось 3 инстанса
docker-compose ps
# NAME                    COMMAND                  STATUS              PORTS
# laravel_queue_1         "php artisan queue:w…"   Up
# laravel_queue_2         "php artisan queue:w…"   Up
# laravel_queue_3         "php artisan queue:w…"   Up

# Посмотреть логи всех workers
docker-compose logs -f queue

# Масштабировать на лету (до 5 workers)
docker-compose up -d --scale queue=5 --no-recreate

# Уменьшить до 2 workers
docker-compose up -d --scale queue=2 --no-recreate

# Посмотреть статистику ресурсов
docker stats

# Мониторинг queue через Redis CLI
docker-compose exec redis redis-cli
> LLEN queues:default  # Количество jobs в очереди

# Horizon dashboard (если используешь Horizon вместо queue)
# http://localhost/horizon

# Проверить балансировку нагрузки
for i in {1..10}; do
  curl -s http://localhost | grep "Server:"
done
# Должны чередоваться nginx-1 и nginx-2
```

```yaml
# config/horizon.php (если используешь Horizon для автоматического масштабирования)
'environments' => [
    'production' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue' => ['default'],
            'balance' => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 10,
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
            'tries' => 3,
            'timeout' => 90,
        ],
    ],
],
```

```bash
# Альтернатива: docker-compose с фиксированным числом workers
# docker-compose.scale.yml
version: '3.8'

services:
  queue-1:
    build: .
    command: php artisan queue:work
    networks:
      - laravel

  queue-2:
    build: .
    command: php artisan queue:work
    networks:
      - laravel

  queue-3:
    build: .
    command: php artisan queue:work
    networks:
      - laravel
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
