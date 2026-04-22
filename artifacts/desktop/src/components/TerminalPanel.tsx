import { useEffect, useRef, useState } from "react";
import { Play, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  roomId?: string;
  language?: string;
  code?: string;
}

interface Output {
  id: string;
  type: "stdout" | "stderr" | "info" | "command";
  text: string;
  ts: Date;
}

export function TerminalPanel({ roomId, language, code }: Props) {
  const [history, setHistory] = useState<Output[]>([
    { id: "welcome", type: "info", text: "Terminal ready. Run code to see output.", ts: new Date() },
  ]);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  async function runCode() {
    if (!code || !language || running) return;
    setRunning(true);

    const id = Date.now().toString();
    setHistory((prev) => [
      ...prev,
      { id: `cmd-${id}`, type: "command", text: `$ run ${language}`, ts: new Date() },
    ]);

    try {
      const result = await api.executeCode({ language, code, roomId });
      if (result.stdout) {
        setHistory((prev) => [...prev, { id: `out-${id}`, type: "stdout", text: result.stdout, ts: new Date() }]);
      }
      if (result.stderr) {
        setHistory((prev) => [...prev, { id: `err-${id}`, type: "stderr", text: result.stderr, ts: new Date() }]);
      }
      setHistory((prev) => [
        ...prev,
        {
          id: `exit-${id}`,
          type: result.exitCode === 0 ? "info" : "stderr",
          text: `Exit code: ${result.exitCode} | ${result.runtime.toFixed(2)}ms`,
          ts: new Date(),
        },
      ]);
    } catch (err: any) {
      setHistory((prev) => [...prev, { id: `fail-${id}`, type: "stderr", text: `Error: ${err.message}`, ts: new Date() }]);
    } finally {
      setRunning(false);
    }
  }

  const textColor = (type: Output["type"]) => {
    if (type === "stderr") return "#EF4444";
    if (type === "command") return "#7C6FF7";
    if (type === "info") return "#7A7A8A";
    return "#E2E8F0";
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "#0C0C0E", fontFamily: "'Geist Mono', monospace" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={runCode}
          disabled={running || !code}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50 transition-all hover:opacity-80"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          Run
        </button>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{language}</span>
        <button
          onClick={() => setHistory([{ id: "clear", type: "info", text: "Terminal cleared.", ts: new Date() }])}
          className="ml-auto p-1 rounded hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
          title="Clear"
        >
          <X size={11} />
        </button>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {history.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-xs shrink-0 mt-0.5" style={{ color: "#3A3A46", fontFamily: "inherit" }}>
              {item.ts.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
            <pre
              className="text-xs flex-1 whitespace-pre-wrap break-all leading-relaxed"
              style={{ color: textColor(item.type), fontFamily: "inherit" }}
            >
              {item.text}
            </pre>
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 mt-1">
            <Loader2 size={10} className="animate-spin" style={{ color: "var(--primary)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Running...</span>
          </div>
        )}
      </div>
    </div>
  );
}
