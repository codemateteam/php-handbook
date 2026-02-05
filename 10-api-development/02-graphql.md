# 9.2 GraphQL

## Краткое резюме

> **GraphQL** — язык запросов для API, где клиент указывает нужные поля.
>
> **Основное:** Один endpoint, Query для чтения, Mutation для изменения. Type определяет структуру, Resolve загружает данные.
>
> **Laravel:** `rebing/graphql-laravel` или Lighthouse. Schema-first vs Code-first подход.

---

## Содержание

- [Что это](#что-это)
- [Как работает](#как-работает)
- [Когда использовать](#когда-использовать)
- [Пример из практики](#пример-из-практики)
- [На собеседовании скажешь](#на-собеседовании-скажешь)
- [Практические задания](#практические-задания)

---

## Что это

**Что это:**
GraphQL — язык запросов для API. Клиент указывает, какие данные нужны. Одна endpoint, гибкие запросы.

**REST vs GraphQL:**
- REST: много endpoints, фиксированная структура
- GraphQL: один endpoint, гибкая структура

---

## Как работает

**Установка (Laravel):**

```bash
composer require rebing/graphql-laravel
php artisan vendor:publish --provider="Rebing\GraphQL\GraphQLServiceProvider"
```

**Простой GraphQL запрос:**

```graphql
# Запрос
query {
  user(id: 1) {
    id
    name
    email
    posts {
      id
      title
    }
  }
}

# Ответ
{
  "data": {
    "user": {
      "id": 1,
      "name": "John",
      "email": "john@example.com",
      "posts": [
        {"id": 1, "title": "First Post"},
        {"id": 2, "title": "Second Post"}
      ]
    }
  }
}
```

**Определение Type:**

```php
// app/GraphQL/Types/UserType.php
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Type as GraphQLType;

class UserType extends GraphQLType
{
    protected $attributes = [
        'name' => 'User',
        'description' => 'A user',
    ];

    public function fields(): array
    {
        return [
            'id' => [
                'type' => Type::nonNull(Type::int()),
            ],
            'name' => [
                'type' => Type::string(),
            ],
            'email' => [
                'type' => Type::string(),
            ],
            'posts' => [
                'type' => Type::listOf(GraphQL::type('Post')),
                'resolve' => fn($user) => $user->posts,
            ],
        ];
    }
}
```

**Определение Query:**

```php
// app/GraphQL/Queries/UserQuery.php
use Rebing\GraphQL\Support\Query;
use GraphQL\Type\Definition\Type;

class UserQuery extends Query
{
    protected $attributes = [
        'name' => 'user',
    ];

    public function type(): Type
    {
        return GraphQL::type('User');
    }

    public function args(): array
    {
        return [
            'id' => [
                'type' => Type::nonNull(Type::int()),
            ],
        ];
    }

    public function resolve($root, $args)
    {
        return User::find($args['id']);
    }
}
```

---

## Когда использовать

**GraphQL для:**
- ✅ Сложные вложенные данные
- ✅ Мобильные приложения (меньше запросов)
- ✅ Гибкость в выборе полей

**REST для:**
- ✅ Простые CRUD
- ✅ Кеширование (HTTP cache)
- ✅ Стандартизация

---

## Пример из практики

**Mutation (создание/изменение):**

```php
// app/GraphQL/Mutations/CreatePostMutation.php
class CreatePostMutation extends Mutation
{
    protected $attributes = [
        'name' => 'createPost',
    ];

    public function type(): Type
    {
        return GraphQL::type('Post');
    }

    public function args(): array
    {
        return [
            'title' => [
                'type' => Type::nonNull(Type::string()),
            ],
            'body' => [
                'type' => Type::nonNull(Type::string()),
            ],
        ];
    }

    public function resolve($root, $args)
    {
        $post = Post::create([
            'user_id' => auth()->id(),
            'title' => $args['title'],
            'body' => $args['body'],
        ]);

        return $post;
    }
}
```

**GraphQL запрос с mutation:**

```graphql
mutation {
  createPost(title: "New Post", body: "Content") {
    id
    title
    author {
      name
    }
  }
}
```

**Lighthouse (альтернатива):**

```bash
composer require nuwave/lighthouse
php artisan vendor:publish --tag=lighthouse-schema
```

```graphql
# graphql/schema.graphql
type Query {
  user(id: ID! @eq): User @find
  users: [User!]! @paginate
  posts: [Post!]! @all
}

type Mutation {
  createPost(title: String!, body: String!): Post @create
  updatePost(id: ID!, title: String, body: String): Post @update
  deletePost(id: ID!): Post @delete
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]! @hasMany
}

type Post {
  id: ID!
  title: String!
  body: String!
  user: User! @belongsTo
  comments: [Comment!]! @hasMany
}
```

---

## На собеседовании скажешь

> "GraphQL — язык запросов, один endpoint. Клиент указывает нужные поля. Query для чтения, Mutation для изменения. Type определяет структуру. Resolve функция загружает данные. Плюсы: гибкость, меньше over-fetching. Минусы: сложнее кеширование, нет HTTP status codes. Laravel: rebing/graphql-laravel или Lighthouse. Schema-first (Lighthouse) vs Code-first (rebing)."

---

## Практические задания

### Задание 1: Создай GraphQL Type и Query

Создай GraphQL Type для модели Post с полями id, title, body. Добавь Query для получения поста по ID.

<details>
<summary>Решение</summary>

```php
// app/GraphQL/Types/PostType.php
namespace App\GraphQL\Types;

use App\Models\Post;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class PostType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Post',
        'description' => 'A post',
        'model' => Post::class,
    ];

    public function fields(): array
    {
        return [
            'id' => [
                'type' => Type::nonNull(Type::int()),
                'description' => 'Post ID',
            ],
            'title' => [
                'type' => Type::string(),
                'description' => 'Post title',
            ],
            'body' => [
                'type' => Type::string(),
                'description' => 'Post content',
            ],
            'author' => [
                'type' => GraphQL::type('User'),
                'description' => 'Post author',
                'resolve' => function ($post) {
                    return $post->user;
                },
            ],
            'created_at' => [
                'type' => Type::string(),
                'description' => 'Creation date',
                'resolve' => function ($post) {
                    return $post->created_at->toISOString();
                },
            ],
        ];
    }
}

// app/GraphQL/Queries/PostQuery.php
namespace App\GraphQL\Queries;

use App\Models\Post;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Query;

class PostQuery extends Query
{
    protected $attributes = [
        'name' => 'post',
        'description' => 'Get a post by ID',
    ];

    public function type(): Type
    {
        return GraphQL::type('Post');
    }

    public function args(): array
    {
        return [
            'id' => [
                'type' => Type::nonNull(Type::int()),
                'description' => 'The ID of the post',
            ],
        ];
    }

    public function resolve($root, $args)
    {
        return Post::with('user')->findOrFail($args['id']);
    }
}

// config/graphql.php
'schemas' => [
    'default' => [
        'query' => [
            'post' => \App\GraphQL\Queries\PostQuery::class,
        ],
    ],
],

'types' => [
    'Post' => \App\GraphQL\Types\PostType::class,
    'User' => \App\GraphQL\Types\UserType::class,
],

// GraphQL запрос
/*
query {
  post(id: 1) {
    id
    title
    body
    author {
      name
      email
    }
    created_at
  }
}
*/
```

</details>

### Задание 2: Добавь Mutation с валидацией

Создай Mutation для создания поста с валидацией title (мин. 3 символа) и body (обязательное поле).

<details>
<summary>Решение</summary>

```php
// app/GraphQL/Mutations/CreatePostMutation.php
namespace App\GraphQL\Mutations;

use App\Models\Post;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Mutation;
use Illuminate\Support\Facades\Validator;

class CreatePostMutation extends Mutation
{
    protected $attributes = [
        'name' => 'createPost',
        'description' => 'Create a new post',
    ];

    public function type(): Type
    {
        return GraphQL::type('Post');
    }

    public function args(): array
    {
        return [
            'title' => [
                'type' => Type::nonNull(Type::string()),
                'description' => 'Post title (min 3 chars)',
            ],
            'body' => [
                'type' => Type::nonNull(Type::string()),
                'description' => 'Post content',
            ],
        ];
    }

    protected function rules(array $args = []): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'body' => ['required', 'string', 'min:10'],
        ];
    }

    public function resolve($root, $args)
    {
        $user = auth()->user();

        if (!$user) {
            throw new \GraphQL\Error\Error('Unauthenticated');
        }

        $post = Post::create([
            'user_id' => $user->id,
            'title' => $args['title'],
            'body' => $args['body'],
        ]);

        return $post->load('user');
    }
}

// config/graphql.php
'schemas' => [
    'default' => [
        'mutation' => [
            'createPost' => \App\GraphQL\Mutations\CreatePostMutation::class,
        ],
    ],
],

// GraphQL запрос
/*
mutation {
  createPost(
    title: "My GraphQL Post"
    body: "This is the content created via GraphQL mutation"
  ) {
    id
    title
    body
    author {
      name
    }
  }
}
*/
```

</details>

### Задание 3: Настрой Lighthouse для быстрого старта

Используй Lighthouse для создания GraphQL API без написания классов. Создай схему для User и Post.

<details>
<summary>Решение</summary>

```bash
# Установка
composer require nuwave/lighthouse
php artisan vendor:publish --tag=lighthouse-schema
php artisan vendor:publish --tag=lighthouse-config
```

```graphql
# graphql/schema.graphql
"A datetime string with format `Y-m-d H:i:s`"
scalar DateTime @scalar(class: "Nuwave\\Lighthouse\\Schema\\Types\\Scalars\\DateTime")

type Query {
    users(
        first: Int = 15
        page: Int
    ): UserPaginator! @paginate(defaultCount: 15)

    user(id: ID @eq): User @find

    posts(
        first: Int = 20
        page: Int
    ): PostPaginator! @paginate(defaultCount: 20)

    post(id: ID @eq): Post @find
}

type Mutation {
    createPost(
        title: String! @rules(apply: ["required", "min:3", "max:255"])
        body: String! @rules(apply: ["required", "min:10"])
    ): Post @create @inject(context: "user.id", name: "user_id")

    updatePost(
        id: ID! @eq
        title: String @rules(apply: ["min:3", "max:255"])
        body: String @rules(apply: ["min:10"])
    ): Post @update

    deletePost(id: ID! @eq): Post @delete @can(ability: "delete")
}

type User {
    id: ID!
    name: String!
    email: String!
    created_at: DateTime!
    updated_at: DateTime!
    posts: [Post!]! @hasMany
    posts_count: Int! @count(relation: "posts")
}

type Post {
    id: ID!
    title: String!
    body: String!
    created_at: DateTime!
    updated_at: DateTime!
    user: User! @belongsTo
}

type UserPaginator {
    data: [User!]!
    paginatorInfo: PaginatorInfo!
}

type PostPaginator {
    data: [Post!]!
    paginatorInfo: PaginatorInfo!
}

type PaginatorInfo {
    count: Int!
    currentPage: Int!
    firstItem: Int
    hasMorePages: Boolean!
    lastItem: Int
    lastPage: Int!
    perPage: Int!
    total: Int!
}
```

```php
// Примеры запросов

// Получить пользователей с их постами
/*
query {
  users(first: 5) {
    data {
      id
      name
      email
      posts_count
      posts {
        id
        title
      }
    }
    paginatorInfo {
      currentPage
      lastPage
      total
    }
  }
}
*/

// Получить пост с автором
/*
query {
  post(id: 1) {
    id
    title
    body
    created_at
    user {
      id
      name
      email
    }
  }
}
*/

// Создать пост (требуется авторизация)
/*
mutation {
  createPost(
    title: "New Post via Lighthouse"
    body: "This is much easier than code-first approach!"
  ) {
    id
    title
    body
    created_at
    user {
      name
    }
  }
}
*/

// Обновить пост
/*
mutation {
  updatePost(
    id: 1
    title: "Updated Title"
    body: "Updated content"
  ) {
    id
    title
    body
  }
}
*/
```

</details>

---

*Часть [PHP/Laravel Interview Handbook](/) | Сделано с ❤️ командой [CodeMate](https://codemate.team)*
