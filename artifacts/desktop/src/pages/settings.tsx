import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, EyeOff, Key, Save, Info, BellOff } from "lucide-react";
import { NOTICE_KEYS, resetAllNotices } from "@/lib/notices";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_RESET_MESSAGE = "Banner will reappear on the home screen.";

const NOTICES: { key: string; label: string; description: string; resetMessage?: string }[] = [
  {
    key: NOTICE_KEYS.noApiKeysBanner,
    label: "No AI API keys banner",
    description: "Shown on the home screen when no OpenAI or Anthropic key has been configured. Dismissing it hides the banner until you reset it here.",
    resetMessage: "The API keys notice will reappear on the home screen until keys are added.",
  },
];

function readDismissed(key: string): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(key) === "true";
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const snapshot: Record<string, boolean> = {};
    for (const { key } of NOTICES) {
      snapshot[key] = readDismissed(key);
    }
    setDismissed(snapshot);
    const api = window.electronAPI;
    if (!api) return;
    api.getSettings().then((s) => {
      setOpenaiKey(s.openaiApiKey ?? "");
      setAnthropicKey(s.anthropicApiKey ?? "");
    });
    api.getAppVersion().then(setVersion).catch(() => {});
  }, [open]);

  const handleSave = async () => {
    const api = window.electronAPI;
    if (!api) {
      toast.error("Settings only available in the desktop app");
      return;
    }
    setSaving(true);
    try {
      await api.saveSettings({ openaiApiKey: openaiKey, anthropicApiKey: anthropicKey });
      toast.success("Settings saved. Server restarted with new keys.");
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetOne = (key: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
    setDismissed((prev) => ({ ...prev, [key]: false }));
    window.dispatchEvent(new CustomEvent("noticesReset"));
    const notice = NOTICES.find((n) => n.key === key);
    toast.success(notice?.resetMessage ?? DEFAULT_RESET_MESSAGE, {
      description: notice?.description,
    });
  };

  const handleResetAll = () => {
    resetAllNotices();
    const cleared: Record<string, boolean> = {};
    for (const { key } of NOTICES) {
      cleared[key] = false;
    }
    setDismissed(cleared);
    window.dispatchEvent(new CustomEvent("noticesReset"));
    toast.success("All notices have been reset.");
  };

  const anyDismissed = NOTICES.some(({ key }) => dismissed[key]);

  const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Key className="h-5 w-5 text-[var(--accent)]" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-[var(--muted)]">
            Configure AI providers to enable code review and chat features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* OpenAI */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              OpenAI API Key
              <span className="ml-2 text-xs text-[var(--muted)]">(GPT-4o mini)</span>
            </Label>
            <div className="relative">
              <Input
                type={showOpenai ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                disabled={!isElectron}
                className="pr-10 bg-[var(--elevated)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setShowOpenai(!showOpenai)}
              >
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Get your key at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          {/* Anthropic */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Anthropic API Key
              <span className="ml-2 text-xs text-[var(--muted)]">(Claude — preferred)</span>
            </Label>
            <div className="relative">
              <Input
                type={showAnthropic ? "text" : "password"}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                disabled={!isElectron}
                className="pr-10 bg-[var(--elevated)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setShowAnthropic(!showAnthropic)}
              >
                {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Get your key at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>

          <Separator className="bg-[var(--border)]" />

          {/* Notices */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Notices</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!anyDismissed}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] h-auto py-0.5 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleResetAll}
              >
                Reset all
              </Button>
            </div>
            <div className="space-y-1">
              {NOTICES.map(({ key, label, description }) => {
                const isDismissed = !!dismissed[key];
                return (
                  <div
                    key={key}
                    className={`flex items-start justify-between rounded-lg px-3 py-2.5 bg-[var(--elevated)] ${isDismissed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <BellOff className="h-4 w-4 text-[var(--muted)] mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[var(--foreground)]">{label}</span>
                          {isDismissed ? (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                              Dismissed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/25">
                              Visible
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5 leading-snug">{description}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isDismissed}
                      className="text-xs border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 self-start"
                      onClick={() => handleResetOne(key)}
                    >
                      Reset
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="bg-[var(--border)]" />

          {/* Info */}
          <div className="flex items-start gap-2 rounded-lg bg-[var(--elevated)] p-3 text-xs text-[var(--muted)]">
            <Info className="h-4 w-4 mt-0.5 text-[var(--accent)] flex-shrink-0" />
            <div>
              Keys are stored encrypted on your device using the OS keychain.
              They are never sent to CodeSync servers — only directly to OpenAI/Anthropic.
              If both keys are set, Anthropic is preferred.
            </div>
          </div>

          {!isElectron && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-300">
              Settings are only available in the desktop application.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--muted)]">CodeSync v{version}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}
              className="border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !isElectron}
              className="bg-[var(--accent)] text-white hover:opacity-90"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save Settings
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
