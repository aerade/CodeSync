import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Replit-артефакт всегда передаёт PORT/BASE_PATH через workflow.
// Для standalone-сборки (electron:dist, локальная разработка вне Replit)
// дефолт жёстко согласован с `package.json` (wait-on + Electron VITE_DEV_URL),
// чтобы `pnpm dev` поднимался без дополнительных переменных окружения.
const DEFAULT_DESKTOP_PORT = 21098;
const rawPort = process.env.PORT ?? String(DEFAULT_DESKTOP_PORT);
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// В Electron-сборке renderer грузится через file:// — относительные пути
// должны работать, поэтому base="./" безопасен по умолчанию.
const basePath = process.env.BASE_PATH ?? "./";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
