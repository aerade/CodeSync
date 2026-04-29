import { useState } from "react";
import { Sparkles, Github, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/store/auth";
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

type Mode = "oauth" | "email" | "register";
type EmailStep = "form" | "code";
type EmailMethod = "password" | "code";

export function SignInScreen() {
  const { signIn, signInWithEmail, signInWithEmailCode, requestEmailCode, register, loading: authLoading, error: authError } = useAuth();

  // OAuth state
  const [oauthProvider, setOauthProvider] = useState<"google" | "github" | null>(null);

  // Mode/tab state
  const [mode, setMode] = useState<Mode>("oauth");

  // Email login state
  const [emailMethod, setEmailMethod] = useState<EmailMethod>("password");
  const [emailStep, setEmailStep] = useState<EmailStep>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  // Register state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState<string | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthProvider(provider);
    await signIn(provider);
    setOauthProvider(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailMethod === "password") {
      await signInWithEmail(email, password);
    } else {
      await requestEmailCode(email);
      if (!authError) setEmailStep("code");
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmailCode(email, code);
  };

  const handleResendCode = async () => {
    await requestEmailCode(email);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) {
      setRegError("Пароли не совпадают");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Пароль должен быть не менее 6 символов");
      return;
    }
    await register(regEmail, regPassword);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setEmailStep("form");
    setCode("");
    setRegError(null);
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
        </div>

        {/* Main card */}
        <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-white/[0.04] border border-white/6 p-0.5 mb-5">
            {(["oauth", "email", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 h-8 rounded-[10px] text-[12.5px] font-medium transition-all",
                  mode === m
                    ? "bg-[#F97316] text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {m === "oauth" ? "OAuth" : m === "email" ? "Войти по email" : "Регистрация"}
              </button>
            ))}
          </div>

          {/* ── OAuth tab ── */}
          {mode === "oauth" && (
            <>
              {authLoading && oauthProvider ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <span className="w-7 h-7 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
                  <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
                    Открываем браузер для входа через {oauthProvider === "google" ? "Google" : "GitHub"}…<br />
                    <span className="text-zinc-600">Вернитесь сюда после авторизации</span>
                  </p>
                </div>
              ) : (
                <>
                  <SignInButton
                    label="Войти через Google"
                    loading={false}
                    disabled={!!oauthProvider}
                    onClick={() => handleOAuth("google")}
                    icon={<GoogleIcon className="w-[18px] h-[18px]" />}
                  />
                  <div className="h-2.5" />
                  <SignInButton
                    label="Войти через GitHub"
                    loading={false}
                    disabled={!!oauthProvider}
                    onClick={() => handleOAuth("github")}
                    icon={<Github className="w-[18px] h-[18px]" strokeWidth={2} />}
                    dark
                  />
                </>
              )}
            </>
          )}

          {/* ── Email login tab ── */}
          {mode === "email" && emailStep === "form" && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {emailMethod === "password" && (
                <Input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              )}

              <div className="flex gap-2">
                <MethodToggle
                  active={emailMethod === "password"}
                  onClick={() => setEmailMethod("password")}
                  label="Войти по паролю"
                />
                <MethodToggle
                  active={emailMethod === "code"}
                  onClick={() => setEmailMethod("code")}
                  label="Войти по коду на почте"
                />
              </div>

              <SignInButton
                type="submit"
                label={emailMethod === "password" ? "Войти" : "Отправить код"}
                loading={authLoading}
                disabled={authLoading}
                icon={<Mail className="w-[18px] h-[18px]" />}
                dark
              />
            </form>
          )}

          {/* ── Email code verification step ── */}
          {mode === "email" && emailStep === "code" && (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setEmailStep("form")}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors mb-1 w-fit"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Назад
              </button>
              <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
                Введите 6-значный код, отправленный на <span className="text-zinc-200">{email}</span>
              </p>
              <Input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                className="text-center text-[22px] tracking-[0.35em] font-mono"
              />
              <SignInButton
                type="submit"
                label="Подтвердить"
                loading={authLoading}
                disabled={authLoading || code.length !== 6}
                icon={<Mail className="w-[18px] h-[18px]" />}
                dark
              />
              <button
                type="button"
                onClick={handleResendCode}
                disabled={authLoading}
                className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors text-center"
              >
                Отправить код повторно
              </button>
            </form>
          )}

          {/* ── Register tab ── */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                placeholder="Пароль"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="Подтвердите пароль"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              {regError && (
                <p className="text-[12px] text-red-400 text-center">{regError}</p>
              )}
              <SignInButton
                type="submit"
                label="Зарегистрироваться"
                loading={authLoading}
                disabled={authLoading}
                icon={<Mail className="w-[18px] h-[18px]" />}
                dark
              />
            </form>
          )}

          {/* Error display (auth store errors) */}
          {authError && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[12px] text-red-400 text-center">{authError}</p>
            </div>
          )}

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
      </div>
    </div>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-11 rounded-xl bg-white/[0.05] border border-white/10 px-3.5 text-[14px] text-zinc-100 placeholder:text-zinc-600",
        "focus:outline-none focus:border-[#F97316]/50 focus:ring-1 focus:ring-[#F97316]/30 transition-all",
        className,
      )}
    />
  );
}

function MethodToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 h-8 rounded-lg text-[11.5px] font-medium border transition-all",
        active
          ? "border-[#F97316]/50 bg-[#F97316]/10 text-[#F97316]"
          : "border-white/8 bg-white/[0.03] text-zinc-500 hover:text-zinc-300 hover:border-white/12",
      )}
    >
      {label}
    </button>
  );
}

function SignInButton({
  label, loading, disabled, onClick, icon, dark, type = "button",
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  dark?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
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
