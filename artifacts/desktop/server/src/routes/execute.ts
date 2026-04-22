import { Router } from "express";
import { authMiddleware } from "../auth.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

const router = Router();

const LANGUAGE_CONFIG: Record<string, { compile?: string[]; run: string[]; ext: string }> = {
  javascript: { run: ["node", "__FILE__"], ext: "js" },
  typescript: { run: ["npx", "--yes", "tsx", "__FILE__"], ext: "ts" },
  python: { run: ["python3", "__FILE__"], ext: "py" },
  c: { compile: ["gcc", "__FILE__", "-o", "__OUT__", "-lm"], run: ["__OUT__"], ext: "c" },
  cpp: { compile: ["g++", "__FILE__", "-o", "__OUT__", "-lm"], run: ["__OUT__"], ext: "cpp" },
  bash: { run: ["bash", "__FILE__"], ext: "sh" },
  shell: { run: ["bash", "__FILE__"], ext: "sh" },
  ruby: { run: ["ruby", "__FILE__"], ext: "rb" },
  go: { run: ["go", "run", "__FILE__"], ext: "go" },
};

const EXEC_TIMEOUT = 15_000;

router.post("/execute", authMiddleware, async (req, res) => {
  interface ExecuteBody { code?: string; language?: string; }
  const { code, language } = req.body as ExecuteBody;
  if (!code || !language) { res.status(400).json({ error: "code and language required" }); return; }

  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    res.json({ stdout: "", stderr: `Language "${language}" not supported`, exitCode: 1 });
    return;
  }

  const workDir = join(tmpdir(), `codesync-${randomUUID()}`);
  const filePath = join(workDir, `main.${config.ext}`);
  const outPath = join(workDir, "out");

  const startMs = Date.now();

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(filePath, code, "utf8");

    const resolvePath = (cmd: string) => cmd
      .replace("__FILE__", filePath)
      .replace("__OUT__", outPath);

    const runCmd = async (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return new Promise((resolveP) => {
        const [bin, ...rest] = args.map(resolvePath);
        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const proc = spawn(bin, rest, { cwd: workDir });
        const timer = setTimeout(() => {
          timedOut = true;
          proc.kill("SIGKILL");
        }, EXEC_TIMEOUT);

        proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        proc.on("close", (code) => {
          clearTimeout(timer);
          resolveP({
            stdout,
            stderr: timedOut ? "Execution timed out (15s)" : stderr,
            exitCode: timedOut ? 1 : (code ?? 0),
          });
        });
        proc.on("error", (err: NodeJS.ErrnoException) => {
          clearTimeout(timer);
          resolveP({ stdout: "", stderr: err.message, exitCode: 1 });
        });
      });
    };

    if (config.compile) {
      const compileResult = await runCmd(config.compile);
      if (compileResult.exitCode !== 0) {
        res.json({ ...compileResult, runtime: (Date.now() - startMs) / 1000, language });
        return;
      }
    }

    const result = await runCmd(config.run);
    res.json({ ...result, runtime: (Date.now() - startMs) / 1000, language });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
