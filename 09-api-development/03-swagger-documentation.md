# 9.3 Swagger / API Documentation

## Краткое резюме

> **Swagger (OpenAPI)** — стандарт документирования API с интерактивной документацией.
>
> **Laravel:** l5-swagger пакет, аннотации @OA\Get/@OA\Post в контроллерах, Schema для моделей.
>
> **Доступ:** /api/documentation для тестирования API в браузере.

---

## Содержание

- [Что это](#что-это)
- [Установка и настройка](#установка-и-настройка)
- [Аннотации](#аннотации)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
Swagger (OpenAPI) — стандарт документирования API. Интерактивная документация, автоматическая генерация.

**Зачем нужна:**
- Документация для разработчиков
- Тестирование API
- Генерация клиентов

---

## Установка и настройка

**Установка:**

```bash
composer require darkaonline/l5-swagger
php artisan vendor:publish --provider="L5Swagger\L5SwaggerServiceProvider"
php artisan l5-swagger:generate
```

**Конфигурация (config/l5-swagger.php):**

```php
'api' => [
    'title' => 'My API Documentation',
],
'routes' => [
    'api' => 'api/documentation',
],
'paths' => [
    'annotations' => [
        base_path('app/Http/Controllers'),
    ],
],
```

---

## Аннотации

### Базовая информация

```php
/**
 * @OA\Info(
 *     title="My API",
 *     version="1.0.0",
 *     description="API Documentation"
 * )
 */
```

### GET запрос

```php
/**
 * @OA\Get(
 *     path="/api/posts",
 *     summary="Get all posts",
 *     tags={"Posts"},
 *     @OA\Parameter(
 *         name="page",
 *         in="query",
 *         description="Page number",
 *         required=false,
 *         @OA\Schema(type="integer")
 *     ),
 *     @OA\Response(
 *         response=200,
 *         description="Success",
 *         @OA\JsonContent(
 *             @OA\Property(property="data", type="array",
 *                 @OA\Items(ref="#/components/schemas/Post")
 *             )
 *         )
 *     )
 * )
 */
public function index() {}
```

### POST запрос

```php
/**
 * @OA\Post(
 *     path="/api/posts",
 *     summary="Create post",
 *     tags={"Posts"},
 *     security={{"sanctum":{}}},
 *     @OA\RequestBody(
 *         required=true,
 *         @OA\JsonContent(
 *             required={"title","body"},
 *             @OA\Property(property="title", type="string"),
 *             @OA\Property(property="body", type="string")
 *         )
 *     ),
 *     @OA\Response(response=201, description="Created")
 * )
 */
public function store() {}
```

### Schema определения

```php
/**
 * @OA\Schema(
 *     schema="Post",
 *     type="object",
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="title", type="string"),
 *     @OA\Property(property="body", type="string"),
 *     @OA\Property(property="created_at", type="string", format="date-time")
 * )
 */
```

### Security Scheme

```php
/**
 * @OA\SecurityScheme(
 *     type="http",
 *     securityScheme="sanctum",
 *     scheme="bearer",
 *     bearerFormat="JWT"
 * )
 */
```

---

## Когда использовать

**Используй документацию для:**
- Публичные API
- API для фронтенда
- API для партнёров
- Микросервисная архитектура

---

## Пример из практики

### Полная документация контроллера

```php
/**
 * @OA\SecurityScheme(
 *     type="http",
 *     securityScheme="sanctum",
 *     scheme="bearer",
 *     bearerFormat="JWT"
 * )
 */

/**
 * @OA\Tag(name="Posts", description="Posts management")
 * @OA\Tag(name="Auth", description="Authentication")
 */
class Controller {}

class PostController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/posts",
     *     summary="List posts",
     *     tags={"Posts"},
     *     @OA\Parameter(
     *         name="filter[status]",
     *         in="query",
     *         @OA\Schema(type="string", enum={"draft", "published"})
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Success",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Post")),
     *             @OA\Property(property="links", type="object"),
     *             @OA\Property(property="meta", type="object")
     *         )
     *     )
     * )
     */
    public function index() {}
}
```

**Доступ к документации:**

```
http://localhost/api/documentation
```

---

## На собеседовании скажешь

**Структурированный ответ:**

**Что это:**
- Swagger (OpenAPI) — стандарт документирования API
- Интерактивная документация с возможностью тестирования

**Laravel установка:**
- `composer require darkaonline/l5-swagger`
- `php artisan l5-swagger:generate`

**Основные аннотации:**
- `@OA\Info` — общая информация об API
- `@OA\Get/@OA\Post` — эндпоинты
- `@OA\Schema` — модели данных
- `@OA\SecurityScheme` — аутентификация

**Преимущества:**
- Живая документация
- Тестирование API в браузере
- Генерация клиентов
- Всегда актуальная (генерируется из кода)

---

## Практические задания

### Задание 1: Документировать CRUD API

Создай Swagger документацию для Article API с полным CRUD.

<details>
<summary>Решение</summary>

```php
/**
 * @OA\Schema(
 *     schema="Article",
 *     type="object",
 *     required={"title", "body"},
 *     @OA\Property(property="id", type="integer", example=1),
 *     @OA\Property(property="title", type="string", example="My Article"),
 *     @OA\Property(property="body", type="string", example="Article content..."),
 *     @OA\Property(property="status", type="string", enum={"draft", "published"}),
 *     @OA\Property(property="published_at", type="string", format="date-time", nullable=true),
 *     @OA\Property(property="created_at", type="string", format="date-time"),
 *     @OA\Property(property="updated_at", type="string", format="date-time")
 * )
 */

class ArticleController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/articles",
     *     summary="List articles",
     *     tags={"Articles"},
     *     @OA\Parameter(name="page", in="query", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="filter[status]", in="query", @OA\Schema(type="string")),
     *     @OA\Response(
     *         response=200,
     *         description="Success",
     *         @OA\JsonContent(
     *             @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Article"))
     *         )
     *     )
     * )
     */
    public function index() {}

    /**
     * @OA\Post(
     *     path="/api/articles",
     *     summary="Create article",
     *     tags={"Articles"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"title", "body"},
     *             @OA\Property(property="title", type="string"),
     *             @OA\Property(property="body", type="string"),
     *             @OA\Property(property="status", type="string", enum={"draft", "published"})
     *         )
     *     ),
     *     @OA\Response(response=201, description="Created", @OA\JsonContent(ref="#/components/schemas/Article")),
     *     @OA\Response(response=422, description="Validation error")
     * )
     */
    public function store() {}

    /**
     * @OA\Get(
     *     path="/api/articles/{id}",
     *     summary="Show article",
     *     tags={"Articles"},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(response=200, description="Success", @OA\JsonContent(ref="#/components/schemas/Article")),
     *     @OA\Response(response=404, description="Not found")
     * )
     */
    public function show() {}

    /**
     * @OA\Put(
     *     path="/api/articles/{id}",
     *     summary="Update article",
     *     tags={"Articles"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\RequestBody(
     *         @OA\JsonContent(
     *             @OA\Property(property="title", type="string"),
     *             @OA\Property(property="body", type="string")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Updated"),
     *     @OA\Response(response=404, description="Not found")
     * )
     */
    public function update() {}

    /**
     * @OA\Delete(
     *     path="/api/articles/{id}",
     *     summary="Delete article",
     *     tags={"Articles"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(response=204, description="Deleted"),
     *     @OA\Response(response=404, description="Not found")
     * )
     */
    public function destroy() {}
}
```
</details>

### Задание 2: Nested Resource документация

Документируй /articles/{article}/comments API.

<details>
<summary>Решение</summary>

```php
/**
 * @OA\Schema(
 *     schema="Comment",
 *     type="object",
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="article_id", type="integer"),
 *     @OA\Property(property="user_id", type="integer"),
 *     @OA\Property(property="body", type="string"),
 *     @OA\Property(property="created_at", type="string", format="date-time"),
 *     @OA\Property(property="user", ref="#/components/schemas/User")
 * )
 */

class CommentController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/articles/{article}/comments",
     *     summary="List article comments",
     *     tags={"Comments"},
     *     @OA\Parameter(
     *         name="article",
     *         in="path",
     *         required=true,
     *         description="Article ID",
     *         @OA\Schema(type="integer")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Success",
     *         @OA\JsonContent(
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *                 @OA\Items(ref="#/components/schemas/Comment")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=404, description="Article not found")
     * )
     */
    public function index(Article $article) {}

    /**
     * @OA\Post(
     *     path="/api/articles/{article}/comments",
     *     summary="Create comment",
     *     tags={"Comments"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="article", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"body"},
     *             @OA\Property(property="body", type="string", example="Great article!")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Created"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=404, description="Article not found")
     * )
     */
    public function store(Article $article) {}
}
```
</details>

### Задание 3: Документация с Enum и Examples

Добавь документацию с enum значениями и examples.

<details>
<summary>Решение</summary>

```php
/**
 * @OA\Schema(
 *     schema="Order",
 *     type="object",
 *     @OA\Property(
 *         property="status",
 *         type="string",
 *         enum={"pending", "processing", "shipped", "delivered", "cancelled"},
 *         example="processing"
 *     ),
 *     @OA\Property(
 *         property="payment_method",
 *         type="string",
 *         enum={"credit_card", "paypal", "bank_transfer"},
 *         example="credit_card"
 *     ),
 *     @OA\Property(property="total", type="number", format="float", example=99.99),
 *     @OA\Property(
 *         property="items",
 *         type="array",
 *         @OA\Items(
 *             type="object",
 *             @OA\Property(property="product_id", type="integer", example=1),
 *             @OA\Property(property="quantity", type="integer", example=2),
 *             @OA\Property(property="price", type="number", format="float", example=49.99)
 *         )
 *     )
 * )
 */

class OrderController extends Controller
{
    /**
     * @OA\Post(
     *     path="/api/orders",
     *     summary="Create order",
     *     tags={"Orders"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"items", "payment_method"},
     *             @OA\Property(
     *                 property="items",
     *                 type="array",
     *                 @OA\Items(
     *                     type="object",
     *                     @OA\Property(property="product_id", type="integer", example=1),
     *                     @OA\Property(property="quantity", type="integer", example=2)
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="payment_method",
     *                 type="string",
     *                 enum={"credit_card", "paypal", "bank_transfer"},
     *                 example="credit_card"
     *             ),
     *             example={
     *                 "items": {
     *                     {"product_id": 1, "quantity": 2},
     *                     {"product_id": 3, "quantity": 1}
     *                 },
     *                 "payment_method": "credit_card",
     *                 "shipping_address": {
     *                     "street": "123 Main St",
     *                     "city": "Moscow",
     *                     "country": "Russia"
     *                 }
     *             }
     *         )
     *     ),
     *     @OA\Response(
     *         response=201,
     *         description="Order created",
     *         @OA\JsonContent(ref="#/components/schemas/Order")
     *     ),
     *     @OA\Response(response=422, description="Validation error")
     * )
     */
    public function store() {}
}
```
</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
