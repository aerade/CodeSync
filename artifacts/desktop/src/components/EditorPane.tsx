import Editor, { type OnMount } from "@monaco-editor/react";
import { useWorkspace } from "@/store/workspace";
import { registerCustomThemes } from "@/lib/editorThemes";
import { Sparkles, FolderOpen } from "lucide-react";
import { useCallback } from "react";

export function EditorPane() {
  const { tabs, activeTabId, updateTabContent, openScratch, currentProject } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);

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
  }, []);

  if (!activeTab) {
    return (
      <div className="flex-1 grid place-items-center bg-[#0F0F11]">
        <div className="max-w-md text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A395FF] to-[#6B5BD6] mx-auto mb-4 grid place-items-center shadow-[0_0_64px_rgba(139,125,233,0.35)]">
            <Sparkles className="w-7 h-7 text-[#0E0B22]" />
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
                className="h-8 px-3 rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] text-[13px] font-medium flex items-center gap-1.5"
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
    <div className="flex-1 min-h-0 bg-[#0F0F11]">
      <Editor
        key={activeTab.id}
        height="100%"
        width="100%"
        theme="codesync-dark"
        language={activeTab.language}
        value={activeTab.content}
        onChange={(v) => updateTabContent(activeTab.id, v ?? "")}
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
