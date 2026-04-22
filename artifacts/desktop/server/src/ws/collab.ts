import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import * as Y from "yjs";
import { client, newId } from "../db.js";
import { verifyCollabToken } from "../auth.js";

interface ClientInfo { ws: WebSocket; userId: string; username: string; roomId: string; fileId: string; }

const rooms = new Map<string, Map<string, Y.Doc>>();
const clients = new Map<WebSocket, ClientInfo>();

async function getOrCreateDoc(roomId: string, fileId: string): Promise<Y.Doc> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const roomDocs = rooms.get(roomId)!;
  if (roomDocs.has(fileId)) return roomDocs.get(fileId)!;

  const doc = new Y.Doc();

  try {
    const snapshot = await client.execute({
      sql: "SELECT data FROM yjs_snapshots WHERE room_id = ? AND file_id = ?",
      args: [roomId, fileId],
    });
    if (snapshot.rows.length > 0 && snapshot.rows[0].data) {
      const update = Uint8Array.from(Buffer.from(snapshot.rows[0].data as string, "base64"));
      Y.applyUpdate(doc, update);
    } else {
      const fileRes = await client.execute({ sql: "SELECT content FROM files WHERE id = ?", args: [fileId] });
      if (fileRes.rows.length > 0 && fileRes.rows[0].content) {
        const yText = doc.getText("content");
        yText.insert(0, fileRes.rows[0].content as string);
      }
    }
  } catch { /* ignore */ }

  roomDocs.set(fileId, doc);
  return doc;
}

async function saveSnapshot(roomId: string, fileId: string, doc: Y.Doc): Promise<void> {
  const update = Y.encodeStateAsUpdate(doc);
  const encoded = Buffer.from(update).toString("base64");
  const ts = Date.now();
  try {
    await client.execute({
      sql: `INSERT INTO yjs_snapshots (id, room_id, file_id, data, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(room_id, file_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [newId(), roomId, fileId, encoded, ts],
    });
  } catch { /* ignore */ }
}

function broadcast(roomId: string, fileId: string, message: object, exclude?: WebSocket): void {
  const msg = JSON.stringify(message);
  for (const [ws, info] of clients) {
    if (ws !== exclude && info.roomId === roomId && info.fileId === fileId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function setupCollabServer(wss: WebSocketServer): void {
  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const pathMatch = url.pathname.match(/\/ws\/rooms\/([^/]+)\/files\/([^/]+)/);
    if (!pathMatch) { ws.close(1008, "Invalid path"); return; }

    const [, roomId, fileId] = pathMatch;
    const token = url.searchParams.get("token");
    if (!token) { ws.close(1008, "No token"); return; }

    const user = verifyCollabToken(token);
    if (!user) { ws.close(1008, "Invalid token"); return; }

    const doc = await getOrCreateDoc(roomId, fileId);
    clients.set(ws, { ws, userId: user.id, username: user.username, roomId, fileId });

    const initUpdate = Y.encodeStateAsUpdate(doc);
    ws.send(JSON.stringify({
      type: "init",
      update: Buffer.from(initUpdate).toString("base64"),
    }));

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "yjs-update" && msg.update) {
          const update = Uint8Array.from(Buffer.from(msg.update, "base64"));
          Y.applyUpdate(doc, update);

          const text = doc.getText("content").toString();
          const ts = Date.now();
          await client.execute({
            sql: "UPDATE files SET content = ?, updated_at = ? WHERE id = ?",
            args: [text, ts, fileId],
          });

          await saveSnapshot(roomId, fileId, doc);
          broadcast(roomId, fileId, { type: "yjs-update", update: msg.update }, ws);
        }

        if (msg.type === "awareness") {
          broadcast(roomId, fileId, { type: "awareness", userId: user.id, ...msg }, ws);
        }
      } catch { /* ignore */ }
    });

    ws.on("close", () => {
      clients.delete(ws);
      broadcast(roomId, fileId, { type: "user-left", userId: user.id });
    });

    broadcast(roomId, fileId, { type: "user-joined", userId: user.id, username: user.username }, ws);
  });
}
