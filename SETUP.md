# CodeSync — Руководство по установке

## Быстрый старт (один файл)

Скачай и запусти один скрипт — он сделает всё за тебя.

### macOS / Linux

```bash
bash install.sh
```

### Windows

Дважды кликни по файлу **`install.ps1`** правой кнопкой мыши и выбери **"Запустить с PowerShell"**.

Или в терминале:
```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

**Что делает скрипт:**
- Проверяет наличие Docker
- Создаёт файл `.env` с настройками
- Предлагает ввести API-ключ для AI-функций
- Собирает и запускает все сервисы одной командой
- Открывает браузер с приложением

**Единственное требование:** [Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## Три способа запуска

### Способ 1 — Docker (рекомендуется, самый простой)

**Требования:** Docker 24+

```bash
# 1. Скопируй файл с переменными окружения
cp .env.example .env
# Открой .env и вставь OPENAI_API_KEY или ANTHROPIC_API_KEY

# 2. Запусти всё одной командой
docker compose up -d

# 3. Открой в браузере
# http://localhost
```

**Запущенные сервисы:**
| Контейнер | Порт | Роль |
|-----------|------|------|
| `db`      | 5432 | PostgreSQL 16 |
| `api`     | 8080 | REST + WebSocket API |
| `web`     | 80   | React фронтенд (Nginx) |

**Управление:**
```bash
# Остановить
docker compose down

# Остановить и удалить данные базы
docker compose down -v

# Посмотреть логи
docker compose logs -f

# Перезапустить
docker compose restart
```

---

### Способ 2 — Локальная разработка (Node.js)

**Требования:** Node.js 22+, pnpm 10+, PostgreSQL 16+

#### Шаг 1 — Устанавливаем зависимости

```bash
pnpm install
```

#### Шаг 2 — Настраиваем переменные окружения

Создай файл `.env` в корне проекта:

```env
DATABASE_URL=postgres://postgres:пароль@localhost:5432/codesync
OPENAI_API_KEY=sk-...          # Нужен для AI-функций
ANTHROPIC_API_KEY=             # Альтернатива OpenAI
CLERK_SECRET_KEY=              # Опционально — полная авторизация; гостевой режим работает без него
PORT=8080
```

#### Шаг 3 — Создаём базу данных

```bash
createdb codesync
pnpm --filter @workspace/db run push
```

#### Шаг 4 — Запускаем серверы

```bash
# Терминал 1: API-сервер (порт 8080)
pnpm --filter @workspace/api-server run dev

# Терминал 2: Веб-фронтенд
pnpm --filter @workspace/codesync run dev

# Терминал 3: Десктопное приложение (порт 21098/desktop/)
pnpm --filter @workspace/desktop run dev
```

Приложение доступно по адресам:
- **Веб-версия:** `http://localhost:<порт>/`
- **Десктопная версия:** `http://localhost:21098/desktop/`

---

### Способ 3 — Сборка Electron (нативное приложение)

Десктопное приложение можно собрать в нативный установщик (.exe, .dmg, .AppImage).

#### Dev-режим (Electron окно + горячая перезагрузка)

```bash
# Сначала запусти API-сервер
pnpm --filter @workspace/api-server run dev

# Затем в другом терминале
cd artifacts/desktop
VITE_API_URL=http://localhost:8080/api pnpm run electron:dev
```

#### Сборка установщика

```bash
cd artifacts/desktop

# Укажи адрес твоего сервера
export VITE_API_URL=https://твой-сервер.com/api

# Сборка для текущей платформы
pnpm run electron:build

# Или для конкретной платформы:
pnpm run electron:build:mac    # macOS .dmg (Intel + Apple Silicon)
pnpm run electron:build:win    # Windows .exe (NSIS установщик)
pnpm run electron:build:linux  # Linux .AppImage + .deb + .rpm
```

Результат в папке `artifacts/desktop/dist/electron/`:

| Платформа | Файл |
|-----------|------|
| Windows   | `CodeSync Setup x.x.x.exe` (установщик), `CodeSync x.x.x.exe` (портативный) |
| macOS     | `CodeSync-x.x.x.dmg` (Intel), `CodeSync-x.x.x-arm64.dmg` (Apple Silicon) |
| Linux     | `CodeSync-x.x.x.AppImage`, `codesync_x.x.x_amd64.deb` |

> Сборка под macOS возможна только на macOS; под Windows — только на Windows или с Wine. Linux AppImage собирается на любом Linux.

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | Да | Строка подключения к PostgreSQL |
| `PORT` | Нет | Порт API-сервера (по умолчанию: 8080) |
| `OPENAI_API_KEY` | Для AI | Ключ OpenAI для чата и ревью кода |
| `ANTHROPIC_API_KEY` | Для AI | Ключ Anthropic (альтернатива OpenAI) |
| `CLERK_SECRET_KEY` | Нет | Включает авторизацию Clerk; гостевой режим работает без него |
| `POSTGRES_PASSWORD` | Только Docker | Пароль PostgreSQL для Docker Compose |

> Никогда не добавляй `.env` в git — добавь его в `.gitignore`.

---

## API-эндпоинты

Все эндпоинты начинаются с `/api`:

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/healthz` | Проверка работоспособности |
| `GET` | `/api/auth/me` | Текущий пользователь |
| `POST` | `/api/auth/guest` | Создать гостевую сессию |
| `GET` | `/api/rooms` | Список публичных комнат |
| `POST` | `/api/rooms` | Создать комнату |
| `GET` | `/api/rooms/:id` | Получить комнату |
| `DELETE` | `/api/rooms/:id` | Удалить комнату |
| `GET` | `/api/rooms/join/:code` | Войти по коду приглашения |
| `GET` | `/api/rooms/:id/files` | Список файлов |
| `POST` | `/api/rooms/:id/files` | Создать файл |
| `PATCH` | `/api/rooms/:id/files/:fid` | Обновить файл |
| `DELETE` | `/api/rooms/:id/files/:fid` | Удалить файл |
| `POST` | `/api/execute` | Выполнить код (50+ языков) |
| `POST` | `/api/ai/chat` | AI-чат (SSE стриминг) |
| `POST` | `/api/ai/review` | Ревью кода с AI |

**WebSocket:** `ws://хост/ws/rooms/:roomId/files/:fileId` (совместное редактирование в реальном времени)

---

## Структура проекта

```
/
├── artifacts/
│   ├── api-server/     # Express 5 бэкенд + WebSocket + Yjs
│   ├── codesync/       # Веб-фронтенд (оригинальный дизайн)
│   └── desktop/        # Десктопное приложение (тёмный Cursor-стиль)
│       ├── electron/   # Electron main process (main.ts, preload.ts)
│       └── src/        # Vite + React рендерер
├── lib/
│   ├── db/             # PostgreSQL схема (Drizzle ORM)
│   ├── api-spec/       # OpenAPI спецификация
│   ├── api-client-react/ # Сгенерированные React Query хуки
│   └── api-zod/        # Сгенерированные Zod-схемы
├── docker-compose.yml  # Самохостинг (PostgreSQL + API + Nginx)
├── Dockerfile.api      # Контейнер API-сервера
├── Dockerfile.web      # Контейнер веб-фронтенда (Nginx)
├── install.sh          # Установочный скрипт для macOS/Linux
├── install.ps1         # Установочный скрипт для Windows
├── .env.example        # Шаблон переменных окружения
└── SETUP.md            # Этот файл
```

---

## Решение частых проблем

**`DATABASE_URL connection refused`**
PostgreSQL не запущен. Запусти командой `pg_ctl start` или проверь статус Docker.

**`AI-функции не работают`**
Убедись что `OPENAI_API_KEY` или `ANTHROPIC_API_KEY` указан и действителен в `.env`.

**`Порт уже используется`**
Измени `PORT` в `.env` или останови конфликтующий процесс.

**`pnpm install завершается с ошибкой`**
Убедись что установлены Node.js 22+ и pnpm 10+: `node -v && pnpm -v`.

**`Таблица не найдена / Schema not found`**
Запусти `pnpm --filter @workspace/db run push` для применения схемы базы данных.

**`docker compose up завершается с ошибкой`**
Проверь что Docker запущен: `docker info`. Посмотри логи: `docker compose logs`.
