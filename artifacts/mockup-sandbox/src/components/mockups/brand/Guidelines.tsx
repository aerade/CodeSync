export function Guidelines() {
  return (
    <div style={{
      fontFamily: "'Manrope', 'Inter', sans-serif",
      background: "#080C14",
      color: "#E8EDF5",
      minHeight: "100vh",
      padding: "48px 56px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Брендбук и Гайдлайны</div>
        <div style={{ fontSize: 13, color: "#5A6880", marginTop: 4 }}>Правила использования · Голос бренда · CSS-токены</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>

        {/* LEFT */}
        <div>
          {/* Color usage rules */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Правила использования цвета</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "✓", color: "#3FB950", text: "Бирюзовый — только для CTA, ключевых акцентов и иконки логотипа", label: "МОЖНО" },
                { icon: "✓", color: "#3FB950", text: "Синий (#4D9EFF) — для ссылок, кнопок второго уровня и активных вкладок", label: "МОЖНО" },
                { icon: "✗", color: "#FF7B72", text: "Не смешивайте бирюзу и синий на одном интерактивном элементе", label: "НЕЛЬЗЯ" },
                { icon: "✗", color: "#FF7B72", text: "Не использовать чистый белый (#FFF) как основной фон — только #080C14", label: "НЕЛЬЗЯ" },
                { icon: "✗", color: "#FF7B72", text: "Не добавлять яркие/насыщенные цвета вне утверждённой палитры", label: "НЕЛЬЗЯ" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", background: "#111826", border: "1px solid #1E2D42", borderRadius: 9, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, color: r.color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: r.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: "#A8B4C8", lineHeight: 1.5 }}>{r.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Voice & Tone — OFFICIAL */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Голос и тон бренда</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { word: "Профессиональный", desc: "Технический, без лишних слов" },
                  { word: "Точный", desc: "Каждое слово несёт смысл" },
                  { word: "Нейтральный", desc: "Без эмоций, без панибратства" },
                  { word: "Компетентный", desc: "Уверенный тон специалиста" },
                ].map((v) => (
                  <div key={v.word} style={{ padding: "10px 12px", background: "rgba(0,194,168,0.06)", border: "1px solid rgba(0,194,168,0.15)", borderRadius: 9 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#00C2A8", marginBottom: 3 }}>{v.word}</div>
                    <div style={{ fontSize: 10, color: "#5A6880", lineHeight: 1.4 }}>{v.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #1E2D42", paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5A6880", marginBottom: 10 }}>Правильно / Неправильно</div>
                {[
                  {
                    good: "Совместная разработка в реальном времени.",
                    bad: "Код не спит. Пиши вместе! 🚀"
                  },
                  {
                    good: "Работайте вместе в одной комнате. Курсоры и изменения видны мгновенно.",
                    bad: "Открой комнату — позови друга, будет весело!"
                  },
                  {
                    good: "Встроенный редактор Monaco с подсветкой синтаксиса и автодополнением.",
                    bad: "Тот же редактор что в VS Code 🔥"
                  },
                ].map((e, i) => (
                  <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid #1E2D42", borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: "#3FB950", fontWeight: 800, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: "#E8EDF5", lineHeight: 1.5 }}>{e.good}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#FF7B72", fontWeight: 800, flexShrink: 0 }}>✗</span>
                      <span style={{ fontSize: 11, color: "#5A6880", lineHeight: 1.5, textDecoration: "line-through" }}>{e.bad}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          {/* Typography hierarchy */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Иерархия типографики</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "20px" }}>
              {[
                { level: "Hero H1", size: "48–56px", weight: "800", font: "Manrope", usage: "Главный заголовок лендинга" },
                { level: "H2 Section", size: "32px", weight: "700", font: "Manrope", usage: "Разделы страниц" },
                { level: "H3 Card", size: "20px", weight: "600", font: "Manrope", usage: "Заголовки карточек, модалок" },
                { level: "Body", size: "14–15px", weight: "500", font: "Manrope", usage: "Основной текст UI" },
                { level: "Small / Meta", size: "12–13px", weight: "400", font: "Manrope", usage: "Метаданные, описания" },
                { level: "Caption", size: "10–11px", weight: "600/400", font: "Manrope", usage: "Лейблы, бейджи" },
                { level: "Code", size: "13px", weight: "400/700", font: "JetBrains Mono", usage: "Весь код и монотип" },
              ].map((t) => (
                <div key={t.level} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#00C2A8" }}>{t.level}</div>
                    <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>{t.size} · {t.weight}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#E8EDF5" }}>{t.usage}</div>
                    <div style={{ fontSize: 9, color: "#5A6880", marginTop: 1 }}>{t.font}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CSS Tokens */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>CSS-токены</div>
            <div style={{ background: "#0D1420", border: "1px solid #1E2D42", borderRadius: 12, padding: "16px 18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.9 }}>
              <div style={{ color: "#5A6880" }}>{"/* === СИНХРОН Brand Tokens === */"}</div>
              <div><span style={{ color: "#4D9EFF" }}>:root</span><span style={{ color: "#E8EDF5" }}> {"{"}</span></div>
              {[
                ["--bg",           "#080C14",  "Основной фон"],
                ["--surface",      "#111826",  "Карточки, панели"],
                ["--border",       "#1E2D42",  "Разделители"],
                ["--muted",        "#5A6880",  "Вспом. текст"],
                ["--text",         "#E8EDF5",  "Основной текст"],
                ["--accent",       "#00C2A8",  "Бирюза (CTA)"],
                ["--accent-blue",  "#4D9EFF",  "Синий (ссылки)"],
                ["--success",      "#3FB950",  "Успех/онлайн"],
                ["--warning",      "#FFA657",  "Предупреждение"],
                ["--danger",       "#FF7B72",  "Ошибка"],
                ["--font-ui",      "'Manrope'", "Интерфейс"],
                ["--font-code",    "'JetBrains Mono'", "Код"],
              ].map(([k, v, c]) => (
                <div key={k} style={{ paddingLeft: 18 }}>
                  <span style={{ color: "#00C2A8" }}>{k}</span>
                  <span style={{ color: "#E8EDF5" }}>: </span>
                  <span style={{ color: "#FFA657" }}>{v}</span>
                  <span style={{ color: "#E8EDF5" }}>; </span>
                  <span style={{ color: "#1E2D42" }}>{"/* "}{c}{" */"}</span>
                </div>
              ))}
              <div><span style={{ color: "#E8EDF5" }}>{"}"}</span></div>
            </div>
          </div>

          {/* Logo rules */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Охранная зона логотипа</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 12, padding: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Мин. отступ", desc: "Высота иконки × 0.5 с каждой стороны" },
                  { label: "Мин. размер", desc: "Иконка не меньше 20px, текст не меньше 14px" },
                  { label: "Не растягивать", desc: "Только пропорциональное масштабирование" },
                  { label: "Не менять цвет", desc: "Только цветной, белый или чёрный варианты" },
                ].map((r) => (
                  <div key={r.label} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid #1E2D42", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#E8EDF5", marginBottom: 3 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: "#5A6880", lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
