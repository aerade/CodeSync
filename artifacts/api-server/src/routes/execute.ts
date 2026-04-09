import { Router } from "express";

const executeRouter = Router();

const PISTON_API = "https://emkc.org/api/v2/piston";

const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  python: { language: "python", version: "3.10.0" },
  go: { language: "go", version: "1.16.2" },
  rust: { language: "rust", version: "1.50.0" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "c++", version: "10.2.0" },
  c: { language: "c", version: "10.2.0" },
  ruby: { language: "ruby", version: "3.0.1" },
  php: { language: "php", version: "8.0.2" },
  csharp: { language: "csharp", version: "6.12.0" },
  kotlin: { language: "kotlin", version: "1.8.20" },
  swift: { language: "swift", version: "5.3.3" },
  bash: { language: "bash", version: "5.2.0" },
  shell: { language: "bash", version: "5.2.0" },
};

const FILE_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  go: "go",
  rust: "rs",
  java: "Main.java",
  cpp: "cpp",
  c: "c",
  ruby: "rb",
  php: "php",
  csharp: "cs",
  kotlin: "kt",
  swift: "swift",
  bash: "sh",
  shell: "sh",
};

executeRouter.post("/execute", async (req, res) => {
  const { code, language, stdin } = req.body as {
    code: string;
    language: string;
    stdin?: string;
  };

  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required" });
  }

  const pistonLang = LANGUAGE_MAP[language.toLowerCase()];
  if (!pistonLang) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const ext = FILE_EXTENSIONS[language.toLowerCase()] ?? "txt";
  const filename = ext.includes(".") ? ext : `code.${ext}`;

  try {
    const response = await fetch(`${PISTON_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ name: filename, content: code }],
        stdin: stdin ?? "",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `Piston API error: ${text}` });
    }

    const result = await response.json() as {
      run: { stdout: string; stderr: string; code: number; signal: string | null };
      compile?: { stdout: string; stderr: string; code: number };
    };

    return res.json({
      stdout: result.run.stdout,
      stderr: result.run.stderr,
      exitCode: result.run.code,
      compileOutput: result.compile ? `${result.compile.stdout}\n${result.compile.stderr}`.trim() : undefined,
    });
  } catch (err) {
    console.error("Piston API error:", err);
    return res.status(500).json({ error: "Failed to execute code" });
  }
});

export default executeRouter;
