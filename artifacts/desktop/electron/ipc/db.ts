/**
 * Локальная SQLite-база на better-sqlite3.
 * Хранит:
 *   - projects (последние открытые проекты)
 *   - settings (key/value пользовательских настроек)
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

interface DbInstance {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
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
    `);
    return inst;
  } catch (err) {
    console.error("better-sqlite3 недоступен (native build не собрался?)", err);
    return null;
  }
}

export function registerDbHandlers(ipc: IpcMain, userDataDir: string) {
  db = init(userDataDir);

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
}
