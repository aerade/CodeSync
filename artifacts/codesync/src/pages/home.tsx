import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { useUser, useClerk, SignUpButton } from "@clerk/react";
import { Logo } from "@/components/Logo";
import { GuestModal } from "@/components/GuestModal";
import { HeroBackground } from "@/components/HeroBackground";
import { TransitionOverlay } from "@/components/TransitionOverlay";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

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
  { n: "01", title: "Создайте комнату", desc: "Дайте название, выберите приватность и лимит участников" },
  { n: "02", title: "Поделитесь кодом", desc: "Отправьте код-приглашения — коллеги войдут без регистрации" },
  { n: "03", title: "Пишите код вместе", desc: "Изменения синхронизируются мгновенно через Yjs CRDT" },
];

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "255,255,255";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
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

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const clerk = useClerk();
  const [, setLocation] = useLocation();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState({ x: 0, y: 0 });
  const stepsRef = useRef<HTMLDivElement>(null);
  const stepsInView = useInView(stepsRef, { once: true, margin: "-60px" });
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation("/dashboard");
  }, [isLoaded, isSignedIn, setLocation]);

  const handleStart = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (reducedMotion) {
      if (isSignedIn) {
        setLocation("/dashboard");
      } else {
        clerk.openSignUp({});
      }
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTransitionOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setTransitioning(true);
  }, [reducedMotion, isSignedIn, setLocation, clerk]);

  const handleTransitionComplete = useCallback(() => {
    setTransitioning(false);
    if (isSignedIn) {
      setLocation("/dashboard");
    } else {
      clerk.openSignUp({});
    }
  }, [isSignedIn, setLocation, clerk]);

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

      <TransitionOverlay
        active={transitioning}
        originX={transitionOrigin.x}
        originY={transitionOrigin.y}
        onComplete={handleTransitionComplete}
      />

      {!reducedMotion && <HeroBackground />}

      <div className="relative z-10 flex flex-col min-h-screen">
        <nav
          className="flex items-center justify-between px-6 sm:px-12 py-4 sticky top-0 z-20"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(3,3,3,0.6)",
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
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px" }}>CodeSync</span>
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
                Регистрация
              </button>
            </SignUpButton>
          </motion.div>
        </nav>

        <section className="flex-1 flex flex-col items-center justify-center px-6 min-h-[90vh]">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs"
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
              Реальное время · Yjs CRDT · WebSocket
            </motion.div>

            <div style={{ overflow: "hidden" }}>
              <motion.h1
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fontSize: "clamp(52px, 8vw, 96px)",
                  fontWeight: 800,
                  lineHeight: 1.0,
                  letterSpacing: "-3px",
                  color: "#fff",
                  marginBottom: 0,
                }}
              >
                Code<span style={{ color: "rgba(255,255,255,0.25)" }}>Sync</span>
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              style={{
                fontSize: "clamp(16px, 2.5vw, 22px)",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.4)",
                maxWidth: 560,
                marginTop: 16,
                marginBottom: 48,
              }}
            >
              Совместная IDE в браузере. Пишите код с командой в реальном времени — Monaco, AI, терминал и гостевой доступ.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                onClick={handleStart}
                className="group relative px-12 py-4 rounded-2xl text-lg font-bold transition-all active:scale-95"
                style={{
                  background: "#fff",
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 60px rgba(255,255,255,0.15), 0 0 120px rgba(88,166,255,0.1)",
                  letterSpacing: "-0.3px",
                }}
              >
                <span className="relative z-10">Начать</span>
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(88,166,255,0.3), rgba(210,168,255,0.3), rgba(63,185,80,0.3))",
                    opacity: 0,
                  }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75, duration: 0.6 }}
              className="flex items-center gap-8 mt-12"
            >
              {[
                { n: "5", label: "участников" },
                { n: "8", label: "тем редактора" },
                { n: "∞", label: "комнат" },
              ].map(({ n, label }) => (
                <div key={label} className="text-center">
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{n}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 1 }}
              className="mt-16"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,3,3,0.8)" }}>
          <div className="max-w-4xl mx-auto" ref={stepsRef}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Как это работает
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
                Три шага до совместной работы
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-3 gap-6">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 24 }}
                  animate={stepsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                  transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-3 p-6 rounded-xl relative overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="absolute top-0 right-0 w-24 h-24 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${["rgba(88,166,255,0.08)", "rgba(63,185,80,0.08)", "rgba(210,168,255,0.08)"][i]} 0%, transparent 70%)`,
                      transform: "translate(30%, -30%)",
                    }}
                  />
                  <div style={{ fontFamily: "monospace", fontSize: 28, color: "rgba(255,255,255,0.08)", fontWeight: 800 }}>{step.n}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{step.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Возможности
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
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

        <section
          className="px-6 py-24 text-center relative overflow-hidden"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(88,166,255,0.04) 0%, transparent 70%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-xl mx-auto relative z-10"
          >
            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.5px", marginBottom: 16 }}>
              Начните прямо сейчас
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.38)", marginBottom: 36, lineHeight: 1.6 }}>
              Регистрация занимает 30 секунд. Или войдите как гость — без регистрации.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <SignUpButton mode="modal">
                <button
                  className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#fff", color: "#000", border: "none", cursor: "pointer", boxShadow: "0 0 40px rgba(255,255,255,0.12)" }}
                >
                  Зарегистрироваться
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
                Войти как гость
              </button>
            </div>
          </motion.div>
        </section>

        <footer
          className="px-6 py-5 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.18)", fontSize: 12 }}
        >
          CodeSync — совместная онлайн IDE
        </footer>
      </div>
    </div>
  );
}

