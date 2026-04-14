import { useState, useEffect, useRef } from "react";
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

interface SectionDef {
  id: SectionId;
  label: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: "appearance",
    label: "Внешний вид",
    desc: "Тема редактора",
    color: "#A78BFA",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
    ),
  },
  {
    id: "editor",
    label: "Редактор",
    desc: "Шрифт, отступы, поведение",
    color: "#34D399",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"/>
        <line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
    ),
  },
  {
    id: "presence",
    label: "Присутствие",
    desc: "Видимость участников",
    color: "#60A5FA",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
    desc: "Уведомления и сигналы",
    color: "#FB923C",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    ),
  },
  {
    id: "room",
    label: "Комната",
    desc: "Настройки и управление",
    color: "#F472B6",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Уведомления",
    desc: "События в комнате",
    color: "#FBBF24",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    id: "shortcuts",
    label: "Горячие клавиши",
    desc: "Быстрые действия",
    color: "#94A3B8",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
        <path d="M7 16h10"/>
        <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001"/>
      </svg>
    ),
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettingsData;
  onChange: (s: RoomSettingsData) => void;
  isOwner?: boolean;
  roomId?: string;
  roomTitle?: string;
  roomDescription?: string;
  roomIsPrivate?: boolean;
  roomMaxUsers?: number;
  roomPassword?: string;
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 12,
      background: value ? "rgba(88,166,255,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${value ? "rgba(88,166,255,0.12)" : "rgba(255,255,255,0.05)"}`,
      marginBottom: 6, transition: "all 0.15s", cursor: "pointer",
    }} onClick={() => onChange(!value)}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: value ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: value ? "linear-gradient(135deg, #58A6FF, #3B82F6)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${value ? "rgba(88,166,255,0.4)" : "rgba(255,255,255,0.1)"}`,
        position: "relative", transition: "all 0.2s", flexShrink: 0,
        boxShadow: value ? "0 0 12px rgba(88,166,255,0.3)" : "none",
      }}>
        <span style={{
          position: "absolute", top: 3,
          left: value ? 20 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }} />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 8,
    }}>{children}</div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)",
      marginBottom: 8, marginTop: 18,
    }}>
      {children}
    </div>
  );
}

function SliderPicker({ value, onChange, min, max, step = 1, label, presets }: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  label: string; presets?: number[];
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#79C0FF",
          background: "rgba(88,166,255,0.1)", border: "1px solid rgba(88,166,255,0.2)",
          borderRadius: 6, padding: "2px 10px",
          fontFamily: "JetBrains Mono, monospace",
        }}>{value}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace", minWidth: 16, textAlign: "right" }}>{min}</span>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#58A6FF", cursor: "pointer", height: 4 }}
        />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace", minWidth: 16 }}>{max}</span>
      </div>
      {presets && (
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {presets.map((p) => (
            <button
              key={p} onClick={() => onChange(p)}
              style={{
                flex: 1, fontSize: 10, padding: "3px 0", borderRadius: 6, cursor: "pointer",
                fontFamily: "JetBrains Mono, monospace",
                background: value === p ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${value === p ? "rgba(88,166,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                color: value === p ? "#79C0FF" : "rgba(255,255,255,0.3)",
                fontWeight: value === p ? 700 : 400,
                transition: "all 0.12s",
              }}
            >{p}</button>
          ))}
        </div>
      )}
    </Card>
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

export function RoomSettings({ isOpen, onClose, settings, onChange, isOwner = false, roomId, roomTitle = "", roomDescription = "", roomIsPrivate = false, roomMaxUsers = 5, roomPassword = "" }: Props) {
  const [ownerTitle, setOwnerTitle] = useState(roomTitle);
  const [ownerDesc, setOwnerDesc] = useState(roomDescription);
  const [ownerPrivate, setOwnerPrivate] = useState(roomIsPrivate);
  const [ownerMaxUsers, setOwnerMaxUsers] = useState(Math.min(5, Math.max(1, roomMaxUsers)));
  const [ownerPassword, setOwnerPassword] = useState(roomPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerSaved, setOwnerSaved] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("appearance");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setOwnerTitle(roomTitle); }, [roomTitle]);
  useEffect(() => { setOwnerDesc(roomDescription); }, [roomDescription]);
  useEffect(() => { setOwnerPrivate(roomIsPrivate); }, [roomIsPrivate]);
  useEffect(() => { setOwnerMaxUsers(Math.min(5, Math.max(1, roomMaxUsers))); }, [roomMaxUsers]);
  useEffect(() => { setOwnerPassword(roomPassword); }, [roomPassword]);

  async function handleOwnerSave() {
    if (!roomId) return;
    setOwnerSaving(true); setOwnerError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ownerTitle, description: ownerDesc, isPrivate: ownerPrivate, maxUsers: ownerMaxUsers, password: ownerPassword }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Ошибка сохранения"); }
      setOwnerSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setOwnerSaved(false), 2500);
    } catch (e) {
      setOwnerError(e instanceof Error ? e.message : "Ошибка");
    } finally { setOwnerSaving(false); }
  }

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

  const activeSection = SECTIONS.find((s) => s.id === section)!;

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, color: "rgba(255,255,255,0.9)",
    outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
  };

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
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 8000, backdropFilter: "blur(6px)" }}
          />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8001, pointerEvents: "none" }}>
            <motion.div
              key="settings-panel"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                width: 760, height: 520,
                background: "linear-gradient(145deg, #0C0E14 0%, #080A0F 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                boxShadow: "0 40px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "all",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "18px 22px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
                background: "rgba(255,255,255,0.015)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: `linear-gradient(135deg, ${activeSection.color}22, ${activeSection.color}11)`,
                  border: `1px solid ${activeSection.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: activeSection.color,
                  transition: "all 0.2s",
                }}>
                  {activeSection.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.95)", letterSpacing: "-0.01em" }}>
                    {activeSection.label}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{activeSection.desc}</div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 9, cursor: "pointer", color: "rgba(255,255,255,0.4)",
                    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Sidebar */}
                <div style={{
                  width: 192, flexShrink: 0,
                  borderRight: "1px solid rgba(255,255,255,0.04)",
                  padding: "12px 10px",
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
                          padding: "9px 12px", borderRadius: 11,
                          background: isActive ? `${s.color}14` : "transparent",
                          border: `1px solid ${isActive ? `${s.color}28` : "transparent"}`,
                          cursor: "pointer", textAlign: "left",
                          transition: "all 0.13s", width: "100%",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) { e.currentTarget.style.background = "transparent"; }
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isActive ? `${s.color}18` : "rgba(255,255,255,0.04)",
                          color: isActive ? s.color : "rgba(255,255,255,0.35)",
                          transition: "all 0.13s",
                        }}>
                          {s.icon}
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: isActive ? 600 : 500,
                          color: isActive ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)",
                          whiteSpace: "nowrap", transition: "color 0.13s",
                        }}>{s.label}</span>
                        {isActive && (
                          <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.14 }}
                    >

                      {/* APPEARANCE */}
                      {section === "appearance" && (
                        <div>
                          <Label>Тема редактора</Label>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {EDITOR_THEMES.map((t) => {
                              const active = settings.editorTheme === t.id;
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => set({ editorTheme: t.id })}
                                  style={{
                                    padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                                    background: active ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${active ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                                    color: active ? "#A78BFA" : "rgba(255,255,255,0.5)",
                                    fontSize: 12, fontWeight: 500, transition: "all 0.12s",
                                    display: "flex", alignItems: "center", gap: 8,
                                  }}
                                >
                                  {active && (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  )}
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* EDITOR */}
                      {section === "editor" && (
                        <div>
                          <Label>Размер шрифта</Label>
                          <SliderPicker label="Размер (px)" value={settings.fontSize} onChange={(v) => set({ fontSize: v })} min={10} max={24} presets={[12, 14, 16, 18, 20]} />
                          <Label>Отступы</Label>
                          <SliderPicker label="Табуляция (пробелов)" value={settings.tabSize} onChange={(v) => set({ tabSize: v })} min={1} max={8} presets={[2, 4, 8]} />
                          <Label>Поведение</Label>
                          <Toggle value={settings.wordWrap} onChange={(v) => set({ wordWrap: v })} label="Перенос строк" desc="Автоматически переносить длинные строки" />
                          <Toggle value={settings.autoSave} onChange={(v) => set({ autoSave: v })} label="Автосохранение" desc="Сохранять файл при изменениях" />
                          <Toggle value={settings.showMinimap} onChange={(v) => set({ showMinimap: v })} label="Миникарта кода" desc="Показывать обзор кода справа" />
                        </div>
                      )}

                      {/* PRESENCE */}
                      {section === "presence" && (
                        <div>
                          <Label>Видимость действий</Label>
                          <Toggle value={settings.showMouseCursors} onChange={(v) => set({ showMouseCursors: v })} label="Курсоры мыши" desc="Видеть курсор мыши участников" />
                          <Toggle value={settings.showFilePresence} onChange={(v) => set({ showFilePresence: v })} label="Файловое присутствие" desc="Показывать в каком файле участник" />
                          <Toggle value={settings.showEditorCursors} onChange={(v) => set({ showEditorCursors: v })} label="Курсоры в редакторе" desc="Позиция курсора в коде" />
                          <Toggle value={settings.showChatMessages} onChange={(v) => set({ showChatMessages: v })} label="Сообщения чата" desc="Получать сообщения от участников" />
                        </div>
                      )}

                      {/* SOUND */}
                      {section === "sound" && (
                        <div>
                          <Label>Звуковые уведомления</Label>
                          <Toggle value={settings.soundEnabled} onChange={(v) => set({ soundEnabled: v })} label="Звук завершения ИИ" desc="Сигнал когда ИИ заканчивает ответ" />
                          {settings.soundEnabled && (
                            <>
                              <Label>Тип звука</Label>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {SOUND_OPTIONS.map((s) => {
                                  const active = settings.soundType === s.id;
                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => { set({ soundType: s.id }); playSound(s.id); }}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 12,
                                        padding: "10px 14px", borderRadius: 11, cursor: "pointer", textAlign: "left",
                                        background: active ? "rgba(251,146,60,0.08)" : "rgba(255,255,255,0.02)",
                                        border: `1px solid ${active ? "rgba(251,146,60,0.25)" : "rgba(255,255,255,0.05)"}`,
                                        transition: "all 0.12s",
                                      }}
                                    >
                                      <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "#FB923C" : "rgba(255,255,255,0.35)"} strokeWidth="2" strokeLinecap="round">
                                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                        </svg>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: active ? "#FB923C" : "rgba(255,255,255,0.7)" }}>{s.label}</div>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{s.desc}</div>
                                      </div>
                                      {active && (
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round">
                                          <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ROOM */}
                      {section === "room" && (
                        <div>
                          {isOwner ? (
                            <>
                              <Label>Управление комнатой</Label>

                              {/* Title */}
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Название</div>
                                <input
                                  value={ownerTitle} onChange={(e) => setOwnerTitle(e.target.value)}
                                  maxLength={64} style={inputStyle}
                                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(244,114,182,0.4)")}
                                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                                />
                              </div>

                              {/* Description */}
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Описание</div>
                                <textarea
                                  value={ownerDesc} onChange={(e) => setOwnerDesc(e.target.value)}
                                  maxLength={256} rows={2}
                                  style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }}
                                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(244,114,182,0.4)")}
                                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                                />
                              </div>

                              {/* Max Users */}
                              <Card>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>Макс. участников</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#F472B6", background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: 7, padding: "2px 10px", fontFamily: "JetBrains Mono, monospace" }}>{ownerMaxUsers}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace" }}>1</span>
                                  <input type="range" min={1} max={5} step={1} value={ownerMaxUsers} onChange={(e) => setOwnerMaxUsers(Number(e.target.value))} style={{ flex: 1, accentColor: "#F472B6", cursor: "pointer", height: 4 }} />
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace" }}>5</span>
                                </div>
                                <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                                  {[1,2,3,4,5].map((n) => (
                                    <button key={n} onClick={() => setOwnerMaxUsers(n)} style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 7, cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontWeight: ownerMaxUsers === n ? 700 : 400, background: ownerMaxUsers === n ? "rgba(244,114,182,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${ownerMaxUsers === n ? "rgba(244,114,182,0.35)" : "rgba(255,255,255,0.07)"}`, color: ownerMaxUsers === n ? "#F472B6" : "rgba(255,255,255,0.3)", transition: "all 0.12s" }}>{n}</button>
                                  ))}
                                </div>
                              </Card>

                              {/* Password */}
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Пароль <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(необязательно)</span></div>
                                <div style={{ position: "relative" }}>
                                  <input
                                    type={showPassword ? "text" : "password"}
                                    value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)}
                                    maxLength={64} placeholder="Оставьте пустым чтобы убрать пароль"
                                    style={{ ...inputStyle, padding: "9px 38px 9px 12px", fontFamily: "JetBrains Mono, monospace" }}
                                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(244,114,182,0.4)")}
                                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                                  />
                                  <button onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 2, lineHeight: 0, transition: "color 0.12s" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                                    {showPassword ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Private */}
                              <Toggle value={ownerPrivate} onChange={setOwnerPrivate} label="Приватная комната" desc="Только по приглашению или инвайт-коду" />

                              {/* Save button */}
                              <button
                                onClick={handleOwnerSave} disabled={ownerSaving}
                                style={{
                                  marginTop: 12, width: "100%", padding: "10px",
                                  background: ownerSaved
                                    ? "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.08))"
                                    : "linear-gradient(135deg, rgba(244,114,182,0.15), rgba(244,114,182,0.08))",
                                  border: `1px solid ${ownerSaved ? "rgba(52,211,153,0.3)" : "rgba(244,114,182,0.3)"}`,
                                  borderRadius: 10, cursor: ownerSaving ? "not-allowed" : "pointer",
                                  fontSize: 13, fontWeight: 600,
                                  color: ownerSaved ? "#34D399" : "#F472B6",
                                  transition: "all 0.2s", letterSpacing: "-0.01em",
                                }}
                              >
                                {ownerSaving ? "Сохранение…" : ownerSaved ? "✓ Сохранено" : "Сохранить изменения"}
                              </button>
                              {ownerError && <div style={{ fontSize: 11, color: "#FF7B72", marginTop: 8, padding: "6px 10px", background: "rgba(255,123,114,0.08)", border: "1px solid rgba(255,123,114,0.15)", borderRadius: 7 }}>{ownerError}</div>}
                            </>
                          ) : (
                            <>
                              <Label>О комнате</Label>
                              <Card>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Настройки комнаты управляются владельцем</div>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>
                                  • Название, описание и приватность<br/>
                                  • Максимальное количество участников<br/>
                                  • Пароль и права доступа
                                </div>
                              </Card>
                            </>
                          )}
                          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.1)", display: "flex", alignItems: "center", gap: 9 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <span style={{ fontSize: 11, color: "rgba(244,114,182,0.8)" }}>Личные настройки сохраняются в браузере</span>
                          </div>
                        </div>
                      )}

                      {/* NOTIFICATIONS */}
                      {section === "notifications" && (
                        <div>
                          <Label>События</Label>
                          <Toggle value={settings.notifyOnJoin} onChange={(v) => set({ notifyOnJoin: v })} label="Подключение участников" desc="Уведомлять когда кто-то входит" />
                          <Toggle value={settings.notifyOnMessage} onChange={(v) => set({ notifyOnMessage: v })} label="Новые сообщения" desc="Уведомлять о сообщениях в чате" />
                          <Toggle value={settings.showChatMessages} onChange={(v) => set({ showChatMessages: v })} label="Показывать чат" desc="Отображать сообщения от участников" />
                        </div>
                      )}

                      {/* SHORTCUTS */}
                      {section === "shortcuts" && (
                        <div>
                          <Label>Горячие клавиши редактора</Label>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {SHORTCUTS.map(({ keys, desc }) => (
                              <div key={desc} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "9px 14px", borderRadius: 9,
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.04)",
                              }}>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{desc}</span>
                                <div style={{ display: "flex", gap: 3 }}>
                                  {keys.map((k, i) => (
                                    <span key={i} style={{
                                      padding: "2px 7px", borderRadius: 5,
                                      background: "rgba(255,255,255,0.06)",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      fontSize: 10, fontWeight: 600,
                                      color: "rgba(255,255,255,0.6)",
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
