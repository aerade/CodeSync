import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./ws/collaborationServer";

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

// No path restriction — the handler matches /ws/rooms/:roomId/files/:fileId internally
const wss = new WebSocketServer({ server: httpServer, noServer: false });
setupWebSocketServer(wss);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logger.info({ path: "/ws/rooms/:roomId/files/:fileId" }, "WebSocket server ready");
});
