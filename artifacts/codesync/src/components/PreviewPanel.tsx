import { useState, useCallback } from "react";

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

function buildSrcDoc(files: FileEntry[]): string | null {
  const htmlFile = files.find((f) => f.language === "html");
  if (!htmlFile) return null;

  let html = htmlFile.content;

  for (const f of files) {
    if (f.language !== "css") continue;
    const styleTag = `<style>\n${f.content}\n</style>`;
    const patterns = [
      new RegExp(`<link[^>]+href=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*\\/?>`, "gi"),
    ];
    let replaced = false;
    for (const re of patterns) {
      if (re.test(html)) {
        html = html.replace(re, styleTag);
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      html = html.replace(/<\/head>/i, `${styleTag}\n</head>`);
    }
  }

  for (const f of files) {
    if (f.language !== "javascript") continue;
    const scriptTag = `<script>\n${f.content}\n</script>`;
    const patterns = [
      new RegExp(`<script[^>]+src=["'](?:\\.\\/)?(${escapeRe(f.name)})["'][^>]*><\\/script>`, "gi"),
    ];
    let replaced = false;
    for (const re of patterns) {
      if (re.test(html)) {
        html = html.replace(re, scriptTag);
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
    }
  }

  return html;
}

export function PreviewPanel({ files, onClose }: Props) {
  const [key, setKey] = useState(0);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  const srcDoc = buildSrcDoc(files);
  const htmlName = files.find((f) => f.language === "html")?.name ?? "";

  return (
    <div className="flex flex-col h-full" style={{ background: "#161B22" }}>
      <div
        className="flex items-center gap-2 px-3"
        style={{ height: 32, borderBottom: "1px solid #30363D", background: "#1C2128", flexShrink: 0 }}
      >
        <span className="text-xs font-medium" style={{ color: "#E6EDF3" }}>Превью</span>
        <span className="text-xs" style={{ color: "#8B949E" }}>{htmlName}</span>
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
          <div className="flex items-center justify-center h-full" style={{ background: "#161B22" }}>
            <p className="text-xs" style={{ color: "#FF7B72" }}>Нет HTML-файла в комнате</p>
          </div>
        ) : (
          <iframe
            key={key}
            srcDoc={srcDoc}
            title="Preview"
            sandbox="allow-scripts"
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
          />
        )}
      </div>
    </div>
  );
}
