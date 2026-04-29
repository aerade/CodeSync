import { useEffect, useState } from "react";
import { desktop, isElectron } from "@/lib/desktopBridge";
import { Download, RefreshCw, X } from "lucide-react";

type UpdateState =
  | { phase: "idle" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; version: string }
  | { phase: "ready"; version: string };

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;

    const api = desktop();
    if (!api.updater) return;

    const offAvailable = api.updater.onUpdateAvailable((info) => {
      setState({ phase: "available", version: info.version });
      setDismissed(false);
    });

    const offDownloaded = api.updater.onUpdateDownloaded((info) => {
      setState({ phase: "ready", version: info.version });
      setDismissed(false);
    });

    return () => {
      offAvailable();
      offDownloaded();
    };
  }, []);

  if (dismissed || state.phase === "idle") return null;

  const handleInstall = () => {
    desktop().updater?.installUpdate();
  };

  const handleDismiss = () => setDismissed(true);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-lg border border-[#2A2A2F] bg-[#18181B] px-4 py-3 shadow-2xl max-w-sm w-full">
      <div className="mt-0.5 shrink-0 text-[#F97316]">
        {state.phase === "ready" ? (
          <RefreshCw className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {state.phase === "available" && (
          <>
            <p className="text-sm font-medium text-white leading-snug">
              Update available — v{state.version}
            </p>
            <p className="text-xs text-[#71717A] mt-0.5">
              Downloading in the background&hellip;
            </p>
          </>
        )}

        {state.phase === "ready" && (
          <>
            <p className="text-sm font-medium text-white leading-snug">
              Ready to update — v{state.version}
            </p>
            <p className="text-xs text-[#71717A] mt-0.5">
              Restart the app to apply the update.
            </p>
            <button
              onClick={handleInstall}
              className="mt-2 text-xs font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
            >
              Restart &amp; update
            </button>
          </>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="shrink-0 text-[#52525B] hover:text-[#A1A1AA] transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
