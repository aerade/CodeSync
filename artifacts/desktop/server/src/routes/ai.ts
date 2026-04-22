import { Router, Request, Response } from "express";
import { authMiddleware } from "../auth.js";
import https from "https";

const router = Router();

function streamOpenAI(messages: any[], res: Response, onDone?: (text: string) => void): void {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: "OPENAI_API_KEY not set. Add it in Settings." })}\n\n`);
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
    let fullText = "";
    apiRes.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        } catch { /* ignore parse errors */ }
      }
    });
    apiRes.on("end", () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      onDone?.(fullText);
    });
  });

  req.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.write(body);
  req.end();
}

function streamAnthropic(messages: any[], systemPrompt: string, res: Response): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: "ANTHROPIC_API_KEY not set. Add it in Settings." })}\n\n`);
    res.end();
    return;
  }

  const body = JSON.stringify({
    model: "claude-3-5-haiku-20241022",
    system: systemPrompt,
    messages,
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
  });

  req.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.write(body);
  req.end();
}

router.post("/ai/chat", authMiddleware, (req: Request, res: Response) => {
  const { messages, code, language, fileId } = req.body as any;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const systemPrompt = `You are an expert coding assistant integrated in CodeSync IDE. 
You help users understand, debug, and improve their code.
Current language: ${language ?? "unknown"}.
${code ? `Current file content:\n\`\`\`${language ?? ""}\n${code.slice(0, 3000)}\n\`\`\`` : ""}
When providing code, wrap it in \`\`\`language blocks. Be concise and helpful.`;

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...(messages ?? []),
  ];

  if (process.env.ANTHROPIC_API_KEY) {
    const nonSystemMessages = chatMessages.filter(m => m.role !== "system");
    streamAnthropic(nonSystemMessages, systemPrompt, res);
  } else {
    streamOpenAI(chatMessages, res);
  }
});

router.post("/ai/review", authMiddleware, (req: Request, res: Response) => {
  const { code, language } = req.body as any;
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  const prompt = `Review this ${language ?? "code"} and return a JSON object with:
{
  "issues": [{"line": number, "severity": "error"|"warning"|"info", "message": string, "suggestion": string}],
  "summary": string,
  "suggestions": [string]
}
Only return valid JSON, no markdown.

Code:
\`\`\`${language ?? ""}
${code.slice(0, 4000)}
\`\`\``;

  const makeRequest = (apiKey: string, useAnthropic: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const body = useAnthropic
        ? JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          })
        : JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1024,
          });

      const options = useAnthropic
        ? {
            hostname: "api.anthropic.com",
            path: "/v1/messages",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "Content-Length": Buffer.byteLength(body),
            },
          }
        : {
            hostname: "api.openai.com",
            path: "/v1/chat/completions",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "Content-Length": Buffer.byteLength(body),
            },
          };

      const httpReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        apiRes.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const text = useAnthropic
              ? parsed.content?.[0]?.text
              : parsed.choices?.[0]?.message?.content;
            resolve(text ?? "{}");
          } catch { reject(new Error("Failed to parse response")); }
        });
      });
      httpReq.on("error", reject);
      httpReq.write(body);
      httpReq.end();
    });
  };

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const doRequest = anthropicKey
    ? makeRequest(anthropicKey, true)
    : openaiKey
    ? makeRequest(openaiKey, false)
    : Promise.resolve(JSON.stringify({ issues: [], summary: "No AI key configured. Add one in Settings.", suggestions: [] }));

  doRequest.then(text => {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { issues: [], summary: text, suggestions: [] };
      res.json(result);
    } catch {
      res.json({ issues: [], summary: text, suggestions: [] });
    }
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

export default router;
