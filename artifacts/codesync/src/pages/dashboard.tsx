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

// ─── Create Room Modal ────────────────────────────────────────────────────────

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate]   = useState(false);
  const [maxUsers, setMaxUsers]     = useState(5);
  const [createError, setCreateError] = useState("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const createRoom = useCreateRoom();

  function handleCreate() {
    if (!title.trim()) return;
    setCreateError("");
    createRoom.mutate(
      { data: { title: title.trim(), description: description.trim() || undefined, isPrivate, maxUsers } },
      {
        onSuccess: (room) => {
          qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          onClose();
          setTitle(""); setDescription(""); setIsPrivate(false); setMaxUsers(5);
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
    width: "100%", height: 42,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, color: "#fff", fontSize: 14,
    padding: "0 14px", outline: "none",
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        style={{
          background: "rgba(10,10,10,0.96)",
          backdropFilter: "blur(32px)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#fff", fontWeight: 700 }}>Создать комнату</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-1">
          {/* Title */}
          <input
            placeholder="Название комнаты"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setCreateError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={inputStyle}
            data-testid="input-room-title"
            autoFocus
          />

          {/* Description */}
          <input
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            data-testid="input-room-description"
          />

          {/* Private toggle */}
          <button
            type="button"
            onClick={() => setIsPrivate(p => !p)}
            data-testid="toggle-private"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-left"
            style={{
              background: isPrivate ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isPrivate ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer",
            }}
          >
            {/* Lock icon */}
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{
                width: 34, height: 34,
                background: isPrivate ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                transition: "all 0.2s",
              }}
            >
              {isPrivate ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div style={{ color: isPrivate ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600, transition: "color 0.2s" }}>
                {isPrivate ? "Приватная комната" : "Публичная комната"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 1 }}>
                {isPrivate ? "Доступна только по коду приглашения" : "Видна всем пользователям"}
              </div>
            </div>
            {/* Pill toggle indicator */}
            <div
              className="rounded-full transition-all shrink-0 flex items-center"
              style={{
                width: 38, height: 22,
                background: isPrivate ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
                padding: 3,
              }}
            >
              <div
                className="rounded-full transition-all"
                style={{
                  width: 16, height: 16,
                  background: isPrivate ? "#000" : "rgba(255,255,255,0.5)",
                  transform: isPrivate ? "translateX(16px)" : "translateX(0)",
                }}
              />
            </div>
          </button>

          {/* Max users slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Максимум участников</p>
              <div
                className="font-mono font-bold px-2.5 py-0.5 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: 14,
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {maxUsers}
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, width: 12, textAlign: "center" }}>1</span>
              <input
                type="range"
                min={1} max={5} step={1}
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                className="flex-1 slider-track"
                style={{ accentColor: "#fff", cursor: "pointer", height: 4 }}
                data-testid="slider-max-users"
              />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, width: 12, textAlign: "center" }}>5</span>
            </div>
            {/* Tick marks */}
            <div className="flex justify-between mt-1.5 px-4">
              {[1,2,3,4,5].map(n => (
                <div key={n} className="flex flex-col items-center gap-0.5">
                  <div style={{ width: 1, height: 4, background: n === maxUsers ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)" }} />
                  <span style={{ fontSize: 10, color: n === maxUsers ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {createError && <p className="text-sm" style={{ color: "#ef4444" }}>{createError}</p>}

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || createRoom.isPending}
              style={{
                flex: 1, height: 42,
                background: title.trim() ? "#fff" : "rgba(255,255,255,0.08)",
                color: title.trim() ? "#000" : "rgba(255,255,255,0.3)",
                border: "none", borderRadius: 10,
                fontWeight: 600, fontSize: 14,
                cursor: title.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
              data-testid="btn-confirm-create"
            >
              {createRoom.isPending ? "Создание..." : "Создать"}
            </button>
            <button
              onClick={onClose}
              style={{
                height: 42, padding: "0 16px",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, cursor: "pointer", fontSize: 14,
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

// ─── Room Card ────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  title: string;
  description?: string | null;
  isPrivate: boolean;
  inviteCode: string | null;
  memberCount: number;
  maxUsers: number;
  createdAt: string;
  isJoined?: boolean;
  isOwner?: boolean;
}

// Deterministic accent color from room id
function roomAccent(id: string): { color: string; glow: string; bg: string } {
  const palettes = [
    { color: "#58A6FF", glow: "rgba(88,166,255,0.18)", bg: "rgba(88,166,255,0.06)" },
    { color: "#56D364", glow: "rgba(86,211,100,0.18)", bg: "rgba(86,211,100,0.06)" },
    { color: "#D2A8FF", glow: "rgba(210,168,255,0.18)", bg: "rgba(210,168,255,0.06)" },
    { color: "#F0883E", glow: "rgba(240,136,62,0.18)", bg: "rgba(240,136,62,0.06)" },
    { color: "#FF7B72", glow: "rgba(255,123,114,0.18)", bg: "rgba(255,123,114,0.06)" },
    { color: "#79C0FF", glow: "rgba(121,192,255,0.18)", bg: "rgba(121,192,255,0.06)" },
    { color: "#3FC7C4", glow: "rgba(63,199,196,0.18)", bg: "rgba(63,199,196,0.06)" },
    { color: "#F4A261", glow: "rgba(244,162,97,0.18)", bg: "rgba(244,162,97,0.06)" },
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return palettes[Math.abs(hash) % palettes.length];
}

// Fake code line visual inside card
function MiniCodeLines({ seed }: { seed: string }) {
  const lines = [
    [65, 35, 0],
    [45, 0, 0],
    [55, 25, 15],
    [30, 0, 0],
  ];
  let h = 0;
  for (const c of seed) h = (h * 17 + c.charCodeAt(0)) & 0xfff;
  const offset = h % 4;
  const pick = (n: number) => lines[(n + offset) % lines.length];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: 0.35 }}>
      {[0, 1, 2, 3].map((i) => {
        const [a, b, c] = pick(i);
        return (
          <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: a, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.4)" }} />
            {b > 0 && <div style={{ width: b, height: 3, borderRadius: 2, background: "rgba(88,166,255,0.6)" }} />}
            {c > 0 && <div style={{ width: c, height: 3, borderRadius: 2, background: "rgba(86,211,100,0.6)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function RoomCard({ room, onOpen, onDelete }: { room: Room; onOpen: () => void; onDelete: () => void }) {
  const accent = roomAccent(room.id);
  const isActive = room.memberCount > 0;
  const isLocked = room.isPrivate && room.isJoined === false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover="hover"
      data-testid={`card-room-${room.id}`}
      style={{
        position: "relative",
        borderRadius: 16,
        background: "#0C0E14",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
        cursor: "default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Accent top strip */}
      <motion.div
        variants={{ hover: { opacity: 1 } }}
        initial={{ opacity: 0.4 }}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${accent.color} 40%, ${accent.color} 60%, transparent 100%)`,
        }}
      />

      {/* Glow on hover */}
      <motion.div
        variants={{ hover: { opacity: 1 } }}
        initial={{ opacity: 0 }}
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent.glow} 0%, transparent 70%)`,
        }}
      />

      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
        {/* Top row: icon + title + menu */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Accent icon box */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: accent.bg,
            border: `1px solid ${accent.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#E6EDF3", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {room.title}
              </h3>
              {room.isPrivate && (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Приват
                </span>
              )}
              {isActive && (
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "#3FB950",
                    boxShadow: "0 0 6px #3FB950",
                    display: "inline-block",
                    animation: "roomPulse 2s ease-in-out infinite",
                  }} />
                </span>
              )}
            </div>
            {room.description && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {room.description}
              </p>
            )}
          </div>

          {room.isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, flexShrink: 0, lineHeight: 1 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent style={{ background: "rgba(12,12,12,0.96)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)", zIndex: 9999 }}>
                <DropdownMenuItem style={{ color: "#ef4444" }} onClick={onDelete}>Удалить</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mini code preview */}
        <div style={{
          padding: "8px 10px", borderRadius: 8,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <MiniCodeLines seed={room.id} />
        </div>

        {/* Bottom: stats + open button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Member bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: room.maxUsers }).map((_, i) => (
                  <div key={i} style={{
                    width: 14, height: 3, borderRadius: 2,
                    background: i < room.memberCount ? accent.color : "rgba(255,255,255,0.08)",
                    transition: "background 0.3s",
                    boxShadow: i < room.memberCount ? `0 0 4px ${accent.color}60` : "none",
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace" }}>
                {room.memberCount}/{room.maxUsers}
              </span>
            </div>

            {/* Invite code — blurred for locked rooms */}
            <div style={{
              fontSize: 10, fontFamily: "JetBrains Mono, monospace",
              padding: "2px 7px", borderRadius: 5,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.1em",
              filter: isLocked ? "blur(4px)" : "none",
              userSelect: isLocked ? "none" : "auto",
              transition: "filter 0.2s",
            }}>
              {isLocked ? "XXXXXXXX" : (room.inviteCode ?? "—")}
            </div>
          </div>

          <motion.button
            onClick={isLocked ? undefined : onOpen}
            whileHover={isLocked ? {} : { scale: 1.04 }}
            whileTap={isLocked ? {} : { scale: 0.96 }}
            data-testid={`btn-open-room-${room.id}`}
            style={{
              padding: "5px 14px", borderRadius: 8,
              background: isLocked ? "rgba(255,255,255,0.04)" : accent.bg,
              border: isLocked ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${accent.color}40`,
              color: isLocked ? "rgba(255,255,255,0.3)" : accent.color,
              fontSize: 12, fontWeight: 600, cursor: isLocked ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s",
            }}
          >
            {isLocked ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Закрыто
              </>
            ) : "Открыть →"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Join by code bar ─────────────────────────────────────────────────────────

function JoinBar({ isGuest, guestToken }: { isGuest: boolean; guestToken: string | null }) {
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [isJoining, setJoining] = useState(false);
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleJoin() {
    if (!code.trim()) return;
    setJoining(true); setError("");
    try {
      const headers: Record<string, string> = {};
      if (guestToken) headers["x-guest-token"] = guestToken;
      const resp = await fetch(`${basePath}/api/rooms/join/${code.trim().toUpperCase()}`, { headers });
      if (!resp.ok) { setError("Комната не найдена или недоступна"); return; }
      const room = await resp.json() as { id: string };
      setLocation(`/room/${room.id}`);
    } catch {
      setError("Ошибка подключения");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Войти по коду приглашения
        </span>
      </div>
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 160, maxWidth: 240 }}>
          <input
            placeholder="XXXXXXXX"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            style={{
              width: "100%", height: 40,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14,
              padding: "0 14px",
              outline: "none",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
            data-testid="input-join-code"
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={!code.trim() || isJoining}
          style={{
            height: 40, padding: "0 20px",
            background: code.trim() ? "#fff" : "rgba(255,255,255,0.07)",
            color: code.trim() ? "#000" : "rgba(255,255,255,0.3)",
            border: "none", borderRadius: 10,
            fontWeight: 600, fontSize: 14,
            cursor: code.trim() ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
          data-testid="btn-join-by-code"
        >
          {isJoining ? "Подключение..." : "Войти в комнату"}
        </button>
        <AnimatePresence>
          {error && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{ color: "#ef4444", fontSize: 13 }}
            >
              {error}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Dashboard() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const guestToken    = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_token")    : null;
  const guestUsername = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_username") : null;
  const isGuest = isLoaded && !isSignedIn && !!guestToken;

  // Clear guest state when user signs in with Clerk
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      localStorage.removeItem("codesync_guest_token");
      localStorage.removeItem("codesync_guest_user_id");
      localStorage.removeItem("codesync_guest_username");
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (isLoaded && !isSignedIn && !guestToken) setLocation("/");
  }, [isLoaded, isSignedIn, guestToken, setLocation]);

  const qc = useQueryClient();
  const searchParams = search ? { search } : undefined;
  const { data: rooms = [], isLoading } = useListRooms(searchParams, {
    query: { queryKey: getListRoomsQueryKey(searchParams), refetchInterval: 10_000 },
  });
  const deleteRoom = useDeleteRoom();

  if (isLoaded && !isSignedIn && !guestToken) return null;

  function handleDelete(roomId: string) {
    deleteRoom.mutate({ roomId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListRoomsQueryKey() }); },
    });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000", color: "#f0f0f0", overflow: "auto" }}>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* HEADER */}
        <header
          className="flex items-center justify-between px-6 py-3 sticky top-0 z-20"
          style={{
            background: "rgba(0,0,0,0.92)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3">
            <Logo size={39} />
            <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>CodeSync</span>
          </div>

          <div className="flex items-center gap-3">
            {isGuest ? (
              <>
                {/* Exit guest mode */}
                <button
                  onClick={() => {
                    localStorage.removeItem("codesync_guest_token");
                    localStorage.removeItem("codesync_guest_user_id");
                    localStorage.removeItem("codesync_guest_username");
                    setLocation("/");
                  }}
                  title="Выйти из гостевого режима"
                  style={{
                    height: 32, padding: "0 12px",
                    background: "transparent", color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Выйти
                </button>
                {/* Guest badge */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(255,165,0,0.08)",
                    border: "1px solid rgba(255,165,0,0.2)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,165,0,0.8)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span style={{ color: "rgba(255,165,0,0.9)", fontSize: 12, fontWeight: 500 }}>
                    Гость: {guestUsername}
                  </span>
                </div>
                <SignInButton mode="redirect" fallbackRedirectUrl="/dashboard">
                  <button
                    style={{
                      height: 32, padding: "0 16px",
                      background: "#fff", color: "#000",
                      border: "none", borderRadius: 8,
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    Войти в аккаунт
                  </button>
                </SignInButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    height: 32, padding: "0 14px",
                    background: "#fff", color: "#000",
                    border: "none", borderRadius: 8,
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
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
          {/* Guest mode banner */}
          <AnimatePresence>
            {isGuest && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 p-4 rounded-xl flex items-center gap-4"
                style={{
                  background: "rgba(255,165,0,0.05)",
                  border: "1px solid rgba(255,165,0,0.15)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,165,0,0.7)" strokeWidth="1.8" className="shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div className="flex-1">
                  <div style={{ color: "rgba(255,165,0,0.9)", fontSize: 13, fontWeight: 600 }}>Гостевой режим</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                    Вы можете входить в комнаты по коду. Чтобы создавать комнаты и сохранять прогресс —
                    <SignInButton mode="redirect" fallbackRedirectUrl="/dashboard">
                      <button style={{ color: "rgba(255,165,0,0.85)", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                        войдите в аккаунт
                      </button>
                    </SignInButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Join by code */}
          <JoinBar isGuest={isGuest} guestToken={guestToken} />

          {/* Rooms header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Комнаты
              </h2>
              {rooms.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-xs font-mono"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
                >
                  {rooms.length}
                </span>
              )}
            </div>
            <input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                height: 34, width: 180, padding: "0 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, color: "#fff", fontSize: 13, outline: "none",
              }}
              data-testid="input-search"
            />
          </div>

          {/* Room grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
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
                      maxUsers: (room as { maxUsers?: number }).maxUsers ?? 5,
                    }}
                    onOpen={() => setLocation(`/room/${room.id}`)}
                    onDelete={() => handleDelete(room.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.2)" }}>
              <div className="mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto", opacity: 0.4 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                </svg>
              </div>
              <p className="mb-4 text-sm">
                {isGuest ? "Нет публичных комнат. Войдите по коду приглашения." : "Нет публичных комнат"}
              </p>
              {!isGuest && (
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    height: 36, padding: "0 18px",
                    background: "#fff", color: "#000",
                    border: "none", borderRadius: 8,
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Создать первую
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
