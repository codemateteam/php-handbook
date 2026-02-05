import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PHP/Laravel Handbook',
  description: 'Полное руководство по подготовке к собеседованиям на PHP/Laravel разработчика',
  lang: 'ru-RU',

  ignoreDeadLinks: true,

  base: '/php-handbook/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/php-handbook/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'ru' }],
    ['meta', { property: 'og:title', content: 'PHP/Laravel Interview Handbook' }],
    ['meta', { property: 'og:site_name', content: 'PHP/Laravel Handbook' }],
    ['meta', { property: 'og:url', content: 'https://codemateteam.github.io/php-handbook/' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'Менторинг', link: 'https://codemate.team' },
      { text: 'GitHub', link: 'https://github.com/codemateteam/php-handbook' }
    ],

    sidebar: [
      {
        text: 'PHP Основы',
        collapsed: false,
        items: [
          { text: 'Типы данных', link: '/01-php-basics/01-types' },
          { text: 'Переменные', link: '/01-php-basics/02-variables' },
          { text: 'Операторы', link: '/01-php-basics/03-operators' },
          { text: 'Управляющие конструкции', link: '/01-php-basics/04-control-structures' },
          { text: 'Функции', link: '/01-php-basics/05-functions' },
          { text: 'Массивы', link: '/01-php-basics/06-arrays' },
          { text: 'Строки и регулярные выражения', link: '/01-php-basics/07-strings-regex' }
        ]
      },
      {
        text: 'ООП в PHP',
        collapsed: false,
        items: [
          { text: 'Классы и объекты', link: '/02-oop/01-classes-objects' },
          { text: 'Наследование', link: '/02-oop/02-inheritance' },
          { text: 'Интерфейсы', link: '/02-oop/03-interfaces' },
          { text: 'Абстрактные классы', link: '/02-oop/04-abstract-classes' },
          { text: 'Трейты', link: '/02-oop/05-traits' },
          { text: 'Магические методы', link: '/02-oop/06-magic-methods' },
          { text: 'Статическое связывание', link: '/02-oop/07-static-binding' },
          { text: 'Область видимости', link: '/02-oop/08-visibility' }
        ]
      },
      {
        text: 'PHP Продвинутое',
        collapsed: false,
        items: [
          { text: 'Пространства имён', link: '/03-php-advanced/01-namespaces' },
          { text: 'Автозагрузка (Composer, PSR-4)', link: '/03-php-advanced/02-autoloading' },
          { text: 'Исключения и ошибки', link: '/03-php-advanced/03-exceptions' },
          { text: 'PSR стандарты', link: '/03-php-advanced/04-psr' },
          { text: 'Генераторы', link: '/03-php-advanced/05-generators' },
          { text: 'Рефлексия', link: '/03-php-advanced/06-reflection' },
          { text: 'Новые возможности PHP 8.x', link: '/03-php-advanced/07-php8-features' }
        ]
      },
      {
        text: 'Git',
        collapsed: false,
        items: [
          { text: 'Git Basics', link: '/04-git/01-git-basics' },
          { text: 'Branching Strategies', link: '/04-git/02-branching-strategies' },
          { text: 'Rebase vs Merge', link: '/04-git/03-rebase-vs-merge' },
          { text: 'Git Flow', link: '/04-git/04-git-flow' },
          { text: 'Conflict Resolution', link: '/04-git/05-conflict-resolution' }
        ]
      },
      {
        text: 'Laravel Основы',
        collapsed: false,
        items: [
          { text: 'Архитектура Laravel', link: '/05-laravel-basics/01-architecture' },
          { text: 'Service Container', link: '/05-laravel-basics/02-service-container' },
          { text: 'Service Providers', link: '/05-laravel-basics/03-service-providers' },
          { text: 'Facades', link: '/05-laravel-basics/04-facades' },
          { text: 'Маршрутизация', link: '/05-laravel-basics/05-routing' },
          { text: 'Middleware', link: '/05-laravel-basics/06-middleware' },
          { text: 'Контроллеры', link: '/05-laravel-basics/07-controllers' },
          { text: 'Request/Response', link: '/05-laravel-basics/08-request-response' }
        ]
      },
      {
        text: 'Laravel Продвинутое',
        collapsed: false,
        items: [
          { text: 'Eloquent Relationships', link: '/06-laravel-advanced/01-eloquent-relationships' },
          { text: 'Query Builder', link: '/06-laravel-advanced/02-query-builder' },
          { text: 'Миграции и Сидеры', link: '/06-laravel-advanced/03-migrations-seeders' },
          { text: 'Events & Listeners', link: '/06-laravel-advanced/04-events-listeners' },
          { text: 'Jobs & Queues', link: '/06-laravel-advanced/05-jobs-queues' },
          { text: 'Notifications', link: '/06-laravel-advanced/06-notifications' },
          { text: 'API Resources', link: '/06-laravel-advanced/07-api-resources' },
          { text: 'Validation', link: '/06-laravel-advanced/08-validation' }
        ]
      },
      {
        text: 'SQL & Databases',
        collapsed: true,
        items: [
          { text: 'SQL Basics', link: '/07-sql-databases/01-sql-basics' },
          { text: 'Aggregate Functions', link: '/07-sql-databases/02-aggregate-functions' },
          { text: 'Indexes', link: '/07-sql-databases/03-indexes' },
          { text: 'Transactions', link: '/07-sql-databases/04-transactions' },
          { text: 'Normalization', link: '/07-sql-databases/05-normalization' },
          { text: 'N+1 Query Problem', link: '/07-sql-databases/06-n-plus-one' },
          { text: 'Query Optimization', link: '/07-sql-databases/07-query-optimization' },
          { text: 'Redis', link: '/07-sql-databases/08-redis' },
          { text: 'Caching', link: '/07-sql-databases/09-caching' }
        ]
      },
      {
        text: 'Testing',
        collapsed: true,
        items: [
          { text: 'Unit Tests', link: '/08-testing/01-unit-tests' },
          { text: 'Feature Tests', link: '/08-testing/02-feature-tests' },
          { text: 'TDD', link: '/08-testing/03-tdd' },
          { text: 'Mocking & Stubbing', link: '/08-testing/04-mocking-stubbing' },
          { text: 'PHPUnit', link: '/08-testing/05-phpunit' },
          { text: 'Pest', link: '/08-testing/06-pest' },
          { text: 'Test Coverage', link: '/08-testing/07-test-coverage' }
        ]
      },
      {
        text: 'Security',
        collapsed: true,
        items: [
          { text: 'XSS', link: '/09-security/01-xss' },
          { text: 'CSRF', link: '/09-security/02-csrf' },
          { text: 'SQL Injection', link: '/09-security/03-sql-injection' },
          { text: 'Authentication', link: '/09-security/04-authentication' },
          { text: 'Authorization', link: '/09-security/05-authorization' },
          { text: 'Encryption', link: '/09-security/06-encryption' },
          { text: 'HTTPS & SSL', link: '/09-security/07-https-ssl' },
          { text: 'OWASP Top 10', link: '/09-security/08-owasp-top-10' }
        ]
      },
      {
        text: 'API Development',
        collapsed: true,
        items: [
          { text: 'REST API', link: '/10-api-development/01-rest-api' },
          { text: 'GraphQL', link: '/10-api-development/02-graphql' },
          { text: 'Swagger Documentation', link: '/10-api-development/03-swagger-documentation' },
          { text: 'Rate Limiting', link: '/10-api-development/04-rate-limiting' },
          { text: 'API Versioning', link: '/10-api-development/05-api-versioning' },
          { text: 'CORS', link: '/10-api-development/06-cors' }
        ]
      },
      {
        text: 'Docker',
        collapsed: true,
        items: [
          { text: 'Docker Basics', link: '/11-docker/01-docker-basics' },
          { text: 'Dockerfile', link: '/11-docker/02-dockerfile' },
          { text: 'Docker Compose', link: '/11-docker/03-docker-compose' },
          { text: 'CI/CD', link: '/11-docker/04-ci-cd' },
          { text: 'Deployment Strategies', link: '/11-docker/05-deployment' },
          { text: 'Monitoring & Logging', link: '/11-docker/06-monitoring' }
        ]
      },
      {
        text: 'Database Advanced',
        collapsed: true,
        items: [
          { text: 'Replication', link: '/12-database-advanced/01-replication' },
          { text: 'Sharding', link: '/12-database-advanced/02-sharding' },
          { text: 'Window Functions', link: '/12-database-advanced/03-window-functions' },
          { text: 'Isolation Levels', link: '/12-database-advanced/04-isolation-levels' },
          { text: 'Locks', link: '/12-database-advanced/05-locks' },
          { text: 'JSONB', link: '/12-database-advanced/06-jsonb' },
          { text: 'Materialized Views', link: '/12-database-advanced/07-materialized-views' },
          { text: 'Partitioning', link: '/12-database-advanced/08-partitioning' },
          { text: 'Cursor', link: '/12-database-advanced/09-cursor' }
        ]
      },
      {
        text: 'Database Optimization',
        collapsed: true,
        items: [
          { text: 'Normalization', link: '/13-database-optimization/01-normalization' },
          { text: 'Denormalization', link: '/13-database-optimization/02-denormalization' },
          { text: 'Big Data', link: '/13-database-optimization/03-big-data' }
        ]
      },
      {
        text: 'Caching',
        collapsed: true,
        items: [
          { text: 'Caching Strategies', link: '/14-caching/01-strategies' },
          { text: 'Redis', link: '/14-caching/02-redis' },
          { text: 'Memcached', link: '/14-caching/03-memcached' },
          { text: 'HTTP Cache', link: '/14-caching/04-http-cache' },
          { text: 'OPcache', link: '/14-caching/05-opcache' }
        ]
      },
      {
        text: 'Performance',
        collapsed: true,
        items: [
          { text: 'Caching', link: '/15-performance/01-caching' },
          { text: 'Database Optimization', link: '/15-performance/02-database-optimization' },
          { text: 'Query Optimization', link: '/15-performance/03-query-optimization' },
          { text: 'Frontend Optimization', link: '/15-performance/04-frontend-optimization' },
          { text: 'PHP Optimization', link: '/15-performance/05-php-optimization' },
          { text: 'Scaling', link: '/15-performance/06-scaling' }
        ]
      },
      {
        text: 'Principles',
        collapsed: true,
        items: [
          { text: 'KISS, DRY, YAGNI', link: '/16-principles/01-kiss-dry-yagni' },
          { text: 'GRASP', link: '/16-principles/02-grasp' }
        ]
      },
      {
        text: 'Architecture Patterns',
        collapsed: true,
        items: [
          { text: 'MVC', link: '/17-architecture-patterns/01-mvc' },
          { text: 'Repository Pattern', link: '/17-architecture-patterns/02-repository-pattern' },
          { text: 'Service Layer', link: '/17-architecture-patterns/03-service-layer' },
          { text: 'SOLID', link: '/17-architecture-patterns/04-solid' },
          { text: 'Domain-Driven Design', link: '/17-architecture-patterns/05-ddd' },
          { text: 'CQRS', link: '/17-architecture-patterns/06-cqrs' },
          { text: 'Event Sourcing', link: '/17-architecture-patterns/07-event-sourcing' },
          { text: 'Dependency Injection', link: '/17-architecture-patterns/08-dependency-injection' },
          { text: 'Factory Pattern', link: '/17-architecture-patterns/09-factory-pattern' },
          { text: 'Observer Pattern', link: '/17-architecture-patterns/10-observer-pattern' }
        ]
      },
      {
        text: 'Design Patterns',
        collapsed: true,
        items: [
          { text: 'Creational Patterns', link: '/18-design-patterns/01-creational' },
          { text: 'Structural Patterns', link: '/18-design-patterns/02-structural' },
          { text: 'Behavioral Patterns', link: '/18-design-patterns/03-behavioral' }
        ]
      },
      {
        text: 'Message Brokers',
        collapsed: true,
        items: [
          { text: 'RabbitMQ', link: '/19-message-brokers/01-rabbitmq' },
          { text: 'Kafka', link: '/19-message-brokers/02-kafka' },
          { text: 'Redis Pub/Sub', link: '/19-message-brokers/03-redis-pubsub' },
          { text: 'Comparison', link: '/19-message-brokers/04-comparison' }
        ]
      },
      {
        text: 'Microservices',
        collapsed: true,
        items: [
          { text: 'Monolith vs Microservices', link: '/20-microservices/01-monolith-vs-microservices' },
          { text: 'API Gateway', link: '/20-microservices/02-api-gateway' },
          { text: 'Circuit Breaker', link: '/20-microservices/03-circuit-breaker' },
          { text: 'Service Discovery', link: '/20-microservices/04-service-discovery' },
          { text: 'Saga Pattern', link: '/20-microservices/05-saga-pattern' }
        ]
      },
      {
        text: 'Soft Skills',
        collapsed: true,
        items: [
          { text: 'Code Review', link: '/21-soft-skills/01-code-review' },
          { text: 'Agile & Scrum', link: '/21-soft-skills/02-agile-scrum' },
          { text: 'Tech Interview', link: '/21-soft-skills/03-tech-interview' },
          { text: 'Documentation', link: '/21-soft-skills/04-documentation' },
          { text: 'Time Management', link: '/21-soft-skills/05-time-management' }
        ]
      },
      {
        text: 'Practice',
        collapsed: true,
        items: [
          { text: 'Coding Challenges', link: '/22-practice/01-coding-challenges' },
          { text: 'System Design', link: '/22-practice/02-system-design' },
          { text: 'Debugging', link: '/22-practice/03-debugging' },
          { text: 'Refactoring', link: '/22-practice/04-refactoring' },
          { text: 'Real World Cases', link: '/22-practice/05-real-world-cases' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/codemateteam/php-handbook' }
    ],

    editLink: {
      pattern: 'https://github.com/codemateteam/php-handbook/edit/main/:path',
      text: 'Редактировать эту страницу на GitHub'
    },

    footer: {
      message: 'Опубликовано под лицензией MIT',
      copyright: 'Сделано с ❤️ командой CodeMate'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Поиск',
            buttonAriaLabel: 'Поиск'
          },
          modal: {
            noResultsText: 'Нет результатов для',
            resetButtonTitle: 'Сбросить поиск',
            footer: {
              selectText: 'выбрать',
              navigateText: 'перейти',
              closeText: 'закрыть'
            }
          }
        }
      }
    },

    outline: {
      level: [2, 3],
      label: 'На этой странице'
    },

    docFooter: {
      prev: 'Предыдущая страница',
      next: 'Следующая страница'
    },

    lastUpdated: {
      text: 'Обновлено',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },

    darkModeSwitchLabel: 'Тема',
    lightModeSwitchTitle: 'Переключить на светлую тему',
    darkModeSwitchTitle: 'Переключить на темную тему',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Вернуться к началу'
  }
})
