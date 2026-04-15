import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#030303", color: "#f0f0f0", fontFamily: "'Inter', sans-serif" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-6"
      >
        <div className="flex items-center gap-2.5 mb-12">
          <Logo size={26} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>СИНХРОН</span>
        </div>

        <div
          style={{
            fontSize: "clamp(80px, 15vw, 140px)",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-6px",
            color: "rgba(255,255,255,0.06)",
            marginBottom: 16,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          404
        </div>

        <div
          style={{
            width: 40,
            height: 3,
            background: "#00C2A8",
            borderRadius: 2,
            marginBottom: 24,
          }}
        />

        <h1
          style={{
            fontSize: "clamp(20px, 3vw, 28px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.5px",
            marginBottom: 12,
          }}
        >
          Страница не найдена
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.38)",
            lineHeight: 1.6,
            maxWidth: 360,
            marginBottom: 36,
          }}
        >
          Похоже, этой страницы не существует или она была перемещена.
        </p>

        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 transition-all hover:opacity-90 active:scale-95"
          style={{
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: 12,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 0 40px rgba(255,255,255,0.1)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          На главную
        </button>
      </motion.div>
    </div>
  );
}
