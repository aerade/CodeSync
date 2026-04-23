import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, lazy, Suspense } from "react";
import { ReleaseNotesDialog } from "@/components/release-notes-dialog";
import { toSummary } from "@/lib/release-notes";

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

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(true);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ version: string; releaseNotes: string | null } | null>(null);

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

    const cleanupAvailable = api.onUpdateAvailable((data) => {
      const { version, releaseNotes } = data;
      setPendingUpdate(data);
      const summary = toSummary(releaseNotes);
      toast.info(`Update available — v${version}`, {
        description: summary || "Downloading in the background…",
        duration: 12000,
        action: releaseNotes
          ? { label: "What's new", onClick: () => setReleaseNotesOpen(true) }
          : undefined,
      });
    });

    const cleanupDownloaded = api.onUpdateDownloaded?.(() => {
      toast.success("Update ready to install", {
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
        <Suspense fallback={null}>
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
