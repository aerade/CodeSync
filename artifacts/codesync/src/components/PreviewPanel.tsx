import { useEffect, useRef, useState, useCallback } from "react";

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

function buildHtmlBlob(files: FileEntry[]): string {
  const htmlFile = files.find((f) => f.language === "html");
  if (!htmlFile) return "";

  let html = htmlFile.content;

  // Inline all CSS files that are referenced via <link href="filename.css">
  for (const f of files) {
    if (f.language !== "css") continue;
    const patterns = [
      new RegExp(`<link[^>]+href=["']${escapeRe(f.name)}["'][^>]*>`, "gi"),
      new RegExp(`<link[^>]+href=["']\\.\/${escapeRe(f.name)}["'][^>]*>`, "gi"),
    ];
    const styleTag = `<style>${f.content}</style>`;
    let replaced = false;
    for (const re of patterns) {
      if (re.test(html)) {
        html = html.replace(re, styleTag);
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      html = html.replace("</head>", `${styleTag}\n</head>`);
    }
  }

  // Inline all JS files that are referenced via <script src="filename.js">
  for (const f of files) {
    if (f.language !== "javascript") continue;
    const patterns = [
      new RegExp(`<script[^>]+src=["']${escapeRe(f.name)}["'][^>]*><\\/script>`, "gi"),
      new RegExp(`<script[^>]+src=["']\\.\/${escapeRe(f.name)}["'][^>]*><\\/script>`, "gi"),
    ];
    const scriptTag = `<script>${f.content}</script>`;
    let replaced = false;
    for (const re of patterns) {
      if (re.test(html)) {
        html = html.replace(re, scriptTag);
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      html = html.replace("</body>", `${scriptTag}\n</body>`);
    }
  }

  return html;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function PreviewPanel({ files, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevBlobRef = useRef<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  const refresh = useCallback(() => {
    setLastRefreshed(Date.now());
  }, []);

  useEffect(() => {
    const htmlFile = files.find((f) => f.language === "html");
    if (!htmlFile) {
      setError("Нет HTML-файла в комнате");
      setBlobUrl(null);
      return;
    }

    setError(null);
    const html = buildHtmlBlob(files);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
    }
    prevBlobRef.current = url;

    return () => {
      URL.revokeObjectURL(url);
      prevBlobRef.current = null;
    };
  }, [files, lastRefreshed]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#161B22" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3"
        style={{ height: 32, borderBottom: "1px solid #30363D", background: "#1C2128", flexShrink: 0 }}
      >
        <span className="text-xs font-medium" style={{ color: "#E6EDF3" }}>Превью</span>
        <span className="text-xs" style={{ color: "#8B949E" }}>
          {files.find((f) => f.language === "html")?.name ?? ""}
        </span>
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

      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ background: "#fff" }}>
        {error ? (
          <div className="flex items-center justify-center h-full" style={{ background: "#161B22" }}>
            <p className="text-xs" style={{ color: "#FF7B72" }}>{error}</p>
          </div>
        ) : blobUrl ? (
          <iframe
            ref={iframeRef}
            src={blobUrl}
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ background: "#161B22" }}>
            <p className="text-xs" style={{ color: "#8B949E" }}>Загрузка...</p>
          </div>
        )}
      </div>
    </div>
  );
}
