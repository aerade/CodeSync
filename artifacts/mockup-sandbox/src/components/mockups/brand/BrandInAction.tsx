import logoIcon from "@assets/image_1776235333066.png";

export function BrandInAction() {
  const users = [
    { name: "Алексей", color: "#00C2A8", file: "main.py", cursor: true },
    { name: "Маша",    color: "#4D9EFF", file: "utils.py", cursor: false },
    { name: "Денис",   color: "#FFA657", file: "main.py", cursor: false },
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
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Бренд в действии</div>
        <div style={{ fontSize: 13, color: "#5A6880", marginTop: 4 }}>Применение визуального стиля к реальному продукту</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28 }}>

        {/* IDE MOCKUP */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Интерфейс IDE — рабочая комната</div>
          <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 16, overflow: "hidden" }}>
            {/* Top bar */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E2D42", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={logoIcon} alt="" style={{ width: 12, height: 12, display: "block" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em" }}>СИНХРОН</span>
              <div style={{ width: 1, height: 14, background: "#1E2D42", margin: "0 4px" }} />
              <span style={{ fontSize: 12, color: "#5A6880" }}>CS301 — Алгоритмы и Структуры Данных</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: -6 }}>
                {users.map((u, i) => (
                  <div key={u.name} title={u.name} style={{ width: 24, height: 24, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#080C14", border: "2px solid #111826", marginLeft: i === 0 ? 0 : -8, zIndex: users.length - i }}>
                    {u.name[0]}
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "#5A6880", marginLeft: 10 }}>3 онлайн</div>
              </div>
            </div>

            {/* File tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1E2D42", padding: "0 14px" }}>
              {["main.py", "utils.py", "tests.py"].map((f, i) => (
                <div key={f} style={{ padding: "8px 14px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", borderBottom: i === 0 ? "2px solid #00C2A8" : "2px solid transparent", color: i === 0 ? "#E8EDF5" : "#5A6880", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {f}
                  {i === 0 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C2A8" }} />}
                  {i === 1 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4D9EFF" }} />}
                </div>
              ))}
            </div>

            {/* Code editor */}
            <div style={{ padding: "16px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7 }}>
              {[
                { n: 1,  code: <><span style={{color:"#5A6880"}}>{"# Сортировка слиянием"}</span></> },
                { n: 2,  code: <><span style={{color:"#4D9EFF"}}>def</span><span style={{color:"#E8EDF5"}}> </span><span style={{color:"#3FB950"}}>merge_sort</span><span style={{color:"#E8EDF5"}}>(arr):</span></> },
                { n: 3,  code: <><span style={{color:"#E8EDF5"}}>{"    "}</span><span style={{color:"#4D9EFF"}}>if</span><span style={{color:"#E8EDF5"}}> len(arr) </span><span style={{color:"#00C2A8"}}>{"<="}</span><span style={{color:"#E8EDF5"}}> </span><span style={{color:"#FFA657"}}>1</span><span style={{color:"#E8EDF5"}}>:</span></> },
                { n: 4,  code: <><span style={{color:"#E8EDF5"}}>{"        "}</span><span style={{color:"#4D9EFF"}}>return</span><span style={{color:"#E8EDF5"}}> arr</span></>, cursor: "Алексей", cursorColor: "#00C2A8" },
                { n: 5,  code: <></> },
                { n: 6,  code: <><span style={{color:"#E8EDF5"}}>{"    "}mid </span><span style={{color:"#00C2A8"}}>= </span><span style={{color:"#E8EDF5"}}>len(arr) </span><span style={{color:"#00C2A8"}}>//</span><span style={{color:"#FFA657"}}> 2</span></> },
                { n: 7,  code: <><span style={{color:"#E8EDF5"}}>{"    "}left </span><span style={{color:"#00C2A8"}}>=</span><span style={{color:"#E8EDF5"}}> merge_sort(arr[:mid])</span></> },
                { n: 8,  code: <><span style={{color:"#E8EDF5"}}>{"    "}right </span><span style={{color:"#00C2A8"}}>=</span><span style={{color:"#E8EDF5"}}> merge_sort(arr[mid:])</span></> },
                { n: 9,  code: <><span style={{color:"#E8EDF5"}}>{"    "}</span><span style={{color:"#4D9EFF"}}>return</span><span style={{color:"#E8EDF5"}}> merge(left, right)</span></>, cursor: "Денис", cursorColor: "#FFA657" },
              ].map((row: any) => (
                <div key={row.n} style={{ display: "flex", paddingLeft: 14, background: row.cursor ? "rgba(255,255,255,0.02)" : "transparent", position: "relative" }}>
                  <span style={{ width: 28, color: "#1E2D42", userSelect: "none", textAlign: "right", marginRight: 20, flexShrink: 0 }}>{row.n}</span>
                  <span style={{ flex: 1 }}>{row.code}</span>
                  {row.cursor && (
                    <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 9, background: row.cursorColor, color: "#080C14", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>{row.cursor}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Landing page header mockup */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Главная страница — Hero секция</div>
            <div style={{ background: "#080C14", border: "1px solid #1E2D42", borderRadius: 16, overflow: "hidden" }}>
              {/* Navbar */}
              <div style={{ padding: "14px 24px", borderBottom: "1px solid #1E2D42", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#00C2A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={logoIcon} alt="" style={{ width: 14, height: 14, display: "block" }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>СИНХРОН</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#5A6880" }}>Возможности</span>
                  <span style={{ fontSize: 12, color: "#5A6880" }}>Тарифы</span>
                  <div style={{ background: "#00C2A8", color: "#080C14", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 7 }}>Начать бесплатно</div>
                </div>
              </div>
              {/* Hero */}
              <div style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ display: "inline-block", background: "rgba(0,194,168,0.1)", border: "1px solid rgba(0,194,168,0.25)", borderRadius: 20, padding: "4px 14px", fontSize: 11, color: "#00C2A8", fontWeight: 600, marginBottom: 20, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  🚀 ИИ-помощник в каждой комнате
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14 }}>
                  Код не спит.<br/>
                  <span style={{ color: "#00C2A8" }}>Пиши вместе.</span>
                </div>
                <div style={{ fontSize: 14, color: "#5A6880", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Онлайн-IDE с совместным редактированием в реальном времени. Для студентов и команд.
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <div style={{ background: "#00C2A8", color: "#080C14", fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 9 }}>Открыть комнату</div>
                  <div style={{ border: "1px solid #1E2D42", color: "#E8EDF5", fontSize: 13, fontWeight: 600, padding: "10px 24px", borderRadius: 9 }}>Посмотреть демо</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Chat + Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Chat sidebar */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Чат комнаты</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #1E2D42", fontSize: 12, fontWeight: 700 }}>Чат · CS301</div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { user: "Алексей", color: "#00C2A8", msg: "Народ, давайте merge_sort сделаем через рекурсию?", time: "21:04" },
                  { user: "Маша", color: "#4D9EFF", msg: "Ок, я начала utils.py", time: "21:05" },
                  { user: "Денис", color: "#FFA657", msg: "Гляньте строку 9 — там база-кейс неправильный", time: "21:06" },
                ].map((m) => (
                  <div key={m.user} style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#080C14", flexShrink: 0 }}>{m.user[0]}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.user}</span>
                        <span style={{ fontSize: 9, color: "#5A6880", fontFamily: "'JetBrains Mono', monospace" }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#A8B4C8", lineHeight: 1.5, marginTop: 2 }}>{m.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid #1E2D42", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid #1E2D42", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#5A6880" }}>Написать…</div>
                <div style={{ width: 28, height: 28, background: "#00C2A8", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080C14" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* AI assistant pill */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>ИИ-помощник</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 14, padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(0,194,168,0.12)", border: "1px solid rgba(0,194,168,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C2A8" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#00C2A8" }}>ИИ · GPT-4.1</span>
              </div>
              <div style={{ fontSize: 11, color: "#A8B4C8", lineHeight: 1.6, background: "rgba(0,194,168,0.05)", border: "1px solid rgba(0,194,168,0.1)", borderRadius: 8, padding: "8px 10px" }}>
                В строке 4 при <span style={{ color: "#00C2A8", fontFamily: "'JetBrains Mono', monospace" }}>len(arr) {"<="} 1</span> код корректен. Рекомендую добавить проверку на пустой массив для надёжности.
              </div>
            </div>
          </div>

          {/* Invite card */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A6880", marginBottom: 14 }}>Приглашение в комнату</div>
            <div style={{ background: "#111826", border: "1px solid #1E2D42", borderRadius: 14, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>CS301 — Алгоритмы</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid #1E2D42", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#5A6880" }}>синхрон.app/r/cs301</div>
                <div style={{ background: "#00C2A8", color: "#080C14", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, cursor: "pointer" }}>Копировать</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
