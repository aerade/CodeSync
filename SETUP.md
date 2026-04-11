# CodeSync — Руководство по запуску и настройке

## Содержание

1. [Требования](#требования)
2. [Быстрый старт](#быстрый-старт)
3. [Настройка Clerk (авторизация)](#настройка-clerk-авторизация)
4. [Настройка OpenAI / AI-интеграция](#настройка-openai--ai-интеграция)
5. [Настройка базы данных](#настройка-базы-данных)
6. [Переменные окружения](#переменные-окружения)
7. [Структура проекта](#структура-проекта)
8. [Команды разработчика](#команды-разработчика)
9. [API-маршруты](#api-маршруты)
10. [WebSocket](#websocket)
11. [Внешние сервисы](#внешние-сервисы)

---

## Требования

| Инструмент | Версия |
|---|---|
| Node.js | 24+ |
| pnpm | 9+ |
| PostgreSQL | 15+ |

```bash
node --version   # v24.x.x
pnpm --version   # 9.x.x
```

---

## Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
git clone <repo-url>
cd codesync
pnpm install
```

### 2. Заполнить переменные окружения

Создать файл `.env` в корне проекта:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/codesync
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_CLERK_PROXY_URL=https://your-domain.com/clerk
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
```

### 3. Применить схему базы данных

```bash
pnpm --filter @workspace/db run push
```

### 4. Запуск серверов

Запустить в двух отдельных терминалах:

```bash
# Терминал 1 — backend (Express, порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2 — frontend (React+Vite, порт 25034)
pnpm --filter @workspace/codesync run dev
```

Приложение доступно по адресу: `http://localhost:25034`

---

## Настройка Clerk (авторизация)

Clerk обеспечивает авторизацию пользователей. В проекте также реализован **гостевой режим** — пользователи могут заходить в комнаты без регистрации (только просмотр и редактирование, без создания комнат).

### Шаг 1. Создать приложение в Clerk

1. Зайти на [clerk.com](https://clerk.com) и создать аккаунт.
2. Создать новое приложение (Application).
3. Выбрать методы входа: Email, Google, GitHub — по необходимости.
4. Перейти в раздел **API Keys**.

### Шаг 2. Получить ключи

| Ключ | Где взять | Куда вставить |
|---|---|---|
| `Publishable Key` | Clerk Dashboard → API Keys | `CLERK_PUBLISHABLE_KEY` и `VITE_CLERK_PUBLISHABLE_KEY` |
| `Secret Key` | Clerk Dashboard → API Keys | `CLERK_SECRET_KEY` |

### Шаг 3. Настроить Proxy URL (опционально, для production)

Если используется собственный домен, в Clerk Dashboard → **Domains** добавить домен и выставить переменную:

```env
VITE_CLERK_PROXY_URL=https://your-domain.com/clerk
```

Если proxy не нужен — переменную можно не задавать.

### Шаг 4. Настроить Redirect URLs

В Clerk Dashboard → **Redirect URLs** добавить адреса вашего приложения:

```
http://localhost:25034
http://localhost:25034/dashboard
https://your-domain.com
https://your-domain.com/dashboard
```

### Использование в проекте

- **Backend**: `artifacts/api-server/src/app.ts` — Clerk middleware для проверки JWT-токенов
- **Frontend**: `artifacts/codesync/src/` — `ClerkProvider` и хук `useCurrentUser`
- **Гостевой режим**: токен хранится в `localStorage` под ключом `x-guest-token`, передаётся в заголовке запроса

---

## Настройка OpenAI / AI-интеграция

В проекте используется модель **gpt-4o** для двух функций:
- **Code Review** — анализ выбранного кода (SSE-стриминг)
- **AI Chat** — диалог с ИИ, который может создавать/редактировать/удалять файлы в IDE через tool-calling

### Получить API-ключ OpenAI

1. Зайти на [platform.openai.com](https://platform.openai.com).
2. Создать API-ключ в разделе **API keys**.
3. Выставить переменные окружения:

```env
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
```

### Альтернативный провайдер (OpenAI-совместимый)

Если используется прокси или другой OpenAI-совместимый провайдер (Azure, Together AI, Groq и др.), достаточно изменить `BASE_URL`:

```env
AI_INTEGRATIONS_OPENAI_BASE_URL=https://your-proxy.example.com
AI_INTEGRATIONS_OPENAI_API_KEY=<ключ провайдера>
```

### Использование в проекте

- **Клиент OpenAI**: `lib/integrations-openai-ai-server/`
- **AI-маршруты**: `artifacts/api-server/src/routes/ai.ts`
  - `POST /api/ai/chat` — чат с ИИ (SSE)
  - `POST /api/ai/review` — code review (SSE)

---

## Настройка базы данных

Проект использует **PostgreSQL** с **Drizzle ORM**.

### Схема данных

| Таблица | Описание |
|---|---|
| `users` | Пользователи (Clerk ID + гостевые токены) |
| `rooms` | Комнаты для совместного редактирования |
| `room_members` | Участники комнат |
| `files` | Файлы в комнатах |
| `events` | Лента событий (join, edit и т.д.) |
| `yjs_snapshots` | Снапшоты Yjs-документов |
| `file_snapshots` | История версий файлов |

### Локальный PostgreSQL

```bash
# Создать базу данных
createdb codesync

# Задать переменную окружения
DATABASE_URL=postgresql://postgres:password@localhost:5432/codesync

# Применить схему
pnpm --filter @workspace/db run push
```

### Облачная БД (Supabase, Neon, Railway и др.)

Создать базу данных в выбранном сервисе, скопировать строку подключения и задать переменную:

```env
DATABASE_URL=postgresql://user:password@db.example.com:5432/codesync
```

Затем применить схему:

```bash
pnpm --filter @workspace/db run push
```

---

## Переменные окружения

### Полный список

| Переменная | Обязательная | Описание |
|---|---|---|
| `DATABASE_URL` | Да | PostgreSQL строка подключения |
| `CLERK_SECRET_KEY` | Да | Clerk секретный ключ (backend) |
| `CLERK_PUBLISHABLE_KEY` | Да | Clerk публичный ключ (backend) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Да | Clerk публичный ключ (frontend Vite) |
| `VITE_CLERK_PROXY_URL` | Нет | URL прокси Clerk (для production) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Да | Базовый URL OpenAI или совместимого провайдера |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Да | API-ключ OpenAI |
| `PORT` | Нет | Порт API-сервера (по умолчанию 8080) |

> **Важно**: никогда не коммитить файл `.env` в git. Добавьте его в `.gitignore`.

---

## Структура проекта

```
/
├── artifacts/
│   ├── api-server/              # Express 5 backend
│   │   └── src/
│   │       ├── routes/          # REST API маршруты
│   │       │   ├── auth.ts      # /api/auth/*
│   │       │   ├── rooms.ts     # /api/rooms/*
│   │       │   ├── files.ts     # /api/rooms/:id/files/*
│   │       │   ├── events.ts    # /api/rooms/:id/events
│   │       │   ├── execute.ts   # /api/execute
│   │       │   └── ai.ts        # /api/ai/*
│   │       ├── ws/
│   │       │   └── collaborationServer.ts  # WebSocket + Yjs
│   │       ├── middlewares/
│   │       │   └── clerkProxyMiddleware.ts
│   │       ├── app.ts           # Express app
│   │       └── index.ts         # HTTP + WS сервер
│   │
│   ├── codesync/                # React + Vite frontend
│   │   └── src/
│   │       ├── pages/           # home, dashboard, room, not-found
│   │       ├── components/      # FileTree, AIPanel, Terminal, SessionSidebar
│   │       └── hooks/           # useCurrentUser.ts
│   │
│   └── mockup-sandbox/          # UI-прототипы (для разработки)
│
└── lib/
    ├── db/                      # Drizzle ORM + схемы таблиц
    │   └── src/schema/
    ├── api-spec/                # OpenAPI YAML спецификация
    ├── api-client-react/        # Сгенерированные React Query хуки
    ├── api-zod/                 # Сгенерированные Zod схемы
    └── integrations-openai-ai-server/  # OpenAI клиент
```

---

## Команды разработчика

```bash
# Установить все зависимости
pnpm install

# Применить схему БД (только dev)
pnpm --filter @workspace/db run push

# Запустить backend (порт 8080)
pnpm --filter @workspace/api-server run dev

# Запустить frontend (порт 25034)
pnpm --filter @workspace/codesync run dev

# Регенерировать API-хуки и Zod-схемы из OpenAPI спецификации
pnpm --filter @workspace/api-spec run codegen

# Typecheck всего монорепо
pnpm run typecheck

# Сборка всего монорепо
pnpm run build
```

---

## API-маршруты

Все маршруты с префиксом `/api`:

### Авторизация
| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/healthz` | Проверка работоспособности |
| `GET` | `/api/auth/me` | Текущий пользователь (Clerk или гость) |
| `POST` | `/api/auth/guest` | Создать гостевую сессию |

### Комнаты
| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/rooms` | Список публичных комнат |
| `POST` | `/api/rooms` | Создать комнату (требует авторизации) |
| `GET` | `/api/rooms/:roomId` | Получить комнату |
| `DELETE` | `/api/rooms/:roomId` | Удалить комнату (только владелец) |
| `GET` | `/api/rooms/join/:inviteCode` | Войти по коду приглашения |
| `GET` | `/api/rooms/:roomId/members` | Список участников |

### Файлы
| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/rooms/:roomId/files` | Список файлов в комнате |
| `POST` | `/api/rooms/:roomId/files` | Создать файл |
| `GET` | `/api/rooms/:roomId/files/:fileId` | Получить файл |
| `PATCH` | `/api/rooms/:roomId/files/:fileId` | Обновить файл |
| `DELETE` | `/api/rooms/:roomId/files/:fileId` | Удалить файл |

### События и AI
| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/rooms/:roomId/events` | Лента событий комнаты |
| `POST` | `/api/execute` | Выполнить код |
| `POST` | `/api/ai/chat` | Чат с ИИ (SSE стриминг) |
| `POST` | `/api/ai/review` | Code review (SSE стриминг) |

---

## WebSocket

**Путь**: `/ws/rooms/:roomId/files/:fileId`

**Query-параметры**:
| Параметр | Описание |
|---|---|
| `userId` | ID пользователя |
| `username` | Имя пользователя |
| `guestToken` | Токен гостя (если нет аккаунта) |

**Типы сообщений**:
| Тип | Описание |
|---|---|
| `init` | Инициализация Yjs-документа |
| `yjs-update` | Обновление CRDT (изменения в тексте) |
| `awareness` | Информация о курсорах других пользователей |
| `cursor` | Позиция курсора |
| `joined` | Уведомление о входе пользователя |

---

## Внешние сервисы

### Обзор всех зависимостей

| Сервис | Назначение | Обязательный | Ссылка |
|---|---|---|---|
| **Clerk** | Аутентификация пользователей | Да | [clerk.com](https://clerk.com) |
| **OpenAI (gpt-4o)** | AI-чат и code review | Да | [platform.openai.com](https://platform.openai.com) |
| **PostgreSQL** | Хранение данных | Да | [postgresql.org](https://postgresql.org) |
| **Piston API** | Выполнение кода (50+ языков) | Нет* | [piston.run](https://piston.run) |
| **Yjs** | Real-time CRDT синхронизация | Встроен | — |

*Piston API — публичный бесплатный сервис, не требует ключа. Используется для `/api/execute`.

### Piston API

Выполнение кода происходит через [Piston](https://github.com/engineer-man/piston) — публичный open-source API.

- URL: `https://emkc.org/api/v2/piston`
- Ключ не нужен
- Лимит запросов: ~5 в секунду
- Поддерживает: JavaScript, TypeScript, Python, C, C++, Bash, Java, Go и 50+ языков

---

## Частые проблемы

### `CLERK_SECRET_KEY is not set`
Убедитесь, что переменная задана в `.env`. Проверьте, что backend перезапущен после изменения.

### `DATABASE_URL connection refused`
Проверьте, что PostgreSQL запущен и строка подключения корректна. Убедитесь, что база данных создана командой `createdb codesync`.

### `Cannot find module '@workspace/db'`
Запустите `pnpm install` — возможно, зависимости не были установлены после клонирования.

### AI не отвечает
Проверьте переменные `AI_INTEGRATIONS_OPENAI_BASE_URL` и `AI_INTEGRATIONS_OPENAI_API_KEY`. Убедитесь, что API-ключ действителен и есть баланс на аккаунте OpenAI.

### Изменения в OpenAPI спеке не применяются
После правок `lib/api-spec/openapi.yaml` запустите:
```bash
pnpm --filter @workspace/api-spec run codegen
```
