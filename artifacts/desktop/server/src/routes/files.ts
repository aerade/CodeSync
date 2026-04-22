import { Router, Request, Response } from "express";
import { client, newId, now } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

function mapFile(f: Record<string, unknown>) {
  return {
    id: f.id, roomId: f.room_id, name: f.name, path: f.path,
    language: f.language, content: f.content,
    parentId: f.parent_id ?? null, isFolder: Boolean(f.is_folder),
    createdBy: f.created_by ?? null,
    createdAt: new Date(f.created_at as number).toISOString(),
    updatedAt: new Date(f.updated_at as number).toISOString(),
  };
}

router.get("/rooms/:roomId/files", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({
    sql: "SELECT * FROM files WHERE room_id = ? ORDER BY is_folder DESC, name ASC",
    args: [req.params.roomId],
  });
  res.json(result.rows.map(r => mapFile(r as unknown as Record<string, unknown>)));
});

router.post("/rooms/:roomId/files", authMiddleware, async (req: Request, res: Response) => {
  const { name, path: filePath, language, content, parentId, isFolder } = req.body as any;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }

  const id = newId();
  const ts = now();
  await client.execute({
    sql: "INSERT INTO files (id, room_id, name, path, language, content, parent_id, is_folder, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    args: [id, req.params.roomId, name.trim(), filePath ?? `/${name.trim()}`, language ?? "javascript",
      content ?? "", parentId ?? null, isFolder ? 1 : 0, req.user!.id, ts, ts],
  });

  const fileRes = await client.execute({ sql: "SELECT * FROM files WHERE id = ?", args: [id] });
  res.status(201).json(mapFile(fileRes.rows[0] as unknown as Record<string, unknown>));
});

router.get("/rooms/:roomId/files/:fileId", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({
    sql: "SELECT * FROM files WHERE id = ? AND room_id = ?",
    args: [req.params.fileId, req.params.roomId],
  });
  if (!result.rows.length) { res.status(404).json({ error: "File not found" }); return; }
  res.json(mapFile(result.rows[0] as unknown as Record<string, unknown>));
});

router.patch("/rooms/:roomId/files/:fileId", authMiddleware, async (req: Request, res: Response) => {
  const checkRes = await client.execute({
    sql: "SELECT id FROM files WHERE id = ? AND room_id = ?",
    args: [req.params.fileId, req.params.roomId],
  });
  if (!checkRes.rows.length) { res.status(404).json({ error: "File not found" }); return; }

  const { content, name, language } = req.body as any;
  const updates: string[] = [];
  const args: unknown[] = [];

  if (content !== undefined) { updates.push("content = ?"); args.push(content); }
  if (name !== undefined) { updates.push("name = ?"); args.push(name); }
  if (language !== undefined) { updates.push("language = ?"); args.push(language); }
  updates.push("updated_at = ?"); args.push(now());
  args.push(req.params.fileId);

  await client.execute({ sql: `UPDATE files SET ${updates.join(", ")} WHERE id = ?`, args });
  const updated = await client.execute({ sql: "SELECT * FROM files WHERE id = ?", args: [req.params.fileId] });
  res.json(mapFile(updated.rows[0] as unknown as Record<string, unknown>));
});

router.delete("/rooms/:roomId/files/:fileId", authMiddleware, async (req: Request, res: Response) => {
  await client.execute({
    sql: "DELETE FROM files WHERE id = ? AND room_id = ?",
    args: [req.params.fileId, req.params.roomId],
  });
  res.json({ ok: true });
});

export default router;
