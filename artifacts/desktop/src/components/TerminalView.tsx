import { useEffect, useRef, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { desktop, isElectron } from "@/lib/desktopBridge";

type Props = {
  /** Локальный uuid сессии (используется для key/lifecycle) */
  sessionLocalId: string;
  /** Рабочая директория для запуска оболочки */
  cwd?: string;
};

/**
 * Один экземпляр xterm.js, привязанный к одной node-pty сессии.
 * При unmount убивает PTY и освобождает ресурсы.
 */
export function TerminalView({ sessionLocalId, cwd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const native = isElectron();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      lineHeight: 1.35,
      theme: {
        background: "#0F0F11",
        foreground: "#E4E4E7",
        cursor: "#A395FF",
        cursorAccent: "#0F0F11",
        black: "#18181B",
        red: "#E26F6F",
        green: "#56C271",
        yellow: "#E0B655",
        blue: "#8FB6E8",
        magenta: "#BFA8FF",
        cyan: "#7BCFCF",
        white: "#E4E4E7",
        brightBlack: "#52525B",
        brightRed: "#F08585",
        brightGreen: "#7DD49A",
        brightYellow: "#F0CC75",
        brightBlue: "#A6C7EC",
        brightMagenta: "#D4C5FF",
        brightCyan: "#9DDADA",
        brightWhite: "#F4F4F5",
        selectionBackground: "rgba(139,125,233,0.30)",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    let dataOff: (() => void) | null = null;
    let exitOff: (() => void) | null = null;

    if (native) {
      desktop().pty.create({ cwd, cols: term.cols, rows: term.rows })
        .then((sessionId) => {
          sessionRef.current = sessionId;
          dataOff = desktop().pty.onData((id, data) => {
            if (id === sessionId) term.write(data);
          });
          exitOff = desktop().pty.onExit((id, code) => {
            if (id === sessionId) term.write(`\r\n\x1b[2m[процесс завершён, код ${code}]\x1b[0m\r\n`);
          });
          term.onData((data) => {
            if (sessionRef.current) desktop().pty.write(sessionRef.current, data);
          });
        })
        .catch((err) => {
          console.error(err);
          setError(String(err?.message ?? err));
        });
    } else {
      term.write("\x1b[1;38;2;163;149;255mCodeSync Desktop Terminal\x1b[0m\r\n");
      term.write("\x1b[2mВеб-режим: реальный терминал доступен только в нативной сборке Electron.\x1b[0m\r\n");
      term.write("\x1b[2mЗапустите `pnpm dev` локально для подключения node-pty.\x1b[0m\r\n\r\n");
      term.write("\x1b[38;2;139;125;233m$\x1b[0m ");
      let buf = "";
      term.onData((data) => {
        if (data === "\r") {
          term.write("\r\n");
          if (buf.trim()) term.write(`\x1b[2m(эмуляция) команда: ${buf}\x1b[0m\r\n`);
          buf = "";
          term.write("\x1b[38;2;139;125;233m$\x1b[0m ");
        } else if (data === "\u007f") {
          if (buf.length) {
            buf = buf.slice(0, -1);
            term.write("\b \b");
          }
        } else {
          buf += data;
          term.write(data);
        }
      });
    }

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (sessionRef.current && native) {
          desktop().pty.resize(sessionRef.current, term.cols, term.rows);
        }
      } catch {
        /* noop */
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      dataOff?.();
      exitOff?.();
      if (sessionRef.current && native) desktop().pty.kill(sessionRef.current);
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, sessionLocalId, cwd]);

  return (
    <div className="relative h-full w-full bg-[#0F0F11]">
      <div ref={containerRef} className="absolute inset-0" data-testid={`terminal-container-${sessionLocalId}`} />
      {error && (
        <div className="absolute top-2 right-2 text-[12px] text-[#E26F6F] bg-[#18181B] border border-white/10 px-2 py-1 rounded">
          Не удалось запустить терминал: {error}
        </div>
      )}
    </div>
  );
}
