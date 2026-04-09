import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onMouseDown={(e) => {
            mousedownOnBackdrop.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (mousedownOnBackdrop.current && e.target === e.currentTarget) {
              onClose();
            }
            mousedownOnBackdrop.current = false;
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{
              background: "rgba(8,8,8,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(32px)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold mb-1" style={{ color: "#fff" }}>
              Войти как гость
            </h2>
            <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>
              Выберите имя для совместной работы. Прогресс не сохраняется.
            </p>

            <input
              autoFocus
              placeholder="Ваше имя"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleGuest()}
              style={{
                width: "100%",
                height: 42,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                color: "#fff",
                fontSize: 14,
                padding: "0 14px",
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                marginBottom: 12,
              }}
              data-testid="input-guest-username"
            />

            {error && (
              <p className="text-sm mb-3" style={{ color: "#ef4444" }}>{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  height: 40,
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleGuest}
                disabled={loading || !username.trim()}
                style={{
                  flex: 1,
                  height: 40,
                  background: username.trim() ? "#fff" : "rgba(255,255,255,0.08)",
                  color: username.trim() ? "#000" : "rgba(255,255,255,0.3)",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: username.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
                data-testid="btn-guest-continue"
              >
                {loading ? "..." : "Продолжить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
