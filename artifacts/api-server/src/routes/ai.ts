import { Router, Request, Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { rooms, roomFiles } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";

export const aiRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    requestBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

async function reviewHandler(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  const userId = auth.userId ?? null;
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
      model: "claude-3-5-sonnet-20241022",
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

    let rawText = completion.choices[0]?.message?.content ?? "[]";
    rawText = rawText.trim();
    if (rawText.startsWith("```")) rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) rawText = jsonMatch[0];

    let issues: Array<{ line: number; severity: "error" | "warning" | "info"; message: string; suggestion: string }> = [];
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const VALID_SEVERITIES = new Set(["error", "warning", "info"]);
        issues = parsed
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).message === "string")
          .map((item) => ({
            line: typeof item.line === "number" ? Math.round(item.line) : 0,
            severity: (VALID_SEVERITIES.has(item.severity as string) ? item.severity : "info") as "error" | "warning" | "info",
            message: item.message as string,
            suggestion: typeof item.suggestion === "string" ? item.suggestion : "",
          }));
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

export default aiRouter;
