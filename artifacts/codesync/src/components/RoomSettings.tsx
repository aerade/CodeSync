import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EDITOR_THEMES } from "@/lib/editorThemes";

export interface RoomSettingsData {
  editorTheme: string;
  showMouseCursors: boolean;
  showFilePresence: boolean;
  showEditorCursors: boolean;
  showChatMessages: boolean;
  soundEnabled: boolean;
  soundType: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  showMinimap: boolean;
  notifyOnJoin: boolean;
  notifyOnMessage: boolean;
}

const DEFAULTS: RoomSettingsData = {
  editorTheme: "vs-dark",
  showMouseCursors: true,
  showFilePresence: true,
  showEditorCursors: true,
  showChatMessages: true,
  soundEnabled: true,
  soundType: "chime",
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  autoSave: true,
  showMinimap: false,
  notifyOnJoin: true,
  notifyOnMessage: true,
};

const LS_KEY = "codesync_room_settings";

export function loadSettings(): RoomSettingsData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) as Partial<RoomSettingsData> };
  } catch (_) {}
  return { ...DEFAULTS, editorTheme: localStorage.getItem("codesync_editor_theme") ?? "vs-dark" };
}

export function saveSettings(s: RoomSettingsData) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  localStorage.setItem("codesync_editor_theme", s.editorTheme);
}

const SOUND_OPTIONS = [
  { id: "chime", label: "Колокольчик", desc: "Мягкий двойной тон" },
  { id: "pop", label: "Поп", desc: "Короткий щелчок" },
  { id: "bell", label: "Звонок", desc: "Классический звук" },
  { id: "soft", label: "Тихий", desc: "Еле слышный сигнал" },
];

export function playSound(type: string, volume = 0.15) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    if (type === "chime") {
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.13);
        gain.gain.linearRampToValueAtTime(volume, now + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.32);
        osc.start(now + i * 0.13); osc.stop(now + i * 0.13 + 0.32);
      });
    } else if (type === "pop") {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
      gain.gain.setValueAtTime(volume * 1.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === "bell") {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(volume, now + i * 0.09 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);
        osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.4);
      });
    } else if (type === "soft") {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 660;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch (_) {}
}

type SectionId = "appearance" | "editor" | "presence" | "sound" | "room" | "notifications" | "shortcuts";

interface Section {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "appearance",
    label: "Внешний вид",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
    ),
  },
  {
    id: "editor",
    label: "Редактор",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"/>
        <line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
    ),
  },
  {
    id: "presence",
    label: "Присутствие",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "sound",
    label: "Звук",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    ),
  },
  {
    id: "room",
    label: "Комната",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Уведомления",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    id: "shortcuts",
    label: "Горячие клавиши",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
        <path d="M6 8h.001"/>
        <path d="M10 8h.001"/>
        <path d="M14 8h.001"/>
        <path d="M18 8h.001"/>
        <path d="M8 12h.001"/>
        <path d="M12 12h.001"/>
        <path d="M16 12h.001"/>
        <path d="M7 16h10"/>
      </svg>
    ),
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettingsData;
  onChange: (s: RoomSettingsData) => void;
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 6,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: value ? "#3FB950" : "rgba(255,255,255,0.1)",
          border: "none", cursor: "pointer", position: "relative",
          transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3,
          left: value ? 20 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)",
      marginBottom: 8, marginTop: 16,
    }}>
      {children}
    </div>
  );
}

function NumberPicker({ value, onChange, min, max, step = 1, label, options }: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  label: string; options?: number[];
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 6,
    }}>
      <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{label}</div>
      {options ? (
        <div style={{ display: "flex", gap: 4 }}>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                width: 32, height: 26, borderRadius: 7,
                border: `1px solid ${value === opt ? "rgba(88,166,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                background: value === opt ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.03)",
                color: value === opt ? "#58A6FF" : "rgba(255,255,255,0.5)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 0.12s",
              }}
            >{opt}</button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => onChange(Math.max(min, value - step))}
            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >-</button>
          <span style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 600, minWidth: 24, textAlign: "center", fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + step))}
            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >+</button>
        </div>
      )}
    </div>
  );
}

const SHORTCUTS = [
  { keys: ["Ctrl", "S"], desc: "Сохранить файл" },
  { keys: ["Ctrl", "/"], desc: "Комментировать строку" },
  { keys: ["Ctrl", "Z"], desc: "Отменить" },
  { keys: ["Ctrl", "Shift", "Z"], desc: "Повторить" },
  { keys: ["Ctrl", "F"], desc: "Найти в файле" },
  { keys: ["Ctrl", "H"], desc: "Найти и заменить" },
  { keys: ["Alt", "↑/↓"], desc: "Переместить строку" },
  { keys: ["Shift", "Alt", "↑/↓"], desc: "Скопировать строку" },
  { keys: ["Ctrl", "D"], desc: "Выбрать следующее совпадение" },
  { keys: ["Ctrl", "`"], desc: "Открыть терминал" },
  { keys: ["F2"], desc: "Переименовать символ" },
  { keys: ["Ctrl", "G"], desc: "Перейти к строке" },
];

export function RoomSettings({ isOpen, onClose, settings, onChange }: Props) {
  const [section, setSection] = useState<SectionId>("appearance");

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  function set(partial: Partial<RoomSettingsData>) {
    const next = { ...settings, ...partial };
    onChange(next);
    saveSettings(next);
  }

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 8000, backdropFilter: "blur(4px)" }}
          />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8001, pointerEvents: "none" }}>
            <motion.div
              key="settings-panel"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              style={{
                width: 720, maxHeight: "85vh",
                background: "#13171E",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                boxShadow: "0 32px 96px rgba(0,0,0,0.85), 0 0 0 1px rgba(88,166,255,0.06)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "all",
              }}
            >
              {/* Top glow line */}
              <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.4), transparent)",
                pointerEvents: "none",
              }} />

              {/* Header */}
              <div style={{
                padding: "16px 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: "rgba(88,166,255,0.1)",
                  border: "1px solid rgba(88,166,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#58A6FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
                    <path d="M16.9 10a6.9 6.9 0 0 1-.07.93l2.02 1.58a.48.48 0 0 1 .12.62l-1.92 3.32a.48.48 0 0 1-.58.21l-2.39-.96a6.88 6.88 0 0 1-1.61.93l-.36 2.54a.47.47 0 0 1-.47.4H8.36a.47.47 0 0 1-.47-.4l-.36-2.54a6.88 6.88 0 0 1-1.61-.93l-2.39.96a.48.48 0 0 1-.58-.21L1.03 13.13a.47.47 0 0 1 .12-.62l2.02-1.58A6.94 6.94 0 0 1 3.1 10c0-.31.02-.62.07-.93L1.15 7.49a.48.48 0 0 1-.12-.62l1.92-3.32a.48.48 0 0 1 .58-.21l2.39.96a6.88 6.88 0 0 1 1.61-.93L7.89.83a.47.47 0 0 1 .47-.4h3.28c.23 0 .43.16.47.4l.36 2.54c.57.23 1.1.54 1.61.93l2.39-.96a.48.48 0 0 1 .58.21l1.92 3.32a.47.47 0 0 1-.12.62L16.83 9.07c.05.31.07.62.07.93z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>Настройки комнаты</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Персональные предпочтения для вашей сессии</div>
                </div>
                <button
                  onClick={onClose}
                  style={{ marginLeft: "auto", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.5)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Body: sidebar + content */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Left sidebar navigation */}
                <div style={{
                  width: 180, flexShrink: 0,
                  borderRight: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(0,0,0,0.2)",
                  padding: "10px 8px",
                  display: "flex", flexDirection: "column", gap: 2,
                  overflowY: "auto",
                }}>
                  {SECTIONS.map((s) => {
                    const isActive = section === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 12px", borderRadius: 10,
                          background: isActive ? "rgba(88,166,255,0.12)" : "transparent",
                          border: `1px solid ${isActive ? "rgba(88,166,255,0.2)" : "transparent"}`,
                          cursor: "pointer", textAlign: "left",
                          color: isActive ? "#58A6FF" : "rgba(255,255,255,0.5)",
                          transition: "all 0.12s",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                          }
                        }}
                      >
                        <span style={{ flexShrink: 0, lineHeight: 0, opacity: isActive ? 1 : 0.7 }}>{s.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {/* APPEARANCE */}
                      {section === "appearance" && (
                        <div>
                          <SectionLabel>Тема редактора</SectionLabel>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {EDITOR_THEMES.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => set({ editorTheme: t.id })}
                                style={{
                                  padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                                  background: settings.editorTheme === t.id ? "rgba(88,166,255,0.12)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${settings.editorTheme === t.id ? "rgba(88,166,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                                  color: settings.editorTheme === t.id ? "#58A6FF" : "rgba(255,255,255,0.6)",
                                  fontSize: 12, fontWeight: 500, transition: "all 0.12s",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {settings.editorTheme === t.id && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  )}
                                  <span>{t.label}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* EDITOR */}
                      {section === "editor" && (
                        <div>
                          <SectionLabel>Размер шрифта</SectionLabel>
                          <NumberPicker
                            label="Размер шрифта (px)"
                            value={settings.fontSize}
                            onChange={(v) => set({ fontSize: v })}
                            min={10} max={24}
                            options={[12, 13, 14, 16, 18]}
                          />

                          <SectionLabel>Отступы</SectionLabel>
                          <NumberPicker
                            label="Размер табуляции"
                            value={settings.tabSize}
                            onChange={(v) => set({ tabSize: v })}
                            min={1} max={8}
                            options={[2, 4, 8]}
                          />

                          <SectionLabel>Поведение</SectionLabel>
                          <Toggle
                            value={settings.wordWrap}
                            onChange={(v) => set({ wordWrap: v })}
                            label="Перенос строк"
                            desc="Автоматически переносить длинные строки"
                          />
                          <Toggle
                            value={settings.autoSave}
                            onChange={(v) => set({ autoSave: v })}
                            label="Автосохранение"
                            desc="Сохранять файл при изменениях"
                          />
                          <Toggle
                            value={settings.showMinimap}
                            onChange={(v) => set({ showMinimap: v })}
                            label="Миникарта кода"
                            desc="Показывать обзор кода в правой части редактора"
                          />
                        </div>
                      )}

                      {/* PRESENCE */}
                      {section === "presence" && (
                        <div>
                          <SectionLabel>Видимость действий пользователей</SectionLabel>
                          <Toggle
                            value={settings.showMouseCursors}
                            onChange={(v) => set({ showMouseCursors: v })}
                            label="Курсоры мыши"
                            desc="Видеть где находится мышь других участников"
                          />
                          <Toggle
                            value={settings.showFilePresence}
                            onChange={(v) => set({ showFilePresence: v })}
                            label="Присутствие в файлах"
                            desc="Показывать в каком файле находится участник"
                          />
                          <Toggle
                            value={settings.showEditorCursors}
                            onChange={(v) => set({ showEditorCursors: v })}
                            label="Курсоры в редакторе"
                            desc="Позиция текстового курсора в редакторе"
                          />
                          <Toggle
                            value={settings.showChatMessages}
                            onChange={(v) => set({ showChatMessages: v })}
                            label="Чат участников"
                            desc="Получать сообщения чата от других участников"
                          />
                        </div>
                      )}

                      {/* SOUND */}
                      {section === "sound" && (
                        <div>
                          <SectionLabel>Уведомления</SectionLabel>
                          <Toggle
                            value={settings.soundEnabled}
                            onChange={(v) => set({ soundEnabled: v })}
                            label="Звук завершения ИИ"
                            desc="Воспроизводить звук когда ИИ заканчивает ответ"
                          />
                          {settings.soundEnabled && (
                            <>
                              <SectionLabel>Тип звука</SectionLabel>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {SOUND_OPTIONS.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => { set({ soundType: s.id }); playSound(s.id); }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 12,
                                      padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                                      background: settings.soundType === s.id ? "rgba(88,166,255,0.1)" : "rgba(255,255,255,0.03)",
                                      border: `1px solid ${settings.soundType === s.id ? "rgba(88,166,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                                      transition: "all 0.12s",
                                    }}
                                  >
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: settings.soundType === s.id ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={settings.soundType === s.id ? "#58A6FF" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                      </svg>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 500, color: settings.soundType === s.id ? "#58A6FF" : "rgba(255,255,255,0.75)" }}>{s.label}</div>
                                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{s.desc}</div>
                                    </div>
                                    {settings.soundType === s.id && (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: "auto" }}>
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ROOM */}
                      {section === "room" && (
                        <div>
                          <SectionLabel>О комнате</SectionLabel>
                          <div style={{
                            padding: "14px 16px", borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            marginBottom: 8,
                          }}>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Настройки комнаты управляются владельцем</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
                              • Имя, описание и приватность комнаты<br/>
                              • Максимальное количество участников<br/>
                              • Права доступа для гостей
                            </div>
                          </div>
                          <div style={{
                            padding: "10px 14px", borderRadius: 10,
                            background: "rgba(88,166,255,0.05)",
                            border: "1px solid rgba(88,166,255,0.15)",
                            display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span style={{ fontSize: 12, color: "rgba(88,166,255,0.9)" }}>Эти настройки сохраняются локально для вашего браузера</span>
                          </div>
                        </div>
                      )}

                      {/* NOTIFICATIONS */}
                      {section === "notifications" && (
                        <div>
                          <SectionLabel>Уведомления о событиях</SectionLabel>
                          <Toggle
                            value={settings.notifyOnJoin}
                            onChange={(v) => set({ notifyOnJoin: v })}
                            label="Подключение участников"
                            desc="Уведомлять когда кто-то подключается к комнате"
                          />
                          <Toggle
                            value={settings.notifyOnMessage}
                            onChange={(v) => set({ notifyOnMessage: v })}
                            label="Новые сообщения"
                            desc="Уведомлять о новых сообщениях в чате"
                          />
                          <Toggle
                            value={settings.showChatMessages}
                            onChange={(v) => set({ showChatMessages: v })}
                            label="Показывать сообщения чата"
                            desc="Отображать сообщения от участников комнаты"
                          />
                        </div>
                      )}

                      {/* SHORTCUTS */}
                      {section === "shortcuts" && (
                        <div>
                          <SectionLabel>Горячие клавиши редактора</SectionLabel>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {SHORTCUTS.map(({ keys, desc }) => (
                              <div key={desc} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderRadius: 8,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.05)",
                              }}>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{desc}</span>
                                <div style={{ display: "flex", gap: 3 }}>
                                  {keys.map((k, i) => (
                                    <span key={i} style={{
                                      padding: "2px 6px", borderRadius: 5,
                                      background: "rgba(255,255,255,0.08)",
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      fontSize: 10, fontWeight: 600,
                                      color: "rgba(255,255,255,0.7)",
                                      fontFamily: "JetBrains Mono, monospace",
                                    }}>{k}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modal, document.body);
}
