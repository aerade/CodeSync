# CodeSync — Setup & Installation Guide

## Three Ways to Run CodeSync

### Option 1: Docker Compose (Recommended — Easiest)
### Option 2: Local Development
### Option 3: Download Desktop App

---

## Option 1: Docker Compose (Self-Hosted)

**Requirements:** Docker 24+, Docker Compose v2

```bash
# 1. Clone the repo
git clone <repo-url>
cd codesync

# 2. Copy and edit environment variables
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY or ANTHROPIC_API_KEY

# 3. Start everything (PostgreSQL + API + Web frontend)
docker compose up -d

# 4. Open in browser
open http://localhost
```

**Services started:**
| Container | Port | Role |
|-----------|------|------|
| `db`      | 5432 | PostgreSQL 16 |
| `api`     | 8080 | REST + WebSocket API |
| `web`     | 80   | React frontend (Nginx) |

**Stop:**
```bash
docker compose down
# To also remove database data:
docker compose down -v
```

---

## Option 2: Local Development

**Requirements:** Node.js 22+, pnpm 10+, PostgreSQL 16+

### Step 1 — Install dependencies

```bash
git clone <repo-url>
cd codesync
pnpm install
```

### Step 2 — Configure environment

Create `.env` in the project root:

```env
DATABASE_URL=postgres://postgres:password@localhost:5432/codesync
OPENAI_API_KEY=sk-...          # Required for AI features
ANTHROPIC_API_KEY=             # Optional alternative to OpenAI
CLERK_SECRET_KEY=              # Optional — enables full auth; guests work without it
PORT=8080
```

### Step 3 — Set up the database

```bash
# Create the database
createdb codesync

# Push schema (Drizzle ORM)
pnpm --filter @workspace/db run push
```

### Step 4 — Start the servers

```bash
# Terminal 1: API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2: Web frontend
pnpm --filter @workspace/codesync run dev

# Terminal 3: Desktop app (new dark theme, port 21098)
pnpm --filter @workspace/desktop run dev
```

App is available at:
- **Web version:** `http://localhost:<port>/`
- **Desktop version:** `http://localhost:21098/desktop/`

---

## Option 3: Desktop App (Electron)

The desktop app uses the same backend as the web version but runs as a standalone
Electron window with the new dark Cursor-inspired UI.

### Running the Desktop App in Dev Mode

```bash
# Requires the API server to be running first (Option 2 Step 4)
pnpm --filter @workspace/desktop run dev
```

Then open `http://localhost:21098/desktop/` in your browser, or package it as an
Electron `.exe`/`.dmg`/`.AppImage` using the build steps below.

### Building Electron Binaries

```bash
# Install electron-builder globally
npm install -g electron-builder

# Build for current platform
cd artifacts/desktop
electron-builder build

# Build for all platforms
electron-builder build --mac --win --linux
```

Output binaries are placed in `artifacts/desktop/dist/`:
- **Windows:** `CodeSync-Setup-x.x.x.exe`
- **macOS:** `CodeSync-x.x.x.dmg`
- **Linux:** `CodeSync-x.x.x.AppImage`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | API server port (default: 8080) |
| `OPENAI_API_KEY` | For AI | OpenAI API key for AI chat & code review |
| `ANTHROPIC_API_KEY` | For AI | Anthropic API key (alternative to OpenAI) |
| `CLERK_SECRET_KEY` | No | Enables Clerk auth; guest mode works without it |
| `POSTGRES_PASSWORD` | Docker only | PostgreSQL password for Docker Compose |

> Never commit `.env` to version control — add it to `.gitignore`.

---

## API Endpoints

All endpoints are prefixed with `/api`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/guest` | Create guest session |
| `GET` | `/api/rooms` | List public rooms |
| `POST` | `/api/rooms` | Create room |
| `GET` | `/api/rooms/:id` | Get room |
| `DELETE` | `/api/rooms/:id` | Delete room |
| `GET` | `/api/rooms/join/:code` | Join by invite code |
| `GET` | `/api/rooms/:id/files` | List files |
| `POST` | `/api/rooms/:id/files` | Create file |
| `PATCH` | `/api/rooms/:id/files/:fid` | Update file |
| `DELETE` | `/api/rooms/:id/files/:fid` | Delete file |
| `POST` | `/api/execute` | Execute code (50+ languages) |
| `POST` | `/api/ai/chat` | AI chat (SSE streaming) |
| `POST` | `/api/ai/review` | AI code review |

**WebSocket:** `ws://host/ws/rooms/:roomId/files/:fileId` (real-time collaboration)

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/     # Express 5 backend + WebSocket + Yjs
│   ├── codesync/       # Web frontend (original design)
│   └── desktop/        # Desktop app (new dark Cursor-inspired design)
├── lib/
│   ├── db/             # PostgreSQL schema (Drizzle ORM)
│   ├── api-spec/       # OpenAPI spec
│   ├── api-client-react/ # Generated React Query hooks
│   └── api-zod/        # Generated Zod schemas
├── docker-compose.yml  # Self-hosting (PostgreSQL + API + Nginx)
├── Dockerfile.api      # API server container
├── Dockerfile.web      # Web frontend container (Nginx)
├── .env.example        # Environment variable template
└── SETUP.md            # This file
```

---

## Common Issues

**`DATABASE_URL connection refused`**
PostgreSQL is not running. Start it with `pg_ctl start` or check Docker status.

**`AI features not working`**
Ensure `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set and valid in `.env`.

**`Port already in use`**
Change the `PORT` variable in `.env` or stop the conflicting process.

**`pnpm install fails`**
Ensure Node.js 22+ and pnpm 10+ are installed: `node -v && pnpm -v`.

**`Schema not found / table does not exist`**
Run `pnpm --filter @workspace/db run push` to apply the database schema.
