function getApiBase(): string {
  // Priority 1: Electron preload injected URL (synchronous, available before React loads)
  if (typeof window !== "undefined" && window.__ELECTRON_API_URL__) {
    return `${window.__ELECTRON_API_URL__}/api`;
  }
  // Priority 2: Electron IPC synchronous call
  if (typeof window !== "undefined" && window.electronAPI?.getApiUrlSync) {
    const url = window.electronAPI.getApiUrlSync();
    if (url) return `${url}/api`;
  }
  // Priority 3: Build-time env var (for Replit dev server or Docker)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  if (typeof window === "undefined") return "/api";
  const origin = window.location.origin;
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (pathParts.length > 0 && (pathParts[0] === "desktop" || pathParts[0] === "codesync")) {
    return `${origin}/api`;
  }
  return "/api";
}

export const API_BASE = getApiBase();

let _token: string | null = null;
let _currentUser: User | null = null;

export interface User {
  id: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  isGuest: boolean;
  createdAt: string;
}

export interface Room {
  id: string;
  title: string;
  description?: string | null;
  isPrivate: boolean;
  inviteCode: string;
  ownerId: string;
  maxUsers: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  isGuest: boolean;
  color: string;
  joinedAt: string;
}

export interface File {
  id: string;
  roomId: string;
  name: string;
  path: string;
  language: string;
  content: string;
  parentId?: string | null;
  isFolder: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  type: string;
  description: string;
  createdAt: string;
}

export function setToken(token: string) {
  _token = token;
  localStorage.setItem("cs_token", token);
}

export function getToken(): string | null {
  if (_token) return _token;
  return localStorage.getItem("cs_token");
}

export function setCurrentUser(user: User) {
  _currentUser = user;
}

export function getCurrentUser(): User | null {
  return _currentUser;
}

export function clearAuth() {
  _token = null;
  _currentUser = null;
  localStorage.removeItem("cs_token");
}

function getInternalToken(): string | undefined {
  if (typeof window !== "undefined" && window.__INTERNAL_TOKEN__) return window.__INTERNAL_TOKEN__;
  return undefined;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const internalToken = getInternalToken();
  if (internalToken) headers["X-Internal-Token"] = internalToken;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getMe: () => request<User>("/auth/me"),

  createGuestSession: (username: string) =>
    request<{ token: string; user: User }>("/auth/guest", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  listRooms: (search?: string) =>
    request<Room[]>(`/rooms${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  createRoom: (data: { title: string; description?: string; isPrivate?: boolean; maxUsers?: number }) =>
    request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),

  getRoom: (roomId: string) => request<Room>(`/rooms/${roomId}`),

  getRoomByInviteCode: (code: string) => request<Room>(`/rooms/join/${code}`),

  deleteRoom: (roomId: string) =>
    request<void>(`/rooms/${roomId}`, { method: "DELETE" }),

  getRoomMembers: (roomId: string) => request<RoomMember[]>(`/rooms/${roomId}/members`),

  getRoomFiles: (roomId: string) => request<File[]>(`/rooms/${roomId}/files`),

  createFile: (roomId: string, data: { name: string; path: string; language?: string; content?: string; parentId?: string; isFolder?: boolean }) =>
    request<File>(`/rooms/${roomId}/files`, { method: "POST", body: JSON.stringify(data) }),

  getFile: (roomId: string, fileId: string) => request<File>(`/rooms/${roomId}/files/${fileId}`),

  updateFile: (roomId: string, fileId: string, data: Partial<Pick<File, "name" | "path" | "language" | "content" | "parentId">>) =>
    request<File>(`/rooms/${roomId}/files/${fileId}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteFile: (roomId: string, fileId: string) =>
    request<void>(`/rooms/${roomId}/files/${fileId}`, { method: "DELETE" }),

  getRoomEvents: (roomId: string, limit = 50) =>
    request<Event[]>(`/rooms/${roomId}/events?limit=${limit}`),

  executeCode: (data: { language: string; code: string; stdin?: string; roomId?: string }) =>
    request<{ stdout: string; stderr: string; exitCode: number; runtime: number; language: string }>("/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  async aiChat(
    data: { message: string; roomId?: string; fileId?: string; codeContext?: string; history?: { role: string; content: string }[] },
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const internalToken = getInternalToken();
    if (internalToken) headers["X-Internal-Token"] = internalToken;

    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      signal,
    });

    if (!res.ok) throw new Error(`AI chat error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") return;
          try {
            const json = JSON.parse(raw);
            if (json.done) return;
            if (json.error) throw new Error(json.error);
            // Embedded server format: { delta: "..." }
            // OpenAI-proxy format: { choices: [{delta: {content: "..."}}] }
            const text = json.delta ?? json.choices?.[0]?.delta?.content ?? json.text ?? "";
            if (text) onChunk(text);
          } catch {
            if (raw) onChunk(raw);
          }
        }
      }
    }
  },

  aiReview: (data: { code: string; language: string; roomId?: string; fileId?: string }) =>
    request<{ issues: { line?: number; severity: string; message: string; suggestion?: string }[]; summary: string; suggestions: string[] }>("/ai/review", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
