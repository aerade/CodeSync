import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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

  // Inline only explicitly referenced CSS files
  for (const f of files) {
    if (f.language === "css") {
      const re = new RegExp(`<link[^>]+href=["'](?:\\.\\/)?(${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*\\/?>`, "gi");
      if (re.test(html)) {
        html = html.replace(re, `<style>\n${f.content}\n</style>`);
      }
    }
  }

  // Inline only explicitly referenced JS files
  for (const f of files) {
    if (f.language === "javascript") {
      const re = new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*><\\/script>`, "gi");
      if (re.test(html)) {
        html = html.replace(re, `<script>\n${f.content}\n<\/script>`);
      }
    }
  }

  // Build VFS for images (data: URLs) and navigation between HTML pages
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

export function PreviewPanel({ files, isOpen, onClose, defaultPage }: Props) {
  const [key, setKey] = useState(0);
  const [currentPage, setCurrentPage] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      if (data?.type === "preview-navigate" && data.page) {
        navigateTo(data.page);
      }
    }
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [historyIdx, history]); // eslint-disable-line react-hooks/exhaustive-deps

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
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 10000, backdropFilter: "blur(6px)" }}
          />

          {/* Browser window */}
          <motion.div
            key="preview-window"
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              position: "fixed",
              top: "4vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(1280px, 96vw)",
              height: "90vh",
              background: "#232529",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 48px 120px rgba(0,0,0,0.9)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 10001,
            }}
          >
            {/* Title bar */}
            <div style={{
              display: "flex", alignItems: "center",
              height: 40,
              background: "linear-gradient(180deg, #3a3d42 0%, #2e3035 100%)",
              borderBottom: "1px solid rgba(0,0,0,0.4)",
              padding: "0 14px",
              gap: 10,
              flexShrink: 0,
              userSelect: "none",
            }}>
              {/* Traffic lights */}
              <div style={{ display: "flex", gap: 7, marginRight: 2, flexShrink: 0 }}>
                <div onClick={onClose} title="Закрыть"
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#FF5F57", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#FEBC2E", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
                <div onClick={refresh} title="Обновить"
                  style={{ width: 13, height: 13, borderRadius: "50%", background: "#28C840", cursor: "pointer", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.25)" }} />
              </div>

              {/* Nav buttons */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button onClick={goBack} disabled={!canBack} title="Назад"
                  style={{ background: "none", border: "none", cursor: canBack ? "pointer" : "default", color: canBack ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  ‹
                </button>
                <button onClick={goForward} disabled={!canForward} title="Вперёд"
                  style={{ background: "none", border: "none", cursor: canForward ? "pointer" : "default", color: canForward ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  ›
                </button>
                <button onClick={refresh} title="Обновить"
                  style={{ background: "none", border: "none", cursor: "pointer", color: isLoading ? "#58A6FF" : "rgba(255,255,255,0.6)", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "transform 0.3s", transform: isLoading ? "rotate(180deg)" : "rotate(0deg)" }}>
                  ↺
                </button>
              </div>

              {/* URL bar */}
              <div style={{
                flex: 1,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7,
                height: 26,
                display: "flex", alignItems: "center",
                padding: "0 10px",
                gap: 7,
              }}>
                {/* Lock icon */}
                <svg width="10" height="10" viewBox="0 0 16 16" fill="rgba(255,255,255,0.35)">
                  <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1zM6 4.5a2 2 0 1 1 4 0V6H6V4.5z"/>
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, system-ui, sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentPage ? `file://${currentPage}` : "file://index.html"}
                </span>
              </div>
            </div>

            {/* Toolbar row */}
            <div style={{
              height: 30,
              background: "#2a2d32",
              borderBottom: "1px solid rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 4,
              flexShrink: 0,
            }}>
              {/* File tab buttons */}
              {htmlFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigateTo(f.name)}
                  style={{
                    padding: "2px 10px",
                    borderRadius: 5,
                    fontSize: 11,
                    background: currentPage === f.name ? "rgba(255,255,255,0.12)" : "transparent",
                    color: currentPage === f.name ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                    border: currentPage === f.name ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                    cursor: "pointer",
                    fontFamily: "JetBrains Mono, monospace",
                    transition: "all 0.12s",
                  }}
                >
                  {f.name}
                </button>
              ))}
              {htmlFiles.length === 0 && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Нет HTML-файлов</span>
              )}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                Навигация работает через ссылки в коде
              </span>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflow: "hidden", background: "#fff", position: "relative" }}>
              {isLoading && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 10,
                  background: "linear-gradient(90deg, transparent, #58A6FF, #3FB950, transparent)",
                  animation: "progressBar 0.8s ease-in-out",
                }} />
              )}
              {!srcDoc ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#f5f5f5", gap: 10 }}>
                  <div style={{ fontSize: 40 }}>🌐</div>
                  <p style={{ fontSize: 14, color: "#555", fontWeight: 500 }}>Нет HTML-файлов</p>
                  <p style={{ fontSize: 12, color: "#888" }}>Создайте файл с расширением .html в комнате</p>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
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
