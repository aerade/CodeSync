import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    py: "python", pyw: "python",
    go: "go", rs: "rust", rb: "ruby", php: "php",
    java: "java", kt: "kotlin", swift: "swift",
    c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
    cs: "csharp",
    html: "html", htm: "html", css: "css", scss: "scss", less: "less",
    json: "json", jsonc: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", mdx: "markdown",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    sql: "sql",
    xml: "xml",
    vue: "html", svelte: "html",
    txt: "plaintext",
    env: "shell",
    dockerfile: "dockerfile",
    gitignore: "plaintext",
  };
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  return map[ext] ?? "plaintext";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

export function shortPath(p: string, max = 40): string {
  if (p.length <= max) return p;
  const parts = p.split(/[\\/]/);
  if (parts.length <= 2) return "…" + p.slice(-(max - 1));
  return parts[0] + "/…/" + parts.slice(-2).join("/");
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function modKey(): string {
  return isMac() ? "⌘" : "Ctrl";
}
