import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { initDb, setupSchema } from "./db.js";
import authRouter from "./routes/auth.js";
import roomsRouter from "./routes/rooms.js";
import filesRouter from "./routes/files.js";
import executeRouter from "./routes/execute.js";
import aiRouter from "./routes/ai.js";
import { setupCollabServer } from "./ws/collab.js";

const PORT = Number(process.env.PORT ?? 57321);
const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "codesync.db");

async function main() {
  initDb(DB_PATH);
  await setupSchema();
  console.log("[codesync-server] database ready");

  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", authRouter);
  app.use("/api", roomsRouter);
  app.use("/api", filesRouter);
  app.use("/api", executeRouter);
  app.use("/api", aiRouter);

  app.get("/api/healthz", (_req, res) => { res.json({ status: "ok" }); });

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  setupCollabServer(wss);

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  process.on("SIGTERM", () => { server.close(); process.exit(0); });
  process.on("SIGINT", () => { server.close(); process.exit(0); });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[codesync-server] listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[codesync-server] fatal error:", err);
  process.exit(1);
});
