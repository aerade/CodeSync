import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, lazy, Suspense } from "react";

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
      <Route path="/room/:roomId" component={Room} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(true);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    if (api.onOpenSettings) {
      const cleanup = api.onOpenSettings(() => setSettingsOpen(true));
      return cleanup;
    }
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

    const cleanupAvailable = api.onUpdateAvailable(({ version }) => {
      toast.info(`Update available — v${version}`, {
        description: "Downloading in the background…",
        duration: 8000,
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={null}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router onOpenSettings={() => setSettingsOpen(true)} hasApiKeys={hasApiKeys} />
          </WouterRouter>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
