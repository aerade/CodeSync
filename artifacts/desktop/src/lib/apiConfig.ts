/**
 * Единая конфигурация подключения к api-server для CodeSync Desktop.
 *
 * Источник адреса (по приоритету):
 *   1. ключ настройки `apiBaseUrl` в локальной SQLite (видим/правим в SettingsPanel)
 *   2. переменная окружения сборки `VITE_CODESYNC_API`
 *   3. текущий origin (для случая, когда renderer открыт в Replit рядом с api-server
 *      или электрон обращается к локальному dev-серверу)
 *
 * Возвращает абсолютный HTTP/HTTPS URL без хвостового слэша,
 * а также производный WS URL (`ws://` / `wss://`).
 */
import { desktop, isElectron } from "@/lib/desktopBridge";

const SETTING_KEY = "apiBaseUrl";

let cached: string | null = null;
let cachedAuthToken: string | null = null;

/** Сбрасывает кэш — вызывать после изменения настройки. */
export function invalidateApiConfig() {
  cached = null;
  cachedAuthToken = null;
}

function fallbackBase(): string {
  const envBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CODESYNC_API;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:5000";
}

/**
 * Базовый HTTP URL api-server.
 * В Electron берётся из локальной SQLite, в браузере — из localStorage (через bridge fallback).
 */
export async function getApiBase(): Promise<string> {
  if (cached !== null) return cached;
  const stored = await desktop().db.getSetting(SETTING_KEY).catch(() => null);
  const base = (stored && stored.trim()) ? stored.trim().replace(/\/$/, "") : fallbackBase();
  cached = base;
  return base;
}

/** Меняет адрес api-server и сбрасывает кэш. */
export async function setApiBase(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, "");
  await desktop().db.setSetting(SETTING_KEY, clean);
  cached = clean;
}

/** Производный WS URL (ws://… или wss://…). */
export async function getWsBase(): Promise<string> {
  const base = await getApiBase();
  if (base.startsWith("https://")) return "wss://" + base.slice("https://".length);
  if (base.startsWith("http://")) return "ws://" + base.slice("http://".length);
  // относительный путь — выводим из window
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:5000";
}

/** Достаёт гостевой токен из локальной БД (или возвращает null). */
export async function getGuestToken(): Promise<string | null> {
  if (cachedAuthToken !== null) return cachedAuthToken || null;
  const tok = await desktop().db.getSetting("guestToken").catch(() => null);
  cachedAuthToken = tok ?? "";
  return cachedAuthToken || null;
}

/** Сохраняет гостевой токен и сбрасывает кэш. */
export async function setGuestToken(token: string | null): Promise<void> {
  await desktop().db.setSetting("guestToken", token ?? "");
  cachedAuthToken = token ?? "";
}

/**
 * Универсальный fetch к api-server: подставляет base URL и `x-guest-token`.
 * Не глотает ошибки — пробрасывает их вызывающему.
 */
export async function apiFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const base = await getApiBase();
  const token = await getGuestToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has("x-guest-token")) headers.set("x-guest-token", token);
  // относительный путь vs Electron-абсолютный
  const url = pathname.startsWith("http") ? pathname : `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  // в браузерном режиме оставляем cookie/credentials, в Electron они не нужны
  const credentials: RequestCredentials = isElectron() ? "omit" : "include";
  return fetch(url, { ...init, headers, credentials });
}
