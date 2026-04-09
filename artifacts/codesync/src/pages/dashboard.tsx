import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, UserButton, SignInButton } from "@clerk/react";
import {
  useListRooms,
  useCreateRoom,
  useDeleteRoom,
  getListRoomsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GridBackground } from "@/components/GridBackground";
import { Logo } from "@/components/Logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const createRoom = useCreateRoom();

  function handleCreate() {
    if (!title.trim()) return;
    setCreateError("");
    createRoom.mutate(
      { data: { title: title.trim(), description: description.trim() || undefined, isPrivate } },
      {
        onSuccess: (room) => {
          qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          onClose();
          setLocation(`/room/${room.id}`);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("409") || msg.toLowerCase().includes("уже существует")) {
            setCreateError("Комната с таким названием уже существует");
          } else if (msg.includes("401") || msg.toLowerCase().includes("auth")) {
            setCreateError("Гости не могут создавать комнаты. Войдите в аккаунт.");
          } else {
            setCreateError(msg || "Ошибка при создании комнаты");
          }
        },
      }
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 42,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 14,
    padding: "0 14px",
    outline: "none",
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        style={{
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(32px)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#fff", fontWeight: 700 }}>Создать комнату</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          <input
            placeholder="Название комнаты"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setCreateError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={inputStyle}
            data-testid="input-room-title"
          />
          <input
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            data-testid="input-room-description"
          />
          <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-private">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "#fff" }}
            />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Приватная комната</span>
          </label>
          {createError && <p className="text-sm" style={{ color: "#ef4444" }}>{createError}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || createRoom.isPending}
              style={{
                flex: 1,
                height: 40,
                background: title.trim() ? "#fff" : "rgba(255,255,255,0.1)",
                color: title.trim() ? "#000" : "rgba(255,255,255,0.3)",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: title.trim() ? "pointer" : "not-allowed",
              }}
              data-testid="btn-confirm-create"
            >
              {createRoom.isPending ? "Создание..." : "Создать"}
            </button>
            <button
              onClick={onClose}
              style={{
                height: 40,
                padding: "0 16px",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Room {
  id: string;
  title: string;
  description?: string | null;
  isPrivate: boolean;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
}

function RoomCard({ room, onOpen, onDelete }: { room: Room; onOpen: () => void; onDelete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="room-card glass rounded-xl p-4 flex flex-col"
      style={{ minHeight: 110 }}
      data-testid={`card-room-${room.id}`}
    >
      {/* Top: title + menu */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
              {room.title}
            </h3>
            {room.isPrivate && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-md shrink-0"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 10,
                }}
              >
                Приватная
              </span>
            )}
          </div>
          {room.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.35)" }}>{room.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded opacity-25 hover:opacity-60 transition-opacity shrink-0"
              style={{ color: "rgba(255,255,255,0.8)", background: "none", border: "none", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            style={{
              background: "rgba(12,12,12,0.92)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            <DropdownMenuItem style={{ color: "#ef4444" }} onClick={onDelete}>
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Spacer — pushes bottom row to the card bottom */}
      <div className="flex-1" />

      {/* Bottom: online count + invite code + open button — always at card bottom */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="online-dot" />
            {room.memberCount}
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-md"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.3)",
              border: "1px solid rgba(255,255,255,0.07)",
              letterSpacing: "0.08em",
            }}
          >
            {room.inviteCode}
          </span>
        </div>
        <button
          onClick={onOpen}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-90"
          style={{
            background: "#fff",
            color: "#000",
            border: "none",
            cursor: "pointer",
          }}
          data-testid={`btn-open-room-${room.id}`}
        >
          Открыть
        </button>
      </div>
    </motion.div>
  );
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Dashboard() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [search, setSearch] = useState("");

  const guestToken = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_token") : null;
  const guestUsername = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_username") : null;
  // Only treat as guest when Clerk has fully loaded AND confirmed no signed-in user.
  // Prevents Gmail/OAuth redirect window from briefly showing guest-mode UI.
  const isGuest = isLoaded && !isSignedIn && !!guestToken;

  useEffect(() => {
    if (isLoaded && !isSignedIn && !guestToken) setLocation("/");
  }, [isLoaded, isSignedIn, guestToken, setLocation]);

  const qc = useQueryClient();
  const searchParams = search ? { search } : undefined;
  const { data: rooms = [], isLoading } = useListRooms(searchParams, {
    query: { queryKey: getListRoomsQueryKey(searchParams) },
  });
  const deleteRoom = useDeleteRoom();

  if (isLoaded && !isSignedIn && !guestToken) return null;

  async function handleJoinByCode() {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError("");
    try {
      const headers: Record<string, string> = {};
      if (guestToken) headers["x-guest-token"] = guestToken;
      const resp = await fetch(`${basePath}/api/rooms/join/${inviteCode.trim().toUpperCase()}`, { headers });
      if (!resp.ok) { setJoinError("Комната не найдена"); return; }
      const room = await resp.json() as { id: string };
      setLocation(`/room/${room.id}`);
    } catch {
      setJoinError("Ошибка подключения");
    } finally {
      setIsJoining(false);
    }
  }

  function handleDelete(roomId: string) {
    deleteRoom.mutate({ roomId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListRoomsQueryKey() }); },
    });
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 13,
    padding: "0 12px",
    outline: "none",
    height: 36,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#030303", color: "#f0f0f0", overflow: "auto" }}>
      <GridBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* HEADER */}
        <header
          className="flex items-center justify-between px-6 py-3 sticky top-0 z-20"
          style={{
            background: "rgba(3,3,3,0.7)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3">
            <Logo size={26} />
            <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>CodeSync</span>
          </div>
          <div className="flex items-center gap-3">
            {isGuest ? (
              <>
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Гость: {guestUsername}
                </span>
                <SignInButton mode="modal">
                  <button
                    style={{
                      height: 32,
                      padding: "0 14px",
                      background: "#fff",
                      color: "#000",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Войти
                  </button>
                </SignInButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    background: "#fff",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  data-testid="btn-create-room"
                >
                  + Создать комнату
                </button>
                <UserButton />
              </>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
          {/* Join by code */}
          <div
            className="mb-6 p-4 rounded-xl glass flex items-center gap-3"
          >
            <span className="text-sm font-medium shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
              Войти в комнату:
            </span>
            <input
              placeholder="Код приглашения"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
              style={{
                ...inputStyle,
                flex: 1,
                maxWidth: 180,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.1em",
              }}
              data-testid="input-join-code"
            />
            <button
              onClick={handleJoinByCode}
              disabled={!inviteCode.trim() || isJoining}
              style={{
                height: 36,
                padding: "0 16px",
                background: inviteCode.trim() ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.07)",
                color: inviteCode.trim() ? "#000" : "rgba(255,255,255,0.3)",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: inviteCode.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
              data-testid="btn-join-by-code"
            >
              {isJoining ? "..." : "Войти"}
            </button>
            {joinError && <span className="text-sm" style={{ color: "#ef4444" }}>{joinError}</span>}
          </div>

          {/* Rooms section header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Комнаты
            </h2>
            <input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: 180 }}
              data-testid="input-search"
            />
          </div>

          {/* Room list */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl animate-pulse"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                />
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence>
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={{
                      ...room,
                      description: room.description ?? null,
                      memberCount: (room as { memberCount?: number }).memberCount ?? 0,
                    }}
                    onOpen={() => setLocation(`/room/${room.id}`)}
                    onDelete={() => handleDelete(room.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.25)" }}>
              <p className="mb-4 text-sm">Нет публичных комнат</p>
              <button
                onClick={() => setCreateOpen(true)}
                style={{
                  height: 36,
                  padding: "0 18px",
                  background: "#fff",
                  color: "#000",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Создать первую
              </button>
            </div>
          )}
        </main>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
