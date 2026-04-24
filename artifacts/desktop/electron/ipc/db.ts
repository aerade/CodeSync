/**
 * Локальная SQLite-база на better-sqlite3 — local-first хранилище CodeSync Desktop.
 *
 * Таблицы:
 *   - projects        — список локальных и облачных проектов (для боковой панели «Последние»)
 *   - settings        — пользовательские настройки (key/value): apiBaseUrl, guestToken, …
 *   - file_versions   — локальная история версий файлов (snapshot на каждое сохранение)
 *   - recent_rooms    — кэш недавних облачных комнат (id, invite-код, имя)
 *   - ai_history      — лог сообщений AI-чата (для офлайн-просмотра)
 */
import type { IpcMain } from "electron";
import * as path from "path";
import * as fs from "fs";

type Project = {
  id: string;
  name: string;
  path: string;
  type: "local" | "cloud";
  lastOpenedAt: number;
  cloudRoomId?: string | null;
};

type FileVersion = {
  id: number;
  filePath: string;
  content: string;
  createdAt: number;
  size: number;
};

type RecentRoom = {
  id: string;
  inviteCode: string | null;
  title: string;
  lastJoinedAt: number;
};

type AiMessage = {
  id: number;
  scope: string;          // например "room:<id>" или "local:<projectId>"
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

interface DbInstance {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { lastInsertRowid?: number | bigint };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown;
  };
  exec: (sql: string) => void;
  pragma: (s: string) => void;
}

let db: DbInstance | null = null;

function init(userDataDir: string): DbInstance | null {
  const dbPath = path.join(userDataDir, "codesync.db");
  fs.mkdirSync(userDataDir, { recursive: true });
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const inst: DbInstance = new Database(dbPath);
    inst.pragma("journal_mode = WAL");
    inst.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        last_opened_at INTEGER NOT NULL,
        cloud_room_id TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS file_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        size INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_file_versions_path
        ON file_versions(file_path, created_at DESC);
      CREATE TABLE IF NOT EXISTS recent_rooms (
        id TEXT PRIMARY KEY,
        invite_code TEXT,
        title TEXT NOT NULL,
        last_joined_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_history_scope
        ON ai_history(scope, created_at);
    `);
    return inst;
  } catch (err) {
    console.error("[db] better-sqlite3 недоступен (native build не собрался?)", err);
    return null;
  }
}

const MAX_VERSIONS_PER_FILE = 50;

export function registerDbHandlers(ipc: IpcMain, userDataDir: string) {
  db = init(userDataDir);

  // ───────── Projects ─────────
  ipc.handle("db:listProjects", () => {
    if (!db) return [];
    const rows = db.prepare("SELECT * FROM projects ORDER BY last_opened_at DESC").all() as Array<{
      id: string;
      name: string;
      path: string;
      type: "local" | "cloud";
      last_opened_at: number;
      cloud_room_id: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      type: r.type,
      lastOpenedAt: r.last_opened_at,
      cloudRoomId: r.cloud_room_id ?? undefined,
    }));
  });

  ipc.handle("db:upsertProject", (_e, p: Project) => {
    if (!db) return;
    db.prepare(`
      INSERT INTO projects (id, name, path, type, last_opened_at, cloud_room_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        type = excluded.type,
        last_opened_at = excluded.last_opened_at,
        cloud_room_id = excluded.cloud_room_id
    `).run(p.id, p.name, p.path, p.type, p.lastOpenedAt, p.cloudRoomId ?? null);
  });

  ipc.handle("db:removeProject", (_e, id: string) => {
    if (!db) return;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });

  // ───────── Settings ─────────
  ipc.handle("db:getSetting", (_e, key: string) => {
    if (!db) return null;
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  });

  ipc.handle("db:setSetting", (_e, key: string, value: string) => {
    if (!db) return;
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  });

  // ───────── File Versions (локальная история) ─────────
  ipc.handle("db:saveFileVersion", (_e, filePath: string, content: string) => {
    if (!db) return null;
    const size = Buffer.byteLength(content, "utf8");
    const res = db.prepare(`
      INSERT INTO file_versions (file_path, content, created_at, size)
      VALUES (?, ?, ?, ?)
    `).run(filePath, content, Date.now(), size);
    // Обрезаем историю до MAX_VERSIONS_PER_FILE
    db.prepare(`
      DELETE FROM file_versions
      WHERE file_path = ?
        AND id NOT IN (
          SELECT id FROM file_versions
          WHERE file_path = ?
          ORDER BY created_at DESC LIMIT ?
        )
    `).run(filePath, filePath, MAX_VERSIONS_PER_FILE);
    return Number(res.lastInsertRowid ?? 0);
  });

  ipc.handle("db:listFileVersions", (_e, filePath: string) => {
    if (!db) return [];
    const rows = db.prepare(`
      SELECT id, file_path, content, created_at, size
      FROM file_versions
      WHERE file_path = ?
      ORDER BY created_at DESC
    `).all(filePath) as Array<{
      id: number; file_path: string; content: string; created_at: number; size: number;
    }>;
    return rows.map<FileVersion>((r) => ({
      id: r.id,
      filePath: r.file_path,
      content: r.content,
      createdAt: r.created_at,
      size: r.size,
    }));
  });

  ipc.handle("db:getFileVersion", (_e, versionId: number) => {
    if (!db) return null;
    const row = db.prepare(`
      SELECT id, file_path, content, created_at, size
      FROM file_versions WHERE id = ?
    `).get(versionId) as { id: number; file_path: string; content: string; created_at: number; size: number } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      filePath: row.file_path,
      content: row.content,
      createdAt: row.created_at,
      size: row.size,
    } satisfies FileVersion;
  });

  // ───────── Recent rooms ─────────
  ipc.handle("db:listRecentRooms", () => {
    if (!db) return [];
    const rows = db.prepare(`
      SELECT id, invite_code, title, last_joined_at
      FROM recent_rooms ORDER BY last_joined_at DESC LIMIT 20
    `).all() as Array<{ id: string; invite_code: string | null; title: string; last_joined_at: number }>;
    return rows.map<RecentRoom>((r) => ({
      id: r.id,
      inviteCode: r.invite_code,
      title: r.title,
      lastJoinedAt: r.last_joined_at,
    }));
  });

  ipc.handle("db:upsertRecentRoom", (_e, room: RecentRoom) => {
    if (!db) return;
    db.prepare(`
      INSERT INTO recent_rooms (id, invite_code, title, last_joined_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        invite_code = excluded.invite_code,
        title = excluded.title,
        last_joined_at = excluded.last_joined_at
    `).run(room.id, room.inviteCode ?? null, room.title, room.lastJoinedAt);
  });

  // ───────── AI history ─────────
  ipc.handle("db:appendAiMessage", (_e, scope: string, role: AiMessage["role"], content: string) => {
    if (!db) return null;
    const res = db.prepare(`
      INSERT INTO ai_history (scope, role, content, created_at) VALUES (?, ?, ?, ?)
    `).run(scope, role, content, Date.now());
    return Number(res.lastInsertRowid ?? 0);
  });

  ipc.handle("db:listAiMessages", (_e, scope: string, limit?: number) => {
    if (!db) return [];
    const rows = db.prepare(`
      SELECT id, scope, role, content, created_at
      FROM ai_history WHERE scope = ?
      ORDER BY created_at ASC LIMIT ?
    `).all(scope, Math.min(Math.max(limit ?? 200, 1), 1000)) as Array<{
      id: number; scope: string; role: AiMessage["role"]; content: string; created_at: number;
    }>;
    return rows.map<AiMessage>((r) => ({
      id: r.id,
      scope: r.scope,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    }));
  });

  ipc.handle("db:clearAiHistory", (_e, scope: string) => {
    if (!db) return;
    db.prepare("DELETE FROM ai_history WHERE scope = ?").run(scope);
  });
}
