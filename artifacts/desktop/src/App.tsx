import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Room from "@/pages/room";
import SettingsDialog from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/room/:roomId" component={Room} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenSettings) return;
    const cleanup = api.onOpenSettings(() => setSettingsOpen(true));
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
