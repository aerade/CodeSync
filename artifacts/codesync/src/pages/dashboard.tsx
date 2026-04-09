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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
          if (msg.includes("409") || msg.toLowerCase().includes("уже существует") || msg.toLowerCase().includes("conflict")) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: "#1C2128", border: "1px solid #30363D", color: "#E6EDF3" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#E6EDF3" }}>Создать комнату</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Название комнаты"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setCreateError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{ background: "#0D1117", border: "1px solid #30363D", color: "#E6EDF3" }}
            data-testid="input-room-title"
          />
          <Input
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ background: "#0D1117", border: "1px solid #30363D", color: "#E6EDF3" }}
            data-testid="input-room-description"
          />
          <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-private">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "#58A6FF" }}
            />
            <span className="text-sm" style={{ color: "#8B949E" }}>Приватная комната</span>
          </label>
          {createError && (
            <p className="text-sm" style={{ color: "#FF7B72" }}>{createError}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || createRoom.isPending}
              style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600, flex: 1 }}
              data-testid="btn-confirm-create"
            >
              {createRoom.isPending ? "Создание..." : "Создать"}
            </Button>
            <Button variant="ghost" onClick={onClose} style={{ color: "#8B949E" }}>
              Отмена
            </Button>
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
      className="room-card p-4 rounded-lg"
      style={{ background: "#1C2128", border: "1px solid #30363D" }}
      data-testid={`card-room-${room.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold truncate" style={{ color: "#E6EDF3" }}>
              {room.title}
            </h3>
            {room.isPrivate && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(242, 204, 96, 0.1)", color: "#F2CC60", border: "1px solid rgba(242, 204, 96, 0.3)", fontSize: 10 }}>
                Приватная
              </span>
            )}
          </div>
          {room.description && (
            <p className="text-xs line-clamp-1" style={{ color: "#8B949E" }}>{room.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: "#8B949E" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#1C2128", border: "1px solid #30363D" }}>
            <DropdownMenuItem style={{ color: "#FF7B72" }} onClick={onDelete}>
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs" style={{ color: "#8B949E" }}>
            <span className="online-dot" style={{ width: 5, height: 5 }} />
            {room.memberCount}
          </span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#0D1117", color: "#8B949E", border: "1px solid #30363D" }}>
            {room.inviteCode}
          </span>
        </div>
        <Button
          size="sm"
          onClick={onOpen}
          style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600, fontSize: 12, padding: "2px 10px" }}
          data-testid={`btn-open-room-${room.id}`}
        >
          Открыть
        </Button>
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
  const isGuest = !isSignedIn && !!guestToken;

  // Redirect unauthenticated non-guest users to home (must be in useEffect, not during render)
  useEffect(() => {
    if (isLoaded && !isSignedIn && !guestToken) {
      setLocation("/");
    }
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
      if (!resp.ok) {
        setJoinError("Комната не найдена");
        return;
      }
      const room = await resp.json() as { id: string };
      setLocation(`/room/${room.id}`);
    } catch {
      setJoinError("Ошибка подключения");
    } finally {
      setIsJoining(false);
    }
  }

  function handleDelete(roomId: string) {
    deleteRoom.mutate(
      { roomId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#161B22", overflow: "auto" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 sticky top-0 z-10"
        style={{ background: "#161B22", borderBottom: "1px solid #30363D" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #58A6FF, #3FB950)", borderRadius: 7 }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "#E6EDF3" }}>CodeSync</span>
        </div>
        <div className="flex items-center gap-3">
          {isGuest ? (
            <>
              <span className="text-sm px-3 py-1 rounded-full" style={{ background: "rgba(63, 185, 80, 0.12)", border: "1px solid rgba(63, 185, 80, 0.3)", color: "#3FB950" }}>
                Гость: {guestUsername}
              </span>
              <SignInButton mode="modal">
                <Button size="sm" style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600 }}>
                  Войти
                </Button>
              </SignInButton>
            </>
          ) : (
            <>
              <Button
                onClick={() => setCreateOpen(true)}
                style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600 }}
                data-testid="btn-create-room"
              >
                + Создать комнату
              </Button>
              <UserButton />
            </>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {/* Join by code */}
        <div className="mb-6 p-4 rounded-lg flex items-center gap-3"
          style={{ background: "#1C2128", border: "1px solid #30363D" }}>
          <span className="text-sm font-medium shrink-0" style={{ color: "#8B949E" }}>Войти в комнату:</span>
          <Input
            placeholder="Введите код приглашения"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
            style={{ background: "#0D1117", border: "1px solid #30363D", color: "#E6EDF3", flex: 1, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", maxWidth: 200 }}
            data-testid="input-join-code"
          />
          <Button
            onClick={handleJoinByCode}
            disabled={!inviteCode.trim() || isJoining}
            variant="outline"
            style={{ border: "1px solid #30363D", color: "#E6EDF3" }}
            data-testid="btn-join-by-code"
          >
            {isJoining ? "..." : "Войти"}
          </Button>
          {joinError && <span className="text-sm" style={{ color: "#FF7B72" }}>{joinError}</span>}
        </div>

        {/* Rooms section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "#E6EDF3" }}>Комнаты</h2>
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: "#0D1117", border: "1px solid #30363D", color: "#E6EDF3", width: 200 }}
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg animate-pulse" style={{ background: "#1C2128" }} />
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
          <div className="text-center py-16" style={{ color: "#8B949E" }}>
            <p className="mb-2">Нет публичных комнат</p>
            <Button
              onClick={() => setCreateOpen(true)}
              style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600 }}
            >
              Создать первую
            </Button>
          </div>
        )}
      </main>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
