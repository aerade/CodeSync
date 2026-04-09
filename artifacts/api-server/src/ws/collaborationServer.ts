import { WebSocketServer, WebSocket, RawData } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { roomMembersTable, eventsTable, yjsSnapshotsTable, filesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import * as Y from "yjs";

interface CollaboratorInfo {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

interface RoomFileKey {
  roomId: string;
  fileId: string;
}

const COLLABORATOR_COLORS = [
  "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
  "#F2CC60", "#79C0FF", "#56D364", "#FF7B72",
  "#A5D6FF", "#FFAB70", "#7EE787", "#FFA0AC",
];

function getColor(index: number): string {
  return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length];
}

type AwarenessState = {
  cursor?: { anchor: number; head: number } | null;
  user?: { name: string; color: string };
};

class FileRoom {
  public doc: Y.Doc;
  public clients: Map<WebSocket, CollaboratorInfo>;
  public awareness: Map<WebSocket, AwarenessState>;

  constructor() {
    this.doc = new Y.Doc();
    this.clients = new Map();
    this.awareness = new Map();
  }

  broadcast(data: Buffer | string, sender?: WebSocket) {
    const msg = typeof data === "string" ? Buffer.from(data) : data;
    for (const [client] of this.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  broadcastAwareness(sender?: WebSocket) {
    const states: Record<string, AwarenessState & { userId: string; username: string; color: string }> = {};
    for (const [ws, info] of this.clients) {
      const aware = this.awareness.get(ws) ?? {};
      states[info.userId] = {
        ...aware,
        userId: info.userId,
        username: info.username,
        color: info.color,
      };
    }
    const msg = JSON.stringify({ type: "awareness", states });
    for (const [client] of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
}

const fileRooms = new Map<string, FileRoom>();

function getRoomKey(roomId: string, fileId: string): string {
  return `${roomId}:${fileId}`;
}

async function loadYjsSnapshot(roomId: string, fileId: string, doc: Y.Doc): Promise<void> {
  try {
    const snapshot = await db.query.yjsSnapshotsTable.findFirst({
      where: and(
        eq(yjsSnapshotsTable.roomId, roomId),
        eq(yjsSnapshotsTable.fileId, fileId)
      ),
    });

    if (snapshot?.data) {
      const update = Buffer.from(snapshot.data as string, "base64");
      Y.applyUpdate(doc, update);
    } else {
      const file = await db.query.filesTable.findFirst({
        where: eq(filesTable.id, fileId),
      });
      if (file?.content) {
        const yText = doc.getText("content");
        doc.transact(() => {
          yText.insert(0, file.content);
        });
      }
    }
  } catch (err) {
    console.error("Error loading Yjs snapshot:", err);
  }
}

async function saveYjsSnapshot(roomId: string, fileId: string, doc: Y.Doc): Promise<void> {
  try {
    const update = Y.encodeStateAsUpdate(doc);
    const data = Buffer.from(update).toString("base64");
    const content = doc.getText("content").toString();

    await db.transaction(async (tx) => {
      const existing = await tx.query.yjsSnapshotsTable.findFirst({
        where: and(
          eq(yjsSnapshotsTable.roomId, roomId),
          eq(yjsSnapshotsTable.fileId, fileId)
        ),
      });

      if (existing) {
        await tx.update(yjsSnapshotsTable)
          .set({ data, updatedAt: new Date() })
          .where(and(
            eq(yjsSnapshotsTable.roomId, roomId),
            eq(yjsSnapshotsTable.fileId, fileId)
          ));
      } else {
        await tx.insert(yjsSnapshotsTable).values({ roomId, fileId, data });
      }

      await tx.update(filesTable)
        .set({ content, updatedAt: new Date() })
        .where(eq(filesTable.id, fileId));
    });
  } catch (err) {
    console.error("Error saving Yjs snapshot:", err);
  }
}

export function setupWebSocketServer(wss: WebSocketServer) {
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleSave(key: string, roomId: string, fileId: string, doc: Y.Doc) {
    const existing = saveTimers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      await saveYjsSnapshot(roomId, fileId, doc);
      saveTimers.delete(key);
    }, 2000);
    saveTimers.set(key, timer);
  }

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", `http://localhost`);
    const pathMatch = url.pathname.match(/^\/ws\/rooms\/([^/]+)\/files\/([^/]+)$/);

    if (!pathMatch) {
      ws.close(1008, "Invalid WebSocket path");
      return;
    }

    const [, roomId, fileId] = pathMatch;
    const key = getRoomKey(roomId, fileId);

    const guestToken = url.searchParams.get("guestToken");
    const username = url.searchParams.get("username") ?? "Аноним";
    const userId = url.searchParams.get("userId") ?? `anon_${Date.now()}`;

    let fileRoom = fileRooms.get(key);
    if (!fileRoom) {
      fileRoom = new FileRoom();
      fileRooms.set(key, fileRoom);
      await loadYjsSnapshot(roomId, fileId, fileRoom.doc);
    }

    const colorIndex = fileRoom.clients.size;
    const color = getColor(colorIndex);

    const collaborator: CollaboratorInfo = {
      userId,
      username,
      color,
      isGuest: !!guestToken,
    };

    fileRoom.clients.set(ws, collaborator);
    fileRoom.awareness.set(ws, {});

    try {
      await db.insert(roomMembersTable).values({
        roomId,
        userId,
        username,
        isGuest: !!guestToken,
        color,
      }).onConflictDoNothing();
    } catch (_) {}

    const initUpdate = Y.encodeStateAsUpdate(fileRoom.doc);
    ws.send(JSON.stringify({ type: "init", update: Buffer.from(initUpdate).toString("base64") }));

    fileRoom.broadcastAwareness();

    ws.send(JSON.stringify({
      type: "joined",
      userId,
      username,
      color,
      roomId,
      fileId,
    }));

    ws.on("message", async (data: RawData) => {
      if (!fileRoom) return;

      let msgStr: string;
      try {
        msgStr = data.toString();
      } catch (_) {
        return;
      }

      try {
        const msg = JSON.parse(msgStr);

        if (msg.type === "yjs-update") {
          const update = Buffer.from(msg.update, "base64");
          Y.applyUpdate(fileRoom.doc, update);
          fileRoom.broadcast(JSON.stringify({ type: "yjs-update", update: msg.update }), ws);
          scheduleSave(key, roomId, fileId, fileRoom.doc);
        } else if (msg.type === "awareness") {
          fileRoom.awareness.set(ws, msg.state ?? {});
          fileRoom.broadcastAwareness(ws);
        } else if (msg.type === "cursor") {
          fileRoom.broadcast(JSON.stringify({
            type: "cursor",
            userId,
            username,
            color,
            position: msg.position,
          }), ws);
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    });

    ws.on("close", async () => {
      if (!fileRoom) return;
      fileRoom.clients.delete(ws);
      fileRoom.awareness.delete(ws);

      fileRoom.broadcastAwareness();

      if (fileRoom.clients.size === 0) {
        await saveYjsSnapshot(roomId, fileId, fileRoom.doc);
        fileRooms.delete(key);
        const timer = saveTimers.get(key);
        if (timer) {
          clearTimeout(timer);
          saveTimers.delete(key);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });
}
