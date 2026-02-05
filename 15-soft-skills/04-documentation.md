# 15.4 Документация

## Что это

**Типы документации:**

```
1. Code comments (комментарии в коде)
2. API documentation (Swagger/OpenAPI)
3. README (обзор проекта)
4. Technical documentation (архитектура)
5. User documentation (для пользователей)
```

---

## Code Comments

**Когда комментировать:**

```php
✅ ХОРОШО: Объяснение "почему"

// Используем MD5 hash для backward compatibility с legacy API
// TODO: Migrate to bcrypt in v2.0
$hash = md5($password);

// Workaround для бага в PHP 8.0 (https://bugs.php.net/bug.php?id=12345)
if (version_compare(PHP_VERSION, '8.0', '>=')) {
    // альтернативный код
}

// Бизнес-логика: скидка 10% для VIP клиентов на заказы > $100
if ($user->isVip() && $order->total > 100) {
    $discount = 0.10;
}
```

```php
❌ ПЛОХО: Комментирование очевидного

// Получить пользователя по ID
$user = User::find($id);

// Установить имя
$user->name = $name;

// Сохранить пользователя
$user->save();
```

```php
✅ ЛУЧШЕ: Само-документирующийся код

function applyVipDiscount(Order $order, User $user): void
{
    if ($user->isVip() && $order->exceedsMinimumForDiscount()) {
        $order->applyDiscount(self::VIP_DISCOUNT_PERCENTAGE);
    }
}
```

---

## PHPDoc

**Для классов:**

```php
/**
 * Service for processing user payments
 *
 * Handles payment processing through multiple gateways
 * (Stripe, PayPal) with automatic retry logic and fraud detection.
 *
 * @package App\Services
 * @author John Doe <john@example.com>
 */
class PaymentService
{
    // ...
}
```

**Для методов:**

```php
/**
 * Process payment for an order
 *
 * Charges the customer's payment method and creates a payment
 * record in the database. Automatically retries failed payments
 * up to 3 times with exponential backoff.
 *
 * @param Order $order The order to process payment for
 * @param PaymentMethod $method Customer's payment method
 * @return Payment The created payment record
 *
 * @throws PaymentFailedException If payment fails after all retries
 * @throws InsufficientFundsException If customer has insufficient funds
 *
 * @example
 * $payment = $paymentService->processPayment($order, $card);
 */
public function processPayment(Order $order, PaymentMethod $method): Payment
{
    // ...
}
```

**Для сложных параметров:**

```php
/**
 * Create a new user with additional data
 *
 * @param array $data User data
 * @param array $data['name'] string User's full name
 * @param array $data['email'] string User's email address
 * @param array $data['roles'] array<string> Optional array of role names
 * @param array $data['profile'] array Optional profile data
 * @param array $data['profile']['avatar'] string Optional avatar URL
 *
 * @return User
 */
public function createUser(array $data): User
{
    // ...
}
```

---

## API Documentation

**OpenAPI (Swagger):**

```php
/**
 * @OA\Get(
 *     path="/api/users/{id}",
 *     summary="Get user by ID",
 *     tags={"Users"},
 *     @OA\Parameter(
 *         name="id",
 *         in="path",
 *         required=true,
 *         @OA\Schema(type="integer")
 *     ),
 *     @OA\Response(
 *         response=200,
 *         description="Successful operation",
 *         @OA\JsonContent(ref="#/components/schemas/User")
 *     ),
 *     @OA\Response(
 *         response=404,
 *         description="User not found"
 *     )
 * )
 */
public function show(int $id)
{
    return User::findOrFail($id);
}
```

**Laravel API Resources (альтернатива):**

```php
// app/Http/Resources/UserResource.php
/**
 * User resource representation
 *
 * @property int $id User ID
 * @property string $name User's full name
 * @property string $email User's email
 * @property Carbon $created_at Account creation date
 */
class UserResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

---

## README.md

**Структура:**

```markdown
# Project Name

Brief description of what the project does.

## Features

- User authentication
- Payment processing
- Real-time notifications
- Admin dashboard

## Requirements

- PHP 8.2+
- MySQL 8.0+
- Redis 6.0+
- Node.js 18+

## Installation

```bash
# Clone repository
git clone https://github.com/user/project.git
cd project

# Install dependencies
composer install
npm install

# Setup environment
cp .env.example .env
php artisan key:generate

# Setup database
php artisan migrate --seed

# Build assets
npm run build
```

## Configuration

### Database
Edit `.env`:
```
DB_HOST=localhost
DB_DATABASE=myapp
DB_USERNAME=root
DB_PASSWORD=secret
```

### Queue
```bash
php artisan queue:work
```

## Usage

### Running locally
```bash
php artisan serve
npm run dev
```

Visit http://localhost:8000

### Running tests
```bash
php artisan test
```

## API Documentation

API docs available at: http://localhost:8000/api/documentation

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT License
```

---

## Technical Documentation

**Architecture Overview:**

```markdown
# Architecture

## Overview

The application follows a layered architecture:

```
┌─────────────────────────────────┐
│         Controllers             │
├─────────────────────────────────┤
│          Services               │
├─────────────────────────────────┤
│        Repositories             │
├─────────────────────────────────┤
│           Models                │
└─────────────────────────────────┘
```

## Layers

### Controllers
Handle HTTP requests, validate input, return responses.
Located in: `app/Http/Controllers`

### Services
Contain business logic, orchestrate operations.
Located in: `app/Services`

### Repositories
Abstract database access, implement queries.
Located in: `app/Repositories`

### Models
Eloquent models representing database tables.
Located in: `app/Models`

## Key Components

### Payment Processing
Handled by `PaymentService` which supports:
- Stripe integration
- PayPal integration
- Retry logic (3 attempts)
- Webhook handling

### Notification System
Uses Laravel Notifications with channels:
- Email (via queue)
- SMS (via Twilio)
- Push notifications (via FCM)

### Caching Strategy
- User data: 1 hour
- Product catalog: 24 hours
- Configuration: Until deployment
```

---

## Database Schema

**Документирование миграций:**

```php
/**
 * Create users table
 *
 * Stores user account information including authentication credentials
 * and profile data. Related tables: orders, posts, comments.
 */
class CreateUsersTable extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();  // Used for login
            $table->timestamp('email_verified_at')->nullable();  // Email confirmation
            $table->string('password');  // Hashed with bcrypt
            $table->enum('role', ['user', 'admin'])->default('user');  // Access control
            $table->rememberToken();  // "Remember me" functionality
            $table->timestamps();
            $table->softDeletes();  // Soft delete support

            // Indexes
            $table->index('email');  // Speed up login queries
            $table->index(['role', 'created_at']);  // Admin filters
        });
    }
}
```

---

## ADR (Architecture Decision Records)

**Формат:**

```markdown
# ADR-001: Use Redis for Session Storage

## Status
Accepted

## Context
We need to scale horizontally with multiple app servers.
File-based sessions don't work across servers.

## Decision
Use Redis for session storage.

## Consequences

### Positive
- Sessions shared across all servers
- Fast read/write performance
- Supports session persistence

### Negative
- Additional dependency (Redis server)
- Slightly more complex setup
- Need to monitor Redis availability

## Alternatives Considered

1. **Database sessions**
   - Pros: Already have DB
   - Cons: Slower than Redis

2. **Sticky sessions**
   - Pros: No changes needed
   - Cons: Uneven load distribution

## Implementation
```php
// config/session.php
'driver' => 'redis',
'connection' => 'session',
```

## Date
2024-01-15
```

---

## Changelog

**Формат:**

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2024-01-15

### Added
- Two-factor authentication for users
- Export orders to CSV
- Dark mode theme

### Changed
- Updated payment processing to use Stripe v2 API
- Improved dashboard loading performance (5x faster)

### Fixed
- Memory leak in queue worker
- XSS vulnerability in comment system

### Security
- Updated dependencies with security patches

## [1.1.0] - 2023-12-20

### Added
- Email notifications for order status changes

### Fixed
- Bug in password reset flow
```

---

## Практические советы

**Для чего НЕ нужны комментарии:**

```php
// ❌ Повторение кода
// Get all users
$users = User::all();

// ❌ Закомментированный код
// $oldImplementation = doSomething();
$newImplementation = doSomethingBetter();

// ❌ Очевидное
// Loop through users
foreach ($users as $user) {
    // ...
}
```

**Где комментарии нужны:**

```php
// ✅ Неочевидная логика
// VAT calculation: 20% for EU, 0% for outside EU
$vat = $country->isEU() ? 0.20 : 0.00;

// ✅ TODO/FIXME
// TODO: Refactor this to use Strategy pattern
// FIXME: Memory leak when processing large files

// ✅ Workarounds
// Hack: Safari doesn't support this CSS property
// Using polyfill instead

// ✅ Сложные регулярки
// Match email: user@domain.com, user+tag@domain.co.uk
$pattern = '/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i';
```

---

## Инструменты

**Генерация документации:**

```bash
# PHPDoc
composer require --dev phpdocumentor/phpdocumentor
vendor/bin/phpdoc -d src -t docs

# API docs (Swagger)
composer require darkaonline/l5-swagger
php artisan l5-swagger:generate

# Database schema
composer require --dev beyondcode/laravel-er-diagram-generator
php artisan generate:erd
```

---

## На собеседовании скажешь

> "Документация: code comments для "почему", не "что". PHPDoc для классов/методов с @param, @return, @throws. API documentation через OpenAPI/Swagger или Laravel API Resources. README с установкой, конфигурацией, примерами. Architecture documentation описывает слои и компоненты. ADR для архитектурных решений. Changelog для версий. Инструменты: phpdocumentor, l5-swagger. Само-документирующийся код лучше комментариев."

