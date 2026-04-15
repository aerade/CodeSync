import React from "react";

const DARK = "#080C14";
const SURFACE = "#111826";
const BORDER = "#1E2D42";
const TEAL = "#00C2A8";
const TEXT = "#E8EDF5";
const MUTED = "#5A6880";

function Swatch({ bg, border = "none", children }: { bg: string; border?: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 88,
      height: 88,
      borderRadius: 22,
      background: bg,
      border,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: MUTED, textAlign: "center", marginTop: 6 }}>
      {children}
    </div>
  );
}

function ScaleRow({ icon }: { icon: (size: number, color: string) => React.ReactNode }) {
  const sizes = [52, 40, 32, 24, 16];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      {sizes.map(s => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: s,
            height: s,
            borderRadius: Math.round(s * 0.25),
            background: TEAL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {icon(Math.round(s * 0.54), DARK)}
          </div>
          <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: MUTED }}>{s}px</span>
        </div>
      ))}
    </div>
  );
}

function ConceptCard({
  number,
  name,
  desc,
  tag,
  icon,
  accent = TEAL,
}: {
  number: string;
  name: string;
  desc: string;
  tag: string;
  icon: (size: number, color: string) => React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 18,
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 24,
    }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 4, padding: "2px 6px" }}>
            {number}
          </span>
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: MUTED, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {tag}
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, letterSpacing: "-0.02em" }}>{name}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>{desc}</div>
      </div>

      {/* Main icon on 3 backgrounds */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 10 }}>Варианты фона</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <Swatch bg={TEAL}>
              {icon(48, DARK)}
            </Swatch>
            <Label>Акцент</Label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <Swatch bg={DARK} border={`1px solid ${BORDER}`}>
              {icon(48, TEAL)}
            </Swatch>
            <Label>Тёмный</Label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <Swatch bg="#F0F4FF" border="1px solid #D8E0EE">
              {icon(48, DARK)}
            </Swatch>
            <Label>Светлый</Label>
          </div>
        </div>
      </div>

      {/* Scale */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 10 }}>Масштаб</div>
        <ScaleRow icon={icon} />
      </div>

      {/* Full logo lockup */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 10 }}>Логотип целиком</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon(20, DARK)}
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT, fontFamily: "'Manrope', sans-serif" }}>СИНХРОН</span>
          </div>
          <div style={{ background: TEAL, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: DARK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon(18, TEAL)}
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: DARK, fontFamily: "'Manrope', sans-serif" }}>СИНХРОН</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Concept 1: Bidirectional Sync Arrows ───────────────────────────────────
function SyncArrowsIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Top arc from left (7 o'clock) to right (5 o'clock), clockwise */}
      <path
        d="M 5.5 14.5 A 8 8 0 0 1 18.5 9.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead at end of top arc */}
      <path
        d="M 15.5 7 L 18.5 9.5 L 15.8 11.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bottom arc from right back to left, counterclockwise = going the other way */}
      <path
        d="M 18.5 14.5 A 8 8 0 0 1 5.5 9.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead at end of bottom arc */}
      <path
        d="M 8.5 12 L 5.5 9.5 L 8.2 7.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Concept 2: Dual Cursor ──────────────────────────────────────────────────
function DualCursorIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Left cursor */}
      <line x1="8.5" y1="4" x2="8.5" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Right cursor */}
      <line x1="15.5" y1="4" x2="15.5" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Top bridge */}
      <path d="M 8.5 4 Q 12 1 15.5 4" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Bottom bridge */}
      <path d="M 8.5 20 Q 12 23 15.5 20" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Sync dot in the middle */}
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}

// ─── Concept 6: Terminal Window ─────────────────────────────────────────────
function TerminalWindowIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Window frame */}
      <rect x="2" y="3" width="20" height="18" rx="3.5" stroke={color} strokeWidth="2" fill="none" />
      {/* Title bar divider */}
      <line x1="2" y1="9" x2="22" y2="9" stroke={color} strokeWidth="1.5" />
      {/* Traffic lights */}
      <circle cx="5.5" cy="6" r="1.1" fill={color} />
      <circle cx="9" cy="6" r="1.1" fill={color} />
      {/* > prompt */}
      <path d="M 5 14 L 8 16 L 5 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cursor underscore */}
      <line x1="9.5" y1="18" x2="15" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Concept 7: Code Gutter ──────────────────────────────────────────────────
function CodeGutterIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Gutter vertical bar */}
      <line x1="6" y1="3" x2="6" y2="21" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
      {/* Gutter dot markers */}
      <circle cx="6" cy="7" r="1.8" fill={color} />
      <circle cx="6" cy="13" r="1.8" fill={color} />
      <circle cx="6" cy="19" r="1.8" fill={color} />
      {/* Code line 1 (long) */}
      <line x1="10" y1="7" x2="21" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Code line 2 (short) + blinking cursor */}
      <line x1="10" y1="13" x2="17" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="11" x2="18" y2="15" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Code line 3 (medium) */}
      <line x1="10" y1="19" x2="19" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Concept 8: Curly Braces ─────────────────────────────────────────────────
function CurlyBracesIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Left brace { */}
      <path
        d="M 15 3 C 12 3 10.5 4.5 10.5 7 C 10.5 9 9 10.5 7.5 12 C 9 13.5 10.5 15 10.5 17 C 10.5 19.5 12 21 15 21"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right brace } */}
      <path
        d="M 9 3 C 12 3 13.5 4.5 13.5 7 C 13.5 9 15 10.5 16.5 12 C 15 13.5 13.5 15 13.5 17 C 13.5 19.5 12 21 9 21"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Sync dot in center */}
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}

// ─── Concept 4: Git Merge (Branch) ──────────────────────────────────────────
function GitMergeIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Origin commit */}
      <circle cx="12" cy="3.5" r="2" fill={color} />
      {/* Left branch path */}
      <path d="M 12 5.5 C 12 8.5 6 8.5 6 12 C 6 15.5 12 15.5 12 18.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" fill="none" />
      {/* Right branch path */}
      <path d="M 12 5.5 C 12 8.5 18 8.5 18 12 C 18 15.5 12 15.5 12 18.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" fill="none" />
      {/* Left commit */}
      <circle cx="6" cy="12" r="2" fill={color} />
      {/* Right commit */}
      <circle cx="18" cy="12" r="2" fill={color} />
      {/* Merge commit */}
      <circle cx="12" cy="20.5" r="2" fill={color} />
    </svg>
  );
}

// ─── Concept 5: Terminal Sync ────────────────────────────────────────────────
function TerminalSyncIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* > prompt */}
      <path d="M 3 8.5 L 9.5 12 L 3 15.5" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cursor underscore */}
      <line x1="12" y1="15.5" x2="19.5" y2="15.5" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
      {/* Sync upload arrow */}
      <path d="M 13.5 10 L 16.5 7 L 19.5 10" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="16.5" y1="7" x2="16.5" y2="12.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// ─── Concept 3: Infinity Node ────────────────────────────────────────────────
function InfinityNodeIcon(size: number, color: string) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* Infinity / figure-8 path */}
      <path
        d="M 12 12 C 10 9.5 7.5 8 5.5 8 C 3.5 8 2 9.5 2 12 C 2 14.5 3.5 16 5.5 16 C 7.5 16 10 14.5 12 12 Z"
        stroke={color}
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 12 12 C 14 9.5 16.5 8 18.5 8 C 20.5 8 22 9.5 22 12 C 22 14.5 20.5 16 18.5 16 C 16.5 16 14 14.5 12 12 Z"
        stroke={color}
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central node */}
      <circle cx="12" cy="12" r="2.2" fill={color} />
    </svg>
  );
}

export function LogoNew() {
  return (
    <div style={{
      fontFamily: "'Manrope', 'Inter', sans-serif",
      background: DARK,
      color: TEXT,
      minHeight: "100vh",
      padding: "48px 56px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke={DARK} strokeWidth="2.5" fill="none" />
              <path d="M 8 12 L 12 8 L 16 12" stroke={DARK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 8 12 L 12 16 L 16 12" stroke={DARK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>СИНХРОН</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono', monospace", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 8px", marginLeft: 4 }}>Логотип v2 — концепции</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Новый логотип</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Три концепции · Разные подходы к визуальному языку бренда</div>
      </div>

      {/* Concepts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        <ConceptCard
          number="01"
          name="Двойной обмен"
          desc="Два дуговых вектора образуют кольцо синхронизации — символ мгновенного обмена между соавторами."
          tag="Рекомендуем"
          accent={TEAL}
          icon={(sz, col) => SyncArrowsIcon(sz, col)}
        />
        <ConceptCard
          number="02"
          name="Двойной курсор"
          desc="Два курсора, связанных дугами, — буквальный образ двух людей, которые одновременно пишут код."
          tag="Концептуально"
          accent="#4D9EFF"
          icon={(sz, col) => DualCursorIcon(sz, col)}
        />
        <ConceptCard
          number="03"
          name="Узел бесконечности"
          desc="Две петли, сходящиеся в одной точке — непрерывная, бесконечная совместная работа над проектом."
          tag="Элегантно"
          accent="#A78BFA"
          icon={(sz, col) => InfinityNodeIcon(sz, col)}
        />
      </div>

      {/* Coding concepts section */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>Кодинг-концепции</span>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <ConceptCard
            number="04"
            name="Ветки кода"
            desc="Два бранча расходятся от общего коммита и сливаются в один — прямая метафора совместной разработки через git."
            tag="Git-native"
            accent="#F59E0B"
            icon={(sz, col) => GitMergeIcon(sz, col)}
          />
          <ConceptCard
            number="05"
            name="Терминал"
            desc="Классический промпт `>` с курсором и стрелкой синхронизации — мгновенно считывается разработчиком как живой кодинг."
            tag="Dev-friendly"
            accent="#34D399"
            icon={(sz, col) => TerminalSyncIcon(sz, col)}
          />
        </div>
      </div>

      {/* Terminal concepts section */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>Мини-терминал</span>
          <div style={{ height: 1, flex: 1, background: BORDER }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          <ConceptCard
            number="06"
            name="Окно терминала"
            desc="Иконка macOS-окна с заголовком, двумя точками и промптом `>_` внутри — классический образ IDE и командной строки."
            tag="Terminal"
            accent="#60A5FA"
            icon={(sz, col) => TerminalWindowIcon(sz, col)}
          />
          <ConceptCard
            number="07"
            name="Редактор кода"
            desc="Вертикальный гатер с маркерами строк, три линии кода и мигающий курсор — привычная сетка любого текстового редактора."
            tag="Editor"
            accent="#F472B6"
            icon={(sz, col) => CodeGutterIcon(sz, col)}
          />
          <ConceptCard
            number="08"
            name="Фигурные скобки"
            desc="`{ }` — универсальный символ кода любого языка. Точка синхронизации в центре соединяет двух разработчиков внутри одного блока."
            tag="Universal"
            accent="#C084FC"
            icon={(sz, col) => CurlyBracesIcon(sz, col)}
          />
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 28, padding: "14px 20px", background: `${TEAL}10`, border: `1px solid ${TEAL}25`, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          <span style={{ color: TEAL, fontWeight: 700 }}>Как выбрать:</span> Концепции 06–08 — самые узнаваемые для разработчиков. «Окно терминала» (06) считывается мгновенно, «Редактор кода» (07) ближе к IDE-инструментам, «Фигурные скобки» (08) — язык-нейтральный символ программирования с добавлением метафоры соединения.
        </div>
      </div>
    </div>
  );
}
