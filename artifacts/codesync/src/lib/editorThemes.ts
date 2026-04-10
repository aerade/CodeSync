import type * as MonacoType from "monaco-editor";

export interface ThemeOption {
  id: string;
  label: string;
  base: "vs" | "vs-dark" | "hc-black";
}

export const EDITOR_THEMES: ThemeOption[] = [
  { id: "vs-dark", label: "VS Dark", base: "vs-dark" },
  { id: "vs", label: "VS Light", base: "vs" },
  { id: "hc-black", label: "High Contrast", base: "hc-black" },
  { id: "github-dark", label: "GitHub Dark", base: "vs-dark" },
  { id: "dracula", label: "Dracula", base: "vs-dark" },
  { id: "monokai", label: "Monokai", base: "vs-dark" },
  { id: "solarized-dark", label: "Solarized Dark", base: "vs-dark" },
  { id: "one-dark", label: "One Dark", base: "vs-dark" },
];

export function registerCustomThemes(monaco: typeof MonacoType) {
  monaco.editor.defineTheme("github-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" },
      { token: "type", foreground: "ffa657" },
      { token: "function", foreground: "d2a8ff" },
      { token: "variable", foreground: "e6edf3" },
      { token: "constant", foreground: "79c0ff" },
      { token: "class", foreground: "ffa657" },
      { token: "tag", foreground: "7ee787" },
      { token: "attribute.name", foreground: "79c0ff" },
      { token: "attribute.value", foreground: "a5d6ff" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#e6edf3",
      "editor.selectionBackground": "#264f7840",
      "editor.lineHighlightBackground": "#161b2280",
      "editorCursor.foreground": "#e6edf3",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#e6edf3",
      "editor.selectionHighlightBackground": "#264f7830",
      "editorWhitespace.foreground": "#30363d",
      "editorIndentGuide.background": "#21262d",
      "editorBracketMatch.background": "#264f7840",
      "editorBracketMatch.border": "#388bfd",
    },
  });

  monaco.editor.defineTheme("dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272a4", fontStyle: "italic" },
      { token: "keyword", foreground: "ff79c6" },
      { token: "string", foreground: "f1fa8c" },
      { token: "number", foreground: "bd93f9" },
      { token: "type", foreground: "8be9fd" },
      { token: "function", foreground: "50fa7b" },
      { token: "variable", foreground: "f8f8f2" },
      { token: "constant", foreground: "bd93f9" },
      { token: "class", foreground: "8be9fd" },
      { token: "tag", foreground: "ff79c6" },
      { token: "attribute.name", foreground: "50fa7b" },
      { token: "attribute.value", foreground: "f1fa8c" },
      { token: "operator", foreground: "ff79c6" },
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editor.selectionBackground": "#44475a",
      "editor.lineHighlightBackground": "#44475a50",
      "editorCursor.foreground": "#f8f8f0",
      "editorLineNumber.foreground": "#6272a4",
      "editorLineNumber.activeForeground": "#f8f8f2",
      "editor.selectionHighlightBackground": "#44475a80",
      "editorWhitespace.foreground": "#3d3f4e",
      "editorIndentGuide.background": "#3d3f4e",
      "editorBracketMatch.background": "#44475a80",
      "editorBracketMatch.border": "#ff79c6",
    },
  });

  monaco.editor.defineTheme("monokai", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "75715e", fontStyle: "italic" },
      { token: "keyword", foreground: "f92672" },
      { token: "string", foreground: "e6db74" },
      { token: "number", foreground: "ae81ff" },
      { token: "type", foreground: "66d9e8" },
      { token: "function", foreground: "a6e22e" },
      { token: "variable", foreground: "f8f8f2" },
      { token: "constant", foreground: "ae81ff" },
      { token: "class", foreground: "a6e22e" },
      { token: "tag", foreground: "f92672" },
      { token: "attribute.name", foreground: "a6e22e" },
      { token: "attribute.value", foreground: "e6db74" },
      { token: "operator", foreground: "f92672" },
    ],
    colors: {
      "editor.background": "#272822",
      "editor.foreground": "#f8f8f2",
      "editor.selectionBackground": "#49483e",
      "editor.lineHighlightBackground": "#3e3d3250",
      "editorCursor.foreground": "#f8f8f0",
      "editorLineNumber.foreground": "#75715e",
      "editorLineNumber.activeForeground": "#f8f8f2",
      "editor.selectionHighlightBackground": "#49483e80",
      "editorWhitespace.foreground": "#3b3a32",
      "editorIndentGuide.background": "#3b3a32",
      "editorBracketMatch.background": "#49483e",
      "editorBracketMatch.border": "#a6e22e",
    },
  });

  monaco.editor.defineTheme("solarized-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "657b83", fontStyle: "italic" },
      { token: "keyword", foreground: "859900" },
      { token: "string", foreground: "2aa198" },
      { token: "number", foreground: "d33682" },
      { token: "type", foreground: "268bd2" },
      { token: "function", foreground: "268bd2" },
      { token: "variable", foreground: "839496" },
      { token: "constant", foreground: "cb4b16" },
      { token: "class", foreground: "268bd2" },
      { token: "tag", foreground: "268bd2" },
      { token: "attribute.name", foreground: "657b83" },
      { token: "attribute.value", foreground: "2aa198" },
    ],
    colors: {
      "editor.background": "#002b36",
      "editor.foreground": "#839496",
      "editor.selectionBackground": "#073642",
      "editor.lineHighlightBackground": "#07364250",
      "editorCursor.foreground": "#839496",
      "editorLineNumber.foreground": "#586e75",
      "editorLineNumber.activeForeground": "#839496",
      "editorWhitespace.foreground": "#073642",
      "editorIndentGuide.background": "#073642",
      "editorBracketMatch.background": "#07364280",
      "editorBracketMatch.border": "#2aa198",
    },
  });

  monaco.editor.defineTheme("one-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6370", fontStyle: "italic" },
      { token: "keyword", foreground: "c678dd" },
      { token: "string", foreground: "98c379" },
      { token: "number", foreground: "d19a66" },
      { token: "type", foreground: "e5c07b" },
      { token: "function", foreground: "61afef" },
      { token: "variable", foreground: "e06c75" },
      { token: "constant", foreground: "d19a66" },
      { token: "class", foreground: "e5c07b" },
      { token: "tag", foreground: "e06c75" },
      { token: "attribute.name", foreground: "d19a66" },
      { token: "attribute.value", foreground: "98c379" },
      { token: "operator", foreground: "abb2bf" },
    ],
    colors: {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editor.selectionBackground": "#3e4451",
      "editor.lineHighlightBackground": "#2c313a",
      "editorCursor.foreground": "#528bff",
      "editorLineNumber.foreground": "#4b5263",
      "editorLineNumber.activeForeground": "#abb2bf",
      "editor.selectionHighlightBackground": "#3e445180",
      "editorWhitespace.foreground": "#3b4048",
      "editorIndentGuide.background": "#3b4048",
      "editorBracketMatch.background": "#3e445180",
      "editorBracketMatch.border": "#528bff",
    },
  });
}
