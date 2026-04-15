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

const BRAND = {
  bg: "#080C14",
  surface: "#111826",
  border: "#1E2D42",
  muted: "#5A6880",
  text: "#E8EDF5",
  teal: "#00C2A8",
  blue: "#4D9EFF",
  green: "#3FB950",
  orange: "#FFA657",
  red: "#FF7B72",
};

// ─── Create Room Modal ────────────────────────────────────────────────────────

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate]     = useState(false);
  const [maxUsers, setMaxUsers]       = useState(5);
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

  const inputBase: React.CSSProperties = {
    width: "100%", height: 44,
    background: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 10, color: BRAND.text, fontSize: 14,
    padding: "0 14px", outline: "none",
    fontFamily: "'Manrope', sans-serif",
    transition: "border-color 0.2s",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{
        background: BRAND.surface,
        backdropFilter: "blur(32px)",
        border: `1px solid ${BRAND.border}`,
        color: BRAND.text,
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        fontFamily: "'Manrope', sans-serif",
      }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.text, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>
            Создать комнату
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
          <input
            placeholder="Название комнаты"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setCreateError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={inputBase}
            data-testid="input-room-title"
            autoFocus
            onFocus={e => (e.currentTarget.style.borderColor = BRAND.teal)}
            onBlur={e => (e.currentTarget.style.borderColor = BRAND.border)}
          />

          <input
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputBase}
            data-testid="input-room-description"
            onFocus={e => (e.currentTarget.style.borderColor = BRAND.teal)}
            onBlur={e => (e.currentTarget.style.borderColor = BRAND.border)}
          />

          {/* Private toggle */}
          <button
            type="button"
            onClick={() => setIsPrivate(p => !p)}
            data-testid="toggle-private"
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "12px 14px", borderRadius: 10, textAlign: "left",
              background: isPrivate ? "rgba(0,194,168,0.06)" : BRAND.bg,
              border: `1px solid ${isPrivate ? BRAND.teal + "50" : BRAND.border}`,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: isPrivate ? "rgba(0,194,168,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isPrivate ? BRAND.teal + "40" : BRAND.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              {isPrivate ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND.muted} strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: isPrivate ? BRAND.teal : BRAND.text, fontSize: 14, fontWeight: 600, transition: "color 0.2s" }}>
                {isPrivate ? "Приватная комната" : "Публичная комната"}
              </div>
              <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2 }}>
                {isPrivate ? "Доступна только по коду приглашения" : "Видна всем пользователям"}
              </div>
            </div>
            <div style={{
              width: 40, height: 22, borderRadius: 11, flexShrink: 0,
              background: isPrivate ? BRAND.teal : BRAND.border,
              padding: 3, display: "flex", alignItems: "center",
              transition: "all 0.25s",
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                background: isPrivate ? BRAND.bg : BRAND.muted,
                transform: isPrivate ? "translateX(18px)" : "translateX(0)",
                transition: "all 0.25s",
              }} />
            </div>
          </button>

          {/* Max users */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: BRAND.muted, fontSize: 13 }}>Максимум участников</span>
              <div style={{
                background: BRAND.bg, border: `1px solid ${BRAND.border}`,
                borderRadius: 6, padding: "2px 10px",
                color: BRAND.teal, fontSize: 14, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{maxUsers}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: BRAND.muted, fontSize: 11, width: 10, textAlign: "center" }}>1</span>
              <input
                type="range" min={1} max={5} step={1} value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                style={{ flex: 1, accentColor: BRAND.teal, cursor: "pointer", height: 4 }}
                data-testid="slider-max-users"
              />
              <span style={{ color: BRAND.muted, fontSize: 11, width: 10, textAlign: "center" }}>5</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 16px" }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 1, height: 4, background: n === maxUsers ? BRAND.teal : BRAND.border }} />
                  <span style={{ fontSize: 10, color: n === maxUsers ? BRAND.teal : BRAND.muted }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {createError && <p style={{ color: BRAND.red, fontSize: 13, margin: 0 }}>{createError}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || createRoom.isPending}
              style={{
                flex: 1, height: 44,
                background: title.trim() ? BRAND.teal : BRAND.border,
                color: title.trim() ? BRAND.bg : BRAND.muted,
                border: "none", borderRadius: 10,
                fontWeight: 700, fontSize: 14, cursor: title.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                boxShadow: title.trim() ? `0 0 20px rgba(0,194,168,0.25)` : "none",
              }}
              data-testid="btn-confirm-create"
            >
              {createRoom.isPending ? "Создание..." : "Создать комнату"}
            </button>
            <button
              onClick={onClose}
              style={{
                height: 44, padding: "0 18px",
                background: "transparent",
                color: BRAND.muted, border: `1px solid ${BRAND.border}`,
                borderRadius: 10, cursor: "pointer", fontSize: 14,
                transition: "all 0.15s",
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

const ACCENT_PALETTES = [
  { color: BRAND.teal,   rgb: "0,194,168" },
  { color: BRAND.blue,   rgb: "77,158,255" },
  { color: BRAND.green,  rgb: "63,185,80" },
  { color: BRAND.orange, rgb: "255,166,87" },
  { color: BRAND.red,    rgb: "255,123,114" },
];

function roomAccent(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ACCENT_PALETTES[Math.abs(hash) % ACCENT_PALETTES.length];
}

function MiniCodeLines({ seed }: { seed: string }) {
  const configs = [[70, 30, 0], [50, 0, 0], [60, 25, 18], [35, 0, 0]];
  let h = 0;
  for (const c of seed) h = (h * 17 + c.charCodeAt(0)) & 0xfff;
  const offset = h % configs.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {[0,1,2,3].map((i) => {
        const [a, b, c] = configs[(i + offset) % configs.length];
        return (
          <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: a, height: 3, borderRadius: 2, background: `rgba(${232},${237},${245},0.15)` }} />
            {b > 0 && <div style={{ width: b, height: 3, borderRadius: 2, background: `rgba(0,194,168,0.4)` }} />}
            {c > 0 && <div style={{ width: c, height: 3, borderRadius: 2, background: `rgba(77,158,255,0.4)` }} />}
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
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`card-room-${room.id}`}
      style={{
        position: "relative", borderRadius: 14,
        background: hovered ? BRAND.surface : BRAND.bg,
        border: `1px solid ${hovered ? accent.color + "40" : BRAND.border}`,
        overflow: "hidden", cursor: "default",
        display: "flex", flexDirection: "column",
        transition: "all 0.25s ease",
      }}
    >
      {/* Accent top line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${accent.color} 40%, ${accent.color} 60%, transparent 100%)`,
        opacity: hovered ? 1 : 0.5,
        transition: "opacity 0.25s",
      }} />

      {/* Glow */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(${accent.rgb},0.08) 0%, transparent 70%)`,
        }} />
      )}

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `rgba(${accent.rgb},0.1)`,
            border: `1px solid rgba(${accent.rgb},0.2)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: BRAND.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {room.title}
              </h3>
              {room.isPrivate && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                  background: `rgba(${accent.rgb},0.1)`,
                  border: `1px solid rgba(${accent.rgb},0.2)`,
                  color: accent.color,
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
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.green, boxShadow: `0 0 6px ${BRAND.green}`, display: "inline-block" }}
                />
              )}
            </div>
            {room.description && (
              <p style={{ fontSize: 11, color: BRAND.muted, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {room.description}
              </p>
            )}
          </div>

          {room.isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button style={{
                  color: BRAND.muted, background: "none", border: "none",
                  cursor: "pointer", padding: 4, borderRadius: 6, flexShrink: 0, lineHeight: 1,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BRAND.text; (e.currentTarget as HTMLElement).style.background = BRAND.surface; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BRAND.muted; (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent style={{
                background: BRAND.surface, backdropFilter: "blur(20px)",
                border: `1px solid ${BRAND.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.7)", zIndex: 9999,
              }}>
                <DropdownMenuItem style={{ color: BRAND.red }} onClick={onDelete}>Удалить</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mini code preview */}
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: BRAND.bg, border: `1px solid ${BRAND.border}`,
        }}>
          <MiniCodeLines seed={room.id} />
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Slot bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: room.maxUsers }).map((_, i) => (
                  <div key={i} style={{
                    width: 16, height: 3, borderRadius: 2,
                    background: i < room.memberCount ? accent.color : BRAND.border,
                    boxShadow: i < room.memberCount ? `0 0 4px rgba(${accent.rgb},0.5)` : "none",
                    transition: "background 0.3s",
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 9, color: BRAND.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                {room.memberCount}/{room.maxUsers}
              </span>
            </div>

            {/* Invite code */}
            <div style={{
              fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              padding: "2px 8px", borderRadius: 5,
              background: BRAND.bg, border: `1px solid ${BRAND.border}`,
              color: BRAND.muted, letterSpacing: "0.1em",
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
              padding: "6px 16px", borderRadius: 8,
              background: isLocked ? "transparent" : `rgba(${accent.rgb},0.1)`,
              border: isLocked ? `1px solid ${BRAND.border}` : `1px solid rgba(${accent.rgb},0.3)`,
              color: isLocked ? BRAND.muted : accent.color,
              fontSize: 12, fontWeight: 700,
              cursor: isLocked ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s",
              fontFamily: "'Manrope', sans-serif",
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
    <div style={{
      marginBottom: 24, borderRadius: 12, overflow: "hidden",
      background: BRAND.surface, border: `1px solid ${BRAND.border}`,
    }}>
      <div style={{
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${BRAND.border}`, background: "rgba(0,194,168,0.04)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span style={{ color: BRAND.teal, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Войти по коду приглашения
        </span>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 240 }}>
          <input
            placeholder="XXXXXXXX"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            style={{
              width: "100%", height: 40,
              background: BRAND.bg, border: `1px solid ${BRAND.border}`,
              borderRadius: 9, color: BRAND.text, fontSize: 14,
              padding: "0 14px", outline: "none",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.14em",
              textTransform: "uppercase", transition: "border-color 0.2s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = BRAND.teal)}
            onBlur={e => (e.currentTarget.style.borderColor = BRAND.border)}
            data-testid="input-join-code"
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={!code.trim() || isJoining}
          style={{
            height: 40, padding: "0 20px",
            background: code.trim() ? BRAND.teal : BRAND.border,
            color: code.trim() ? BRAND.bg : BRAND.muted,
            border: "none", borderRadius: 9,
            fontWeight: 700, fontSize: 13, cursor: code.trim() ? "pointer" : "not-allowed",
            transition: "all 0.15s", whiteSpace: "nowrap",
            fontFamily: "'Manrope', sans-serif",
            boxShadow: code.trim() ? `0 0 16px rgba(0,194,168,0.25)` : "none",
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
              style={{ color: BRAND.red, fontSize: 13 }}
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
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: BRAND.bg, color: BRAND.text, overflow: "auto",
      fontFamily: "'Manrope', 'Inter', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${BRAND.border}44 1px, transparent 1px), linear-gradient(90deg, ${BRAND.border}44 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }} />
      <div style={{
        position: "fixed", top: "-20vh", left: "50%", transform: "translateX(-50%)",
        width: "50vw", height: "50vw",
        background: `radial-gradient(circle, rgba(0,194,168,0.05) 0%, transparent 65%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* HEADER */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 32px", position: "sticky", top: 0, zIndex: 20,
          background: `${BRAND.bg}cc`,
          borderBottom: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={30} />
            <span style={{ fontSize: 18, fontWeight: 800, color: BRAND.text, letterSpacing: "-0.02em" }}>СИНХРОН</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isGuest ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 9,
                  background: `rgba(255,166,87,0.08)`, border: `1px solid rgba(255,166,87,0.2)`,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BRAND.orange} strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span style={{ color: BRAND.orange, fontSize: 12, fontWeight: 600 }}>Гость: {guestUsername}</span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("codesync_guest_token");
                    localStorage.removeItem("codesync_guest_user_id");
                    localStorage.removeItem("codesync_guest_username");
                    setLocation("/");
                  }}
                  style={{
                    height: 34, padding: "0 14px",
                    background: "transparent", color: BRAND.muted,
                    border: `1px solid ${BRAND.border}`, borderRadius: 8,
                    fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BRAND.text; (e.currentTarget as HTMLElement).style.borderColor = BRAND.muted; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BRAND.muted; (e.currentTarget as HTMLElement).style.borderColor = BRAND.border; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Выйти
                </button>
                <SignInButton mode="modal">
                  <button style={{
                    height: 34, padding: "0 18px",
                    background: BRAND.teal, color: BRAND.bg,
                    border: "none", borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    boxShadow: `0 0 16px rgba(0,194,168,0.25)`,
                  }}>
                    Войти в аккаунт
                  </button>
                </SignInButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    height: 34, padding: "0 18px",
                    background: BRAND.teal, color: BRAND.bg,
                    border: "none", borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: `0 0 16px rgba(0,194,168,0.25)`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; }}
                  data-testid="btn-create-room"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Создать комнату
                </button>
                <UserButton />
              </>
            )}
          </div>
        </header>

        <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "28px 32px" }}>
          {/* Guest banner */}
          <AnimatePresence>
            {isGuest && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  marginBottom: 20, padding: "14px 18px", borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 14,
                  background: `rgba(255,166,87,0.05)`,
                  border: `1px solid rgba(255,166,87,0.15)`,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND.orange} strokeWidth="1.8" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ color: BRAND.orange, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Гостевой режим</div>
                  <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5 }}>
                    Вы можете входить в комнаты по коду. Чтобы создавать комнаты и сохранять прогресс —{" "}
                    <SignInButton mode="modal">
                      <button style={{ color: BRAND.orange, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        войдите в аккаунт
                      </button>
                    </SignInButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <JoinBar isGuest={isGuest} guestToken={guestToken} />

          {/* Rooms header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: BRAND.muted }}>
                Комнаты
              </span>
              {rooms.length > 0 && (
                <span style={{
                  padding: "1px 8px", borderRadius: 6,
                  background: BRAND.surface, border: `1px solid ${BRAND.border}`,
                  color: BRAND.muted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>{rooms.length}</span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: 36, width: 200, padding: "0 14px 0 36px",
                  background: BRAND.surface, border: `1px solid ${BRAND.border}`,
                  borderRadius: 9, color: BRAND.text, fontSize: 13, outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = BRAND.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = BRAND.border)}
                data-testid="input-search"
              />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BRAND.muted} strokeWidth="2" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          {/* Room grid */}
          {isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 160, borderRadius: 14, background: BRAND.surface, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <motion.div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
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
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: "center", padding: "72px 0" }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: 16, margin: "0 auto 20px",
                background: BRAND.surface, border: `1px solid ${BRAND.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BRAND.muted} strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                </svg>
              </div>
              <p style={{ color: BRAND.muted, fontSize: 14, marginBottom: 20 }}>
                {isGuest ? "Нет публичных комнат. Войдите по коду приглашения." : "Нет публичных комнат"}
              </p>
              {!isGuest && (
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    padding: "10px 24px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                    color: BRAND.bg, background: BRAND.teal,
                    border: "none", cursor: "pointer",
                    boxShadow: `0 0 20px rgba(0,194,168,0.3)`,
                  }}
                >
                  Создать первую комнату
                </button>
              )}
            </motion.div>
          )}
        </main>

        <footer style={{
          borderTop: `1px solid ${BRAND.border}`, padding: "14px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={20} />
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.text }}>СИНХРОН</span>
          </div>
          <span style={{ fontSize: 11, color: BRAND.muted }}>Совместная онлайн-IDE</span>
        </footer>
      </div>
    </div>
  );
}
