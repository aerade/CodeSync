import { WebSocketServer, WebSocket, RawData } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { roomMembersTable, yjsSnapshotsTable, filesTable, roomsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import * as Y from "yjs";
import { collabTokens } from "../routes/collab";

interface CollaboratorInfo {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

interface AwarenessState {
  cursor?: { anchor: number; head: number } | null;
  user?: { name: string; color: string };
}

const COLLABORATOR_COLORS = [
  "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
  "#F2CC60", "#79C0FF", "#56D364", "#FF7B72",
];

function getColor(index: number): string {
  return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length];
}

class FileRoom {
  public doc: Y.Doc;
  public clients: Map<WebSocket, CollaboratorInfo>;
  public awareness: Map<WebSocket, AwarenessState>;

  constructor() {
    this.doc = new Y.Doc();
    this.clients = new Map();
    this.awareness = new Map();
  }

  broadcastJSON(data: object, sender?: WebSocket) {
    const msg = JSON.stringify(data);
    for (const [client] of this.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  broadcastAwareness() {
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
      const bytes = Uint8Array.from(atob(snapshot.data), (c) => c.charCodeAt(0));
      Y.applyUpdate(doc, bytes);
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
    const data = btoa(String.fromCharCode(...update));
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

interface WsMessage {
  type: string;
  update?: string;
  state?: AwarenessState;
  position?: { lineNumber: number; column: number };
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

    // --- Authentication: require a valid collab token ---
    const collabToken = url.searchParams.get("token");
    if (!collabToken) {
      ws.close(1008, "Collab token required");
      return;
    }

    const tokenData = collabTokens.get(collabToken);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      collabTokens.delete(collabToken ?? "");
      ws.close(1008, "Invalid or expired collab token");
      return;
    }

    // Consume the token (one-time use for this connection)
    // Keep it alive for reconnects — remove after connection closes instead
    const { userId, username } = tokenData;

    // --- Verify fileId belongs to roomId ---
    const file = await db.query.filesTable.findFirst({
      where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
    });

    if (!file) {
      ws.close(1008, "File not found in room");
      return;
    }

    // --- Verify room membership for private rooms ---
    const room = await db.query.roomsTable.findFirst({
      where: eq(roomsTable.id, roomId),
    });

    if (!room) {
      ws.close(1008, "Room not found");
      return;
    }

    if (room.isPrivate) {
      const member = await db.query.roomMembersTable.findFirst({
        where: and(
          eq(roomMembersTable.roomId, roomId),
          eq(roomMembersTable.userId, userId)
        ),
      });
      if (!member) {
        ws.close(1008, "Not a member of this room");
        return;
      }
    }

    let fileRoom = fileRooms.get(key);
    if (!fileRoom) {
      fileRoom = new FileRoom();
      fileRooms.set(key, fileRoom);
      await loadYjsSnapshot(roomId, fileId, fileRoom.doc);
    }

    const colorIndex = fileRoom.clients.size;
    const color = getColor(colorIndex);
    const isGuest = tokenData.userId.startsWith("guest_");

    const collaborator: CollaboratorInfo = {
      userId,
      username,
      color,
      isGuest,
    };

    fileRoom.clients.set(ws, collaborator);
    fileRoom.awareness.set(ws, {});

    // Register member in DB (best-effort)
    db.insert(roomMembersTable).values({
      roomId,
      userId,
      username,
      isGuest,
      color,
    }).onConflictDoNothing().catch(() => {});

    // Send current document state to new client
    const initUpdate = Y.encodeStateAsUpdate(fileRoom.doc);
    ws.send(JSON.stringify({
      type: "init",
      update: btoa(String.fromCharCode(...initUpdate)),
    }));

    // Broadcast updated awareness to all
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

      let msg: WsMessage;
      try {
        msg = JSON.parse(data.toString()) as WsMessage;
      } catch {
        return;
      }

      if (msg.type === "yjs-update" && msg.update) {
        const bytes = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
        Y.applyUpdate(fileRoom.doc, bytes);
        // Broadcast to all other peers
        fileRoom.broadcastJSON({ type: "yjs-update", update: msg.update }, ws);
        scheduleSave(key, roomId, fileId, fileRoom.doc);
      } else if (msg.type === "awareness") {
        fileRoom.awareness.set(ws, msg.state ?? {});
        fileRoom.broadcastAwareness();
      } else if (msg.type === "cursor" && msg.position) {
        const info = fileRoom.clients.get(ws);
        if (info) {
          fileRoom.broadcastJSON({
            type: "cursor",
            userId: info.userId,
            username: info.username,
            color: info.color,
            position: msg.position,
          }, ws);
        }
      }
    });

    ws.on("close", async () => {
      if (!fileRoom) return;
      fileRoom.clients.delete(ws);
      fileRoom.awareness.delete(ws);
      fileRoom.broadcastAwareness();
      // Remove the used token on disconnect
      collabTokens.delete(collabToken);

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
      console.error("WebSocket client error:", err);
    });
  });
}
