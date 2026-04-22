import { Router, Request, Response } from "express";
import { authMiddleware } from "../auth.js";
import https from "https";

const router = Router();

interface ChatMessage { role: string; content: string; }

function streamOpenAI(messages: ChatMessage[], res: Response): void {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: "OPENAI_API_KEY not configured. Add it in Settings (Ctrl+,)." })}\n\n`);
    res.end();
    return;
  }

  const body = JSON.stringify({
    model: "gpt-4o-mini",
    messages,
    stream: true,
    max_tokens: 2048,
  });

  const options = {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (apiRes) => {
    apiRes.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        } catch { /* ignore */ }
      }
    });
    apiRes.on("end", () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });
    apiRes.on("error", () => {
      res.write(`data: ${JSON.stringify({ error: "OpenAI stream error" })}\n\n`);
      res.end();
    });
  });

  req.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.write(body);
  req.end();
}

function streamAnthropic(userMessages: ChatMessage[], systemPrompt: string, res: Response): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it in Settings (Ctrl+,)." })}\n\n`);
    res.end();
    return;
  }

  const body = JSON.stringify({
    model: "claude-3-5-haiku-20241022",
    system: systemPrompt,
    messages: userMessages,
    stream: true,
    max_tokens: 2048,
  });

  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (apiRes) => {
    apiRes.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
          }
        } catch { /* ignore */ }
      }
    });
    apiRes.on("end", () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });
    apiRes.on("error", () => {
      res.write(`data: ${JSON.stringify({ error: "Anthropic stream error" })}\n\n`);
      res.end();
    });
  });

  req.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.write(body);
  req.end();
}

interface ChatRequestBody {
  message?: string;
  history?: ChatMessage[];
  codeContext?: string;
  fileId?: string;
  roomId?: string;
  // legacy fields (kept for forward compat)
  messages?: ChatMessage[];
  code?: string;
  language?: string;
}

router.post("/ai/chat", authMiddleware, (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Build context from code if provided
  const code = body.codeContext ?? body.code ?? "";
  const systemPrompt = `You are an expert coding assistant integrated in CodeSync IDE.
Help users understand, debug, and improve their code. Be concise and helpful.
When providing code, wrap it in \`\`\`language blocks.${code ? `\n\nCurrent file content:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\`` : ""}`;

  // Build message list: history (if any) + current message
  let chatMessages: ChatMessage[] = [];

  if (body.messages && body.messages.length > 0) {
    // Legacy format: already-formatted message array
    chatMessages = body.messages.filter((m) => m.role !== "system");
  } else {
    // Standard format: history[] + message
    if (body.history && body.history.length > 0) {
      chatMessages = body.history.filter((m) => m.role !== "system");
    }
    if (body.message) {
      chatMessages.push({ role: "user", content: body.message });
    }
  }

  if (chatMessages.length === 0) {
    res.write(`data: ${JSON.stringify({ error: "No message provided" })}\n\n`);
    res.end();
    return;
  }

  if (process.env.ANTHROPIC_API_KEY) {
    streamAnthropic(chatMessages, systemPrompt, res);
  } else {
    const withSystem: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...chatMessages];
    streamOpenAI(withSystem, res);
  }
});

router.post("/ai/review", authMiddleware, (req: Request, res: Response) => {
  const { code, language } = req.body as { code?: string; language?: string };
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  const prompt = `Review this ${language ?? "code"} and return a JSON object:
{
  "issues": [{"line": number, "severity": "error"|"warning"|"info", "message": string, "suggestion": string}],
  "summary": string,
  "suggestions": [string]
}
Return only valid JSON, no markdown.

Code:
\`\`\`${language ?? ""}
${code.slice(0, 4000)}
\`\`\``;

  const makeRequest = (apiKey: string, useAnthropic: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const bodyStr = useAnthropic
        ? JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1024, messages: [{ role: "user", content: prompt }] })
        : JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 1024 });

      const options = useAnthropic
        ? { hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Length": Buffer.byteLength(bodyStr) } }
        : { hostname: "api.openai.com", path: "/v1/chat/completions", method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "Content-Length": Buffer.byteLength(bodyStr) } };

      const httpReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        apiRes.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const text = useAnthropic
              ? (parsed.content?.[0]?.text as string | undefined)
              : (parsed.choices?.[0]?.message?.content as string | undefined);
            resolve(text ?? "{}");
          } catch { reject(new Error("Failed to parse AI response")); }
        });
      });
      httpReq.on("error", reject);
      httpReq.write(bodyStr);
      httpReq.end();
    });
  };

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const doRequest = anthropicKey
    ? makeRequest(anthropicKey, true)
    : openaiKey
    ? makeRequest(openaiKey, false)
    : Promise.resolve(JSON.stringify({ issues: [], summary: "No AI key configured. Open Settings (Ctrl+,) to add one.", suggestions: [] }));

  doRequest.then((text) => {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { issues: [], summary: text, suggestions: [] };
      res.json(result);
    } catch {
      res.json({ issues: [], summary: text, suggestions: [] });
    }
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  });
});

export default router;
