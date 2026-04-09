import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, SignInButton } from "@clerk/react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { GuestModal } from "@/components/GuestModal";
import { useListRooms } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const LANG_COLORS: Record<string, string> = {
  javascript: "#F2CC60",
  typescript: "#58A6FF",
  python: "#3FB950",
  go: "#79C0FF",
  rust: "#FFA657",
  java: "#FF7B72",
  cpp: "#D2A8FF",
  default: "#8B949E",
};

function getLangColor(lang: string) {
  return LANG_COLORS[lang.toLowerCase()] ?? LANG_COLORS.default;
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const { data: rooms, isLoading: roomsLoading } = useListRooms();

  if (isLoaded && isSignedIn) {
    setLocation("/dashboard");
    return null;
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError("");
    try {
      const resp = await fetch(`/api/rooms/join/${inviteCode.trim().toUpperCase()}`);
      if (!resp.ok) {
        setJoinError("Комната не найдена. Проверьте код приглашения.");
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

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "#161B22" }}>
      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSuccess={(_userId, _username, _guestToken) => {
          // Guest users stay on home to join rooms with an invite code
          setShowGuestModal(false);
        }}
      />
      <ParticleBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid #30363D" }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #58A6FF, #3FB950)", borderRadius: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "#E6EDF3", letterSpacing: "-0.5px" }}>CodeSync</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" style={{ color: "#8B949E" }} data-testid="btn-sign-in">
                Войти
              </Button>
            </SignInButton>
            <Button
              size="sm"
              style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600 }}
              onClick={() => setLocation(`${basePath}/sign-up`)}
              data-testid="btn-register"
            >
              Зарегистрироваться
            </Button>
          </motion.div>
        </nav>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl"
          >
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "#58A6FF" }}>
              <span className="online-dot" style={{ width: 6, height: 6 }} />
              Совместное программирование в реальном времени
            </div>

            <h1 className="text-5xl font-bold mb-4" style={{ color: "#E6EDF3", letterSpacing: "-1px", lineHeight: 1.15 }}>
              Пишите код вместе,{" "}
              <span style={{ color: "#58A6FF" }}>синхронно</span>
            </h1>
            <p className="text-lg mb-8" style={{ color: "#8B949E", maxWidth: 520, margin: "0 auto 32px" }}>
              Полноценный IDE в браузере с многопользовательским редактированием, AI-ревью, запуском кода и мгновенной синхронизацией.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12">
              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Код приглашения"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  style={{
                    background: "#0D1117",
                    border: "1px solid #30363D",
                    color: "#E6EDF3",
                    width: 200,
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                  data-testid="input-invite-code"
                />
                <Button
                  onClick={handleJoin}
                  disabled={!inviteCode.trim() || isJoining}
                  style={{ background: "#30363D", color: "#E6EDF3" }}
                  data-testid="btn-join-room"
                >
                  {isJoining ? "..." : "Войти"}
                </Button>
              </div>
              <SignInButton mode="modal">
                <Button
                  size="lg"
                  style={{ background: "linear-gradient(135deg, #58A6FF, #3FB950)", color: "#0D1117", fontWeight: 700 }}
                  data-testid="btn-create-room"
                >
                  Создать комнату
                </Button>
              </SignInButton>
              <Button
                variant="ghost"
                onClick={() => setShowGuestModal(true)}
                style={{ color: "#8B949E", borderColor: "#30363D" }}
                data-testid="btn-guest-mode"
              >
                Гостевой режим
              </Button>
            </div>

            {joinError && (
              <p className="text-sm mb-4" style={{ color: "#FF7B72" }}>{joinError}</p>
            )}
          </motion.div>

          {/* Public rooms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-4xl"
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: "#8B949E" }}>
              Публичные комнаты
            </h2>
            {roomsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: "#1C2128" }} />
                ))}
              </div>
            ) : rooms && rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {rooms.map((room, i) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="room-card p-4 rounded-lg cursor-pointer"
                      style={{ background: "#1C2128", border: "1px solid #30363D" }}
                      onClick={() => setLocation(`/room/${room.id}`)}
                      data-testid={`card-room-${room.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold truncate" style={{ color: "#E6EDF3", maxWidth: "70%" }}>
                          {room.title}
                        </h3>
                        <span className="text-xs flex items-center gap-1" style={{ color: "#8B949E" }}>
                          <span className="online-dot" style={{ width: 5, height: 5 }} />
                          {room.memberCount}
                        </span>
                      </div>
                      {room.description && (
                        <p className="text-xs mb-2 line-clamp-1" style={{ color: "#8B949E" }}>
                          {room.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-auto">
                        <span className="text-xs px-2 py-0.5 rounded" style={{
                          background: "rgba(48, 54, 61, 0.8)",
                          color: "#8B949E",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 10,
                        }}>
                          JS
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: "#8B949E" }}>
                <p>Пока нет публичных комнат</p>
                <p className="text-sm mt-1">Войдите, чтобы создать первую</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
