import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { roomsTable, roomMembersTable, usersTable, filesTable } from "@workspace/db";
import { eq, and, ilike, count, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { nanoid } from "nanoid";

const roomsRouter = Router();

async function resolveUser(req: any): Promise<{ userId: string; username: string; isGuest: boolean } | null> {
  const guestToken = req.headers["x-guest-token"] as string | undefined;
  if (guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return { userId: user.id, username: user.username, isGuest: true };
  }

  const auth = getAuth(req);
  if (!auth?.userId) return null;

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, auth.userId),
  });

  if (!user) {
    const newId = uuidv4();
    const username = (auth as any)?.sessionClaims?.username ||
      (auth as any)?.sessionClaims?.email?.split("@")[0] ||
      `user_${newId.slice(0, 8)}`;
    const [created] = await db.insert(usersTable).values({
      id: newId,
      clerkId: auth.userId,
      username: username as string,
      isGuest: false,
    }).returning();
    user = created;
  }

  if (!user) return null;
  return { userId: user.id, username: user.username, isGuest: false };
}

roomsRouter.get("/rooms", async (req, res) => {
  const { search } = req.query as { search?: string };

  const rooms = await db.query.roomsTable.findMany({
    where: search
      ? and(eq(roomsTable.isPrivate, false), ilike(roomsTable.title, `%${search}%`))
      : eq(roomsTable.isPrivate, false),
    orderBy: [desc(roomsTable.createdAt)],
    limit: 50,
  });

  const roomsWithCounts = await Promise.all(
    rooms.map(async (room) => {
      const [memberCountResult] = await db
        .select({ count: count() })
        .from(roomMembersTable)
        .where(eq(roomMembersTable.roomId, room.id));

      return {
        ...room,
        memberCount: Number(memberCountResult?.count ?? 0),
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
      };
    })
  );

  return res.json(roomsWithCounts);
});

roomsRouter.post("/rooms", async (req, res) => {
  const user = await resolveUser(req);
  if (!user || user.isGuest) {
    return res.status(401).json({ error: "Authentication required to create rooms" });
  }

  const { title, description, isPrivate } = req.body as { title: string; description?: string; isPrivate?: boolean };
  if (!title || typeof title !== "string" || title.trim().length < 1) {
    return res.status(400).json({ error: "Title is required" });
  }

  const inviteCode = nanoid(8).toUpperCase();

  const [room] = await db.insert(roomsTable).values({
    title: title.trim(),
    description: description?.trim(),
    isPrivate: isPrivate ?? false,
    inviteCode,
    ownerId: user.userId,
  }).returning();

  const defaultFile = await db.insert(filesTable).values({
    roomId: room.id,
    name: "main.js",
    path: "/main.js",
    language: "javascript",
    content: "// Добро пожаловать в CodeSync!\n// Начните писать код здесь\n\nconsole.log('Hello, World!');\n",
    isFolder: false,
    createdBy: user.userId,
  }).returning();

  await db.insert(roomMembersTable).values({
    roomId: room.id,
    userId: user.userId,
    username: user.username,
    isGuest: false,
    color: getCollaboratorColor(0),
  }).onConflictDoNothing();

  return res.status(201).json({
    ...room,
    memberCount: 1,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  });
});

roomsRouter.get("/rooms/join/:inviteCode", async (req, res) => {
  const { inviteCode } = req.params;
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.inviteCode, inviteCode.toUpperCase()),
  });

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(roomMembersTable)
    .where(eq(roomMembersTable.roomId, room.id));

  return res.json({
    ...room,
    memberCount: Number(memberCountResult?.count ?? 0),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  });
});

roomsRouter.get("/rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const [memberCountResult] = await db
    .select({ count: count() })
    .from(roomMembersTable)
    .where(eq(roomMembersTable.roomId, room.id));

  return res.json({
    ...room,
    memberCount: Number(memberCountResult?.count ?? 0),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  });
});

roomsRouter.delete("/rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });

  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.ownerId !== user.userId) return res.status(403).json({ error: "Forbidden" });

  await db.delete(roomMembersTable).where(eq(roomMembersTable.roomId, roomId));
  await db.delete(filesTable).where(eq(filesTable.roomId, roomId));
  await db.delete(roomsTable).where(eq(roomsTable.id, roomId));

  return res.status(204).send();
});

roomsRouter.get("/rooms/:roomId/members", async (req, res) => {
  const { roomId } = req.params;
  const members = await db.query.roomMembersTable.findMany({
    where: eq(roomMembersTable.roomId, roomId),
    orderBy: [desc(roomMembersTable.joinedAt)],
  });

  return res.json(members.map((m) => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
  })));
});

function getCollaboratorColor(index: number): string {
  const colors = [
    "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
    "#F2CC60", "#79C0FF", "#56D364", "#FF7B72",
  ];
  return colors[index % colors.length];
}

export default roomsRouter;
