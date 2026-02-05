# 8.6 Шифрование

## Краткое резюме

> **Шифрование** — преобразование данных в нечитаемый вид для защиты конфиденциальности.
>
> **Типы:** Симметричное (AES-256-CBC через Crypt::encrypt()), Хеширование (bcrypt через Hash::make()), Signing (URL::signedRoute()).
>
> **Важно:** APP_KEY — ключ шифрования (php artisan key:generate). Шифрование для обратимых данных (кредитные карты), хеширование для необратимых (пароли).

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
Шифрование — преобразование данных в нечитаемый вид. Laravel использует AES-256-CBC для симметричного шифрования.

**Типы:**
- **Симметричное** — один ключ (AES)
- **Асимметричное** — пара ключей (RSA)
- **Хеширование** — одностороннее (bcrypt, argon2)

---

## Как работает

**Симметричное шифрование (Laravel Crypt):**

```php
use Illuminate\Support\Facades\Crypt;

// Шифрование
$encrypted = Crypt::encryptString('secret data');

// Расшифровка
$decrypted = Crypt::decryptString($encrypted);

// Шифрование массива/объекта
$encrypted = Crypt::encrypt(['card' => '1234-5678-9012-3456']);
$decrypted = Crypt::decrypt($encrypted);
```

**Автоматическое шифрование в модели:**

```php
// Model
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Model
{
    protected function creditCard(): Attribute
    {
        return Attribute::make(
            get: fn($value) => Crypt::decryptString($value),
            set: fn($value) => Crypt::encryptString($value),
        );
    }
}

// Использование
$user->credit_card = '1234-5678-9012-3456';  // Автоматически шифруется
$user->save();

$card = $user->credit_card;  // Автоматически расшифровывается
```

**Хеширование (одностороннее):**

```php
use Illuminate\Support\Facades\Hash;

// Хеш пароля
$hashed = Hash::make('password');

// Проверка
if (Hash::check('password', $hashed)) {
    // Верный пароль
}

// Проверка необходимости rehash (алгоритм изменился)
if (Hash::needsRehash($hashed)) {
    $hashed = Hash::make('password');
}
```

---

## Когда использовать

**Шифрование для:**
- Кредитные карты
- Персональные данные (паспорт, адрес)
- API ключи
- Нужна расшифровка

**Хеширование для:**
- Пароли
- Токены
- Не нужна расшифровка

---

## Пример из практики

**Шифрование чувствительных данных:**

```php
// Migration
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('email');
    $table->text('encrypted_ssn')->nullable();  // Social Security Number
    $table->text('encrypted_credit_card')->nullable();
    $table->timestamps();
});

// Model
class User extends Model
{
    protected function ssn(): Attribute
    {
        return Attribute::make(
            get: fn($value) => $value ? Crypt::decryptString($value) : null,
            set: fn($value) => $value ? Crypt::encryptString($value) : null,
        );
    }

    protected function creditCard(): Attribute
    {
        return Attribute::make(
            get: fn($value) => $value ? Crypt::decryptString($value) : null,
            set: fn($value) => $value ? Crypt::encryptString($value) : null,
        );
    }
}

// Использование
$user = User::create([
    'email' => 'john@example.com',
    'ssn' => '123-45-6789',  // Зашифровано в БД
    'credit_card' => '1234-5678-9012-3456',  // Зашифровано в БД
]);

echo $user->ssn;  // 123-45-6789 (расшифровано)
```

**APP_KEY (ключ шифрования):**

```bash
# Генерация ключа
php artisan key:generate

# .env
APP_KEY=base64:...

# ВАЖНО: Не коммитить в git, хранить в безопасности
# При потере ключа данные не расшифровать
```

**Encryption для config:**

```php
// Шифрование в config
'api_key' => env('API_KEY'),

// .env (НЕ шифрованный)
API_KEY=secret-key-here

// Использование
$apiKey = config('services.api_key');

// Альтернатива: Laravel Secrets
php artisan env:encrypt
// Создаёт .env.encrypted

php artisan env:decrypt
```

**Signing (подпись данных):**

```php
use Illuminate\Support\Facades\URL;

// Создать подписанный URL
$url = URL::temporarySignedRoute(
    'unsubscribe',
    now()->addMinutes(30),
    ['user' => $user->id]
);

// Проверка подписи (middleware)
Route::get('/unsubscribe/{user}', [UnsubscribeController::class, 'handle'])
    ->name('unsubscribe')
    ->middleware('signed');

// Вручную проверить
if ($request->hasValidSignature()) {
    // Подпись валидна
}
```

**Hashing для токенов:**

```php
// Создать токен
$token = Str::random(60);
$hashedToken = hash('sha256', $token);

// Сохранить в БД
PasswordReset::create([
    'email' => $user->email,
    'token' => $hashedToken,
    'created_at' => now(),
]);

// Отправить plain token пользователю
Mail::to($user)->send(new ResetPassword($token));

// Проверка
$hashedToken = hash('sha256', $request->input('token'));
$reset = PasswordReset::where('token', $hashedToken)->first();
```

**Database Encryption (на уровне БД):**

```sql
-- MySQL (AES_ENCRYPT/AES_DECRYPT)
INSERT INTO users (email, encrypted_data)
VALUES ('john@example.com', AES_ENCRYPT('secret', 'key'));

SELECT AES_DECRYPT(encrypted_data, 'key') FROM users;

-- PostgreSQL (pgcrypto)
CREATE EXTENSION pgcrypto;

INSERT INTO users (email, encrypted_data)
VALUES ('john@example.com', pgp_sym_encrypt('secret', 'key'));

SELECT pgp_sym_decrypt(encrypted_data, 'key') FROM users;
```

**Searchable Encryption (для поиска):**

```php
// Hash для поиска
class User extends Model
{
    protected function email(): Attribute
    {
        return Attribute::make(
            set: function ($value) {
                $this->attributes['email_hash'] = hash('sha256', strtolower($value));
                return Crypt::encryptString($value);
            }
        );
    }
}

// Migration
Schema::create('users', function (Blueprint $table) {
    $table->text('email');  // Зашифрован
    $table->string('email_hash')->index();  // Для поиска
});

// Поиск
$user = User::where('email_hash', hash('sha256', strtolower($searchEmail)))->first();
```

**Ротация ключей:**

```php
// При смене APP_KEY нужно перешифровать данные
php artisan tinker

// Старый ключ
$oldKey = config('app.previous_key');
config(['app.key' => $oldKey]);

// Расшифровать
$decrypted = Crypt::decryptString($user->credit_card);

// Новый ключ
$newKey = config('app.key');
config(['app.key' => $newKey]);

// Зашифровать заново
$user->credit_card = $decrypted;
$user->save();
```

**Secure Random (для токенов):**

```php
use Illuminate\Support\Str;

// Случайная строка (криптографически стойкая)
$token = Str::random(40);

// UUID
$uuid = Str::uuid();

// Ordered UUID (для primary keys)
$uuid = Str::orderedUuid();
```

---

## На собеседовании скажешь

> "Шифрование преобразует данные в нечитаемый вид. Laravel использует AES-256-CBC (Crypt::encryptString()). APP_KEY — ключ шифрования (php artisan key:generate). Автоматическое шифрование через Attribute в модели. Hash::make() для паролей (bcrypt, необратимо). Signing для URL (URL::temporarySignedRoute()). Шифрование для кредиток, персональных данных. Хеширование для паролей, токенов. Database encryption на уровне БД (AES_ENCRYPT). Searchable encryption через hash для поиска."

---

## Практические задания

### Задание 1: Реализуй автоматическое шифрование для модели

Создай модель `PaymentMethod` с автоматическим шифрованием номера карты.

<details>
<summary>Решение</summary>

```php
// 1. Migration
Schema::create('payment_methods', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->text('card_number'); // Зашифрованный номер карты
    $table->string('card_holder');
    $table->string('card_last_four'); // Для отображения (****1234)
    $table->string('card_type'); // visa, mastercard
    $table->string('expiry_month');
    $table->string('expiry_year');
    $table->timestamps();
});

// 2. PaymentMethod Model
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Crypt;

class PaymentMethod extends Model
{
    protected $fillable = [
        'user_id',
        'card_number',
        'card_holder',
        'card_last_four',
        'card_type',
        'expiry_month',
        'expiry_year',
    ];

    /**
     * Автоматическое шифрование/расшифровка номера карты
     */
    protected function cardNumber(): Attribute
    {
        return Attribute::make(
            get: fn($value) => $value ? Crypt::decryptString($value) : null,
            set: function ($value) {
                // Сохранить последние 4 цифры
                $this->attributes['card_last_four'] = substr($value, -4);

                // Определить тип карты
                $this->attributes['card_type'] = $this->detectCardType($value);

                return Crypt::encryptString($value);
            }
        );
    }

    /**
     * Определить тип карты по номеру
     */
    private function detectCardType(string $number): string
    {
        $patterns = [
            'visa' => '/^4/',
            'mastercard' => '/^5[1-5]/',
            'amex' => '/^3[47]/',
        ];

        foreach ($patterns as $type => $pattern) {
            if (preg_match($pattern, $number)) {
                return $type;
            }
        }

        return 'unknown';
    }

    /**
     * Замаскированный номер карты
     */
    public function getMaskedCardNumberAttribute(): string
    {
        return '**** **** **** ' . $this->card_last_four;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

// 3. Controller
class PaymentMethodController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'card_number' => 'required|string|size:16|regex:/^[0-9]+$/',
            'card_holder' => 'required|string|max:255',
            'expiry_month' => 'required|digits:2|min:1|max:12',
            'expiry_year' => 'required|digits:4|min:' . date('Y'),
        ]);

        $paymentMethod = $request->user()->paymentMethods()->create([
            'card_number' => $validated['card_number'], // Автоматически шифруется
            'card_holder' => $validated['card_holder'],
            'expiry_month' => $validated['expiry_month'],
            'expiry_year' => $validated['expiry_year'],
        ]);

        return response()->json([
            'id' => $paymentMethod->id,
            'masked_number' => $paymentMethod->masked_card_number,
            'card_type' => $paymentMethod->card_type,
        ]);
    }

    public function show(PaymentMethod $paymentMethod)
    {
        $this->authorize('view', $paymentMethod);

        return response()->json([
            'id' => $paymentMethod->id,
            'card_holder' => $paymentMethod->card_holder,
            'masked_number' => $paymentMethod->masked_card_number,
            'card_type' => $paymentMethod->card_type,
            'expiry_month' => $paymentMethod->expiry_month,
            'expiry_year' => $paymentMethod->expiry_year,
            // Полный номер НЕ отправляем в API
        ]);
    }
}

// 4. Policy
class PaymentMethodPolicy
{
    public function view(User $user, PaymentMethod $paymentMethod): bool
    {
        return $user->id === $paymentMethod->user_id;
    }

    public function delete(User $user, PaymentMethod $paymentMethod): bool
    {
        return $user->id === $paymentMethod->user_id;
    }
}
```
</details>

### Задание 2: Создай signed URL для скачивания файла

Реализуй безопасное скачивание файла через временный подписанный URL.

<details>
<summary>Решение</summary>

```php
// 1. FileController
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class FileController extends Controller
{
    /**
     * Создать подписанный URL для скачивания
     */
    public function createDownloadLink(File $file)
    {
        $this->authorize('download', $file);

        // Временный подписанный URL (действителен 30 минут)
        $url = URL::temporarySignedRoute(
            'files.download',
            now()->addMinutes(30),
            ['file' => $file->id]
        );

        return response()->json([
            'download_url' => $url,
            'expires_at' => now()->addMinutes(30)->toIso8601String(),
        ]);
    }

    /**
     * Скачать файл по подписанному URL
     */
    public function download(Request $request, File $file)
    {
        // Проверка подписи (автоматически через middleware)
        if (!$request->hasValidSignature()) {
            abort(403, 'Недействительная или истёкшая ссылка');
        }

        // Проверить, что файл существует
        if (!Storage::disk('private')->exists($file->path)) {
            abort(404, 'Файл не найден');
        }

        // Логирование скачивания
        activity()
            ->causedBy($request->user())
            ->performedOn($file)
            ->log('downloaded');

        // Отдать файл
        return Storage::disk('private')->download(
            $file->path,
            $file->original_name
        );
    }
}

// 2. Routes
Route::middleware('auth')->group(function () {
    Route::post('/files/{file}/download-link', [FileController::class, 'createDownloadLink'])
        ->name('files.download-link');
});

Route::get('/files/{file}/download', [FileController::class, 'download'])
    ->name('files.download')
    ->middleware('signed'); // Проверка подписи

// 3. File Model
class File extends Model
{
    protected $fillable = [
        'user_id',
        'path',
        'original_name',
        'size',
        'mime_type',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

// 4. FilePolicy
class FilePolicy
{
    public function download(User $user, File $file): bool
    {
        // Владелец или файл публичный
        return $user->id === $file->user_id || $file->is_public;
    }
}

// 5. Альтернатива: постоянный подписанный URL
public function createPermanentLink(File $file)
{
    $this->authorize('download', $file);

    $url = URL::signedRoute('files.download', ['file' => $file->id]);

    return response()->json(['download_url' => $url]);
}

// 6. Вручную создать подпись
use Illuminate\Support\Facades\Hash;

public function createCustomSignedUrl(File $file): string
{
    $signature = Hash::make($file->id . config('app.key'));

    return route('files.download', [
        'file' => $file->id,
        'signature' => $signature,
    ]);
}

public function downloadWithCustomSignature(Request $request, File $file)
{
    $signature = $request->query('signature');

    if (!Hash::check($file->id . config('app.key'), $signature)) {
        abort(403, 'Недействительная подпись');
    }

    return Storage::disk('private')->download($file->path);
}
```
</details>

### Задание 3: Реализуй searchable encryption

Создай систему хранения email с возможностью поиска при шифровании.

<details>
<summary>Решение</summary>

```php
// 1. Migration
Schema::create('user_emails', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->text('email'); // Зашифрованный email
    $table->string('email_hash')->index(); // Хеш для поиска
    $table->boolean('is_primary')->default(false);
    $table->timestamp('verified_at')->nullable();
    $table->timestamps();

    $table->unique('email_hash');
});

// 2. UserEmail Model
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Crypt;

class UserEmail extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'is_primary',
        'verified_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'verified_at' => 'datetime',
    ];

    /**
     * Шифрование email + создание хеша для поиска
     */
    protected function email(): Attribute
    {
        return Attribute::make(
            get: fn($value) => $value ? Crypt::decryptString($value) : null,
            set: function ($value) {
                $normalized = strtolower(trim($value));

                // Создать хеш для поиска
                $this->attributes['email_hash'] = hash('sha256', $normalized);

                return Crypt::encryptString($value);
            }
        );
    }

    /**
     * Найти по email (используя хеш)
     */
    public static function findByEmail(string $email): ?self
    {
        $hash = hash('sha256', strtolower(trim($email)));

        return static::where('email_hash', $hash)->first();
    }

    /**
     * Scope для поиска по хешу
     */
    public function scopeWhereEmail($query, string $email)
    {
        $hash = hash('sha256', strtolower(trim($email)));

        return $query->where('email_hash', $hash);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

// 3. Controller
class UserEmailController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
        ]);

        // Проверить, что email не используется
        if (UserEmail::findByEmail($validated['email'])) {
            return back()->withErrors([
                'email' => 'Этот email уже используется',
            ]);
        }

        $userEmail = $request->user()->emails()->create([
            'email' => $validated['email'], // Автоматически шифруется
        ]);

        // Отправить verification email
        $userEmail->sendVerificationNotification();

        return redirect()->back()->with('success', 'Email добавлен');
    }

    public function search(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        // Поиск по зашифрованному email (через хеш)
        $userEmail = UserEmail::whereEmail($validated['email'])->first();

        if (!$userEmail) {
            return response()->json(['message' => 'Email не найден'], 404);
        }

        return response()->json([
            'id' => $userEmail->id,
            'user_id' => $userEmail->user_id,
            'is_verified' => $userEmail->verified_at !== null,
        ]);
    }
}

// 4. Trait для переиспользования
trait HasSearchableEncryption
{
    /**
     * Создать хеш для searchable поля
     */
    protected static function makeSearchableHash(string $value): string
    {
        return hash('sha256', strtolower(trim($value)));
    }

    /**
     * Найти по зашифрованному полю
     */
    public static function findByEncryptedField(string $field, string $value): ?self
    {
        $hash = static::makeSearchableHash($value);
        $hashField = $field . '_hash';

        return static::where($hashField, $hash)->first();
    }
}

// Использование
class UserEmail extends Model
{
    use HasSearchableEncryption;

    // ...
}

$userEmail = UserEmail::findByEncryptedField('email', 'john@example.com');
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
