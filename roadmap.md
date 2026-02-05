# Roadmap развития PHP/Laravel разработчика

Структурированный путь от основ до Senior уровня. Каждый раздел содержит темы для изучения и ссылки на соответствующие главы handbook.

---

## Junior Developer

### Основы PHP

**Базовый синтаксис**
- [Типы данных](/01-php-basics/01-types) - примитивные типы, приведение типов
- [Переменные](/01-php-basics/02-variables) - область видимости, константы
- [Операторы](/01-php-basics/03-operators) - арифметические, логические, сравнения
- [Управляющие конструкции](/01-php-basics/04-control-structures) - if, switch, циклы

**Функции и структуры данных**
- [Функции](/01-php-basics/05-functions) - объявление, параметры, возврат значений
- [Массивы](/01-php-basics/06-arrays) - индексные, ассоциативные, функции работы с массивами
- [Строки и регулярные выражения](/01-php-basics/07-strings-regex) - обработка строк, PCRE

### Объектно-ориентированное программирование

**Основы ООП**
- [Классы и объекты](/02-oop/01-classes-objects) - инстанцирование, свойства, методы
- [Наследование](/02-oop/02-inheritance) - extends, переопределение методов
- [Интерфейсы](/02-oop/03-interfaces) - контракты, множественная реализация
- [Абстрактные классы](/02-oop/04-abstract-classes) - абстракция, шаблонные методы

**Продвинутые возможности**
- [Трейты](/02-oop/05-traits) - повторное использование кода
- [Магические методы](/02-oop/06-magic-methods) - __construct, __get, __set, __call
- [Статическое связывание](/02-oop/07-static-binding) - self vs static
- [Область видимости](/02-oop/08-visibility) - public, protected, private

### PHP Advanced

**Современные возможности**
- [Пространства имён](/03-php-advanced/01-namespaces) - организация кода, автозагрузка
- [Composer и PSR-4](/03-php-advanced/02-autoloading) - управление зависимостями
- [Исключения](/03-php-advanced/03-exceptions) - обработка ошибок, custom exceptions
- [PSR стандарты](/03-php-advanced/04-psr) - PSR-1, PSR-2, PSR-4, PSR-12

**PHP 8+**
- [PHP 8 features](/03-php-advanced/07-php8-features) - Named arguments, Match, Attributes
- [Генераторы](/03-php-advanced/05-generators) - yield, экономия памяти
- [Рефлексия](/03-php-advanced/06-reflection) - метапрограммирование

### Git

- [Git Basics](/04-git/01-git-basics) - init, add, commit, push, pull
- [Branching Strategies](/04-git/02-branching-strategies) - feature branches
- [Rebase vs Merge](/04-git/03-rebase-vs-merge) - когда что использовать
- [Git Flow](/04-git/04-git-flow) - workflow для команды
- [Conflict Resolution](/04-git/05-conflict-resolution) - разрешение конфликтов

### Laravel Basics

**Архитектура фреймворка**
- [Архитектура Laravel](/05-laravel-basics/01-architecture) - MVC, структура проекта
- [Service Container](/05-laravel-basics/02-service-container) - DI контейнер
- [Service Providers](/05-laravel-basics/03-service-providers) - регистрация сервисов
- [Facades](/05-laravel-basics/04-facades) - статический доступ к сервисам

**Основные компоненты**
- [Routing](/05-laravel-basics/05-routing) - маршруты, группы, параметры
- [Middleware](/05-laravel-basics/06-middleware) - обработка запросов
- [Controllers](/05-laravel-basics/07-controllers) - бизнес-логика
- [Request/Response](/05-laravel-basics/08-request-response) - обработка HTTP

---

## Middle Developer

### Laravel Advanced

**Работа с данными**
- [Eloquent Relationships](/06-laravel-advanced/01-eloquent-relationships) - отношения моделей
- [Query Builder](/06-laravel-advanced/02-query-builder) - построение запросов
- [Миграции и Сидеры](/06-laravel-advanced/03-migrations-seeders) - версионирование БД
- [Validation](/06-laravel-advanced/08-validation) - валидация данных

**Асинхронная обработка**
- [Events & Listeners](/06-laravel-advanced/04-events-listeners) - событийная модель
- [Jobs & Queues](/06-laravel-advanced/05-jobs-queues) - фоновые задачи
- [Notifications](/06-laravel-advanced/06-notifications) - уведомления

**API разработка**
- [API Resources](/06-laravel-advanced/07-api-resources) - трансформация данных

### Базы данных

**SQL основы**
- [SQL Basics](/07-sql-databases/01-sql-basics) - SELECT, JOIN, подзапросы
- [Aggregate Functions](/07-sql-databases/02-aggregate-functions) - COUNT, SUM, AVG
- [Indexes](/07-sql-databases/03-indexes) - типы индексов, оптимизация
- [Transactions](/07-sql-databases/04-transactions) - ACID, уровни изоляции
- [Normalization](/07-sql-databases/05-normalization) - нормальные формы

**Оптимизация**
- [N+1 Query Problem](/07-sql-databases/06-n-plus-one) - eager loading
- [Query Optimization](/07-sql-databases/07-query-optimization) - EXPLAIN, индексы
- [Caching](/07-sql-databases/09-caching) - кеширование запросов

### Testing

- [Unit Tests](/08-testing/01-unit-tests) - тестирование изолированных компонентов
- [Feature Tests](/08-testing/02-feature-tests) - интеграционные тесты
- [TDD](/08-testing/03-tdd) - разработка через тестирование
- [Mocking & Stubbing](/08-testing/04-mocking-stubbing) - моки, стабы
- [PHPUnit](/08-testing/05-phpunit) - фреймворк для тестирования

### Security

- [XSS](/09-security/01-xss) - защита от XSS атак
- [CSRF](/09-security/02-csrf) - токены, защита форм
- [SQL Injection](/09-security/03-sql-injection) - параметризованные запросы
- [Authentication](/09-security/04-authentication) - аутентификация пользователей
- [Authorization](/09-security/05-authorization) - права доступа, policies
- [OWASP Top 10](/09-security/08-owasp-top-10) - основные уязвимости

### API Development

- [REST API](/10-api-development/01-rest-api) - принципы REST
- [API Versioning](/10-api-development/05-api-versioning) - версионирование API
- [Rate Limiting](/10-api-development/04-rate-limiting) - ограничение запросов
- [CORS](/10-api-development/06-cors) - кросс-доменные запросы
- [Swagger Documentation](/10-api-development/03-swagger-documentation) - документирование

### Docker

- [Docker Basics](/11-docker/01-docker-basics) - контейнеры, образы
- [Dockerfile](/11-docker/02-dockerfile) - создание образов
- [Docker Compose](/11-docker/03-docker-compose) - multi-container приложения
- [CI/CD](/11-docker/04-ci-cd) - автоматизация деплоя

---

## Senior Developer

### Database Advanced

**Продвинутые возможности**
- [Replication](/12-database-advanced/01-replication) - репликация данных
- [Sharding](/12-database-advanced/02-sharding) - горизонтальное масштабирование
- [Window Functions](/12-database-advanced/03-window-functions) - аналитические функции
- [Isolation Levels](/12-database-advanced/04-isolation-levels) - уровни изоляции
- [Locks](/12-database-advanced/05-locks) - блокировки, deadlocks
- [JSONB](/12-database-advanced/06-jsonb) - работа с JSON в PostgreSQL
- [Materialized Views](/12-database-advanced/07-materialized-views) - материализованные представления
- [Partitioning](/12-database-advanced/08-partitioning) - партиционирование таблиц

**Оптимизация**
- [Normalization](/13-database-optimization/01-normalization) - нормализация
- [Denormalization](/13-database-optimization/02-denormalization) - денормализация
- [Big Data](/13-database-optimization/03-big-data) - работа с большими объемами

### Caching

- [Caching Strategies](/14-caching/01-strategies) - стратегии кеширования
- [Redis](/14-caching/02-redis) - in-memory кеш
- [Memcached](/14-caching/03-memcached) - распределенный кеш
- [HTTP Cache](/14-caching/04-http-cache) - браузерное кеширование
- [OPcache](/14-caching/05-opcache) - кеширование байт-кода

### Performance

- [Caching](/15-performance/01-caching) - применение кеширования
- [Database Optimization](/15-performance/02-database-optimization) - оптимизация БД
- [Query Optimization](/15-performance/03-query-optimization) - оптимизация запросов
- [PHP Optimization](/15-performance/05-php-optimization) - оптимизация PHP кода
- [Scaling](/15-performance/06-scaling) - масштабирование приложений

### Principles & Patterns

**Принципы проектирования**
- [KISS, DRY, YAGNI](/16-principles/01-kiss-dry-yagni) - базовые принципы
- [GRASP](/16-principles/02-grasp) - шаблоны распределения ответственности

**Архитектурные паттерны**
- [MVC](/17-architecture-patterns/01-mvc) - Model-View-Controller
- [Repository Pattern](/17-architecture-patterns/02-repository-pattern) - абстракция данных
- [Service Layer](/17-architecture-patterns/03-service-layer) - бизнес-логика
- [SOLID](/17-architecture-patterns/04-solid) - принципы ООП
- [DDD](/17-architecture-patterns/05-ddd) - Domain-Driven Design
- [CQRS](/17-architecture-patterns/06-cqrs) - разделение команд и запросов
- [Event Sourcing](/17-architecture-patterns/07-event-sourcing) - событийное хранение
- [Dependency Injection](/17-architecture-patterns/08-dependency-injection) - внедрение зависимостей

**Design Patterns**
- [Creational Patterns](/18-design-patterns/01-creational) - порождающие паттерны
- [Structural Patterns](/18-design-patterns/02-structural) - структурные паттерны
- [Behavioral Patterns](/18-design-patterns/03-behavioral) - поведенческие паттерны

### Message Brokers

- [RabbitMQ](/19-message-brokers/01-rabbitmq) - очереди сообщений
- [Kafka](/19-message-brokers/02-kafka) - event streaming
- [Redis Pub/Sub](/19-message-brokers/03-redis-pubsub) - публикация/подписка
- [Comparison](/19-message-brokers/04-comparison) - сравнение решений

### Microservices

- [Monolith vs Microservices](/20-microservices/01-monolith-vs-microservices) - выбор архитектуры
- [API Gateway](/20-microservices/02-api-gateway) - единая точка входа
- [Circuit Breaker](/20-microservices/03-circuit-breaker) - защита от сбоев
- [Service Discovery](/20-microservices/04-service-discovery) - обнаружение сервисов
- [Saga Pattern](/20-microservices/05-saga-pattern) - распределенные транзакции

### Soft Skills

- [Code Review](/21-soft-skills/01-code-review) - ревью кода
- [Agile & Scrum](/21-soft-skills/02-agile-scrum) - методологии разработки
- [Tech Interview](/21-soft-skills/03-tech-interview) - прохождение интервью
- [Documentation](/21-soft-skills/04-documentation) - документирование кода

---

## Практика

После изучения теории важно закрепить знания на практике:

- [Coding Challenges](/22-practice/01-coding-challenges) - алгоритмические задачи
- [System Design](/22-practice/02-system-design) - проектирование систем
- [Debugging](/22-practice/03-debugging) - отладка и поиск ошибок
- [Refactoring](/22-practice/04-refactoring) - рефакторинг кода
- [Real World Cases](/22-practice/05-real-world-cases) - реальные кейсы

---

## Дополнительные рекомендации

**Для Junior**
- Пиши код каждый день
- Делай pet-проекты
- Читай чужой код на GitHub
- Участвуй в code review

**Для Middle**
- Изучай архитектуру реальных проектов
- Практикуй TDD
- Оптимизируй производительность
- Делись знаниями с командой

**Для Senior**
- Проектируй архитектуру систем
- Менторь junior разработчиков
- Изучай DevOps практики
- Следи за трендами индустрии

**С ментором**
Программа менторинга CodeMate помогает пройти этот путь быстрее: персональные консультации, код-ревью, mock-интервью и помощь с трудоустройством. Подробности на [codemate.team](https://codemate.team).
