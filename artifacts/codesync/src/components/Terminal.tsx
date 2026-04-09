import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  code: string;
  language: string;
}

export interface TerminalHandle {
  run: () => void;
}

const SUPPORTED_EXEC_LANGS = ["javascript", "typescript", "python", "c", "cpp", "bash", "shell"];
const XTERM_THEME = {
  background: "#0D1117",
  foreground: "#E6EDF3",
  cursor: "#58A6FF",
  cursorAccent: "#0D1117",
  black: "#0D1117",
  red: "#FF7B72",
  green: "#3FB950",
  yellow: "#F2CC60",
  blue: "#58A6FF",
  magenta: "#D2A8FF",
  cyan: "#79C0FF",
  white: "#E6EDF3",
  brightBlack: "#8B949E",
  brightRed: "#FF7B72",
  brightGreen: "#3FB950",
  brightYellow: "#F2CC60",
  brightBlue: "#58A6FF",
  brightMagenta: "#D2A8FF",
  brightCyan: "#79C0FF",
  brightWhite: "#E6EDF3",
  selectionBackground: "#264F78",
};

export const Terminal = forwardRef<TerminalHandle, Props>(function Terminal({ code, language }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const canExecute = SUPPORTED_EXEC_LANGS.includes(language.toLowerCase());

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      theme: XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorStyle: "bar",
      cursorBlink: true,
      allowTransparency: false,
      scrollback: 3000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);

    setTimeout(() => { fitAddon.fit(); }, 50);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.writeln("\x1b[90m// Нажмите «Запустить» для запуска кода\x1b[0m");

    xterm.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", input: data }));
      }
    });

    const ro = new ResizeObserver(() => { fitAddon.fit(); });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const handleRun = useCallback(() => {
    if (!code || !canExecute || isRunningRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const xterm = xtermRef.current;
    if (!xterm) return;

    xterm.reset();
    xterm.writeln(`\x1b[90m> Запуск ${language}...\x1b[0m`);

    isRunningRef.current = true;
    setIsRunning(true);

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws/pty`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const cols = fitAddonRef.current ? xtermRef.current?.cols ?? 80 : 80;
    const rows = fitAddonRef.current ? xtermRef.current?.rows ?? 24 : 24;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", code, language, cols, rows }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; data?: string; code?: number };
        if (msg.type === "output" && msg.data) {
          xterm.write(msg.data);
        } else if (msg.type === "exit") {
          const exitCode = msg.code ?? 0;
          if (exitCode === 0) {
            xterm.writeln(`\r\n\x1b[90m[Процесс завершён]\x1b[0m`);
          } else {
            xterm.writeln(`\r\n\x1b[33m[Процесс завершён с кодом ${exitCode}]\x1b[0m`);
          }
          isRunningRef.current = false;
          setIsRunning(false);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (isRunningRef.current) {
        xterm.writeln("\r\n\x1b[90m[Соединение закрыто]\x1b[0m");
        isRunningRef.current = false;
        setIsRunning(false);
      }
    };

    ws.onerror = () => {
      xterm.writeln("\r\n\x1b[31m[Ошибка соединения с сервером]\x1b[0m");
      isRunningRef.current = false;
      setIsRunning(false);
    };
  }, [code, language, canExecute]);

  const handleStop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    xtermRef.current?.writeln("\r\n\x1b[33m[Остановлено]\x1b[0m");
  }, []);

  const handleClear = useCallback(() => {
    xtermRef.current?.reset();
    xtermRef.current?.writeln("\x1b[90m// Нажмите «Запустить» для запуска кода\x1b[0m");
  }, []);

  useImperativeHandle(ref, () => ({ run: handleRun }), [handleRun]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

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
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: "#1C2128", color: "#8B949E", border: "1px solid #30363D" }}
          >
            {language}
          </span>
          {isRunning && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#3FB95020", color: "#3FB950", border: "1px solid #3FB95040" }}>
              выполняется
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-white/5"
            style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
            data-testid="btn-clear-terminal"
          >
            Очистить
          </button>
          {isRunning ? (
            <button
              onClick={handleStop}
              className="text-xs px-3 py-0.5 rounded font-medium"
              style={{
                background: "#FF7B72",
                color: "#0D1117",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
              data-testid="btn-stop-code"
            >
              Стоп
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!code || !canExecute}
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
              Выполнить
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ padding: "4px 8px" }}
      />
    </div>
  );
});
