import { Router, Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { execFile } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const executeRouter = Router();

const execRateLimits = new Map<string, { count: number; resetAt: number }>();
const EXEC_RATE_LIMIT = 15;
const EXEC_RATE_WINDOW = 60 * 1000;
const EXEC_TIMEOUT = 10_000;
const MAX_OUTPUT = 50_000;

function checkExecRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = execRateLimits.get(userId);
  if (!entry || entry.resetAt < now) {
    execRateLimits.set(userId, { count: 1, resetAt: now + EXEC_RATE_WINDOW });
    return true;
  }
  if (entry.count >= EXEC_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function resolveExecUserId(req: Request): Promise<string | null> {
  const auth = getAuth(req);
  if (auth?.userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });
    if (user) return user.id;
  }
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return user.id;
  }
  return null;
}

interface ExecConfig {
  compile?: { cmd: string; args: (tmpDir: string, srcFile: string) => string[] };
  run: { cmd: string; args: (tmpDir: string, srcFile: string) => string[] };
  ext: string;
}

const LANGUAGE_CONFIG: Record<string, ExecConfig> = {
  javascript: {
    run: { cmd: "node", args: (_d, f) => ["--no-addons", f] },
    ext: "js",
  },
  typescript: {
    run: { cmd: "npx", args: (_d, f) => ["--yes", "tsx", f] },
    ext: "ts",
  },
  c: {
    compile: { cmd: "gcc", args: (d, f) => [f, "-o", join(d, "a.out"), "-lm"] },
    run: { cmd: "", args: (d) => [join(d, "a.out")] },
    ext: "c",
  },
  cpp: {
    compile: { cmd: "g++", args: (d, f) => [f, "-o", join(d, "a.out"), "-lm"] },
    run: { cmd: "", args: (d) => [join(d, "a.out")] },
    ext: "cpp",
  },
  bash: {
    run: { cmd: "bash", args: (_d, f) => ["--restricted", f] },
    ext: "sh",
  },
  shell: {
    run: { cmd: "bash", args: (_d, f) => ["--restricted", f] },
    ext: "sh",
  },
  html: {
    run: { cmd: "", args: () => [] },
    ext: "html",
  },
};

const DANGEROUS_PATTERNS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /import\s+.*from\s+['"]child_process['"]/,
  /process\.env/,
  /execSync|spawnSync|exec\s*\(/,
  /rm\s+-rf\s+\//,
  /:(){ :|:& };:/,
  /fork\s*bomb/i,
  /\/etc\/passwd/,
  /\/proc\//,
  /DATABASE_URL/,
  /CLERK_SECRET/,
];

function containsDangerousCode(code: string, language: string): string | null {
  if (language === "html") return null;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return "Обнаружен потенциально опасный код. Файловые операции и системные команды ограничены.";
    }
  }
  return null;
}

function truncateOutput(str: string): string {
  if (str.length > MAX_OUTPUT) return str.slice(0, MAX_OUTPUT) + "\n... (вывод обрезан)";
  return str;
}

function getSafeEnv(): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: tmpdir(),
    LANG: "en_US.UTF-8",
    NODE_ENV: "sandbox",
    TERM: "dumb",
  };
}

function runProcess(
  cmd: string,
  args: string[],
  options: { timeout: number; stdin?: string; cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = execFile(cmd, args, {
      timeout: options.timeout,
      maxBuffer: MAX_OUTPUT * 2,
      cwd: options.cwd,
      env: getSafeEnv(),
    }, (error, stdout, stderr) => {
      const exitCode = error
        ? (proc.exitCode ?? 1)
        : 0;
      resolve({
        stdout: truncateOutput(String(stdout)),
        stderr: truncateOutput(String(stderr)),
        exitCode: typeof exitCode === "number" ? exitCode : 1,
      });
    });
    if (options.stdin && proc.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }
  });
}

executeRouter.post("/execute", async (req, res) => {
  const userId = await resolveExecUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Требуется авторизация для запуска кода" });
  }
  if (!checkExecRateLimit(userId)) {
    return res.status(429).json({ error: "Превышен лимит запросов. Подождите немного." });
  }

  const { code, language, stdin } = req.body as {
    code: string;
    language: string;
    stdin?: string;
  };

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  const langKey = language.toLowerCase();
  const config = LANGUAGE_CONFIG[langKey];
  if (!config) {
    return res.status(400).json({
      error: `Язык "${language}" не поддерживается для выполнения. Доступны: ${Object.keys(LANGUAGE_CONFIG).join(", ")}`,
    });
  }

  const dangerCheck = containsDangerousCode(code, langKey);
  if (dangerCheck) {
    return res.status(400).json({ error: dangerCheck });
  }

  if (langKey === "html") {
    return res.json({
      stdout: code,
      stderr: "",
      exitCode: 0,
      isHtml: true,
    });
  }

  const tmpDir = join(tmpdir(), `codesync-exec-${randomUUID()}`);
  const srcFile = join(tmpDir, `code.${config.ext}`);

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(srcFile, code, "utf-8");

    let compileOutput: string | undefined;

    if (config.compile) {
      const compileResult = await runProcess(
        config.compile.cmd,
        config.compile.args(tmpDir, srcFile),
        { timeout: EXEC_TIMEOUT, cwd: tmpDir }
      );
      if (compileResult.exitCode !== 0) {
        return res.json({
          stdout: "",
          stderr: compileResult.stderr || compileResult.stdout,
          exitCode: compileResult.exitCode,
          compileOutput: `${compileResult.stdout}\n${compileResult.stderr}`.trim(),
        });
      }
      compileOutput = `${compileResult.stdout}\n${compileResult.stderr}`.trim() || undefined;
    }

    let runCmd: string;
    let runArgs: string[];

    if (config.compile) {
      const allArgs = config.run.args(tmpDir, srcFile);
      runCmd = allArgs[0];
      runArgs = allArgs.slice(1);
    } else {
      runCmd = config.run.cmd;
      runArgs = config.run.args(tmpDir, srcFile);
    }

    const result = await runProcess(
      runCmd,
      runArgs,
      { timeout: EXEC_TIMEOUT, stdin: stdin || undefined, cwd: tmpDir }
    );

    return res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      compileOutput,
    });
  } catch (err) {
    console.error("Execution error:", err);
    return res.status(500).json({ error: "Ошибка при выполнении кода" });
  } finally {
    unlink(srcFile).catch(() => {});
    const outFile = join(tmpDir, "a.out");
    unlink(outFile).catch(() => {});
    import("fs/promises").then(fs => fs.rmdir(tmpDir).catch(() => {}));
  }
});

export default executeRouter;
