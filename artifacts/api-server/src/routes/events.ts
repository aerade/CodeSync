import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const eventsRouter = Router();

eventsRouter.get("/rooms/:roomId/events", async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

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
