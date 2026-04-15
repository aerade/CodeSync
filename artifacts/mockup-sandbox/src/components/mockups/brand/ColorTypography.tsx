import logoIcon from "@assets/image_1776235333066.png";

export function ColorTypography() {
  const palette = [
    { name: "Фон",         hex: "#080C14", oklch: "oklch(9% 0.015 250)",  role: "Основной фон" },
    { name: "Поверхность", hex: "#111826", oklch: "oklch(13% 0.018 250)", role: "Карточки, панели" },
    { name: "Граница",     hex: "#1E2D42", oklch: "oklch(20% 0.025 250)", role: "Разделители" },
    { name: "Muted",       hex: "#5A6880", oklch: "oklch(45% 0.03 250)",  role: "Вспомогательный текст" },
    { name: "Текст",       hex: "#E8EDF5", oklch: "oklch(93% 0.008 250)", role: "Основной текст" },
  ];

  const accents = [
    { name: "Бирюза",     hex: "#00C2A8", oklch: "oklch(73% 0.13 185)",  role: "Основной акцент, CTA" },
    { name: "Синий",      hex: "#4D9EFF", oklch: "oklch(65% 0.15 240)",  role: "Ссылки, кнопки" },
    { name: "Зелёный",    hex: "#3FB950", oklch: "oklch(68% 0.16 145)",  role: "Успех, онлайн-статус" },
    { name: "Оранжевый",  hex: "#FFA657", oklch: "oklch(76% 0.16 60)",   role: "Предупреждения" },
    { name: "Красный",    hex: "#FF7B72", oklch: "oklch(68% 0.17 22)",   role: "Ошибки, удаление" },
  ];

  const tealShades = [
    { label: "50",  hex: "#E0FAF6" },
    { label: "100", hex: "#ADEFEA" },
    { label: "200", hex: "#5EE0D6" },
    { label: "300", hex: "#00C9BD" },
    { label: "400", hex: "#00C2A8" },
    { label: "500", hex: "#00A892" },
    { label: "600", hex: "#008A78" },
    { label: "700", hex: "#006B5E" },
    { label: "800", hex: "#004D44" },
    { label: "900", hex: "#002E29" },
  ];

  const contrasts = [
    { fg: "#E8EDF5", bg: "#080C14", ratio: "14.2:1", pass: true, label: "Текст на фоне" },
    { fg: "#E8EDF5", bg: "#111826", ratio: "11.8:1", pass: true, label: "Текст на карточке" },
    { fg: "#00C2A8", bg: "#080C14", ratio: "7.4:1",  pass: true, label: "Акцент на фоне" },
    { fg: "#4D9EFF", bg: "#080C14", ratio: "6.1:1",  pass: true, label: "Синий на фоне" },
    { fg: "#5A6880", bg: "#080C14", ratio: "3.9:1",  pass: true, label: "Muted на фоне (large)" },
  ];

  return (
    <div style={{
      fontFamily: "'Manrope', 'Inter', sans-serif",
      background: "#080C14",
      color: "#E8EDF5",
      minHeight: "100vh",
      padding: "48px 56px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={logoIcon} alt="" style={{ width: 18, height: 18, display: "block" }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>СИНХРОН</span>
          <span style={{ fontSize: 11, color: "#5A6880", fontFamily: "'JetBrains Mono', monospace", marginLeft: 4, background: "#111826", border: "1px solid #1E2D42", borderRadius: 4, padding: "2px 8px" }}>Брендбук v1.0</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Цвета и Типографика</div>
        <div style={{ fontSize: 13, color: "#5A6880", marginTop: 6 }}>Палитра · Шкалы · Контраст WCAG · Шрифты</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* LEFT COLUMN */}
        <div>
          {/* Base Palette */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Базовая палитра</div>
            {palette.map((c) => (
              <div key={c.hex} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, padding: "10px 14px", background: "#111826", border: "1px solid #1E2D42", borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: c.hex, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF5" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "#5A6880", fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{c.hex}</div>
                </div>
                <div style={{ fontSize: 10, color: "#5A6880", textAlign: "right", maxWidth: 100 }}>{c.role}</div>
              </div>
            ))}
          </div>

          {/* Accent Palette */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Акцентные цвета</div>
            {accents.map((c) => (
              <div key={c.hex} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, padding: "10px 14px", background: "#111826", border: "1px solid #1E2D42", borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: c.hex, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF5" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "#5A6880", fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{c.hex}</div>
                </div>
                <div style={{ fontSize: 10, color: "#5A6880", textAlign: "right", maxWidth: 100 }}>{c.role}</div>
              </div>
            ))}
          </div>

          {/* Contrast audit */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Аудит контраста WCAG 2.2</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "8px 14px", borderBottom: "1px solid #1E2D42", gap: 12 }}>
                <div style={{ fontSize: 10, color: "#5A6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Пара</div>
                <div style={{ fontSize: 10, color: "#5A6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ratio</div>
                <div style={{ fontSize: 10, color: "#5A6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>AA</div>
              </div>
              {contrasts.map((c) => (
                <div key={c.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 14, borderRadius: 4, background: c.bg, border: "1px solid #1E2D42", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c.fg }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#E8EDF5" }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#E8EDF5" }}>{c.ratio}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.pass ? "#3FB950" : "#FF7B72" }}>
                    {c.pass ? "✓ AA" : "✗"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Teal shade ramp */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Шкала акцента (бирюза)</div>
            <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid #1E2D42" }}>
              {tealShades.map((s) => (
                <div key={s.label} style={{ flex: 1, background: s.hex, height: 56, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 0 6px 4px" }}>
                  <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: parseInt(s.label) >= 500 ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)", fontWeight: 700 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 6, gap: 0 }}>
              {tealShades.map((s) => (
                <div key={s.label} style={{ flex: 1, fontSize: 8, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880", textAlign: "center" }}>{s.hex.slice(1)}</div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Типографика</div>

            {/* Manrope display */}
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px 20px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#00C2A8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Manrope — Заголовки</div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#E8EDF5", marginBottom: 4 }}>Пиши вместе.</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#E8EDF5", marginBottom: 4 }}>Совместный код</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#E8EDF5", marginBottom: 4 }}>Открой комнату</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#A8B4C8", marginBottom: 4 }}>Пригласи команду</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#5A6880", marginTop: 12, borderTop: "1px solid #1E2D42", paddingTop: 12 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5A6880" }}>
                  800 · 700 · 600 · 500 · 400 · import Manrope from Google Fonts
                </span>
              </div>
            </div>

            {/* JetBrains Mono code */}
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#4D9EFF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>JetBrains Mono — Код и данные</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ fontSize: 13, color: "#5A6880" }}>{"// collaborative session"}</div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "#4D9EFF" }}>const</span>
                  <span style={{ color: "#E8EDF5" }}> room </span>
                  <span style={{ color: "#00C2A8" }}>=</span>
                  <span style={{ color: "#E8EDF5" }}> синхрон</span>
                  <span style={{ color: "#00C2A8" }}>.</span>
                  <span style={{ color: "#4D9EFF" }}>join</span>
                  <span style={{ color: "#E8EDF5" }}>(</span>
                  <span style={{ color: "#FFA657" }}>"CS301"</span>
                  <span style={{ color: "#E8EDF5" }}>);</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "#4D9EFF" }}>room</span>
                  <span style={{ color: "#00C2A8" }}>.</span>
                  <span style={{ color: "#3FB950" }}>invite</span>
                  <span style={{ color: "#E8EDF5" }}>(</span>
                  <span style={{ color: "#FFA657" }}>"team"</span>
                  <span style={{ color: "#E8EDF5" }}>);</span>
                </div>
              </div>
              <div style={{ marginTop: 12, borderTop: "1px solid #1E2D42", paddingTop: 12, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>
                Все IDE-интерфейсы · Коды ошибок · Монотип
              </div>
            </div>

            {/* Type scale */}
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#5A6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Шкала шрифтов</div>
              {[
                { size: "48px", weight: "800", label: "Hero / H1" },
                { size: "32px", weight: "700", label: "H2 / Section" },
                { size: "20px", weight: "600", label: "H3 / Card title" },
                { size: "15px", weight: "500", label: "Body / Default" },
                { size: "13px", weight: "400", label: "Small / Meta" },
                { size: "11px", weight: "400", label: "Caption / Label" },
              ].map((t) => (
                <div key={t.size} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: Number(t.size.replace("px","")), fontWeight: Number(t.weight), color: "#E8EDF5", lineHeight: 1.3 }}>Синхрон</span>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>{t.size} / {t.weight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
