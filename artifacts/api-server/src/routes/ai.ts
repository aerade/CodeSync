import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, filesTable, eventsTable, roomsTable, roomMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
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

interface ResolvedAiUser { userId: string; isGuest: boolean; }

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

async function canAccessRoom(roomId: string, userId: string): Promise<{ canRead: boolean; canWrite: boolean; isGuest: boolean }> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return { canRead: false, canWrite: false, isGuest: false };

  if (!room.isPrivate) {
    return { canRead: true, canWrite: true, isGuest: false };
  }

  const member = await db.query.roomMembersTable.findFirst({
    where: and(eq(roomMembersTable.roomId, roomId), eq(roomMembersTable.userId, userId)),
  });
  const isMember = !!member;
  const isGuest = member?.isGuest ?? false;
  return { canRead: isMember, canWrite: isMember && !isGuest, isGuest };
}

interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }

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
      description: "Создать новый файл в комнате CodeSync.",
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
      description: "Отредактировать существующий файл. Перезаписывает содержимое целиком.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID файла" },
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
      description: "Удалить файл из комнаты.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID файла" },
        },
        required: ["fileId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_images",
      description: "Найти изображения по ключевым словам. Запрос лучше на английском.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "download_image",
      description: "Скачать изображение по URL и добавить в папку images/ комнаты. Используй после search_images.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL изображения" },
          name: { type: "string", description: "Имя файла (например, hero.jpg)" },
        },
        required: ["url", "name"],
      },
    },
  },
];

const UA_LIST = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA() { return UA_LIST[Math.floor(Math.random() * UA_LIST.length)]; }

async function searchImagesDDG(query: string): Promise<Array<{ id: string; url: string; thumb: string; description: string; source: string }>> {
  const ua = randomUA();
  const encodedQ = encodeURIComponent(query);

  // Try DuckDuckGo first
  try {
    const ddgInit = await fetch(
      `https://duckduckgo.com/?q=${encodedQ}&iax=images&ia=images`,
      { headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html" }, signal: AbortSignal.timeout(8000) }
    );
    const initHtml = await ddgInit.text();
    const vqdMatch = initHtml.match(/vqd=["']?([^"'&\s,]+)["']?/);
    if (vqdMatch?.[1]) {
      const vqd = vqdMatch[1];
      const imgResp = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodedQ}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`,
        { headers: { "Referer": "https://duckduckgo.com/", "User-Agent": ua, "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (imgResp.ok) {
        const data = await imgResp.json() as { results?: Array<{ title?: string; image?: string; thumbnail?: string; url?: string; source?: string }> };
        const results = (data.results ?? []).slice(0, 12).map((img, i) => ({
          id: `ddg_${i}`, url: img.image ?? "", thumb: img.thumbnail ?? img.image ?? "",
          description: img.title ?? "", source: img.source ?? img.url ?? "",
        })).filter((r) => r.url);
        if (results.length > 0) return results;
      }
    }
  } catch (_) {}

  // Fallback: try alternative DDG endpoint
  try {
    const alt = await fetch(
      `https://duckduckgo.com/i.js?q=${encodedQ}&o=json&p=1`,
      { headers: { "User-Agent": ua, "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (alt.ok) {
      const data = await alt.json() as { results?: Array<{ image?: string; thumbnail?: string; title?: string }> };
      const results = (data.results ?? []).slice(0, 12).map((img, i) => ({
        id: `alt_${i}`, url: img.image ?? "", thumb: img.thumbnail ?? img.image ?? "",
        description: img.title ?? "", source: "",
      })).filter((r) => r.url);
      if (results.length > 0) return results;
    }
  } catch (_) {}

  throw new Error("Не удалось найти изображения. Попробуйте другой запрос.");
}

async function findOrCreateImagesFolder(roomId: string, userId: string): Promise<string | null> {
  try {
    const existing = await db.query.filesTable.findFirst({
      where: and(eq(filesTable.roomId, roomId), eq(filesTable.name, "images"), eq(filesTable.isFolder, true)),
    });
    if (existing) return existing.id;

    const [folder] = await db.insert(filesTable).values({
      roomId, name: "images", path: "/images", language: "plaintext",
      content: "", parentId: null, isFolder: true, createdBy: userId,
    }).returning();
    return folder.id;
  } catch {
    return null;
  }
}

async function executeFileTool(toolName: string, args: Record<string, string>, roomId: string, userId: string): Promise<string> {
  try {
    if (toolName === "create_file") {
      const name = args.name ?? "";
      const content = args.content ?? "";
      const parentId = args.parentId || null;
      const language = detectLanguageFromName(name);
      const [file] = await db.insert(filesTable).values({
        roomId, name, path: `/${name}`, language, content, parentId, isFolder: false, createdBy: userId,
      }).returning();
      await db.insert(eventsTable).values({ roomId, userId, username: "AI", type: "file_created", description: `AI создал файл ${name}` }).catch(() => {});
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    if (toolName === "edit_file") {
      const fileId = args.fileId ?? "";
      const content = args.content ?? "";
      const existing = await db.query.filesTable.findFirst({ where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)) });
      if (existing && existing.content !== content) {
        await saveFileSnapshot(fileId, roomId, existing.content, userId, "AI (before edit)").catch(() => {});
      }
      const [file] = await db.update(filesTable).set({ content, updatedAt: new Date() })
        .where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId))).returning();
      if (!file) return JSON.stringify({ success: false, error: "Файл не найден" });
      await db.insert(eventsTable).values({ roomId, userId, username: "AI", type: "file_updated", description: `AI отредактировал файл ${file.name}` }).catch(() => {});
      return JSON.stringify({ success: true, fileId: file.id, name: file.name });
    }

    if (toolName === "delete_file") {
      const fileId = args.fileId ?? "";
      const file = await db.query.filesTable.findFirst({ where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)) });
      if (!file) return JSON.stringify({ success: false, error: "Файл не найден" });
      await db.delete(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)));
      await db.insert(eventsTable).values({ roomId, userId, username: "AI", type: "file_deleted", description: `AI удалил файл ${file.name}` }).catch(() => {});
      return JSON.stringify({ success: true, name: file.name });
    }

    if (toolName === "search_images") {
      const query = args.query ?? "";
      if (!query) return JSON.stringify({ error: "Параметр query обязателен" });
      const results = await searchImagesDDG(query);
      return JSON.stringify({ success: true, results, count: results.length });
    }

    if (toolName === "download_image") {
      const url = args.url ?? "";
      const name = args.name ?? "image.jpg";
      if (!url) return JSON.stringify({ error: "Параметр url обязателен" });

      const imageHeaders = {
        "User-Agent": randomUA(),
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": new URL(url).origin + "/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      };

      let imgResp: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const headers = attempt === 0
            ? imageHeaders
            : { "User-Agent": UA_LIST[attempt % UA_LIST.length], "Accept": "image/*,*/*" };
          imgResp = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
          if (imgResp.ok) break;
        } catch (_) {}
        imgResp = null;
      }

      if (!imgResp || !imgResp.ok) {
        const status = imgResp?.status ?? 0;
        return JSON.stringify({ error: `Не удалось скачать изображение (${status}). Пропусти и используй placeholder.` });
      }
      const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
      const buf = await imgResp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;

      // Find or create "images" folder
      const folderId = await findOrCreateImagesFolder(roomId, userId);

      const [file] = await db.insert(filesTable).values({
        roomId, name, path: `/images/${name}`, language: "image",
        content: dataUrl, parentId: folderId, isFolder: false, createdBy: userId,
      }).returning();
      return JSON.stringify({ success: true, fileId: file.id, name: file.name, folder: "images" });
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}

async function chatHandler(req: Request, res: Response): Promise<void> {
  const aiUser = await resolveAiUser(req);
  if (!aiUser) { res.status(401).json({ error: "Требуется авторизация для использования AI чата" }); return; }
  const { userId, isGuest } = aiUser;
  if (!checkRateLimit(userId)) { res.status(429).json({ error: "Слишком много запросов. Подождите немного." }); return; }

  const body = req.body as {
    message?: unknown; messages?: unknown; context?: unknown;
    language?: unknown; roomId?: unknown; fileId?: unknown; allFiles?: unknown;
    imageAttachment?: { name?: string; dataUrl?: string };
  };

  let chatMessages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    chatMessages = (body.messages as Array<{ role?: unknown; content?: unknown }>)
      .filter((m) => typeof m.role === "string" && typeof m.content === "string")
      .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content as string }));
  } else if (typeof body.message === "string") {
    chatMessages = [{ role: "user", content: body.message }];
  } else {
    res.status(400).json({ error: "Необходимо поле message или messages" }); return;
  }

  if (chatMessages.length === 0) { res.status(400).json({ error: "Нет сообщений" }); return; }

  const context = typeof body.context === "string" ? body.context : "";
  const language = typeof body.language === "string" ? body.language : "code";
  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  const usePlan = body.usePlan === true;
  const ALLOWED_MODELS = ["gpt-4.1", "o3", "gpt-4o"];
  const requestedModel = typeof body.model === "string" ? body.model : "gpt-4.1";
  const selectedModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "gpt-4.1";
  const isClaudeModel = false;

  // Parallel access check
  const [accessResult, roomFilesResult] = await Promise.all([
    roomId ? canAccessRoom(roomId, userId) : Promise.resolve({ canRead: true, canWrite: !isGuest, isGuest }),
    roomId ? db.query.filesTable.findMany({ where: eq(filesTable.roomId, roomId) }) : Promise.resolve([]),
  ]);

  if (roomId && !accessResult.canRead) { res.status(403).json({ error: "У вас нет доступа к этой комнате" }); return; }

  const hasWriteAccess = accessResult.canWrite;

  // Build file context - include file contents (not images, truncated)
  const allFilesBody = Array.isArray(body.allFiles)
    ? (body.allFiles as Array<{ id: string; name: string; language: string; content: string }>)
    : [];

  let fileContextStr = "";
  const filesToContext = allFilesBody.filter((f) => f.language !== "image");
  if (filesToContext.length > 0) {
    const parts = filesToContext.slice(0, 10).map((f) => {
      const isEmpty = !f.content || f.content.trim().length === 0;
      const truncated = isEmpty
        ? "⚠️ ФАЙЛ ПУСТОЙ — содержимого нет, требует создания кода"
        : f.content.length > 3000
          ? f.content.slice(0, 3000) + "\n...(обрезано)"
          : f.content;
      return `\n### ${f.name} (id: ${f.id}, ${f.language})${isEmpty ? " [ПУСТОЙ]" : ""}\n\`\`\`${f.language}\n${truncated}\n\`\`\``;
    });
    fileContextStr = `\n\n## Файлы в комнате (${filesToContext.length} шт.):\n${parts.join("\n")}`;
  } else if (roomFilesResult.length > 0) {
    fileContextStr = `\n\nФайлы в комнате:\n${roomFilesResult.map((f) => `- ${f.name} (id: ${f.id}, ${f.language}${f.isFolder ? ", папка" : ""})`).join("\n")}`;
  }

  const planModeInstructions = usePlan ? `

## Режим планирования (Plan Mode)
Ты работаешь в режиме планирования. Перед тем как приступить к любой задаче:
1. Разбей задачу на чёткие шаги (нумерованный список)
2. Объясни что именно будет изменено/создано в каждом шаге
3. Укажи какие файлы будут затронуты
4. Только после показа плана и явного подтверждения пользователя — выполняй инструменты
5. Если задача проста (1 шаг) — можно выполнять сразу, без отдельного плана
Используй формат: "**Шаг N:** описание" для каждого пункта плана.` : "";

  const systemPrompt = `Ты — AI-ассистент для разработчиков в среде CodeSync (онлайн IDE).
Отвечай на русском языке. Помогай с написанием, объяснением и дебаггингом кода.
Ты можешь создавать, редактировать и удалять файлы в комнате с помощью инструментов.

ВАЖНО — правила работы с файлами:
- Когда нужно создать или изменить файл — СРАЗУ вызывай инструмент (create_file или edit_file). НЕ пиши код в чат перед этим.
- После вызова инструмента кратко объясни что сделал (1-2 предложения), но не дублируй весь код в сообщение.
- Если файлов несколько — создавай их последовательно, по одному инструменту за раз.
- Не объясняй что "собираешься сделать" — просто делай.
- КРИТИЧНО: если файл помечен как [ПУСТОЙ] или содержит "⚠️ ФАЙЛ ПУСТОЙ" — он существует, но в нём НЕТ кода. Ты ОБЯЗАН записать в него код через edit_file, не пропускай его.

Для работы с изображениями:
- Используй search_images для поиска (запрос лучше на английском)
- Используй download_image для скачивания — изображения автоматически попадут в папку images/
- Если download_image не удался (ошибка или недоступен URL) — пропусти это изображение и напиши placeholder в HTML
- В HTML-коде используй имя файла: <img src="images/hero.jpg">
- При создании сайтов с картинками — СНАЧАЛА создай все HTML/CSS/JS файлы с placeholder-тегами img (src="images/hero.jpg"), затем скачивай изображения через search_images+download_image
- Не пытайся скачать одно и то же изображение повторно если первый раз не получилось
- Если пользователь прикрепил изображение к сообщению — ты его ВИДИШЬ и можешь описать, проанализировать, использовать как референс
${context
    ? `\nТекущий открытый файл (${language}):\n\`\`\`${language}\n${context}\n\`\`\``
    : language
      ? `\nТекущий открытый файл (${language}): ⚠️ ПУСТОЙ — содержимого нет, требует написания кода`
      : ""}${fileContextStr}${planModeInstructions}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    // ── Claude branch (with tool_use) ──────────────────────────────────────────
    if (isClaudeModel) {
      // Convert OpenAI-style tools → Anthropic tool format
      const claudeTools = (roomId && hasWriteAccess) ? FILE_TOOLS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Record<string, unknown>,
      })) : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let claudeMsgs: any[] = chatMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      if (claudeMsgs.length === 0) {
        res.write(`data: ${JSON.stringify({ error: "Нет сообщений для Claude" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return;
      }

      let claudeAttempts = 0;
      const MAX_CLAUDE_ROUNDS = 10;

      while (claudeAttempts < MAX_CLAUDE_ROUNDS) {
        claudeAttempts++;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamParams: any = {
          model: selectedModel,
          max_tokens: 8192,
          system: systemPrompt,
          messages: claudeMsgs,
        };
        if (claudeTools) streamParams.tools = claudeTools;

        const stream = anthropic.messages.stream(streamParams);

        let textContent = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
        let curToolId = "", curToolName = "", curToolJson = "";
        let stopReason = "";

        for await (const event of stream) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ev = event as any;
          if (ev.type === "content_block_start") {
            if (ev.content_block?.type === "tool_use") {
              curToolId = ev.content_block.id ?? "";
              curToolName = ev.content_block.name ?? "";
              curToolJson = "";
            }
          } else if (ev.type === "content_block_delta") {
            if (ev.delta?.type === "text_delta") {
              textContent += ev.delta.text;
              res.write(`data: ${JSON.stringify({ content: ev.delta.text })}\n\n`);
            } else if (ev.delta?.type === "input_json_delta") {
              curToolJson += ev.delta.partial_json ?? "";
            }
          } else if (ev.type === "content_block_stop") {
            if (curToolId) {
              toolUseBlocks.push({ id: curToolId, name: curToolName, inputJson: curToolJson });
              curToolId = ""; curToolName = ""; curToolJson = "";
            }
          } else if (ev.type === "message_delta") {
            stopReason = ev.delta?.stop_reason ?? "";
          }
        }

        if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
          // Build assistant content array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assistantContent: any[] = [];
          if (textContent) assistantContent.push({ type: "text", text: textContent });
          for (const tb of toolUseBlocks) {
            assistantContent.push({ type: "tool_use", id: tb.id, name: tb.name, input: JSON.parse(tb.inputJson || "{}") });
          }
          claudeMsgs.push({ role: "assistant", content: assistantContent });

          // Execute tools, collect results
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolResults: any[] = [];
          for (const tb of toolUseBlocks) {
            const args = JSON.parse(tb.inputJson || "{}") as Record<string, string>;
            // Stream file write content for live preview
            const isFileWrite = tb.name === "edit_file" || tb.name === "create_file";
            if (isFileWrite && args.content) {
              const content = args.content;
              const chunkSize = Math.max(8, Math.ceil(content.length / 80));
              for (let i = 0; i < content.length; i += chunkSize) {
                res.write(`data: ${JSON.stringify({ fileStream: { toolName: tb.name, fileId: args.fileId, fileName: args.name, content: content.slice(0, i + chunkSize) } })}\n\n`);
                await new Promise((r) => setTimeout(r, 5));
              }
              res.write(`data: ${JSON.stringify({ fileStream: { toolName: tb.name, fileId: args.fileId, fileName: args.name, content, done: true } })}\n\n`);
            }
            const result = await executeFileTool(tb.name, args, roomId, userId);
            res.write(`data: ${JSON.stringify({ toolCall: { name: tb.name, args, result: JSON.parse(result) } })}\n\n`);
            toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: result });
          }
          claudeMsgs.push({ role: "user", content: toolResults });
          continue;
        }
        break;
      }

      res.write("data: [DONE]\n\n");
      return;
    }

    // ── OpenAI branch ──────────────────────────────────────────────────────────
    // Build messages array, inject image into last user message if provided
    const imageAttachment = body.imageAttachment;
    const hasImage = imageAttachment?.dataUrl && imageAttachment.dataUrl.startsWith("data:image/");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMessages: Array<any> = [{ role: "system", content: systemPrompt }];
    for (let i = 0; i < chatMessages.length; i++) {
      const m = chatMessages[i];
      const isLastUser = m.role === "user" && i === chatMessages.length - 1;
      if (isLastUser && hasImage) {
        allMessages.push({
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: imageAttachment!.dataUrl!, detail: "high" } },
          ],
        });
      } else {
        allMessages.push({ role: m.role, content: m.content });
      }
    }

    let attempts = 0;
    const MAX_TOOL_ROUNDS = 10;
    const tools = (roomId && hasWriteAccess) ? FILE_TOOLS : undefined;

    while (attempts < MAX_TOOL_ROUNDS) {
      attempts++;

      const isO3Model = selectedModel === "o3" || selectedModel === "o3-mini";
      const stream = await openai.chat.completions.create({
        model: selectedModel,
        messages: allMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        ...(isO3Model ? { max_completion_tokens: 16000 } : { max_tokens: 4096 }),
        tools,
        stream: true,
      } as Parameters<typeof openai.chat.completions.create>[0]);

      let currentContent = "";
      let finishReason = "";
      const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.delta.content) {
          currentContent += choice.delta.content;
          res.write(`data: ${JSON.stringify({ content: choice.delta.content })}\n\n`);
        }
        if (choice.delta.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const existing = pendingToolCalls.get(tc.index) ?? { id: "", name: "", arguments: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            pendingToolCalls.set(tc.index, existing);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }

      if (finishReason === "tool_calls" && pendingToolCalls.size > 0) {
        const toolCallList = Array.from(pendingToolCalls.entries())
          .sort(([a], [b]) => a - b)
          .map(([, tc]) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.arguments } }));

        allMessages.push({
          role: "assistant",
          content: currentContent,
          ...({ tool_calls: toolCallList } as Record<string, unknown>),
        } as { role: string; content: string });

        for (const tc of toolCallList) {
          const args = JSON.parse(tc.function.arguments) as Record<string, string>;

          const isFileWrite = tc.function.name === "edit_file" || tc.function.name === "create_file";
          if (isFileWrite && args.content && args.content.length > 0) {
            const content = args.content;
            const fileId = args.fileId;
            const fileName = args.name;
            const chunkSize = Math.max(8, Math.ceil(content.length / 80));
            for (let i = 0; i < content.length; i += chunkSize) {
              res.write(`data: ${JSON.stringify({ fileStream: { toolName: tc.function.name, fileId, fileName, content: content.slice(0, i + chunkSize) } })}\n\n`);
              await new Promise((r) => setTimeout(r, 5));
            }
            res.write(`data: ${JSON.stringify({ fileStream: { toolName: tc.function.name, fileId, fileName, content, done: true } })}\n\n`);
          }

          const result = await executeFileTool(tc.function.name, args, roomId, userId);
          res.write(`data: ${JSON.stringify({ toolCall: { name: tc.function.name, args, result: JSON.parse(result) } })}\n\n`);
          allMessages.push({
            role: "tool",
            content: result,
            ...({ tool_call_id: tc.id } as Record<string, unknown>),
          } as { role: string; content: string });
        }
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
  if (!aiUser) { res.status(401).json({ error: "Требуется авторизация" }); return; }
  if (!checkRateLimit(aiUser.userId)) { res.status(429).json({ error: "Слишком много запросов" }); return; }

  const body = req.body as { code?: unknown; language?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  const language = typeof body.language === "string" ? body.language : "code";
  if (!code.trim()) { res.status(400).json({ error: "code обязателен" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: `Ты — эксперт code review. Анализируй код и верни ТОЛЬКО валидный JSON-массив объектов с полями: line (number), severity ("error"|"warning"|"info"), message (на русском), suggestion (на русском). Пустой массив [] если нет проблем. Без markdown-блоков, только чистый JSON.` },
        { role: "user", content: `Проверь этот ${language} код:\n\`\`\`${language}\n${code}\n\`\`\`` },
      ],
      max_tokens: 1500,
    });

    let rawText = completion.choices[0]?.message?.content ?? "[]";
    rawText = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) rawText = jsonMatch[0];

    let issues: ReviewIssue[] = [];
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const VALID = new Set(["error", "warning", "info"]);
        issues = parsed
          .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
          .map((i) => ({
            line: typeof i["line"] === "number" ? Math.round(i["line"]) : 0,
            severity: (VALID.has(i["severity"] as string) ? i["severity"] : "info") as ReviewIssue["severity"],
            message: typeof i["message"] === "string" ? i["message"] : "",
            suggestion: typeof i["suggestion"] === "string" ? i["suggestion"] : "",
          }))
          .filter((i) => i.message);
      }
    } catch { issues = []; }

    res.write(`data: ${JSON.stringify({ issues })}\n\n`);
    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "AI error" })}\n\n`);
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
    const results = await searchImagesDDG(q);
    const formatted = results.slice(0, 15).map((r) => ({
      id: r.id, thumb: r.thumb, full: r.url, description: r.description, photographer: r.source,
    }));
    res.json({ results: formatted });
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
    const imgResp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!imgResp.ok) throw new Error(`Не удалось загрузить: ${imgResp.status}`);
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
    const base64 = Buffer.from(await imgResp.arrayBuffer()).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    const folderId = await findOrCreateImagesFolder(roomId, aiUser.userId);
    const [file] = await db.insert(filesTable).values({
      roomId, name, path: `/images/${name}`, language: "image",
      content: dataUrl, parentId: folderId, isFolder: false, createdBy: aiUser.userId,
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
