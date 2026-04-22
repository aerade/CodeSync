import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, EyeOff, Key, Save, Info } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState("1.0.0");

  useEffect(() => {
    if (!open) return;
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
