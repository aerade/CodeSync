import { useState } from "react";
import { Sparkles, Github } from "lucide-react";
import { useAuth, type Provider } from "@/store/auth";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function SignInScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState<Provider | null>(null);

  const handleSignIn = async (provider: Provider) => {
    setLoading(provider);
    await signIn(provider);
    setLoading(null);
  };

  return (
    <div className="h-screen w-screen bg-[#0A0A0C] flex items-center justify-center overflow-hidden relative">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#F97316]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[#F97316]/3 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px] mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] grid place-items-center shadow-[0_0_48px_rgba(249,115,22,0.4)] mb-4">
            <Sparkles className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-semibold text-zinc-100 tracking-tight">Войдите, чтобы продолжить</h1>
          <p className="text-[13.5px] text-zinc-500 mt-1.5 text-center leading-relaxed">
            CodeSync Desktop — совместная работа над кодом в реальном времени
          </p>
        </div>

        {/* Sign-in buttons */}
        <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <SignInButton
            provider="google"
            label="Войти через Google"
            loading={loading === "google"}
            disabled={loading !== null}
            onClick={() => handleSignIn("google")}
            icon={<GoogleIcon className="w-[18px] h-[18px]" />}
          />
          <div className="h-2.5" />
          <SignInButton
            provider="github"
            label="Войти через GitHub"
            loading={loading === "github"}
            disabled={loading !== null}
            onClick={() => handleSignIn("github")}
            icon={<Github className="w-[18px] h-[18px]" strokeWidth={2} />}
            dark
          />

          <p className="mt-5 text-center text-[11.5px] text-zinc-600 leading-relaxed">
            Входя, вы принимаете{" "}
            <span className="text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2">
              условия использования
            </span>{" "}
            и{" "}
            <span className="text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2">
              политику конфиденциальности
            </span>
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: "Совместная работа", sub: "CRDT в реальном времени" },
            { label: "Local-first", sub: "Файлы только у вас" },
            { label: "ИИ-помощник", sub: "Контекст всего проекта" },
          ].map((f) => (
            <div key={f.label} className="bg-white/[0.03] border border-white/6 rounded-xl p-3 text-center">
              <div className="text-[12px] font-medium text-zinc-300">{f.label}</div>
              <div className="text-[10.5px] text-zinc-600 mt-0.5">{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignInButton({
  label, loading, disabled, onClick, icon, dark,
}: {
  provider: Provider;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-[14px] font-medium transition-all",
        "border focus:outline-none focus:ring-2 focus:ring-[#F97316]/40",
        dark
          ? "bg-[#0F0F11] border-white/10 text-zinc-200 hover:bg-[#1A1A1F] hover:border-white/20 active:scale-[0.98]"
          : "bg-white border-white/20 text-[#111] hover:bg-zinc-100 active:scale-[0.98]",
        disabled && "opacity-60 cursor-not-allowed active:scale-100",
      )}
    >
      {loading ? (
        <span className="w-[18px] h-[18px] rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon
      )}
      <span>{label}</span>
    </button>
  );
}
