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
}

const DEFAULTS: RoomSettingsData = {
  editorTheme: "vs-dark",
  showMouseCursors: true,
  showFilePresence: true,
  showEditorCursors: true,
  showChatMessages: true,
  soundEnabled: true,
  soundType: "chime",
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
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.13);
        gain.gain.linearRampToValueAtTime(volume, now + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.32);
        osc.start(now + i * 0.13); osc.stop(now + i * 0.13 + 0.32);
      });
    } else if (type === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
      gain.gain.setValueAtTime(volume * 1.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === "bell") {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(volume, now + i * 0.09 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);
        osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.4);
      });
    } else if (type === "soft") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettingsData;
  onChange: (s: RoomSettingsData) => void;
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: value ? "#3FB950" : "rgba(255,255,255,0.1)",
          border: "none", cursor: "pointer", position: "relative",
          transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2,
          left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </button>
    </div>
  );
}

export function RoomSettings({ isOpen, onClose, settings, onChange }: Props) {
  const [tab, setTab] = useState<"appearance" | "presence" | "sound">("appearance");
  const backdropRef = useRef<HTMLDivElement>(null);

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
            ref={backdropRef}
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 8000, backdropFilter: "blur(3px)" }}
          />
          <motion.div
            key="settings-panel"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 460, maxHeight: "80vh",
              background: "#161B22",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
              zIndex: 8001,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                  <circle cx="12" cy="12" r="10" strokeDasharray="2 4"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Настройки комнаты</span>
              </div>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", lineHeight: 0, padding: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, padding: "8px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {([["appearance", "Внешний вид"], ["presence", "Присутствие"], ["sound", "Звук"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 500,
                    background: "none", border: "none", cursor: "pointer",
                    color: tab === id ? "#58A6FF" : "rgba(255,255,255,0.4)",
                    borderBottom: `2px solid ${tab === id ? "#58A6FF" : "transparent"}`,
                    marginBottom: -1, transition: "color 0.15s",
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {tab === "appearance" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                    Тема редактора
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {EDITOR_THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => set({ editorTheme: t.id })}
                        style={{
                          padding: "8px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                          background: settings.editorTheme === t.id ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${settings.editorTheme === t.id ? "rgba(88,166,255,0.4)" : "rgba(255,255,255,0.07)"}`,
                          color: settings.editorTheme === t.id ? "#58A6FF" : "rgba(255,255,255,0.6)",
                          fontSize: 12, fontWeight: 500, transition: "all 0.12s",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === "presence" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>
                    Видимость действий пользователей
                  </div>
                  <Toggle
                    value={settings.showMouseCursors}
                    onChange={(v) => set({ showMouseCursors: v })}
                    label="Курсоры мыши"
                    desc="Видеть где находится курсор других пользователей"
                  />
                  <Toggle
                    value={settings.showFilePresence}
                    onChange={(v) => set({ showFilePresence: v })}
                    label="Присутствие в файлах"
                    desc="Показывать в каком файле находится каждый пользователь"
                  />
                  <Toggle
                    value={settings.showEditorCursors}
                    onChange={(v) => set({ showEditorCursors: v })}
                    label="Курсоры в редакторе"
                    desc="Позиция текстового курсора в редакторе кода"
                  />
                  <Toggle
                    value={settings.showChatMessages}
                    onChange={(v) => set({ showChatMessages: v })}
                    label="Чат в реальном времени"
                    desc="Получать сообщения чата от участников комнаты"
                  />
                </div>
              )}

              {tab === "sound" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>
                    Уведомления
                  </div>
                  <Toggle
                    value={settings.soundEnabled}
                    onChange={(v) => set({ soundEnabled: v })}
                    label="Звук завершения AI"
                    desc="Воспроизводить звук когда AI заканчивает ответ"
                  />
                  {settings.soundEnabled && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                        Тип звука
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {SOUND_OPTIONS.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { set({ soundType: s.id }); playSound(s.id); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                              background: settings.soundType === s.id ? "rgba(88,166,255,0.12)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${settings.soundType === s.id ? "rgba(88,166,255,0.35)" : "rgba(255,255,255,0.06)"}`,
                              transition: "all 0.12s",
                            }}
                          >
                            <span style={{ fontSize: 16, lineHeight: 1 }}>🔊</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: settings.soundType === s.id ? "#58A6FF" : "rgba(255,255,255,0.7)" }}>{s.label}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{s.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modal, document.body);
}
