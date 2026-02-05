# 11.2 Branching и Merge Strategies

## Краткое резюме

> **Branching** — создание изоляированных веток для разработки функций без влияния на main.
>
> **Merge strategies:** Fast-forward (прямая линия), Three-way merge (merge commit), Squash (сжатие коммитов).
>
> **Naming:** feature/, bugfix/, hotfix/, release/ для разных типов веток.

---

## Содержание

- [Что это](#что-это)
- [Работа с ветками](#работа-с-ветками)
- [Merge Strategies](#merge-strategies)
- [Naming Conventions](#naming-conventions)
- [Практические примеры](#практические-примеры)
- [Сравнение стратегий](#сравнение-стратегий)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Branching — создание отдельных веток для разработки функций. Merge strategies — способы объединения веток.

**Типы merge:**
- Fast-forward (простое слияние)
- Three-way merge (слияние с commit)
- Squash merge (сжатие коммитов)

---

## Работа с ветками

**Создание и переключение:**

```bash
# Создать ветку
git branch feature/new-api

# Переключиться на ветку
git checkout feature/new-api

# Создать и переключиться одной командой
git checkout -b feature/new-api

# Посмотреть все ветки
git branch -a

# Удалить ветку (локально)
git branch -d feature/new-api

# Удалить ветку (force)
git branch -D feature/new-api

# Удалить ветку на сервере
git push origin --delete feature/new-api
```

**Переименование ветки:**

```bash
# Переименовать текущую ветку
git branch -m new-name

# Переименовать другую ветку
git branch -m old-name new-name
```

---

## Merge Strategies

**Fast-forward (по умолчанию):**

```bash
# main: A---B
# feature:     C---D

git checkout main
git merge feature/new-api

# Результат: A---B---C---D (прямая линия)
```

Fast-forward происходит когда в main не было новых коммитов.

**Three-way merge:**

```bash
# main: A---B---E
# feature:     C---D

git checkout main
git merge feature/new-api

# Результат:
# A---B---E---M
#      \     /
#       C---D
# M = merge commit
```

**Squash merge (сжатие):**

```bash
# main: A---B
# feature:     C---D---E

git checkout main
git merge --squash feature/new-api
git commit -m "Add new API (squashed)"

# Результат: A---B---F
# F содержит все изменения из C, D, E
```

**No fast-forward:**

```bash
# Всегда создавать merge commit
git merge --no-ff feature/new-api

# Полезно для истории: видно где началась и закончилась ветка
```

---

## Naming Conventions

**Префиксы для веток:**

```bash
# Новая функция
feature/user-authentication
feature/payment-integration

# Исправление бага
bugfix/login-error
fix/memory-leak

# Hotfix (срочное исправление в production)
hotfix/security-patch
hotfix/critical-bug

# Релиз
release/v1.2.0
release/2024-01-15

# Эксперимент
experiment/new-architecture
spike/performance-test

# Рефакторинг
refactor/database-queries
```

---

## Практические примеры

**Feature branch workflow:**

```bash
# 1. Создать ветку от main
git checkout main
git pull origin main
git checkout -b feature/add-comments

# 2. Работать в ветке
git add .
git commit -m "Add comment model"
git commit -m "Add comment controller"
git commit -m "Add comment views"

# 3. Отправить на сервер
git push origin feature/add-comments

# 4. Обновить из main (если main изменился)
git checkout main
git pull origin main
git checkout feature/add-comments
git merge main  # или git rebase main

# 5. Создать Pull Request на GitHub/GitLab

# 6. После ревью — смержить в main
git checkout main
git merge --no-ff feature/add-comments
git push origin main

# 7. Удалить ветку
git branch -d feature/add-comments
git push origin --delete feature/add-comments
```

**Hotfix workflow:**

```bash
# 1. Создать hotfix от main
git checkout main
git checkout -b hotfix/security-fix

# 2. Исправить проблему
git add .
git commit -m "Fix security vulnerability"

# 3. Merge в main
git checkout main
git merge --no-ff hotfix/security-fix
git tag v1.2.1
git push origin main --tags

# 4. Merge в develop (если есть)
git checkout develop
git merge --no-ff hotfix/security-fix
git push origin develop

# 5. Удалить ветку
git branch -d hotfix/security-fix
```

**Конфликты при merge:**

```bash
git checkout main
git merge feature/new-api

# CONFLICT в app/Controllers/ApiController.php
# Auto-merging app/Controllers/ApiController.php
# CONFLICT (content): Merge conflict in app/Controllers/ApiController.php

# 1. Посмотреть конфликтующие файлы
git status

# 2. Открыть файл, исправить
# <<<<<<< HEAD
# код из main
# =======
# код из feature
# >>>>>>> feature/new-api

# 3. Добавить исправленный файл
git add app/Controllers/ApiController.php

# 4. Завершить merge
git commit -m "Merge feature/new-api into main"

# Отменить merge (если что-то пошло не так)
git merge --abort
```

**Cherry-pick (взять конкретный commit):**

```bash
# Взять commit abc123 из другой ветки
git cherry-pick abc123

# Взять несколько коммитов
git cherry-pick abc123 def456

# Cherry-pick с конфликтами
git cherry-pick abc123
# ... исправить конфликты ...
git add .
git cherry-pick --continue
```

---

## Сравнение стратегий

**Fast-forward:**
- Чистая история (прямая линия)
- Не видно где была ветка
- Подходит для простых изменений

**No fast-forward:**
- Merge commit сохраняет историю ветки
- Видно где началась и закончилась feature
- Подходит для feature branches

**Squash:**
- Один commit вместо множества
- Чистая история в main
- Теряется детальная история feature
- Подходит для мелких PR

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Branching — изоляция изменений в отдельных ветках
- Позволяет работать параллельно над разными задачами
- Feature branch workflow — создать ветку, работать, merge обратно

**Naming conventions:**
- `feature/` — новая функция
- `bugfix/` — исправление бага
- `hotfix/` — срочное исправление production
- `release/` — подготовка релиза

**Merge strategies:**
- **Fast-forward** — прямая линия (когда main не изменился)
- **Three-way merge** — создаёт merge commit
- **Squash** — сжимает все коммиты в один
- `--no-ff` — всегда создаёт merge commit (для истории)

**Конфликты:**
- Решаются вручную через редактирование файла
- `git add` + `git commit` для завершения
- `git merge --abort` для отмены

**Cherry-pick:**
- Копирование конкретных коммитов между ветками
- `git cherry-pick <commit-hash>`

---

## Практические задания

### Задание 1: Hotfix в production

В production критический баг. Создай hotfix, исправь, merge в main и develop.

<details>
<summary>Решение</summary>

```bash
# 1. Проверить что на main
git checkout main
git pull origin main

# 2. Создать hotfix ветку
git checkout -b hotfix/critical-payment-bug

# 3. Исправить баг
# Редактируем app/Services/PaymentService.php
git add app/Services/PaymentService.php
git commit -m "Fix critical payment processing bug

Issue: Payment was not being processed for amounts > 1000
Solution: Fix decimal precision in PaymentService

Refs: BUG-456"

# 4. Запушить hotfix
git push origin hotfix/critical-payment-bug

# 5. Merge в main
git checkout main
git merge --no-ff hotfix/critical-payment-bug

# 6. Создать тег для релиза
git tag -a v1.2.1 -m "Hotfix: Critical payment bug"
git push origin main --tags

# 7. Merge в develop (чтобы баг не вернулся)
git checkout develop
git pull origin develop
git merge --no-ff hotfix/critical-payment-bug
git push origin develop

# 8. Удалить hotfix ветку
git branch -d hotfix/critical-payment-bug
git push origin --delete hotfix/critical-payment-bug

# 9. Deploy в production
# (через CI/CD или вручную)
```
</details>

### Задание 2: Squash множественных WIP коммитов

У тебя feature ветка с 10 коммитами: "WIP", "fix", "typo". Squash их перед PR.

<details>
<summary>Решение</summary>

```bash
# Текущие коммиты:
git log --oneline
# abc123 fix typo
# def456 WIP
# ghi789 add tests
# jkl012 fix
# mno345 Add user profile feature
# ... (ещё 5 коммитов)

# Вариант 1: Interactive rebase (рекомендуется)
git rebase -i HEAD~10

# Откроется редактор:
pick mno345 Add user profile feature
fixup jkl012 fix
fixup ghi789 add tests
fixup def456 WIP
fixup abc123 fix typo
# ... остальные fixup

# Сохранить и выйти
# Результат: 1 чистый commit

# Force push (т.к. переписали историю)
git push --force-with-lease origin feature/user-profile

# Вариант 2: Squash merge (проще)
git checkout main
git merge --squash feature/user-profile
git commit -m "Add user profile feature

- Add profile page
- Add avatar upload
- Add profile edit form
- Add validation
- Add tests

Refs: FEAT-123"

# Вариант 3: Soft reset + новый commit
git reset --soft HEAD~10
git commit -m "Add user profile feature

Complete implementation with tests and validation.

Refs: FEAT-123"
git push --force-with-lease origin feature/user-profile
```
</details>

### Задание 3: Cherry-pick commit в release ветку

В develop есть важный bugfix (commit abc123). Нужно добавить его в release/v1.2 без всего остального.

<details>
<summary>Решение</summary>

```bash
# 1. Найти нужный commit в develop
git checkout develop
git log --oneline --grep="bugfix"

# Нашли: abc123 Fix validation bug in LoginController

# 2. Переключиться на release ветку
git checkout release/v1.2

# 3. Cherry-pick commit
git cherry-pick abc123

# Если нет конфликтов — готово
git push origin release/v1.2

# 4. Если есть конфликты
# CONFLICT в app/Http/Controllers/LoginController.php

# Открыть файл, исправить конфликты
# <<<<<<< HEAD
# код из release
# =======
# код из cherry-pick
# >>>>>>>

# Разрешить конфликт
git add app/Http/Controllers/LoginController.php
git cherry-pick --continue

# 5. Запушить
git push origin release/v1.2

# Альтернатива: cherry-pick несколько коммитов
git cherry-pick abc123 def456 ghi789

# Или диапазон коммитов
git cherry-pick abc123..ghi789

# Отменить cherry-pick если что-то пошло не так
git cherry-pick --abort
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
