import { dialog, type IpcMain } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const IGNORED = new Set([".git", "node_modules", ".DS_Store", ".venv", "dist", ".next", "__pycache__"]);

export function registerFsHandlers(ipc: IpcMain) {
  ipc.handle("fs:pickDirectory", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipc.handle("fs:pickFile", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openFile"] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipc.handle("fs:readDir", async (_e, dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: Array<{ name: string; path: string; isDirectory: boolean; size?: number; modifiedAt?: number }> = [];
    for (const ent of entries) {
      if (IGNORED.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      try {
        const st = await fs.stat(full);
        out.push({
          name: ent.name,
          path: full,
          isDirectory: ent.isDirectory(),
          size: ent.isFile() ? st.size : undefined,
          modifiedAt: st.mtimeMs,
        });
      } catch {
        out.push({ name: ent.name, path: full, isDirectory: ent.isDirectory() });
      }
    }
    return out;
  });

  ipc.handle("fs:readFile", async (_e, p: string) => {
    return fs.readFile(p, "utf8");
  });

  ipc.handle("fs:writeFile", async (_e, p: string, content: string) => {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf8");
  });

  ipc.handle("fs:createFile", async (_e, p: string, content: string) => {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, { encoding: "utf8", flag: "wx" });
  });

  ipc.handle("fs:createDir", async (_e, p: string) => {
    await fs.mkdir(p, { recursive: true });
  });

  ipc.handle("fs:rename", async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath);
  });

  ipc.handle("fs:remove", async (_e, p: string) => {
    await fs.rm(p, { recursive: true, force: true });
  });

  ipc.handle("fs:exists", async (_e, p: string) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  });

  ipc.handle("fs:homeDir", async () => os.homedir());
}
