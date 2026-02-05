# 16.1 Coding Challenges

## Типичные задачи на собеседованиях

### 1. Работа со строками

**Палиндром:**

```php
function isPalindrome(string $str): bool
{
    $str = strtolower(preg_replace('/[^a-z0-9]/i', '', $str));
    return $str === strrev($str);
}

// Тесты
isPalindrome('A man a plan a canal Panama'); // true
isPalindrome('racecar'); // true
isPalindrome('hello'); // false
```

**Анаграммы:**

```php
function areAnagrams(string $str1, string $str2): bool
{
    $str1 = strtolower(str_replace(' ', '', $str1));
    $str2 = strtolower(str_replace(' ', '', $str2));

    $chars1 = str_split($str1);
    $chars2 = str_split($str2);

    sort($chars1);
    sort($chars2);

    return $chars1 === $chars2;
}

// Тесты
areAnagrams('listen', 'silent'); // true
areAnagrams('hello', 'world'); // false
```

**Первый уникальный символ:**

```php
function firstUniqChar(string $s): int
{
    $counts = [];

    // Подсчёт
    for ($i = 0; $i < strlen($s); $i++) {
        $char = $s[$i];
        $counts[$char] = ($counts[$char] ?? 0) + 1;
    }

    // Найти первый с count = 1
    for ($i = 0; $i < strlen($s); $i++) {
        if ($counts[$s[$i]] === 1) {
            return $i;
        }
    }

    return -1;
}

// Тесты
firstUniqChar('leetcode'); // 0 ('l')
firstUniqChar('loveleetcode'); // 2 ('v')
```

---

### 2. Работа с массивами

**Два числа с суммой:**

```php
// Найти два числа, сумма которых = target
function twoSum(array $nums, int $target): array
{
    $map = [];

    foreach ($nums as $i => $num) {
        $complement = $target - $num;

        if (isset($map[$complement])) {
            return [$map[$complement], $i];
        }

        $map[$num] = $i;
    }

    return [];
}

// Тесты
twoSum([2, 7, 11, 15], 9); // [0, 1] (2 + 7 = 9)
twoSum([3, 2, 4], 6); // [1, 2] (2 + 4 = 6)
```

**Найти дубликаты:**

```php
function findDuplicates(array $arr): array
{
    $seen = [];
    $duplicates = [];

    foreach ($arr as $item) {
        if (isset($seen[$item])) {
            $duplicates[] = $item;
        }
        $seen[$item] = true;
    }

    return array_unique($duplicates);
}

// Тесты
findDuplicates([1, 2, 3, 2, 4, 5, 3]); // [2, 3]
```

**Rotate array:**

```php
function rotateArray(array $arr, int $k): array
{
    $n = count($arr);
    $k = $k % $n; // Handle k > n

    // Reverse all
    $arr = array_reverse($arr);
    // Reverse first k
    $part1 = array_reverse(array_slice($arr, 0, $k));
    // Reverse rest
    $part2 = array_reverse(array_slice($arr, $k));

    return array_merge($part1, $part2);
}

// Тесты
rotateArray([1, 2, 3, 4, 5], 2); // [4, 5, 1, 2, 3]
```

---

### 3. FizzBuzz (классика)

```php
function fizzBuzz(int $n): array
{
    $result = [];

    for ($i = 1; $i <= $n; $i++) {
        if ($i % 15 === 0) {
            $result[] = 'FizzBuzz';
        } elseif ($i % 3 === 0) {
            $result[] = 'Fizz';
        } elseif ($i % 5 === 0) {
            $result[] = 'Buzz';
        } else {
            $result[] = (string) $i;
        }
    }

    return $result;
}

// Output: 1, 2, Fizz, 4, Buzz, Fizz, 7, 8, Fizz, Buzz, 11, Fizz, 13, 14, FizzBuzz...
```

---

### 4. Валидация скобок

```php
function isValidParentheses(string $s): bool
{
    $stack = [];
    $pairs = [
        ')' => '(',
        '}' => '{',
        ']' => '['
    ];

    for ($i = 0; $i < strlen($s); $i++) {
        $char = $s[$i];

        if (in_array($char, ['(', '{', '['])) {
            // Открывающая скобка
            $stack[] = $char;
        } elseif (isset($pairs[$char])) {
            // Закрывающая скобка
            if (empty($stack) || array_pop($stack) !== $pairs[$char]) {
                return false;
            }
        }
    }

    return empty($stack);
}

// Тесты
isValidParentheses('()'); // true
isValidParentheses('()[]{}'); // true
isValidParentheses('(]'); // false
isValidParentheses('([)]'); // false
isValidParentheses('{[]}'); // true
```

---

### 5. Числа Фибоначчи

**Рекурсивно (медленно):**

```php
function fibRecursive(int $n): int
{
    if ($n <= 1) {
        return $n;
    }

    return fibRecursive($n - 1) + fibRecursive($n - 2);
}
// O(2^n) - очень медленно
```

**Итеративно (быстро):**

```php
function fib(int $n): int
{
    if ($n <= 1) {
        return $n;
    }

    $prev = 0;
    $curr = 1;

    for ($i = 2; $i <= $n; $i++) {
        $temp = $curr;
        $curr = $prev + $curr;
        $prev = $temp;
    }

    return $curr;
}
// O(n)
```

**С мемоизацией:**

```php
function fibMemo(int $n, array &$memo = []): int
{
    if ($n <= 1) {
        return $n;
    }

    if (isset($memo[$n])) {
        return $memo[$n];
    }

    $memo[$n] = fibMemo($n - 1, $memo) + fibMemo($n - 2, $memo);
    return $memo[$n];
}
// O(n) с O(n) памяти
```

---

### 6. Реверс строки/массива

```php
// Строка
function reverseString(string $s): string
{
    return strrev($s);
    // Или вручную:
    // return implode('', array_reverse(str_split($s)));
}

// Массив
function reverseArray(array $arr): array
{
    $left = 0;
    $right = count($arr) - 1;

    while ($left < $right) {
        $temp = $arr[$left];
        $arr[$left] = $arr[$right];
        $arr[$right] = $temp;

        $left++;
        $right--;
    }

    return $arr;
}
```

---

### 7. Laravel специфичные задачи

**Найти users с > N заказами:**

```php
// За последний месяц с более чем 10 заказами
User::has('orders', '>', 10)
    ->whereHas('orders', function ($query) {
        $query->where('created_at', '>=', now()->subMonth());
    })
    ->get();
```

**Топ 5 продуктов:**

```php
Product::withCount('orderItems')
    ->orderBy('order_items_count', 'desc')
    ->limit(5)
    ->get();
```

**Средняя сумма заказа по пользователю:**

```php
User::select('users.id', 'users.name')
    ->selectRaw('AVG(orders.total) as avg_order_value')
    ->join('orders', 'users.id', '=', 'orders.user_id')
    ->groupBy('users.id', 'users.name')
    ->having('avg_order_value', '>', 100)
    ->get();
```

---

### 8. Алгоритмы сортировки

**Bubble Sort:**

```php
function bubbleSort(array $arr): array
{
    $n = count($arr);

    for ($i = 0; $i < $n - 1; $i++) {
        for ($j = 0; $j < $n - $i - 1; $j++) {
            if ($arr[$j] > $arr[$j + 1]) {
                // Swap
                $temp = $arr[$j];
                $arr[$j] = $arr[$j + 1];
                $arr[$j + 1] = $temp;
            }
        }
    }

    return $arr;
}
// O(n²)
```

**Quick Sort:**

```php
function quickSort(array $arr): array
{
    if (count($arr) <= 1) {
        return $arr;
    }

    $pivot = $arr[0];
    $left = $right = [];

    for ($i = 1; $i < count($arr); $i++) {
        if ($arr[$i] < $pivot) {
            $left[] = $arr[$i];
        } else {
            $right[] = $arr[$i];
        }
    }

    return array_merge(
        quickSort($left),
        [$pivot],
        quickSort($right)
    );
}
// Average O(n log n)
```

---

### 9. Бинарный поиск

```php
function binarySearch(array $arr, int $target): int
{
    $left = 0;
    $right = count($arr) - 1;

    while ($left <= $right) {
        $mid = floor(($left + $right) / 2);

        if ($arr[$mid] === $target) {
            return $mid;
        }

        if ($arr[$mid] < $target) {
            $left = $mid + 1;
        } else {
            $right = $mid - 1;
        }
    }

    return -1; // Не найдено
}

// Тесты
binarySearch([1, 3, 5, 7, 9, 11], 7); // 3
binarySearch([1, 3, 5, 7, 9, 11], 6); // -1
```

---

### 10. Максимум/минимум в массиве

```php
function findMax(array $arr): ?int
{
    if (empty($arr)) {
        return null;
    }

    $max = $arr[0];

    foreach ($arr as $num) {
        if ($num > $max) {
            $max = $num;
        }
    }

    return $max;
}

// Или встроенная функция
$max = max($arr);
$min = min($arr);
```

---

## Советы для решения задач

**Процесс:**

```
1. Уточни задачу
   "Строка может быть пустой?"
   "Учитывать регистр?"

2. Придумай примеры
   Input: "hello"
   Output: "olleh"

   Edge cases:
   - Пустая строка: ""
   - Один символ: "a"
   - Спецсимволы: "a-b-c"

3. Обсуди подход
   "Можно решить через array reverse
    или два указателя"

4. Напиши код
   Начни с простого решения

5. Тестируй
   Проверь на edge cases

6. Оптимизируй
   Можно улучшить сложность?
```

**Сложность алгоритмов:**

```
O(1) - константная:
  array access, hash lookup

O(log n) - логарифмическая:
  binary search

O(n) - линейная:
  foreach, array_map

O(n log n):
  merge sort, quick sort (average)

O(n²):
  nested loops, bubble sort

O(2^n):
  recursive fibonacci (без memo)
```

---

## На собеседовании скажешь

> "Coding challenges: палиндромы, анаграммы, два числа с суммой, FizzBuzz, валидация скобок, Фибоначчи. Для строк: strrev, preg_replace. Для массивов: два указателя, hash map. Laravel: whereHas, withCount, selectRaw. Сортировки: bubble O(n²), quick O(n log n). Бинарный поиск O(log n). Процесс: уточнить, примеры, edge cases, код, тесты, оптимизация. Сложность: O(1), O(n), O(n log n), O(n²)."

