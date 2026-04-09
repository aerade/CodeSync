# CodeSync — Collaborative Web IDE

## Overview

CodeSync is a full-stack real-time collaborative web IDE where multiple developers can simultaneously edit code. All UI is in Russian.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (with guest mode)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Real-time**: Yjs CRDT + WebSocket
- **Frontend**: React + Vite, Tailwind v4, Framer Motion
- **Editor**: Monaco Editor (@monaco-editor/react)
- **AI**: OpenAI gpt-4o via Replit AI Integrations (streaming SSE)
- **Code execution**: Piston API (free, 50+ languages)

## Project Structure

```
artifacts/
  api-server/          # Express API server + WebSocket (port 8080)
    src/
      routes/          # auth.ts, rooms.ts, files.ts, events.ts, execute.ts, ai.ts
      ws/              # collaborationServer.ts (Yjs + WebSocket)
      app.ts           # Express app + Clerk middleware
      index.ts         # HTTP + WebSocket server setup
  codesync/            # React+Vite frontend (port 25034, previewPath "/")
    src/
      pages/           # home.tsx, dashboard.tsx, room.tsx, not-found.tsx
      components/      # FileTree, AIPanel, Terminal, SessionSidebar, ParticleBackground
      hooks/           # useCurrentUser.ts
lib/
  db/                  # Drizzle ORM + PostgreSQL schema
    src/schema/        # users, rooms, roomMembers, files, events, yjsSnapshots, fileSnapshots
  api-spec/            # OpenAPI YAML spec
  api-client-react/    # Orval-generated React Query hooks
  api-zod/             # Orval-generated Zod schemas
  integrations-openai-ai-server/  # OpenAI client
```

## Key Features

- **Collaborative editing**: Yjs CRDT over WebSocket at `/ws/rooms/:roomId/files/:fileId`
- **Monaco Editor**: VS-Code-like editor with Deep Focus dark theme, autocomplete/suggestions for JS/TS/HTML
- **AI Panel**: Three tabs — code review (SSE), chat (SSE with tool-calling for file create/edit/delete), and History (file snapshots)
- **File History & Revert**: `file_snapshots` table stores content snapshots on every save or AI edit; History tab shows timeline with author/timestamp, inline preview, and one-click Restore
- **AI Diff Display**: When AI edits a file via chat, Monaco editor highlights changed lines with green decorations (`ai-diff-added` CSS class) so users can see what changed
- **Code execution**: Local execution (child_process) with auth + rate limiting, supports JS/TS/C/C++/Bash/HTML preview
- **File tree**: Create/delete files and folders, drag-and-drop to move files between folders, context menus
- **Guest mode**: Join rooms without account; can't create rooms. Proper error messages for restricted actions
- **Session sidebar**: Online collaborators with pastel colors, event feed
- **Room management**: Duplicate room name prevention (409 error), private rooms visible to members on dashboard

## Color Palette "Deep Focus"

- Background: `#161B22`
- Primary Accent: `#58A6FF` (blue)
- Success: `#3FB950` (green)
- Text: `#E6EDF3`
- Muted: `#8B949E`
- Border: `#30363D`
- Card: `#1C2128`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/codesync run dev` — run frontend locally

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk secret key
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (server-side)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend)
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL (auto-set by Clerk integration)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy base URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI proxy API key

## API Routes

All routes are prefixed with `/api`:
- `GET /api/healthz` — Health check
- `GET /api/auth/me` — Get current user (Clerk or guest token)
- `POST /api/auth/guest` — Create guest session
- `GET /api/rooms` — List public rooms
- `POST /api/rooms` — Create room (auth required)
- `GET /api/rooms/:roomId` — Get room
- `DELETE /api/rooms/:roomId` — Delete room (owner only)
- `GET /api/rooms/join/:inviteCode` — Get room by invite code
- `GET /api/rooms/:roomId/members` — List room members
- `GET /api/rooms/:roomId/files` — List room files
- `POST /api/rooms/:roomId/files` — Create file
- `GET /api/rooms/:roomId/files/:fileId` — Get file
- `PATCH /api/rooms/:roomId/files/:fileId` — Update file
- `DELETE /api/rooms/:roomId/files/:fileId` — Delete file
- `GET /api/rooms/:roomId/events` — Get room events
- `POST /api/execute` — Execute code (Piston API)
- `POST /api/ai/chat` — AI chat (SSE streaming)
- `POST /api/ai/review` — AI code review (SSE streaming)

## WebSocket

Path: `/ws/rooms/:roomId/files/:fileId`
Query params: `userId`, `username`, `guestToken`
Messages: `init`, `yjs-update`, `awareness`, `cursor`, `joined`
