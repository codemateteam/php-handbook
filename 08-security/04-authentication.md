# 8.4 Аутентификация

## Краткое резюме

> **Аутентификация** — проверка личности пользователя (кто ты?).
>
> **Методы:** Session-based (cookies) для веб-приложений, Token-based (Bearer) для API, OAuth для внешних провайдеров.
>
> **Важно:** Rate limiting против brute force, Email verification для подтверждения, 2FA для дополнительной защиты, Hash::make() для безопасного хранения паролей.

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
Аутентификация — проверка личности пользователя (кто ты?). Laravel предоставляет встроенные механизмы: сессии, токены (Sanctum, Passport).

**Методы:**
- Session-based — cookie с session ID
- Token-based — Bearer токен (API)
- OAuth — через внешние провайдеры

---

## Как работает

**Session-based (веб):**

```php
// Логин
Route::post('/login', function (Request $request) {
    $credentials = $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    if (Auth::attempt($credentials)) {
        $request->session()->regenerate();  // Защита от session fixation

        return redirect()->intended('/dashboard');
    }

    return back()->withErrors([
        'email' => 'Invalid credentials',
    ]);
});

// Логаут
Route::post('/logout', function (Request $request) {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/');
});

// Проверка авторизации
Route::middleware('auth')->group(function () {
    Route::get('/profile', function () {
        $user = auth()->user();
        return view('profile', compact('user'));
    });
});
```

**Token-based (Sanctum для API):**

```php
// Логин и выдача токена
Route::post('/login', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        return response()->json(['message' => 'Invalid credentials'], 401);
    }

    $token = $user->createToken('api-token')->plainTextToken;

    return response()->json(['token' => $token]);
});

// Защищённый endpoint
Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Логаут (удалить токен)
Route::middleware('auth:sanctum')->post('/logout', function (Request $request) {
    $request->user()->currentAccessToken()->delete();

    return response()->json(['message' => 'Logged out']);
});
```

---

## Когда использовать

**Session-based для:**
- Веб-приложения
- Традиционные формы
- Server-side rendering

**Token-based для:**
- API
- Mobile приложения
- SPA (Single Page Apps)

---

## Пример из практики

**Multi-factor Authentication (2FA):**

```php
// Установить пакет
composer require pragmarx/google2fa-laravel

// Включить 2FA
class TwoFactorController extends Controller
{
    public function enable(Request $request)
    {
        $user = $request->user();

        $google2fa = app('pragmarx.google2fa');
        $user->google2fa_secret = $google2fa->generateSecretKey();
        $user->save();

        $qrCodeUrl = $google2fa->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $user->google2fa_secret
        );

        return view('2fa.enable', compact('qrCodeUrl'));
    }

    public function verify(Request $request)
    {
        $user = $request->user();

        $valid = app('pragmarx.google2fa')->verifyKey(
            $user->google2fa_secret,
            $request->input('code')
        );

        if ($valid) {
            $user->google2fa_enabled = true;
            $user->save();

            return redirect('/dashboard');
        }

        return back()->withErrors(['code' => 'Invalid code']);
    }
}

// Middleware для проверки 2FA
class Ensure2FA
{
    public function handle($request, Closure $next)
    {
        $user = $request->user();

        if ($user->google2fa_enabled && !session('2fa_verified')) {
            return redirect('/2fa/verify');
        }

        return $next($request);
    }
}
```

**Remember Me:**

```php
// Логин с Remember Me
if (Auth::attempt($credentials, $remember = true)) {
    // Cookie на 5 лет
}

// Проверка Remember token
if (Auth::viaRemember()) {
    // Пользователь залогинен через Remember Me
}
```

**Rate Limiting (защита от brute force):**

```php
use Illuminate\Support\Facades\RateLimiter;

Route::post('/login', function (Request $request) {
    $key = 'login:' . $request->ip();

    if (RateLimiter::tooManyAttempts($key, 5)) {
        $seconds = RateLimiter::availableIn($key);

        return back()->withErrors([
            'email' => "Too many attempts. Try again in {$seconds} seconds.",
        ]);
    }

    if (Auth::attempt($request->only('email', 'password'))) {
        RateLimiter::clear($key);  // Сбросить после успеха
        return redirect('/dashboard');
    }

    RateLimiter::hit($key, 60);  // +1 попытка, TTL 60 секунд

    return back()->withErrors(['email' => 'Invalid credentials']);
});
```

**Email Verification:**

```php
// User model
class User extends Authenticatable implements MustVerifyEmail
{
    use Notifiable;
}

// routes/web.php
Auth::routes(['verify' => true]);

// Защита маршрута
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// Отправить verification email заново
Route::post('/email/resend', function (Request $request) {
    $request->user()->sendEmailVerificationNotification();

    return back()->with('message', 'Verification link sent!');
});
```

**Password Reset:**

```php
use Illuminate\Support\Facades\Password;

// Отправить ссылку сброса
Route::post('/forgot-password', function (Request $request) {
    $request->validate(['email' => 'required|email']);

    $status = Password::sendResetLink(
        $request->only('email')
    );

    return $status === Password::RESET_LINK_SENT
        ? back()->with('status', __($status))
        : back()->withErrors(['email' => __($status)]);
});

// Сбросить пароль
Route::post('/reset-password', function (Request $request) {
    $request->validate([
        'token' => 'required',
        'email' => 'required|email',
        'password' => 'required|confirmed|min:8',
    ]);

    $status = Password::reset(
        $request->only('email', 'password', 'password_confirmation', 'token'),
        function ($user, $password) {
            $user->forceFill([
                'password' => Hash::make($password)
            ])->save();
        }
    );

    return $status === Password::PASSWORD_RESET
        ? redirect('/login')->with('status', __($status))
        : back()->withErrors(['email' => __($status)]);
});
```

**Social Authentication (Socialite):**

```bash
composer require laravel/socialite
```

```php
// config/services.php
'github' => [
    'client_id' => env('GITHUB_CLIENT_ID'),
    'client_secret' => env('GITHUB_CLIENT_SECRET'),
    'redirect' => env('GITHUB_REDIRECT_URL'),
],

// routes/web.php
use Laravel\Socialite\Facades\Socialite;

Route::get('/auth/github', function () {
    return Socialite::driver('github')->redirect();
});

Route::get('/auth/github/callback', function () {
    $githubUser = Socialite::driver('github')->user();

    $user = User::updateOrCreate([
        'email' => $githubUser->email,
    ], [
        'name' => $githubUser->name,
        'github_id' => $githubUser->id,
        'github_token' => $githubUser->token,
    ]);

    Auth::login($user);

    return redirect('/dashboard');
});
```

**Password Hashing:**

```php
use Illuminate\Support\Facades\Hash;

// Хеширование
$hashed = Hash::make('password');

// Проверка
if (Hash::check('password', $user->password)) {
    // Верный пароль
}

// Проверка необходимости rehash
if (Hash::needsRehash($user->password)) {
    $user->password = Hash::make('new-password');
    $user->save();
}
```

---

## На собеседовании скажешь

> "Аутентификация — проверка личности. Session-based для веба (Auth::attempt(), auth()->user()). Token-based для API (Sanctum, createToken()). Auth middleware защищает маршруты. Rate limiting против brute force (RateLimiter::tooManyAttempts()). Email verification через MustVerifyEmail. Password reset через Password::sendResetLink(). 2FA через google2fa. Remember Me через второй параметр attempt(). Socialite для OAuth. Hash::make() для хеширования паролей, Hash::check() для проверки."

---

## Практические задания

### Задание 1: Реализуй Rate Limiting для логина

Защити endpoint логина от brute force атак с использованием rate limiting.

<details>
<summary>Решение</summary>

```php
// LoginController
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // Ключ для rate limiting (по email + IP)
        $key = 'login:' . $request->email . ':' . $request->ip();

        // Проверка лимита (5 попыток в минуту)
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'email' => [
                    "Слишком много попыток входа. Попробуйте через {$seconds} секунд."
                ],
            ]);
        }

        // Попытка аутентификации
        if (Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            // Сбросить счётчик при успешном входе
            RateLimiter::clear($key);

            $request->session()->regenerate();

            return redirect()->intended('/dashboard');
        }

        // Увеличить счётчик попыток (TTL 60 секунд)
        RateLimiter::hit($key, 60);

        throw ValidationException::withMessages([
            'email' => ['Неверные учётные данные.'],
        ]);
    }
}

// Альтернатива: Использовать middleware throttle
Route::post('/login', [LoginController::class, 'login'])
    ->middleware('throttle:5,1'); // 5 запросов в 1 минуту

// Или кастомный rate limiter в RouteServiceProvider
use Illuminate\Cache\RateLimiting\Limit;

RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)->by($request->input('email') . $request->ip())
        ->response(function () {
            return response()->json([
                'message' => 'Слишком много попыток входа.'
            ], 429);
        });
});

// В маршруте
Route::post('/login', [LoginController::class, 'login'])
    ->middleware('throttle:login');
```
</details>

### Задание 2: Настрой Email Verification

Реализуй систему подтверждения email для новых пользователей.

<details>
<summary>Решение</summary>

```php
// 1. User Model
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    use Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
    ];
}

// 2. Migration (уже есть в Laravel)
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamp('email_verified_at')->nullable(); // Важно!
    $table->string('password');
    $table->rememberToken();
    $table->timestamps();
});

// 3. Routes
use Illuminate\Foundation\Auth\EmailVerificationRequest;

Route::get('/email/verify', function () {
    return view('auth.verify-email');
})->middleware('auth')->name('verification.notice');

Route::get('/email/verify/{id}/{hash}', function (EmailVerificationRequest $request) {
    $request->fulfill();
    return redirect('/dashboard');
})->middleware(['auth', 'signed'])->name('verification.verify');

Route::post('/email/verification-notification', function (Request $request) {
    $request->user()->sendEmailVerificationNotification();

    return back()->with('message', 'Письмо отправлено!');
})->middleware(['auth', 'throttle:6,1'])->name('verification.send');

// 4. Защита маршрутов
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'show']);
});

// 5. Кастомизация уведомления
class User extends Authenticatable implements MustVerifyEmail
{
    public function sendEmailVerificationNotification()
    {
        $this->notify(new CustomVerifyEmail);
    }
}

// app/Notifications/CustomVerifyEmail.php
use Illuminate\Auth\Notifications\VerifyEmail;

class CustomVerifyEmail extends VerifyEmail
{
    public function toMail($notifiable)
    {
        $verificationUrl = $this->verificationUrl($notifiable);

        return (new MailMessage)
            ->subject('Подтвердите email')
            ->line('Нажмите кнопку ниже для подтверждения.')
            ->action('Подтвердить Email', $verificationUrl)
            ->line('Если вы не создавали аккаунт, проигнорируйте письмо.');
    }
}

// 6. View (resources/views/auth/verify-email.blade.php)
<div>
    <h2>Подтвердите email</h2>

    @if (session('message'))
        <div>{{ session('message') }}</div>
    @endif

    <p>Мы отправили письмо на ваш email. Проверьте почту.</p>

    <form method="POST" action="{{ route('verification.send') }}">
        @csrf
        <button type="submit">Отправить письмо повторно</button>
    </form>
</div>
```
</details>

### Задание 3: Реализуй простую 2FA

Добавь двухфакторную аутентификацию через email код.

<details>
<summary>Решение</summary>

```php
// 1. Migration
Schema::table('users', function (Blueprint $table) {
    $table->string('two_factor_code')->nullable();
    $table->timestamp('two_factor_expires_at')->nullable();
});

// 2. LoginController
class LoginController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Неверные учётные данные.'],
            ]);
        }

        // Генерировать 2FA код
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $user->update([
            'two_factor_code' => Hash::make($code),
            'two_factor_expires_at' => now()->addMinutes(10),
        ]);

        // Отправить код на email
        $user->notify(new TwoFactorCode($code));

        // Сохранить user_id в сессии
        session(['2fa_user_id' => $user->id]);

        return redirect()->route('two-factor.verify');
    }

    public function showVerifyForm()
    {
        if (!session('2fa_user_id')) {
            return redirect()->route('login');
        }

        return view('auth.two-factor');
    }

    public function verify(Request $request)
    {
        $request->validate([
            'code' => 'required|digits:6',
        ]);

        $userId = session('2fa_user_id');
        $user = User::find($userId);

        if (!$user) {
            return redirect()->route('login');
        }

        // Проверка срока действия
        if (now()->isAfter($user->two_factor_expires_at)) {
            throw ValidationException::withMessages([
                'code' => ['Код истёк. Войдите заново.'],
            ]);
        }

        // Проверка кода
        if (!Hash::check($request->code, $user->two_factor_code)) {
            throw ValidationException::withMessages([
                'code' => ['Неверный код.'],
            ]);
        }

        // Очистить 2FA данные
        $user->update([
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
        ]);

        // Авторизовать
        Auth::login($user);
        $request->session()->forget('2fa_user_id');
        $request->session()->regenerate();

        return redirect()->intended('/dashboard');
    }
}

// 3. Notification
class TwoFactorCode extends Notification
{
    public function __construct(private string $code)
    {
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Код подтверждения')
            ->line("Ваш код: {$this->code}")
            ->line('Код действителен 10 минут.');
    }
}

// 4. Routes
Route::post('/login', [LoginController::class, 'login'])->name('login');
Route::get('/two-factor', [LoginController::class, 'showVerifyForm'])->name('two-factor.verify');
Route::post('/two-factor', [LoginController::class, 'verify']);

// 5. View (resources/views/auth/two-factor.blade.php)
<form method="POST" action="{{ route('two-factor.verify') }}">
    @csrf

    <div>
        <label>Введите код из email</label>
        <input type="text" name="code" maxlength="6" required>
        @error('code')
            <span>{{ $message }}</span>
        @enderror
    </div>

    <button type="submit">Подтвердить</button>
</form>
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
