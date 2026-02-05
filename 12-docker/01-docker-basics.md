# 12.1 Docker Basics

## Краткое резюме

> **Docker** — платформа для контейнеризации приложений. Упаковывает приложение с зависимостями в изолированный контейнер.
>
> **Основные команды:** `docker run` (запустить), `docker ps` (список), `docker exec` (выполнить команду), `docker logs` (логи).
>
> **Важно:** Images (образы) vs Containers (запущенные экземпляры), Volumes (персистентные данные), Networks (связь между контейнерами).

---

## Содержание

- [Что это](#что-это)
- [Основные команды](#основные-команды)
- [Docker для PHP/Laravel](#docker-для-phplaravel)
- [Networks](#networks)
- [Volumes](#volumes)
- [Практические примеры](#практические-примеры)
- [Очистка](#очистка)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Docker — платформа для контейнеризации приложений. Упаковывает приложение с зависимостями в изолированный контейнер.

**Основные концепции:**
- **Image** — образ (шаблон)
- **Container** — запущенный экземпляр образа
- **Dockerfile** — инструкции для создания образа
- **Registry** — хранилище образов (Docker Hub)

---

## Основные команды

**Images:**

```bash
# Скачать образ
docker pull php:8.2-fpm

# Список образов
docker images

# Удалить образ
docker rmi php:8.2-fpm

# Создать образ из Dockerfile
docker build -t myapp:latest .

# Посмотреть историю образа
docker history myapp:latest
```

**Containers:**

```bash
# Запустить контейнер
docker run nginx

# Запустить в фоне (-d detached)
docker run -d nginx

# Запустить с именем
docker run -d --name my-nginx nginx

# Запустить с портами (-p host:container)
docker run -d -p 8080:80 nginx

# Запустить с volumes
docker run -d -v /local/path:/container/path nginx

# Список запущенных контейнеров
docker ps

# Список всех контейнеров (включая остановленные)
docker ps -a

# Остановить контейнер
docker stop my-nginx

# Удалить контейнер
docker rm my-nginx

# Удалить остановленный контейнер
docker rm -f my-nginx
```

**Logs и exec:**

```bash
# Посмотреть логи
docker logs my-nginx

# Логи в реальном времени
docker logs -f my-nginx

# Выполнить команду в контейнере
docker exec my-nginx ls /var/www

# Зайти в контейнер (bash)
docker exec -it my-nginx bash

# Зайти в контейнер (sh для alpine)
docker exec -it my-nginx sh
```

---

## Docker для PHP/Laravel

**Запустить PHP приложение:**

```bash
# Запустить PHP-FPM
docker run -d \
  --name php-app \
  -v $(pwd):/var/www/html \
  -p 9000:9000 \
  php:8.2-fpm

# Запустить Nginx
docker run -d \
  --name nginx \
  -v $(pwd):/var/www/html \
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf \
  -p 8080:80 \
  --link php-app \
  nginx

# Теперь приложение доступно на http://localhost:8080
```

**Выполнить Composer:**

```bash
# Установить зависимости
docker run --rm \
  -v $(pwd):/app \
  composer install

# Обновить зависимости
docker run --rm \
  -v $(pwd):/app \
  composer update
```

**Выполнить Artisan:**

```bash
# Запустить миграции
docker exec php-app php artisan migrate

# Очистить кеш
docker exec php-app php artisan cache:clear

# Создать контроллер
docker exec php-app php artisan make:controller UserController
```

---

## Networks

**Создание и использование:**

```bash
# Создать сеть
docker network create myapp-network

# Запустить контейнеры в сети
docker run -d --name mysql --network myapp-network mysql:8
docker run -d --name php --network myapp-network php:8.2-fpm

# Контейнеры могут обращаться друг к другу по имени
# В PHP: DB_HOST=mysql

# Список сетей
docker network ls

# Подключить контейнер к сети
docker network connect myapp-network my-nginx

# Отключить от сети
docker network disconnect myapp-network my-nginx
```

---

## Volumes

**Типы:**

```bash
# 1. Bind mount (локальная папка)
docker run -v /local/path:/container/path nginx

# 2. Named volume (управляется Docker)
docker volume create myapp-data
docker run -v myapp-data:/var/lib/mysql mysql

# 3. Anonymous volume
docker run -v /var/lib/mysql mysql

# Список volumes
docker volume ls

# Удалить volume
docker volume rm myapp-data

# Удалить неиспользуемые volumes
docker volume prune
```

**Laravel volumes:**

```bash
# Storage для логов и кеша
docker run -d \
  -v $(pwd)/storage:/var/www/html/storage \
  -v $(pwd)/bootstrap/cache:/var/www/html/bootstrap/cache \
  php:8.2-fpm
```

---

## Практические примеры

**MySQL container:**

```bash
# Запустить MySQL
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=laravel \
  -e MYSQL_USER=laravel \
  -e MYSQL_PASSWORD=secret \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  mysql:8

# Подключиться к MySQL
docker exec -it mysql mysql -u root -p

# Или из приложения
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=laravel
DB_PASSWORD=secret
```

**Redis container:**

```bash
# Запустить Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:alpine

# Подключиться к Redis CLI
docker exec -it redis redis-cli
```

**Mailhog (для тестирования почты):**

```bash
# Запустить Mailhog
docker run -d \
  --name mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog

# Laravel .env
MAIL_MAILER=smtp
MAIL_HOST=localhost
MAIL_PORT=1025

# Web UI: http://localhost:8025
```

---

## Очистка

**Удаление контейнеров и образов:**

```bash
# Остановить все контейнеры
docker stop $(docker ps -aq)

# Удалить все остановленные контейнеры
docker rm $(docker ps -aq)

# Удалить все неиспользуемые образы
docker image prune -a

# Удалить всё (контейнеры, образы, сети, volumes)
docker system prune -a --volumes

# Посмотреть сколько места занимает Docker
docker system df
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Docker контейнеризирует приложения
- Image — шаблон/образ, Container — запущенный экземпляр
- Изоляция процессов, файловой системы, сети

**Основные команды:**
- `docker run` — запустить контейнер
- `-d` — detached (фон), `-p` — порты, `-v` — volumes
- `docker ps` — список запущенных контейнеров
- `docker exec` — выполнить команду в контейнере
- `docker logs` — посмотреть логи

**Networks:**
- Контейнеры в одной сети могут обращаться друг к другу по имени
- `docker network create` — создать сеть
- `--network` — подключить к сети

**Volumes:**
- Персистентные данные (переживают удаление контейнера)
- Bind mount — локальная папка
- Named volume — управляется Docker

**Laravel:**
- PHP-FPM + Nginx + MySQL + Redis
- Composer и Artisan через `docker exec`
- docker-compose для управления несколькими контейнерами

---

## Практические задания

### Задание 1: Запусти Laravel приложение в Docker

Создай и запусти Laravel приложение с MySQL и Redis без docker-compose.

<details>
<parameter name>Решение</summary>

```bash
# Шаг 1: Создать сеть
docker network create laravel-network

# Шаг 2: Запустить MySQL
docker run -d \
  --name mysql \
  --network laravel-network \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=laravel \
  -e MYSQL_USER=laravel \
  -e MYSQL_PASSWORD=secret \
  -v mysql-data:/var/lib/mysql \
  mysql:8

# Шаг 3: Запустить Redis
docker run -d \
  --name redis \
  --network laravel-network \
  redis:alpine

# Шаг 4: Создать Dockerfile для PHP
cat > Dockerfile <<'EOF'
FROM php:8.2-fpm

# Установить расширения
RUN docker-php-ext-install pdo pdo_mysql

# Установить Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Для development: установить зависимости при сборке
COPY composer.json composer.lock ./
RUN composer install --no-scripts

COPY . .

RUN chown -R www-data:www-data storage bootstrap/cache
EOF

# Шаг 5: Собрать образ PHP
docker build -t laravel-app .

# Шаг 6: Запустить PHP-FPM
docker run -d \
  --name php \
  --network laravel-network \
  -v $(pwd):/var/www/html \
  -e DB_HOST=mysql \
  -e DB_DATABASE=laravel \
  -e DB_USERNAME=laravel \
  -e DB_PASSWORD=secret \
  -e REDIS_HOST=redis \
  laravel-app

# Шаг 7: Создать Nginx конфиг
mkdir -p nginx
cat > nginx/default.conf <<'EOF'
server {
    listen 80;
    root /var/www/html/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
EOF

# Шаг 8: Запустить Nginx
docker run -d \
  --name nginx \
  --network laravel-network \
  -p 8080:80 \
  -v $(pwd):/var/www/html \
  -v $(pwd)/nginx/default.conf:/etc/nginx/conf.d/default.conf \
  nginx:alpine

# Шаг 9: Запустить миграции
docker exec php php artisan migrate

# Шаг 10: Проверить
# http://localhost:8080

# Посмотреть логи
docker logs php
docker logs nginx

# Зайти в контейнер
docker exec -it php bash

# Остановить и удалить всё
docker stop nginx php redis mysql
docker rm nginx php redis mysql
docker network rm laravel-network
docker volume rm mysql-data
```
</details>

### Задание 2: Debug контейнер с проблемами

Контейнер не запускается или работает неправильно. Найди и исправь проблему.

<details>
<summary>Решение</summary>

```bash
# Ситуация: контейнер сразу останавливается

# Шаг 1: Проверить статус
docker ps -a
# STATUS: Exited (1) 5 seconds ago

# Шаг 2: Посмотреть логи
docker logs my-app
# Error: Could not connect to database

# Шаг 3: Проверить переменные окружения
docker inspect my-app | grep -A 10 Env
# DB_HOST не указан!

# Шаг 4: Пересоздать с правильными переменными
docker rm my-app
docker run -d \
  --name my-app \
  -e DB_HOST=mysql \
  -e DB_DATABASE=laravel \
  --network myapp-network \
  php-app

# Ситуация 2: контейнер работает, но не отвечает

# Проверить порты
docker ps
# PORTS: 9000/tcp (нет маппинга!)

# Пересоздать с портами
docker rm -f my-app
docker run -d \
  --name my-app \
  -p 8080:80 \
  my-app

# Ситуация 3: Permission denied в storage

# Зайти в контейнер
docker exec -it my-app bash

# Проверить владельца
ls -la storage/
# drwxr-xr-x root root

# Исправить права
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# Выйти и перезапустить
exit
docker restart my-app

# Полезные команды для отладки:

# Посмотреть процессы в контейнере
docker top my-app

# Статистика ресурсов
docker stats my-app

# Детальная информация
docker inspect my-app

# Посмотреть diff файловой системы
docker diff my-app

# Посмотреть какие порты открыты
docker port my-app

# Протестировать сеть
docker exec my-app ping mysql
docker exec my-app nc -zv mysql 3306
```
</details>

### Задание 3: Оптимизируй Docker образ

У тебя образ весит 2GB. Уменьши его размер.

<details>
<summary>Решение</summary>

```bash
# Исходный Dockerfile (плохой)
cat > Dockerfile.before <<'EOF'
FROM php:8.2-fpm

# ❌ Каждый RUN = новый слой
RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y curl
RUN apt-get install -y zip

# ❌ Копируем всё подряд
COPY . /var/www/html

# ❌ Устанавливаем dev зависимости
RUN composer install

WORKDIR /var/www/html
EOF

# Собрать
docker build -f Dockerfile.before -t myapp:before .
docker images myapp:before
# myapp      before   abc123   2.1GB

# Оптимизированный Dockerfile
cat > Dockerfile <<'EOF'
# ✅ Используем alpine (меньше)
FROM php:8.2-fpm-alpine

# ✅ Объединяем RUN команды
RUN apk add --no-cache \
    git \
    curl \
    zip \
    && rm -rf /var/cache/apk/*

# ✅ Копируем composer файлы отдельно (кеширование)
COPY composer.json composer.lock ./

# ✅ Устанавливаем production зависимости
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --optimize-autoloader

# ✅ Копируем только нужные файлы
COPY app app/
COPY config config/
COPY database database/
COPY public public/
COPY resources resources/
COPY routes routes/
COPY bootstrap bootstrap/
COPY artisan ./

# Завершаем установку composer
RUN composer dump-autoload --optimize

# Права
RUN chown -R www-data:www-data /var/www/html

WORKDIR /var/www/html

CMD ["php-fpm"]
EOF

# .dockerignore (исключить лишнее)
cat > .dockerignore <<'EOF'
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
Dockerfile
EOF

# Собрать оптимизированный
docker build -t myapp:after .
docker images myapp:after
# myapp      after   def456   350MB

# Сравнить размеры
docker images | grep myapp
# before: 2.1GB → after: 350MB (экономия 83%!)

# Бонус: Multi-stage build
cat > Dockerfile.multistage <<'EOF'
# Stage 1: Composer
FROM composer:latest AS composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

# Stage 2: Production
FROM php:8.2-fpm-alpine
WORKDIR /var/www/html

# Копируем только vendor из первого stage
COPY --from=composer /app/vendor ./vendor

# Копируем код
COPY . .

# Остальное...
CMD ["php-fpm"]
EOF

docker build -f Dockerfile.multistage -t myapp:multistage .
# Ещё меньше!
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
