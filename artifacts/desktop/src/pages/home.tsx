import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, LogIn, Globe, Lock, Users, ArrowRight, Code2, Zap, GitBranch, Terminal, Settings, AlertCircle, X } from "lucide-react";
import { api, type Room, type User, setToken, setCurrentUser, getToken, getCurrentUser } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { NOTICE_KEYS, useNotice } from "@/lib/notices";

interface HomeProps {
  onOpenSettings?: () => void;
  hasApiKeys?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

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
    const prefetch = () => {
      import("@/pages/room").catch(() => {});
    };
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

  if (showAuth) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--background)" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <Code2 size={16} color="#fff" />
              </div>
              <span className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>CodeSync</span>
            </div>
            <p style={{ color: "var(--muted-foreground)" }} className="text-sm">Совместная IDE — Десктоп</p>
          </div>

          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--elevated)" }}>
              <button
                onClick={() => setAuthMode("guest")}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: authMode === "guest" ? "var(--primary)" : "transparent",
                  color: authMode === "guest" ? "#fff" : "var(--muted-foreground)",
                }}
              >
                Гостевой доступ
              </button>
              <button
                onClick={() => setAuthMode("join-code")}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: authMode === "join-code" ? "var(--primary)" : "transparent",
                  color: authMode === "join-code" ? "#fff" : "var(--muted-foreground)",
                }}
              >
                Войти по коду
              </button>
            </div>

            {authMode === "guest" ? (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuestLogin()}
                  placeholder="Выберите имя пользователя..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: "var(--elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <button
                  onClick={handleGuestLogin}
                  disabled={authLoading || !username.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  {authLoading ? "Подключение..." : "Войти как гость"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  autoFocus
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                  placeholder="Введите код приглашения..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={!inviteCode.trim()}
                  className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  Войти в комнату
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Zap, label: "Синхронизация" },
              { icon: GitBranch, label: "Мультифайл" },
              { icon: Terminal, label: "Терминал" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-center py-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Icon size={16} style={{ color: "var(--primary)" }} className="mx-auto mb-1" />
                <p style={{ color: "var(--muted-foreground)" }} className="text-xs">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--primary)" }}>
            <Code2 size={12} color="#fff" />
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>CodeSync Desktop</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "var(--elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            <LogIn size={12} />
            Войти в комнату
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Plus size={12} />
            Новая комната
          </button>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l" style={{ borderColor: "var(--border)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--primary)", color: "#fff" }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{user?.username}</span>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title={isMac ? "Настройки (⌘,)" : "Настройки (Ctrl+,)"}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80 relative"
              style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              <Settings size={13} />
              {!hasApiKeys && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* No API keys notice */}
      {!hasApiKeys && onOpenSettings && !bannerDismissed && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", borderBottom: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}
        >
          <AlertCircle size={12} style={{ color: "var(--primary)", flexShrink: 0 }} />
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
            className="flex items-center justify-center w-4 h-4 rounded transition-opacity hover:opacity-60 flex-shrink-0"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск комнат..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>

      {/* Rooms grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
            <Code2 size={32} style={{ color: "var(--muted-foreground)" }} />
            <p style={{ color: "var(--muted-foreground)" }} className="text-sm">
              {search ? "Нет комнат, соответствующих запросу" : "Нет комнат — создайте первую"}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Plus size={14} />
              Создать комнату
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {filtered.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="group p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {room.isPrivate ? (
                        <Lock size={12} style={{ color: "var(--muted-foreground)" }} />
                      ) : (
                        <Globe size={12} style={{ color: "var(--primary)" }} />
                      )}
                      <h3 className="font-medium text-sm truncate max-w-[160px]" style={{ color: "var(--foreground)" }}>
                        {room.title}
                      </h3>
                    </div>
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary)" }} />
                  </div>
                  {room.description && (
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                      {room.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Users size={11} />
                      <span className="text-xs">{room.memberCount}/{room.maxUsers}</span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {formatTime(room.updatedAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowCreate(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl p-5 space-y-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>Создать комнату</h2>
              <input
                autoFocus
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Название комнаты..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Описание (необязательно)..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--foreground)" }}
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
                <label className="flex items-center gap-2 text-sm ml-auto" style={{ color: "var(--muted-foreground)" }}>
                  Макс. участников:
                  <select
                    value={createForm.maxUsers}
                    onChange={(e) => setCreateForm({ ...createForm, maxUsers: Number(e.target.value) })}
                    className="rounded-md px-2 py-1 text-xs outline-none"
                    style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-sm"
                  style={{ background: "var(--elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                  Отмена
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creating || !createForm.title.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#fff" }}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowJoin(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl p-5 space-y-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>Войти в комнату</h2>
              <input
                autoFocus
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                placeholder="Код приглашения..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowJoin(false)} className="flex-1 py-2 rounded-lg text-sm"
                  style={{ background: "var(--elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                  Отмена
                </button>
                <button
                  onClick={handleJoinByCode}
                  disabled={!inviteCode.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#fff" }}
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
