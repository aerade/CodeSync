import { Router, Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { roomsTable, roomMembersTable, usersTable, filesTable } from "@workspace/db";
import { eq, and, ilike, count, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { nanoid } from "nanoid";

const roomsRouter = Router();

const COLLAB_COLORS = [
  "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
  "#F2CC60", "#79C0FF", "#56D364", "#FF7B72",
];

function getCollaboratorColor(index: number): string {
  return COLLAB_COLORS[index % COLLAB_COLORS.length];
}

interface ResolvedUser {
  userId: string;
  username: string;
  email: string | null | undefined;
  isGuest: boolean;
}

async function resolveUser(req: Request): Promise<ResolvedUser | null> {
  // Always prefer Clerk auth over guest token — a signed-in user should never
  // be treated as guest even if they have a stale guest token in storage.
  const auth = getAuth(req);
  if (auth?.userId) {
    const sessionClaims = auth.sessionClaims as Record<string, string> | undefined;

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });

    if (!user) {
      const newId = uuidv4();
      const username =
        sessionClaims?.["username"] ??
        sessionClaims?.["email"]?.split("@")[0] ??
        `user_${newId.slice(0, 8)}`;
      const [created] = await db.insert(usersTable).values({
        id: newId,
        clerkId: auth.userId,
        username,
        email: sessionClaims?.["email"],
        isGuest: false,
      }).returning();
      user = created;
    }

    if (user) return { userId: user.id, username: user.username, email: user.email, isGuest: false };
  }

  // Only fall back to guest token when there is no Clerk session
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) {
      return { userId: user.id, username: user.username, email: user.email, isGuest: true };
    }
  }

  return null;
}

async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const member = await db.query.roomMembersTable.findFirst({
    where: and(
      eq(roomMembersTable.roomId, roomId),
      eq(roomMembersTable.userId, userId)
    ),
  });
  return !!member;
}

async function ensureRoomAccess(
  roomId: string,
  userId: string | null,
  isPrivate: boolean
): Promise<boolean> {
  if (!isPrivate) return true;
  if (!userId) return false;
  return isRoomMember(roomId, userId);
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

  const body = req.body as { title?: unknown; description?: unknown; isPrivate?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const isPrivate = body.isPrivate === true || body.isPrivate === "true";

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const inviteCode = nanoid(8).toUpperCase();

  const [room] = await db.insert(roomsTable).values({
    title,
    description: description || undefined,
    isPrivate,
    inviteCode,
    ownerId: user.userId,
  }).returning();

  await db.insert(filesTable).values({
    roomId: room.id,
    name: "main.js",
    path: "/main.js",
    language: "javascript",
    content: "// Добро пожаловать в CodeSync!\n// Начните писать код здесь\n\nconsole.log('Hello, World!');\n",
    isFolder: false,
    createdBy: user.userId,
  });

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

  // Add the requesting user to room_members if authenticated
  const user = await resolveUser(req);
  if (user) {
    const existingCount = await db
      .select({ count: count() })
      .from(roomMembersTable)
      .where(eq(roomMembersTable.roomId, room.id));

    const memberIndex = Number(existingCount[0]?.count ?? 0);
    await db.insert(roomMembersTable).values({
      roomId: room.id,
      userId: user.userId,
      username: user.username,
      isGuest: user.isGuest,
      color: getCollaboratorColor(memberIndex),
    }).onConflictDoNothing();
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

  if (room.isPrivate) {
    const user = await resolveUser(req);
    const hasAccess = await ensureRoomAccess(roomId, user?.userId ?? null, room.isPrivate);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }
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

  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });

  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.isPrivate) {
    const user = await resolveUser(req);
    const hasAccess = await ensureRoomAccess(roomId, user?.userId ?? null, room.isPrivate);
    if (!hasAccess) return res.status(403).json({ error: "Forbidden" });
  }

  const members = await db.query.roomMembersTable.findMany({
    where: eq(roomMembersTable.roomId, roomId),
    orderBy: [desc(roomMembersTable.joinedAt)],
  });

  return res.json(members.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    isGuest: m.isGuest,
    color: m.color,
    joinedAt: m.joinedAt.toISOString(),
  })));
});

export default roomsRouter;
