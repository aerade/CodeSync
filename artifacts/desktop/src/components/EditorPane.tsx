import Editor, { type OnMount } from "@monaco-editor/react";
import { useWorkspace } from "@/store/workspace";
import { registerCustomThemes } from "@/lib/editorThemes";
import { Sparkles, FolderOpen, Users } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { desktop } from "@/lib/desktopBridge";
import { getWsBase, getCollabToken } from "@/lib/apiConfig";
import { log } from "@/lib/logger";
import type * as monacoEditor from "monaco-editor";

export function EditorPane() {
  const { tabs, activeTabId, updateTabContent, openScratch, currentProject } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Yjs/y-monaco binding ref для облачных вкладок
  const yRef = useRef<{
    doc: Y.Doc;
    provider: WebsocketProvider;
    binding: MonacoBinding;
  } | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    registerCustomThemes(monaco);
    editor.updateOptions({
      fontSize: 13.5,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontLigatures: true,
      lineHeight: 1.55,
      letterSpacing: 0.1,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: "active", indentation: true },
      padding: { top: 12, bottom: 12 },
      stickyScroll: { enabled: false },
    });

    // Если активная вкладка — облачный файл, поднимаем Yjs/y-monaco binding
    if (activeTab?.cloudRoomId && activeTab.cloudFileId) {
      attachYjs(editor, monaco, activeTab.cloudRoomId, activeTab.cloudFileId);
    }
  }, [activeTab?.cloudRoomId, activeTab?.cloudFileId]);

  const attachYjs = useCallback(async (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    _monaco: typeof monacoEditor,
    roomId: string,
    fileId: string,
  ) => {
    // Очистка старого binding
    if (yRef.current) {
      try { yRef.current.binding.destroy(); } catch (err) { log.debug("editor", "binding destroy", err); }
      try { yRef.current.provider.destroy(); } catch (err) { log.debug("editor", "provider destroy", err); }
      try { yRef.current.doc.destroy(); } catch (err) { log.debug("editor", "doc destroy", err); }
      yRef.current = null;
    }

    const doc = new Y.Doc();
    const yText = doc.getText("content");

    // WebSocket-адрес из настроек (apiConfig). Поддерживает раздельный
    // деплой api-server и desktop: значение задаётся в SettingsPanel.
    const wsBase = await getWsBase();

    // Сервер требует short-lived токен (POST /api/collab/token) — без него
    // соединение закрывается с кодом 1008 ("Collab token required").
    const collab = await getCollabToken();
    if (!collab) {
      log.warn("editor", "Не удалось получить collab-токен — WS не открыт");
      return;
    }

    // Имя пользователя для awareness — приоритет токена (актуально, если
    // в апи-сервере его освежили из Clerk), иначе локальная настройка.
    const username = collab.username
      ?? (await desktop().db.getSetting("guestUsername").catch((err) => {
        log.debug("editor", "settings.guestUsername", err);
        return null;
      }))
      ?? "Гость";

    const provider = new WebsocketProvider(wsBase, `ws/rooms/${roomId}/files/${fileId}`, doc, {
      connect: true,
      params: { token: collab.token },
    });

    provider.awareness.setLocalStateField("user", {
      name: username,
      color: "#F97316",
    });

    const model = editor.getModel();
    if (!model) return;

    // Гарантируем, что модель пуста перед binding (Yjs синхронизирует первоначальный state)
    model.setValue("");

    const binding = new MonacoBinding(yText, model, new Set([editor]), provider.awareness);

    yRef.current = { doc, provider, binding };

    // Подписываемся на события y-websocket для диагностики (вместо тихих catch).
    const onError = (err: unknown) => log.warn("editor", "Yjs WS connection-error", err);
    const onStatus = (s: unknown) => log.debug("editor", "Yjs status", s);
    (provider as unknown as { on: (e: string, cb: (v: unknown) => void) => void }).on("connection-error", onError);
    (provider as unknown as { on: (e: string, cb: (v: unknown) => void) => void }).on("status", onStatus);
  }, []);

  // При смене активной вкладки заново поднимаем/сбрасываем Yjs
  useEffect(() => {
    return () => {
      if (yRef.current) {
        try { yRef.current.binding.destroy(); } catch (err) { log.debug("editor", "cleanup binding", err); }
        try { yRef.current.provider.destroy(); } catch (err) { log.debug("editor", "cleanup provider", err); }
        try { yRef.current.doc.destroy(); } catch (err) { log.debug("editor", "cleanup doc", err); }
        yRef.current = null;
      }
    };
  }, [activeTab?.id]);

  if (!activeTab) {
    return (
      <div className="flex-1 grid place-items-center bg-[#0F0F11]">
        <div className="max-w-md text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] mx-auto mb-4 grid place-items-center shadow-[0_0_64px_rgba(249,115,22,0.35)]">
            <Sparkles className="w-7 h-7 text-[#1C0A00]" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-1.5">CodeSync Desktop</h2>
          <p className="text-[13px] text-zinc-500 leading-relaxed mb-5">
            {currentProject
              ? "Откройте файл из проводника слева или создайте новый файл-черновик, чтобы начать работу."
              : "Откройте папку проекта или подключитесь к облачной комнате через боковую панель."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openScratch("typescript")}
              className="h-8 px-3 rounded-md bg-[#18181B] hover:bg-[#1F1F23] border border-white/10 text-[13px] text-zinc-200"
              data-testid="editor-empty-new-scratch"
            >
              Новый черновик
            </button>
            {!currentProject && (
              <button
                type="button"
                className="h-8 px-3 rounded-md bg-[#F97316] hover:bg-[#FB923C] text-[#1C0A00] text-[13px] font-medium flex items-center gap-1.5"
                data-testid="editor-empty-open"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Открыть папку
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-[#0F0F11] relative">
      {activeTab.cloudRoomId && (
        <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5 text-[11px] text-zinc-400 bg-[#18181B]/90 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1">
          <Users className="w-3 h-3 text-[#F97316]" />
          <span>Облачная комната · совместное редактирование</span>
        </div>
      )}
      <Editor
        key={activeTab.id}
        height="100%"
        width="100%"
        theme="codesync-dark"
        language={activeTab.language}
        value={activeTab.cloudRoomId ? undefined : activeTab.content}
        defaultValue={activeTab.cloudRoomId ? "" : undefined}
        onChange={(v) => {
          if (!activeTab.cloudRoomId) updateTabContent(activeTab.id, v ?? "");
        }}
        onMount={handleMount}
        loading={
          <div className="h-full grid place-items-center text-[13px] text-zinc-500">
            Загрузка редактора…
          </div>
        }
        options={{
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
        }}
      />
    </div>
  );
}
