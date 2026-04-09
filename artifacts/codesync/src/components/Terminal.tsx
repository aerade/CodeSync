import { useEffect, useRef, useState } from "react";
import { useExecuteCode } from "@workspace/api-client-react";

interface Props {
  code: string;
  language: string;
}

export function Terminal({ code, language }: Props) {
  const [output, setOutput] = useState<string[]>([]);
  const [stdin, setStdin] = useState("");
  const executeCode = useExecuteCode();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [output]);

  function handleRun() {
    if (!code) return;
    setOutput((prev) => [...prev, `> Запуск ${language}...`]);

    executeCode.mutate(
      { data: { code, language, stdin: stdin || undefined } },
      {
        onSuccess: (result: any) => {
          const lines: string[] = [];
          if (result.compileOutput) {
            lines.push("=== Компиляция ===");
            lines.push(result.compileOutput);
          }
          if (result.stdout) {
            lines.push(...result.stdout.split("\n").filter(Boolean));
          }
          if (result.stderr) {
            lines.push("=== Ошибки ===");
            lines.push(...result.stderr.split("\n").filter(Boolean));
          }
          if (result.exitCode !== 0) {
            lines.push(`Процесс завершён с кодом ${result.exitCode}`);
          }
          setOutput((prev) => [...prev, ...lines]);
        },
        onError: (err: any) => {
          setOutput((prev) => [...prev, `Ошибка: ${err.message}`]);
        },
      }
    );
  }

  function handleClear() {
    setOutput([]);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#0D1117" }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3"
        style={{
          height: 32,
          borderBottom: "1px solid #30363D",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8B949E" }}>
            Терминал
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#1C2128", color: "#8B949E", border: "1px solid #30363D" }}>
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="stdin..."
            className="text-xs outline-none px-2 py-0.5 rounded"
            style={{
              background: "#1C2128",
              border: "1px solid #30363D",
              color: "#8B949E",
              width: 120,
              fontFamily: "JetBrains Mono, monospace",
            }}
            data-testid="input-stdin"
          />
          <button
            onClick={handleClear}
            className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-white/5"
            style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
            data-testid="btn-clear-terminal"
          >
            Очистить
          </button>
          <button
            onClick={handleRun}
            disabled={!code || executeCode.isPending}
            className="text-xs px-3 py-0.5 rounded font-medium transition-colors"
            style={{
              background: code ? "#3FB950" : "#30363D",
              color: code ? "#0D1117" : "#8B949E",
              border: "none",
              cursor: code ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
            data-testid="btn-run-code"
          >
            {executeCode.isPending ? "Выполнение..." : "Выполнить"}
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3"
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 12,
          lineHeight: 1.6,
          color: "#3FB950",
        }}
      >
        {output.length === 0 ? (
          <span style={{ color: "#30363D" }}>// Нажмите «Выполнить» для запуска кода</span>
        ) : (
          output.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.startsWith("=== Ошибки") || line.startsWith("Ошибка:")
                  ? "#FF7B72"
                  : line.startsWith(">")
                  ? "#58A6FF"
                  : line.startsWith("Процесс завершён с кодом")
                  ? "#F2CC60"
                  : "#E6EDF3",
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
