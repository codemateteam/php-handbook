# 5.8 Validation

## Краткое резюме

> **Validation** — проверка входных данных через встроенные правила (required, email, unique, exists, etc.) или кастомные.
>
> `$request->validate()` — простая валидация в контроллере. **Form Request** — отдельный класс с `authorize()`, `rules()`, `messages()`.
>
> **Кастомные правила:** через `make:rule` или closure. `withValidator()` для дополнительной логики. Вложенные массивы: `array`, `array.*`.

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
Валидация — проверка входных данных. Laravel предоставляет встроенные правила и возможность создания кастомных.

**Основное:**
- `$request->validate()` — в контроллере
- Form Request — отдельный класс
- Кастомные правила

---

## Как работает

**Базовая валидация в контроллере:**

```php
public function store(Request $request)
{
    $validated = $request->validate([
        'title' => 'required|string|max:255',
        'body' => 'required|string',
        'category_id' => 'required|exists:categories,id',
        'tags' => 'array',
        'tags.*' => 'string|max:50',
    ]);

    $post = Post::create($validated);

    return response()->json($post, 201);
}
```

**Популярные правила:**

```php
[
    // Обязательное поле
    'email' => 'required',

    // Строка
    'name' => 'string|min:3|max:255',

    // Email
    'email' => 'email:rfc,dns',

    // Число
    'age' => 'integer|min:18|max:100',
    'price' => 'numeric|between:0,9999.99',

    // Boolean
    'is_active' => 'boolean',

    // Дата
    'birth_date' => 'date|before:today',
    'start_date' => 'date|after:tomorrow',
    'end_date' => 'date|after:start_date',

    // Файл
    'avatar' => 'file|image|mimes:jpeg,png|max:2048',  // 2MB

    // Массив
    'tags' => 'array|min:1|max:5',
    'tags.*' => 'string',

    // Существует в БД
    'user_id' => 'exists:users,id',

    // Уникальное значение
    'email' => 'unique:users,email',
    'email' => 'unique:users,email,'.$user->id,  // Игнорировать текущего

    // Одно из значений
    'status' => 'in:pending,approved,rejected',

    // Regex
    'phone' => 'regex:/^\+7\d{10}$/',

    // Подтверждение (password_confirmation)
    'password' => 'confirmed|min:8',

    // Nullable
    'middle_name' => 'nullable|string|max:255',

    // Sometimes (только если присутствует)
    'bio' => 'sometimes|string|max:1000',

    // Required if
    'reason' => 'required_if:status,rejected',

    // Required with
    'state' => 'required_with:city,zip',

    // Distinct (уникальные значения в массиве)
    'emails' => 'array',
    'emails.*' => 'email|distinct',
]
```

**Form Request (вынести валидацию):**

```bash
php artisan make:request CreatePostRequest
```

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreatePostRequest extends FormRequest
{
    // Авторизация
    public function authorize(): bool
    {
        return $this->user()->can('create', Post::class);
    }

    // Правила валидации
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'slug' => 'required|string|unique:posts,slug',
            'body' => 'required|string',
            'category_id' => 'required|exists:categories,id',
            'tags' => 'nullable|array|max:5',
            'tags.*' => 'string|max:50',
            'published_at' => 'nullable|date|after:now',
        ];
    }

    // Кастомные сообщения
    public function messages(): array
    {
        return [
            'title.required' => 'Заголовок обязателен',
            'slug.unique' => 'Такой slug уже существует',
            'tags.max' => 'Максимум 5 тегов',
        ];
    }

    // Кастомные имена атрибутов
    public function attributes(): array
    {
        return [
            'title' => 'заголовок',
            'body' => 'содержимое',
        ];
    }

    // Подготовка данных перед валидацией
    protected function prepareForValidation(): void
    {
        $this->merge([
            'slug' => Str::slug($this->title),
        ]);
    }
}

// Использование в контроллере
public function store(CreatePostRequest $request)
{
    // Валидация уже прошла
    $post = Post::create($request->validated());

    return response()->json($post, 201);
}
```

---

## Когда использовать

**Контроллер $request->validate():**
- Простая валидация
- Разовые запросы

**Form Request:**
- Сложная валидация
- Многократное использование
- Нужна авторизация
- Кастомные сообщения

---

## Пример из практики

**Комплексная валидация заказа:**

```php
namespace App\Http\Requests;

class CreateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Order::class);
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:100',

            // Валидация на основе другого поля
            'shipping_address' => 'required_if:delivery_method,courier',

            // Условная валидация
            'payment_method' => 'required|in:card,cash,online',
            'card_number' => 'required_if:payment_method,card|digits:16',
            'card_cvv' => 'required_if:payment_method,card|digits:3',

            // Кастомное правило
            'promo_code' => ['nullable', 'string', new ValidPromoCode()],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Корзина не может быть пустой',
            'items.*.product_id.exists' => 'Товар не найден',
            'card_number.required_if' => 'Укажите номер карты',
        ];
    }

    // Дополнительная валидация
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Проверить наличие товаров на складе
            foreach ($this->input('items', []) as $item) {
                $product = Product::find($item['product_id']);

                if ($product && $product->stock < $item['quantity']) {
                    $validator->errors()->add(
                        "items.{$item['product_id']}.quantity",
                        "Недостаточно товара на складе (доступно: {$product->stock})"
                    );
                }
            }
        });
    }
}
```

**Кастомное правило:**

```bash
php artisan make:rule ValidPromoCode
```

```php
namespace App\Rules;

use App\Models\PromoCode;
use Illuminate\Contracts\Validation\Rule;

class ValidPromoCode implements Rule
{
    private ?string $message = null;

    public function passes($attribute, $value): bool
    {
        $promoCode = PromoCode::where('code', $value)->first();

        if (!$promoCode) {
            $this->message = 'Промокод не найден';
            return false;
        }

        if ($promoCode->expires_at < now()) {
            $this->message = 'Промокод истёк';
            return false;
        }

        if ($promoCode->uses_count >= $promoCode->max_uses) {
            $this->message = 'Промокод исчерпан';
            return false;
        }

        return true;
    }

    public function message(): string
    {
        return $this->message ?? 'Промокод недействителен';
    }
}

// Использование
'promo_code' => ['nullable', 'string', new ValidPromoCode()],
```

**Closure правило (без класса):**

```php
use Illuminate\Validation\Rule;

$request->validate([
    'email' => [
        'required',
        'email',
        function ($attribute, $value, $fail) {
            if (!str_ends_with($value, '@company.com')) {
                $fail('Используйте корпоративную почту');
            }
        },
    ],

    // Или Rule::forEach для массивов
    'users.*.email' => [
        'required',
        'email',
        Rule::forEach(function ($value) {
            return [
                'unique:users,email',
            ];
        }),
    ],
]);
```

**Conditional Rules:**

```php
public function rules(): array
{
    $rules = [
        'title' => 'required|string|max:255',
        'body' => 'required|string',
    ];

    // Добавить правила для обновления
    if ($this->isMethod('put') || $this->isMethod('patch')) {
        $rules['slug'] = [
            'required',
            'string',
            Rule::unique('posts')->ignore($this->route('post')),
        ];
    }

    // Conditional правила
    if ($this->input('type') === 'premium') {
        $rules['premium_content'] = 'required|string';
    }

    return $rules;
}
```

**Nested Array Validation:**

```php
$request->validate([
    'orders' => 'required|array',
    'orders.*.user_id' => 'required|exists:users,id',
    'orders.*.items' => 'required|array|min:1',
    'orders.*.items.*.product_id' => 'required|exists:products,id',
    'orders.*.items.*.quantity' => 'required|integer|min:1',
    'orders.*.items.*.price' => 'required|numeric|min:0',
]);
```

**Sometimes (условное добавление правил):**

```php
use Illuminate\Validation\Validator;

$validator = Validator::make($request->all(), [
    'email' => 'required|email',
]);

$validator->sometimes('reason', 'required|max:500', function ($input) {
    return $input->status === 'rejected';
});

if ($validator->fails()) {
    return response()->json($validator->errors(), 422);
}
```

**Custom Error Bag:**

```php
public function store(CreatePostRequest $request, CreateTagRequest $tagRequest)
{
    // Разные error bags для разных форм
    $request->validateWithBag('post', $request->rules());
    $tagRequest->validateWithBag('tag', $tagRequest->rules());
}
```

**Manual Validation:**

```php
use Illuminate\Support\Facades\Validator;

$validator = Validator::make($request->all(), [
    'email' => 'required|email',
    'password' => 'required|min:8',
]);

// Добавить кастомные ошибки
$validator->after(function ($validator) {
    if ($this->somethingElseIsInvalid()) {
        $validator->errors()->add('field', 'Something is wrong!');
    }
});

if ($validator->fails()) {
    return redirect()->back()
        ->withErrors($validator)
        ->withInput();
}

$validated = $validator->validated();
```

**Bail Rule (остановить при первой ошибке):**

```php
$request->validate([
    // Остановить валидацию email при первой ошибке
    'email' => 'bail|required|email|unique:users',

    // Без bail проверит все правила даже если required провалилось
    'password' => 'required|min:8|confirmed',
]);
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Способы валидации:**
- `$request->validate()` — быстрая валидация в контроллере
- **Form Request** — отдельный класс для сложных случаев

**Популярные правила:**
```php
'email' => 'required|email|unique:users,email',
'age' => 'integer|min:18|max:100',
'file' => 'file|image|mimes:jpeg,png|max:2048',
'tags' => 'array|min:1',
'tags.*' => 'string|max:50',
'user_id' => 'exists:users,id',
'status' => 'in:pending,approved,rejected',
'password' => 'confirmed|min:8',
```

**Form Request:**
```php
authorize()  // Проверка прав
rules()      // Правила валидации
messages()   // Кастомные сообщения
attributes() // Имена полей
prepareForValidation()  // Подготовка данных
withValidator()  // Доп. валидация
```

**Кастомные правила:**
- `make:rule` — отдельный класс
- Closure — для простых случаев
- `Rule::forEach` — для массивов

**Продвинутое:**
- `bail` — остановка при первой ошибке
- `sometimes` — условные правила
- `required_if`, `required_with` — зависимые правила
- Вложенные массивы: `orders.*.items.*.quantity`

---

## Практические задания

### Задание 1: Form Request с условной валидацией

Создай `UpdateProfileRequest`. Поле `email` должно быть уникальным (кроме текущего пользователя). Поле `company_name` обязательно только если `account_type === 'business'`.

<details>
<summary>Решение</summary>

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Пользователь может редактировать только свой профиль
        return $this->user()->id === $this->route('user')->id;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',

            // Email уникален, кроме текущего пользователя
            'email' => [
                'required',
                'email',
                Rule::unique('users')->ignore($this->user()->id),
            ],

            'account_type' => 'required|in:personal,business',

            // Обязательно только для business
            'company_name' => 'required_if:account_type,business|string|max:255',
            'company_vat' => 'nullable|string|max:50',

            'phone' => 'nullable|regex:/^\+7\d{10}$/',
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Этот email уже используется',
            'company_name.required_if' => 'Укажите название компании для бизнес-аккаунта',
            'phone.regex' => 'Телефон должен быть в формате +79001234567',
        ];
    }

    public function attributes(): array
    {
        return [
            'company_name' => 'название компании',
            'company_vat' => 'ИНН',
        ];
    }
}

// Контроллер
public function update(UpdateProfileRequest $request, User $user)
{
    $user->update($request->validated());

    return response()->json($user);
}
```
</details>

### Задание 2: Кастомное правило для промокода

Создай кастомное правило `ValidPromoCode` которое проверяет: промокод существует, не истёк, не исчерпан, подходит для текущего пользователя (минимальная сумма заказа).

<details>
<summary>Решение</summary>

```php
// php artisan make:rule ValidPromoCode

namespace App\Rules;

use App\Models\PromoCode;
use Illuminate\Contracts\Validation\Rule;

class ValidPromoCode implements Rule
{
    private ?string $message = null;
    private float $orderTotal;

    public function __construct(float $orderTotal)
    {
        $this->orderTotal = $orderTotal;
    }

    public function passes($attribute, $value): bool
    {
        $promoCode = PromoCode::where('code', $value)->first();

        if (!$promoCode) {
            $this->message = 'Промокод не найден';
            return false;
        }

        if (!$promoCode->is_active) {
            $this->message = 'Промокод неактивен';
            return false;
        }

        if ($promoCode->expires_at && $promoCode->expires_at < now()) {
            $this->message = 'Промокод истёк';
            return false;
        }

        if ($promoCode->max_uses && $promoCode->uses_count >= $promoCode->max_uses) {
            $this->message = 'Промокод исчерпан';
            return false;
        }

        if ($promoCode->min_order_amount && $this->orderTotal < $promoCode->min_order_amount) {
            $this->message = "Минимальная сумма заказа: {$promoCode->min_order_amount} руб.";
            return false;
        }

        return true;
    }

    public function message(): string
    {
        return $this->message ?? 'Промокод недействителен';
    }
}

// Использование в Request
public function rules(): array
{
    return [
        'items' => 'required|array|min:1',
        'items.*.product_id' => 'required|exists:products,id',
        'items.*.quantity' => 'required|integer|min:1',
        'promo_code' => [
            'nullable',
            'string',
            new ValidPromoCode($this->getOrderTotal()),
        ],
    ];
}

private function getOrderTotal(): float
{
    $total = 0;
    foreach ($this->input('items', []) as $item) {
        $product = Product::find($item['product_id']);
        if ($product) {
            $total += $product->price * $item['quantity'];
        }
    }
    return $total;
}
```
</details>

### Задание 3: Вложенная валидация массивов

Создай валидацию для массового импорта пользователей. Формат: `[{name, email, roles: [{id, expires_at}]}]`. Проверь уникальность email в БД и внутри массива.

<details>
<summary>Решение</summary>

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ImportUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'users' => 'required|array|min:1|max:100',
            'users.*.name' => 'required|string|max:255',
            'users.*.email' => [
                'required',
                'email',
                'distinct',  // Уникальность внутри массива
                Rule::unique('users', 'email'),  // Уникальность в БД
            ],
            'users.*.password' => 'required|string|min:8',
            'users.*.roles' => 'required|array|min:1',
            'users.*.roles.*.id' => 'required|exists:roles,id',
            'users.*.roles.*.expires_at' => 'nullable|date|after:today',
        ];
    }

    public function messages(): array
    {
        return [
            'users.*.email.distinct' => 'Email :input дублируется в списке',
            'users.*.email.unique' => 'Email :input уже существует в системе',
            'users.*.roles.min' => 'Пользователь должен иметь хотя бы одну роль',
            'users.*.roles.*.id.exists' => 'Роль не найдена',
        ];
    }

    // Дополнительная валидация
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $users = $this->input('users', []);

            foreach ($users as $index => $user) {
                // Проверить что роли не дублируются
                $roleIds = collect($user['roles'] ?? [])->pluck('id');

                if ($roleIds->count() !== $roleIds->unique()->count()) {
                    $validator->errors()->add(
                        "users.{$index}.roles",
                        'Роли не должны дублироваться'
                    );
                }

                // Проверить что email имеет корпоративный домен
                if (isset($user['email']) && !str_ends_with($user['email'], '@company.com')) {
                    $validator->errors()->add(
                        "users.{$index}.email",
                        'Используйте корпоративную почту @company.com'
                    );
                }
            }
        });
    }
}

// Контроллер
public function import(ImportUsersRequest $request)
{
    $imported = [];

    DB::transaction(function () use ($request, &$imported) {
        foreach ($request->validated()['users'] as $userData) {
            $user = User::create([
                'name' => $userData['name'],
                'email' => $userData['email'],
                'password' => bcrypt($userData['password']),
            ]);

            // Прикрепить роли
            foreach ($userData['roles'] as $role) {
                $user->roles()->attach($role['id'], [
                    'expires_at' => $role['expires_at'] ?? null,
                ]);
            }

            $imported[] = $user;
        }
    });

    return response()->json([
        'message' => 'Users imported successfully',
        'count' => count($imported),
    ], 201);
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
