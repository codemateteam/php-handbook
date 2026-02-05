# 12.2 Dockerfile

## Краткое резюме

> **Dockerfile** — файл с инструкциями для создания Docker образа.
>
> **Основные инструкции:** FROM (базовый образ), RUN (команды при сборке), COPY (файлы), CMD (команда запуска), WORKDIR (рабочая директория).
>
> **Важно:** Multi-stage build для оптимизации, кеширование слоёв, .dockerignore для исключения файлов.

---

## Содержание

- [Что это](#что-это)
- [Базовый Dockerfile](#базовый-dockerfile)
- [Инструкции Dockerfile](#инструкции-dockerfile)
- [Laravel Dockerfile](#laravel-dockerfile)
- [Multi-stage build](#multi-stage-build)
- [.dockerignore](#dockerignore)
- [Практические советы](#практические-советы)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Dockerfile — файл с инструкциями для создания Docker образа. Описывает среду приложения.

**Основные инструкции:**
- `FROM` — базовый образ
- `RUN` — выполнить команду при сборке
- `COPY` — скопировать файлы
- `CMD` — команда при запуске контейнера
- `EXPOSE` — открыть порт

---

## Базовый Dockerfile

**Простой пример:**

```dockerfile
# Базовый образ
FROM php:8.2-fpm

# Рабочая директория
WORKDIR /var/www/html

# Скопировать файлы
COPY . /var/www/html

# Установить зависимости
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zip \
    unzip

# Установить Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Установить PHP зависимости
RUN composer install --no-dev --optimize-autoloader

# Открыть порт
EXPOSE 9000

# Команда запуска
CMD ["php-fpm"]
```

**Собрать образ:**

```bash
# Собрать
docker build -t myapp:latest .

# Собрать с тегом
docker build -t myapp:1.0.0 .

# Собрать с именем файла
docker build -f Dockerfile.prod -t myapp:prod .
```

---

## Инструкции Dockerfile

**FROM:**

```dockerfile
# Официальный образ
FROM php:8.2-fpm

# Alpine (меньший размер)
FROM php:8.2-fpm-alpine

# Конкретная версия
FROM php:8.2.10-fpm
```

**WORKDIR:**

```dockerfile
# Установить рабочую директорию
WORKDIR /var/www/html

# Все команды выполняются относительно WORKDIR
```

**COPY vs ADD:**

```dockerfile
# COPY (предпочтительнее)
COPY ./src /var/www/html

# ADD (может распаковывать архивы, скачивать по URL)
ADD https://example.com/file.tar.gz /tmp/
```

**RUN:**

```dockerfile
# Каждый RUN создаёт новый слой
RUN apt-get update
RUN apt-get install -y git

# Лучше: объединить в один слой
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*
```

**ENV:**

```dockerfile
# Установить переменные окружения
ENV APP_ENV=production
ENV APP_DEBUG=false

# Использование
RUN echo $APP_ENV
```

**ARG:**

```dockerfile
# Аргументы для сборки (не доступны в runtime)
ARG PHP_VERSION=8.2

FROM php:${PHP_VERSION}-fpm

# Передать при сборке
# docker build --build-arg PHP_VERSION=8.3 -t myapp .
```

**EXPOSE:**

```dockerfile
# Документация: какой порт использует контейнер
EXPOSE 9000

# Не открывает порт! Нужен -p при docker run
```

**CMD vs ENTRYPOINT:**

```dockerfile
# CMD (можно переопределить при docker run)
CMD ["php-fpm"]

# ENTRYPOINT (всегда выполняется)
ENTRYPOINT ["php-fpm"]

# Комбинация
ENTRYPOINT ["php"]
CMD ["artisan", "serve"]
# docker run myapp → php artisan serve
# docker run myapp tinker → php tinker
```

---

## Laravel Dockerfile

**Production Dockerfile:**

```dockerfile
FROM php:8.2-fpm-alpine

# Установить системные зависимости
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip

# Установить PHP расширения
RUN docker-php-ext-install pdo pdo_mysql zip gd

# Установить Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Рабочая директория
WORKDIR /var/www/html

# Скопировать composer файлы
COPY composer.json composer.lock ./

# Установить зависимости (без dev)
RUN composer install --no-dev --no-scripts --no-autoloader

# Скопировать остальные файлы
COPY . .

# Завершить установку Composer
RUN composer dump-autoload --optimize

# Права доступа
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Laravel оптимизация
RUN php artisan config:cache && \
    php artisan route:cache && \
    php artisan view:cache

EXPOSE 9000

CMD ["php-fpm"]
```

**Development Dockerfile:**

```dockerfile
FROM php:8.2-fpm

# Установить Xdebug для отладки
RUN pecl install xdebug && docker-php-ext-enable xdebug

# Установить зависимости
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip

# PHP расширения
RUN docker-php-ext-install pdo pdo_mysql zip gd

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# В dev не копируем код, используем volume
# docker run -v $(pwd):/var/www/html

EXPOSE 9000

CMD ["php-fpm"]
```

---

## Multi-stage build

**Оптимизация размера:**

```dockerfile
# Stage 1: Build
FROM composer:latest AS composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

# Stage 2: Production
FROM php:8.2-fpm-alpine
WORKDIR /var/www/html

# Скопировать только vendor из первого stage
COPY --from=composer /app/vendor ./vendor
COPY . .

# ... остальные инструкции
```

**С Node.js для assets:**

```dockerfile
# Stage 1: Build assets
FROM node:18 AS node
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Composer
FROM composer:latest AS composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev

# Stage 3: Production
FROM php:8.2-fpm-alpine
WORKDIR /var/www/html

# Скопировать compiled assets
COPY --from=node /app/public/build ./public/build

# Скопировать vendor
COPY --from=composer /app/vendor ./vendor

# Скопировать остальное
COPY . .

CMD ["php-fpm"]
```

---

## .dockerignore

**Исключить из образа:**

```
# .dockerignore
.git
.gitignore
.env
.env.*
node_modules
vendor
storage/logs/*
storage/framework/cache/*
storage/framework/sessions/*
storage/framework/views/*
tests
.phpunit.result.cache
README.md
docker-compose.yml
```

---

## Практические советы

**Кеширование слоёв:**

```dockerfile
# ❌ ПЛОХО: весь код копируется, при изменении кеш сбрасывается
COPY . .
RUN composer install

# ✅ ХОРОШО: сначала composer файлы, потом код
COPY composer.json composer.lock ./
RUN composer install
COPY . .
# Composer кеш сохранится если composer.json не менялся
```

**Health check:**

```dockerfile
# Проверка здоровья контейнера
HEALTHCHECK --interval=30s --timeout=3s \
  CMD php artisan health:check || exit 1
```

**Пользователь:**

```dockerfile
# Не запускать от root
RUN addgroup -g 1000 laravel && \
    adduser -D -u 1000 -G laravel laravel

USER laravel
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Dockerfile — инструкции для создания образа
- Каждая инструкция = слой в образе
- Слои кешируются для быстрой пересборки

**Основные инструкции:**
- **FROM** — базовый образ
- **RUN** — команды при сборке (apt-get, composer)
- **COPY** — копировать файлы из хоста
- **WORKDIR** — рабочая директория
- **CMD** — команда запуска контейнера
- **EXPOSE** — документирует порт

**Multi-stage build:**
- Отдельные stages для разных задач
- Composer в одном stage, Node в другом
- Финальный образ копирует только результаты
- Уменьшает размер образа

**Оптимизация:**
- Alpine образы (меньше размер)
- Объединение RUN команд (меньше слоёв)
- .dockerignore (исключить лишнее)
- Кеширование: сначала зависимости, потом код

**Laravel:**
- Composer install до COPY кода
- Права для storage и bootstrap/cache
- config:cache, route:cache, view:cache для production

---

## Практические задания

### Задание 1: Создай production Dockerfile с оптимизацией

Создай Dockerfile для Laravel с multi-stage build, минимальным размером и кешированием.

<details>
<summary>Решение</summary>

```dockerfile
# Stage 1: Composer dependencies
FROM composer:latest AS composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist

# Stage 2: Node assets (если нужны)
FROM node:18-alpine AS node
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY resources ./resources
COPY vite.config.js ./
RUN npm run build

# Stage 3: Production image
FROM php:8.2-fpm-alpine

# Установить системные зависимости (минимум)
RUN apk add --no-cache \
    libpng \
    libzip \
    mysql-client \
    && apk add --no-cache --virtual .build-deps \
    libpng-dev \
    libzip-dev \
    && docker-php-ext-install \
    pdo_mysql \
    zip \
    gd \
    opcache \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/*

# Opcache для production
RUN echo "opcache.enable=1" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.memory_consumption=256" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.max_accelerated_files=20000" >> /usr/local/etc/php/conf.d/opcache.ini

WORKDIR /var/www/html

# Скопировать vendor из composer stage
COPY --from=composer /app/vendor ./vendor

# Скопировать built assets из node stage
COPY --from=node /app/public/build ./public/build

# Скопировать код приложения
COPY --chown=www-data:www-data . .

# Завершить composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
RUN composer dump-autoload --optimize --classmap-authoritative

# Права (только storage и cache)
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Laravel оптимизация для production
RUN php artisan config:cache \
    && php artisan route:cache \
    && php artisan view:cache \
    && php artisan event:cache

# Удалить composer (не нужен в production)
RUN rm /usr/bin/composer

# Переключиться на www-data
USER www-data

EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD php artisan inspire || exit 1

CMD ["php-fpm"]
```

**Результат:**
- Размер образа: ~100-150MB (вместо 500MB+)
- Только production зависимости
- Opcache включен
- Кеш Laravel предварительно создан
- Безопасность: работает от www-data

</details>

### Задание 2: Development Dockerfile с hot reload

Создай development Dockerfile с Xdebug и автоматической перезагрузкой.

<details>
<summary>Решение</summary>

```dockerfile
FROM php:8.2-fpm

# Установить зависимости
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    libonig-dev \
    zip \
    unzip \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Установить PHP расширения
RUN docker-php-ext-install \
    pdo_mysql \
    mbstring \
    zip \
    gd \
    bcmath

# Установить Xdebug
RUN pecl install xdebug \
    && docker-php-ext-enable xdebug

# Конфигурация Xdebug
RUN echo "xdebug.mode=debug" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.start_with_request=yes" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.client_port=9003" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.log=/tmp/xdebug.log" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# PHP development настройки
RUN echo "display_errors=On" >> /usr/local/etc/php/conf.d/dev.ini \
    && echo "error_reporting=E_ALL" >> /usr/local/etc/php/conf.d/dev.ini \
    && echo "memory_limit=512M" >> /usr/local/etc/php/conf.d/dev.ini

# Установить Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Установить Node.js для Vite
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /var/www/html

# В dev не копируем код - используем volume
# docker run -v $(pwd):/var/www/html

# Создать entrypoint для автоматической установки зависимостей
RUN echo '#!/bin/bash\n\
if [ ! -d "vendor" ]; then\n\
    composer install\n\
fi\n\
if [ ! -d "node_modules" ]; then\n\
    npm install\n\
fi\n\
php-fpm\n\
' > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

**docker-compose.yml для development:**

```yaml
version: '3.8'

services:
  php:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./:/var/www/html
      # Исключить vendor и node_modules из хоста
      - /var/www/html/vendor
      - /var/www/html/node_modules
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
      - XDEBUG_MODE=debug
    ports:
      - "9000:9000"
      - "9003:9003"  # Xdebug
    extra_hosts:
      - "host.docker.internal:host-gateway"

  vite:
    image: node:18
    working_dir: /app
    volumes:
      - ./:/app
    command: npm run dev -- --host
    ports:
      - "5173:5173"
```

**Использование:**
```bash
# Запустить
docker-compose up -d

# Xdebug подключится автоматически при запросе
# VS Code: установить PHP Debug extension
# Конфиг launch.json:
{
    "name": "Listen for Xdebug",
    "type": "php",
    "request": "launch",
    "port": 9003,
    "pathMappings": {
        "/var/www/html": "${workspaceFolder}"
    }
}

# Hot reload для Vite работает автоматически
# http://localhost:5173
```

</details>

### Задание 3: Dockerfile с секретами (без .env в образе)

Создай Dockerfile который не включает .env в финальный образ.

<details>
<summary>Решение</summary>

```dockerfile
# Production Dockerfile БЕЗ .env в образе

FROM php:8.2-fpm-alpine

# Установить зависимости
RUN apk add --no-cache \
    libpng libzip mysql-client

# PHP расширения
RUN docker-php-ext-install pdo_mysql zip gd

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Скопировать composer файлы
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

# ✅ Скопировать код БЕЗ .env
COPY --chown=www-data:www-data . .

# ❌ НЕ копировать .env файл!
# Переменные будут из окружения контейнера

# .dockerignore должен содержать:
# .env
# .env.*
# .env.example

# Права
RUN chown -R www-data:www-data storage bootstrap/cache

# Создать .env из template (без секретов)
RUN echo "APP_NAME=Laravel\n\
APP_ENV=production\n\
APP_KEY=\n\
APP_DEBUG=false\n\
# Остальные переменные будут из окружения\n\
" > .env.docker

USER www-data

EXPOSE 9000

CMD ["php-fpm"]
```

**.dockerignore (ВАЖНО!):**
```
.env
.env.*
!.env.example
.git
node_modules
vendor
tests
```

**docker-compose.yml с секретами:**

```yaml
version: '3.8'

services:
  php:
    build: .
    environment:
      # Секреты из переменных окружения хоста
      - APP_KEY=${APP_KEY}
      - DB_PASSWORD=${DB_PASSWORD}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    env_file:
      # Или из файла (не в git!)
      - .env.production
    secrets:
      - db_password
      - app_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  app_key:
    file: ./secrets/app_key.txt
```

**Вариант: использовать Docker secrets:**

```bash
# Создать секреты
echo "secret_password" | docker secret create db_password -
echo "base64:xxx" | docker secret create app_key -

# Dockerfile чтение секретов
RUN --mount=type=secret,id=app_key \
    APP_KEY=$(cat /run/secrets/app_key) \
    php artisan config:cache
```

**Kubernetes ConfigMap + Secrets:**

```yaml
# configmap.yaml (не секретные настройки)
apiVersion: v1
kind: ConfigMap
metadata:
  name: laravel-config
data:
  APP_ENV: "production"
  APP_DEBUG: "false"

---
# secret.yaml (секретные данные)
apiVersion: v1
kind: Secret
metadata:
  name: laravel-secrets
type: Opaque
data:
  APP_KEY: base64_encoded_key
  DB_PASSWORD: base64_encoded_password
```

**Best practices:**
1. ❌ Никогда не COPY .env в образ
2. ✅ Использовать переменные окружения
3. ✅ Docker secrets / Kubernetes secrets
4. ✅ .dockerignore для защиты
5. ✅ Сканировать образы на утечки секретов

```bash
# Проверить что .env не попал в образ
docker run myapp:latest cat .env
# cat: can't open '.env': No such file or directory ✅

# Сканировать образ на секреты
docker scan myapp:latest
```

</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
