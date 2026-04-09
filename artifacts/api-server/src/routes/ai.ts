import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, filesTable, eventsTable, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const aiRouter = Router();

// Simple in-memory rate limiter: userId -> { count, resetAt }
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

interface ResolvedAiUser {
  userId: string;
  isGuest: boolean;
}

async function resolveAiUser(req: Request): Promise<ResolvedAiUser | null> {
  const auth = getAuth(req);
  if (auth?.userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });
    if (user) return { userId: user.id, isGuest: false };
  }

  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) return { userId: user.id, isGuest: true };
  }

  return null;
}

async function canReadRoom(roomId: string, userId: string): Promise<boolean> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return false;
  if (!room.isPrivate) return true;
  const member = await db.query.roomMembersTable.findFirst({
    where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, userId)),
  });
  return !!member;
}

async function canWriteRoom(roomId: string, userId: string, isGuest: boolean): Promise<boolean> {
  if (isGuest) return false;
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return false;
  if (!room.isPrivate) return true;
  const member = await db.query.roomMembersTable.findFirst({
    where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, userId)),
  });
  return !!member;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function detectLanguageFromName(filename: string): string {
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

const FILE_TOOLS: Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> = [
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Создать новый файл в комнате CodeSync. Используй для создания новых файлов с кодом.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Имя файла (например, utils.ts)" },
          content: { type: "string", description: "Содержимое файла" },
          parentId: { type: "string", description: "ID родительской папки (опционально)" },
        },
        required: ["name", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Отредактировать существующий файл в комнате CodeSync. Перезаписывает содержимое файла целиком.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID файла для редактирования" },
          content: { type: "string", description: "Новое содержимое файла" },
        },
        required: ["fileId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Удалить файл из комнаты CodeSync.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID файла для удаления" },
        },
        required: ["fileId"],
      },
    },
  },
];

async function executeFileTool(
  toolName: string,
  args: Record<string, string>,
  roomId: string,
  userId: string,
): Promise<string> {
  try {
    if (toolName === "create_file") {
      const name = args.name ?? "";
      const content = args.content ?? "";
      const parentId = args.parentId || null;
      const language = detectLanguageFromName(name);
      const [file] = await db.insert(filesTable).values({
        roomId,
        name,
        path: parentId ? `/${name}` : `/${name}`,
        language,
        content,
        parentId,
        isFolder: false,
        createdBy: userId,
      }).returning();
      await db.insert(eventsTable).values({
        roomId,
        userId,
        username: "AI",
        type: "file_created",
        description: `AI создал файл ${name}`,
      }).catch(() => {});
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    if (toolName === "edit_file") {
      const fileId = args.fileId ?? "";
      const content = args.content ?? "";
      const [file] = await db.update(filesTable)
        .set({ content, updatedAt: new Date() })
        .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)))
        .returning();
      if (!file) return JSON.stringify({ success: false, error: "Файл не найден" });
      await db.insert(eventsTable).values({
        roomId,
        userId,
        username: "AI",
        type: "file_updated",
        description: `AI отредактировал файл ${file.name}`,
      }).catch(() => {});
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    if (toolName === "delete_file") {
      const fileId = args.fileId ?? "";
      const file = await db.query.filesTable.findFirst({
        where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
      });
      if (!file) return JSON.stringify({ success: false, error: "Файл не найден" });
      await db.delete(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)));
      await db.insert(eventsTable).values({
        roomId,
        userId,
        username: "AI",
        type: "file_deleted",
        description: `AI удалил файл ${file.name}`,
      }).catch(() => {});
      return JSON.stringify({ success: true, name: file.name });
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}

async function chatHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  if (!aiUser) {
    res.status(401).json({ error: "Authentication required to use AI chat" });
    return;
  }
  const { userId, isGuest } = aiUser;
  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait before sending more messages." });
    return;
  }

  const body = req.body as {
    message?: unknown;
    messages?: unknown;
    context?: unknown;
    language?: unknown;
    roomId?: unknown;
    fileId?: unknown;
    allFiles?: unknown;
  };

  let chatMessages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    chatMessages = (body.messages as Array<{ role?: unknown; content?: unknown }>)
      .filter((m) => typeof m.role === "string" && typeof m.content === "string")
      .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content as string }));
  } else if (typeof body.message === "string") {
    chatMessages = [{ role: "user", content: body.message }];
  } else {
    res.status(400).json({ error: "message or messages field is required" });
    return;
  }

  if (chatMessages.length === 0) {
    res.status(400).json({ error: "No valid messages provided" });
    return;
  }

  const context = typeof body.context === "string" ? body.context : "";
  const language = typeof body.language === "string" ? body.language : "code";
  const roomId = typeof body.roomId === "string" ? body.roomId : "";

  if (roomId) {
    const hasAccess = await canReadRoom(roomId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: "У вас нет доступа к этой комнате" });
      return;
    }
  }

  const hasWriteAccess = roomId ? await canWriteRoom(roomId, userId, isGuest) : false;

  let fileListContext = "";
  if (roomId) {
    const roomFiles = await db.query.filesTable.findMany({
      where: eq(filesTable.roomId, roomId),
    });
    if (roomFiles.length > 0) {
      fileListContext = `\n\nФайлы в комнате:\n${roomFiles.map((f) => `- ${f.name} (id: ${f.id}, ${f.language}${f.isFolder ? ", папка" : ""})`).join("\n")}`;
    }
  }

  const systemPrompt = `Ты — AI-ассистент для разработчиков в среде CodeSync (онлайн IDE).
Отвечай на русском языке. Помогай с написанием, объяснением и дебаггингом кода.
Ты можешь создавать, редактировать и удалять файлы в комнате с помощью доступных инструментов.
Если пользователь просит создать, изменить или удалить файл — используй соответствующий инструмент.
${context ? `Контекст текущего файла (${language}):\n\`\`\`${language}\n${context}\n\`\`\`` : ""}${fileListContext}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const allMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...chatMessages,
    ];

    let attempts = 0;
    const MAX_TOOL_ROUNDS = 5;

    while (attempts < MAX_TOOL_ROUNDS) {
      attempts++;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: allMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        max_tokens: 2048,
        tools: (roomId && hasWriteAccess) ? FILE_TOOLS : undefined,
      });

      const choice = completion.choices[0];
      if (!choice) break;

      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        allMessages.push({
          role: "assistant",
          content: choice.message.content ?? "",
          ...({ tool_calls: choice.message.tool_calls } as Record<string, unknown>),
        } as { role: string; content: string });

        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type !== "function") continue;
          const fn = toolCall.function;
          const args = JSON.parse(fn.arguments) as Record<string, string>;
          const result = await executeFileTool(fn.name, args, roomId, userId);

          res.write(`data: ${JSON.stringify({ toolCall: { name: fn.name, args, result: JSON.parse(result) } })}\n\n`);

          allMessages.push({
            role: "tool",
            content: result,
            ...({ tool_call_id: toolCall.id } as Record<string, unknown>),
          } as { role: string; content: string });
        }
        continue;
      }

      const textContent = choice.message.content ?? "";
      if (textContent) {
        res.write(`data: ${JSON.stringify({ content: textContent })}\n\n`);
      }
      break;
    }

    res.write("data: [DONE]\n\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
}

interface ReviewIssue {
  line: number;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string;
}

async function reviewHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  const userId = aiUser?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Authentication required to use AI review" });
    return;
  }
  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait before sending more requests." });
    return;
  }

  const body = req.body as { code?: unknown; language?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  const language = typeof body.language === "string" ? body.language : "code";

  if (!code.trim()) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Ты — эксперт по code review. Анализируй код и возвращай ТОЛЬКО валидный JSON-массив объектов.
Каждый объект должен иметь поля: line (number), severity ("error"|"warning"|"info"), message (string на русском), suggestion (string на русском).
Верни пустой массив [], если нет проблем. Не добавляй \`\`\`json или другие теги — только чистый JSON.`,
        },
        {
          role: "user",
          content: `Проверь этот ${language} код:\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      max_tokens: 1500,
    });

    const rawText = completion.choices[0]?.message?.content ?? "[]";

    let issues: ReviewIssue[] = [];
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        issues = parsed.filter(
          (item): item is ReviewIssue => {
            if (typeof item !== "object" || item === null) return false;
            const record = item as Record<string, unknown>;
            return typeof record["line"] === "number" && typeof record["message"] === "string";
          }
        );
      }
    } catch {
      issues = [];
    }

    res.write(`data: ${JSON.stringify({ issues })}\n\n`);
    res.write("data: [DONE]\n\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
}

aiRouter.post("/ai/chat", (req, res) => { void chatHandler(req, res); });
aiRouter.post("/ai/review", (req, res) => { void reviewHandler(req, res); });

export default aiRouter;
