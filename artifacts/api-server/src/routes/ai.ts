import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, filesTable, eventsTable, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { saveFileSnapshot } from "./snapshots";

const aiRouter = Router();

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 1000;

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
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
    if (user) return { userId: user.id, isGuest: false };
  }
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.guestToken, guestToken) });
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
  role: "user" | "assistant";
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

const FILE_TOOLS: Parameters<typeof anthropic.messages.create>[0]["tools"] = [
  {
    name: "create_file",
    description: "Создать новый файл в комнате CodeSync. Используй для создания новых файлов с кодом.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Имя файла (например, utils.ts)" },
        content: { type: "string", description: "Содержимое файла" },
        parentId: { type: "string", description: "ID родительской папки (опционально)" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Отредактировать существующий файл в комнате CodeSync. Перезаписывает содержимое файла целиком.",
    input_schema: {
      type: "object" as const,
      properties: {
        fileId: { type: "string", description: "ID файла для редактирования" },
        content: { type: "string", description: "Новое содержимое файла" },
      },
      required: ["fileId", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Удалить файл из комнаты CodeSync.",
    input_schema: {
      type: "object" as const,
      properties: {
        fileId: { type: "string", description: "ID файла для удаления" },
      },
      required: ["fileId"],
    },
  },
  {
    name: "search_images",
    description: "Найти изображения по ключевым словам в интернете. Возвращает список изображений с URL для скачивания.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Поисковый запрос (можно на английском для лучших результатов)" },
      },
      required: ["query"],
    },
  },
  {
    name: "download_image",
    description: "Скачать изображение по URL и добавить в комнату как файл. Используй после search_images.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL изображения для скачивания" },
        name: { type: "string", description: "Имя файла (например, hero.jpg, logo.png)" },
      },
      required: ["url", "name"],
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
        roomId, name, path: `/${name}`, language, content, parentId, isFolder: false, createdBy: userId,
      }).returning();
      await db.insert(eventsTable).values({
        roomId, userId, username: "AI", type: "file_created", description: `AI создал файл ${name}`,
      }).catch(() => {});
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    if (toolName === "edit_file") {
      const fileId = args.fileId ?? "";
      const content = args.content ?? "";
      const existing = await db.query.filesTable.findFirst({
        where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
      });
      if (existing && existing.content !== content) {
        await saveFileSnapshot(fileId, roomId, existing.content, userId, "AI (before edit)").catch(() => {});
      }
      const [file] = await db.update(filesTable)
        .set({ content, updatedAt: new Date() })
        .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)))
        .returning();
      if (!file) return JSON.stringify({ success: false, error: "Файл не найден" });
      await db.insert(eventsTable).values({
        roomId, userId, username: "AI", type: "file_updated", description: `AI отредактировал файл ${file.name}`,
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
        roomId, userId, username: "AI", type: "file_deleted", description: `AI удалил файл ${file.name}`,
      }).catch(() => {});
      return JSON.stringify({ success: true, name: file.name });
    }

    if (toolName === "search_images") {
      const query = args.query ?? "";
      if (!query) return JSON.stringify({ error: "Параметр query обязателен" });
      const ddgInit = await fetch(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120", "Accept-Language": "en-US,en;q=0.9" } }
      );
      const initHtml = await ddgInit.text();
      const vqdMatch = initHtml.match(/vqd=["']?([^"'&\s]+)["']?/);
      if (!vqdMatch?.[1]) return JSON.stringify({ error: "Не удалось получить токен поиска изображений." });
      const vqd = vqdMatch[1];
      const imgResp = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`,
        { headers: { "Referer": "https://duckduckgo.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120", "Accept": "application/json" } }
      );
      if (!imgResp.ok) return JSON.stringify({ error: `Ошибка поиска изображений: ${imgResp.status}` });
      const data = await imgResp.json() as {
        results?: Array<{ title?: string; image?: string; thumbnail?: string; url?: string; source?: string }>;
      };
      const results = (data.results ?? []).slice(0, 8).map((img, i) => ({
        id: String(i), url: img.image ?? "", thumb: img.thumbnail ?? img.image ?? "",
        description: img.title ?? "", source: img.source ?? img.url ?? "",
      })).filter((r) => r.url);
      return JSON.stringify({ success: true, results, count: results.length });
    }

    if (toolName === "download_image") {
      const url = args.url ?? "";
      const name = args.name ?? "image.jpg";
      if (!url) return JSON.stringify({ error: "Параметр url обязателен" });
      const imgResp = await fetch(url);
      if (!imgResp.ok) return JSON.stringify({ error: `Не удалось скачать: ${imgResp.status}` });
      const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
      const buf = await imgResp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      const [file] = await db.insert(filesTable).values({
        roomId, name, path: `/${name}`, language: "image",
        content: dataUrl, parentId: null, isFolder: false, createdBy: userId,
      }).returning();
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}

type AnthropicMessage = Parameters<typeof anthropic.messages.create>[0]["messages"][number];

async function chatHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  if (!aiUser) { res.status(401).json({ error: "Authentication required to use AI chat" }); return; }
  const { userId, isGuest } = aiUser;
  if (!checkRateLimit(userId)) { res.status(429).json({ error: "Rate limit exceeded. Please wait before sending more messages." }); return; }

  const body = req.body as {
    message?: unknown; messages?: unknown; context?: unknown;
    language?: unknown; roomId?: unknown; fileId?: unknown; allFiles?: unknown;
  };

  let chatMessages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    chatMessages = (body.messages as Array<{ role?: unknown; content?: unknown }>)
      .filter((m) => typeof m.role === "string" && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));
  } else if (typeof body.message === "string") {
    chatMessages = [{ role: "user", content: body.message }];
  } else {
    res.status(400).json({ error: "message or messages field is required" }); return;
  }

  if (chatMessages.length === 0) { res.status(400).json({ error: "No valid messages provided" }); return; }

  // Ensure messages start with user (Anthropic requirement)
  while (chatMessages.length > 0 && chatMessages[0].role !== "user") chatMessages.shift();

  const context = typeof body.context === "string" ? body.context : "";
  const language = typeof body.language === "string" ? body.language : "code";
  const roomId = typeof body.roomId === "string" ? body.roomId : "";

  if (roomId) {
    const hasAccess = await canReadRoom(roomId, userId);
    if (!hasAccess) { res.status(403).json({ error: "У вас нет доступа к этой комнате" }); return; }
  }

  const hasWriteAccess = roomId ? await canWriteRoom(roomId, userId, isGuest) : false;

  let fileListContext = "";
  if (roomId) {
    const roomFiles = await db.query.filesTable.findMany({ where: eq(filesTable.roomId, roomId) });
    if (roomFiles.length > 0) {
      fileListContext = `\n\nФайлы в комнате:\n${roomFiles.map((f) => `- ${f.name} (id: ${f.id}, ${f.language}${f.isFolder ? ", папка" : ""})`).join("\n")}`;
    }
  }

  const systemPrompt = `Ты — AI-ассистент для разработчиков в среде CodeSync (онлайн IDE).
Отвечай на русском языке. Помогай с написанием, объяснением и дебаггингом кода.
Ты можешь создавать, редактировать и удалять файлы в комнате с помощью доступных инструментов.
Если пользователь просит создать, изменить или удалить файл — используй соответствующий инструмент.
Ты можешь искать и скачивать изображения из интернета самостоятельно:
- Используй search_images для поиска подходящих изображений (запросы лучше на английском)
- Затем используй download_image для скачивания лучшего результата и добавления в комнату
- Используй изображения в HTML-коде через имя файла: <img src="hero.jpg">
- При создании сайтов с изображениями — сначала найди и скачай нужные картинки, потом пиши HTML с их именами
${context ? `\nКонтекст текущего файла (${language}):\n\`\`\`${language}\n${context}\n\`\`\`` : ""}${fileListContext}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const allMessages: AnthropicMessage[] = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const tools = (roomId && hasWriteAccess) ? FILE_TOOLS : undefined;
    const MAX_TOOL_ROUNDS = 10;
    let attempts = 0;

    while (attempts < MAX_TOOL_ROUNDS) {
      attempts++;

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: allMessages,
        ...(tools ? { tools } : {}),
      });

      let currentTextContent = "";
      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, string> }> = [];
      let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolUse = { id: event.content_block.id, name: event.content_block.name, inputJson: "" };
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            currentTextContent += event.delta.text;
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          } else if (event.delta.type === "input_json_delta" && currentToolUse) {
            currentToolUse.inputJson += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolUse) {
            let parsedInput: Record<string, string> = {};
            try { parsedInput = JSON.parse(currentToolUse.inputJson) as Record<string, string>; } catch { parsedInput = {}; }
            toolUseBlocks.push({ id: currentToolUse.id, name: currentToolUse.name, input: parsedInput });
            currentToolUse = null;
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      const stopReason = finalMessage.stop_reason;

      if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
        // Add assistant message with all content blocks
        const assistantContent: AnthropicMessage["content"] = [];
        if (currentTextContent) assistantContent.push({ type: "text", text: currentTextContent });
        for (const tb of toolUseBlocks) {
          assistantContent.push({ type: "tool_use", id: tb.id, name: tb.name, input: tb.input });
        }
        allMessages.push({ role: "assistant", content: assistantContent });

        // Execute tools and collect results
        const toolResultContent: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

        for (const tb of toolUseBlocks) {
          const args = tb.input;

          // Stream file content progressively for create/edit
          const isFileEdit = tb.name === "edit_file" || tb.name === "create_file";
          if (isFileEdit && args.content && args.content.length > 0) {
            const content = args.content;
            const fileId = args.fileId;
            const fileName = args.name;
            const chunkSize = Math.max(8, Math.ceil(content.length / 80));
            for (let i = 0; i < content.length; i += chunkSize) {
              res.write(`data: ${JSON.stringify({ fileStream: { toolName: tb.name, fileId, fileName, content: content.slice(0, i + chunkSize) } })}\n\n`);
              await new Promise((r) => setTimeout(r, 6));
            }
            res.write(`data: ${JSON.stringify({ fileStream: { toolName: tb.name, fileId, fileName, content, done: true } })}\n\n`);
          }

          const result = await executeFileTool(tb.name, args, roomId, userId);
          res.write(`data: ${JSON.stringify({ toolCall: { name: tb.name, args, result: JSON.parse(result) } })}\n\n`);
          toolResultContent.push({ type: "tool_result", tool_use_id: tb.id, content: result });
        }

        allMessages.push({ role: "user", content: toolResultContent });
        continue;
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
  if (!userId) { res.status(401).json({ error: "Authentication required to use AI review" }); return; }
  if (!checkRateLimit(userId)) { res.status(429).json({ error: "Rate limit exceeded. Please wait before sending more requests." }); return; }

  const body = req.body as { code?: unknown; language?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  const language = typeof body.language === "string" ? body.language : "code";

  if (!code.trim()) { res.status(400).json({ error: "code is required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Ты — эксперт по code review. Анализируй код и возвращай ТОЛЬКО валидный JSON-массив объектов.
Каждый объект должен иметь поля: line (number), severity ("error"|"warning"|"info"), message (string на русском), suggestion (string на русском).
Верни пустой массив [], если нет проблем. Не добавляй \`\`\`json или другие теги — только чистый JSON.`,
      messages: [
        { role: "user", content: `Проверь этот ${language} код:\n\`\`\`${language}\n${code}\n\`\`\`` },
      ],
    });

    let rawText = (response.content[0]?.type === "text" ? response.content[0].text : "") ?? "[]";
    rawText = rawText.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    }
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) rawText = jsonMatch[0];

    let issues: ReviewIssue[] = [];
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const VALID_SEVERITIES = new Set(["error", "warning", "info"]);
        issues = parsed
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => ({
            line: typeof item["line"] === "number" ? Math.round(item["line"]) : 0,
            severity: (VALID_SEVERITIES.has(item["severity"] as string) ? item["severity"] : "info") as ReviewIssue["severity"],
            message: typeof item["message"] === "string" ? item["message"] : "",
            suggestion: typeof item["suggestion"] === "string" ? item["suggestion"] : "",
          }))
          .filter((i) => i.message);
      }
    } catch { issues = []; }

    res.write(`data: ${JSON.stringify({ issues })}\n\n`);
    res.write("data: [DONE]\n\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
}

async function imageSearchHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  if (!aiUser) { res.status(401).json({ error: "Требуется авторизация" }); return; }
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (!q) { res.status(400).json({ error: "Параметр q обязателен" }); return; }

  try {
    const ddgInit = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120", "Accept-Language": "en-US,en;q=0.9" } }
    );
    const initHtml = await ddgInit.text();
    const vqdMatch = initHtml.match(/vqd=["']?([^"'&\s]+)["']?/);
    if (!vqdMatch?.[1]) { res.status(502).json({ error: "Не удалось подключиться к поиску изображений." }); return; }
    const vqd = vqdMatch[1];

    const imgResp = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`,
      { headers: { "Referer": "https://duckduckgo.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120", "Accept": "application/json" } }
    );
    if (!imgResp.ok) { res.status(502).json({ error: `Ошибка поиска: ${imgResp.status}` }); return; }
    const data = await imgResp.json() as {
      results?: Array<{ title?: string; image?: string; thumbnail?: string; url?: string; source?: string }>;
    };
    const results = (data.results ?? []).slice(0, 15).map((img, i) => ({
      id: String(i), thumb: img.thumbnail ?? img.image ?? "",
      full: img.image ?? "", description: img.title ?? "", photographer: img.source ?? "",
    })).filter((r) => r.full);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Ошибка поиска" });
  }
}

async function imageImportHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  if (!aiUser) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const body = req.body as { roomId?: string; url?: string; name?: string };
  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  const url = typeof body.url === "string" ? body.url : "";
  const name = typeof body.name === "string" ? body.name : "image.jpg";

  if (!roomId || !url) { res.status(400).json({ error: "Параметры roomId и url обязательны" }); return; }

  try {
    const imgResp = await fetch(url);
    if (!imgResp.ok) throw new Error(`Не удалось загрузить изображение: ${imgResp.status}`);
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;
    const [file] = await db.insert(filesTable).values({
      roomId, name, path: `/${name}`, language: "image",
      content: dataUrl, parentId: null, isFolder: false, createdBy: aiUser.userId,
    }).returning();
    res.json({ success: true, fileId: file.id, name: file.name });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Ошибка импорта" });
  }
}

aiRouter.post("/ai/chat", (req, res) => { void chatHandler(req, res); });
aiRouter.post("/ai/review", (req, res) => { void reviewHandler(req, res); });
aiRouter.get("/images/search", (req, res) => { void imageSearchHandler(req, res); });
aiRouter.post("/images/import", (req, res) => { void imageImportHandler(req, res); });

export default aiRouter;
