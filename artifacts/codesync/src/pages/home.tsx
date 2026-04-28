import { useState, useEffect, useRef, type RefObject, type ReactElement } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { useUser, SignUpButton } from "@clerk/react";
import { Logo } from "@/components/Logo";
import { GuestModal } from "@/components/GuestModal";
import { useGithubRelease, detectUserPlatform, formatBytes } from "@/hooks/useGithubRelease";
import type { Platform } from "@/hooks/useGithubRelease";

const CODE_LINES = [
  { text: "import { Server } from 'socket.io';",        color: "#79c0ff", delay: 0    },
  { text: "",                                            color: "",        delay: 0    },
  { text: "const io = new Server(3000);",                color: "#e6edf3", delay: 160  },
  { text: "",                                            color: "",        delay: 0    },
  { text: "io.on('connection', (socket) => {",           color: "#e6edf3", delay: 320  },
  { text: "  socket.on('code-change', (data) => {",     color: "#e6edf3", delay: 480  },
  { text: "    socket.broadcast.emit('update', data);", color: "#d2a8ff", delay: 640  },
  { text: "  });",                                       color: "#e6edf3", delay: 800  },
  { text: "});",                                         color: "#e6edf3", delay: 960  },
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
      <div className="p-5" style={{ lineHeight: "1.8", minHeight: 220 }}>
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

const PLATFORM_ICONS: Record<Platform, ReactElement> = {
  mac: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.08.05c-.32.19-1.94 1.13-1.92 3.36.03 2.65 2.32 3.53 2.35 3.54l-.09.23zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  ),
  windows: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
    </svg>
  ),
  linux: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489-.041.303-.12.56-.27.800-1.393 1.748-1.45 3.28-1.024 4.389.315.821 1.077 1.48 2.063 1.796.33.103.68.165 1.044.182.35.016.727-.01 1.133-.075.77-.12 1.57-.406 2.356-.887.79-.482 1.608-1.158 2.398-2.03a12.93 12.93 0 0 0 2.16-3.836c.283-.813.449-1.63.472-2.44.035-.785-.1-1.543-.381-2.247-.286-.72-.713-1.38-1.256-1.936-.543-.556-1.188-1.006-1.9-1.324C9.5 9.5 9.048 8.968 9.048 8.373c0-.596.452-1.12 1.052-1.42.308-.155.665-.234 1.041-.234.376 0 .733.08 1.042.234.6.3 1.052.824 1.052 1.42 0 .595-.452 1.127-1.052 1.427-.308.155-.665.233-1.042.233zm4.44 2.87c-.21-.547-.525-1.04-.93-1.459a6.25 6.25 0 0 0-1.454-.988A6.24 6.24 0 0 0 12.5 0c-.588 0-1.157.086-1.685.258-.71.231-1.343.625-1.863 1.158-.52.534-.895 1.18-1.097 1.881-.2.7-.217 1.44-.048 2.16.17.72.517 1.385 1.018 1.937.5.55 1.14.99 1.875 1.277.735.286 1.52.408 2.28.346.762-.063 1.493-.315 2.115-.73.622-.414 1.107-.993 1.4-1.663.292-.67.382-1.422.261-2.14-.122-.716-.453-1.378-.942-1.916l-.25-.22.205.082zm1.04 5.413c-.205.553-.52 1.062-.93 1.503a6.24 6.24 0 0 1-1.388.99c-.52.28-1.085.47-1.67.558a6.27 6.27 0 0 1-1.74.002c-.577-.087-1.135-.278-1.648-.558a6.24 6.24 0 0 1-1.337-.96c-.396-.42-.712-.924-.922-1.48-.21-.557-.305-1.153-.278-1.75.022-.517.126-1.028.307-1.513.182-.485.442-.94.772-1.343.33-.402.726-.748 1.175-1.024.448-.276.94-.48 1.46-.598a6.14 6.14 0 0 1 1.58-.09c.537.055 1.056.2 1.543.43.487.23.93.547 1.31.934.38.388.69.843.916 1.345.227.503.365 1.045.408 1.597.043.553-.012 1.11-.162 1.638l-.196.32z"/>
    </svg>
  ),
};

const PLATFORM_ACCENT: Record<Platform, string> = {
  mac: "#a8a8a8",
  windows: "#58a6ff",
  linux: "#ffa657",
};

function DownloadSection({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const releaseState = useGithubRelease("aerade/CodeSync");
  const userPlatform = detectUserPlatform();

  const primaryAsset = releaseState.status === "ok"
    ? (releaseState.release.assets.find((a) => a.platform === userPlatform)
        ?? releaseState.release.assets[0])
    : null;
  const otherAssets = releaseState.status === "ok" && primaryAsset
    ? releaseState.release.assets.filter((a) => a.platform !== primaryAsset.platform)
    : [];

  return (
    <section
      ref={sectionRef}
      id="download"
      className="px-6 py-20"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
            Десктоп-приложение
          </div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 14 }}>
            Установите на свой компьютер
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>
            Полноценное десктоп-приложение с нативными уведомлениями, локальными проектами и всеми возможностями IDE CodeSync.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl p-8 sm:p-10 flex flex-col items-center gap-8"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 80px rgba(255,255,255,0.02), 0 32px 80px rgba(0,0,0,0.4)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* subtle glow behind card */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: "70%", height: "70%",
              background: "radial-gradient(circle, rgba(88,166,255,0.06) 0%, transparent 70%)",
              top: "-20%", left: "15%",
            }}
          />

          {/* ── Loading state ── */}
          {releaseState.status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className="w-10 h-10 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  borderTopColor: "rgba(255,255,255,0.4)",
                }}
              />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Загружаем информацию о релизе…</span>
            </div>
          )}

          {/* ── No release / Error state ── */}
          {(releaseState.status === "no-release" || releaseState.status === "error") && (
            <div className="flex flex-col items-center gap-5 text-center py-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                  {releaseState.status === "error"
                    ? "Не удалось загрузить информацию о релизе"
                    : "Десктоп-приложение скоро будет доступно"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, lineHeight: 1.6, maxWidth: 360 }}>
                  {releaseState.status === "error"
                    ? "Проверьте соединение или попробуйте позже. Установщики доступны на GitHub."
                    : "Мы работаем над первым релизом. Следите за обновлениями в репозитории."}
                </div>
              </div>
              <a
                href="https://github.com/aerade/CodeSync/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.65)",
                  textDecoration: "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Открыть GitHub Releases
              </a>
            </div>
          )}

          {/* ── Release found ── */}
          {releaseState.status === "ok" && primaryAsset && (
            <div className="w-full flex flex-col items-center gap-6 relative">
              {/* Version badge */}
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                style={{
                  background: "rgba(63,185,80,0.1)",
                  border: "1px solid rgba(63,185,80,0.25)",
                  color: "#3fb950",
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", display: "inline-block", flexShrink: 0 }}
                />
                {releaseState.release.tag_name}
                <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>
                  · {new Date(releaseState.release.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>

              {/* Primary download button */}
              <a
                href={primaryAsset.url}
                download
                className="flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-base transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,240,240,0.9) 100%)",
                  color: "#000",
                  textDecoration: "none",
                  boxShadow: "0 0 48px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4)",
                  minWidth: 260,
                  justifyContent: "center",
                }}
              >
                <span style={{ color: PLATFORM_ACCENT[primaryAsset.platform] }}>
                  {PLATFORM_ICONS[primaryAsset.platform]}
                </span>
                <span>
                  Скачать для {primaryAsset.label}
                  <span style={{ fontWeight: 400, fontSize: 13, color: "rgba(0,0,0,0.45)", marginLeft: 6 }}>
                    {primaryAsset.ext}
                    {primaryAsset.size > 0 && ` · ${formatBytes(primaryAsset.size)}`}
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>

              {/* Other platform links */}
              {otherAssets.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {otherAssets.map((asset) => (
                    <a
                      key={asset.platform}
                      href={asset.url}
                      download
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:bg-white/6 hover:border-white/14"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.5)",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ color: PLATFORM_ACCENT[asset.platform] }}>
                        {PLATFORM_ICONS[asset.platform]}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{asset.label}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>
                        {asset.ext}
                        {asset.size > 0 && ` · ${formatBytes(asset.size)}`}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {/* Feature chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {[
                  { icon: "🖥️", text: "Нативные уведомления" },
                  { icon: "📁", text: "Локальные проекты" },
                  { icon: "🔒", text: "Local-first" },
                ].map((chip) => (
                  <div
                    key={chip.text}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <span>{chip.icon}</span>
                    {chip.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [showGuestModal, setShowGuestModal] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLElement | null>(null);
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
            className="flex items-center gap-1"
          >
            <Logo size={42} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px" }}>CodeSync</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={() => downloadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="hidden sm:flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                color: "rgba(255,255,255,0.5)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Скачать
            </button>
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
                Реальное время · Yjs CRDT · WebSocket
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
                  Code<span style={{ color: "rgba(255,255,255,0.35)" }}>Sync</span>
                </motion.h1>
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                style={{
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.65)",
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
        <section className="px-6 py-16" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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

            <div className="grid sm:grid-cols-3 gap-6">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-3 p-5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>{step.n}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{step.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section ref={featuresRef} className="px-6 py-16" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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

        {/* ── DOWNLOAD ── */}
        <DownloadSection sectionRef={downloadRef} />

        {/* ── CTA BOTTOM ── */}
        <section
          className="px-6 py-20 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-xl mx-auto"
          >
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

        {/* Footer */}
        <footer
          className="px-6 py-5 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.18)", fontSize: 12 }}
        >
          CodeSync — Collaborative Online IDE
        </footer>
      </div>
    </div>
  );
}
