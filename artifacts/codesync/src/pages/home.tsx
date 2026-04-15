import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useUser, SignInButton, SignUpButton } from "@clerk/react";
import { Logo } from "@/components/Logo";
import { GuestModal } from "@/components/GuestModal";

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

const CODE_LINES = [
  { tokens: [{ t: "# Совместная сессия — CS301", c: BRAND.muted }] },
  { tokens: [] },
  { tokens: [{ t: "const", c: BRAND.blue }, { t: " room ", c: BRAND.text }, { t: "=", c: BRAND.teal }, { t: " синхрон", c: BRAND.text }, { t: ".", c: BRAND.teal }, { t: "join", c: BRAND.blue }, { t: "(", c: BRAND.text }, { t: '"CS301"', c: BRAND.orange }, { t: ")", c: BRAND.text }] },
  { tokens: [{ t: "room", c: BRAND.blue }, { t: ".", c: BRAND.teal }, { t: "invite", c: BRAND.green }, { t: "(", c: BRAND.text }, { t: '"team"', c: BRAND.orange }, { t: ")", c: BRAND.text }] },
  { tokens: [] },
  { tokens: [{ t: "// Курсоры видны в реальном времени", c: BRAND.muted }] },
  { tokens: [{ t: "def", c: BRAND.blue }, { t: " ", c: "" }, { t: "merge_sort", c: BRAND.green }, { t: "(arr):", c: BRAND.text }] },
  { tokens: [{ t: "    ", c: "" }, { t: "if", c: BRAND.blue }, { t: " len(arr) ", c: BRAND.text }, { t: "<=", c: BRAND.teal }, { t: " ", c: "" }, { t: "1", c: BRAND.orange }, { t: ":", c: BRAND.text }] },
  { tokens: [{ t: "        ", c: "" }, { t: "return", c: BRAND.blue }, { t: " arr", c: BRAND.text }] },
];

const FEATURES = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: "До 5 участников",
    desc: "Совместная разработка в реальном времени. Курсоры и изменения каждого видны мгновенно.",
    accent: BRAND.teal,
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    title: "Monaco Editor",
    desc: "Встроенный редактор Monaco с подсветкой синтаксиса и автодополнением. 8 тем оформления.",
    accent: BRAND.blue,
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    title: "ИИ-ассистент",
    desc: "Встроенный чат с AI. Объясняет код, предлагает решения, генерирует функции по описанию.",
    accent: BRAND.blue,
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    title: "Встроенный терминал",
    desc: "Запускайте Node.js, Python и другой код прямо в браузере без настройки окружения.",
    accent: BRAND.orange,
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    title: "Гостевой доступ",
    desc: "Пригласите кого угодно по коду без регистрации. Просто отправьте ссылку.",
    accent: BRAND.green,
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
    title: "Управление файлами",
    desc: "Полноценное дерево файлов, создание папок, скачивание проекта как ZIP-архива.",
    accent: BRAND.teal,
  },
];

const STEPS = [
  { n: "01", title: "Создайте комнату", desc: "Дайте название, выберите приватность и лимит участников" },
  { n: "02", title: "Поделитесь кодом", desc: "Отправьте код-приглашения — коллеги войдут без регистрации" },
  { n: "03", title: "Пишите код вместе", desc: "Изменения синхронизируются мгновенно через Yjs CRDT" },
];

function AnimatedCode() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisible(i);
      if (i >= CODE_LINES.length) clearInterval(interval);
    }, 280);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: BRAND.surface,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 16,
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,194,168,0.08)`,
      }}
    >
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        borderBottom: `1px solid ${BRAND.border}`,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["rgba(255,96,96,0.45)", "rgba(255,189,68,0.45)", "rgba(68,189,84,0.45)"].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <span style={{ color: BRAND.muted, fontSize: 11, marginLeft: 6 }}>main.py</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: -6 }}>
          {[{ name: "А", color: BRAND.teal }, { name: "М", color: BRAND.blue }, { name: "Д", color: BRAND.orange }].map(({ name, color }, i) => (
            <div key={i} style={{
              width: 20, height: 20, borderRadius: "50%", background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: BRAND.bg,
              border: `2px solid ${BRAND.surface}`,
              marginLeft: i === 0 ? 0 : -7,
              fontFamily: "'Manrope', sans-serif",
            }}>{name}</div>
          ))}
          <span style={{ color: BRAND.muted, fontSize: 10, marginLeft: 10, fontFamily: "'Manrope', sans-serif" }}>3 онлайн</span>
        </div>
      </div>

      {/* Code */}
      <div style={{ padding: "16px 20px", lineHeight: 1.8, minHeight: 240 }}>
        {CODE_LINES.map((line, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -8 }}
            animate={idx < visible ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ minHeight: "1.8em", display: "flex", flexWrap: "wrap" }}
          >
            {line.tokens.length === 0
              ? <span style={{ color: "transparent" }}>&nbsp;</span>
              : line.tokens.map((tok, ti) => (
                  <span key={ti} style={{ color: tok.c || "transparent", whiteSpace: "pre" }}>{tok.t}</span>
                ))
            }
          </motion.div>
        ))}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, repeatType: "reverse" }}
          style={{ color: BRAND.teal, fontSize: 14 }}
        >▌</motion.span>
      </div>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "default",
        background: hovered ? `rgba(${hexToRgb(feature.accent)},0.04)` : BRAND.surface,
        border: `1px solid ${hovered ? feature.accent + "40" : BRAND.border}`,
        transition: "all 0.25s ease",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `rgba(${hexToRgb(feature.accent)},0.1)`,
        border: `1px solid rgba(${hexToRgb(feature.accent)},0.2)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: feature.accent,
        transition: "all 0.25s ease",
      }}>
        {feature.icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.text, marginBottom: 6, fontFamily: "'Manrope', sans-serif" }}>{feature.title}</div>
        <div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.65 }}>{feature.desc}</div>
      </div>
    </motion.div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0,194,168";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [showGuestModal, setShowGuestModal] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation("/dashboard");
  }, [isLoaded, isSignedIn, setLocation]);

  if (isLoaded && isSignedIn) return null;

  return (
    <div
      style={{
        background: BRAND.bg,
        color: BRAND.text,
        minHeight: "100vh",
        overflowX: "hidden",
        fontFamily: "'Manrope', 'Inter', sans-serif",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <GuestModal
        open={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSuccess={() => { setShowGuestModal(false); setLocation("/dashboard"); }}
      />

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${BRAND.border}55 1px, transparent 1px), linear-gradient(90deg, ${BRAND.border}55 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }} />

      {/* Teal radial glow top */}
      <div style={{
        position: "fixed", top: "-30vh", left: "50%", transform: "translateX(-50%)",
        width: "70vw", height: "70vw",
        background: `radial-gradient(circle, rgba(0,194,168,0.07) 0%, transparent 65%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── NAV ── */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 48px",
          position: "sticky", top: 0, zIndex: 20,
          background: `${BRAND.bg}cc`,
          borderBottom: `1px solid ${BRAND.border}`,
          backdropFilter: "blur(20px)",
        }}>
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Logo size={32} />
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: BRAND.text }}>СИНХРОН</span>
            <span style={{
              fontSize: 10, color: BRAND.muted, fontFamily: "'JetBrains Mono', monospace",
              background: BRAND.surface, border: `1px solid ${BRAND.border}`,
              borderRadius: 4, padding: "2px 8px", marginLeft: 2,
            }}>beta</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <button
              onClick={() => setShowGuestModal(true)}
              style={{
                fontSize: 13, padding: "8px 18px", borderRadius: 9, fontWeight: 600,
                color: BRAND.muted, background: "transparent",
                border: `1px solid ${BRAND.border}`, cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BRAND.text; (e.currentTarget as HTMLElement).style.borderColor = BRAND.muted; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BRAND.muted; (e.currentTarget as HTMLElement).style.borderColor = BRAND.border; }}
            >
              Войти как гость
            </button>
            <SignUpButton mode="modal">
              <button style={{
                fontSize: 13, padding: "8px 20px", borderRadius: 9, fontWeight: 700,
                color: BRAND.bg, background: BRAND.teal,
                border: "none", cursor: "pointer",
                boxShadow: `0 0 24px rgba(0,194,168,0.3)`,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; }}
              >
                Начать бесплатно
              </button>
            </SignUpButton>
          </motion.div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ padding: "80px 48px 60px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            {/* Left */}
            <div>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "5px 14px", borderRadius: 20, marginBottom: 28,
                  background: "rgba(0,194,168,0.08)",
                  border: `1px solid rgba(0,194,168,0.2)`,
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.green, display: "inline-block", flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: BRAND.teal, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  ИИ-помощник в каждой комнате
                </span>
              </motion.div>

              {/* Headline */}
              <div style={{ overflow: "hidden", marginBottom: 8 }}>
                <motion.h1
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: "clamp(40px, 5.5vw, 68px)",
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    color: BRAND.text,
                    margin: 0,
                  }}
                >
                  Код не спит.
                </motion.h1>
              </div>
              <div style={{ overflow: "hidden", marginBottom: 24 }}>
                <motion.h1
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.75, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: "clamp(40px, 5.5vw, 68px)",
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    color: BRAND.teal,
                    margin: 0,
                  }}
                >
                  Пиши вместе.
                </motion.h1>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.6 }}
                style={{ fontSize: 15, lineHeight: 1.7, color: BRAND.muted, maxWidth: 440, marginBottom: 36 }}
              >
                Онлайн-IDE с совместным редактированием в реальном времени. Monaco Editor, ИИ-ассистент, встроенный терминал и гостевой доступ — всё в браузере без установки.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
                <SignUpButton mode="modal">
                  <button style={{
                    padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    color: BRAND.bg, background: BRAND.teal,
                    border: "none", cursor: "pointer",
                    boxShadow: `0 0 36px rgba(0,194,168,0.35)`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                  >
                    Открыть комнату
                  </button>
                </SignUpButton>
                <button
                  onClick={() => setShowGuestModal(true)}
                  style={{
                    padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: BRAND.text, background: "transparent",
                    border: `1px solid ${BRAND.border}`, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.muted; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.border; }}
                >
                  Посмотреть демо
                </button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.6 }}
                style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 36 }}
              >
                {[
                  { n: "5", label: "участников" },
                  { n: "8", label: "тем" },
                  { n: "∞", label: "комнат" },
                ].map(({ n, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.text, letterSpacing: "-0.02em" }}>{n}</div>
                    <div style={{ fontSize: 11, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — code */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              <AnimatedCode />
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ borderTop: `1px solid ${BRAND.border}`, padding: "72px 48px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: "center", marginBottom: 48 }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: BRAND.muted, marginBottom: 12 }}>
                Как это работает
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: BRAND.text, letterSpacing: "-0.02em", margin: 0 }}>
                Три шага до совместной работы
              </h2>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    padding: "24px",
                    borderRadius: 14,
                    background: BRAND.surface,
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: BRAND.teal, fontWeight: 700, marginBottom: 14 }}>{step.n}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: BRAND.text, marginBottom: 8, letterSpacing: "-0.01em" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.65 }}>{step.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section style={{ borderTop: `1px solid ${BRAND.border}`, padding: "72px 48px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: "center", marginBottom: 48 }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: BRAND.muted, marginBottom: 12 }}>
                Возможности
              </div>
              <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: BRAND.text, letterSpacing: "-0.02em", margin: 0 }}>
                Всё для командной разработки
              </h2>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} feature={f} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ borderTop: `1px solid ${BRAND.border}`, padding: "80px 48px", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ maxWidth: 520, margin: "0 auto" }}
          >
            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: BRAND.text, letterSpacing: "-0.025em", marginBottom: 16 }}>
              Начните прямо сейчас
            </h2>
            <p style={{ fontSize: 15, color: BRAND.muted, marginBottom: 36, lineHeight: 1.65 }}>
              Регистрация занимает 30 секунд. Или войдите как гость — без регистрации.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <SignUpButton mode="modal">
                <button style={{
                  padding: "13px 32px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  color: BRAND.bg, background: BRAND.teal,
                  border: "none", cursor: "pointer",
                  boxShadow: `0 0 36px rgba(0,194,168,0.35)`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; }}
                >
                  Зарегистрироваться
                </button>
              </SignUpButton>
              <button
                onClick={() => setShowGuestModal(true)}
                style={{
                  padding: "13px 32px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  color: BRAND.text, background: "transparent",
                  border: `1px solid ${BRAND.border}`, cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.muted; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BRAND.border; }}
              >
                Войти как гость
              </button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: `1px solid ${BRAND.border}`,
          padding: "20px 48px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.text }}>СИНХРОН</span>
          </div>
          <span style={{ fontSize: 12, color: BRAND.muted }}>Совместная онлайн-IDE</span>
        </footer>
      </div>
    </div>
  );
}
