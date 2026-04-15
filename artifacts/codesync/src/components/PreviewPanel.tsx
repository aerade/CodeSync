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
      html = html.replace(re, `<style>\n${f.content}\n</style>`);
    }
  }
  for (const f of files) {
    if (f.language === "javascript") {
      const re = new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*><\\/script>`, "gi");
      html = html.replace(re, `<script>\n${f.content}\n<\/script>`);
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

function getInitSize() {
  return {
    w: Math.min(1100, window.innerWidth * 0.82),
    h: Math.min(window.innerHeight * 0.85, 820),
  };
}

function getInitPos(w: number, h: number) {
  return {
    x: Math.max(0, (window.innerWidth - w) / 2),
    y: Math.max(0, (window.innerHeight - h) / 2 - 20),
  };
}

export function PreviewPanel({ files, isOpen, onClose, defaultPage }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [currentPage, setCurrentPage] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const savedSizeRef = useRef<{ w: number; h: number } | null>(null);
  const savedPosRef = useRef<{ x: number; y: number } | null>(null);

  const [size, setSize] = useState(getInitSize);
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const motionX = useMotionValue(getInitPos(size.w, size.h).x);
  const motionY = useMotionValue(getInitPos(size.w, size.h).y);

  // Re-center when opened
  useEffect(() => {
    if (isOpen) {
      const s = getInitSize();
      const p = getInitPos(s.w, s.h);
      setSize(s);
      sizeRef.current = s;
      motionX.set(p.x);
      motionY.set(p.y);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setIframeKey((k) => k + 1);
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
    setIframeKey((k) => k + 1);
    setIsLoading(true);
  }

  function goBack() {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    setHistoryIdx(idx);
    setCurrentPage(history[idx] ?? "");
    setIframeKey((k) => k + 1);
    setIsLoading(true);
  }

  function goForward() {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    setHistoryIdx(idx);
    setCurrentPage(history[idx] ?? "");
    setIframeKey((k) => k + 1);
    setIsLoading(true);
  }

  const refresh = useCallback(() => { setIframeKey((k) => k + 1); setIsLoading(true); }, []);

  function toggleMinimize() {
    if (isFullscreen) return; // can't minimize while fullscreen
    setIsMinimized((prev) => !prev);
  }

  function toggleFullscreen() {
    if (isMinimized) setIsMinimized(false);
    if (!isFullscreen) {
      savedSizeRef.current = { ...sizeRef.current };
      savedPosRef.current = { x: motionX.get(), y: motionY.get() };
      setIsFullscreen(true);
    } else {
      setIsFullscreen(false);
      if (savedSizeRef.current) {
        setSize(savedSizeRef.current);
        sizeRef.current = savedSizeRef.current;
      }
      if (savedPosRef.current) {
        motionX.set(savedPosRef.current.x);
        motionY.set(savedPosRef.current.y);
      }
    }
  }
  const srcDoc = buildSrcDoc(files, currentPage || undefined);
  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;

  // Resize logic — disables Framer drag while active
  const resizeState = useRef<{
    startMX: number; startMY: number;
    startW: number; startH: number;
    startPX: number; startPY: number;
    dir: string;
  } | null>(null);

  function startResize(e: React.PointerEvent, dir: string) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeState.current = {
      startMX: e.clientX,
      startMY: e.clientY,
      startW: sizeRef.current.w,
      startH: sizeRef.current.h,
      startPX: motionX.get(),
      startPY: motionY.get(),
      dir,
    };

    function onMove(me: PointerEvent) {
      if (!resizeState.current) return;
      const { startMX, startMY, startW, startH, startPX, startPY, dir: d } = resizeState.current;
      const dx = me.clientX - startMX;
      const dy = me.clientY - startMY;
      let nw = startW, nh = startH, nx = startPX, ny = startPY;

      if (d.includes("e")) nw = Math.max(MIN_W, startW + dx);
      if (d.includes("s")) nh = Math.max(MIN_H, startH + dy);
      if (d.includes("w")) {
        const delta = Math.min(dx, startW - MIN_W);
        nw = startW - delta;
        nx = startPX + delta;
      }
      if (d.includes("n")) {
        const delta = Math.min(dy, startH - MIN_H);
        nh = startH - delta;
        ny = startPY + delta;
      }

      sizeRef.current = { w: nw, h: nh };
      setSize({ w: nw, h: nh });
      motionX.set(nx);
      motionY.set(ny);
    }

    function onUp() {
      resizeState.current = null;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    document.body.style.userSelect = "none";
    const cursors: Record<string, string> = {
      e: "ew-resize", w: "ew-resize", n: "ns-resize", s: "ns-resize",
      ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
    };
    document.body.style.cursor = cursors[dir] ?? "nwse-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const rh = (cursor: string, style: React.CSSProperties, dir: string) => (
    <div
      onPointerDown={(e) => startResize(e, dir)}
      style={{ position: "absolute", zIndex: 20, cursor, ...style }}
    />
  );

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

          {/* Browser window */}
          <motion.div
            key="preview-window"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            drag={!isResizing && !isFullscreen}
            dragMomentum={false}
            dragElastic={0}
            style={{
              x: isFullscreen ? 0 : motionX,
              y: isFullscreen ? 0 : motionY,
              position: "fixed",
              top: 0,
              left: 0,
              width: isFullscreen ? "100vw" : size.w,
              height: isFullscreen ? "100vh" : isMinimized ? 40 : size.h,
              background: "#232529",
              border: isFullscreen ? "none" : "1px solid rgba(255,255,255,0.12)",
              borderRadius: isFullscreen ? 0 : 14,
              boxShadow: isFullscreen ? "none" : "0 0 0 1px rgba(0,0,0,0.5), 0 32px 80px rgba(0,0,0,0.85)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 9991,
              transition: "width 0.25s, height 0.25s, border-radius 0.25s",
            }}
          >
            {/* Resize handles — 8 directions */}
            {rh("ew-resize",   { top: 16, right: -5, bottom: 16, width: 10 }, "e")}
            {rh("ew-resize",   { top: 16, left: -5, bottom: 16, width: 10 }, "w")}
            {rh("ns-resize",   { bottom: -5, left: 16, right: 16, height: 10 }, "s")}
            {rh("ns-resize",   { top: -5, left: 16, right: 16, height: 10 }, "n")}
            {rh("nwse-resize", { bottom: -5, right: -5, width: 18, height: 18 }, "se")}
            {rh("nesw-resize", { bottom: -5, left: -5, width: 18, height: 18 }, "sw")}
            {rh("nesw-resize", { top: -5, right: -5, width: 18, height: 18 }, "ne")}
            {rh("nwse-resize", { top: -5, left: -5, width: 18, height: 18 }, "nw")}

            {/* Title bar (drag handle) */}
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
                cursor: isResizing ? "default" : "grab",
              }}
            >
              {/* Traffic lights */}
              <div style={{ display: "flex", gap: 7, marginRight: 2, flexShrink: 0 }}>
                <div onClick={onClose} title="Закрыть"
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#FF5F57", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div onClick={toggleMinimize} title={isMinimized ? "Развернуть" : "Свернуть"}
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#FEBC2E", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div onClick={toggleFullscreen} title={isFullscreen ? "Восстановить" : "На весь экран"}
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#28C840", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
              </div>

              {/* Navigation */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button onClick={goBack} disabled={!canBack}
                  style={{ background: "none", border: "none", cursor: canBack ? "pointer" : "default", color: canBack ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  ‹
                </button>
                <button onClick={goForward} disabled={!canForward}
                  style={{ background: "none", border: "none", cursor: canForward ? "pointer" : "default", color: canForward ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  ›
                </button>
                <button onClick={refresh}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  ↺
                </button>
              </div>

              {/* URL bar */}
              <div style={{ flex: 1, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, height: 26, display: "flex", alignItems: "center", padding: "0 10px", gap: 7 }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="rgba(255,255,255,0.35)">
                  <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1zM6 4.5a2 2 0 1 1 4 0V6H6V4.5z"/>
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentPage ? `file://${currentPage}` : "file://"}
                </span>
              </div>

              <button onClick={onClose}
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.5)", width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Page tabs (only if multiple HTML files) */}
            {htmlFiles.length > 1 && (
              <div style={{ height: 28, background: "#26292e", borderBottom: "1px solid rgba(0,0,0,0.3)", display: "flex", alignItems: "center", padding: "0 10px", gap: 3, flexShrink: 0 }}>
                {htmlFiles.map((f) => (
                  <button key={f.id} onClick={() => navigateTo(f.name)}
                    style={{
                      padding: "2px 10px", borderRadius: 5, fontSize: 11,
                      background: currentPage === f.name ? "rgba(255,255,255,0.12)" : "transparent",
                      color: currentPage === f.name ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                      border: currentPage === f.name ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                      cursor: "pointer", fontFamily: "JetBrains Mono, monospace",
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
                  initial={{ width: "0%" }}
                  animate={{ width: "85%" }}
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
                  key={iframeKey}
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
