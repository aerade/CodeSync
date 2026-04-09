import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { fileSnapshotsTable, filesTable, usersTable, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const snapshotsRouter = Router();

interface ResolvedUser {
  userId: string;
  username: string;
  isGuest: boolean;
}

async function resolveUser(req: Request): Promise<ResolvedUser | null> {
  const auth = getAuth(req);
  if (auth?.userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });
    if (user) return { userId: user.id, username: user.username, isGuest: false };
  }
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return { userId: user.id, username: user.username, isGuest: true };
  }
  return null;
}

async function canReadRoom(roomId: string, userId: string | null): Promise<boolean> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return false;
  if (!room.isPrivate) return true;
  if (!userId) return false;
  const member = await db.query.roomMembersTable.findFirst({
    where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, userId)),
  });
  return !!member;
}

async function canWriteRoom(roomId: string, userId: string | null, isGuest = false): Promise<boolean> {
  if (!userId || isGuest) return false;
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return false;
  if (!room.isPrivate) return true;
  const member = await db.query.roomMembersTable.findFirst({
    where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, userId)),
  });
  return !!member;
}

snapshotsRouter.get("/rooms/:roomId/files/:fileId/snapshots", async (req: Request, res: Response) => {
  const roomId = req.params["roomId"] as string;
  const fileId = req.params["fileId"] as string;
  const user = await resolveUser(req);

  if (!(await canReadRoom(roomId, user?.userId ?? null))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });
  if (!file) return res.status(404).json({ error: "File not found" });

  const snapshots = await db.query.fileSnapshotsTable.findMany({
    where: and(
      eq(fileSnapshotsTable.fileId, fileId),
      eq(fileSnapshotsTable.roomId, roomId)
    ),
    orderBy: [desc(fileSnapshotsTable.createdAt)],
    limit: 50,
  });

  return res.json(snapshots.map((s) => ({
    id: s.id,
    fileId: s.fileId,
    roomId: s.roomId,
    content: s.content,
    authorId: s.authorId,
    authorName: s.authorName,
    createdAt: s.createdAt.toISOString(),
  })));
});

snapshotsRouter.post("/rooms/:roomId/files/:fileId/snapshots", async (req: Request, res: Response) => {
  const roomId = req.params["roomId"] as string;
  const fileId = req.params["fileId"] as string;
  const user = await resolveUser(req);

  if (!(await canWriteRoom(roomId, user?.userId ?? null, user?.isGuest ?? false))) {
    return res.status(user ? 403 : 401).json({ error: user?.isGuest ? "Guests cannot create snapshots" : user ? "Forbidden" : "Authentication required" });
  }

  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });
  if (!file) return res.status(404).json({ error: "File not found" });

  const body = req.body as { content?: unknown; authorName?: unknown };
  const content = typeof body.content === "string" ? body.content : file.content;
  const authorName = typeof body.authorName === "string" ? body.authorName : user!.username;

  const [snapshot] = await db.insert(fileSnapshotsTable).values({
    fileId,
    roomId,
    content,
    authorId: user!.userId,
    authorName,
  }).returning();

  return res.status(201).json({
    id: snapshot.id,
    fileId: snapshot.fileId,
    roomId: snapshot.roomId,
    content: snapshot.content,
    authorId: snapshot.authorId,
    authorName: snapshot.authorName,
    createdAt: snapshot.createdAt.toISOString(),
  });
});

snapshotsRouter.post("/rooms/:roomId/files/:fileId/snapshots/:snapshotId/restore", async (req: Request, res: Response) => {
  const roomId = req.params["roomId"] as string;
  const fileId = req.params["fileId"] as string;
  const snapshotId = req.params["snapshotId"] as string;
  const user = await resolveUser(req);

  if (!(await canWriteRoom(roomId, user?.userId ?? null, user?.isGuest ?? false))) {
    return res.status(user ? 403 : 401).json({ error: user?.isGuest ? "Guests cannot restore snapshots" : user ? "Forbidden" : "Authentication required" });
  }

  const snapshot = await db.query.fileSnapshotsTable.findFirst({
    where: and(
      eq(fileSnapshotsTable.id, snapshotId),
      eq(fileSnapshotsTable.fileId, fileId),
      eq(fileSnapshotsTable.roomId, roomId)
    ),
  });
  if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

  const [file] = await db.update(filesTable)
    .set({ content: snapshot.content, updatedAt: new Date() })
    .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)))
    .returning();

  if (!file) return res.status(404).json({ error: "File not found" });

  await db.insert(fileSnapshotsTable).values({
    fileId,
    roomId,
    content: snapshot.content,
    authorId: user!.userId,
    authorName: user!.username,
  }).catch(() => {});

  return res.json({
    id: file.id,
    content: file.content,
    updatedAt: file.updatedAt.toISOString(),
  });
});

export async function saveFileSnapshot(
  fileId: string,
  roomId: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<void> {
  try {
    await db.insert(fileSnapshotsTable).values({
      fileId,
      roomId,
      content,
      authorId,
      authorName,
    });
  } catch (err) {
    console.error("Error saving file snapshot:", err);
  }
}

export default snapshotsRouter;
