import { useEffect, useState } from "react";
import { desktop, isElectron } from "@/lib/desktopBridge";
import { Download, RefreshCw, X, ChevronDown, ChevronUp } from "lucide-react";

type UpdateState =
  | { phase: "idle" }
  | { phase: "available"; version: string; releaseNotes: string | null }
  | { phase: "downloading"; version: string; releaseNotes: string | null }
  | { phase: "ready"; version: string; releaseNotes: string | null };

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;

    const api = desktop();
    if (!api.updater) return;

    const offAvailable = api.updater.onUpdateAvailable((info) => {
      setState({ phase: "available", version: info.version, releaseNotes: info.releaseNotes });
      setDismissed(false);
      setNotesOpen(false);
    });

    const offDownloaded = api.updater.onUpdateDownloaded((info) => {
      setState({ phase: "ready", version: info.version, releaseNotes: info.releaseNotes });
      setDismissed(false);
      setNotesOpen(false);
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

  const notes =
    "releaseNotes" in state && state.releaseNotes
      ? stripHtml(state.releaseNotes)
      : null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-0 rounded-lg border border-[#2A2A2F] bg-[#18181B] shadow-2xl max-w-sm w-full overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
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
            </>
          )}

          <div className="flex items-center gap-3 mt-2">
            {state.phase === "ready" && (
              <button
                onClick={handleInstall}
                className="text-xs font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
              >
                Restart &amp; update
              </button>
            )}
            {notes && (
              <button
                onClick={() => setNotesOpen((o) => !o)}
                className="flex items-center gap-0.5 text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                What&apos;s new
                {notesOpen ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 text-[#52525B] hover:text-[#A1A1AA] transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {notes && notesOpen && (
        <div className="border-t border-[#2A2A2F] px-4 py-3">
          <pre className="text-xs text-[#A1A1AA] whitespace-pre-wrap break-words max-h-48 overflow-y-auto leading-relaxed font-sans">
            {notes}
          </pre>
          {state.phase === "ready" && (
            <button
              onClick={handleInstall}
              className="mt-3 w-full rounded-md bg-[#F97316] hover:bg-[#EA6C0A] text-white text-xs font-semibold py-1.5 transition-colors"
            >
              Restart &amp; update
            </button>
          )}
        </div>
      )}
    </div>
  );
}
