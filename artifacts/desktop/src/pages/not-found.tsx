import { useLocation } from "wouter";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="h-full flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>Страница не найдена</h1>
        <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>404</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <Home size={14} /> На главную
        </button>
      </div>
    </div>
  );
}
