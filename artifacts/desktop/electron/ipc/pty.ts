/**
 * Реальный терминал через node-pty.
 * Каждая сессия — отдельный процесс, идентифицируется uuid.
 */
import type { IpcMain, WebContents } from "electron";
import * as os from "os";
import { randomUUID } from "crypto";

interface PtyInstance {
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

const sessions = new Map<string, PtyInstance>();

function defaultShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC ?? "cmd.exe";
  return process.env.SHELL ?? "/bin/bash";
}

export function registerPtyHandlers(ipc: IpcMain, getWebContents: () => WebContents | null | undefined) {
  let pty: typeof import("node-pty") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pty = require("node-pty");
  } catch (err) {
    console.error("node-pty недоступен (native build не собрался?)", err);
  }

  ipc.handle("pty:create", (_e, opts: { cwd?: string; cols?: number; rows?: number; shell?: string } = {}) => {
    if (!pty) throw new Error("node-pty не установлен; терминал недоступен");
    const id = randomUUID();
    const shell = opts.shell ?? defaultShell();
    const cwd = opts.cwd && opts.cwd !== "" ? opts.cwd : os.homedir();
    const proc = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      cwd,
      env: process.env as Record<string, string>,
    }) as unknown as PtyInstance;

    proc.onData((data) => {
      getWebContents()?.send("pty:data", id, data);
    });
    proc.onExit(({ exitCode }) => {
      getWebContents()?.send("pty:exit", id, exitCode ?? 0);
      sessions.delete(id);
    });
    sessions.set(id, proc);
    return id;
  });

  ipc.on("pty:write", (_e, id: string, data: string) => {
    sessions.get(id)?.write(data);
  });
  ipc.on("pty:resize", (_e, id: string, cols: number, rows: number) => {
    try {
      sessions.get(id)?.resize(cols, rows);
    } catch {
      /* noop */
    }
  });
  ipc.on("pty:kill", (_e, id: string) => {
    try {
      sessions.get(id)?.kill();
    } catch {
      /* noop */
    }
    sessions.delete(id);
  });
}
