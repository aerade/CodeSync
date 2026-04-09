import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./ws/collaborationServer";
import { setupPtyServer } from "./ws/ptyServer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });
setupWebSocketServer(wss);

const ptyWss = new WebSocketServer({ noServer: true });
setupPtyServer(ptyWss);

httpServer.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";
  if (url.startsWith("/ws/pty")) {
    ptyWss.handleUpgrade(request, socket, head, (ws) => {
      ptyWss.emit("connection", ws, request);
    });
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logger.info({ path: "/ws/rooms/:roomId/files/:fileId" }, "WebSocket server ready");
  logger.info({ path: "/ws/pty" }, "PTY WebSocket server ready");
});
