# 12.4 CI/CD

## Краткое резюме

> **CI/CD** — автоматизация тестирования (CI) и деплоя (CD) кода.
>
> **GitHub Actions:** workflow в `.github/workflows/`, jobs и steps. GitLab CI: `.gitlab-ci.yml`, stages (test, build, deploy).
>
> **Laravel:** тесты → сборка Docker образа → деплой на сервер. Envoy для deployment через SSH. Zero-downtime с blue-green deployment.

---

## Содержание

- [Что это](#что-это)
- [GitHub Actions](#github-actions)
- [GitLab CI](#gitlab-ci)
- [Deploy script](#deploy-script)
- [Laravel Envoy](#laravel-envoy)
- [Docker в CI/CD](#docker-в-cicd)
- [Практические примеры](#практические-примеры)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
CI/CD — автоматизация тестирования, сборки и деплоя кода.

**CI (Continuous Integration):**
- Автоматический запуск тестов при каждом commit/PR
- Проверка code style, phpstan
- Сборка Docker образов

**CD (Continuous Deployment):**
- Автоматический деплой на сервер после успешных тестов
- Staging → Production pipeline

---

## GitHub Actions

**Базовый workflow (.github/workflows/tests.yml):**

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  tests:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: testing
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2
          extensions: mbstring, pdo, pdo_mysql
          coverage: xdebug

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-progress

      - name: Copy .env
        run: cp .env.example .env

      - name: Generate key
        run: php artisan key:generate

      - name: Run migrations
        run: php artisan migrate
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: testing
          DB_USERNAME: root
          DB_PASSWORD: password

      - name: Run tests
        run: php artisan test --coverage

      - name: PHPStan
        run: vendor/bin/phpstan analyse

      - name: Code Style
        run: vendor/bin/pint --test
```

**Deploy workflow (.github/workflows/deploy.yml):**

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/html
            git pull origin main
            composer install --no-dev --optimize-autoloader
            php artisan migrate --force
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache
            sudo systemctl reload php8.2-fpm
```

---

## GitLab CI

**.gitlab-ci.yml:**

```yaml
stages:
  - test
  - build
  - deploy

variables:
  MYSQL_ROOT_PASSWORD: secret
  MYSQL_DATABASE: testing

# Кеш для зависимостей
cache:
  paths:
    - vendor/

# Тесты
test:
  stage: test
  image: php:8.2-fpm
  services:
    - mysql:8
  before_script:
    - apt-get update && apt-get install -y git zip unzip
    - curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
    - docker-php-ext-install pdo pdo_mysql
    - composer install
    - cp .env.example .env
    - php artisan key:generate
  script:
    - php artisan test
    - vendor/bin/phpstan analyse
  only:
    - main
    - merge_requests

# Сборка Docker образа
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  only:
    - main

# Деплой
deploy_production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh $SERVER_USER@$SERVER_HOST "cd /var/www/html && ./deploy.sh"
  only:
    - main
  environment:
    name: production
    url: https://example.com
```

---

## Deploy script

**deploy.sh на сервере:**

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Переключиться в maintenance mode
php artisan down

# Получить изменения
git pull origin main

# Установить зависимости
composer install --no-dev --optimize-autoloader

# Обновить БД
php artisan migrate --force

# Очистить и пересоздать кеш
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Перезапустить очереди
php artisan queue:restart

# Выйти из maintenance mode
php artisan up

echo "✅ Deployment completed!"
```

**Сделать исполняемым:**

```bash
chmod +x deploy.sh
```

---

## Laravel Envoy

**Envoy.blade.php:**

```php
@servers(['web' => 'user@example.com'])

@setup
    $repository = 'git@github.com:user/project.git';
    $releases_dir = '/var/www/html/releases';
    $app_dir = '/var/www/html';
    $release = date('YmdHis');
    $new_release_dir = $releases_dir .'/'. $release;
@endsetup

@story('deploy')
    clone_repository
    run_composer
    update_symlinks
    migrate
    cache
    reload_php
@endstory

@task('clone_repository')
    echo "Cloning repository"
    [ -d {{ $releases_dir }} ] || mkdir {{ $releases_dir }}
    git clone --depth 1 {{ $repository }} {{ $new_release_dir }}
    cd {{ $new_release_dir }}
    git reset --hard {{ $commit }}
@endtask

@task('run_composer')
    echo "Running composer"
    cd {{ $new_release_dir }}
    composer install --no-dev --prefer-dist --optimize-autoloader
@endtask

@task('update_symlinks')
    echo "Linking storage directory"
    rm -rf {{ $new_release_dir }}/storage
    ln -nfs {{ $app_dir }}/storage {{ $new_release_dir }}/storage

    echo "Linking .env file"
    ln -nfs {{ $app_dir }}/.env {{ $new_release_dir }}/.env

    echo "Linking current release"
    ln -nfs {{ $new_release_dir }} {{ $app_dir }}/current
@endtask

@task('migrate')
    echo "Running migrations"
    cd {{ $new_release_dir }}
    php artisan migrate --force
@endtask

@task('cache')
    echo "Caching config and routes"
    cd {{ $new_release_dir }}
    php artisan config:cache
    php artisan route:cache
@endtask

@task('reload_php')
    echo "Reloading PHP-FPM"
    sudo systemctl reload php8.2-fpm
@endtask
```

**Запуск:**

```bash
# Локально
envoy run deploy

# С параметрами
envoy run deploy --commit=abc123
```

---

## Docker в CI/CD

**Build и push образа:**

```yaml
# .github/workflows/docker.yml
name: Docker Build

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: myapp/laravel

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=myapp/laravel:buildcache
          cache-to: type=registry,ref=myapp/laravel:buildcache,mode=max
```

**Deploy с Docker Compose:**

```yaml
deploy:
  stage: deploy
  script:
    - ssh $SERVER "cd /var/www && docker-compose pull"
    - ssh $SERVER "cd /var/www && docker-compose up -d"
    - ssh $SERVER "docker-compose exec -T php php artisan migrate --force"
```

---

## Практические примеры

**Zero-downtime deployment:**

```bash
#!/bin/bash
# Blue-Green deployment

BLUE_PORT=8000
GREEN_PORT=8001
CURRENT_PORT=$(curl -s localhost/health | jq -r '.port')

if [ "$CURRENT_PORT" == "$BLUE_PORT" ]; then
    NEW_PORT=$GREEN_PORT
    NEW_COLOR="green"
else
    NEW_PORT=$BLUE_PORT
    NEW_COLOR="blue"
fi

echo "Deploying to $NEW_COLOR on port $NEW_PORT"

# Запустить новую версию
docker-compose -f docker-compose.$NEW_COLOR.yml up -d

# Подождать готовности
sleep 10

# Проверить health
if curl -f http://localhost:$NEW_PORT/health; then
    echo "Health check passed"
    # Переключить nginx на новый порт
    sed -i "s/$CURRENT_PORT/$NEW_PORT/g" /etc/nginx/sites-available/default
    nginx -s reload

    # Остановить старую версию
    docker-compose -f docker-compose.$OLD_COLOR.yml down
else
    echo "Health check failed, rolling back"
    docker-compose -f docker-compose.$NEW_COLOR.yml down
    exit 1
fi
```

**Rollback:**

```bash
#!/bin/bash
# Откатить к предыдущему релизу

CURRENT=$(readlink /var/www/html/current)
PREVIOUS=$(ls -t /var/www/html/releases | sed -n 2p)

echo "Rolling back to $PREVIOUS"

ln -nfs /var/www/html/releases/$PREVIOUS /var/www/html/current
php artisan migrate:rollback --force
sudo systemctl reload php8.2-fpm

echo "Rollback completed"
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- CI/CD автоматизирует тестирование и деплой
- CI — автоматические тесты при каждом commit
- CD — автоматический деплой после успешных тестов

**GitHub Actions:**
- Workflow в `.github/workflows/`
- Jobs и steps для выполнения команд
- Services для MySQL, Redis
- Secrets для чувствительных данных (SSH keys, tokens)

**GitLab CI:**
- `.gitlab-ci.yml` в корне проекта
- Stages: test, build, deploy
- Cache для vendor/
- Artifacts для передачи между stages

**Deploy:**
- Laravel Envoy для SSH deployment
- Deploy script: maintenance mode, git pull, composer install, migrate, cache
- Symlinks для zero-downtime (releases/)
- Rollback к предыдущему релизу

**Docker:**
- Build образа в CI
- Push в registry (Docker Hub, GitLab Registry)
- Pull на сервере и docker-compose up

**Zero-downtime:**
- Blue-Green deployment с двумя средами
- Health checks перед переключением
- Rolling deployment для постепенного обновления

---

## Практические задания

### Задание 1: Настрой GitHub Actions для Laravel

Создай полный CI/CD workflow: тесты (PHPUnit, Pint, PHPStan) + деплой на production при push в main.

<details>
<summary>Решение</summary>

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  tests:
    name: Tests (PHP ${{ matrix.php }})
    runs-on: ubuntu-latest

    strategy:
      matrix:
        php: ['8.1', '8.2']

    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: testing
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

      redis:
        image: redis:alpine
        ports:
          - 6379:6379
        options: --health-cmd="redis-cli ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php }}
          extensions: mbstring, pdo, pdo_mysql, redis
          coverage: xdebug

      - name: Cache Composer dependencies
        uses: actions/cache@v3
        with:
          path: vendor
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
          restore-keys: ${{ runner.os }}-composer-

      - name: Install dependencies
        run: composer install --prefer-dist --no-progress --no-interaction

      - name: Copy .env
        run: cp .env.example .env

      - name: Generate application key
        run: php artisan key:generate

      - name: Run database migrations
        run: php artisan migrate --force
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: testing
          DB_USERNAME: root
          DB_PASSWORD: password

      - name: Run tests with coverage
        run: php artisan test --coverage --min=80
        env:
          DB_CONNECTION: mysql
          DB_HOST: 127.0.0.1
          REDIS_HOST: 127.0.0.1

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        if: matrix.php == '8.2'
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2
          extensions: mbstring

      - name: Install dependencies
        run: composer install --prefer-dist --no-progress

      - name: Run Pint (code style)
        run: vendor/bin/pint --test

      - name: Run PHPStan
        run: vendor/bin/phpstan analyse --memory-limit=2G

      - name: Run Larastan
        run: vendor/bin/phpstan analyse --configuration=phpstan.neon

  security:
    name: Security Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.2

      - name: Install dependencies
        run: composer install --prefer-dist --no-progress

      - name: Security audit
        run: composer audit
```

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]
  workflow_dispatch:  # Ручной запуск

jobs:
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.7.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Add server to known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.HOST }} >> ~/.ssh/known_hosts

      - name: Deploy to server
        run: |
          ssh ${{ secrets.USERNAME }}@${{ secrets.HOST }} << 'ENDSSH'
            set -e
            cd /var/www/html

            echo "🚀 Starting deployment..."

            # Maintenance mode
            php artisan down || true

            # Update code
            git fetch origin main
            git reset --hard origin/main

            # Install dependencies
            composer install --no-dev --optimize-autoloader --no-interaction

            # Run migrations
            php artisan migrate --force

            # Clear and cache
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache
            php artisan event:cache

            # Restart queue workers
            php artisan queue:restart

            # Exit maintenance mode
            php artisan up

            echo "✅ Deployment completed!"
          ENDSSH

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to production ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Create Sentry release
        if: success()
        run: |
          curl -sL https://sentry.io/get-cli/ | bash
          sentry-cli releases new ${{ github.sha }}
          sentry-cli releases set-commits ${{ github.sha }} --auto
          sentry-cli releases finalize ${{ github.sha }}
          sentry-cli releases deploys ${{ github.sha }} new -e production
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

```bash
# Настройка Secrets в GitHub
# Settings → Secrets and variables → Actions → New repository secret

# Добавить:
HOST=your-server.com
USERNAME=deployer
SSH_PRIVATE_KEY=<содержимое ~/.ssh/id_rsa>
SLACK_WEBHOOK=https://hooks.slack.com/services/...
CODECOV_TOKEN=...
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```
</details>

### Задание 2: GitLab CI с Docker build и deploy

Настрой .gitlab-ci.yml: тесты → build Docker образа → push в registry → deploy на production через docker-compose.

<details>
<summary>Решение</summary>

```yaml
# .gitlab-ci.yml
image: php:8.2-fpm

stages:
  - test
  - build
  - deploy

variables:
  MYSQL_ROOT_PASSWORD: secret
  MYSQL_DATABASE: testing
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

# Кеш для ускорения
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - vendor/
    - node_modules/

# ==== STAGE: TEST ====

.test_template: &test_template
  stage: test
  services:
    - mysql:8
    - redis:alpine
  before_script:
    - apt-get update && apt-get install -y git zip unzip libpng-dev
    - curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
    - docker-php-ext-install pdo pdo_mysql gd
    - composer install --prefer-dist --no-progress --no-interaction
    - cp .env.example .env
    - php artisan key:generate
  only:
    - main
    - develop
    - merge_requests

phpunit:
  <<: *test_template
  script:
    - php artisan test --coverage --min=75
  coverage: '/^\s*Lines:\s*\d+\.\d+\%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml

pint:
  <<: *test_template
  script:
    - vendor/bin/pint --test

phpstan:
  <<: *test_template
  script:
    - vendor/bin/phpstan analyse --memory-limit=2G

# ==== STAGE: BUILD ====

build_docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    # Build образ с тегом commit SHA
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker build -t $CI_REGISTRY_IMAGE:latest .

    # Push в registry
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
  tags:
    - docker

# ==== STAGE: DEPLOY ====

.deploy_template: &deploy_template
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts

deploy_staging:
  <<: *deploy_template
  script:
    - |
      ssh $SSH_USER@$SSH_HOST << 'ENDSSH'
        set -e
        cd /var/www/staging

        # Pull новый образ
        docker-compose pull

        # Обновить контейнеры
        docker-compose up -d

        # Запустить миграции
        docker-compose exec -T php php artisan migrate --force

        # Очистить кеш
        docker-compose exec -T php php artisan config:cache
        docker-compose exec -T php php artisan route:cache

        # Перезапустить queue
        docker-compose exec -T php php artisan queue:restart
      ENDSSH
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy_production:
  <<: *deploy_template
  script:
    - |
      ssh $SSH_USER@$SSH_HOST << 'ENDSSH'
        set -e
        cd /var/www/production

        echo "🚀 Starting production deployment..."

        # Backup БД перед деплоем
        docker-compose exec -T mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD laravel > backup_$(date +%Y%m%d_%H%M%S).sql

        # Pull новый образ
        docker-compose pull

        # Blue-Green deployment
        docker-compose -f docker-compose.green.yml up -d

        # Health check
        sleep 10
        if ! curl -f http://localhost:8001/health; then
          echo "❌ Health check failed!"
          docker-compose -f docker-compose.green.yml down
          exit 1
        fi

        # Миграции
        docker-compose -f docker-compose.green.yml exec -T php php artisan migrate --force

        # Переключить nginx на green
        docker-compose -f docker-compose.nginx.yml restart

        # Остановить blue
        sleep 30
        docker-compose -f docker-compose.blue.yml down

        # Переименовать green в blue для следующего деплоя
        mv docker-compose.blue.yml docker-compose.blue.yml.old
        mv docker-compose.green.yml docker-compose.blue.yml
        mv docker-compose.blue.yml.old docker-compose.green.yml

        echo "✅ Deployment completed!"
      ENDSSH
  environment:
    name: production
    url: https://example.com
  when: manual  # Ручное подтверждение
  only:
    - main

# Rollback
rollback_production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts
  script:
    - |
      ssh $SSH_USER@$SSH_HOST << 'ENDSSH'
        cd /var/www/production

        echo "⏪ Rolling back..."

        # Переключить на предыдущую версию
        docker-compose -f docker-compose.blue.yml up -d

        # Откатить миграции
        docker-compose exec -T php php artisan migrate:rollback --force

        echo "✅ Rollback completed!"
      ENDSSH
  environment:
    name: production
  when: manual
  only:
    - main
```

```yaml
# docker-compose.blue.yml (на сервере)
version: '3.8'

services:
  php-blue:
    image: registry.gitlab.com/yourname/project:latest
    container_name: php-blue
    ports:
      - "8000:80"
    env_file:
      - .env.production
    networks:
      - laravel
    restart: always

networks:
  laravel:
    external: true
```

```yaml
# docker-compose.green.yml (на сервере)
version: '3.8'

services:
  php-green:
    image: registry.gitlab.com/yourname/project:latest
    container_name: php-green
    ports:
      - "8001:80"
    env_file:
      - .env.production
    networks:
      - laravel
    restart: always

networks:
  laravel:
    external: true
```

```bash
# Настройка CI/CD Variables в GitLab
# Settings → CI/CD → Variables

# Добавить:
SSH_PRIVATE_KEY = <содержимое приватного ключа>
SSH_HOST = your-server.com
SSH_USER = deployer
MYSQL_ROOT_PASSWORD = your_password
```
</details>

### Задание 3: Laravel Envoy с zero-downtime deployment

Создай Envoy.blade.php для деплоя Laravel через releases/ структуру с возможностью rollback.

<details>
<summary>Решение</summary>

```php
{{-- Envoy.blade.php --}}
@servers(['production' => ['deployer@production.example.com'], 'staging' => ['deployer@staging.example.com']])

@setup
    $repository = 'git@github.com:yourname/project.git';
    $base_dir = '/var/www/html';
    $releases_dir = $base_dir . '/releases';
    $shared_dir = $base_dir . '/shared';
    $current_dir = $base_dir . '/current';

    $release = date('Y-m-d_H-i-s');
    $release_dir = $releases_dir . '/' . $release;

    // Сколько релизов хранить
    $keep_releases = 5;
@endsetup

@story('deploy', ['on' => 'production'])
    clone_repository
    install_dependencies
    create_shared_links
    run_migrations
    optimize_application
    update_current_symlink
    reload_services
    cleanup_old_releases
    health_check
@endstory

@story('deploy_staging', ['on' => 'staging'])
    clone_repository
    install_dependencies
    create_shared_links
    run_migrations
    optimize_application
    update_current_symlink
    reload_services
@endstory

@story('rollback', ['on' => 'production'])
    rollback_to_previous
    rollback_migrations
    reload_services
@endstory

{{-- Клонирование репозитория --}}
@task('clone_repository')
    echo "📦 Cloning repository into {{ $release_dir }}"

    [ -d {{ $releases_dir }} ] || mkdir -p {{ $releases_dir }}

    git clone --depth 1 {{ $repository }} {{ $release_dir }}

    cd {{ $release_dir }}
    echo "Current commit: $(git rev-parse --short HEAD)"
@endtask

{{-- Установка зависимостей --}}
@task('install_dependencies')
    echo "📚 Installing Composer dependencies"
    cd {{ $release_dir }}

    composer install \
        --no-dev \
        --no-interaction \
        --prefer-dist \
        --optimize-autoloader \
        --no-progress

    echo "✅ Dependencies installed"
@endtask

{{-- Создание symlinks на shared файлы --}}
@task('create_shared_links')
    echo "🔗 Creating symlinks to shared files"

    # Создать shared директории если их нет
    [ -d {{ $shared_dir }}/storage ] || mkdir -p {{ $shared_dir }}/storage
    [ -d {{ $shared_dir }}/storage/app ] || mkdir -p {{ $shared_dir }}/storage/app
    [ -d {{ $shared_dir }}/storage/framework ] || mkdir -p {{ $shared_dir }}/storage/framework
    [ -d {{ $shared_dir }}/storage/logs ] || mkdir -p {{ $shared_dir }}/storage/logs

    # .env файл
    [ -f {{ $shared_dir }}/.env ] || cp {{ $release_dir }}/.env.example {{ $shared_dir }}/.env

    cd {{ $release_dir }}

    # Удалить storage и создать symlink
    rm -rf storage
    ln -nfs {{ $shared_dir }}/storage storage

    # Symlink .env
    rm -f .env
    ln -nfs {{ $shared_dir }}/.env .env

    # Права
    chmod -R 775 {{ $shared_dir }}/storage
    chmod -R 775 {{ $release_dir }}/bootstrap/cache

    echo "✅ Symlinks created"
@endtask

{{-- Миграции --}}
@task('run_migrations')
    echo "🗄️  Running database migrations"
    cd {{ $release_dir }}

    php artisan migrate --force --no-interaction

    echo "✅ Migrations completed"
@endtask

{{-- Оптимизация приложения --}}
@task('optimize_application')
    echo "⚡ Optimizing application"
    cd {{ $release_dir }}

    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache

    echo "✅ Application optimized"
@endtask

{{-- Обновление symlink на текущий релиз --}}
@task('update_current_symlink')
    echo "🔄 Updating current symlink"

    ln -nfs {{ $release_dir }} {{ $current_dir }}

    echo "✅ Current release: {{ $release }}"
@endtask

{{-- Перезапуск сервисов --}}
@task('reload_services')
    echo "🔄 Reloading services"

    # PHP-FPM
    sudo systemctl reload php8.2-fpm

    # Queue workers
    cd {{ $current_dir }}
    php artisan queue:restart

    # Supervisor (если используется)
    sudo supervisorctl reread
    sudo supervisorctl update
    sudo supervisorctl restart laravel-worker:*

    echo "✅ Services reloaded"
@endtask

{{-- Очистка старых релизов --}}
@task('cleanup_old_releases')
    echo "🧹 Cleaning up old releases"

    cd {{ $releases_dir }}

    # Оставить только последние N релизов
    ls -1dt */ | tail -n +{{ $keep_releases + 1 }} | xargs rm -rf

    echo "✅ Cleanup completed (kept {{ $keep_releases }} releases)"
@endtask

{{-- Health check --}}
@task('health_check')
    echo "🏥 Running health check"

    sleep 5

    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed!"
        echo "⚠️  Please check the application manually"
    fi
@endtask

{{-- Rollback к предыдущему релизу --}}
@task('rollback_to_previous')
    echo "⏪ Rolling back to previous release"

    cd {{ $releases_dir }}

    # Найти текущий и предыдущий релиз
    current_release=$(basename $(readlink {{ $current_dir }}))
    previous_release=$(ls -1dt */ | grep -v "^$current_release/" | head -n 1 | tr -d '/')

    if [ -z "$previous_release" ]; then
        echo "❌ No previous release found!"
        exit 1
    fi

    echo "Current: $current_release"
    echo "Rolling back to: $previous_release"

    # Обновить symlink
    ln -nfs {{ $releases_dir }}/$previous_release {{ $current_dir }}

    echo "✅ Rolled back to $previous_release"
@endtask

{{-- Откат миграций --}}
@task('rollback_migrations')
    echo "🗄️  Rolling back database migrations"
    cd {{ $current_dir }}

    php artisan migrate:rollback --force

    echo "✅ Migrations rolled back"
@endtask

{{-- Уведомления --}}
@finished
    echo "======================================"
    echo "🎉 Deployment finished!"
    echo "======================================"
@endfinished

@error
    echo "======================================"
    echo "❌ Deployment failed!"
    echo "======================================"
@enderror
```

```bash
# Установка Envoy
composer global require laravel/envoy

# Убедиться что ~/.composer/vendor/bin в PATH
export PATH="$HOME/.composer/vendor/bin:$PATH"

# Деплой на production
envoy run deploy

# Деплой на staging
envoy run deploy_staging

# Rollback
envoy run rollback

# Деплой с уведомлениями в Slack
envoy run deploy --slack=https://hooks.slack.com/services/...

# Структура на сервере после деплоя:
# /var/www/html/
# ├── current -> releases/2024-01-15_14-30-00
# ├── releases/
# │   ├── 2024-01-15_14-30-00/
# │   ├── 2024-01-15_12-00-00/
# │   └── 2024-01-14_10-15-00/
# └── shared/
#     ├── .env
#     └── storage/
```

```php
{{-- Envoy с Slack уведомлениями --}}
@servers(['production' => 'deployer@example.com'])

@setup
    $slack_webhook = env('SLACK_WEBHOOK');
@endsetup

@story('deploy')
    notify_started
    clone_repository
    install_dependencies
    run_migrations
    update_current_symlink
    reload_services
    notify_finished
@endstory

@task('notify_started')
    @if($slack_webhook)
        curl -X POST {{ $slack_webhook }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"🚀 Deployment started by {{ auth()->user()->name }}"}'
    @endif
@endtask

@finished
    @if($slack_webhook)
        curl -X POST {{ $slack_webhook }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"✅ Deployment finished successfully!"}'
    @endif
@endfinished

@error
    @if($slack_webhook)
        curl -X POST {{ $slack_webhook }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"❌ Deployment failed!"}'
    @endif
@enderror
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
