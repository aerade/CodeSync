import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (userId: string, username: string, guestToken: string) => void;
}

export function GuestModal({ open, onClose, onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Track whether mousedown started on the backdrop (not on the modal card)
  // to avoid closing when the user drags from inside the modal out to the backdrop
  const mousedownOnBackdrop = useRef(false);

  async function handleGuest() {
    const name = username.trim();
    if (!name) {
      setError("Введите имя пользователя");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch(`${basePath}/api/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });

      if (!resp.ok) {
        const data = await resp.json() as { error?: string };
        setError(data.error ?? "Ошибка создания гостевого аккаунта");
        return;
      }

      const data = await resp.json() as { token: string; user: { id: string; username: string } };
      localStorage.setItem("codesync_guest_token", data.token);
      localStorage.setItem("codesync_guest_user_id", data.user.id);
      localStorage.setItem("codesync_guest_username", data.user.username);
      onSuccess(data.user.id, data.user.username, data.token);
      onClose();
    } catch {
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onMouseDown={(e) => {
            // Record whether mousedown happened directly on the backdrop
            mousedownOnBackdrop.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            // Only close if both mousedown AND mouseup happened on the backdrop
            if (mousedownOnBackdrop.current && e.target === e.currentTarget) {
              onClose();
            }
            mousedownOnBackdrop.current = false;
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl p-6 w-full max-w-sm"
            style={{ background: "#1C2128", border: "1px solid #30363D" }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: "#E6EDF3" }}>
              Войти как гость
            </h2>
            <p className="text-sm mb-5" style={{ color: "#8B949E" }}>
              Выберите имя для совместной работы. Ваш прогресс не сохраняется.
            </p>

            <Input
              autoFocus
              placeholder="Ваше имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuest()}
              style={{
                background: "#0D1117",
                border: "1px solid #30363D",
                color: "#E6EDF3",
                marginBottom: 12,
              }}
              data-testid="input-guest-username"
            />

            {error && (
              <p className="text-sm mb-3" style={{ color: "#FF7B72" }}>{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={onClose}
                style={{ color: "#8B949E", flex: 1 }}
              >
                Отмена
              </Button>
              <Button
                onClick={handleGuest}
                disabled={loading || !username.trim()}
                style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600, flex: 1 }}
                data-testid="btn-guest-continue"
              >
                {loading ? "..." : "Продолжить"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
