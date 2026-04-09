import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, SignInButton, SignUpButton } from "@clerk/react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { GuestModal } from "@/components/GuestModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showAuthHint, setShowAuthHint] = useState(false);

  if (isLoaded && isSignedIn) {
    setLocation("/dashboard");
    return null;
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError("");
    try {
      const headers: Record<string, string> = {};
      const guestToken = localStorage.getItem("codesync_guest_token");
      if (guestToken) headers["x-guest-token"] = guestToken;

      const resp = await fetch(`${basePath}/api/rooms/join/${inviteCode.trim().toUpperCase()}`, { headers });
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
          setShowGuestModal(false);
        }}
      />
      <ParticleBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <nav className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid #30363D" }}>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #58A6FF, #3FB950)", borderRadius: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "#E6EDF3", letterSpacing: "-0.5px" }}>CodeSync</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" style={{ color: "#8B949E" }} data-testid="btn-sign-in">
                Войти
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                size="sm"
                style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600 }}
                data-testid="btn-register"
              >
                Зарегистрироваться
              </Button>
            </SignUpButton>
          </motion.div>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-3xl">
            <div
              className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "#58A6FF" }}
            >
              Совместная разработка в реальном времени
            </div>
            <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: "-2px", color: "#E6EDF3", marginBottom: 20 }}>
              CodeSync
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: "#8B949E", marginBottom: 40, maxWidth: 640, marginInline: "auto" }}>
              Онлайн IDE для совместной работы над кодом с AI-ассистентом, запуском программ и гостевым доступом.
            </p>

            <div className="flex flex-col items-center gap-3 mb-12">
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setShowGuestModal(true)}
                  style={{ background: "#3FB950", color: "#0D1117", fontWeight: 700, boxShadow: "0 8px 24px rgba(63, 185, 80, 0.18)" }}
                  data-testid="btn-guest-mode"
                >
                  Гостевой режим
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowAuthHint(true)}
                  style={{ background: "transparent", borderColor: "#30363D", color: "#E6EDF3" }}
                  data-testid="btn-dashboard"
                >
                  Открыть комнаты
                </Button>
              </div>
              <AnimatePresence>
                {showAuthHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                    style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "#8B949E" }}
                  >
                    <span>Чтобы управлять комнатами, нужно</span>
                    <SignInButton mode="modal">
                      <button
                        className="underline font-semibold"
                        style={{ color: "#58A6FF", background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => setShowAuthHint(false)}
                      >
                        войти в аккаунт
                      </button>
                    </SignInButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {[
                ["Yjs CRDT", "Синхронизация кода между участниками"],
                ["Monaco Editor", "Редактор с подсветкой и курсорами"],
                ["Piston + AI", "Запуск кода и code review"],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-4 text-left" style={{ background: "rgba(28, 33, 40, 0.9)", border: "1px solid #30363D" }}>
                  <div style={{ color: "#E6EDF3", fontWeight: 700, marginBottom: 8 }}>{title}</div>
                  <div style={{ color: "#8B949E", fontSize: 14, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>

            <div className="max-w-xl mx-auto rounded-2xl p-4" style={{ background: "rgba(28, 33, 40, 0.9)", border: "1px solid #30363D" }}>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Код приглашения"
                  className="h-11"
                  style={{ background: "#0D1117", borderColor: "#30363D", color: "#E6EDF3" }}
                />
                <Button
                  onClick={handleJoin}
                  disabled={!inviteCode.trim() || isJoining}
                  className="h-11 px-6"
                  style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 700 }}
                  data-testid="btn-join-room"
                >
                  {isJoining ? "Подключение..." : "Войти в комнату"}
                </Button>
              </div>
              {joinError && <p className="text-sm mt-3" style={{ color: "#FF7B72" }}>{joinError}</p>}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
