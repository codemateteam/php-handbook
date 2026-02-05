# 📚 Книга по подготовке к собеседованиям PHP/Laravel

> Полное руководство с примерами из практики, плюсами/минусами и готовыми ответами

---

## 🎯 Структура книги (от простого к сложному)

### УРОВЕНЬ 1: PHP ОСНОВЫ (Junior)

#### [1. PHP Основы](./01-php-basics/)
- [1.1 Типы данных](./01-php-basics/01-types.md) ✅
- [1.2 Переменные](./01-php-basics/02-variables.md)
- [1.3 Операторы](./01-php-basics/03-operators.md)
- [1.4 Управляющие конструкции](./01-php-basics/04-control-structures.md)
- [1.5 Функции](./01-php-basics/05-functions.md)
- [1.6 Массивы](./01-php-basics/06-arrays.md)
- [1.7 Строки и регулярные выражения](./01-php-basics/07-strings-regex.md)

#### [2. ООП в PHP](./02-oop/)
- [2.1 Классы и объекты](./02-oop/01-classes-objects.md)
- [2.2 Наследование](./02-oop/02-inheritance.md)
- [2.3 Интерфейсы](./02-oop/03-interfaces.md)
- [2.4 Абстрактные классы](./02-oop/04-abstract-classes.md)
- [2.5 Трейты](./02-oop/05-traits.md)
- [2.6 Магические методы](./02-oop/06-magic-methods.md)
- [2.7 Статическое связывание](./02-oop/07-static-binding.md)
- [2.8 Область видимости](./02-oop/08-visibility.md)

#### [3. PHP Продвинутое](./03-php-advanced/)
- [3.1 Пространства имён](./03-php-advanced/01-namespaces.md)
- [3.2 Автозагрузка (Composer, PSR-4)](./03-php-advanced/02-autoloading.md)
- [3.3 Исключения и ошибки](./03-php-advanced/03-exceptions.md)
- [3.4 PSR стандарты](./03-php-advanced/04-psr.md)
- [3.5 Генераторы](./03-php-advanced/05-generators.md)
- [3.6 Рефлексия](./03-php-advanced/06-reflection.md)
- [3.7 Новые возможности PHP 8.x](./03-php-advanced/07-php8-features.md)

---

### УРОВЕНЬ 2: LARAVEL & ФРЕЙМВОРКИ (Middle)

#### [4. Laravel Основы](./04-laravel-basics/)
- [4.1 Архитектура Laravel](./04-laravel-basics/01-architecture.md)
- [4.2 Service Container](./04-laravel-basics/02-service-container.md)
- [4.3 Service Providers](./04-laravel-basics/03-service-providers.md)
- [4.4 Facades](./04-laravel-basics/04-facades.md)
- [4.5 Маршрутизация](./04-laravel-basics/05-routing.md)
- [4.6 Middleware](./04-laravel-basics/06-middleware.md)
- [4.7 Контроллеры](./04-laravel-basics/07-controllers.md)
- [4.8 Request/Response](./04-laravel-basics/08-request-response.md)

#### [5. Laravel Eloquent & БД](./05-laravel-eloquent/)
- [5.1 Eloquent ORM](./05-laravel-eloquent/01-eloquent.md)
- [5.2 Связи (Relationships)](./05-laravel-eloquent/02-relationships.md)
- [5.3 Eager Loading (N+1 проблема)](./05-laravel-eloquent/03-eager-loading.md)
- [5.4 Query Builder](./05-laravel-eloquent/04-query-builder.md)
- [5.5 Миграции](./05-laravel-eloquent/05-migrations.md)
- [5.6 Сидеры и фабрики](./05-laravel-eloquent/06-seeders-factories.md)

#### [6. Laravel Продвинутое](./06-laravel-advanced/)
- [6.1 Валидация](./06-laravel-advanced/01-validation.md)
- [6.2 Авторизация (Gates, Policies)](./06-laravel-advanced/02-authorization.md)
- [6.3 Очереди (Queues)](./06-laravel-advanced/03-queues.md)
- [6.4 Events & Listeners](./06-laravel-advanced/04-events-listeners.md)
- [6.5 Планировщик задач](./06-laravel-advanced/05-scheduler.md)
- [6.6 Коллекции](./06-laravel-advanced/06-collections.md)
- [6.7 API Resources](./06-laravel-advanced/07-api-resources.md)
- [6.8 Обработка ошибок](./06-laravel-advanced/08-error-handling.md)

---

### УРОВЕНЬ 3: БАЗЫ ДАННЫХ (Middle+)

#### [7. SQL Основы](./07-sql-basics/)
- [7.1 Типы данных](./07-sql-basics/01-data-types.md)
- [7.2 SELECT, WHERE, ORDER BY](./07-sql-basics/02-select.md)
- [7.3 JOIN'ы](./07-sql-basics/03-joins.md)
- [7.4 GROUP BY, HAVING](./07-sql-basics/04-grouping.md)
- [7.5 Подзапросы](./07-sql-basics/05-subqueries.md)

#### [8. PostgreSQL/MySQL](./08-database-advanced/)
- [8.1 Транзакции и ACID](./08-database-advanced/01-transactions.md)
- [8.2 Уровни изоляции](./08-database-advanced/02-isolation-levels.md)
- [8.3 Блокировки](./08-database-advanced/03-locks.md)
- [8.4 Индексы](./08-database-advanced/04-indexes.md)
- [8.5 EXPLAIN / EXPLAIN ANALYZE](./08-database-advanced/05-explain.md)
- [8.6 JSONB](./08-database-advanced/06-jsonb.md)
- [8.7 Оконные функции](./08-database-advanced/07-window-functions.md)
- [8.8 Materialized Views](./08-database-advanced/08-materialized-views.md)
- [8.9 Партиционирование](./08-database-advanced/09-partitioning.md)
- [8.10 Cursor](./08-database-advanced/10-cursor.md)

#### [9. Оптимизация БД](./09-database-optimization/)
- [9.1 N+1 Query Problem](./09-database-optimization/01-n-plus-one.md)
- [9.2 Query Optimization](./09-database-optimization/02-query-optimization.md)
- [9.3 Нормализация](./09-database-optimization/03-normalization.md)
- [9.4 Денормализация](./09-database-optimization/04-denormalization.md)
- [9.5 Работа с большими данными](./09-database-optimization/05-big-data.md)
- [9.6 Репликация](./09-database-optimization/06-replication.md)
- [9.7 Шардинг](./09-database-optimization/07-sharding.md)

---

### УРОВЕНЬ 4: ПРИНЦИПЫ & АРХИТЕКТУРА (Senior)

#### [10. Принципы проектирования](./10-principles/)
- [10.1 SOLID](./10-principles/01-solid.md)
- [10.2 KISS, DRY, YAGNI](./10-principles/02-kiss-dry-yagni.md)
- [10.3 GRASP](./10-principles/03-grasp.md)

#### [11. Паттерны проектирования](./11-design-patterns/)
- [11.1 Порождающие паттерны](./11-design-patterns/01-creational.md)
  - Singleton, Factory, Builder, Prototype
- [11.2 Структурные паттерны](./11-design-patterns/02-structural.md)
  - Adapter, Decorator, Facade, Proxy
- [11.3 Поведенческие паттерны](./11-design-patterns/03-behavioral.md)
  - Strategy, Observer, Command, Chain of Responsibility

#### [12. Архитектурные паттерны](./12-architecture/)
- [12.1 MVC](./12-architecture/01-mvc.md)
- [12.2 Repository Pattern](./12-architecture/02-repository.md)
- [12.3 Service Layer](./12-architecture/03-service-layer.md)
- [12.4 DTO (Data Transfer Object)](./12-architecture/04-dto.md)
- [12.5 Dependency Injection](./12-architecture/05-dependency-injection.md)
- [12.6 Domain-Driven Design (DDD)](./12-architecture/06-ddd.md)
- [12.7 Event Sourcing](./12-architecture/07-event-sourcing.md)
- [12.8 CQRS](./12-architecture/08-cqrs.md)

---

### УРОВЕНЬ 5: СИСТЕМЫ & ИНФРАСТРУКТУРА (Senior+)

#### [13. Message Brokers](./13-message-brokers/)
- [13.1 RabbitMQ](./13-message-brokers/01-rabbitmq.md)
- [13.2 Kafka](./13-message-brokers/02-kafka.md)
- [13.3 Redis Pub/Sub](./13-message-brokers/03-redis-pubsub.md)
- [13.4 Сравнение](./13-message-brokers/04-comparison.md)

#### [14. Кэширование](./14-caching/)
- [14.1 Стратегии кэширования](./14-caching/01-strategies.md)
- [14.2 Redis](./14-caching/02-redis.md)
- [14.3 Memcached](./14-caching/03-memcached.md)
- [14.4 HTTP Cache](./14-caching/04-http-cache.md)
- [14.5 OPcache](./14-caching/05-opcache.md)

#### [15. Highload & Performance](./15-performance/)
- [15.1 Профилирование](./15-performance/01-profiling.md)
- [15.2 Оптимизация PHP](./15-performance/02-php-optimization.md)
- [15.3 Вертикальное масштабирование](./15-performance/03-vertical-scaling.md)
- [15.4 Горизонтальное масштабирование](./15-performance/04-horizontal-scaling.md)
- [15.5 Load Balancing](./15-performance/05-load-balancing.md)
- [15.6 CDN](./15-performance/06-cdn.md)

#### [16. Микросервисы](./16-microservices/)
- [16.1 Монолит vs Микросервисы](./16-microservices/01-monolith-vs-microservices.md)
- [16.2 API Gateway](./16-microservices/02-api-gateway.md)
- [16.3 Service Discovery](./16-microservices/03-service-discovery.md)
- [16.4 Circuit Breaker](./16-microservices/04-circuit-breaker.md)
- [16.5 Saga Pattern](./16-microservices/05-saga-pattern.md)

---

### УРОВЕНЬ 6: ДОПОЛНИТЕЛЬНЫЕ ТЕМЫ

#### [17. Безопасность](./17-security/)
- [17.1 SQL Injection](./17-security/01-sql-injection.md)
- [17.2 XSS](./17-security/02-xss.md)
- [17.3 CSRF](./17-security/03-csrf.md)
- [17.4 Аутентификация (JWT, OAuth)](./17-security/04-authentication.md)
- [17.5 Авторизация](./17-security/05-authorization.md)
- [17.6 Хеширование паролей](./17-security/06-password-hashing.md)

#### [18. Тестирование](./18-testing/)
- [18.1 Unit Testing](./18-testing/01-unit-testing.md)
- [18.2 Integration Testing](./18-testing/02-integration-testing.md)
- [18.3 Feature Testing](./18-testing/03-feature-testing.md)
- [18.4 Моки и стабы](./18-testing/04-mocks-stubs.md)
- [18.5 TDD](./18-testing/05-tdd.md)

#### [19. DevOps](./19-devops/)
- [19.1 Docker](./19-devops/01-docker.md)
- [19.2 CI/CD](./19-devops/02-ci-cd.md)
- [19.3 Git](./19-devops/03-git.md)
- [19.4 Linux](./19-devops/04-linux.md)

---

## 📝 Формат каждой темы

Каждая тема содержит:

1. **Что это** — определение простыми словами
2. **Как работает** — минимальный пример из практики
3. **Плюсы** — преимущества
4. **Минусы** — недостатки
5. **Когда использовать** — конкретные use cases
6. **Пример из практики** — реальный пример
7. **На собеседовании скажешь** — готовый короткий ответ

---

## 🎯 Как использовать книгу

### Для изучения:
1. Читай последовательно (от 1 к 19)
2. Каждый раздел ~10-15 минут
3. Пробуй примеры кода

### Перед собеседованием:
1. Повтори нужные разделы по уровню (Junior/Middle/Senior)
2. Прочитай "На собеседовании скажешь" для каждой темы
3. Вспомни примеры из своих проектов

### По темам из вакансии:
1. Ctrl+F по нужной теме
2. Прочитай весь раздел
3. Подготовь свой пример

---

## ✅ Progress

**Создано:** 1 / 200+ тем

**Приоритет 1 (Junior):**
- [ ] PHP Основы (20+ тем)
- [ ] ООП в PHP (10+ тем)

**Приоритет 2 (Middle):**
- [ ] Laravel Основы (20+ тем)
- [ ] SQL Основы (10+ тем)

**Приоритет 3 (Senior):**
- [ ] Архитектура (15+ тем)
- [ ] Performance (10+ тем)

---

**Начинаем с PHP Основ!** 🚀
