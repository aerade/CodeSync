/**
 * Минималистичный структурный логгер для рендерера CodeSync Desktop.
 *
 * Заменяет «тихие» catch {} на пары (контекст, error). Каждый вызов:
 *   - выводит сообщение с тегом и стэком в console
 *   - в нативной сборке дублирует короткое уведомление при level >= warn
 *   - может быть собран и просмотрен из dev-tools
 *
 * Это явное и единое место для отлова ошибок IPC/WS/fs.
 */
import { desktop } from "@/lib/desktopBridge";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  ts: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
};

const buffer: LogEntry[] = [];
const MAX_BUFFER = 500;
const PREFIX = "[CodeSync]";

function record(level: LogLevel, context: string, message: string, data?: unknown) {
  const entry: LogEntry = { ts: Date.now(), level, context, message, data };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);

  const tag = `${PREFIX} [${context}]`;
  switch (level) {
    case "debug": console.debug(tag, message, data ?? ""); break;
    case "info":  console.info(tag, message, data ?? "");  break;
    case "warn":  console.warn(tag, message, data ?? "");  break;
    case "error": console.error(tag, message, data ?? ""); break;
  }
}

export const log = {
  debug: (context: string, message: string, data?: unknown) => record("debug", context, message, data),
  info: (context: string, message: string, data?: unknown) => record("info", context, message, data),
  warn: (context: string, message: string, data?: unknown) => record("warn", context, message, data),
  error: (context: string, message: string, error?: unknown) => {
    const norm = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    record("error", context, message, norm);
    try { desktop().notify(`Ошибка: ${context}`, message); } catch { /* notify недоступен */ }
  },
  /** Список последних записей — пригодится для UI-диагностики. */
  tail: (limit = 100) => buffer.slice(-limit),
};

if (typeof window !== "undefined") {
  (window as Window & { __codesyncLog?: typeof log }).__codesyncLog = log;
}
