import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, SignInButton, SignUpButton } from "@clerk/react";
import { GridBackground } from "@/components/GridBackground";
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

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation("/dashboard");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (isLoaded && isSignedIn) return null;

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError("");
    try {
      const headers: Record<string, string> = {};
      const guestToken = localStorage.getItem("codesync_guest_token");
      if (guestToken) headers["x-guest-token"] = guestToken;
      const resp = await fetch(`${basePath}/api/rooms/join/${inviteCode.trim().toUpperCase()}`, { headers });
      if (!resp.ok) { setJoinError("Комната не найдена. Проверьте код приглашения."); return; }
      const room = await resp.json() as { id: string };
      setLocation(`/room/${room.id}`);
    } catch {
      setJoinError("Ошибка подключения");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "#030303", color: "#f0f0f0" }}>
      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSuccess={() => { setShowGuestModal(false); setLocation("/dashboard"); }}
      />

      <GridBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* NAV */}
        <nav
          className="flex items-center justify-between px-8 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div
              style={{
                width: 30, height: 30,
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.3) 100%)",
                borderRadius: 8,
                boxShadow: "0 0 20px rgba(255,255,255,0.15)",
              }}
            />
            <span style={{ fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              CodeSync
            </span>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <SignInButton mode="modal">
              <button
                className="text-sm px-4 py-1.5 rounded-lg transition-all hover:bg-white/5"
                style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none", cursor: "pointer" }}
                data-testid="btn-sign-in"
              >
                Войти
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                className="text-sm px-4 py-1.5 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{
                  background: "#fff",
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(255,255,255,0.15)",
                }}
                data-testid="btn-register"
              >
                Зарегистрироваться
              </button>
            </SignUpButton>
          </motion.div>
        </nav>

        {/* HERO */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl w-full"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(10px)",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.7)", display: "inline-block" }} />
              Совместная разработка в реальном времени
            </motion.div>

            {/* Heading */}
            <h1
              style={{
                fontSize: "clamp(52px, 9vw, 88px)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-3px",
                color: "#fff",
                marginBottom: 24,
                textShadow: "0 0 80px rgba(255,255,255,0.08)",
              }}
            >
              Code
              <span style={{ color: "rgba(255,255,255,0.35)" }}>Sync</span>
            </h1>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.45)",
                marginBottom: 48,
                maxWidth: 560,
                marginInline: "auto",
              }}
            >
              Онлайн IDE для совместной работы над кодом с AI-ассистентом, запуском программ и гостевым доступом.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center gap-3 mb-14">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowGuestModal(true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: "#fff",
                    color: "#000",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 30px rgba(255,255,255,0.12)",
                  }}
                  data-testid="btn-guest-mode"
                >
                  Гостевой режим
                </button>
                <button
                  onClick={() => setShowAuthHint(true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/8"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                  }}
                  data-testid="btn-dashboard"
                >
                  Открыть комнаты
                </button>
              </div>
              <AnimatePresence>
                {showAuthHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "rgba(255,255,255,0.45)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <span>Для управления комнатами нужно</span>
                    <SignInButton mode="modal">
                      <button
                        className="underline font-semibold"
                        style={{ color: "rgba(255,255,255,0.85)", background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => setShowAuthHint(false)}
                      >
                        войти в аккаунт
                      </button>
                    </SignInButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
              {[
                { title: "Yjs CRDT", desc: "Синхронизация кода между участниками в реальном времени" },
                { title: "Monaco Editor", desc: "Редактор с подсветкой синтаксиса и курсорами коллег" },
                { title: "AI + Терминал", desc: "Интерактивный запуск кода и AI-ассистент" },
              ].map(({ title, desc }) => (
                <div
                  key={title}
                  className="glass rounded-xl p-5 text-left"
                  style={{ backdropFilter: "blur(20px)" }}
                >
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{title}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.55 }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Join by invite */}
            <div
              className="max-w-xl mx-auto rounded-2xl p-4 glass"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Код приглашения"
                  style={{
                    flex: 1,
                    height: 44,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 14,
                    padding: "0 14px",
                    outline: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.08em",
                  }}
                />
                <button
                  onClick={handleJoin}
                  disabled={!inviteCode.trim() || isJoining}
                  style={{
                    height: 44,
                    padding: "0 22px",
                    background: inviteCode.trim() ? "#fff" : "rgba(255,255,255,0.08)",
                    color: inviteCode.trim() ? "#000" : "rgba(255,255,255,0.3)",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: inviteCode.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  data-testid="btn-join-room"
                >
                  {isJoining ? "Подключение..." : "Войти в комнату"}
                </button>
              </div>
              {joinError && <p className="text-sm mt-3" style={{ color: "#ef4444" }}>{joinError}</p>}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
