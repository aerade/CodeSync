import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import * as pty from "node-pty";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const EXEC_TIMEOUT = 60_000;

const LANGUAGE_CONFIG: Record<string, { compile?: string[]; run: string[]; ext: string }> = {
  javascript: { run: ["node", "--no-addons", "__FILE__"], ext: "js" },
  typescript: { run: ["npx", "--yes", "tsx", "__FILE__"], ext: "ts" },
  python: { run: ["python3", "__FILE__"], ext: "py" },
  c: { compile: ["gcc", "__FILE__", "-o", "__OUT__", "-lm"], run: ["__OUT__"], ext: "c" },
  cpp: { compile: ["g++", "__FILE__", "-o", "__OUT__", "-lm"], run: ["__OUT__"], ext: "cpp" },
  bash: { run: ["bash", "--restricted", "__FILE__"], ext: "sh" },
  shell: { run: ["bash", "--restricted", "__FILE__"], ext: "sh" },
};

const DANGEROUS_PATTERNS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /import\s+.*from\s+['"]child_process['"]/,
  /process\.env/,
  /execSync|spawnSync/,
  /rm\s+-rf\s+\//,
  /:(){ :|:& };:/,
  /\/etc\/passwd/,
  /DATABASE_URL/,
  /CLERK_SECRET/,
];

function containsDangerousCode(code: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) return true;
  }
  return false;
}

function getSafeEnv(): Record<string, string> {
  return {
    PATH: process.env["PATH"] ?? "/usr/bin:/bin",
    HOME: tmpdir(),
    LANG: "en_US.UTF-8",
    NODE_ENV: "sandbox",
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  };
}

export function setupPtyServer(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? "";
    if (!url.startsWith("/ws/pty")) return;

    let ptyProcess: pty.IPty | null = null;
    let tmpDir: string | null = null;
    let killTimeout: ReturnType<typeof setTimeout> | null = null;

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          code?: string;
          language?: string;
          cols?: number;
          rows?: number;
          input?: string;
        };

        if (msg.type === "start") {
          if (ptyProcess) {
            ptyProcess.kill();
            ptyProcess = null;
          }

          const { code = "", language = "" } = msg;
          const langKey = language.toLowerCase();
          const config = LANGUAGE_CONFIG[langKey];

          if (!config) {
            ws.send(JSON.stringify({ type: "output", data: `\r\nЯзык "${language}" не поддерживается.\r\n` }));
            ws.send(JSON.stringify({ type: "exit", code: 1 }));
            return;
          }

          if (containsDangerousCode(code)) {
            ws.send(JSON.stringify({ type: "output", data: "\r\nОбнаружен потенциально опасный код. Запуск отклонён.\r\n" }));
            ws.send(JSON.stringify({ type: "exit", code: 1 }));
            return;
          }

          const id = randomUUID();
          tmpDir = join(tmpdir(), `codesync-pty-${id}`);
          const srcFile = join(tmpDir, `code.${config.ext}`);
          const outFile = join(tmpDir, "a.out");

          await mkdir(tmpDir, { recursive: true });
          await writeFile(srcFile, code, "utf-8");

          const cols = msg.cols ?? 80;
          const rows = msg.rows ?? 24;
          const env = getSafeEnv();

          if (config.compile) {
            const compileArgs = config.compile.map((a) =>
              a === "__FILE__" ? srcFile : a === "__OUT__" ? outFile : a
            );
            ws.send(JSON.stringify({ type: "output", data: "\r\n\x1b[90m=== Компиляция ===\x1b[0m\r\n" }));
            const compileProc = pty.spawn(compileArgs[0], compileArgs.slice(1), {
              name: "xterm-256color",
              cols,
              rows,
              cwd: tmpDir,
              env,
            });
            const compileOutput: string[] = [];
            compileProc.onData((d) => {
              compileOutput.push(d);
              ws.send(JSON.stringify({ type: "output", data: d }));
            });
            await new Promise<void>((resolve) => {
              compileProc.onExit(({ exitCode }) => {
                if (exitCode !== 0) {
                  ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[31mОшибка компиляции (код ${exitCode})\x1b[0m\r\n` }));
                  ws.send(JSON.stringify({ type: "exit", code: exitCode }));
                  cleanUp();
                }
                resolve();
              });
            });
            if (!tmpDir) return;
            ws.send(JSON.stringify({ type: "output", data: "\r\n\x1b[90m=== Запуск ===\x1b[0m\r\n" }));
          }

          const runArgs = config.run.map((a) =>
            a === "__FILE__" ? srcFile : a === "__OUT__" ? outFile : a
          );

          ptyProcess = pty.spawn(runArgs[0], runArgs.slice(1), {
            name: "xterm-256color",
            cols,
            rows,
            cwd: tmpDir,
            env,
          });

          ptyProcess.onData((d) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "output", data: d }));
            }
          });

          ptyProcess.onExit(({ exitCode }) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "exit", code: exitCode }));
            }
            cleanUp();
          });

          killTimeout = setTimeout(() => {
            if (ptyProcess) {
              ptyProcess.kill();
              ws.send(JSON.stringify({ type: "output", data: "\r\n\x1b[33mВремя выполнения истекло (60с).\x1b[0m\r\n" }));
              ws.send(JSON.stringify({ type: "exit", code: 124 }));
            }
          }, EXEC_TIMEOUT);

        } else if (msg.type === "input" && ptyProcess) {
          ptyProcess.write(msg.input ?? "");

        } else if (msg.type === "resize" && ptyProcess) {
          ptyProcess.resize(msg.cols ?? 80, msg.rows ?? 24);
        }
      } catch (err) {
        console.error("PTY message error:", err);
      }
    });

    function cleanUp() {
      if (killTimeout) { clearTimeout(killTimeout); killTimeout = null; }
      ptyProcess = null;
      if (tmpDir) {
        const dir = tmpDir;
        tmpDir = null;
        rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }

    ws.on("close", () => {
      if (ptyProcess) { ptyProcess.kill(); }
      cleanUp();
    });

    ws.on("error", (err) => {
      console.error("PTY WS error:", err);
    });
  });
}
