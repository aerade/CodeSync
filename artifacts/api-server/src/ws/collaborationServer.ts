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
  activeFileId?: string;
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
    const states: Record<string, AwarenessState & { userId: string; username: string; color: string; isGuest: boolean }> = {};
    for (const [ws, info] of this.clients) {
      const aware = this.awareness.get(ws) ?? {};
      states[info.userId] = {
        ...aware,
        userId: info.userId,
        username: info.username,
        color: info.color,
        isGuest: info.isGuest,
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

export function broadcastFileContent(roomId: string, fileId: string, newContent: string) {
  const key = getRoomKey(roomId, fileId);
  const fileRoom = fileRooms.get(key);
  if (!fileRoom) return;
  const yText = fileRoom.doc.getText("content");
  fileRoom.doc.transact(() => {
    yText.delete(0, yText.length);
    yText.insert(0, newContent);
  });
  const update = Y.encodeStateAsUpdate(fileRoom.doc);
  const encoded = btoa(String.fromCharCode(...update));
  const msg = JSON.stringify({ type: "yjs-update", update: encoded });
  for (const [client] of fileRoom.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/**
 * Apply an AI-driven file edit:
 * - If clients are connected: update the live Yjs doc and broadcast to all
 * - If no clients: delete the stale Yjs snapshot so the next open re-reads from filesTable.content
 */
export async function applyAiFileEdit(roomId: string, fileId: string, newContent: string): Promise<void> {
  const key = getRoomKey(roomId, fileId);
  const fileRoom = fileRooms.get(key);
  if (fileRoom) {
    broadcastFileContent(roomId, fileId, newContent);
    // Persist Yjs snapshot immediately so the update survives a reconnect
    await saveYjsSnapshot(roomId, fileId, fileRoom.doc);
  } else {
    // No live document — invalidate stale Yjs snapshot so loadYjsSnapshot falls
    // back to filesTable.content (which we already updated) on the next open.
    await db.delete(yjsSnapshotsTable)
      .where(and(eq(yjsSnapshotsTable.roomId, roomId), eq(yjsSnapshotsTable.fileId, fileId)))
      .catch(() => {});
  }
}

export function getActiveUserCountForRoom(roomId: string): number {
  const users = new Set<string>();
  for (const [key, fr] of fileRooms) {
    if (!key.startsWith(`${roomId}:`)) continue;
    for (const info of fr.clients.values()) {
      users.add(info.userId);
    }
  }
  return users.size;
}

/**
 * Collect all connected users across every file-room for a given roomId and
 * broadcast the combined awareness state to every one of them.
 * This ensures participants editing different files still see each other.
 */
function broadcastRoomAwareness(roomId: string) {
  const states: Record<string, AwarenessState & { userId: string; username: string; color: string; isGuest: boolean; activeFileId?: string }> = {};

  for (const [key, fr] of fileRooms) {
    if (!key.startsWith(`${roomId}:`)) continue;
    for (const [ws, info] of fr.clients) {
      const aware = fr.awareness.get(ws) ?? {};
      states[info.userId] = {
        ...aware,
        userId: info.userId,
        username: info.username,
        color: info.color,
        isGuest: info.isGuest,
        activeFileId: info.activeFileId,
      };
    }
  }

  const msg = JSON.stringify({ type: "awareness", states });

  for (const [key, fr] of fileRooms) {
    if (!key.startsWith(`${roomId}:`)) continue;
    for (const [client] of fr.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
}

const roomUserColors = new Map<string, string>();

function getStableColor(roomId: string, userId: string): string {
  const key = `${roomId}:${userId}`;
  if (roomUserColors.has(key)) return roomUserColors.get(key)!;
  const color = getColor(roomUserColors.size);
  roomUserColors.set(key, color);
  return color;
}

async function loadYjsSnapshot(roomId: string, fileId: string, doc: Y.Doc) {
  try {
    const snap = await db.query.yjsSnapshotsTable.findFirst({
      where: and(
        eq(yjsSnapshotsTable.roomId, roomId),
        eq(yjsSnapshotsTable.fileId, fileId)
      ),
    });

    if (snap?.data) {
      const bytes = Uint8Array.from(atob(snap.data), (c) => c.charCodeAt(0));
      Y.applyUpdate(doc, bytes);
    } else {
      const file = await db.query.filesTable.findFirst({ where: eq(filesTable.id, fileId) });
      if (file?.content) {
        const yText = doc.getText("content");
        yText.insert(0, file.content);
      }
    }
  } catch (err) {
    console.error("Error loading Yjs snapshot:", err);
  }
}

async function saveYjsSnapshot(roomId: string, fileId: string, doc: Y.Doc) {
  try {
    const update = Y.encodeStateAsUpdate(doc);
    const data = btoa(String.fromCharCode(...update));
    const content = doc.getText("content").toString();

    await db.transaction(async (tx) => {
      const existing = await tx.query.yjsSnapshotsTable.findFirst(
        { where: and(
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

interface ChatFileAttachment {
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
}

interface ReplyInfo {
  id: string;
  username: string;
  content: string;
}

interface WsMessage {
  type: string;
  update?: string;
  state?: AwarenessState;
  position?: { lineNumber: number; column: number };
  message?: string;
  imageDataUrl?: string;
  fileAttachment?: ChatFileAttachment;
  replyTo?: ReplyInfo;
  messageId?: string;
  editedContent?: string;
  mouseX?: number;
  mouseY?: number;
  activeFileId?: string;
  emoji?: string;
  remove?: boolean;
  // preview sync bus
  data?: unknown;
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
    const isRoomPresenceOnly = fileId === "__room__";

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

    const { userId, username } = tokenData;

    // --- Verify fileId belongs to roomId (skip for room-level presence) ---
    if (!isRoomPresenceOnly) {
      const file = await db.query.filesTable.findFirst({
        where: and(eq(filesTable.id, fileId), eq(filesTable.roomId, roomId)),
      });

      if (!file) {
        ws.close(1008, "File not found in room");
        return;
      }
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

    // Enforce max users per room (count unique users across all file rooms for this room)
    const uniqueUsersInRoom = new Set<string>();
    for (const [roomKey, fr] of fileRooms) {
      if (roomKey.startsWith(`${roomId}:`)) {
        for (const [, info] of fr.clients) {
          uniqueUsersInRoom.add(info.userId);
        }
      }
    }
    const maxUsers = room.maxUsers ?? 5;
    if (!uniqueUsersInRoom.has(userId) && uniqueUsersInRoom.size >= maxUsers) {
      ws.close(1008, `Room is full (max ${maxUsers} users)`);
      return;
    }

    let fileRoom = fileRooms.get(key);
    if (!fileRoom) {
      fileRoom = new FileRoom();
      fileRooms.set(key, fileRoom);
      if (!isRoomPresenceOnly) {
        await loadYjsSnapshot(roomId, fileId, fileRoom.doc);
      }
    }

    const color = getStableColor(roomId, userId);
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

    // Send current document state to new client (only for file connections)
    if (!isRoomPresenceOnly) {
      const initUpdate = Y.encodeStateAsUpdate(fileRoom.doc);
      ws.send(JSON.stringify({
        type: "init",
        update: btoa(String.fromCharCode(...initUpdate)),
      }));
    }

    // Broadcast updated awareness to all clients in the room (across all files)
    broadcastRoomAwareness(roomId);

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

      if (msg.type === "yjs-update" && msg.update && !isRoomPresenceOnly) {
        if (collaborator.isGuest) return;
        const bytes = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
        Y.applyUpdate(fileRoom.doc, bytes);
        fileRoom.broadcastJSON({ type: "yjs-update", update: msg.update }, ws);
        scheduleSave(key, roomId, fileId, fileRoom.doc);
      } else if (msg.type === "awareness") {
        fileRoom.awareness.set(ws, msg.state ?? {});
        broadcastRoomAwareness(roomId);
      } else if (msg.type === "cursor" && msg.position && !isRoomPresenceOnly) {
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
      } else if (msg.type === "mouse-cursor") {
        const info = fileRoom.clients.get(ws);
        if (info) {
          if (msg.activeFileId) info.activeFileId = msg.activeFileId;
          const mouseMsg = JSON.stringify({
            type: "mouse-cursor",
            userId: info.userId,
            username: info.username,
            color: info.color,
            mouseX: msg.mouseX,
            mouseY: msg.mouseY,
            activeFileId: info.activeFileId,
            isTyping: msg.activeFileId === fileId,
          });
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client, clientInfo] of fr.clients) {
              if (client !== ws && client.readyState === WebSocket.OPEN && clientInfo.userId !== info.userId) {
                client.send(mouseMsg);
              }
            }
          }
        }
      } else if (msg.type === "file-presence") {
        const info = fileRoom.clients.get(ws);
        if (info && msg.activeFileId) {
          info.activeFileId = msg.activeFileId;
          broadcastRoomAwareness(roomId);
        }
      } else if (msg.type === "chat" && msg.message) {
        const info = fileRoom.clients.get(ws);
        if (info) {
          const messageId = `msg_${Date.now()}_${info.userId.slice(0, 8)}`;
          const chatMsg = {
            type: "chat",
            messageId,
            userId: info.userId,
            username: info.username,
            color: info.color,
            message: msg.message,
            imageDataUrl: msg.imageDataUrl,
            fileAttachment: msg.fileAttachment,
            replyTo: msg.replyTo,
            timestamp: Date.now(),
          };
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client] of fr.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(chatMsg));
              }
            }
          }
        }
      } else if (msg.type === "chat_edit" && msg.messageId && msg.editedContent !== undefined) {
        const info = fileRoom.clients.get(ws);
        if (info) {
          const editMsg = {
            type: "chat_edit",
            messageId: msg.messageId,
            userId: info.userId,
            editedContent: msg.editedContent,
          };
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client] of fr.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(editMsg));
              }
            }
          }
        }
      } else if (msg.type === "chat_delete" && msg.messageId) {
        const info = fileRoom.clients.get(ws);
        if (info) {
          const deleteMsg = {
            type: "chat_delete",
            messageId: msg.messageId,
            userId: info.userId,
          };
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client] of fr.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(deleteMsg));
              }
            }
          }
        }
      } else if (msg.type === "chat_reaction" && msg.messageId && msg.emoji) {
        const info = fileRoom.clients.get(ws);
        if (info) {
          const reactionMsg = JSON.stringify({
            type: "chat_reaction",
            messageId: msg.messageId,
            emoji: msg.emoji,
            userId: info.userId,
            remove: msg.remove ?? false,
          });
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client] of fr.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(reactionMsg);
              }
            }
          }
        }
      } else if (msg.type === "preview-sync") {
        // Broadcast preview state to all room participants (including sender)
        // so every open preview iframe stays in sync
        const info = fileRoom.clients.get(ws);
        if (info) {
          const syncMsg = JSON.stringify({
            type: "preview-sync",
            senderId: info.userId,
            data: msg.data,
          });
          for (const [rKey, fr] of fileRooms) {
            if (!rKey.startsWith(`${roomId}:`)) continue;
            for (const [client, clientInfo] of fr.clients) {
              // send to everyone except the originator (they applied it locally already)
              if (client !== ws && client.readyState === WebSocket.OPEN && clientInfo.userId !== info.userId) {
                client.send(syncMsg);
              }
            }
          }
        }
      }
    });

    ws.on("close", async () => {
      if (!fileRoom) return;
      fileRoom.clients.delete(ws);
      fileRoom.awareness.delete(ws);
      collabTokens.delete(collabToken);

      const userStillInRoom = [...fileRooms.entries()].some(
        ([k, fr]) => k.startsWith(`${roomId}:`) && [...fr.clients.values()].some((i) => i.userId === userId)
      );
      if (!userStillInRoom) {
        roomUserColors.delete(`${roomId}:${userId}`);
      }

      broadcastRoomAwareness(roomId);

      if (fileRoom.clients.size === 0) {
        if (!isRoomPresenceOnly) {
          await saveYjsSnapshot(roomId, fileId, fileRoom.doc);
        }
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
