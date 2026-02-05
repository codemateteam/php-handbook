# 11.3 Rebase vs Merge

## Краткое резюме

> **Merge** — объединяет ветки, создавая merge commit. Сохраняет историю.
>
> **Rebase** — переносит коммиты на новую базу. Линейная история.
>
> **Правило:** НИКОГДА не rebase public ветки (main, develop). Только для личных веток.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Merge](#merge)
- [Rebase](#rebase)
- [Interactive Rebase](#interactive-rebase)
- [Когда использовать](#когда-использовать)
- [Практические примеры](#практические-примеры)
- [Force push](#force-push)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Merge:**
Объединяет ветки, создавая merge commit. Сохраняет всю историю.

**Rebase:**
Переносит коммиты на новую базу. Переписывает историю для линейности.

---

## Как работает

**Merge:**

```bash
# До merge:
# main:    A---B---C
# feature:      \---D---E

git checkout main
git merge feature

# После merge:
# main:    A---B---C-------M
#               \         /
#                \---D---E
# M = merge commit
```

**Rebase:**

```bash
# До rebase:
# main:    A---B---C
# feature:      \---D---E

git checkout feature
git rebase main

# После rebase:
# main:    A---B---C
# feature:            \---D'---E'
# D', E' — новые коммиты (перебазированные)

# Затем merge будет fast-forward:
git checkout main
git merge feature

# Результат:
# main:    A---B---C---D'---E' (прямая линия)
```

---

## Merge

**Плюсы:**
- Сохраняет полную историю
- Безопасно (не переписывает коммиты)
- Показывает когда были слияния

**Минусы:**
- Много merge commits (грязная история)
- Сложный граф

**Использование:**

```bash
# Обычный merge
git checkout main
git merge feature

# Merge без fast-forward (всегда создавать merge commit)
git merge --no-ff feature

# Squash merge (все коммиты в один)
git merge --squash feature
git commit -m "Add feature X"
```

---

## Rebase

**Плюсы:**
- Линейная история (чистая)
- Легко читать git log
- Нет лишних merge commits

**Минусы:**
- Переписывает историю (опасно для shared веток)
- Может потерять контекст

**Использование:**

```bash
# Rebase на main
git checkout feature
git rebase main

# Interactive rebase (редактировать коммиты)
git rebase -i HEAD~3

# Continue после исправления конфликтов
git add .
git rebase --continue

# Отменить rebase
git rebase --abort

# Force push (нужен после rebase)
git push --force-with-lease origin feature
```

---

## Interactive Rebase

**Редактирование коммитов:**

```bash
git rebase -i HEAD~3

# Откроется редактор:
pick abc123 Add login
pick def456 Fix typo
pick ghi789 Update tests

# Команды:
# pick   — оставить как есть
# reword — изменить commit message
# edit   — изменить commit
# squash — объединить с предыдущим
# fixup  — squash без сохранения message
# drop   — удалить commit

# Пример: squash 3 коммита в один
pick abc123 Add login
squash def456 Fix typo
squash ghi789 Update tests

# Сохранить и выйти
# Откроется редактор для нового commit message
```

**Практический пример:**

```bash
# У тебя 5 коммитов:
# - Add user model
# - Fix typo
# - Add tests
# - Fix test
# - Update readme

git rebase -i HEAD~5

# Сжать в 3 осмысленных:
pick abc123 Add user model
fixup def456 Fix typo
pick ghi789 Add tests
fixup jkl012 Fix test
pick mno345 Update readme

# Результат:
# - Add user model (с исправленной опечаткой)
# - Add tests (с исправлением)
# - Update readme
```

---

## Когда использовать

**Merge для:**
- Public/shared ветки (main, develop)
- Сохранение полной истории
- Feature ветки в команде

**Rebase для:**
- Личные ветки (до push)
- Чистка истории перед PR
- Обновление feature ветки из main

**Правило золотое:**
❌ **НИКОГДА не делай rebase public веток (main, develop)**
✅ Rebase только для своих локальных веток

---

## Практические примеры

**Обновить feature из main (merge):**

```bash
git checkout feature
git merge main

# Плюсы: безопасно, сохраняет историю
# Минусы: merge commit в feature
```

**Обновить feature из main (rebase):**

```bash
git checkout feature
git rebase main

# Плюсы: линейная история
# Минусы: нужен force push если уже был push
```

**Очистить историю перед PR:**

```bash
# У тебя 10 commits: "WIP", "fix", "typo", etc.

git rebase -i HEAD~10

# Squash в 2-3 осмысленных коммита:
pick abc123 Add user authentication
fixup def456 WIP
fixup ghi789 fix
fixup jkl012 typo
pick mno345 Add tests
fixup pqr678 fix tests

# Результат: 2 чистых коммита
git push --force-with-lease origin feature
```

**Rebase с конфликтами:**

```bash
git rebase main

# CONFLICT в app/Controller.php
# ... исправить конфликты ...

git add app/Controller.php
git rebase --continue

# Если ещё конфликты — повторить
# Если хочешь отменить
git rebase --abort
```

---

## Force push

**После rebase нужен force push:**

```bash
# ❌ Опасно (может перезаписать чужие изменения)
git push --force origin feature

# ✅ Безопаснее (не перезапишет если кто-то уже push-нул)
git push --force-with-lease origin feature

# --force-with-lease проверяет что remote ветка не изменилась
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Merge:**
- Объединяет ветки, создаёт merge commit
- Сохраняет всю историю изменений
- Безопасно для shared веток
- Может создать сложный граф коммитов

**Rebase:**
- Переносит коммиты на новую базу
- Создаёт линейную историю
- Переписывает историю (меняет commit hashes)
- Опасно для public веток

**Когда использовать:**
- **Merge** — для shared веток (main, develop), сохранения истории
- **Rebase** — для личных веток, чистки истории перед PR

**Interactive rebase:**
- `git rebase -i HEAD~N` для редактирования коммитов
- **pick** — оставить, **squash** — объединить, **reword** — изменить message
- **fixup** — squash без сохранения message, **drop** — удалить

**Force push:**
- После rebase нужен force push
- `--force-with-lease` безопаснее чем `--force`
- Проверяет что remote не изменился

**Золотое правило:**
- НИКОГДА не rebase public/shared ветки
- Только для личных веток до merge в main

---

## Практические задания

### Задание 1: Rebase feature ветки на main

У тебя feature ветка с 5 коммитами. Main ушёл вперёд. Rebase feature на main для линейной истории.

<details>
<summary>Решение</summary>

```bash
# Текущее состояние:
# main:    A---B---C---D (origin изменился)
# feature:      \---E---F---G---H---I (твои коммиты)

# 1. Обновить main
git checkout main
git pull origin main

# 2. Переключиться на feature
git checkout feature

# 3. Rebase на main
git rebase main

# Если нет конфликтов:
# feature:                D---E'---F'---G'---H'---I'
# (коммиты перенесены на актуальный main)

# 4. Force push (т.к. переписали историю)
git push --force-with-lease origin feature

# Если есть конфликты:
# CONFLICT в app/Controller.php

# Открыть файл, исправить конфликты
# <<<<<<< HEAD
# код из main
# =======
# твой код
# >>>>>>>

# Разрешить конфликт
git add app/Controller.php
git rebase --continue

# Если конфликты в следующих коммитах — повторить
# Отменить rebase если запутался
git rebase --abort

# После успешного rebase
git push --force-with-lease origin feature

# Проверить результат
git log --graph --oneline --all
```
</details>

### Задание 2: Squash commits через interactive rebase

У тебя 7 коммитов в feature ветке. Нужно squash их в 2 логических коммита перед PR.

<details>
<summary>Решение</summary>

```bash
# Текущие коммиты:
git log --oneline
# abc123 Update readme
# def456 Fix test typo
# ghi789 Add tests
# jkl012 Fix validation
# mno345 Add validation
# pqr678 Fix user model
# stu901 Add user model

# Цель: 2 коммита
# 1. Add user model with validation
# 2. Add tests and update readme

# 1. Запустить interactive rebase
git rebase -i HEAD~7

# 2. Откроется редактор:
pick stu901 Add user model
fixup pqr678 Fix user model
pick mno345 Add validation
fixup jkl012 Fix validation
pick ghi789 Add tests
fixup def456 Fix test typo
pick abc123 Update readme

# 3. Изменить на:
pick stu901 Add user model
squash pqr678 Fix user model
squash mno345 Add validation
squash jkl012 Fix validation
pick ghi789 Add tests
squash def456 Fix test typo
squash abc123 Update readme

# Сохранить и выйти

# 4. Откроется редактор для первого commit message:
# Удалить весь текст и написать:
Add user model with validation

- Implement User model
- Add email and password validation
- Add unique email constraint

Refs: FEAT-456

# Сохранить и выйти

# 5. Откроется редактор для второго commit message:
Add tests and documentation

- Add user model tests
- Add validation tests
- Update README with user model usage

Refs: FEAT-456

# 6. Результат:
git log --oneline
# xyz789 Add tests and documentation
# abc456 Add user model with validation

# 7. Force push
git push --force-with-lease origin feature

# Альтернатива: одной командой с reword
git rebase -i HEAD~7
# В редакторе:
pick stu901 Add user model
fixup pqr678 Fix user model
fixup mno345 Add validation
fixup jkl012 Fix validation
reword ghi789 Add tests
fixup def456 Fix test typo
fixup abc123 Update readme
```
</details>

### Задание 3: Отмени rebase и восстанови ветку

Ты сделал rebase, запутался в конфликтах, всё сломалось. Отмени rebase и восстанови ветку.

<details>
<summary>Решение</summary>

```bash
# Ситуация: в процессе rebase, много конфликтов

# Вариант 1: Отменить текущий rebase
git rebase --abort

# Ветка вернётся в состояние до rebase
git log --oneline
# Всё как было

# Вариант 2: Если уже завершил rebase и push, но всё сломалось
# (и хочешь вернуться к старому состоянию)

# 1. Найти commit до rebase через reflog
git reflog
# abc123 HEAD@{0}: rebase finished: ...
# def456 HEAD@{1}: rebase: ...
# ghi789 HEAD@{2}: checkout: moving from feature to main
# jkl012 HEAD@{3}: commit: My last good commit

# 2. Сбросить ветку на последний хороший commit
git reset --hard HEAD@{3}
# или
git reset --hard jkl012

# 3. Force push восстановленную ветку
git push --force-with-lease origin feature

# Вариант 3: Если remote ветка ещё хорошая
git reset --hard origin/feature
git log --oneline
# Ветка восстановлена из remote

# Полезные команды для отладки:
# Посмотреть все изменения в reflog
git reflog --date=relative

# Посмотреть конкретный commit из reflog
git show HEAD@{5}

# Создать backup ветку перед опасными операциями
git branch backup-feature
# Теперь можно смело экспериментировать, backup сохранён

# Восстановить из backup
git checkout backup-feature
git branch -D feature
git checkout -b feature
git push --force-with-lease origin feature
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
