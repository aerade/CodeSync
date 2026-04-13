import { useState, useCallback, useMemo, useEffect } from "react";
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSrcDoc(files: FileEntry[], entryName?: string): string | null {
  const htmlFiles = files.filter((f) => f.language === "html" && !f.name.endsWith(".txt"));
  if (htmlFiles.length === 0) return null;

  const htmlFile = entryName
    ? (htmlFiles.find((f) => f.name === entryName) ?? htmlFiles[0])
    : (htmlFiles.find((f) => f.name === "index.html") ?? htmlFiles[0]);

  let html = htmlFile.content;

  for (const f of files) {
    if (f.language === "css") {
      const styleTag = `<style>\n${f.content}\n</style>`;
      const re = new RegExp(`<link[^>]+href=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*\\/?>`, "gi");
      if (re.test(html)) html = html.replace(re, styleTag);
      else html = html.replace(/<\/head>/i, `${styleTag}\n</head>`);
    }
  }

  for (const f of files) {
    if (f.language === "javascript") {
      const scriptTag = `<script>\n${f.content}\n<\/script>`;
      const re = new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*><\\/script>`, "gi");
      if (re.test(html)) html = html.replace(re, scriptTag);
      else html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
    }
  }

  const imageFiles: Record<string, string> = {};
  for (const f of files) {
    if (f.language === "image" && f.content.startsWith("data:")) {
      imageFiles[f.name] = f.content;
    }
  }

  const allHtmlFiles: Record<string, string> = {};
  for (const f of htmlFiles) allHtmlFiles[f.name] = f.content;

  const vfsScript = `<script>
(function() {
  var _vfs = ${JSON.stringify(allHtmlFiles)};
  var _imgs = ${JSON.stringify(imageFiles)};
  Object.keys(_imgs).forEach(function(name) {
    document.querySelectorAll('img[src="' + name + '"]').forEach(function(img) {
      img.src = _imgs[name];
    });
  });
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('://') !== -1 || href.indexOf('mailto:') === 0) return;
    var filename = href.split('/').pop() || href;
    if (_vfs[filename] !== undefined) {
      e.preventDefault();
      window.parent.postMessage({ type: 'navigate', page: filename }, '*');
    }
  }, true);
  window.addEventListener('load', function() {
    Object.keys(_imgs).forEach(function(name) {
      document.querySelectorAll('img').forEach(function(img) {
        var src = img.getAttribute('src') || '';
        if (src === name || src.endsWith('/' + name)) {
          img.src = _imgs[name];
        }
      });
    });
  });
})();
<\/script>`;

  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${vfsScript}\n</body>`);
  else html += vfsScript;

  return html;
}

export function PreviewPanel({ files, isOpen, onClose, defaultPage }: Props) {
  const [key, setKey] = useState(0);
  const [currentPage, setCurrentPage] = useState<string | undefined>(undefined);

  const htmlFiles = useMemo(() => files.filter((f) => f.language === "html"), [files]);

  useEffect(() => {
    if (isOpen) {
      const page = defaultPage ?? htmlFiles.find((f) => f.name === "index.html")?.name ?? htmlFiles[0]?.name;
      setCurrentPage(page);
      setKey((k) => k + 1);
    }
  }, [isOpen, defaultPage, htmlFiles]);

  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      const data = e.data as { type?: string; page?: string };
      if (data?.type === "navigate" && data.page) {
        setCurrentPage(data.page);
        setKey((k) => k + 1);
      }
    }
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  const refresh = useCallback(() => setKey((k) => k + 1), []);
  const srcDoc = buildSrcDoc(files, currentPage);
  const displayName = currentPage ?? htmlFiles[0]?.name ?? "";

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
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 10000,
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Window */}
          <motion.div
            key="preview-window"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "fixed",
              top: "5vh", left: "50%",
              transform: "translateX(-50%)",
              width: "min(1000px, 92vw)",
              height: "88vh",
              background: "#161B22",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              zIndex: 10001,
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
              height: 44, background: "#1C2128",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}>
              {/* Traffic lights */}
              <div style={{ display: "flex", gap: 6, marginRight: 4, flexShrink: 0 }}>
                <div onClick={onClose} style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57", cursor: "pointer" }} />
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
                <div onClick={refresh} style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840", cursor: "pointer" }} title="Обновить" />
              </div>

              {/* Page tabs */}
              <div style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto" }}>
                {htmlFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setCurrentPage(f.name); setKey((k) => k + 1); }}
                    style={{
                      padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      background: displayName === f.name ? "rgba(255,255,255,0.1)" : "transparent",
                      color: displayName === f.name ? "#E6EDF3" : "rgba(255,255,255,0.45)",
                      border: displayName === f.name ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                      cursor: "pointer", whiteSpace: "nowrap",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              <button
                onClick={refresh}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 16, padding: "4px 6px", borderRadius: 6, lineHeight: 1, flexShrink: 0 }}
                title="Обновить"
                className="hover:text-white/70 transition-colors"
              >
                ↺
              </button>
              <button
                onClick={onClose}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18, padding: "4px 6px", borderRadius: 6, lineHeight: 1, flexShrink: 0 }}
                className="hover:text-white/70 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: "hidden", background: "#fff" }}>
              {!srcDoc ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "#161B22", gap: 10 }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Нет HTML-файла в комнате</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Создайте файл с расширением .html</p>
                </div>
              ) : (
                <iframe
                  key={key}
                  srcDoc={srcDoc}
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  style={{ width: "100%", height: "100%", border: "none" }}
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
