import { Router, Request, Response } from "express";
import { client, newId, now } from "../db.js";
import { authMiddleware } from "../auth.js";
import { randomBytes } from "crypto";

const router = Router();

function mapRoom(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    isPrivate: Boolean(r.is_private),
    inviteCode: r.invite_code,
    ownerId: r.owner_id,
    maxUsers: r.max_users,
    memberCount: Number(r.member_count ?? 0),
    createdAt: new Date(r.created_at as number).toISOString(),
    updatedAt: new Date(r.updated_at as number).toISOString(),
  };
}

router.get("/rooms", authMiddleware, async (req: Request, res: Response) => {
  const { search } = req.query as { search?: string };
  const result = search
    ? await client.execute({
        sql: `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) as member_count
              FROM rooms r WHERE r.is_private = 0 AND r.title LIKE ? ORDER BY r.updated_at DESC LIMIT 50`,
        args: [`%${search}%`],
      })
    : await client.execute({
        sql: `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) as member_count
              FROM rooms r WHERE r.is_private = 0 ORDER BY r.updated_at DESC LIMIT 50`,
        args: [],
      });
  res.json(result.rows.map(r => mapRoom(r as unknown as Record<string, unknown>)));
});

router.post("/rooms", authMiddleware, async (req: Request, res: Response) => {
  const { title, description, isPrivate, maxUsers } = req.body as any;
  if (!title?.trim()) { res.status(400).json({ error: "title required" }); return; }

  const id = newId();
  const inviteCode = randomBytes(4).toString("hex").toUpperCase();
  const ts = now();

  await client.execute({
    sql: "INSERT INTO rooms (id, title, description, is_private, invite_code, owner_id, max_users, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [id, title.trim(), description ?? null, isPrivate ? 1 : 0, inviteCode, req.user!.id, maxUsers ?? 5, ts, ts],
  });

  const roomRes = await client.execute({
    sql: "SELECT *, 0 as member_count FROM rooms WHERE id = ?",
    args: [id],
  });
  res.status(201).json(mapRoom(roomRes.rows[0] as unknown as Record<string, unknown>));
});

router.get("/rooms/join/:code", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({
    sql: `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) as member_count
          FROM rooms r WHERE r.invite_code = ?`,
    args: [(req.params.code ?? "").toUpperCase()],
  });
  if (!result.rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(mapRoom(result.rows[0] as unknown as Record<string, unknown>));
});

router.get("/rooms/:id", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({
    sql: `SELECT r.*, (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) as member_count
          FROM rooms r WHERE r.id = ?`,
    args: [req.params.id],
  });
  if (!result.rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(mapRoom(result.rows[0] as unknown as Record<string, unknown>));
});

router.delete("/rooms/:id", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({ sql: "SELECT * FROM rooms WHERE id = ?", args: [req.params.id] });
  if (!result.rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  const room = result.rows[0] as unknown as Record<string, unknown>;
  if (room.owner_id !== req.user!.id) { res.status(403).json({ error: "Forbidden" }); return; }

  await client.executeMultiple(`
    DELETE FROM files WHERE room_id = '${req.params.id}';
    DELETE FROM room_members WHERE room_id = '${req.params.id}';
    DELETE FROM events WHERE room_id = '${req.params.id}';
    DELETE FROM rooms WHERE id = '${req.params.id}';
  `);
  res.json({ ok: true });
});

router.get("/rooms/:id/members", authMiddleware, async (req: Request, res: Response) => {
  const result = await client.execute({
    sql: "SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC",
    args: [req.params.id],
  });
  res.json(result.rows.map((m) => {
    const r = m as unknown as Record<string, unknown>;
    return {
      id: r.id, roomId: r.room_id, userId: r.user_id, username: r.username,
      avatarUrl: r.avatar_url ?? null, isGuest: Boolean(r.is_guest),
      color: r.color, joinedAt: new Date(r.joined_at as number).toISOString(),
    };
  }));
});

router.post("/rooms/:id/members", authMiddleware, async (req: Request, res: Response) => {
  const { color } = req.body as any;
  const ts = now();
  const id = newId();
  try {
    await client.execute({
      sql: "INSERT OR REPLACE INTO room_members (id, room_id, user_id, username, is_guest, color, joined_at) VALUES (?,?,?,?,?,?,?)",
      args: [id, req.params.id, req.user!.id, req.user!.username, req.user!.isGuest ? 1 : 0, color ?? "#58A6FF", ts],
    });
  } catch { /* ignore duplicate */ }
  res.json({ ok: true });
});

router.delete("/rooms/:id/members/:userId", authMiddleware, async (req: Request, res: Response) => {
  await client.execute({
    sql: "DELETE FROM room_members WHERE room_id = ? AND user_id = ?",
    args: [req.params.id, req.params.userId],
  });
  res.json({ ok: true });
});

export default router;
