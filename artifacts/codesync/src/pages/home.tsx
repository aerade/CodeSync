import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, SignInButton, SignUpButton } from "@clerk/react";
import { ParticleBackground } from "@/components/ParticleBackground";
import { GuestModal } from "@/components/GuestModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
      </svg>
    ),
    label: "Yjs CRDT",
    desc: "Синхронизация кода в реальном времени",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 2.5A1.5 1.5 0 012.5 1h11A1.5 1.5 0 0115 2.5v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-11zm1.5 0a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11zM5.5 4.5a.5.5 0 01.5.5v1.5h1.5a.5.5 0 010 1H6V9a.5.5 0 01-1 0V7.5H3.5a.5.5 0 010-1H5V5a.5.5 0 01.5-.5zM9 8a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3A.5.5 0 019 8zm0 2.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z"/>
      </svg>
    ),
    label: "Monaco Editor",
    desc: "Редактор с подсветкой и мульти-курсорами",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zM5.5 7.5a.5.5 0 010-1h3.29L7.15 4.85a.5.5 0 01.7-.7l2.5 2.5a.5.5 0 010 .7l-2.5 2.5a.5.5 0 01-.7-.7L8.79 7.5H5.5z"/>
      </svg>
    ),
    label: "Piston + AI",
    desc: "Запуск кода и code review",
  },
];

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
    <div
      className="relative min-h-screen flex flex-col"
      style={{ background: "#0D1117", overflow: "hidden" }}
    >
      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSuccess={() => setShowGuestModal(false)}
      />
      <ParticleBackground />

      {/* Radial glow backdrop — mimics Clerk's ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(88,166,255,0.08) 0%, transparent 70%), " +
            "radial-gradient(ellipse 50% 40% at 50% 100%, rgba(63,185,80,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <nav
          className="flex items-center justify-between px-8 py-4"
          style={{ borderBottom: "1px solid rgba(48,54,61,0.6)" }}
        >
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2.5"
          >
            <div
              style={{
                width: 30,
                height: 30,
                background: "linear-gradient(135deg, #58A6FF 0%, #3FB950 100%)",
                borderRadius: 8,
                boxShadow: "0 0 12px rgba(88,166,255,0.35)",
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#E6EDF3", letterSpacing: "-0.4px" }}>
              CodeSync
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <SignInButton mode="modal">
              <button
                style={{
                  background: "transparent",
                  border: "1px solid #30363D",
                  color: "#8B949E",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#58A6FF";
                  (e.currentTarget as HTMLButtonElement).style.color = "#E6EDF3";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363D";
                  (e.currentTarget as HTMLButtonElement).style.color = "#8B949E";
                }}
                data-testid="btn-sign-in"
              >
                Войти
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                style={{
                  background: "linear-gradient(135deg, #58A6FF 0%, #388bfd 100%)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 0 12px rgba(88,166,255,0.25)",
                  transition: "box-shadow 0.15s, opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(88,166,255,0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(88,166,255,0.25)"; }}
                data-testid="btn-register"
              >
                Зарегистрироваться
              </button>
            </SignUpButton>
          </motion.div>
        </nav>

        {/* Center content */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: "100%", maxWidth: 480 }}
          >
            {/* Main card — Clerk-style */}
            <div
              style={{
                background: "rgba(22, 27, 34, 0.92)",
                border: "1px solid #30363D",
                borderRadius: 16,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow:
                  "0 0 0 1px rgba(88,166,255,0.07), 0 24px 80px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <div
                className="px-8 pt-8 pb-6 text-center"
                style={{ borderBottom: "1px solid #30363D" }}
              >
                {/* Logo */}
                <div className="flex justify-center mb-5">
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      background: "linear-gradient(135deg, #58A6FF 0%, #3FB950 100%)",
                      borderRadius: 14,
                      boxShadow: "0 0 24px rgba(88,166,255,0.3)",
                    }}
                  />
                </div>

                {/* Badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
                  style={{
                    background: "rgba(88,166,255,0.1)",
                    border: "1px solid rgba(88,166,255,0.25)",
                    color: "#58A6FF",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#3FB950",
                      boxShadow: "0 0 6px rgba(63,185,80,0.7)",
                      display: "inline-block",
                    }}
                  />
                  Совместная разработка в реальном времени
                </div>

                <h1
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    color: "#E6EDF3",
                    marginBottom: 8,
                    lineHeight: 1.1,
                  }}
                >
                  CodeSync
                </h1>
                <p
                  style={{
                    fontSize: 14,
                    color: "#8B949E",
                    lineHeight: 1.6,
                    maxWidth: 320,
                    margin: "0 auto",
                  }}
                >
                  Онлайн IDE для совместной работы с AI-ассистентом, запуском программ и гостевым доступом.
                </p>
              </div>

              {/* Card body */}
              <div className="px-8 py-6 flex flex-col gap-4">
                {/* Primary actions */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => setShowGuestModal(true)}
                    style={{
                      width: "100%",
                      padding: "10px 0",
                      background: "linear-gradient(135deg, #3FB950 0%, #2ea043 100%)",
                      border: "none",
                      borderRadius: 10,
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 0 16px rgba(63,185,80,0.2)",
                      transition: "box-shadow 0.15s, opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 24px rgba(63,185,80,0.35)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(63,185,80,0.2)"; }}
                    data-testid="btn-guest-mode"
                  >
                    Гостевой режим
                  </button>

                  <div className="flex gap-2">
                    <SignInButton mode="modal">
                      <button
                        style={{
                          flex: 1,
                          padding: "9px 0",
                          background: "rgba(88,166,255,0.1)",
                          border: "1px solid rgba(88,166,255,0.25)",
                          borderRadius: 10,
                          color: "#58A6FF",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(88,166,255,0.18)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(88,166,255,0.45)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(88,166,255,0.1)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(88,166,255,0.25)";
                        }}
                      >
                        Войти
                      </button>
                    </SignInButton>
                    <button
                      onClick={() => setShowAuthHint((v) => !v)}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        background: "transparent",
                        border: "1px solid #30363D",
                        borderRadius: 10,
                        color: "#8B949E",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#58A6FF";
                        (e.currentTarget as HTMLButtonElement).style.color = "#E6EDF3";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363D";
                        (e.currentTarget as HTMLButtonElement).style.color = "#8B949E";
                      }}
                      data-testid="btn-dashboard"
                    >
                      Мои комнаты
                    </button>
                  </div>

                  <AnimatePresence>
                    {showAuthHint && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                          style={{
                            background: "rgba(88,166,255,0.08)",
                            border: "1px solid rgba(88,166,255,0.2)",
                            color: "#8B949E",
                          }}
                        >
                          <span>Нужен аккаунт —</span>
                          <SignInButton mode="modal">
                            <button
                              style={{
                                color: "#58A6FF",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 14,
                                padding: 0,
                                textDecoration: "underline",
                              }}
                              onClick={() => setShowAuthHint(false)}
                            >
                              войти в аккаунт
                            </button>
                          </SignInButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div style={{ flex: 1, height: 1, background: "#30363D" }} />
                  <span style={{ fontSize: 12, color: "#4A5568" }}>или войдите по коду</span>
                  <div style={{ flex: 1, height: 1, background: "#30363D" }} />
                </div>

                {/* Join by invite code */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      placeholder="Код приглашения"
                      style={{
                        flex: 1,
                        background: "#0D1117",
                        border: "1px solid #30363D",
                        color: "#E6EDF3",
                        borderRadius: 10,
                        height: 40,
                        fontFamily: "JetBrains Mono, monospace",
                        letterSpacing: "0.08em",
                        fontSize: 14,
                      }}
                    />
                    <button
                      onClick={handleJoin}
                      disabled={!inviteCode.trim() || isJoining}
                      style={{
                        padding: "0 20px",
                        background: "#58A6FF",
                        border: "none",
                        borderRadius: 10,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: inviteCode.trim() && !isJoining ? "pointer" : "not-allowed",
                        opacity: inviteCode.trim() && !isJoining ? 1 : 0.5,
                        transition: "opacity 0.15s",
                        whiteSpace: "nowrap",
                      }}
                      data-testid="btn-join-room"
                    >
                      {isJoining ? "..." : "Войти"}
                    </button>
                  </div>
                  {joinError && (
                    <p style={{ color: "#FF7B72", fontSize: 13, margin: 0 }}>{joinError}</p>
                  )}
                </div>
              </div>

              {/* Card footer — features */}
              <div
                className="px-8 py-5 grid grid-cols-3 gap-4"
                style={{ borderTop: "1px solid #30363D", background: "rgba(13,17,23,0.5)" }}
              >
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex flex-col items-center text-center gap-1.5">
                    <div style={{ color: "#58A6FF", opacity: 0.8 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#E6EDF3" }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: "#8B949E", lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
