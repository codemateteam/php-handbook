# 11.4 Git Flow

## Краткое резюме

> **Git Flow** — branching model для управления релизами в больших проектах.
>
> **Структура:** main (production), develop (разработка), feature/ (функции), release/ (подготовка релиза), hotfix/ (срочные исправления).
>
> **Workflow:** feature → develop → release → main. Hotfix → main + develop.

---

## Содержание

- [Что это](#что-это)
- [Структура веток](#структура-веток)
- [Workflow](#workflow)
- [Пример проекта](#пример-проекта)
- [Альтернативы](#альтернативы)
- [Когда использовать](#когда-использовать)
- [Практические советы](#практические-советы)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Git Flow — branching model для управления релизами. Структура веток для больших проектов.

**Основные ветки:**
- `main` (production)
- `develop` (разработка)
- `feature/*` (новые функции)
- `release/*` (подготовка релиза)
- `hotfix/*` (срочные исправления)

---

## Структура веток

**Постоянные ветки:**

```
main     — production код, только стабильные релизы
develop  — интеграция новых функций, следующий релиз
```

**Временные ветки:**

```
feature/*  — новые функции (от develop)
release/*  — подготовка релиза (от develop)
hotfix/*   — срочные исправления (от main)
```

**Схема:**

```
main:     v1.0 --------- v1.1 ----------- v1.2
            \            /  \            /
develop:     \--A--B--C----D--E--F--G--H---
                  \     /      \    /
feature/x:         F1--F2        F3-F4
```

---

## Workflow

**1. Feature (новая функция):**

```bash
# Создать feature от develop
git checkout develop
git pull origin develop
git checkout -b feature/user-profile

# Работать
git add .
git commit -m "Add profile page"
git commit -m "Add avatar upload"

# Merge обратно в develop
git checkout develop
git merge --no-ff feature/user-profile
git push origin develop

# Удалить ветку
git branch -d feature/user-profile
```

**2. Release (подготовка релиза):**

```bash
# Создать release от develop
git checkout develop
git checkout -b release/1.2.0

# Исправить баги, обновить версию
git commit -m "Bump version to 1.2.0"
git commit -m "Fix minor bugs"

# Merge в main (production)
git checkout main
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin main --tags

# Merge обратно в develop
git checkout develop
git merge --no-ff release/1.2.0
git push origin develop

# Удалить ветку
git branch -d release/1.2.0
```

**3. Hotfix (срочное исправление):**

```bash
# Создать hotfix от main
git checkout main
git checkout -b hotfix/security-fix

# Исправить
git commit -m "Fix security vulnerability"

# Merge в main
git checkout main
git merge --no-ff hotfix/security-fix
git tag -a v1.2.1 -m "Hotfix 1.2.1"
git push origin main --tags

# Merge в develop
git checkout develop
git merge --no-ff hotfix/security-fix
git push origin develop

# Удалить ветку
git branch -d hotfix/security-fix
```

---

## Пример проекта

**Инициализация Git Flow:**

```bash
# Установить git-flow (MacOS)
brew install git-flow

# Инициализация
git flow init

# Вопросы (можно оставить по умолчанию):
# - Production branch: main
# - Development branch: develop
# - Feature prefix: feature/
# - Release prefix: release/
# - Hotfix prefix: hotfix/
```

**Работа с feature:**

```bash
# Создать feature
git flow feature start user-auth

# Работать
git add .
git commit -m "Add authentication"

# Закончить feature (merge в develop)
git flow feature finish user-auth
```

**Работа с release:**

```bash
# Создать release
git flow release start 1.2.0

# Обновить версию, исправить баги
git commit -m "Bump version"

# Закончить release (merge в main и develop, создать tag)
git flow release finish 1.2.0
```

**Работа с hotfix:**

```bash
# Создать hotfix
git flow hotfix start 1.2.1

# Исправить баг
git commit -m "Fix critical bug"

# Закончить hotfix (merge в main и develop)
git flow hotfix finish 1.2.1
```

---

## Альтернативы

**GitHub Flow (упрощённый):**

```
main  — production
       \
feature — всегда от main, merge через PR
```

Проще Git Flow, подходит для continuous deployment.

**GitLab Flow:**

```
main → production → stable
```

Дополнительные environment ветки (staging, production).

**Trunk-Based Development:**

```
main  — все работают в main
       \
feature — короткие feature branches (1-2 дня)
```

Для команд с CI/CD, feature flags.

---

## Когда использовать

**Git Flow для:**
- Запланированные релизы
- Несколько версий в production
- Большая команда

**НЕ для:**
- Continuous deployment
- Маленькие проекты
- Solo разработка

---

## Практические советы

**Naming conventions:**

```bash
# Feature
feature/add-user-authentication
feature/update-payment-gateway

# Release
release/1.2.0
release/2024-Q1

# Hotfix
hotfix/fix-login-bug
hotfix/security-patch-1.2.1

# Bugfix (в develop)
bugfix/fix-email-validation
```

**Commit messages:**

```bash
# Feature
"Add user authentication feature"
"Implement JWT token generation"

# Release
"Bump version to 1.2.0"
"Update changelog for 1.2.0"

# Hotfix
"Fix critical security vulnerability in auth"
"Hotfix: Resolve memory leak in cache"
```

**Защита веток (GitHub/GitLab):**

```bash
# Settings → Branches → Branch protection rules

main:
✅ Require pull request reviews (1+)
✅ Require status checks to pass
✅ Require branches to be up to date
✅ No force push
✅ No deletion

develop:
✅ Require pull request reviews
⬜ Allow force push (для rebase)
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Git Flow — branching model для управления релизами
- Структурированный подход к версионированию
- Подходит для запланированных релизов

**Структура веток:**
- **main** — production код, стабильные релизы
- **develop** — интеграция функций, следующий релиз
- **feature/** — новые функции (от develop)
- **release/** — подготовка релиза (от develop)
- **hotfix/** — срочные исправления (от main)

**Workflow:**
- Feature → develop (новые функции)
- Release → main + develop (релиз)
- Hotfix → main + develop (срочное исправление)
- Теги для версий (v1.2.0)

**Альтернативы:**
- **GitHub Flow** — проще, одна main ветка, PR для features
- **Trunk-Based** — короткие ветки, feature flags
- Выбор зависит от процесса релизов

**Когда использовать:**
- Запланированные релизы (не continuous deployment)
- Большая команда (нужна структура)
- Несколько версий в production

---

## Практические задания

### Задание 1: Полный цикл релиза через Git Flow

Создай feature, merge в develop, создай release, merge в main и develop, добавь тег.

<details>
<summary>Решение</summary>

```bash
# Шаг 1: Инициализировать Git Flow (если ещё не сделано)
git flow init
# Оставить все по умолчанию

# Шаг 2: Создать feature
git flow feature start payment-integration
# Автоматически создаст ветку feature/payment-integration от develop

# Шаг 3: Работать над feature
echo "Payment integration code" > app/Services/PaymentService.php
git add app/Services/PaymentService.php
git commit -m "Add PaymentService with Stripe integration"

git add app/Controllers/PaymentController.php
git commit -m "Add payment controller"

git add tests/Feature/PaymentTest.php
git commit -m "Add payment integration tests"

# Шаг 4: Закончить feature
git flow feature finish payment-integration
# Автоматически:
# - merge в develop
# - удалит ветку feature/payment-integration
# - переключит на develop

# Шаг 5: Создать release
git flow release start 1.3.0
# Автоматически создаст ветку release/1.3.0 от develop

# Шаг 6: Подготовка релиза
# Обновить версию
echo "1.3.0" > version.txt
git add version.txt
git commit -m "Bump version to 1.3.0"

# Обновить CHANGELOG
echo "## 1.3.0\n- Add payment integration" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "Update CHANGELOG for 1.3.0"

# Исправить последние баги
git commit -m "Fix minor UI bugs before release"

# Шаг 7: Закончить release
git flow release finish 1.3.0
# Автоматически:
# - merge в main
# - создаст тег v1.3.0
# - merge обратно в develop
# - удалит ветку release/1.3.0

# Откроется редактор для tag message, написать:
Release version 1.3.0

- Payment integration with Stripe
- Bug fixes
- UI improvements

# Шаг 8: Push всё
git checkout main
git push origin main --tags

git checkout develop
git push origin develop

# Проверить результат
git log --graph --oneline --all --decorate
```
</details>

### Задание 2: Hotfix критического бага

В production обнаружен критический баг. Создай hotfix, исправь, merge в main и develop.

<details>
<summary>Решение</summary>

```bash
# Ситуация: Production на v1.3.0, критический баг в PaymentService

# Шаг 1: Создать hotfix от main
git checkout main
git pull origin main

git flow hotfix start 1.3.1
# Автоматически создаст ветку hotfix/1.3.1 от main

# Шаг 2: Исправить баг
# Редактируем app/Services/PaymentService.php
git add app/Services/PaymentService.php
git commit -m "Fix critical bug in payment validation

Issue: Payment validation was failing for amounts > 1000
Cause: Incorrect decimal handling
Solution: Use bcmath for precise calculations

Refs: BUG-789"

# Добавить тест для регрессии
git add tests/Feature/PaymentBugTest.php
git commit -m "Add regression test for payment bug"

# Обновить версию
echo "1.3.1" > version.txt
git add version.txt
git commit -m "Bump version to 1.3.1"

# Обновить CHANGELOG
echo "## 1.3.1 (Hotfix)\n- Fix payment validation bug" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "Update CHANGELOG for hotfix 1.3.1"

# Шаг 3: Закончить hotfix
git flow hotfix finish 1.3.1
# Автоматически:
# - merge в main
# - создаст тег v1.3.1
# - merge в develop (чтобы баг не вернулся)
# - удалит ветку hotfix/1.3.1

# Откроется редактор для tag message:
Hotfix 1.3.1: Critical payment bug fix

Critical bug fix for payment validation failing on amounts > 1000.

IMPORTANT: Deploy immediately to production.

# Шаг 4: Push всё
git checkout main
git push origin main --tags

git checkout develop
git push origin develop

# Шаг 5: Deploy в production (через CI/CD или вручную)
# Уведомить команду о hotfix

# Альтернатива без git-flow:
git checkout main
git checkout -b hotfix/1.3.1
# ... fixes ...
git checkout main
git merge --no-ff hotfix/1.3.1
git tag -a v1.3.1 -m "Hotfix message"
git checkout develop
git merge --no-ff hotfix/1.3.1
git push origin main develop --tags
```
</details>

### Задание 3: Несколько feature одновременно

У тебя 2 разработчика работают над разными feature. Управи их merge в develop без конфликтов.

<details>
<summary>Решение</summary>

```bash
# Ситуация:
# - Developer 1 работает над feature/user-profile
# - Developer 2 работает над feature/notifications

# === Developer 1 ===
# Шаг 1: Создать feature для профиля
git checkout develop
git pull origin develop
git flow feature start user-profile

# Работать
git add app/Controllers/ProfileController.php
git commit -m "Add profile controller"

git add app/Models/Profile.php
git commit -m "Add profile model"

git add resources/views/profile.blade.php
git commit -m "Add profile view"

# Закончить feature
git flow feature finish user-profile
# merge в develop

git push origin develop

# === Developer 2 (в то же время) ===
# Шаг 2: Создать feature для уведомлений
git checkout develop
git pull origin develop
git flow feature start notifications

# Работать
git add app/Notifications/UserNotification.php
git commit -m "Add user notification"

git add app/Controllers/NotificationController.php
git commit -m "Add notification controller"

# Шаг 3: Developer 1 уже запушил в develop
# Обновить feature ветку из develop перед finish
git checkout develop
git pull origin develop  # Получить изменения от Developer 1

git checkout feature/notifications
git rebase develop  # Перебазировать на актуальный develop

# Если конфликты — решить их:
# git add .
# git rebase --continue

# Закончить feature
git flow feature finish notifications
# merge в develop (уже с изменениями от Developer 1)

git push origin develop

# === Проверка результата ===
git checkout develop
git log --graph --oneline --all

# Должно быть:
# * merge feature/notifications
# |\
# | * Add notification controller
# | * Add user notification
# * | merge feature/user-profile
# |\|
# | * Add profile view
# | * Add profile model
# | * Add profile controller
# |/
# * (older develop commits)

# === Best practices для параллельной работы ===

# 1. Частые pull из develop
git checkout feature/my-feature
git fetch origin develop
git rebase origin/develop

# 2. Маленькие PR (1-2 дня работы)
# Меньше шансов на конфликты

# 3. Коммуникация
# "Я работаю в UserController.php" — в Slack/Discord

# 4. Разделение зон ответственности
# Developer 1: User module
# Developer 2: Notification module
# Минимум пересечений = минимум конфликтов

# 5. Code review перед merge
# Проверить что изменения не конфликтуют

# 6. CI/CD
# Автоматические тесты при merge в develop
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
