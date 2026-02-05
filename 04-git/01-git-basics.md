# 11.1 Git Basics

## Краткое резюме

> **Git** — распределённая система контроля версий для отслеживания изменений в коде.
>
> **Базовый workflow:** clone → checkout -b → add → commit → push.
>
> **Важно:** Staging area для выборочных коммитов, .gitignore для исключения файлов, reset/revert для отмены.

---

## Содержание

- [Что это](#что-это)
- [Основные команды](#основные-команды)
- [Работа с изменениями](#работа-с-изменениями)
- [Работа с файлами](#работа-с-файлами)
- [Работа с remotes](#работа-с-remotes)
- [Практические примеры](#практические-примеры)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Git — распределённая система контроля версий. Отслеживает изменения в коде, позволяет работать в команде.

**Основные операции:**
- `clone` — скачать репозиторий
- `pull` — получить изменения
- `add` — добавить в staging
- `commit` — сохранить изменения
- `push` — отправить на сервер

---

## Основные команды

**Инициализация и клонирование:**

```bash
# Создать новый репозиторий
git init

# Клонировать репозиторий
git clone https://github.com/user/repo.git

# Клонировать конкретную ветку
git clone -b develop https://github.com/user/repo.git
```

**Базовый workflow:**

```bash
# 1. Посмотреть статус
git status

# 2. Добавить файлы в staging
git add .                    # Все файлы
git add src/Controller.php   # Конкретный файл
git add *.php               # По маске

# 3. Сделать commit
git commit -m "Add user authentication"

# 4. Отправить на сервер
git push origin main
```

**Получение изменений:**

```bash
# Получить изменения и смержить
git pull origin main

# Получить изменения без слияния
git fetch origin

# Посмотреть что изменилось
git diff origin/main
```

---

## Работа с изменениями

**Просмотр изменений:**

```bash
# Что изменилось (unstaged)
git diff

# Что в staging
git diff --staged

# История коммитов
git log
git log --oneline
git log --graph --oneline --all

# Изменения в конкретном файле
git log -p src/Controller.php
```

**Отмена изменений:**

```bash
# Отменить изменения в файле (до add)
git checkout -- src/Controller.php
git restore src/Controller.php

# Убрать из staging (после add, до commit)
git reset HEAD src/Controller.php
git restore --staged src/Controller.php

# Отменить последний commit (оставить изменения)
git reset --soft HEAD~1

# Отменить последний commit (удалить изменения)
git reset --hard HEAD~1

# Отменить commit и создать новый
git revert abc123
```

---

## Работа с файлами

**Добавление и удаление:**

```bash
# Переименовать файл
git mv old.php new.php

# Удалить файл
git rm file.php

# Удалить из Git, но оставить локально
git rm --cached file.php

# Игнорировать файлы (.gitignore)
echo ".env" >> .gitignore
echo "vendor/" >> .gitignore
git add .gitignore
```

**.gitignore для Laravel:**

```gitignore
/vendor
/node_modules
/.env
/.env.backup
/storage/*.key
/public/hot
/public/storage
/storage/logs/*
/storage/framework/cache/*
/storage/framework/sessions/*
/storage/framework/views/*
.phpunit.result.cache
.idea/
.vscode/
*.log
```

---

## Работа с remotes

**Управление удалёнными репозиториями:**

```bash
# Посмотреть remotes
git remote -v

# Добавить remote
git remote add origin https://github.com/user/repo.git

# Изменить URL
git remote set-url origin https://github.com/user/new-repo.git

# Удалить remote
git remote remove origin

# Получить информацию о remote
git remote show origin
```

**Push и pull:**

```bash
# Push в ветку
git push origin main

# Push всех веток
git push --all

# Push с тегами
git push --tags

# Force push (осторожно!)
git push --force origin main

# Pull с rebase
git pull --rebase origin main
```

---

## Практические примеры

**Типичный workflow:**

```bash
# 1. Начало работы
git clone https://github.com/company/project.git
cd project

# 2. Создать ветку для задачи
git checkout -b feature/user-auth

# 3. Внести изменения
# ... редактируем файлы ...

# 4. Проверить что изменилось
git status
git diff

# 5. Добавить и закоммитить
git add app/Controllers/AuthController.php
git add app/Models/User.php
git commit -m "Add user authentication

- Add login/register methods
- Add JWT token generation
- Add password validation"

# 6. Отправить на сервер
git push origin feature/user-auth
```

**Работа с конфликтами:**

```bash
# 1. Получить изменения
git pull origin main
# Conflict в src/Controller.php

# 2. Открыть файл, увидишь:
<<<<<<< HEAD
// Твой код
public function index() {
    return view('home');
}
=======
// Код из main
public function index() {
    return view('dashboard');
}
>>>>>>> main

# 3. Исправить вручную, оставить нужное
public function index() {
    return view('dashboard');
}

# 4. Добавить и закоммитить
git add src/Controller.php
git commit -m "Resolve merge conflict"
```

**Просмотр истории:**

```bash
# Последние 5 коммитов
git log -5 --oneline

# Коммиты за последнюю неделю
git log --since="1 week ago"

# Коммиты конкретного автора
git log --author="John"

# Изменения в файле
git log --follow -- src/Controller.php

# Граф веток
git log --graph --oneline --decorate --all
```

**Полезные алиасы:**

```bash
# Добавить в ~/.gitconfig
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.lg "log --graph --oneline --decorate --all"
git config --global alias.unstage "reset HEAD --"

# Использование
git st      # вместо git status
git lg      # красивый граф
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Git — распределённая система контроля версий
- Каждый разработчик имеет полную копию репозитория
- Работает offline

**Базовый workflow:**
- `git clone` — скачать репозиторий
- `git checkout -b` — создать ветку
- `git add` → `git commit` — сохранить изменения
- `git push` — отправить на сервер
- `git pull` — получить изменения (fetch + merge)

**Staging area:**
- Промежуточная зона между working directory и commit
- Позволяет выборочно коммитить файлы
- `git add` добавляет в staging

**Отмена изменений:**
- `git reset --soft` — отменить commit, оставить изменения
- `git reset --hard` — удалить изменения полностью
- `git revert` — создать новый commit отмены

**Best practices:**
- `.gitignore` для исключения файлов (.env, vendor/)
- Atomic commits (один commit = одна задача)
- Осмысленные commit messages

---

## Практические задания

### Задание 1: Отмени случайный commit

Ты случайно закоммитил файл .env с секретами. Отмени commit так, чтобы файл остался в working directory, но не был в истории.

<details>
<summary>Решение</summary>

```bash
# 1. Отменить последний commit (оставить изменения)
git reset --soft HEAD~1

# 2. Убрать .env из staging
git reset HEAD .env

# 3. Добавить .env в .gitignore
echo ".env" >> .gitignore

# 4. Закоммитить остальные файлы
git add .
git commit -m "Add authentication without secrets"

# 5. Если уже был push — нужен force push (ОПАСНО!)
# Лучше сообщить команде и пересоздать секреты

# Альтернатива: удалить из истории полностью
git filter-branch --index-filter 'git rm --cached --ignore-unmatch .env' HEAD

# Или через BFG Repo-Cleaner (быстрее)
# java -jar bfg.jar --delete-files .env
# git reflog expire --expire=now --all
# git gc --prune=now --aggressive
```
</details>

### Задание 2: Создай осмысленный commit message

У тебя изменения в 3 файлах: AuthController.php, User.php, CreateUsersTable.php. Создай structured commit message.

<details>
<summary>Решение</summary>

```bash
# Посмотреть что изменилось
git diff

# Добавить файлы по отдельности для atomic commits
git add app/Http/Controllers/AuthController.php
git add app/Models/User.php
git commit -m "Add user authentication

- Implement login/register methods in AuthController
- Add JWT token generation
- Add password hashing with bcrypt
- Add email validation

Refs: PROJ-123"

# Отдельный commit для миграции
git add database/migrations/2024_01_01_create_users_table.php
git commit -m "Add users table migration

- Add email, password, name fields
- Add unique constraint on email
- Add timestamps

Refs: PROJ-123"

# Правила для commit message:
# 1. Первая строка — краткое описание (до 50 символов)
# 2. Пустая строка
# 3. Детальное описание (что и зачем)
# 4. Ссылка на issue/ticket
```
</details>

### Задание 3: Восстанови удалённый файл

Ты случайно удалил важный файл CommandController.php и уже закоммитил. Восстанови его из истории.

<details>
<summary>Решение</summary>

```bash
# 1. Найти commit где файл был удалён
git log --oneline -- app/Http/Controllers/CommandController.php

# Выведет:
# abc123 Remove old controller
# def456 Add command functionality
# ...

# 2. Посмотреть содержимое файла до удаления
git show def456:app/Http/Controllers/CommandController.php

# 3. Восстановить файл из предыдущего commit
git checkout def456 -- app/Http/Controllers/CommandController.php

# 4. Закоммитить восстановление
git add app/Http/Controllers/CommandController.php
git commit -m "Restore CommandController.php

File was accidentally deleted in commit abc123.
Restored from commit def456."

# Альтернатива: восстановить из последнего состояния
git checkout HEAD~1 -- app/Http/Controllers/CommandController.php

# Найти когда файл был удалён
git rev-list -n 1 HEAD -- app/Http/Controllers/CommandController.php
# Вернёт commit где файл последний раз существовал
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
