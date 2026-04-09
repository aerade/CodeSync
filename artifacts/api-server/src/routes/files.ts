import { Router, Request } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { filesTable, usersTable, eventsTable, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const filesRouter = Router();

async function resolveUserId(req: Request): Promise<string | null> {
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return user.id;
  }
  const auth = getAuth(req);
  if (auth?.userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });
    return user?.id ?? null;
  }
  return null;
}

async function resolveUsername(userId: string): Promise<string> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return user?.username ?? "Аноним";
}

/** Check if user can access room (public rooms are always accessible) */
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

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", go: "go", rs: "rust", java: "java", cpp: "cpp", c: "c",
    cs: "csharp", rb: "ruby", php: "php", html: "html", css: "css",
    json: "json", md: "markdown", sh: "shell", yaml: "yaml", yml: "yaml",
    sql: "sql", kt: "kotlin", swift: "swift",
  };
  return langMap[ext] ?? "plaintext";
}

filesRouter.get("/rooms/:roomId/files", async (req, res) => {
  const { roomId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const files = await db.query.filesTable.findMany({
    where: eq(filesTable.roomId, roomId),
    orderBy: (f, { asc }) => [asc(f.path)],
  });

  return res.json(files.map((f) => ({
    id: f.id,
    roomId: f.roomId,
    name: f.name,
    path: f.path,
    language: f.language,
    content: f.content,
    parentId: f.parentId,
    isFolder: f.isFolder,
    createdBy: f.createdBy,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  })));
});

filesRouter.post("/rooms/:roomId/files", async (req, res) => {
  const { roomId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = req.body as {
    name?: unknown;
    path?: unknown;
    language?: unknown;
    content?: unknown;
    parentId?: unknown;
    isFolder?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const path = typeof body.path === "string" ? body.path : "";

  if (!name || !path) {
    return res.status(400).json({ error: "Name and path are required" });
  }

  const language = typeof body.language === "string" ? body.language : detectLanguage(name);
  const content = typeof body.content === "string" ? body.content : "";
  const isFolder = body.isFolder === true;
  const parentId = typeof body.parentId === "string" ? body.parentId : null;

  const [file] = await db.insert(filesTable).values({
    roomId,
    name,
    path,
    language,
    content,
    parentId,
    isFolder,
    createdBy: userId ?? undefined,
  }).returning();

  if (userId) {
    const username = await resolveUsername(userId);
    await db.insert(eventsTable).values({
      roomId,
      userId,
      username,
      type: "file_created",
      description: `Создал ${isFolder ? "папку" : "файл"} ${name}`,
    }).catch(() => {});
  }

  return res.status(201).json({
    id: file.id,
    roomId: file.roomId,
    name: file.name,
    path: file.path,
    language: file.language,
    content: file.content,
    parentId: file.parentId,
    isFolder: file.isFolder,
    createdBy: file.createdBy,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.get("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });

  if (!file) return res.status(404).json({ error: "File not found" });

  return res.json({
    id: file.id,
    roomId: file.roomId,
    name: file.name,
    path: file.path,
    language: file.language,
    content: file.content,
    parentId: file.parentId,
    isFolder: file.isFolder,
    createdBy: file.createdBy,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.patch("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = req.body as {
    name?: unknown;
    path?: unknown;
    language?: unknown;
    content?: unknown;
    parentId?: unknown;
  };

  const updates: Partial<{
    name: string;
    path: string;
    language: string;
    content: string;
    parentId: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.path === "string") updates.path = body.path;
  if (typeof body.language === "string") updates.language = body.language;
  if (typeof body.content === "string") updates.content = body.content;
  if (body.parentId === null || typeof body.parentId === "string") {
    updates.parentId = body.parentId as string | null;
  }

  const [file] = await db.update(filesTable)
    .set(updates)
    .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)))
    .returning();

  if (!file) return res.status(404).json({ error: "File not found" });

  return res.json({
    id: file.id,
    roomId: file.roomId,
    name: file.name,
    path: file.path,
    language: file.language,
    content: file.content,
    parentId: file.parentId,
    isFolder: file.isFolder,
    createdBy: file.createdBy,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.delete("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const userId = await resolveUserId(req);

  if (!(await canAccessRoom(roomId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });

  if (!file) return res.status(404).json({ error: "File not found" });

  await db.delete(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)));

  if (userId) {
    const username = await resolveUsername(userId);
    await db.insert(eventsTable).values({
      roomId,
      userId,
      username,
      type: "file_deleted",
      description: `Удалил ${file.isFolder ? "папку" : "файл"} ${file.name}`,
    }).catch(() => {});
  }

  return res.status(204).send();
});

export default filesRouter;
