import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FilePlus, FolderPlus, Archive } from "lucide-react";
import { useCreateFile, useDeleteFile, useUpdateFile, getGetRoomFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// VS Code-style file type icons
function LangIcon({ language }: { language: string }) {
  const s = { width: 16, height: 16, flexShrink: 0 } as const;
  switch (language) {
    case "javascript":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#F7DF1E"/>
          <path d="M4.5 10.8c.3.5.7.9 1.4.9.7 0 1.1-.35 1.1-.85 0-.6-.45-.8-1.2-1.15l-.4-.17c-1.2-.5-2-.95-2-2.1C3.4 6.1 4.35 5.3 5.8 5.3c1 0 1.7.35 2.2 1.25l-1.2.77c-.25-.45-.52-.63-.95-.63-.45 0-.73.28-.73.65 0 .45.28.63 1.1 1l.4.17c1.4.6 2.2 1.2 2.2 2.35 0 1.35-1.06 2.1-2.5 2.1-1.4 0-2.3-.67-2.74-1.54L4.5 10.8zm5.2.12c.34.6.78 1.04 1.55 1.04.65 0 1.07-.33 1.07-.92V5.45h-1.5v5.5c0 .22-.1.3-.27.3-.2 0-.3-.1-.4-.27l-1 .94z" fill="#000"/>
        </svg>
      );
    case "jsx":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#F7DF1E"/>
          <path d="M8 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#000"/>
          <path d="M8 4.5c-1.93 0-3.6.4-4.8.97l.6 1.05C4.75 6.05 6.3 5.7 8 5.7s3.25.35 4.2.82l.6-1.05C11.6 4.9 9.93 4.5 8 4.5zM3.2 8c0 .48.6 1.1 1.6 1.58l.6-1.05C4.8 8.27 4.5 8.1 4.5 8s.3-.27.9-.53L4.8 6.42C3.8 6.9 3.2 7.52 3.2 8zm9.6 0c0-.48-.6-1.1-1.6-1.58l-.6 1.05c.6.26.9.43.9.53s-.3.27-.9.53l.6 1.05c1-.48 1.6-1.1 1.6-1.58z" fill="#000" opacity="0.7"/>
        </svg>
      );
    case "typescript":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#3178C6"/>
          <path d="M9.15 9.15v1.7c.28.14.6.24.96.3.36.06.74.09 1.13.09.38 0 .74-.04 1.08-.11.34-.08.64-.2.89-.37.26-.17.46-.4.6-.68.15-.28.22-.62.22-1.03 0-.3-.04-.56-.13-.78-.09-.22-.21-.41-.38-.58-.16-.17-.36-.32-.59-.45-.23-.13-.48-.26-.77-.38-.2-.09-.38-.17-.54-.25-.16-.08-.3-.16-.41-.24-.11-.09-.2-.18-.26-.29-.06-.1-.09-.22-.09-.36 0-.13.03-.24.08-.34.05-.1.13-.18.23-.25.1-.07.22-.12.36-.15.14-.03.3-.05.48-.05.13 0 .27.01.41.03.14.02.28.06.42.12.14.06.28.14.41.24.13.1.25.22.36.37V6.2c-.26-.1-.54-.17-.85-.22-.3-.05-.63-.07-.97-.07-.37 0-.72.04-1.06.12-.34.08-.63.21-.89.38-.26.18-.46.41-.61.7-.15.29-.22.64-.22 1.05 0 .5.13.93.4 1.27.27.34.68.63 1.24.86.21.08.41.17.59.26.18.09.33.18.46.27.13.09.23.2.31.31.07.12.11.25.11.4 0 .14-.03.26-.08.37-.06.11-.14.2-.25.28-.11.08-.25.14-.41.18-.16.04-.35.06-.57.06-.38 0-.75-.07-1.1-.22-.36-.15-.67-.37-.95-.66zM4.5 7.38H6.5V12h1.5V7.38H10V6H4.5v1.38z" fill="#fff"/>
        </svg>
      );
    case "tsx":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#3178C6"/>
          <path d="M4.5 6v1.5H6.5V12H8V7.5H10V6H4.5z" fill="#fff"/>
          <circle cx="12.5" cy="10" r="2" fill="none" stroke="#61DAFB" strokeWidth="1"/>
          <circle cx="12.5" cy="10" r="0.5" fill="#61DAFB"/>
        </svg>
      );
    case "python":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#3572A5"/>
          <path d="M7.95 2C5.7 2 5 3 5 4v1.5h3V6H3.5C2.5 6 1.5 7 1.5 9s1 3 2 3h1V10.5c0-1 1-1.5 2-1.5h3c1 0 1.5-.7 1.5-1.5V4c0-1-1-2-3.05-2zM6.5 3.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" fill="#FFD444"/>
          <path d="M8.05 14c2.25 0 2.95-1 2.95-2v-1.5H8V10h5c1 0 2-1 2-3s-1-3-2-3h-1V5.5c0 1-1 1.5-2 1.5H7c-1 0-1.5.7-1.5 1.5V12c0 1 1 2 3.05 2zM9.5 12.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" fill="#3572A5"/>
        </svg>
      );
    case "html":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#E44D26"/>
          <path d="M3 2.5l1 10.5 4 1 4-1 1-10.5H3zm7 2.5H6l.15 1.5h3.7l-.5 4.5L8 11.5l-1.35-.5L6.5 9.5H8l.1.75.9.25.9-.25.1-1.5H6.3L6 6.5h4.15L10 5z" fill="#fff"/>
        </svg>
      );
    case "css":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#264DE4"/>
          <path d="M3 2.5l1 10.5 4 1 4-1 1-10.5H3zm7.1 2.5l-.1.9H5.8L6 7h4l-.4 4-1.6.45L6.4 11l-.1-1.2h1.5l.06.7.54.15.54-.15.15-1.45H6.05l-.35-4H10.1L10 5z" fill="#fff"/>
        </svg>
      );
    case "scss":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#BF4080"/>
          <text x="2" y="11.5" fontSize="7" fontWeight="700" fill="#fff" fontFamily="monospace">SCSS</text>
        </svg>
      );
    case "json":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#1e1e1e"/>
          <path d="M5 4.5C4 4.5 3.5 5 3.5 5.5v1C3.5 7 3 7.5 2.5 7.5 3 7.5 3.5 8 3.5 8.5v1C3.5 10 4 10.5 5 10.5" fill="none" stroke="#F2CC60" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M11 4.5c1 0 1.5.5 1.5 1v1c0 .5.5 1 1 1-.5 0-1 .5-1 1v1c0 .5-.5 1-1.5 1" fill="none" stroke="#F2CC60" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="8" cy="7.5" r="1" fill="#F2CC60"/>
        </svg>
      );
    case "markdown":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#484F58"/>
          <path d="M2 5h2v6H2V5zm3 0h1.5l1.5 2 1.5-2H11v6H9.5V8l-1.5 2-1.5-2V11H5V5zm7 0h2l-2 3h2v3h-2V8l-2-3h2z" fill="#fff" transform="scale(0.72) translate(1, 1)"/>
        </svg>
      );
    case "go":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#00ACD7"/>
          <path d="M2.5 9.5c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2h-5c-1.1 0-2 .9-2 2v3zm7.5-1h-1.5V7.5H10v1zm-2 0H7V7.5h1.5v1zM5 9a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="#fff"/>
          <circle cx="12" cy="6" r="1.5" fill="#fff"/>
        </svg>
      );
    case "rust":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#CE422B"/>
          <path d="M8 2.5l1 2h2l-1.5 1.5.5 2-2-1-2 1 .5-2L5 4.5h2l1-2z" fill="#fff"/>
          <rect x="3.5" y="8" width="9" height="5" rx="1.5" fill="rgba(255,255,255,0.2)"/>
          <text x="4.5" y="12" fontSize="6" fontWeight="700" fill="#fff" fontFamily="monospace">RS</text>
        </svg>
      );
    case "java":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#ED8B00"/>
          <path d="M6 3c0 2-2 3-2 5s1.5 3 4 3-4 2-4 2M10 3s1 1 0 2-2 1-2 2 2 1 2 2" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M5 13s3-1 6-1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
    case "cpp":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#6295CB"/>
          <path d="M6 4.5C4.5 4.5 3.5 5.8 3.5 8s1 3.5 2.5 3.5c1 0 1.8-.5 2.3-1.5H6.7c-.3.4-.6.6-1.1.6-.9 0-1.5-.9-1.5-2.1 0-1.3.6-2.1 1.5-2.1.5 0 .8.2 1.1.6H8.3C7.8 5 7 4.5 6 4.5zM10 7H9V8h1v1h1V8h1V7h-1V6h-1v1z" fill="#fff"/>
          <path d="M13 7h-1v1h1V7z" fill="#fff"/>
        </svg>
      );
    case "c":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#5C6BC0"/>
          <path d="M9 4.5C7.5 4.5 6.5 5.8 6.5 8s1 3.5 2.5 3.5c1 0 1.8-.5 2.3-1.5H9.7c-.3.4-.6.6-1.1.6-.9 0-1.5-.9-1.5-2.1 0-1.3.6-2.1 1.5-2.1.5 0 .8.2 1.1.6H11.3C10.8 5 10 4.5 9 4.5z" fill="#fff"/>
        </svg>
      );
    case "csharp":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#68217A"/>
          <path d="M6 4.5C4.5 4.5 3.5 5.8 3.5 8s1 3.5 2.5 3.5c1 0 1.8-.5 2.3-1.5H6.7c-.3.4-.6.6-1.1.6-.9 0-1.5-.9-1.5-2.1 0-1.3.6-2.1 1.5-2.1.5 0 .8.2 1.1.6H8.3C7.8 5 7 4.5 6 4.5z" fill="#fff"/>
          <path d="M9.5 7.5h.8V7h.8v.5h.4V7h.8v.5h.7v.8h-.7v.4h.7v.8h-.7V10h-.8v-.5h-.4V10h-.8v-.5h-.8v-.8h.8v-.4h-.8v-.8z" fill="#fff"/>
        </svg>
      );
    case "ruby":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#CC342D"/>
          <path d="M10 3L5 6l-1 5 5 2 4-4-3-6z" fill="rgba(255,255,255,0.25)"/>
          <path d="M10 3l-5 3m0 0l-1 5m1-5l4.5 2M5 11l5 2m-5-2l4.5-4.5M10 3l-0.5 7.5" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      );
    case "php":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#777BB4"/>
          <ellipse cx="8" cy="8" rx="6" ry="3.5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
          <text x="4.5" y="10.5" fontSize="6.5" fontWeight="700" fill="#fff" fontFamily="monospace">php</text>
        </svg>
      );
    case "shell":
    case "bash":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#1d2023"/>
          <rect x="1" y="1" width="14" height="14" rx="1.8" fill="none" stroke="#3FB950" strokeWidth="0.7" opacity="0.5"/>
          <path d="M3 6l2 2-2 2" fill="none" stroke="#3FB950" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7 10h4" stroke="#3FB950" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      );
    case "sql":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#336791"/>
          <ellipse cx="8" cy="5" rx="4.5" ry="2" fill="#fff" opacity="0.3"/>
          <path d="M3.5 5v6c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7"/>
          <path d="M3.5 8c0 1.1 2 2 4.5 2s4.5-.9 4.5-2" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5"/>
        </svg>
      );
    case "yaml":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#CB171E"/>
          <text x="2" y="11" fontSize="6.5" fontWeight="700" fill="#fff" fontFamily="monospace">YAML</text>
        </svg>
      );
    case "vue":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#1a1a2e"/>
          <path d="M8 3L5 8l3 5 3-5-3-5z" fill="#42b883"/>
          <path d="M8 3L6 7l2 3.5L10 7 8 3z" fill="#35495e"/>
          <path d="M2 3l6 10L14 3h-2L8 9.5 4 3H2z" fill="none" stroke="#42b883" strokeWidth="0.5" opacity="0.5"/>
        </svg>
      );
    case "svelte":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#FF3E00"/>
          <path d="M11.5 4.5c-1-1.5-3-1.5-4 0L5 8c-.8 1.3-.4 2.8 1 3.3 1 .3 2 0 2.7-.8l.3-.4c.5-.7.5-1.6-.1-2.2-.3-.3-.7-.5-1.2-.4l-.5.1" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M4.5 11.5c1 1.5 3 1.5 4 0L11 8c.8-1.3.4-2.8-1-3.3-1-.3-2 0-2.7.8l-.3.4c-.5.7-.5 1.6.1 2.2.3.3.7.5 1.2.4l.5-.1" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
    case "dockerfile":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#1D63ED"/>
          <path d="M2.5 9.5h11M2.5 7.5h3m1 0h2m1 0h2M2.5 5.5h3m1 0h2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9"/>
          <path d="M11 11.5c1.5 0 2.5-1 2.5-2.5" fill="none" stroke="#00ADEF" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      );
    case "image":
      return (
        <svg {...s} viewBox="0 0 16 16">
          <rect width="16" height="16" rx="2.5" fill="#A84F1B"/>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7"/>
          <circle cx="5.5" cy="6" r="1.2" fill="#FFD60A"/>
          <path d="M2.5 10.5l3-3 2 2.5 2-2 3 3" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
        </svg>
      );
    default:
      return (
        <svg {...s} viewBox="0 0 16 16">
          <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
          <path d="M10 2v3h3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
          <rect x="4" y="8" width="6" height="0.9" rx="0.45" fill="rgba(255,255,255,0.3)"/>
          <rect x="4" y="10" width="4.5" height="0.9" rx="0.45" fill="rgba(255,255,255,0.2)"/>
          <rect x="4" y="12" width="5.5" height="0.9" rx="0.45" fill="rgba(255,255,255,0.2)"/>
        </svg>
      );
  }
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", cjs: "javascript",
    jsx: "jsx",
    ts: "typescript", mts: "typescript", cts: "typescript",
    tsx: "tsx",
    py: "python", pyw: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp", cc: "cpp", cxx: "cpp",
    c: "c", h: "c",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    html: "html", htm: "html",
    css: "css",
    scss: "scss", sass: "scss",
    json: "json", jsonc: "json",
    md: "markdown", mdx: "markdown",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    sql: "sql",
    yaml: "yaml", yml: "yaml",
    vue: "vue",
    svelte: "svelte",
    jpg: "image", jpeg: "image", png: "image", gif: "image",
    svg: "image", webp: "image", ico: "image", bmp: "image",
  };
  return map[ext] ?? "plaintext";
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isFolder: boolean;
  parentId?: string | null;
  roomId: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileStatEntry {
  added?: number;
  removed?: number;
  errors?: number;
}

interface UserPresenceEntry {
  userId: string;
  username: string;
  color: string;
}

interface Props {
  roomId: string;
  files: FileItem[];
  activeFileId: string | null;
  fileStats?: Record<string, FileStatEntry>;
  userPresence?: Record<string, UserPresenceEntry[]>;
  showFilePresence?: boolean;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  x: number; y: number; fileId: string; fileName: string; isFolder: boolean;
}

export function FileTree({ roomId, files, activeFileId, fileStats = {}, userPresence = {}, showFilePresence = true, onFileSelect, onFilesChange, isReadOnly = false }: Props) {
  const qc = useQueryClient();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const updateFile = useUpdateFile();

  const prevFileIdsRef = useRef<Set<string>>(new Set());
  const [newlyAddedCount, setNewlyAddedCount] = useState(0);
  const [recentDeletedCount, setRecentDeletedCount] = useState(0);
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prevIds = prevFileIdsRef.current;
    const currentIds = new Set(files.map((f) => f.id));

    if (prevIds.size > 0) {
      const added = files.filter((f) => !prevIds.has(f.id));
      const deletedNum = [...prevIds].filter((id) => !currentIds.has(id)).length;

      if (added.length > 0) {
        setNewlyAddedCount((prev) => prev + added.length);
        if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
        newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedCount(0), 3000);
      }

      if (deletedNum > 0) {
        setRecentDeletedCount((prev) => prev + deletedNum);
        if (deletedTimerRef.current) clearTimeout(deletedTimerRef.current);
        deletedTimerRef.current = setTimeout(() => setRecentDeletedCount(0), 3000);
      }
    }

    prevFileIdsRef.current = currentIds;
  }, [files]);

  useEffect(() => {
    return () => {
      if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
      if (deletedTimerRef.current) clearTimeout(deletedTimerRef.current);
    };
  }, []);

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [creatingInFolderId, setCreatingInFolderId] = useState<string | null>(null);

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, fileId: string, fileName: string, isFolder: boolean) {
    e.preventDefault();
    if (isReadOnly) return;
    setContextMenu({ x: e.clientX, y: e.clientY, fileId, fileName, isFolder });
  }

  function handleDeleteFile(fileId: string) {
    deleteFile.mutate({ roomId, fileId }, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        onFilesChange();
      },
    });
    setContextMenu(null);
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Удалить ${ids.length} файл${ids.length > 1 ? "а/ов" : ""}?`);
    if (!confirmed) return;
    setSelectedFileIds(new Set());
    for (const fileId of ids) {
      deleteFile.mutate({ roomId, fileId }, {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
      });
    }
  }

  // Returns all visible items in render order (for range selection)
  function getVisibleItems(): FileItem[] {
    const result: FileItem[] = [];
    const rFolders = files.filter((f) => !f.parentId && f.isFolder);
    const rFiles = files.filter((f) => !f.parentId && !f.isFolder);
    for (const folder of rFolders) {
      result.push(folder);
      if (expandedFolders.has(folder.id)) {
        const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
        result.push(...children);
      }
    }
    result.push(...rFiles);
    return result;
  }

  function handleItemClick(e: React.MouseEvent, item: FileItem) {
    e.preventDefault();
    if (e.shiftKey && lastClickedIdRef.current) {
      // Range selection from last clicked to current
      const visibleItems = getVisibleItems();
      const lastIdx = visibleItems.findIndex((f) => f.id === lastClickedIdRef.current);
      const currentIdx = visibleItems.findIndex((f) => f.id === item.id);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const from = Math.min(lastIdx, currentIdx);
        const to = Math.max(lastIdx, currentIdx);
        const rangeIds = new Set(visibleItems.slice(from, to + 1).map((f) => f.id));
        setSelectedFileIds(rangeIds);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle individual item
      lastClickedIdRef.current = item.id;
      setSelectedFileIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else {
      // Regular click
      lastClickedIdRef.current = item.id;
      setSelectedFileIds(new Set());
      if (!item.isFolder) onFileSelect(item);
      else toggleFolder(item.id);
    }
  }

  // Kept for backward compat — used by renderFileItem
  function handleFileClick(e: React.MouseEvent, file: FileItem) {
    handleItemClick(e, file);
  }

  function startRename(fileId: string, currentName: string) {
    setRenamingFileId(fileId);
    setRenameValue(currentName);
    setContextMenu(null);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function handleRename(fileId: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingFileId(null); return; }
    const lang = detectLanguage(name);
    updateFile.mutate({ roomId, fileId, data: { name, path: `/${name}`, language: lang } }, {
      onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) }); onFilesChange(); },
      onSettled: () => { setRenamingFileId(null); },
    });
  }

  function handleCreateFile(parentId?: string | null) {
    if (!newFileName.trim()) { setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null); return; }
    const name = newFileName.trim();
    const lang = detectLanguage(name);
    createFile.mutate({ roomId, data: { name, path: `/${name}`, language: lang, parentId: parentId ?? undefined } }, {
      onSuccess: (file) => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        const fileItem: FileItem = {
          id: (file as { id: string }).id, name: (file as { name: string }).name,
          path: (file as { path: string }).path, language: (file as { language: string }).language,
          content: (file as { content?: string }).content ?? "", isFolder: (file as { isFolder: boolean }).isFolder,
          parentId: (file as { parentId?: string | null }).parentId, roomId: (file as { roomId: string }).roomId,
          createdBy: (file as { createdBy?: string | null }).createdBy,
          createdAt: (file as { createdAt: string }).createdAt, updatedAt: (file as { updatedAt: string }).updatedAt,
        };
        onFileSelect(fileItem);
        onFilesChange();
      },
    });
    setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null);
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) { setIsCreatingFolder(false); setNewFolderName(""); return; }
    const name = newFolderName.trim();
    createFile.mutate({ roomId, data: { name, path: `/${name}`, language: "plaintext", isFolder: true } }, {
      onSuccess: (folder) => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        onFilesChange();
        setExpandedFolders((prev) => new Set(prev).add((folder as { id: string }).id));
      },
    });
    setIsCreatingFolder(false); setNewFolderName("");
  }

  function handleDragStart(e: unknown, fileId: string) {
    if (isReadOnly) return;
    const de = e as React.DragEvent;
    if (de.dataTransfer) { de.dataTransfer.setData("text/plain", fileId); de.dataTransfer.effectAllowed = "move"; }
  }

  function handleDragOver(e: React.DragEvent, folderId: string | null) {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folderId);
  }

  function handleDragLeave() { setDragOverFolderId(null); }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault(); setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData("text/plain");
    if (!fileId) return;
    const file = files.find((f) => f.id === fileId);
    if (!file || file.isFolder || file.parentId === targetFolderId) return;
    updateFile.mutate({ roomId, fileId, data: { parentId: targetFolderId } }, {
      onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) }); onFilesChange(); },
    });
  }

  const rootFiles = files.filter((f) => !f.parentId && !f.isFolder);
  const rootFolders = files.filter((f) => !f.parentId && f.isFolder);
  const visItems = getVisibleItems();

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #58A6FF",
    borderRadius: 7, color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace",
    fontSize: 11, outline: "none", width: "100%", padding: "4px 8px",
  };

  function renderFileItem(file: FileItem, depth = 0, visItems?: FileItem[]) {
    const isActive = activeFileId === file.id;
    const isRenaming = renamingFileId === file.id;
    const isSelected = selectedFileIds.has(file.id);

    // Block-selection: compute adjacent selection for unified rect look
    // Active file is treated same as selected for adjacency purposes
    const isHighlighted = isActive || isSelected;
    const vi = visItems ?? [];
    const visIdx = vi.findIndex((v) => v.id === file.id);
    const prevHighlighted = isHighlighted && visIdx > 0 &&
      (selectedFileIds.has(vi[visIdx - 1]?.id ?? "") || activeFileId === vi[visIdx - 1]?.id);
    const nextHighlighted = isHighlighted && visIdx >= 0 && visIdx < vi.length - 1 &&
      (selectedFileIds.has(vi[visIdx + 1]?.id ?? "") || activeFileId === vi[visIdx + 1]?.id);

    const selRadius = isHighlighted
      ? `${prevHighlighted ? 0 : 6}px ${prevHighlighted ? 0 : 6}px ${nextHighlighted ? 0 : 6}px ${nextHighlighted ? 0 : 6}px`
      : "6px";

    const bg = isSelected && isActive
      ? "rgba(88,166,255,0.24)"
      : isSelected
        ? "rgba(88,166,255,0.16)"
        : isActive
          ? "rgba(88,166,255,0.18)"
          : "transparent";

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (!isRenaming) handleFileClick(e, file); }}
        onContextMenu={(e) => handleContextMenu(e, file.id, file.name, false)}
        draggable={!isReadOnly && !isRenaming}
        onDragStart={(e) => handleDragStart(e, file.id)}
        className="file-tree-item"
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "4px 10px", paddingLeft: 10 + depth * 14,
          cursor: "pointer", borderRadius: selRadius,
          background: bg,
          border: "none",
          transition: "background 0.1s",
          marginBottom: nextHighlighted ? 0 : 1,
        }}
        onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
        data-testid={`file-item-${file.id}`}
      >
        <LangIcon language={file.language} />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(file.id); if (e.key === "Escape") setRenamingFileId(null); }}
            onBlur={() => handleRename(file.id)}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="input-rename-file"
          />
        ) : (
          <span className="text-xs truncate flex-1" style={{ color: isActive ? "#E6EDF3" : "rgba(255,255,255,0.65)" }}>
            {file.name}
          </span>
        )}
        {/* User presence dots */}
        {showFilePresence && !isRenaming && userPresence[file.id] && userPresence[file.id].length > 0 && (
          <span style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
            {userPresence[file.id].slice(0, 3).map((u) => (
              <span
                key={u.userId}
                title={u.username}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: u.color, flexShrink: 0,
                  boxShadow: `0 0 4px ${u.color}60`,
                }}
              />
            ))}
          </span>
        )}
        {/* AI edit stats indicator */}
        {!isRenaming && fileStats[file.id] && (
          <span style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0, marginRight: 2 }}>
            {(fileStats[file.id].added ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#3FB950", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                +{fileStats[file.id].added}
              </span>
            )}
            {(fileStats[file.id].removed ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#F78166", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                -{fileStats[file.id].removed}
              </span>
            )}
            {(fileStats[file.id].errors ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#F85149", background: "rgba(248,81,73,0.15)", padding: "0 3px", borderRadius: 3, fontWeight: 700 }}>
                ✗{fileStats[file.id].errors}
              </span>
            )}
          </span>
        )}
        {!isRenaming && (
          <a
            href={`${basePath}/api/rooms/${roomId}/files/${file.id}/download`}
            download={file.name}
            style={{ color: "rgba(255,255,255,0.18)", lineHeight: 0, display: "flex", alignItems: "center", flexShrink: 0, padding: "2px" }}
            title={`Скачать ${file.name}`}
            onClick={(e) => e.stopPropagation()}
            className="file-download-btn"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"/>
            </svg>
          </a>
        )}
      </motion.div>
    );
  }

  function renderNewFileInput(parentId?: string | null) {
    return (
      <div style={{ padding: "4px 10px" }}>
        <input
          autoFocus value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateFile(parentId);
            if (e.key === "Escape") { setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null); }
          }}
          onBlur={() => handleCreateFile(parentId)}
          placeholder="имя_файла.ts"
          style={inputStyle}
          data-testid="input-new-file-name"
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "#0e0e0e" }}
      onClick={() => setContextMenu(null)}
    >
      {/* Section header */}
      <div style={{ padding: "10px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
              Файлы
            </span>
            <AnimatePresence>
              {newlyAddedCount > 0 && (
                <motion.span
                  key="added-badge"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{ fontSize: 9, color: "#3FB950", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                >
                  +{newlyAddedCount}
                </motion.span>
              )}
              {recentDeletedCount > 0 && (
                <motion.span
                  key="deleted-badge"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{ fontSize: 9, color: "#F78166", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                >
                  -{recentDeletedCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {!isReadOnly && (
              <>
                <button
                  onClick={() => { setIsCreatingFolder(true); setNewFolderName(""); }}
                  title="Новая папка"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "3px 4px", borderRadius: 5, lineHeight: 0 }}
                  className="hover:!text-white/60 transition-colors"
                  data-testid="btn-new-folder"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={() => { setIsCreatingFile(true); setNewFileName(""); setCreatingInFolderId(null); }}
                  title="Новый файл"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "3px 4px", borderRadius: 5, lineHeight: 0 }}
                  className="hover:!text-white/60 transition-colors"
                  data-testid="btn-new-file"
                >
                  <FilePlus size={13} />
                </button>
              </>
            )}
            <a
              href={`${basePath}/api/rooms/${roomId}/download`}
              download
              title="Скачать всё (ZIP)"
              style={{ color: "rgba(255,255,255,0.3)", padding: "3px 4px", lineHeight: 0, display: "flex", alignItems: "center", borderRadius: 5 }}
              className="hover:!text-white/60 transition-colors"
              data-testid="btn-download-zip"
            >
              <Archive size={13} />
            </a>
          </div>
        </div>
        {isReadOnly && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>только чтение</p>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedFileIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ flexShrink: 0, overflow: "hidden" }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px",
              background: "rgba(255,123,114,0.07)",
              borderBottom: "1px solid rgba(255,123,114,0.15)",
            }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flex: 1 }}>
                {selectedFileIds.size} выбрано
              </span>
              <button
                onClick={handleBulkDelete}
                style={{
                  fontSize: 10, color: "#FF7B72",
                  background: "rgba(255,123,114,0.1)", border: "1px solid rgba(255,123,114,0.2)",
                  borderRadius: 5, padding: "2px 8px", cursor: "pointer",
                }}
              >
                Удалить
              </button>
              <button
                onClick={() => setSelectedFileIds(new Set())}
                style={{
                  fontSize: 10, color: "rgba(255,255,255,0.35)",
                  background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px",
                }}
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New folder input */}
      {isCreatingFolder && (
        <div style={{ padding: "4px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <input
            autoFocus value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
            }}
            onBlur={handleCreateFolder}
            placeholder="название_папки"
            style={{ ...inputStyle, borderColor: "#F2CC60" }}
            data-testid="input-new-folder-name"
          />
        </div>
      )}

      {/* File list */}
      <div
        className="flex-1 overflow-y-auto py-2 px-1"
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <AnimatePresence>
          {rootFolders.map((folder, fi) => {
            const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolderId === folder.id;
            const isFolSel = selectedFileIds.has(folder.id);
            // Block-selection for folder row
            const fvi = visItems.findIndex((v) => v.id === folder.id);
            const fPrevSel = isFolSel && fvi > 0 && selectedFileIds.has(visItems[fvi - 1]?.id ?? "");
            const fNextSel = isFolSel && fvi >= 0 && fvi < visItems.length - 1 && selectedFileIds.has(visItems[fvi + 1]?.id ?? "");
            const folRadius = isFolSel ? `${fPrevSel ? 0 : 6}px ${fPrevSel ? 0 : 6}px ${fNextSel ? 0 : 6}px ${fNextSel ? 0 : 6}px` : "6px";
            void fi;
            return (
              <motion.div key={folder.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  onClick={(e) => handleItemClick(e, folder)}
                  onContextMenu={(e) => handleContextMenu(e, folder.id, folder.name, true)}
                  onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, folder.id); }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, folder.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "4px 10px", paddingLeft: isFolSel ? 10 : 12,
                    borderRadius: folRadius, cursor: "pointer",
                    background: isDragOver
                      ? "rgba(88,166,255,0.12)"
                      : isFolSel
                        ? "rgba(88,166,255,0.16)"
                        : "transparent",
                    borderLeft: isFolSel ? "2px solid rgba(88,166,255,0.4)" : "2px solid transparent",
                    marginBottom: fNextSel ? 0 : 1,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isFolSel && !isDragOver) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isDragOver ? "rgba(88,166,255,0.12)" : isFolSel ? "rgba(88,166,255,0.16)" : "transparent"; }}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="rgba(255,255,255,0.4)"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                    <path d="M3 1l4 4-4 4z" />
                  </svg>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="#F2CC60" style={{ flexShrink: 0 }}>
                    <path d="M1 3h4l1 1h5v7H1V3z" />
                  </svg>
                  <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>{folder.name}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{children.length}</span>
                </div>
                {isExpanded && (
                  <AnimatePresence>
                    {children.map((child) => renderFileItem(child, 1, visItems))}
                    {isCreatingFile && creatingInFolderId === folder.id && renderNewFileInput(folder.id)}
                  </AnimatePresence>
                )}
              </motion.div>
            );
          })}

          {rootFiles.map((file) => renderFileItem(file, 0, visItems))}
        </AnimatePresence>

        {isCreatingFile && !creatingInFolderId && renderNewFileInput(null)}

        {files.length === 0 && !isCreatingFile && !isCreatingFolder && (
          <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 16 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Нет файлов</p>
            {!isReadOnly && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", marginTop: 6 }}>Нажмите + чтобы создать</p>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 py-1 rounded-xl"
          style={{
            top: contextMenu.y, left: contextMenu.x,
            background: "rgba(10,10,14,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isFolder && (
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
              style={{ color: "rgba(255,255,255,0.75)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => {
                setIsCreatingFile(true); setNewFileName("");
                setCreatingInFolderId(contextMenu.fileId);
                setExpandedFolders((prev) => new Set(prev).add(contextMenu.fileId));
                setContextMenu(null);
              }}
            >
              Новый файл в папке
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "rgba(255,255,255,0.75)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => startRename(contextMenu.fileId, contextMenu.fileName)}
          >
            Переименовать
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "3px 0" }} />
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "#FF7B72", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => handleDeleteFile(contextMenu.fileId)}
          >
            Удалить
          </button>
        </motion.div>
      )}
    </div>
  );
}
