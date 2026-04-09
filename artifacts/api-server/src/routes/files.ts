import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { filesTable, usersTable, eventsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const filesRouter = Router();

async function resolveUserId(req: any): Promise<string | null> {
  const guestToken = req.headers["x-guest-token"] as string | undefined;
  if (guestToken) {
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

filesRouter.get("/rooms/:roomId/files", async (req, res) => {
  const { roomId } = req.params;
  const files = await db.query.filesTable.findMany({
    where: eq(filesTable.roomId, roomId),
    orderBy: (f, { asc }) => [asc(f.path)],
  });

  return res.json(files.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  })));
});

filesRouter.post("/rooms/:roomId/files", async (req, res) => {
  const { roomId } = req.params;
  const userId = await resolveUserId(req);

  const { name, path, language, content, parentId, isFolder } = req.body as {
    name: string;
    path: string;
    language?: string;
    content?: string;
    parentId?: string;
    isFolder?: boolean;
  };

  if (!name || !path) {
    return res.status(400).json({ error: "Name and path are required" });
  }

  const [file] = await db.insert(filesTable).values({
    roomId,
    name: name.trim(),
    path,
    language: language ?? detectLanguage(name),
    content: content ?? "",
    parentId: parentId ?? null,
    isFolder: isFolder ?? false,
    createdBy: userId ?? undefined,
  }).returning();

  if (userId) {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (user) {
      await db.insert(eventsTable).values({
        roomId,
        userId,
        username: user.username,
        type: "file_created",
        description: `Создал ${isFolder ? "папку" : "файл"} ${name}`,
      });
    }
  }

  return res.status(201).json({
    ...file,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.get("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });

  if (!file) return res.status(404).json({ error: "File not found" });

  return res.json({
    ...file,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.patch("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const updates = req.body as {
    name?: string;
    path?: string;
    language?: string;
    content?: string;
    parentId?: string | null;
  };

  const [file] = await db.update(filesTable)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.path !== undefined && { path: updates.path }),
      ...(updates.language !== undefined && { language: updates.language }),
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.parentId !== undefined && { parentId: updates.parentId }),
    })
    .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)))
    .returning();

  if (!file) return res.status(404).json({ error: "File not found" });

  return res.json({
    ...file,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  });
});

filesRouter.delete("/rooms/:roomId/files/:fileId", async (req, res) => {
  const { roomId, fileId } = req.params;
  const userId = await resolveUserId(req);

  const file = await db.query.filesTable.findFirst({
    where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
  });

  if (!file) return res.status(404).json({ error: "File not found" });

  await db.delete(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)));

  if (userId) {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (user) {
      await db.insert(eventsTable).values({
        roomId,
        userId,
        username: user.username,
        type: "file_deleted",
        description: `Удалил ${file.isFolder ? "папку" : "файл"} ${file.name}`,
      });
    }
  }

  return res.status(204).send();
});

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    sh: "shell",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
    kt: "kotlin",
    swift: "swift",
  };
  return langMap[ext ?? ""] ?? "plaintext";
}

export default filesRouter;
