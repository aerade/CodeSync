import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
    cs: "csharp", rb: "ruby", php: "php", html: "html", css: "css",
    scss: "scss", json: "json", md: "markdown", yaml: "yaml", yml: "yaml",
    sh: "shell", bash: "shell", sql: "sql", kt: "kotlin", swift: "swift",
    dart: "dart", toml: "toml", xml: "xml",
  };
  return map[ext] ?? "plaintext";
}

export function getFileIcon(name: string, isFolder = false): string {
  if (isFolder) return "folder";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "react", js: "javascript", jsx: "react",
    py: "python", rs: "rust", go: "go", java: "java",
    html: "html", css: "css", json: "json", md: "markdown",
  };
  return map[ext] ?? "file";
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export function generateUserColor(userId: string): string {
  const colors = [
    "#7C6FF7", "#EC4899", "#06B6D4", "#10B981",
    "#F59E0B", "#EF4444", "#8B5CF6", "#6366F1",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
