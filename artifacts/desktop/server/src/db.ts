import { createClient, Client, Row } from "@libsql/client";
import { mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export let client: Client;

export function initDb(dbPath: string): void {
  const resolvedPath = dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`;
  const filePath = resolvedPath.startsWith("file:") ? resolvedPath.slice(5) : dbPath;
  const dir = path.dirname(filePath);
  if (dir && dir !== ".") {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  }

  client = createClient({ url: resolvedPath });
}

export async function setupSchema(): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      clerk_id TEXT UNIQUE,
      username TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      guest_token TEXT UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      is_private INTEGER NOT NULL DEFAULT 0,
      invite_code TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      max_users INTEGER NOT NULL DEFAULT 5,
      password TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#58A6FF',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      UNIQUE(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'javascript',
      content TEXT NOT NULL DEFAULT '',
      parent_id TEXT,
      is_folder INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS yjs_snapshots (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      UNIQUE(room_id, file_id)
    );
  `);
}

export function newId(): string {
  return randomUUID();
}

export function now(): number {
  return Date.now();
}

export function rowToObj(row: Row): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}
