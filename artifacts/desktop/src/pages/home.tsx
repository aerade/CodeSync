import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, LogIn, Globe, Lock, Users, ArrowRight,
  Code2, Zap, GitBranch, Terminal, Settings, AlertCircle, X, Clock
} from "lucide-react";
import { api, type Room, type User, setToken, setCurrentUser, getToken, getCurrentUser } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { NOTICE_KEYS, useNotice } from "@/lib/notices";

interface HomeProps {
  onOpenSettings?: () => void;
  hasApiKeys?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function RoomCard({ room, onClick, index }: { room: Room; onClick: () => void; index: number }) {
  const isRecent = Date.now() - new Date(room.updatedAt).getTime() < 5 * 60 * 1000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.045, duration: 0.22, ease: "easeOut" }}
      onClick={onClick}
      className="glow-card group p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: room.isPrivate ? "rgba(245,158,11,0.12)" : "var(--primary-muted)" }}
          >
            {room.isPrivate
              ? <Lock size={12} style={{ color: "#F59E0B" }} />
              : <Globe size={12} style={{ color: "var(--primary)" }} />
            }
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
              {room.title}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isRecent && (
            <>
              <span className="status-dot-online" />
              <span className="text-xs" style={{ color: "#4ade80", opacity: 0.75 }}>
                Активно
              </span>
            </>
          )}
          <ArrowRight
            size={13}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--primary)" }}
          />
        </div>
      </div>
      {room.description && (
        <p className="text-xs mb-3 line-clamp-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {room.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
          <Users size={10} />
          <span className="text-xs">{room.memberCount}/{room.maxUsers}</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
          <Clock size={9} />
          <span className="text-xs">{formatTime(room.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home({ onOpenSettings, hasApiKeys = true }: HomeProps) {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [authMode, setAuthMode] = useState<"guest" | "join-code">("guest");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", isPrivate: false, maxUsers: 5 });
  const [creating, setCreating] = useState(false);
  const [bannerDismissed, dismissBanner] = useNotice(NOTICE_KEYS.noApiKeysBanner);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.getMe().then((u) => {
        setCurrentUser(u);
        setUser(u);
      }).catch(() => {
        setShowAuth(true);
      });
    } else {
      setShowAuth(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRooms();
  }, [user, search]);

  useEffect(() => {
    const prefetch = () => { import("@/pages/room").catch(() => {}); };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetch, 1000);
      return () => clearTimeout(id);
    }
  }, []);

  async function loadRooms() {
    try {
      setLoading(true);
      const data = await api.listRooms(search || undefined);
      setRooms(data);
    } catch {
      toast.error("Не удалось загрузить комнаты");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    if (!username.trim()) return;
    setAuthLoading(true);
    try {
      const { token, user: u } = await api.createGuestSession(username.trim());
      setToken(token);
      setCurrentUser(u);
      setUser(u);
      setShowAuth(false);
    } catch {
      toast.error("Не удалось создать сессию");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleJoinByCode() {
    if (!inviteCode.trim()) return;
    if (!user) { setShowAuth(true); return; }
    try {
      const room = await api.getRoomByInviteCode(inviteCode.trim());
      navigate(`/room/${room.id}`);
    } catch {
      toast.error("Неверный код приглашения");
    }
  }

  async function handleCreateRoom() {
    if (!createForm.title.trim() || !user) return;
    setCreating(true);
    try {
      const room = await api.createRoom(createForm);
      navigate(`/room/${room.id}`);
    } catch {
      toast.error("Не удалось создать комнату");
      setCreating(false);
    }
  }

  const filtered = rooms.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Auth Screen ─────────────────────────── */
  if (showAuth) {
    return (
      <div
        className="h-full flex items-center justify-center dot-grid-bg"
        style={{ background: "var(--background)" }}
      >
        {/* Radial glow behind the card */}
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,111,247,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="w-full max-w-[340px] relative"
        >
          {/* Logo */}
          <div className="text-center mb-7">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.06, duration: 0.24 }}
              className="inline-flex items-center justify-center mb-4"
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #7C6FF7 0%, #9B8FFB 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 28px rgba(124,111,247,0.3), 0 4px 16px rgba(0,0,0,0.3)",
                }}
              >
                <Code2 size={22} color="#fff" />
              </div>
            </motion.div>
            <h1
              className="text-xl font-semibold tracking-tight mb-1"
              style={{ color: "var(--foreground)" }}
            >
              CodeSync
            </h1>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Совместная IDE — Десктоп
            </p>
          </div>

          {/* Auth card */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Mode switcher */}
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "var(--elevated)" }}
            >
              {(["guest", "join-code"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAuthMode(m)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: authMode === m ? "var(--primary)" : "transparent",
                    color: authMode === m ? "#fff" : "var(--muted-foreground)",
                    boxShadow: authMode === m ? "0 2px 8px rgba(124,111,247,0.3)" : "none",
                  }}
                >
                  {m === "guest" ? "Гостевой доступ" : "Войти по коду"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {authMode === "guest" ? (
                <motion.div
                  key="guest"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="space-y-3"
                >
                  <input
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGuestLogin()}
                    placeholder="Выберите имя пользователя..."
                    className="cs-input w-full px-3 py-2.5 text-sm"
                  />
                  <button
                    onClick={handleGuestLogin}
                    disabled={authLoading || !username.trim()}
                    className="primary-btn w-full py-2.5 text-sm disabled:opacity-50"
                  >
                    {authLoading ? "Подключение..." : "Войти как гость"}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="space-y-3"
                >
                  <input
                    autoFocus
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                    placeholder="Введите код приглашения..."
                    className="cs-input w-full px-3 py-2.5 text-sm"
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={!inviteCode.trim()}
                    className="primary-btn w-full py-2.5 text-sm disabled:opacity-50"
                  >
                    Войти в комнату
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Feature pills */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {[
              { icon: Zap, label: "Синхронизация" },
              { icon: GitBranch, label: "Мультифайл" },
              { icon: Terminal, label: "Терминал" },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.06 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Icon size={11} style={{ color: "var(--primary)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Main Screen ─────────────────────────── */
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7C6FF7, #9B8FFB)" }}
          >
            <Code2 size={12} color="#fff" />
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
            CodeSync Desktop
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="surface-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <LogIn size={12} />
            Войти в комнату
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="primary-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <Plus size={12} />
            Новая комната
          </button>

          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l" style={{ borderColor: "var(--border)" }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{user?.username}</span>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title={isMac ? "Настройки (⌘,)" : "Настройки (Ctrl+,)"}
              className="surface-btn relative flex items-center justify-center w-7 h-7"
            >
              <Settings size={13} style={{ color: "var(--muted-foreground)" }} />
              {!hasApiKeys && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ background: "var(--primary)", boxShadow: "0 0 4px var(--primary-glow)" }}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* No API keys notice */}
      {!hasApiKeys && onOpenSettings && !bannerDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 text-xs shrink-0"
          style={{
            background: "rgba(124,111,247,0.07)",
            borderBottom: "1px solid rgba(124,111,247,0.15)",
          }}
        >
          <AlertCircle size={11} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <span
            className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: "var(--foreground)" }}
            onClick={onOpenSettings}
          >
            API-ключи ИИ не настроены — проверка кода и чат недоступны.{" "}
            <span style={{ color: "var(--primary)", fontWeight: 500 }}>Добавить в настройках.</span>
          </span>
          <button
            onClick={dismissBanner}
            title="Скрыть"
            className="flex items-center justify-center w-4 h-4 rounded hover:opacity-60 flex-shrink-0 transition-opacity"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={11} />
          </button>
        </motion.div>
      )}

      {/* Search bar */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск комнат..."
            className="cs-input w-full pl-9 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      {/* Rooms */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-28 rounded-xl"
                style={{ animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 py-20"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Code2 size={24} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                {search ? "Нет совпадений" : "Нет комнат"}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {search ? "Попробуйте изменить запрос" : "Создайте первую комнату для совместной работы"}
              </p>
            </div>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="primary-btn flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
              >
                <Plus size={14} />
                Создать комнату
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                index={i}
                onClick={() => navigate(`/room/${room.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <h2 className="font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
                Создать комнату
              </h2>
              <input
                autoFocus
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Название комнаты..."
                className="cs-input w-full px-3 py-2.5 text-sm"
              />
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Описание (необязательно)..."
                className="cs-input w-full px-3 py-2.5 text-sm"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--foreground)" }}>
                  <input
                    type="checkbox"
                    checked={createForm.isPrivate}
                    onChange={(e) => setCreateForm({ ...createForm, isPrivate: e.target.checked })}
                    className="rounded"
                  />
                  Приватная
                </label>
                <label className="flex items-center gap-2 text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
                  Макс. участников:
                  <select
                    value={createForm.maxUsers}
                    onChange={(e) => setCreateForm({ ...createForm, maxUsers: Number(e.target.value) })}
                    className="cs-input rounded-md px-2 py-1 text-xs"
                  >
                    {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="surface-btn flex-1 py-2.5 text-sm font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creating || !createForm.title.trim()}
                  className="primary-btn flex-1 py-2.5 text-sm disabled:opacity-50"
                >
                  {creating ? "Создание..." : "Создать"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join by code Modal */}
      <AnimatePresence>
        {showJoin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowJoin(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <h2 className="font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
                Войти в комнату
              </h2>
              <input
                autoFocus
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                placeholder="Код приглашения..."
                className="cs-input w-full px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowJoin(false)} className="surface-btn flex-1 py-2.5 text-sm font-medium">
                  Отмена
                </button>
                <button
                  onClick={handleJoinByCode}
                  disabled={!inviteCode.trim()}
                  className="primary-btn flex-1 py-2.5 text-sm disabled:opacity-50"
                >
                  Войти
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
