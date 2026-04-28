import type * as MonacoType from "monaco-editor";

/**
 * Тема Monaco в духе Cursor / Antigravity:
 * глубокий чёрно-серый фон, мягкая палитра, без агрессивных акцентов.
 */
export function registerCustomThemes(monaco: typeof MonacoType) {
  monaco.editor.defineTheme("codesync-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "E4E4E7", background: "0F0F11" },
      { token: "comment", foreground: "5C5C66", fontStyle: "italic" },
      { token: "keyword", foreground: "BFA8FF" },
      { token: "string", foreground: "B5D9A6" },
      { token: "number", foreground: "E0B655" },
      { token: "regexp", foreground: "E26F6F" },
      { token: "type", foreground: "8FB6E8" },
      { token: "class", foreground: "8FB6E8" },
      { token: "interface", foreground: "8FB6E8" },
      { token: "function", foreground: "BFA8FF" },
      { token: "variable", foreground: "E4E4E7" },
      { token: "variable.predefined", foreground: "C4B5FD" },
      { token: "constant", foreground: "F0B575" },
      { token: "tag", foreground: "BFA8FF" },
      { token: "attribute.name", foreground: "8FB6E8" },
      { token: "attribute.value", foreground: "B5D9A6" },
      { token: "delimiter", foreground: "9099A8" },
      { token: "operator", foreground: "BFA8FF" },
    ],
    colors: {
      "editor.background": "#0F0F11",
      "editor.foreground": "#E4E4E7",
      "editor.lineHighlightBackground": "#18181B",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#F9731640",
      "editor.inactiveSelectionBackground": "#F9731620",
      "editor.findMatchBackground": "#E0B65540",
      "editor.findMatchHighlightBackground": "#E0B65520",
      "editor.wordHighlightBackground": "#FFFFFF12",
      "editorCursor.foreground": "#F97316",
      "editorWhitespace.foreground": "#2A2A30",
      "editorIndentGuide.background": "#1F1F23",
      "editorIndentGuide.activeBackground": "#3A3A42",
      "editorLineNumber.foreground": "#52525B",
      "editorLineNumber.activeForeground": "#A1A1AA",
      "editor.selectionHighlightBorder": "#00000000",
      "editorBracketMatch.background": "#F9731633",
      "editorBracketMatch.border": "#F9731655",
      "editorGutter.background": "#0F0F11",
      "editorWidget.background": "#18181B",
      "editorWidget.border": "#FFFFFF1A",
      "editorSuggestWidget.background": "#18181B",
      "editorSuggestWidget.border": "#FFFFFF1A",
      "editorSuggestWidget.selectedBackground": "#25252B",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#FFFFFF14",
      "scrollbarSlider.hoverBackground": "#FFFFFF22",
      "scrollbarSlider.activeBackground": "#FFFFFF33",
    },
  });

  monaco.editor.setTheme("codesync-dark");
}
