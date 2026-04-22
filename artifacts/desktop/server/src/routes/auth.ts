import { Router, Request, Response } from "express";
import { client, newId, now } from "../db.js";
import { createGuestToken, createCollabToken, authMiddleware } from "../auth.js";
import { randomBytes } from "crypto";

const router = Router();

function mapUser(u: Record<string, unknown>) {
  return {
    id: u.id,
    username: u.username,
    email: u.email ?? null,
    avatarUrl: u.avatar_url ?? null,
    isGuest: Boolean(u.is_guest),
    createdAt: new Date(u.created_at as number).toISOString(),
  };
}

router.post("/auth/guest", async (req: Request, res: Response) => {
  const { username } = req.body as { username?: string };
  if (!username?.trim()) {
    res.status(400).json({ error: "username required" });
    return;
  }

  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE username = ? AND is_guest = 1 LIMIT 1",
    args: [username.trim()],
  });

  if (existing.rows.length > 0) {
    const userId = existing.rows[0].id as string;
    const token = createGuestToken(userId, username.trim());
    const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
    const user = userRes.rows[0] as unknown as Record<string, unknown>;
    res.json({ token, user: mapUser(user) });
    return;
  }

  const userId = newId();
  const guestToken = randomBytes(16).toString("hex");
  const ts = now();

  await client.execute({
    sql: "INSERT INTO users (id, username, is_guest, guest_token, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)",
    args: [userId, username.trim(), guestToken, ts, ts],
  });

  const token = createGuestToken(userId, username.trim());
  const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
  const user = userRes.rows[0] as unknown as Record<string, unknown>;
  res.json({ token, user: mapUser(user) });
});

router.get("/auth/me", authMiddleware, async (req: Request, res: Response) => {
  const userRes = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user!.id] });
  if (!userRes.rows.length) { res.status(404).json({ error: "User not found" }); return; }
  const user = userRes.rows[0] as unknown as Record<string, unknown>;
  res.json(mapUser(user));
});

router.post("/collab/token", authMiddleware, (req: Request, res: Response) => {
  const token = createCollabToken(req.user!.id, req.user!.username);
  res.json({ token });
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
