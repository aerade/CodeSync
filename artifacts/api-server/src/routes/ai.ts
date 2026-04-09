import { Router, Request, Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const aiRouter = Router();

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function chatHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    message?: unknown;
    messages?: unknown;
    context?: unknown;
    language?: unknown;
  };

  // Accept both `message` (single string) and `messages` (array) for flexibility
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

  const systemPrompt = `Ты — AI-ассистент для разработчиков в среде CodeSync (онлайн IDE).
Отвечай на русском языке. Помогай с написанием, объяснением и дебаггингом кода.
${context ? `Контекст текущего файла (${language}):\n\`\`\`${language}\n${context}\n\`\`\`` : ""}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ],
      max_tokens: 2048,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
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
