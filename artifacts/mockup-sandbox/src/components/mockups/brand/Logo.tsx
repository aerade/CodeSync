import logoIcon from "@assets/image_1776235333066.png";

function SynchroLogo({ size = 48, textSize = 26, dark = false }: { size?: number; textSize?: number; dark?: boolean }) {
  const r = Math.round(size * 0.27);
  const iconSize = Math.round(size * 0.54);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.33) }}>
      <div style={{ width: size, height: size, borderRadius: r, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <img src={logoIcon} alt="" style={{ width: iconSize, height: iconSize, display: "block" }} />
      </div>
      <span style={{ fontSize: textSize, fontWeight: 800, letterSpacing: "-0.02em", color: dark ? "#080C14" : "#E8EDF5", fontFamily: "'Manrope', sans-serif" }}>СИНХРОН</span>
    </div>
  );
}

function Bg({ children, light = false, label }: { children: React.ReactNode; light?: boolean; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: light ? "#F0F4FF" : "#111826", border: `1px solid ${light ? "#D8E0EE" : "#1E2D42"}`, borderRadius: 14, padding: "28px 36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880", textAlign: "center" }}>{label}</div>
    </div>
  );
}

export function Logo() {
  return (
    <div style={{ fontFamily: "'Manrope', 'Inter', sans-serif", background: "#080C14", color: "#E8EDF5", minHeight: "100vh", padding: "48px 56px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Логотип — СИНХРОН</div>
        <div style={{ fontSize: 13, color: "#5A6880", marginTop: 4 }}>Варианты применения · Размеры · Тёмный и светлый фон</div>
      </div>

      {/* 01 — Full logo on dark + light */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>01 — Полный логотип</div>
      <div style={{ display: "flex", gap: 20, marginBottom: 40 }}>
        <Bg label="На тёмном фоне"><SynchroLogo size={48} textSize={26} /></Bg>
        <Bg label="На светлом фоне" light><SynchroLogo size={48} textSize={26} dark /></Bg>
        <Bg label="На акцентном фоне">
          <div style={{ background: "#00C2A8", borderRadius: 12, padding: "16px 28px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "#080C14", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={logoIcon} alt="" style={{ width: 22, height: 22, display: "block", filter: "brightness(0) saturate(100%) invert(69%) sepia(62%) saturate(461%) hue-rotate(118deg) brightness(98%) contrast(98%)" }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#080C14" }}>СИНХРОН</span>
          </div>
        </Bg>
      </div>

      {/* 02 — Scale test */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>02 — Масштабирование</div>
      <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 14, padding: "28px 36px", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 36, flexWrap: "wrap" }}>
          {[{ s: 64, t: 32 }, { s: 48, t: 26 }, { s: 36, t: 20 }, { s: 28, t: 16 }, { s: 20, t: 12 }].map(({ s, t }) => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <SynchroLogo size={s} textSize={t} />
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>icon {s}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* 03 — App icons */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>03 — Иконка приложения</div>
      <div style={{ display: "flex", gap: 24, marginBottom: 40, alignItems: "flex-end" }}>
        {[
          { bg: "linear-gradient(135deg, #0D1F35 0%, #00C2A8 100%)", stroke: "#E8EDF5", label: "App Store / Play", shadow: "0 8px 24px rgba(0,194,168,0.35)" },
          { bg: "#00C2A8", stroke: "#080C14", label: "Тёмная иконка", shadow: "none" },
          { bg: "#080C14", stroke: "#00C2A8", label: "Контурная", shadow: "0 4px 12px rgba(0,0,0,0.6)", border: "1px solid #1E2D42" },
          { bg: "#E8EDF5", stroke: "#080C14", label: "Монохром", shadow: "none" },
        ].map(({ bg, stroke, label, shadow, border }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: shadow, border: border || "none" }}>
              <img src={logoIcon} alt="" style={{ width: 38, height: 38, display: "block", filter: stroke === "#080C14" ? "brightness(0) saturate(100%)" : stroke === "#E8EDF5" ? "brightness(0) saturate(100%) invert(92%)" : "brightness(0) saturate(100%) invert(69%) sepia(62%) saturate(461%) hue-rotate(118deg) brightness(98%) contrast(98%)" }} />
            </div>
            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880", textAlign: "center" }}>{label}</span>
          </div>
        ))}
        {/* Favicon sizes */}
        <div style={{ width: 1, height: 60, background: "#1E2D42", margin: "0 4px", alignSelf: "center" }} />
        {[32, 16].map((sz) => (
          <div key={sz} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: sz, height: sz, borderRadius: Math.round(sz * 0.25), background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={logoIcon} alt="" style={{ width: Math.round(sz * 0.56), height: Math.round(sz * 0.56), display: "block" }} />
            </div>
            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>{sz}px</span>
          </div>
        ))}
      </div>

      {/* 04 — Wordmark only */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>04 — Только иконка / только текст</div>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logoIcon} alt="" style={{ width: 28, height: 28, display: "block" }} />
          </div>
        </div>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#E8EDF5" }}>СИНХРОН</span>
        </div>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}><span style={{ color: "#00C2A8" }}>СИН</span><span style={{ color: "#E8EDF5" }}>ХРОН</span></span>
        </div>
      </div>
    </div>
  );
}
