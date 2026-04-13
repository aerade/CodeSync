import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";

interface FileEntry {
  id: string;
  name: string;
  language: string;
  content: string;
}

interface Props {
  files: FileEntry[];
  isOpen: boolean;
  onClose: () => void;
  defaultPage?: string;
}

function buildSrcDoc(files: FileEntry[], entryName?: string): string | null {
  const htmlFiles = files.filter((f) => f.language === "html");
  if (htmlFiles.length === 0) return null;

  const htmlFile = entryName
    ? (htmlFiles.find((f) => f.name === entryName) ?? htmlFiles[0])
    : (htmlFiles.find((f) => f.name === "index.html") ?? htmlFiles[0]);

  let html = htmlFile.content;

  for (const f of files) {
    if (f.language === "css") {
      const re = new RegExp(`<link[^>]+href=["'](?:\\.\\/)?(${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*\\/?>`, "gi");
      if (re.test(html)) html = html.replace(re, `<style>\n${f.content}\n</style>`);
    }
  }

  for (const f of files) {
    if (f.language === "javascript") {
      const re = new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*><\\/script>`, "gi");
      if (re.test(html)) html = html.replace(re, `<script>\n${f.content}\n<\/script>`);
    }
  }

  const imageVfs: Record<string, string> = {};
  for (const f of files) {
    if (f.language === "image" && f.content.startsWith("data:")) imageVfs[f.name] = f.content;
  }
  const htmlNames = htmlFiles.map((f) => f.name);

  const vfsScript = `<script>
(function() {
  var _imgs = ${JSON.stringify(imageVfs)};
  var _pages = ${JSON.stringify(htmlNames)};
  function resolveImages() {
    document.querySelectorAll('img').forEach(function(img) {
      var src = img.getAttribute('src') || '';
      var name = src.split('/').pop();
      if (name && _imgs[name]) img.src = _imgs[name];
    });
  }
  resolveImages();
  document.addEventListener('DOMContentLoaded', resolveImages);
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('://') !== -1 || href.indexOf('mailto:') === 0) return;
    var filename = href.split('/').pop() || href;
    if (_pages.indexOf(filename) !== -1) {
      e.preventDefault();
      window.parent.postMessage({ type: 'preview-navigate', page: filename }, '*');
    }
  }, true);
})();
<\/script>`;

  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${vfsScript}\n</body>`);
  else html += vfsScript;
  return html;
}

const MIN_W = 480;
const MIN_H = 320;
const INIT_W = Math.min(1100, typeof window !== "undefined" ? window.innerWidth * 0.82 : 1100);
const INIT_H = typeof window !== "undefined" ? Math.min(window.innerHeight * 0.85, 820) : 700;

export function PreviewPanel({ files, isOpen, onClose, defaultPage }: Props) {
  const [key, setKey] = useState(0);
  const [currentPage, setCurrentPage] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({ w: INIT_W, h: INIT_H });
  const sizeRef = useRef(size);

  // Motion values for drag position — initialized to center
  const centerX = typeof window !== "undefined" ? (window.innerWidth - INIT_W) / 2 : 0;
  const centerY = typeof window !== "undefined" ? (window.innerHeight - INIT_H) / 2 - 20 : 0;
  const motionX = useMotionValue(centerX);
  const motionY = useMotionValue(centerY);

  // Re-center when opened
  useEffect(() => {
    if (isOpen) {
      const cx = (window.innerWidth - sizeRef.current.w) / 2;
      const cy = (window.innerHeight - sizeRef.current.h) / 2 - 20;
      motionX.set(cx);
      motionY.set(cy);
    }
  }, [isOpen, motionX, motionY]);

  const htmlFiles = useMemo(() => files.filter((f) => f.language === "html"), [files]);

  const startPage = useMemo(() => {
    if (defaultPage) return defaultPage;
    return htmlFiles.find((f) => f.name === "index.html")?.name ?? htmlFiles[0]?.name ?? "";
  }, [defaultPage, htmlFiles]);

  useEffect(() => {
    if (isOpen && startPage) {
      setCurrentPage(startPage);
      setHistory([startPage]);
      setHistoryIdx(0);
      setKey((k) => k + 1);
    }
  }, [isOpen, startPage]);

  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      const data = e.data as { type?: string; page?: string };
      if (data?.type === "preview-navigate" && data.page) navigateTo(data.page);
    }
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  });

  function navigateTo(page: string) {
    setCurrentPage(page);
    setHistory((prev) => {
      const next = prev.slice(0, historyIdx + 1);
      next.push(page);
      setHistoryIdx(next.length - 1);
      return next;
    });
    setKey((k) => k + 1);
    setIsLoading(true);
  }

  function goBack() {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    setHistoryIdx(idx);
    setCurrentPage(history[idx] ?? "");
    setKey((k) => k + 1);
    setIsLoading(true);
  }

  function goForward() {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    setHistoryIdx(idx);
    setCurrentPage(history[idx] ?? "");
    setKey((k) => k + 1);
    setIsLoading(true);
  }

  const refresh = useCallback(() => { setKey((k) => k + 1); setIsLoading(true); }, []);
  const srcDoc = buildSrcDoc(files, currentPage || undefined);
  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;

  // Resize state
  const resizeRef = useRef<{
    startX: number; startY: number;
    startW: number; startH: number;
    dir: string;
  } | null>(null);

  function startResize(e: React.MouseEvent, dir: string) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: sizeRef.current.w,
      startH: sizeRef.current.h,
      dir,
    };
    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startY, startW, startH, dir } = resizeRef.current;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      let nw = startW, nh = startH;
      if (dir.includes("e")) nw = Math.max(MIN_W, startW + dx);
      if (dir.includes("s")) nh = Math.max(MIN_H, startH + dy);
      if (dir.includes("w")) {
        nw = Math.max(MIN_W, startW - dx);
        motionX.set(motionX.get() + dx);
      }
      if (dir.includes("n")) {
        nh = Math.max(MIN_H, startH - dy);
        motionY.set(motionY.get() + dy);
      }
      sizeRef.current = { w: nw, h: nh };
      setSize({ w: nw, h: nh });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const resizeHandleStyle = (cursor: string, style: React.CSSProperties): React.CSSProperties => ({
    position: "absolute", zIndex: 10, cursor, ...style,
  });

  const popup = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9990, backdropFilter: "blur(4px)" }}
          />

          {/* Browser window — draggable + resizable */}
          <motion.div
            key="preview-window"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{
              top: -centerY + 8,
              left: -centerX + 8,
              right: typeof window !== "undefined" ? window.innerWidth - centerX - size.w - 8 : 800,
              bottom: typeof window !== "undefined" ? window.innerHeight - centerY - size.h - 8 : 600,
            }}
            style={{
              x: motionX,
              y: motionY,
              position: "fixed",
              top: 0,
              left: 0,
              width: size.w,
              height: size.h,
              background: "#232529",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 32px 80px rgba(0,0,0,0.85)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 9991,
              cursor: "default",
            }}
          >
            {/* Resize handles */}
            <div onMouseDown={(e) => startResize(e, "e")} style={resizeHandleStyle("ew-resize", { top: 20, right: -4, bottom: 20, width: 8 })} />
            <div onMouseDown={(e) => startResize(e, "w")} style={resizeHandleStyle("ew-resize", { top: 20, left: -4, bottom: 20, width: 8 })} />
            <div onMouseDown={(e) => startResize(e, "s")} style={resizeHandleStyle("ns-resize", { bottom: -4, left: 20, right: 20, height: 8 })} />
            <div onMouseDown={(e) => startResize(e, "n")} style={resizeHandleStyle("ns-resize", { top: -4, left: 20, right: 20, height: 8 })} />
            <div onMouseDown={(e) => startResize(e, "se")} style={resizeHandleStyle("nwse-resize", { bottom: -4, right: -4, width: 16, height: 16 })} />
            <div onMouseDown={(e) => startResize(e, "sw")} style={resizeHandleStyle("nesw-resize", { bottom: -4, left: -4, width: 16, height: 16 })} />
            <div onMouseDown={(e) => startResize(e, "ne")} style={resizeHandleStyle("nesw-resize", { top: -4, right: -4, width: 16, height: 16 })} />
            <div onMouseDown={(e) => startResize(e, "nw")} style={resizeHandleStyle("nwse-resize", { top: -4, left: -4, width: 16, height: 16 })} />

            {/* Title bar — drag handle */}
            <div
              style={{
                display: "flex", alignItems: "center",
                height: 40,
                background: "linear-gradient(180deg, #3a3d42 0%, #2e3035 100%)",
                borderBottom: "1px solid rgba(0,0,0,0.4)",
                padding: "0 14px",
                gap: 10,
                flexShrink: 0,
                userSelect: "none",
                cursor: "grab",
              }}
              onPointerDown={() => {}}
            >
              <div style={{ display: "flex", gap: 7, marginRight: 2, flexShrink: 0 }}>
                <div onClick={onClose} title="Закрыть"
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#FF5F57", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#FEBC2E", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div onClick={refresh} title="Обновить"
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#28C840", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
              </div>

              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button onClick={goBack} disabled={!canBack}
                  style={{ background: "none", border: "none", cursor: canBack ? "pointer" : "default", color: canBack ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1 }}>
                  ‹
                </button>
                <button onClick={goForward} disabled={!canForward}
                  style={{ background: "none", border: "none", cursor: canForward ? "pointer" : "default", color: canForward ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1 }}>
                  ›
                </button>
                <button onClick={refresh}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "transform 0.3s", transform: isLoading ? "rotate(360deg)" : "rotate(0deg)" }}>
                  ↺
                </button>
              </div>

              {/* URL bar */}
              <div style={{
                flex: 1,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, height: 26,
                display: "flex", alignItems: "center",
                padding: "0 10px", gap: 7,
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="rgba(255,255,255,0.35)">
                  <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1zM6 4.5a2 2 0 1 1 4 0V6H6V4.5z"/>
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentPage ? `file://${currentPage}` : "file://"}
                </span>
              </div>

              <button onClick={onClose}
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.5)", width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>

            {/* Page tabs bar */}
            {htmlFiles.length > 1 && (
              <div style={{
                height: 28, background: "#26292e",
                borderBottom: "1px solid rgba(0,0,0,0.3)",
                display: "flex", alignItems: "center",
                padding: "0 10px", gap: 3, flexShrink: 0,
              }}>
                {htmlFiles.map((f) => (
                  <button key={f.id} onClick={() => navigateTo(f.name)}
                    style={{
                      padding: "2px 10px", borderRadius: 5, fontSize: 11,
                      background: currentPage === f.name ? "rgba(255,255,255,0.12)" : "transparent",
                      color: currentPage === f.name ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                      border: currentPage === f.name ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                      cursor: "pointer", fontFamily: "JetBrains Mono, monospace", transition: "all 0.12s",
                    }}>
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {isLoading && (
              <div style={{ height: 2, background: "#161B22", flexShrink: 0 }}>
                <motion.div
                  initial={{ width: "0%", opacity: 1 }}
                  animate={{ width: "85%", opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg, #58A6FF, #3FB950)" }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflow: "hidden", background: "#fff" }}>
              {!srcDoc ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#f5f5f5", gap: 10 }}>
                  <div style={{ fontSize: 40 }}>🌐</div>
                  <p style={{ fontSize: 14, color: "#555", fontWeight: 500 }}>Нет HTML-файлов</p>
                  <p style={{ fontSize: 12, color: "#888" }}>Создайте файл с расширением .html</p>
                </div>
              ) : (
                <iframe
                  key={key}
                  srcDoc={srcDoc}
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  style={{ width: "100%", height: "100%", border: "none" }}
                  onLoad={() => setIsLoading(false)}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(popup, document.body);
}
