import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useExecuteCode } from "@workspace/api-client-react";

interface Props {
  code: string;
  language: string;
}

interface ExecuteResult {
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  exitCode?: number;
  isHtml?: boolean;
}

export interface TerminalHandle {
  run: () => void;
}

export const Terminal = forwardRef<TerminalHandle, Props>(function Terminal({ code, language }, ref) {
  const [output, setOutput] = useState<string[]>([]);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [stdin, setStdin] = useState("");
  const executeCode = useExecuteCode();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [output]);

  const handleRun = useCallback(() => {
    if (!code) return;
    setHtmlPreview(null);

    if (language === "html") {
      setHtmlPreview(code);
      setOutput((prev) => [...prev, "> HTML-превью обновлено"]);
      return;
    }

    setOutput((prev) => [...prev, `> Запуск ${language}...`]);

    executeCode.mutate(
      { data: { code, language, stdin: stdin || undefined } },
      {
        onSuccess: (result) => {
          const typed = result as ExecuteResult;
          const lines: string[] = [];
          if (typed.compileOutput) {
            lines.push("=== Компиляция ===");
            lines.push(typed.compileOutput);
          }
          if (typed.stdout) {
            lines.push(...typed.stdout.split("\n").filter(Boolean));
          }
          if (typed.stderr) {
            lines.push("=== Ошибки ===");
            lines.push(...typed.stderr.split("\n").filter(Boolean));
          }
          if (typeof typed.exitCode === "number" && typed.exitCode !== 0) {
            lines.push(`Процесс завершён с кодом ${typed.exitCode}`);
          }
          if (lines.length === 0) {
            lines.push("(нет вывода)");
          }
          setOutput((prev) => [...prev, ...lines]);
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : String(err);
          setOutput((prev) => [...prev, `Ошибка: ${message}`]);
        },
      }
    );
  }, [code, language, stdin, executeCode]);

  useImperativeHandle(ref, () => ({ run: handleRun }), [handleRun]);

  function handleClear() {
    setOutput([]);
    setHtmlPreview(null);
  }

  const SUPPORTED_EXEC_LANGS = ["javascript", "typescript", "python", "c", "cpp", "bash", "shell", "html"];
  const canExecute = SUPPORTED_EXEC_LANGS.includes(language);

  return (
    <div className="flex flex-col h-full" style={{ background: "#0D1117" }}>
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
          {language !== "html" && (
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
          )}
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
            disabled={!code || executeCode.isPending || !canExecute}
            className="text-xs px-3 py-0.5 rounded font-medium transition-colors"
            style={{
              background: code && canExecute ? "#3FB950" : "#30363D",
              color: code && canExecute ? "#0D1117" : "#8B949E",
              border: "none",
              cursor: code && canExecute ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
            data-testid="btn-run-code"
          >
            {executeCode.isPending ? "Выполнение..." : language === "html" ? "Превью" : "Выполнить"}
          </button>
        </div>
      </div>

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
        {htmlPreview ? (
          <iframe
            srcDoc={htmlPreview}
            sandbox="allow-scripts"
            style={{
              width: "100%",
              height: "100%",
              minHeight: 200,
              background: "#fff",
              borderRadius: 4,
              border: "1px solid #30363D",
            }}
            title="HTML Preview"
          />
        ) : output.length === 0 ? (
          <span style={{ color: "#30363D" }}>
            {canExecute
              ? "// Нажмите «Выполнить» для запуска кода"
              : `// Выполнение для "${language}" недоступно`}
          </span>
        ) : (
          output.map((line, i) => (
            <div
              key={i}
              style={{
                color:
                  line.startsWith("=== Ошибки") || line.startsWith("Ошибка:")
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
});
