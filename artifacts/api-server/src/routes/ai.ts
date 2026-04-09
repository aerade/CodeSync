import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { filesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const aiRouter = Router();

aiRouter.post("/ai/chat", async (req, res) => {
  const { messages, roomId, fileId } = req.body as {
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    roomId?: string;
    fileId?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  let fileContext = "";
  if (roomId && fileId) {
    try {
      const file = await db.query.filesTable.findFirst({
        where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
      });
      if (file) {
        fileContext = `\n\nТекущий открытый файл: ${file.name} (${file.language})\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
      }
    } catch (_) {}
  }

  const systemPrompt = `Ты — CodeSync AI, умный ассистент для программирования. Ты помогаешь разработчикам прямо в IDE.
  
Ты можешь:
- Анализировать и объяснять код
- Исправлять ошибки
- Предлагать улучшения
- Отвечать на вопросы по программированию
- Искать информацию в интернете (если нужно)
- Помогать с архитектурой и проектированием

Отвечай на том же языке, на котором задан вопрос (русский или английский).
При необходимости форматируй код в блоки с указанием языка.${fileContext}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("AI chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI error: " + err.message })}\n\n`);
    res.end();
  }
});

aiRouter.post("/ai/review", async (req, res) => {
  const { code, language, roomId, fileId } = req.body as {
    code: string;
    language?: string;
    roomId?: string;
    fileId?: string;
  };

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  const lang = language ?? "javascript";

  const systemPrompt = `Ты — CodeSync AI код-ревьюер. Проанализируй предоставленный код и верни структурированный список проблем и предложений в формате JSON.

Формат ответа — ТОЛЬКО JSON массив без лишнего текста:
[
  {
    "line": <номер строки или null>,
    "severity": "error" | "warning" | "info",
    "message": "<краткое описание на русском>",
    "suggestion": "<конкретное предложение по исправлению>"
  }
]

Ищи:
- Ошибки и баги
- Потенциальные проблемы с производительностью
- Нарушения паттернов
- Проблемы безопасности
- Улучшения читаемости
- Плохие практики

Если код без замечаний, верни пустой массив [].`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Проверь этот ${lang} код:\n\`\`\`${lang}\n${code}\n\`\`\`` },
      ],
      stream: true,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        res.write(`data: ${JSON.stringify({ partial: delta })}\n\n`);
      }
    }

    try {
      let parsed = JSON.parse(fullContent);
      if (!Array.isArray(parsed)) {
        parsed = parsed.issues ?? parsed.review ?? parsed.items ?? [];
      }
      res.write(`data: ${JSON.stringify({ complete: true, issues: parsed })}\n\n`);
    } catch (_) {
      res.write(`data: ${JSON.stringify({ complete: true, issues: [] })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("AI review error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI error: " + err.message })}\n\n`);
    res.end();
  }
});

export default aiRouter;
