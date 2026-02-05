# 11.5 Разрешение конфликтов

## Краткое резюме

> **Конфликт** — когда Git не может автоматически объединить изменения из разных веток.
>
> **Формат:** `<<<HEAD` (твой код), `===` (разделитель), `>>>branch` (их код).
>
> **Разрешение:** Открыть файл, удалить маркеры, оставить нужный код, `git add`, `git commit`.

---

## Содержание

- [Что это](#что-это)
- [Как выглядит конфликт](#как-выглядит-конфликт)
- [Разрешение конфликтов](#разрешение-конфликтов)
- [Инструменты для разрешения](#инструменты-для-разрешения)
- [Типы конфликтов](#типы-конфликтов)
- [Практические примеры](#практические-примеры)
- [Предотвращение конфликтов](#предотвращение-конфликтов)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Конфликт — когда Git не может автоматически объединить изменения в одном файле из разных веток.

**Когда возникает:**
- Merge веток с изменениями в одних строках
- Rebase с конфликтующими коммитами
- Cherry-pick коммита с конфликтами
- Pull с удалёнными изменениями

---

## Как выглядит конфликт

**Формат:**

```php
<<<<<<< HEAD
// Твой код (текущая ветка)
public function index()
{
    return view('dashboard');
}
=======
// Код из другой ветки
public function index()
{
    return view('home');
}
>>>>>>> feature/new-design
```

**Маркеры:**
- `<<<<<<< HEAD` — начало твоих изменений
- `=======` — разделитель
- `>>>>>>> branch` — конец изменений из другой ветки

---

## Разрешение конфликтов

**При merge:**

```bash
git checkout main
git merge feature/new-api

# Auto-merging app/Controllers/ApiController.php
# CONFLICT (content): Merge conflict in app/Controllers/ApiController.php
# Automatic merge failed; fix conflicts and then commit the result.

# 1. Посмотреть конфликтующие файлы
git status

# On branch main
# You have unmerged paths.
# Unmerged paths:
#   both modified:   app/Controllers/ApiController.php

# 2. Открыть файл и исправить
vim app/Controllers/ApiController.php

# 3. Удалить маркеры, оставить нужный код
# Было:
<<<<<<< HEAD
return response()->json(['status' => 'ok']);
=======
return response()->json(['success' => true]);
>>>>>>> feature/new-api

# Стало (например):
return response()->json(['success' => true, 'status' => 'ok']);

# 4. Добавить исправленный файл
git add app/Controllers/ApiController.php

# 5. Завершить merge
git commit -m "Merge feature/new-api into main"

# Или отменить merge
git merge --abort
```

**При rebase:**

```bash
git rebase main

# CONFLICT (content): Merge conflict in app/Models/User.php

# 1. Исправить конфликты
vim app/Models/User.php

# 2. Добавить файл
git add app/Models/User.php

# 3. Продолжить rebase
git rebase --continue

# Если ещё конфликты — повторить шаги 1-3
# Или отменить rebase
git rebase --abort
```

---

## Инструменты для разрешения

**VS Code:**

```bash
# Открыть в VS Code
code app/Controllers/ApiController.php

# VS Code покажет:
# ✅ Accept Current Change (HEAD)
# ✅ Accept Incoming Change (branch)
# ✅ Accept Both Changes
# ✅ Compare Changes
```

**Merge tool:**

```bash
# Настроить merge tool (например, vimdiff)
git config --global merge.tool vimdiff

# Или p4merge
git config --global merge.tool p4merge

# Запустить merge tool
git mergetool

# После разрешения:
git add .
git commit
```

**PhpStorm/WebStorm:**

```
VCS → Git → Resolve Conflicts

Показывает 3 панели:
- Left: твоя версия
- Center: результат
- Right: их версия
```

---

## Типы конфликтов

**1. Content conflict (изменён контент):**

```bash
# Обе ветки изменили одну строку
git merge feature

# CONFLICT in file.php
<<<<<<< HEAD
$price = 100;
=======
$price = 150;
>>>>>>> feature
```

**2. Delete-modify conflict (удаление vs изменение):**

```bash
# Ты удалил файл, они изменили
git merge feature

# CONFLICT (modify/delete): file.php deleted in HEAD and modified in feature

# Решение:
# Оставить удаление
git rm file.php

# Или восстановить
git add file.php

git commit
```

**3. Rename conflict (переименование):**

```bash
# Обе ветки переименовали файл по-разному
# Выбрать одно имя
git mv old-name.php new-name.php
git add .
git commit
```

---

## Практические примеры

**Простой конфликт:**

```php
// До merge
// main:
public function store(Request $request)
{
    $user = User::create($request->all());
    return redirect()->route('users.index');
}

// feature:
public function store(Request $request)
{
    $user = User::create($request->validated());
    return response()->json($user, 201);
}

// Конфликт:
<<<<<<< HEAD
public function store(Request $request)
{
    $user = User::create($request->all());
    return redirect()->route('users.index');
}
=======
public function store(Request $request)
{
    $user = User::create($request->validated());
    return response()->json($user, 201);
}
>>>>>>> feature/api

// Решение (взять лучшее из обоих):
public function store(Request $request)
{
    $user = User::create($request->validated());

    if ($request->wantsJson()) {
        return response()->json($user, 201);
    }

    return redirect()->route('users.index');
}
```

**Множественные конфликты:**

```bash
git merge feature

# CONFLICT in:
# - app/Controllers/UserController.php
# - app/Models/User.php
# - routes/web.php

# Решить все конфликты по очереди
git status  # Посмотреть что осталось

# Unmerged paths:
#   both modified:   app/Controllers/UserController.php
#   both modified:   app/Models/User.php
#   both modified:   routes/web.php

# После исправления всех файлов
git add app/Controllers/UserController.php
git add app/Models/User.php
git add routes/web.php
git commit
```

**Конфликт в composer.lock:**

```bash
# Часто конфликтует при merge
git merge develop

# CONFLICT in composer.lock

# Решение: пересоздать
git checkout --theirs composer.json
git checkout --theirs composer.lock
composer install
git add composer.json composer.lock
git commit
```

---

## Предотвращение конфликтов

**Частые pull:**

```bash
# Обновляться из main/develop регулярно
git pull origin main
```

**Маленькие PR:**

```bash
# Не накапливать много изменений
# Делать PR каждые 1-2 дня
```

**Коммуникация:**

```bash
# Предупредить команду если работаешь в тех же файлах
```

**Rebase вместо merge (для feature веток):**

```bash
# Rebase создаёт линейную историю, меньше конфликтов
git rebase main
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Конфликт возникает когда Git не может автоматически объединить изменения
- Обе ветки изменили одни и те же строки по-разному
- Требует ручного разрешения

**Формат конфликта:**
- `<<<<<<< HEAD` — начало твоих изменений
- `=======` — разделитель
- `>>>>>>> branch` — конец изменений из другой ветки

**Разрешение:**
1. Открыть файл в редакторе
2. Удалить маркеры конфликта
3. Оставить нужный код (или объединить оба варианта)
4. `git add <файл>`
5. `git commit` (при merge) или `git rebase --continue` (при rebase)

**Отмена:**
- При merge: `git merge --abort`
- При rebase: `git rebase --abort`

**Инструменты:**
- VS Code с визуальными кнопками
- PhpStorm с 3-панельным view
- `git mergetool` с vimdiff/p4merge

**Типы конфликтов:**
- **Content** — изменён контент
- **Delete-modify** — удаление vs изменение
- **Rename** — переименование

**Предотвращение:**
- Частые pull из main
- Маленькие PR (1-2 дня)
- Коммуникация в команде
- Rebase для feature веток

---

## Практические задания

### Задание 1: Разреши content conflict

Две ветки изменили один метод по-разному. Разреши конфликт, объединив логику.

<details>
<summary>Решение</summary>

```bash
# Ситуация:
# main: метод возвращает редирект
# feature: метод возвращает JSON

# Merge
git checkout main
git merge feature/api

# CONFLICT in app/Controllers/UserController.php

# Открыть файл
vim app/Controllers/UserController.php

# Увидим:
<<<<<<< HEAD
public function store(Request $request)
{
    $validated = $request->validate([
        'name' => 'required',
        'email' => 'required|email',
    ]);

    $user = User::create($validated);

    return redirect()->route('users.index')
        ->with('success', 'User created');
}
=======
public function store(Request $request)
{
    $user = User::create($request->all());

    return response()->json([
        'data' => $user,
        'message' => 'User created successfully'
    ], 201);
}
>>>>>>> feature/api

# Решение: объединить логику (взять validation из main, добавить JSON response)
public function store(Request $request)
{
    // Validation из main (лучше)
    $validated = $request->validate([
        'name' => 'required',
        'email' => 'required|email',
    ]);

    $user = User::create($validated);

    // Поддержка обоих вариантов
    if ($request->wantsJson()) {
        return response()->json([
            'data' => $user,
            'message' => 'User created successfully'
        ], 201);
    }

    return redirect()->route('users.index')
        ->with('success', 'User created');
}

# Сохранить файл

# Добавить и закоммитить
git add app/Controllers/UserController.php
git commit -m "Merge feature/api into main

Resolved conflict in UserController:
- Keep validation from main
- Add JSON response support from feature
- Support both web and API requests"

# Проверить что всё работает
php artisan test
```
</details>

### Задание 2: Разреши delete-modify conflict

Ты удалил устаревший файл, но коллега его изменил. Реши что делать.

<details>
<summary>Решение</summary>

```bash
# Ситуация:
# main: удалил LegacyController.php (устарел)
# feature: изменил LegacyController.php (добавил функционал)

# Merge
git checkout main
git merge feature/legacy-update

# CONFLICT (modify/delete): app/Controllers/LegacyController.php
# deleted in HEAD and modified in feature/legacy-update

# Анализ ситуации
# 1. Посмотреть что изменилось в feature
git show feature/legacy-update:app/Controllers/LegacyController.php

# 2. Посмотреть почему был удалён в main
git log --oneline -- app/Controllers/LegacyController.php
# Найти commit с удалением
git show abc123

# Вариант А: Оставить удаление (если функционал не нужен)
git rm app/Controllers/LegacyController.php

git commit -m "Merge feature/legacy-update into main

Resolved delete-modify conflict:
- Keep file deleted (replaced by NewController)
- Legacy functionality moved to NewController"

# Вариант Б: Восстановить файл (если изменения важны)
git add app/Controllers/LegacyController.php

git commit -m "Merge feature/legacy-update into main

Resolved delete-modify conflict:
- Restore LegacyController with new changes
- TODO: Refactor to NewController later"

# Вариант В: Извлечь изменения и перенести в новый контроллер
# 1. Посмотреть изменения
git show feature/legacy-update:app/Controllers/LegacyController.php > /tmp/legacy.php

# 2. Вручную перенести нужную логику в NewController
vim app/Controllers/NewController.php
# ... добавить логику из legacy ...

# 3. Оставить удаление
git rm app/Controllers/LegacyController.php

# 4. Добавить изменения в новом файле
git add app/Controllers/NewController.php

git commit -m "Merge feature/legacy-update into main

Resolved delete-modify conflict:
- Keep LegacyController deleted
- Migrated new functionality to NewController
- Maintains backward compatibility"
```
</details>

### Задание 3: Множественные конфликты при rebase

У тебя feature ветка с 5 коммитами. При rebase на main возникли конфликты в 3 коммитах. Разреши все.

<details>
<summary>Решение</summary>

```bash
# Ситуация:
# feature: 5 коммитов за неделю
# main: ушёл вперёд, изменил те же файлы

# Попытка rebase
git checkout feature/user-dashboard
git rebase main

# CONFLICT (commit 1/5): Add dashboard route
# CONFLICT in routes/web.php

# === Конфликт 1 ===
# 1. Посмотреть конфликт
git status
# both modified: routes/web.php

# 2. Открыть файл
vim routes/web.php

<<<<<<< HEAD
Route::get('/home', [HomeController::class, 'index']);
Route::get('/profile', [ProfileController::class, 'show']);
=======
Route::get('/dashboard', [DashboardController::class, 'index']);
>>>>>>> Add dashboard route

# 3. Решить (оставить оба маршрута)
Route::get('/home', [HomeController::class, 'index']);
Route::get('/profile', [ProfileController::class, 'show']);
Route::get('/dashboard', [DashboardController::class, 'index']);

# 4. Продолжить
git add routes/web.php
git rebase --continue

# === Конфликт 2 ===
# CONFLICT (commit 2/5): Add dashboard controller
# CONFLICT in app/Controllers/DashboardController.php

vim app/Controllers/DashboardController.php

<<<<<<< HEAD
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        return view('home.index');
    }
}
=======
namespace App\Http\Controllers;

class DashboardController extends Controller
{
    public function index()
    {
        return view('dashboard.index');
    }
}
>>>>>>> Add dashboard controller

# Решить (взять правильный view)
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        return view('dashboard.index');
    }
}

git add app/Controllers/DashboardController.php
git rebase --continue

# === Конфликт 3 ===
# CONFLICT (commit 3/5): Add dashboard tests
# CONFLICT in tests/Feature/DashboardTest.php

vim tests/Feature/DashboardTest.php
# ... разрешить конфликт ...

git add tests/Feature/DashboardTest.php
git rebase --continue

# === Коммиты 4-5 без конфликтов ===
# Successfully rebased and updated refs/heads/feature/user-dashboard

# Force push (т.к. переписали историю)
git push --force-with-lease origin feature/user-dashboard

# Проверить результат
git log --oneline
# 5 коммитов теперь на актуальном main

# Если запутался в конфликтах — отменить rebase:
git rebase --abort
# Ветка вернётся в состояние до rebase

# Альтернатива: использовать rerere (reuse recorded resolution)
# Автоматически применяет ранее решённые конфликты
git config --global rerere.enabled true

# При повторном rebase Git вспомнит как ты решал конфликты
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
