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
- **AI**: OpenAI (gpt-4.1, o3, gpt-4o) + Anthropic Claude (claude-sonnet-4-6, claude-sonnet-4-5) via Replit AI Integrations (streaming SSE + tool_use)
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
- **File tree**: Create/delete files and folders, drag-and-drop to move, context menus, Ctrl+click multi-select with bulk delete
- **Guest mode**: Join rooms without account; can't create rooms. Proper error messages for restricted actions
- **Session sidebar**: Online collaborators (240px panel), real-time room chat via WS `type:"chat"` with file attachment (any type up to 5MB), message actions (copy/reply/edit/delete), reply-with-quote, inline edit mode, file download button, animated message bubbles. No emoji/reactions.
- **Room settings**: Left sidebar navigation (7 sections: Внешний вид, Редактор, Присутствие, Звук, Комната, Уведомления, Горячие клавиши). Owner "Комната" section: editable name/description, privacy toggle, maxUsers slider (1-5), password field. `rooms` table has `password` nullable text column.
- **AI chat plan mode**: Toggle "Plan" button to make AI plan tasks step-by-step before executing; file attachment for AI (AI reads text/code files sent by user); copy button on all messages
- **VS Code-style file icons**: Unique icons for JS, JSX, TS, TSX, Python, HTML, CSS, SCSS, JSON, Markdown, Go, Rust, Java, C/C++, C#, Ruby, PHP, Shell, SQL, YAML, Vue, Svelte, Dockerfile, Image
- **WS chat events**: Server broadcasts `type:"chat"` with `messageId`, `fileAttachment`, `replyTo`; handles `chat_edit` and `chat_delete` broadcast to all room participants
- **AI Chat panel**: Draggable + resizable (SE corner), AbortController streaming, paper-plane send button, no hint text, image folder auto-creation
- **Selection menu scroll dismiss**: hides when user scrolls >150px from where selection was made
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
