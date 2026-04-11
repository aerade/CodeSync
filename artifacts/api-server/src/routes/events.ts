import { Router, Request } from "express";
import { db } from "@workspace/db";
import { eventsTable, roomsTable, roomMembersTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const eventsRouter = Router();

async function resolveUserId(req: Request): Promise<string | null> {
  if (req.isAuthenticated()) return req.user.id;

  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return user.id;
  }

  return null;
}

async function canAccessRoom(roomId: string, userId: string | null): Promise<boolean> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return false;
  if (!room.isPrivate) return true;
  if (!userId) return false;
  const member = await db.query.roomMembersTable.findFirst({
    where: and(
      eq(roomMembersTable.roomId, roomId),
      eq(roomMembersTable.userId, userId)
    ),
  });
  return !!member;
}

eventsRouter.get("/rooms/:roomId/events", async (req, res) => {
  const { roomId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const queryParams = req.query as { limit?: string };
  const limit = Math.min(Number(queryParams.limit ?? 50), 200);

  const events = await db.query.eventsTable.findMany({
    where: eq(eventsTable.roomId, roomId),
    orderBy: [desc(eventsTable.createdAt)],
    limit,
  });

  return res.json(events.map((e) => ({
    id: e.id,
    roomId: e.roomId,
    userId: e.userId,
    username: e.username,
    type: e.type,
    description: e.description,
    createdAt: e.createdAt.toISOString(),
  })));
});

export default eventsRouter;
