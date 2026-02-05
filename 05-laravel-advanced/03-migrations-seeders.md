# 5.3 Migrations & Seeders

## Краткое резюме

> **Migrations** — версионный контроль для БД. `up()` создает, `down()` откатывает изменения.
>
> **Seeders** — наполнение БД тестовыми данными. **Factories** — генерация моделей для тестов и seeders.
>
> **Команды:** `migrate`, `migrate:rollback`, `migrate:fresh --seed`.

---

## Содержание

- [Что это](#что-это)
- [Создание миграций](#как-работает)
- [Типы колонок](#как-работает)
- [Foreign Keys](#как-работает)
- [Seeders](#seeders)
- [Factories](#factories)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Migrations — версионный контроль для БД (создание/изменение таблиц). Seeders — заполнение БД тестовыми данными.

**Основное:**
- Migrations — структура БД в коде
- Seeders — тестовые данные
- Factories — генерация моделей

---

## Как работает

**Создание миграции:**

```bash
# Создать таблицу
php artisan make:migration create_users_table

# Изменить таблицу
php artisan make:migration add_status_to_users_table

# С флагами
php artisan make:migration create_posts_table --create=posts
php artisan make:migration add_category_to_posts --table=posts
```

**Структура миграции:**

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();  // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();  // created_at, updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
```

**Типы колонок:**

```php
Schema::create('products', function (Blueprint $table) {
    // Numeric
    $table->id();  // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    $table->bigInteger('views');
    $table->integer('stock');
    $table->tinyInteger('status');
    $table->decimal('price', 8, 2);  // 8 знаков, 2 после запятой
    $table->float('rating', 8, 2);

    // String
    $table->string('name', 255);  // VARCHAR(255)
    $table->text('description');  // TEXT
    $table->longText('content');  // LONGTEXT

    // Date/Time
    $table->date('birth_date');  // DATE
    $table->dateTime('published_at');  // DATETIME
    $table->timestamp('verified_at');  // TIMESTAMP
    $table->timestamps();  // created_at, updated_at
    $table->softDeletes();  // deleted_at

    // Boolean
    $table->boolean('is_active')->default(true);

    // JSON
    $table->json('metadata');

    // Foreign Key
    $table->foreignId('user_id')->constrained()->onDelete('cascade');

    // Enum
    $table->enum('status', ['pending', 'approved', 'rejected']);
});
```

**Модификаторы колонок:**

```php
$table->string('email')->nullable();  // NULL
$table->string('role')->default('user');  // DEFAULT
$table->string('name')->unique();  // UNIQUE
$table->string('description')->comment('Product description');  // COMMENT
$table->integer('order')->unsigned();  // UNSIGNED
$table->timestamp('created_at')->useCurrent();  // DEFAULT CURRENT_TIMESTAMP
$table->timestamp('updated_at')->useCurrentOnUpdate();  // ON UPDATE CURRENT_TIMESTAMP
```

**Индексы:**

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('email')->unique();  // UNIQUE
    $table->index('email');  // INDEX
    $table->index(['user_id', 'created_at']);  // Composite index

    // Именованный индекс
    $table->index('email', 'idx_users_email');

    // Удалить индекс
    $table->dropIndex('idx_users_email');
    $table->dropUnique(['email']);
});
```

**Foreign Keys:**

```php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->string('title');
    $table->timestamps();
});

// Эквивалентно:
$table->unsignedBigInteger('user_id');
$table->foreign('user_id')
    ->references('id')
    ->on('users')
    ->onDelete('cascade')
    ->onUpdate('cascade');

// Удалить FK
$table->dropForeign(['user_id']);
$table->dropForeign('posts_user_id_foreign');  // По имени
```

**Изменение таблицы:**

```php
Schema::table('users', function (Blueprint $table) {
    // Добавить колонку
    $table->string('phone')->nullable()->after('email');

    // Изменить колонку (требует doctrine/dbal)
    $table->string('name', 100)->change();

    // Переименовать колонку
    $table->renameColumn('name', 'full_name');

    // Удалить колонку
    $table->dropColumn('phone');
    $table->dropColumn(['phone', 'address']);
});

// Переименовать таблицу
Schema::rename('posts', 'articles');

// Удалить таблицу
Schema::drop('users');
Schema::dropIfExists('users');
```

**Выполнение миграций:**

```bash
# Выполнить все миграции
php artisan migrate

# Откатить последний batch
php artisan migrate:rollback

# Откатить все миграции
php artisan migrate:reset

# Откатить и заново выполнить
php artisan migrate:refresh

# Откатить, выполнить и засеять
php artisan migrate:refresh --seed

# Удалить все таблицы и заново создать
php artisan migrate:fresh

# Статус миграций
php artisan migrate:status
```

---

## Seeders

**Создание Seeder:**

```bash
php artisan make:seeder UserSeeder
```

**Структура Seeder:**

```php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Создать одного пользователя
        User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
        ]);

        // Создать несколько
        User::insert([
            [
                'name' => 'John',
                'email' => 'john@example.com',
                'password' => Hash::make('password'),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Jane',
                'email' => 'jane@example.com',
                'password' => Hash::make('password'),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
```

**DatabaseSeeder:**

```php
namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Вызвать другие seeders
        $this->call([
            UserSeeder::class,
            PostSeeder::class,
            CategorySeeder::class,
        ]);
    }
}
```

**Запуск Seeders:**

```bash
# Запустить все seeders
php artisan db:seed

# Запустить конкретный seeder
php artisan db:seed --class=UserSeeder

# Миграции + seeders
php artisan migrate:fresh --seed
```

---

## Factories

**Создание Factory:**

```bash
php artisan make:factory UserFactory
```

**Структура Factory:**

```php
namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    // State (модификация)
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'admin',
        ]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
```

**Использование Factories:**

```php
// Создать одного пользователя
$user = User::factory()->create();

// Создать несколько
$users = User::factory()->count(10)->create();

// С кастомными атрибутами
$user = User::factory()->create([
    'name' => 'John Doe',
    'email' => 'john@example.com',
]);

// Использовать state
$admin = User::factory()->admin()->create();
$unverified = User::factory()->unverified()->create();

// Создать с relationships
$user = User::factory()
    ->has(Post::factory()->count(3))
    ->create();

// Эквивалентно:
$user = User::factory()
    ->hasPosts(3)
    ->create();
```

---

## Когда использовать

**Migrations:**
- Любые изменения структуры БД
- Контроль версий БД
- CI/CD (автоматическое развёртывание)

**Seeders:**
- Тестовые данные для разработки
- Начальные данные (роли, настройки)
- Demo данные

**Factories:**
- Unit/Feature тесты
- Генерация тестовых данных
- Быстрое наполнение БД

---

## Пример из практики

**E-commerce миграции:**

```php
// database/migrations/xxxx_create_products_table.php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('slug')->unique();
    $table->text('description')->nullable();
    $table->decimal('price', 10, 2);
    $table->integer('stock')->default(0);
    $table->foreignId('category_id')->constrained()->onDelete('cascade');
    $table->boolean('is_active')->default(true);
    $table->timestamps();
    $table->softDeletes();

    $table->index(['category_id', 'is_active']);
    $table->index('slug');
});

// database/migrations/xxxx_create_orders_table.php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->enum('status', ['pending', 'paid', 'shipped', 'delivered', 'cancelled']);
    $table->decimal('total', 10, 2);
    $table->timestamps();

    $table->index(['user_id', 'status']);
    $table->index('created_at');
});

// database/migrations/xxxx_create_order_items_table.php
Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->onDelete('cascade');
    $table->foreignId('product_id')->constrained()->onDelete('cascade');
    $table->integer('quantity');
    $table->decimal('price', 10, 2);
    $table->timestamps();
});
```

**Seeders с Factories:**

```php
// database/seeders/DatabaseSeeder.php
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Создать категории
        $categories = Category::factory()->count(5)->create();

        // Создать продукты для каждой категории
        $categories->each(function ($category) {
            Product::factory()
                ->count(10)
                ->for($category)
                ->create();
        });

        // Создать пользователей с заказами
        User::factory()
            ->count(20)
            ->has(
                Order::factory()
                    ->count(3)
                    ->has(OrderItem::factory()->count(2), 'items')
            )
            ->create();

        // Админ пользователь
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
        ]);
    }
}
```

**Factory с relationships:**

```php
// database/factories/OrderFactory.php
class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => fake()->randomElement(['pending', 'paid', 'shipped']),
            'total' => fake()->randomFloat(2, 10, 1000),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'paid',
            'paid_at' => now(),
        ]);
    }
}

// Использование
$order = Order::factory()->paid()->create();
```

---

## На собеседовании скажешь

> "Migrations — версионный контроль БД, up() создаёт, down() откатывает. Schema::create() для новых таблиц, Schema::table() для изменений. Foreign keys через foreignId()->constrained()->onDelete('cascade'). Seeders наполняют БД (DatabaseSeeder, db:seed). Factories генерируют модели (User::factory()->create()), используются в тестах и seeders. migrate:fresh --seed пересоздаёт БД с данными. Factories с states для вариаций (admin(), unverified())."

---

## Практические задания

### Задание 1: Создай миграцию с индексами

Создай миграцию для таблицы `posts` с полями: title, slug (уникальный), content, status (enum), published_at. Добавь правильные индексы.

<details>
<summary>Решение</summary>

```php
// database/migrations/xxxx_create_posts_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('content');
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Индексы для частых запросов
            $table->index(['status', 'published_at']);  // Список опубликованных
            $table->index(['user_id', 'status']);       // Посты пользователя
            $table->index('created_at');                // Сортировка по дате
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
```
</details>

### Задание 2: Напиши Seeder с Factory

Создай Seeder который создаст 5 категорий, для каждой категории 10 продуктов, и 50 пользователей.

<details>
<summary>Решение</summary>

```php
// database/factories/CategoryFactory.php
class CategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'slug' => fn(array $attributes) => Str::slug($attributes['name']),
            'description' => fake()->sentence(),
        ];
    }
}

// database/factories/ProductFactory.php
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->words(3, true),
            'slug' => fn(array $attributes) => Str::slug($attributes['name']),
            'description' => fake()->paragraph(),
            'price' => fake()->randomFloat(2, 10, 1000),
            'stock' => fake()->numberBetween(0, 100),
            'is_active' => fake()->boolean(80),  // 80% активных
        ];
    }

    public function outOfStock(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock' => 0,
            'is_active' => false,
        ]);
    }
}

// database/seeders/ProductSeeder.php
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        // Создать 5 категорий
        $categories = Category::factory()->count(5)->create();

        // Для каждой категории создать 10 продуктов
        $categories->each(function ($category) {
            Product::factory()
                ->count(10)
                ->for($category)
                ->create();

            // Добавить 2 продукта без наличия
            Product::factory()
                ->count(2)
                ->outOfStock()
                ->for($category)
                ->create();
        });

        // Создать 50 пользователей
        User::factory()->count(50)->create();
    }
}

// database/seeders/DatabaseSeeder.php
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            ProductSeeder::class,
        ]);
    }
}
```
</details>

### Задание 3: Миграция изменения таблицы

Добавь в существующую таблицу `users` поля: `phone` (nullable), `avatar` (nullable), `is_verified` (boolean, default false). Также добавь индекс на phone.

<details>
<summary>Решение</summary>

```php
// database/migrations/xxxx_add_profile_fields_to_users_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->after('email');
            $table->string('avatar')->nullable()->after('phone');
            $table->boolean('is_verified')->default(false)->after('avatar');

            // Индекс для поиска по телефону
            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['phone']);
            $table->dropColumn(['phone', 'avatar', 'is_verified']);
        });
    }
};
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
