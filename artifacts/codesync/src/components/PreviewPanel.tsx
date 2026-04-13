import { useState, useCallback, useMemo } from "react";

interface FileEntry {
  id: string;
  name: string;
  language: string;
  content: string;
}

interface Props {
  files: FileEntry[];
  onClose: () => void;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSrcDoc(files: FileEntry[], entryName?: string): string | null {
  const htmlFiles = files.filter((f) => f.language === "html");
  if (htmlFiles.length === 0) return null;

  const htmlFile = entryName
    ? (htmlFiles.find((f) => f.name === entryName) ?? htmlFiles[0])
    : htmlFiles[0];

  let html = htmlFile.content;

  for (const f of files) {
    if (f.language !== "css") continue;
    const styleTag = `<style>\n${f.content}\n</style>`;
    const re = new RegExp(`<link[^>]+href=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*\\/?>`, "gi");
    if (re.test(html)) {
      html = html.replace(re, styleTag);
    } else {
      html = html.replace(/<\/head>/i, `${styleTag}\n</head>`);
    }
  }

  for (const f of files) {
    if (f.language !== "javascript") continue;
    const scriptTag = `<script>\n${f.content}\n<\/script>`;
    const re = new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*><\\/script>`, "gi");
    if (re.test(html)) {
      html = html.replace(re, scriptTag);
    } else {
      html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
    }
  }

  const allHtmlFiles = Object.fromEntries(htmlFiles.map((f) => [f.name, f.content]));
  const vfsScript = `<script>
(function() {
  var _vfs = ${JSON.stringify(allHtmlFiles)};
  function _buildPage(htmlContent, filename) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(htmlContent, 'text/html');
    doc.querySelectorAll('link[href]').forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (_vfs[href]) { link.remove(); }
    });
    doc.querySelectorAll('script[src]').forEach(function(s) {
      var src = s.getAttribute('src') || '';
      if (_vfs[src]) { s.remove(); }
    });
    return doc.documentElement.outerHTML;
  }
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('://') !== -1 || href.indexOf('mailto:') === 0) return;
    var filename = href.split('/').pop() || '';
    if (_vfs[filename] !== undefined) {
      e.preventDefault();
      document.open();
      document.write(_buildPage(_vfs[filename], filename));
      document.close();
    }
  }, true);
})();
<\/script>`;

  html = html.replace(/<\/body>/i, `${vfsScript}\n</body>`);
  if (!/<\/body>/i.test(html)) {
    html += vfsScript;
  }

  return html;
}

export function PreviewPanel({ files, onClose }: Props) {
  const [key, setKey] = useState(0);
  const [currentPage, setCurrentPage] = useState<string | undefined>(undefined);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  const htmlFiles = useMemo(() => files.filter((f) => f.language === "html"), [files]);

  const srcDoc = buildSrcDoc(files, currentPage);
  const displayName = currentPage ?? htmlFiles[0]?.name ?? "";

  return (
    <div className="flex flex-col h-full" style={{ background: "#161B22" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3"
        style={{ height: 36, borderBottom: "1px solid #30363D", background: "#1C2128", flexShrink: 0 }}
      >
        <span className="text-xs font-medium" style={{ color: "#E6EDF3" }}>Превью</span>

        {/* Page selector for multi-page */}
        {htmlFiles.length > 1 && (
          <div className="flex items-center gap-1 ml-1">
            {htmlFiles.map((f) => (
              <button
                key={f.id}
                onClick={() => { setCurrentPage(f.name); setKey((k) => k + 1); }}
                className="text-xs px-2 py-0.5 rounded transition-colors"
                style={{
                  color: displayName === f.name ? "#E6EDF3" : "#58A6FF",
                  background: displayName === f.name ? "rgba(255,255,255,0.08)" : "transparent",
                  border: displayName === f.name ? "1px solid rgba(255,255,255,0.12)" : "none",
                  cursor: "pointer",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {htmlFiles.length === 1 && (
          <span className="text-xs" style={{ color: "#8B949E" }}>{displayName}</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={refresh}
            className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "#58A6FF", border: "none", background: "transparent", cursor: "pointer" }}
            title="Обновить превью"
          >
            ↺ Обновить
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!srcDoc ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: "#161B22" }}>
            <p className="text-xs" style={{ color: "#8B949E" }}>Нет HTML-файла в комнате</p>
            <p className="text-xs" style={{ color: "#30363D" }}>Создайте файл с расширением .html</p>
          </div>
        ) : (
          <iframe
            key={key}
            srcDoc={srcDoc}
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
          />
        )}
      </div>
    </div>
  );
}
