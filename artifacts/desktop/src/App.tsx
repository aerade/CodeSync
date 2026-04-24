import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { ReleaseNotesDialog } from "@/components/release-notes-dialog";
import { toSummary } from "@/lib/release-notes";
import { LoadingScreen } from "@/components/LoadingScreen";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const Room = lazy(() => import("@/pages/room"));
const SettingsDialog = lazy(() => import("@/pages/settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router({ onOpenSettings, hasApiKeys }: { onOpenSettings: () => void; hasApiKeys: boolean }) {
  return (
    <Switch>
      <Route path="/">
        {() => <Home onOpenSettings={onOpenSettings} hasApiKeys={hasApiKeys} />}
      </Route>
      <Route path="/room/:roomId">
        {() => <Room onOpenSettings={onOpenSettings} hasApiKeys={hasApiKeys} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ContentReady({ onReady }: { onReady: () => (() => void) | void }) {
  useEffect(() => {
    return onReady();
  }, [onReady]);
  return null;
}

const MIN_LOADER_MS = 400;
const isElectron = typeof window !== "undefined" && !!window.electronAPI;

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderFading, setLoaderFading] = useState(false);

  // In Electron: wait for server-ready IPC before hiding the loader.
  // In browser (dev server): server is assumed ready immediately.
  const [serverReady, setServerReady] = useState(!isElectron);

  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ version: string; releaseNotes: string | null } | null>(null);

  const loadStartTime = useRef(Date.now());
  const contentReadyRef = useRef(false);

  // Attempt to hide the loader — only succeeds when both content AND server are ready
  const tryHideLoader = useCallback((isServerReady: boolean) => {
    if (!contentReadyRef.current || !isServerReady) return;
    const elapsed = Date.now() - loadStartTime.current;
    const delay = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(() => {
      setLoaderFading(true);
      setTimeout(() => setShowLoader(false), 200);
    }, delay);
  }, []);

  const handleContentReady = useCallback(() => {
    contentReadyRef.current = true;
    tryHideLoader(serverReady);
  }, [serverReady, tryHideLoader]);

  // Server readiness: query current status on mount (handles the case where
  // server-ready fires before this effect subscribes) AND subscribe to future
  // events (handles the normal case where server starts after React mounts).
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onServerReady) return;

    let cancelled = false;

    // 1. Query current status immediately (race-proof)
    api.getServerStatus?.().then((status) => {
      if (cancelled) return;
      if (status.ready) {
        setServerReady(true);
        tryHideLoader(true);
      }
    }).catch(() => {});

    // 2. Also subscribe to future events (for when server starts after mount)
    const cleanupReady = api.onServerReady(() => {
      if (cancelled) return;
      setServerReady(true);
      tryHideLoader(true);
    });
    const cleanupError = api.onServerError?.((data) => {
      if (cancelled) return;
      setServerReady(true);
      tryHideLoader(true);
      toast.error("Сервер не запустился", {
        description: data.message,
        duration: Infinity,
      });
    });

    // 3. Safety net: if server-ready is missed and no error, unblock after 45s
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      setServerReady(true);
      tryHideLoader(true);
    }, 45_000);

    return () => {
      cancelled = true;
      cleanupReady?.();
      cleanupError?.();
      clearTimeout(safetyTimer);
    };
  }, [tryHideLoader]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenSettings) return;
    const cleanup = api.onOpenSettings(() => setSettingsOpen(true));
    return cleanup;
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getSettings) return;
    api.getSettings().then((s) => {
      setHasApiKeys(!!(s.openaiApiKey || s.anthropicApiKey));
    }).catch(() => {});
  }, [settingsOpen]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateAvailable) return;

    const PROGRESS_TOAST_ID = "update-download-progress";

    const cleanupAvailable = api.onUpdateAvailable((data) => {
      const { version, releaseNotes } = data;
      setPendingUpdate(data);
      toast.loading(`Downloading update v${version}…`, {
        id: PROGRESS_TOAST_ID,
        description: "Starting download…",
        duration: Infinity,
        action: releaseNotes
          ? { label: "What's new", onClick: () => setReleaseNotesOpen(true) }
          : undefined,
      });
    });

    const cleanupProgress = api.onUpdateProgress?.((data) => {
      const mbps = (data.bytesPerSecond / 1_048_576).toFixed(1);
      toast.loading(`Downloading update — ${data.percent}%`, {
        id: PROGRESS_TOAST_ID,
        description: `${mbps} MB/s`,
        duration: Infinity,
      });
    });

    const cleanupDownloaded = api.onUpdateDownloaded?.((data) => {
      toast.dismiss(PROGRESS_TOAST_ID);
      toast.success(`Update v${data.version} ready to install`, {
        description: "Restart CodeSync to apply the update.",
        duration: Infinity,
        action: {
          label: "Restart now",
          onClick: () => api.installUpdate?.(),
        },
      });
    });

    return () => {
      cleanupAvailable?.();
      cleanupProgress?.();
      cleanupDownloaded?.();
    };
  }, []);

  // Dev-only: Alt+U fires a mock update-available IPC event via the main
  // process, exercising the full onUpdateAvailable → toast → dialog path.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "u") {
        window.electronAPI?.mockUpdateAvailable?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={showLoader ? null : <LoadingScreen />}>
          <ContentReady onReady={handleContentReady} />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router onOpenSettings={() => setSettingsOpen(true)} hasApiKeys={hasApiKeys} />
          </WouterRouter>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          {pendingUpdate && (
            <ReleaseNotesDialog
              open={releaseNotesOpen}
              onOpenChange={setReleaseNotesOpen}
              version={pendingUpdate.version}
              releaseNotes={pendingUpdate.releaseNotes}
            />
          )}
        </Suspense>
        {showLoader && <LoadingScreen exiting={loaderFading} />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontFamily: "'Geist', system-ui, sans-serif",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
