export function Logo() {
  return (
    <div style={{
      fontFamily: "'Manrope', 'Inter', sans-serif",
      background: "#080C14",
      color: "#E8EDF5",
      minHeight: "100vh",
      padding: "48px 56px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Логотип — СИНХРОН</div>
        <div style={{ fontSize: 13, color: "#5A6880", marginTop: 4 }}>Варианты · Размеры · Тёмный и светлый фон</div>
      </div>

      {/* Row 1: Icon variants */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 16 }}>01 — Полный логотип (иконка + текст)</div>
      <div style={{ display: "flex", gap: 24, marginBottom: 40, flexWrap: "wrap" }}>

        {/* Full logo dark bg */}
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 16, padding: "32px 40px", display: "flex", alignItems: "center", gap: 16 }}>
          {/* Icon */}
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M7 8l-4 4 4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l4 4-4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 16.5l6-9" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#E8EDF5" }}>СИНХРОН</div>
          <div style={{ fontSize: 10, color: "#5A6880", fontFamily: "'JetBrains Mono', monospace", marginLeft: 8, alignSelf: "flex-end", paddingBottom: 3 }}>на тёмном</div>
        </div>

        {/* Full logo light bg */}
        <div style={{ background: "#F0F4FF", border: "1px solid #D8E0EE", borderRadius: 16, padding: "32px 40px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M7 8l-4 4 4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l4 4-4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 16.5l6-9" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#080C14" }}>СИНХРОН</div>
          <div style={{ fontSize: 10, color: "#999", fontFamily: "'JetBrains Mono', monospace", marginLeft: 8, alignSelf: "flex-end", paddingBottom: 3 }}>на светлом</div>
        </div>
      </div>

      {/* Row 2: Icon only variants */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 16 }}>02 — Иконка-монограмма</div>
      <div style={{ display: "flex", gap: 20, marginBottom: 40, alignItems: "flex-end" }}>

        {/* Large icon */}
        {[80, 56, 40, 32, 20].map((size) => (
          <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none">
                <path d="M7 8l-4 4 4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8l4 4-4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 16.5l6-9" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>{size}px</div>
          </div>
        ))}

        <div style={{ width: 1, height: 60, background: "#1E2D42", margin: "0 8px" }} />

        {/* Rounded square (app store style) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #0D1F35 0%, #00C2A8 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,194,168,0.3)" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M7 8l-4 4 4 4" stroke="#E8EDF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l4 4-4 4" stroke="#E8EDF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 16.5l6-9" stroke="#E8EDF5" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>App Store</div>
        </div>

        {/* Monochrome */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#E8EDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M7 8l-4 4 4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 8l4 4-4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 16.5l6-9" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>Моно</div>
        </div>
      </div>

      {/* Row 3: Wordmark only */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 16 }}>03 — Текстовый логотип (wordmark)</div>
      <div style={{ display: "flex", gap: 24, marginBottom: 40, alignItems: "center" }}>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px" }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: "#E8EDF5" }}>
            <span style={{ color: "#00C2A8" }}>СИН</span>ХРОН
          </div>
        </div>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px" }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "0.04em", color: "#E8EDF5" }}>СИНХРОН</div>
        </div>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 32px" }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#E8EDF5", fontFamily: "'JetBrains Mono', monospace" }}>
            синхрон
            <span style={{ color: "#00C2A8" }}>_</span>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 16 }}>04 — Логотип со слоганом</div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 16, padding: "28px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M7 8l-4 4 4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8l4 4-4 4" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 16.5l6-9" stroke="#080C14" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>СИНХРОН</div>
          </div>
          <div style={{ fontSize: 12, color: "#5A6880", letterSpacing: "0.06em", textTransform: "uppercase", paddingLeft: 50, fontWeight: 500 }}>
            Код не спит. Пиши вместе.
          </div>
        </div>
      </div>
    </div>
  );
}
