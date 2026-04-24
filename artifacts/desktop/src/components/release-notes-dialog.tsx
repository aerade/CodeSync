import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toPlainText } from "@/lib/release-notes";

interface ReleaseNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  releaseNotes: string | null;
}

export function ReleaseNotesDialog({
  open,
  onOpenChange,
  version,
  releaseNotes,
}: ReleaseNotesDialogProps) {
  const plainText = toPlainText(releaseNotes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        style={{
          background: "var(--elevated)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          fontFamily: "'Geist', system-ui, sans-serif",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--foreground)" }}>
            Что нового в v{version}
          </DialogTitle>
          <DialogDescription style={{ color: "var(--muted-foreground)" }}>
            Новая версия CodeSync загружается в фоне.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80 pr-2">
          {plainText ? (
            <pre
              className="text-sm whitespace-pre-wrap break-words leading-relaxed"
              style={{ color: "var(--foreground)", fontFamily: "inherit" }}
            >
              {plainText}
            </pre>
          ) : (
            <p
              className="text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              Нет заметок о выпуске для этой версии.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
