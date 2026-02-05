# 15.1 Code Review

## Краткое резюме

> **Code Review** — процесс проверки кода другими разработчиками для улучшения качества, поиска багов, обмена знаниями.
>
> **Что проверять:** функциональность, читаемость, производительность (N+1), безопасность (SQL injection, XSS), архитектуру (SOLID).
>
> **Комментарии:** конструктивные с объяснением и решением. Хороший PR: 100-300 строк, описание, checklist, тесты.

---

## Содержание

- [Что это](#что-это)
- [Как проводить Code Review](#как-проводить-code-review)
- [Примеры комментариев](#примеры-комментариев)
- [Checklist для reviewer](#checklist-для-reviewer)
- [Типичные проблемы](#типичные-проблемы)
- [Как принимать Code Review](#как-принимать-code-review)
- [Pull Request Best Practices](#pull-request-best-practices)
- [Автоматизация Code Review](#автоматизация-code-review)
- [Инструменты](#инструменты)
- [На собеседовании](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Code Review — процесс проверки кода другими разработчиками перед слиянием в основную ветку.

**Цели:**
- Найти баги и уязвимости
- Улучшить качество кода
- Обмен знаниями в команде
- Поддержание стандартов

---

## Как проводить Code Review

**Что проверять:**

```
1. Функциональность
   ✓ Код делает то, что заявлено?
   ✓ Есть тесты?
   ✓ Edge cases учтены?

2. Читаемость
   ✓ Понятные имена переменных/функций?
   ✓ Нет дублирования?
   ✓ Комментарии где нужно?

3. Производительность
   ✓ Нет N+1 запросов?
   ✓ Оптимальные алгоритмы?
   ✓ Кеширование где нужно?

4. Безопасность
   ✓ SQL injection защита?
   ✓ XSS защита?
   ✓ Нет хардкод секретов?

5. Архитектура
   ✓ Соответствует паттернам проекта?
   ✓ SOLID принципы?
   ✓ Не нарушает существующий дизайн?
```

---

## Примеры комментариев

**❌ Плохие комментарии:**

```
"Это плохо"
"Не работает"
"Переделай"
"Кто это писал?"
```

**✅ Хорошие комментарии:**

```php
// ❌ Найдена проблема
// "Здесь будет N+1 проблема"

// ✅ С объяснением и решением
"Здесь возникнет N+1 проблема, так как для каждого поста
будет отдельный запрос за пользователем.
Предлагаю использовать:
Post::with('user')->get()"

// ❌ Критика без конструктива
// "Плохо названа функция"

// ✅ Конструктивное предложение
"Имя getUserData() слишком общее. Предлагаю
getUserProfileWithOrders(), так как функция
загружает именно профиль с заказами"

// ✅ Вопросы вместо утверждений
"Почему здесь используется whereRaw вместо where?
Это может не использовать индекс"

// ✅ Похвала хорошего кода
"Отличное использование Early Return!
Код стал намного читабельнее"
```

---

## Checklist для reviewer

**Перед началом:**

```
□ Понял ли я задачу?
□ Прочитал ли описание PR?
□ Посмотрел ли связанные issues?
□ Запустил ли код локально?
```

**Во время ревью:**

```
□ Тесты есть и проходят?
□ Код читабельный и понятный?
□ Нет дублирования (DRY)?
□ Нет N+1 запросов?
□ Миграции безопасны (backward compatible)?
□ Нет SQL injection / XSS?
□ Нет хардкод credentials?
□ Соблюдён code style проекта?
□ Обработаны ошибки?
□ Документация обновлена (если нужно)?
```

---

## Типичные проблемы

**1. N+1 Query:**

```php
// ❌ Проблема
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name;  // N+1
}

// ✅ Комментарий
"N+1 проблема: для каждого поста отдельный запрос
за пользователем. Используйте:
Post::with('user')->get()"
```

**2. Нет валидации:**

```php
// ❌ Проблема
public function update(Request $request, User $user)
{
    $user->update($request->all());  // Любые поля!
}

// ✅ Комментарий
"Нужна валидация и указание конкретных полей:
$request->validate(['name' => 'required|max:255']);
$user->update($request->only(['name', 'email']));"
```

**3. Хардкод:**

```php
// ❌ Проблема
if ($user->role === 'admin') {
    // ...
}

// ✅ Комментарий
"Предлагаю вынести роли в enum или константы:
if ($user->role === UserRole::Admin->value)
или
if ($user->hasRole('admin'))"
```

**4. Нет обработки ошибок:**

```php
// ❌ Проблема
public function charge(User $user, int $amount)
{
    $this->stripeClient->charge($amount);
}

// ✅ Комментарий
"Нужна обработка ошибок от Stripe:
try {
    $this->stripeClient->charge($amount);
} catch (StripeException $e) {
    Log::error('Payment failed', ['user' => $user->id]);
    throw new PaymentFailedException($e->getMessage());
}"
```

---

## Как принимать Code Review

**✅ Хорошая реакция:**

```
"Спасибо за замечание! Действительно,
здесь N+1. Сейчас исправлю"

"Хороший вопрос. Я использовал whereRaw потому что...
Но вы правы, можно через where(). Поменяю"

"Не подумал про этот edge case. Добавлю проверку"
```

**❌ Плохая реакция:**

```
"Это не баг, это фича"
"Так работает"
"У нас всегда так делают"
"Не критично"
"Потом исправлю"
```

**Если не согласен:**

```
"Понимаю ваше замечание, но здесь есть нюанс...
[объяснение]. Как думаете, имеет смысл оставить
текущий вариант или всё же поменять?"
```

---

## Pull Request Best Practices

**Хороший PR:**

```markdown
## Описание
Добавлена система двухфакторной аутентификации для пользователей

## Изменения
- Добавлена таблица `user_two_factor`
- Новые методы `enableTwoFactor()` / `verifyTwoFactorCode()`
- Middleware `RequiresTwoFactor`
- Тесты для всех сценариев

## Как протестировать
1. Зарегистрировать пользователя
2. Включить 2FA в профиле
3. Выйти и войти снова
4. Должен запросить 2FA код

## Screenshots
[Скриншоты UI]

## Checklist
- [x] Тесты добавлены
- [x] Миграции backward compatible
- [x] Документация обновлена
```

**Размер PR:**

```
✅ Хорошо: 100-300 строк
⚠️  Средне: 300-500 строк
❌ Плохо: 1000+ строк

Большой PR → Split на несколько:
- PR #1: Модели и миграции
- PR #2: Контроллеры и роуты
- PR #3: UI
```

---

## Автоматизация Code Review

**GitHub Actions:**

```yaml
# .github/workflows/code-quality.yml
name: Code Quality

on: [pull_request]

jobs:
  phpstan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: PHPStan
        run: vendor/bin/phpstan analyse

  pint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Laravel Pint
        run: vendor/bin/pint --test

  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: php artisan test
```

**Автокомментарии:**

```yaml
# Автоматически комментировать при проблемах
- name: Comment PR
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '❌ Code quality checks failed. Please fix before merging.'
      })
```

---

## Инструменты

**Code Review Tools:**

```
- GitHub / GitLab / Bitbucket (built-in)
- Gerrit (для крупных проектов)
- Phabricator / Differential
- Review Board
```

**Code Analysis:**

```
- PHPStan (статический анализ)
- Psalm (static analysis)
- Laravel Pint (code style)
- PHP CS Fixer (code style)
- SonarQube (комплексный анализ)
```

---

## На собеседовании скажешь

> "Code Review проверяет функциональность, читаемость, производительность, безопасность, архитектуру. Комментарии должны быть конструктивными с объяснением и предложением решения. Reviewer проверяет тесты, N+1, валидацию, SQL injection, code style. Хороший PR: 100-300 строк, описание, checklist. Автоматизация: PHPStan, Pint, тесты в CI/CD. Принимать ревью нужно конструктивно, не защищаться."

---

## Практические задания

### Задание 1: Найди проблемы в коде

Проведи code review следующего кода и укажи все проблемы:

```php
public function updateUser(Request $request, $id)
{
    $user = User::find($id);
    $user->name = $request->name;
    $user->email = $request->email;
    $user->password = $request->password;
    $user->save();

    return redirect('/users');
}
```

<details>
<summary>Решение</summary>

**Проблемы:**

1. **Нет валидации** — любые данные могут быть сохранены
2. **Нет проверки существования** — если user не найден, будет ошибка
3. **Пароль не хешируется** — сохраняется в plain text
4. **Mass assignment vulnerability** — можно перезаписать любые поля
5. **Нет authorization** — кто угодно может изменить любого пользователя
6. **Нет обработки ошибок**

**Исправленный код:**

```php
public function updateUser(UpdateUserRequest $request, User $user)
{
    // Authorization
    $this->authorize('update', $user);

    // Validated data
    $validated = $request->validated();

    // Hash password if provided
    if (isset($validated['password'])) {
        $validated['password'] = Hash::make($validated['password']);
    }

    // Update only allowed fields
    $user->update($validated);

    return redirect('/users')->with('success', 'User updated');
}

// UpdateUserRequest
public function rules()
{
    return [
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users,email,' . $this->user->id,
        'password' => 'nullable|min:8|confirmed',
    ];
}
```
</details>

### Задание 2: Напиши конструктивный комментарий

Тебе на ревью пришёл такой код. Напиши конструктивный комментарий:

```php
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name;
    echo $post->category->name;
}
```

<details>
<summary>Решение</summary>

**Плохой комментарий:**
```
"Это N+1 проблема, переделай"
```

**Хороший комментарий:**
```
"Здесь возникнет N+1 проблема: для каждого поста будет отдельный
запрос для получения user и category. Если постов 100, то будет
1 + 100 + 100 = 201 запрос к БД.

Предлагаю использовать eager loading:

$posts = Post::with(['user', 'category'])->get();

Это сократит количество запросов до 3:
1. SELECT * FROM posts
2. SELECT * FROM users WHERE id IN (...)
3. SELECT * FROM categories WHERE id IN (...)

Производительность улучшится в десятки раз."
```

**Почему хорошо:**
- Объясняет проблему
- Показывает последствия (201 запрос)
- Предлагает конкретное решение
- Объясняет как решение работает
</details>

### Задание 3: Checklist для PR

Создай checklist для проверки Pull Request с новой функцией регистрации пользователя.

<details>
<summary>Решение</summary>

**Checklist для User Registration PR:**

**Функциональность:**
- [ ] User может зарегистрироваться с email и password
- [ ] Password минимум 8 символов
- [ ] Email уникален (validation + DB constraint)
- [ ] Confirmation email отправляется
- [ ] User не может войти пока email не подтверждён
- [ ] Тесты покрывают все сценарии

**Безопасность:**
- [ ] Password хешируется (Hash::make или bcrypt)
- [ ] Нет SQL injection (используется Eloquent)
- [ ] CSRF protection (middleware)
- [ ] Email sanitized (validation)
- [ ] Rate limiting на /register (throttle middleware)
- [ ] Нет хардкод credentials

**Производительность:**
- [ ] Email отправка через queue (не блокирует request)
- [ ] Нет N+1 запросов
- [ ] Индексы на users.email

**Code Quality:**
- [ ] FormRequest для validation
- [ ] Service/Action для бизнес-логики
- [ ] Event/Listener для side effects (email, лог)
- [ ] Code style (Laravel Pint)
- [ ] PHPDoc где нужно
- [ ] Нет дублирования кода

**Testing:**
- [ ] Feature test: успешная регистрация
- [ ] Feature test: валидация (email required, unique, password min length)
- [ ] Feature test: confirmation email отправлен
- [ ] Unit test: UserService
- [ ] Edge cases покрыты

**Документация:**
- [ ] README обновлён (если нужно)
- [ ] API docs обновлены (Swagger)
- [ ] Migration комментирована

**Миграции:**
- [ ] Rollback работает
- [ ] Indexes созданы
- [ ] Foreign keys с onDelete cascade
- [ ] Backward compatible
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*

