# 10.9 Factory Pattern

## Краткое резюме

> **Factory Pattern** — паттерн для создания объектов с инкапсуляцией логики создания.
>
> **Типы:** Simple Factory (static метод), Factory Method (наследование), Abstract Factory (семейство объектов).
>
> **Важно:** Используется для сложной инициализации, разных типов объектов по условию. Laravel: Model Factories для тестов.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Factory Pattern — паттерн для создания объектов. Инкапсулирует логику создания.

**Типы:**
- Simple Factory (статический метод)
- Factory Method (через наследование)
- Abstract Factory (семейство объектов)

---

## Как работает

**Simple Factory:**

```php
// app/Factories/PaymentFactory.php
class PaymentFactory
{
    public static function create(string $type): PaymentGateway
    {
        return match ($type) {
            'stripe' => new StripePayment(
                apiKey: config('services.stripe.key')
            ),
            'paypal' => new PayPalPayment(
                clientId: config('services.paypal.client_id'),
                secret: config('services.paypal.secret')
            ),
            'cash' => new CashPayment(),
            default => throw new InvalidArgumentException("Unknown payment type: {$type}")
        };
    }
}

// Использование
$payment = PaymentFactory::create('stripe');
$payment->charge(100);
```

**Factory Method:**

```php
// Базовый класс
abstract class NotificationService
{
    abstract protected function createNotifier(): Notifier;

    public function send(string $message): void
    {
        $notifier = $this->createNotifier();
        $notifier->send($message);
    }
}

// Реализации
class EmailNotificationService extends NotificationService
{
    protected function createNotifier(): Notifier
    {
        return new EmailNotifier(config('mail.from'));
    }
}

class SmsNotificationService extends NotificationService
{
    protected function createNotifier(): Notifier
    {
        return new SmsNotifier(config('sms.api_key'));
    }
}

// Использование
$service = new EmailNotificationService();
$service->send('Hello!');
```

**Abstract Factory:**

```php
// Интерфейс фабрики
interface UIFactory
{
    public function createButton(): Button;
    public function createCheckbox(): Checkbox;
}

// Конкретные фабрики
class WebUIFactory implements UIFactory
{
    public function createButton(): Button
    {
        return new HtmlButton();
    }

    public function createCheckbox(): Checkbox
    {
        return new HtmlCheckbox();
    }
}

class MobileUIFactory implements UIFactory
{
    public function createButton(): Button
    {
        return new MobileButton();
    }

    public function createCheckbox(): Checkbox
    {
        return new MobileCheckbox();
    }
}

// Client
class Application
{
    private Button $button;
    private Checkbox $checkbox;

    public function __construct(UIFactory $factory)
    {
        $this->button = $factory->createButton();
        $this->checkbox = $factory->createCheckbox();
    }
}
```

---

## Когда использовать

**Factory для:**
- Сложная логика создания объектов
- Разные типы объектов по условию
- Изоляция логики создания

**НЕ для:**
- Простое `new Class()`

---

## Пример из практики

**Factory для Eloquent моделей:**

```php
// app/Factories/UserFactory.php
class UserFactory
{
    public static function createAdmin(array $data): User
    {
        return User::create([
            'role' => 'admin',
            'permissions' => ['*'],
            'password' => Hash::make($data['password']),
            ...$data,
        ]);
    }

    public static function createRegularUser(array $data): User
    {
        return User::create([
            'role' => 'user',
            'permissions' => ['read'],
            'password' => Hash::make($data['password']),
            'email_verified_at' => null,  // Требует верификации
            ...$data,
        ]);
    }

    public static function createFromSocialProvider(
        string $provider,
        array $providerData
    ): User {
        return User::create([
            'name' => $providerData['name'],
            'email' => $providerData['email'],
            'password' => Hash::make(Str::random(32)),
            'email_verified_at' => now(),  // Сразу подтверждён
            "{$provider}_id" => $providerData['id'],
        ]);
    }
}

// Использование
$user = UserFactory::createAdmin([
    'name' => 'Admin',
    'email' => 'admin@example.com',
    'password' => 'secret',
]);
```

**Factory для API Responses:**

```php
// app/Factories/ResponseFactory.php
class ResponseFactory
{
    public static function success(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
        ], $status);
    }

    public static function error(
        string $message,
        int $status = 400,
        ?array $errors = null
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status);
    }

    public static function paginated(LengthAwarePaginator $paginator): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}

// Controller
class UserController extends Controller
{
    public function index()
    {
        $users = User::paginate(20);

        return ResponseFactory::paginated($users);
    }

    public function store(Request $request)
    {
        try {
            $user = User::create($request->validated());

            return ResponseFactory::success($user, 201);
        } catch (\Exception $e) {
            return ResponseFactory::error('Failed to create user', 500);
        }
    }
}
```

**Factory с Builder:**

```php
// app/Factories/QueryFactory.php
class QueryFactory
{
    public static function createUserQuery(): Builder
    {
        return User::query()
            ->where('active', true)
            ->whereNotNull('email_verified_at');
    }

    public static function createAdminQuery(): Builder
    {
        return self::createUserQuery()
            ->where('role', 'admin');
    }

    public static function createRecentUsersQuery(int $days = 7): Builder
    {
        return self::createUserQuery()
            ->where('created_at', '>=', now()->subDays($days));
    }
}

// Использование
$admins = QueryFactory::createAdminQuery()->get();
$recentUsers = QueryFactory::createRecentUsersQuery(30)->count();
```

**Laravel Model Factories (для тестов):**

```php
// database/factories/UserFactory.php
use Illuminate\Database\Eloquent\Factories\Factory;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'admin',
        ]);
    }
}

// tests/Feature/UserTest.php
$user = User::factory()->admin()->create();
$users = User::factory()->count(10)->unverified()->create();
```

---

## На собеседовании скажешь

> "Factory инкапсулирует создание объектов. Simple Factory — статический метод с match/switch. Factory Method — через наследование, подклассы решают какой объект создать. Abstract Factory для семейства объектов. Laravel: Model Factories для тестов, можно создавать кастомные фабрики для API responses, queries, users с разными ролями. Плюсы: изоляция логики создания, гибкость, DRY. Используется для сложной инициализации объектов."

---

## Практические задания

### Задание 1: Создай Simple Factory для уведомлений

Реализуй `NotificationFactory` который создаёт разные типы уведомлений по условию.

<details>
<parameter name="summary">Решение</summary>

```php
// app/Factories/NotificationFactory.php
namespace App\Factories;

use App\Notifications\EmailNotification;
use App\Notifications\SmsNotification;
use App\Notifications\PushNotification;
use App\Notifications\SlackNotification;

class NotificationFactory
{
    public static function create(
        string $type,
        string $message,
        array $options = []
    ): NotificationInterface {
        return match ($type) {
            'email' => new EmailNotification(
                message: $message,
                subject: $options['subject'] ?? 'Notification',
                from: $options['from'] ?? config('mail.from.address')
            ),
            'sms' => new SmsNotification(
                message: $message,
                phone: $options['phone'] ?? throw new \InvalidArgumentException('Phone required')
            ),
            'push' => new PushNotification(
                message: $message,
                title: $options['title'] ?? 'Notification',
                deviceToken: $options['device_token'] ?? null
            ),
            'slack' => new SlackNotification(
                message: $message,
                channel: $options['channel'] ?? '#general',
                webhookUrl: config('services.slack.webhook_url')
            ),
            default => throw new \InvalidArgumentException("Unknown notification type: {$type}")
        };
    }

    public static function createMultiple(array $types, string $message): array
    {
        return array_map(
            fn($type) => self::create($type, $message),
            $types
        );
    }

    public static function createForUser(User $user, string $message): array
    {
        $notifications = [];

        if ($user->email) {
            $notifications[] = self::create('email', $message);
        }

        if ($user->phone) {
            $notifications[] = self::create('sms', $message, [
                'phone' => $user->phone
            ]);
        }

        if ($user->push_enabled) {
            $notifications[] = self::create('push', $message, [
                'device_token' => $user->device_token
            ]);
        }

        return $notifications;
    }
}

// Использование
$notification = NotificationFactory::create('email', 'Hello!', [
    'subject' => 'Greeting',
    'from' => 'noreply@example.com'
]);

$notification->send();
```
</details>

### Задание 2: Реализуй Factory Method для отчётов

Создай базовый `ReportGenerator` и конкретные классы для PDF, Excel, CSV.

<details>
<parameter name="summary">Решение</summary>

```php
// Базовый интерфейс
interface ReportFormatterInterface
{
    public function format(array $data): string;
    public function getContentType(): string;
    public function getFileExtension(): string;
}

// Реализации
class PdfFormatter implements ReportFormatterInterface
{
    public function format(array $data): string
    {
        // Generate PDF
        return '...pdf content...';
    }

    public function getContentType(): string
    {
        return 'application/pdf';
    }

    public function getFileExtension(): string
    {
        return 'pdf';
    }
}

class ExcelFormatter implements ReportFormatterInterface
{
    public function format(array $data): string
    {
        // Generate Excel
        return '...excel content...';
    }

    public function getContentType(): string
    {
        return 'application/vnd.ms-excel';
    }

    public function getFileExtension(): string
    {
        return 'xlsx';
    }
}

class CsvFormatter implements ReportFormatterInterface
{
    public function format(array $data): string
    {
        $csv = fopen('php://temp', 'r+');
        foreach ($data as $row) {
            fputcsv($csv, $row);
        }
        rewind($csv);
        $content = stream_get_contents($csv);
        fclose($csv);
        return $content;
    }

    public function getContentType(): string
    {
        return 'text/csv';
    }

    public function getFileExtension(): string
    {
        return 'csv';
    }
}

// Factory Method базовый класс
abstract class ReportGenerator
{
    abstract protected function createFormatter(): ReportFormatterInterface;

    public function generate(array $data): string
    {
        $formatter = $this->createFormatter();
        return $formatter->format($data);
    }

    public function download(array $data, string $filename): Response
    {
        $formatter = $this->createFormatter();
        $content = $formatter->format($data);

        return response($content)
            ->header('Content-Type', $formatter->getContentType())
            ->header('Content-Disposition',
                "attachment; filename={$filename}.{$formatter->getFileExtension()}");
    }
}

// Конкретные генераторы
class PdfReportGenerator extends ReportGenerator
{
    protected function createFormatter(): ReportFormatterInterface
    {
        return new PdfFormatter();
    }
}

class ExcelReportGenerator extends ReportGenerator
{
    protected function createFormatter(): ReportFormatterInterface
    {
        return new ExcelFormatter();
    }
}

class CsvReportGenerator extends ReportGenerator
{
    protected function createFormatter(): ReportFormatterInterface
    {
        return new CsvFormatter();
    }
}

// Controller
class ReportController extends Controller
{
    public function download(Request $request)
    {
        $data = Order::with('user')->get()->toArray();
        $format = $request->query('format', 'pdf');

        $generator = match ($format) {
            'pdf' => new PdfReportGenerator(),
            'excel' => new ExcelReportGenerator(),
            'csv' => new CsvReportGenerator(),
            default => new PdfReportGenerator(),
        };

        return $generator->download($data, 'orders_report');
    }
}
```
</details>

### Задание 3: Используй Laravel Model Factory

Создай Model Factory для `Product` с разными состояниями (active, inactive, featured).

<details>
<parameter name="summary">Решение</summary>

```php
// database/factories/ProductFactory.php
namespace Database\Factories;

use App\Models\Product;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(3, true),
            'slug' => fake()->unique()->slug(),
            'description' => fake()->paragraph(),
            'price' => fake()->randomFloat(2, 10, 1000),
            'stock' => fake()->numberBetween(0, 100),
            'is_active' => true,
            'is_featured' => false,
            'category_id' => Category::factory(),
            'image_url' => fake()->imageUrl(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    // State: неактивный товар
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
            'stock' => 0,
        ]);
    }

    // State: рекомендуемый товар
    public function featured(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_featured' => true,
            'stock' => fake()->numberBetween(50, 200),
        ]);
    }

    // State: товар со скидкой
    public function onSale(): static
    {
        return $this->state(fn (array $attributes) => [
            'original_price' => $attributes['price'],
            'price' => $attributes['price'] * 0.8, // 20% скидка
            'is_on_sale' => true,
        ]);
    }

    // State: товар без изображения
    public function withoutImage(): static
    {
        return $this->state(fn (array $attributes) => [
            'image_url' => null,
        ]);
    }

    // State: товар с конкретной категорией
    public function inCategory(Category $category): static
    {
        return $this->state(fn (array $attributes) => [
            'category_id' => $category->id,
        ]);
    }

    // Последовательность для создания нескольких товаров
    public function configure(): static
    {
        return $this->afterCreating(function (Product $product) {
            // Добавить теги после создания
            $product->tags()->attach(
                fake()->randomElements([1, 2, 3, 4, 5], rand(2, 4))
            );
        });
    }
}

// database/seeders/ProductSeeder.php
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        // 50 активных товаров
        Product::factory()->count(50)->create();

        // 10 рекомендуемых товаров
        Product::factory()->featured()->count(10)->create();

        // 20 неактивных товаров
        Product::factory()->inactive()->count(20)->create();

        // 15 товаров со скидкой
        Product::factory()->onSale()->count(15)->create();

        // Товары в конкретной категории
        $electronics = Category::where('name', 'Electronics')->first();
        Product::factory()
            ->inCategory($electronics)
            ->count(30)
            ->create();
    }
}

// Использование в тестах
class ProductTest extends TestCase
{
    public function test_can_purchase_active_product(): void
    {
        $product = Product::factory()->create(['stock' => 10]);

        $this->assertTrue($product->isAvailable());
    }

    public function test_cannot_purchase_inactive_product(): void
    {
        $product = Product::factory()->inactive()->create();

        $this->assertFalse($product->isAvailable());
    }

    public function test_featured_products_have_high_stock(): void
    {
        $product = Product::factory()->featured()->create();

        $this->assertGreaterThanOrEqual(50, $product->stock);
    }
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
