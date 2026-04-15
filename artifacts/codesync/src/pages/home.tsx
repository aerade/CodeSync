import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useUser, SignInButton, SignUpButton } from "@clerk/react";
import { Logo } from "@/components/Logo";
import { GuestModal } from "@/components/GuestModal";

const CODE_LINES = [
  { text: "import { Server } from 'socket.io';",        color: "#79c0ff", delay: 0    },
  { text: "import { setupCRDT } from '@синхрон/core';", color: "#79c0ff", delay: 100  },
  { text: "",                                            color: "",        delay: 0    },
  { text: "const io = new Server(3000);",                color: "#e6edf3", delay: 200  },
  { text: "",                                            color: "",        delay: 0    },
  { text: "io.on('connection', (socket) => {",           color: "#e6edf3", delay: 320  },
  { text: "  const doc = setupCRDT(socket.id);",        color: "#3fb950", delay: 440  },
  { text: "",                                            color: "",        delay: 0    },
  { text: "  socket.on('code-change', (data) => {",     color: "#e6edf3", delay: 560  },
  { text: "    doc.applyUpdate(data.update);",          color: "#d2a8ff", delay: 680  },
  { text: "    socket.broadcast.emit('sync', data);",   color: "#d2a8ff", delay: 800  },
  { text: "  });",                                       color: "#e6edf3", delay: 920  },
  { text: "",                                            color: "",        delay: 0    },
  { text: "  // 3 участника онлайн",                    color: "#8b949e", delay: 1040 },
  { text: "  socket.emit('ready', { synced: true });",  color: "#ffa657", delay: 1160 },
  { text: "});",                                         color: "#e6edf3", delay: 1280 },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "До 5 участников",
    desc: "Работайте вместе в одной комнате. Курсоры и изменения каждого видны в реальном времени.",
    accent: "#58a6ff",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    title: "Monaco Editor",
    desc: "Тот же редактор что в VS Code — подсветка синтаксиса, автодополнение, 8 тем оформления.",
    accent: "#3fb950",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "AI-ассистент",
    desc: "Встроенный чат с AI. Объясняет код, предлагает решения, генерирует функции по описанию.",
    accent: "#d2a8ff",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
    ),
    title: "Встроенный терминал",
    desc: "Запускайте Node.js, Python и другой код прямо в браузере без настройки окружения.",
    accent: "#ffa657",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Гостевой доступ",
    desc: "Пригласите кого угодно по коду без регистрации. Просто отправьте ссылку.",
    accent: "#56d364",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
      </svg>
    ),
    title: "Управление файлами",
    desc: "Полноценное дерево файлов, создание папок, скачивание проекта как ZIP-архива.",
    accent: "#79c0ff",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Создайте комнату",
    desc: "Дайте название, выберите приватность и лимит участников — займёт секунду",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>
      </svg>
    ),
  },
  {
    n: "02",
    title: "Поделитесь кодом",
    desc: "Отправьте код-приглашения — коллеги войдут по ссылке без регистрации",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
  {
    n: "03",
    title: "Пишите код вместе",
    desc: "Курсоры всех участников видны в реальном времени — изменения появляются мгновенно",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
];

function AnimatedCode() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisible(i);
      if (i >= CODE_LINES.filter(l => l.text).length) clearInterval(interval);
    }, 220);
    return () => clearInterval(interval);
  }, []);

  let lineCount = 0;
  return (
    <div
      className="rounded-xl overflow-hidden font-mono text-sm"
      style={{
        background: "rgba(13,17,23,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,96,96,0.5)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,189,68,0.5)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(68,189,84,0.5)" }} />
        </div>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 8 }}>server.ts</span>
        {/* Fake online users */}
        <div className="ml-auto flex items-center gap-1.5">
          {["#3B82F6", "#10B981", "#F59E0B"].map((c, i) => (
            <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: c, color: "#0D1117" }}>
              {["AX", "MR", "IK"][i]}
            </div>
          ))}
        </div>
      </div>
      {/* Code */}
      <div className="p-5" style={{ lineHeight: "1.8", minHeight: 300 }}>
        {CODE_LINES.map((line, idx) => {
          if (line.text) lineCount++;
          const show = line.text === "" || lineCount <= visible;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -6 }}
              animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              style={{ color: line.color || "transparent", minHeight: "1.8em" }}
            >
              {line.text || "\u00A0"}
            </motion.div>
          );
        })}
        {/* Blinking cursor */}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
          style={{ color: "#58a6ff" }}
        >▌</motion.span>
      </div>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl p-5 flex flex-col gap-3 group transition-all"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        cursor: "default",
      }}
      whileHover={{ borderColor: `${feature.accent}35`, background: `rgba(${hexToRgb(feature.accent)},0.04)` }}
    >
      <div style={{ color: feature.accent }}>{feature.icon}</div>
      <div>
        <div style={{ color: "#e6edf3", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{feature.title}</div>
        <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 1.6 }}>{feature.desc}</div>
      </div>
    </motion.div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "255,255,255";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsInView = useInView(useRef<HTMLDivElement>(null), { once: true });

  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation("/dashboard");
  }, [isLoaded, isSignedIn, setLocation]);

  if (isLoaded && isSignedIn) return null;

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ background: "#030303", color: "#f0f0f0", overflowX: "hidden" }}
    >
      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSuccess={() => { setShowGuestModal(false); setLocation("/dashboard"); }}
      />

      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          zIndex: 0,
        }}
      />

      {/* Radial glow */}
      <div
        className="fixed pointer-events-none"
        style={{
          width: "60vw", height: "60vw",
          background: "radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 70%)",
          top: "-20vh", left: "20vw",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* NAV */}
        <nav
          className="flex items-center justify-between px-6 sm:px-12 py-4 sticky top-0 z-20"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(3,3,3,0.8)",
            backdropFilter: "blur(20px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2.5"
          >
            <Logo size={28} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px" }}>СИНХРОН</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hidden md:flex items-center gap-6"
          >
            {[
              { label: "Возможности", href: "#features" },
              { label: "Как работает", href: "#how-it-works" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)")}
              >
                {label}
              </a>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={() => setShowGuestModal(true)}
              className="text-sm px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                color: "rgba(255,255,255,0.65)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
              }}
            >
              Гостевой режим
            </button>
            <SignUpButton mode="modal">
              <button
                className="text-sm px-5 py-2 rounded-lg font-semibold transition-all hover:brightness-110"
                style={{
                  background: "#fff", color: "#000",
                  border: "none", cursor: "pointer",
                  boxShadow: "0 2px 16px rgba(255,255,255,0.15)",
                }}
              >
                Начать →
              </button>
            </SignUpButton>
          </motion.div>
        </nav>

        {/* ── HERO ── */}
        <section ref={heroRef} className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10">
          <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div className="flex flex-col items-start">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", display: "inline-block", flexShrink: 0 }}
                />
                Реальное время · без конфликтов · WebSocket
              </motion.div>

              {/* Title — per-char reveal */}
              <div style={{ overflow: "hidden" }}>
                <motion.h1
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: "clamp(44px, 6vw, 72px)",
                    fontWeight: 800,
                    lineHeight: 1.0,
                    letterSpacing: "-2.5px",
                    color: "#fff",
                    marginBottom: 0,
                  }}
                >
                  СИНХРОН
                </motion.h1>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                style={{
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "-0.5px",
                  marginTop: 6,
                  marginBottom: 20,
                }}
              >
                Совместная IDE онлайн
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6 }}
                style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.4)", maxWidth: 460, marginBottom: 36 }}
              >
                Пишите код вместе с командой в реальном времени. Monaco Editor, AI-ассистент, встроенный терминал и гостевой доступ — всё в браузере без установки.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex items-center gap-3 flex-wrap"
              >
                <SignUpButton mode="modal">
                  <button
                    className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: "#fff", color: "#000",
                      border: "none", cursor: "pointer",
                      boxShadow: "0 0 40px rgba(255,255,255,0.1)",
                    }}
                  >
                    Создать комнату
                  </button>
                </SignUpButton>
                <button
                  onClick={() => setShowGuestModal(true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/6"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  Войти как гость
                </button>
              </motion.div>

              {/* Mini stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.6 }}
                className="flex items-center gap-6 mt-8"
              >
                {[
                  { n: "5", label: "участников" },
                  { n: "8", label: "тем редактора" },
                  { n: "∞", label: "комнат" },
                ].map(({ n, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{n}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — animated code mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <AnimatedCode />
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="px-6 py-16" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Как это работает
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
                Три шага до совместной работы
              </h2>
            </motion.div>

            <div className="flex flex-col sm:flex-row items-stretch gap-0">
              {STEPS.map((step, i) => (
                <div key={step.n} className="flex sm:flex-col items-center flex-1">
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col gap-4 p-6 rounded-2xl w-full h-full"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "rgba(255,255,255,0.5)",
                      }}>
                        {step.icon}
                      </div>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>{step.n}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>{step.desc}</div>
                    </div>
                  </motion.div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-shrink-0" style={{ color: "rgba(255,255,255,0.1)", padding: "0 8px" }}>
                      <svg className="hidden sm:block" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M15 8l4 4-4 4"/></svg>
                      <svg className="block sm:hidden" style={{ transform: "rotate(90deg)", margin: "8px 0" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14M15 8l4 4-4 4"/></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" ref={featuresRef} className="px-6 py-16" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Возможности
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
                Всё для командной разработки
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} feature={f} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BOTTOM ── */}
        <section
          className="px-6 py-20 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}
        >
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(255,255,255,0.025) 0%, transparent 70%)",
          }} />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative max-w-xl mx-auto"
          >
            {/* Social proof */}
            <div className="flex items-center justify-center gap-5 mb-8 flex-wrap">
              {[
                { icon: "⚡", text: "Бесплатно" },
                { icon: "🔒", text: "Без регистрации для гостей" },
                { icon: "∞", text: "Неограниченные комнаты" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-1.5" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.5px", marginBottom: 16 }}>
              Начните прямо сейчас
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.38)", marginBottom: 32, lineHeight: 1.6 }}>
              Регистрация занимает 30 секунд. Или войдите как гость — без регистрации.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <SignUpButton mode="modal">
                <button
                  className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#fff", color: "#000", border: "none", cursor: "pointer", boxShadow: "0 0 40px rgba(255,255,255,0.12)" }}
                >
                  Создать аккаунт
                </button>
              </SignUpButton>
              <button
                onClick={() => setShowGuestModal(true)}
                className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/6"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.65)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                Войти как гость →
              </button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer
          className="px-6 py-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo size={18} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>СИНХРОН</span>
            </div>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {[
                { label: "Возможности", href: "#features" },
                { label: "Как работает", href: "#how-it-works" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)")}
                >
                  {label}
                </a>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>
              © 2025 СИНХРОН
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
