import { useState } from "react";
import { Github, Mail, ArrowLeft, Sparkles } from "lucide-react";
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

type Step =
  | "start"
  | "password"
  | "code-verify"
  | "forgot"
  | "register";

export function SignInScreen() {
  const {
    signIn,
    signInWithEmail,
    signInWithEmailCode,
    requestEmailCode,
    register,
    loading: authLoading,
    error: authError,
  } = useAuth();

  const [step, setStep] = useState<Step>("start");
  const [oauthActive, setOauthActive] = useState<"google" | "github" | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState<string | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthActive(provider);
    await signIn(provider);
    setOauthActive(null);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmail(email, password);
  };

  const handleSendCode = async () => {
    await requestEmailCode(email);
    setStep("code-verify");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmailCode(email, code);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) { setRegError("Пароли не совпадают"); return; }
    if (regPassword.length < 6) { setRegError("Пароль должен быть не менее 6 символов"); return; }
    await register(regEmail, regPassword);
  };

  const goBack = () => {
    setStep("start");
    setPassword("");
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
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] grid place-items-center shadow-[0_0_48px_rgba(249,115,22,0.4)] mb-4">
            <Sparkles className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-semibold text-zinc-100 tracking-tight">
            {step === "register" ? "Создайте аккаунт" : "Войдите, чтобы продолжить"}
          </h1>
        </div>

        {/* ── START STEP ── */}
        {step === "start" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-4">

            {/* OAuth row */}
            {oauthActive ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="w-6 h-6 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
                <p className="text-[12.5px] text-zinc-400 text-center">
                  Открываем браузер для входа через {oauthActive === "google" ? "Google" : "GitHub"}…
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <OAuthButton
                  label="Google"
                  icon={<GoogleIcon className="w-[17px] h-[17px]" />}
                  onClick={() => handleOAuth("google")}
                  disabled={!!oauthActive}
                  light
                />
                <OAuthButton
                  label="GitHub"
                  icon={<Github className="w-[16px] h-[16px]" strokeWidth={2} />}
                  onClick={() => handleOAuth("github")}
                  disabled={!!oauthActive}
                />
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-zinc-600">или через email</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Email + Continue */}
            <form onSubmit={handleContinue} className="flex flex-col gap-2.5">
              <Input
                type="email"
                placeholder="Электронная почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <PrimaryButton type="submit" label="Продолжить" loading={false} disabled={!email.trim()} />
            </form>

            <TermsNote />
          </div>
        )}

        {/* ── PASSWORD STEP ── */}
        {step === "password" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={goBack} />

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2.5">
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
              />
              <PrimaryButton type="submit" label="Войти" loading={authLoading} disabled={authLoading || !password} />
            </form>

            {authError && <ErrorNote msg={authError} />}

            <div className="flex flex-col gap-1.5 pt-1">
              <TextLink onClick={handleSendCode} label="Войти по коду на почте" />
              <TextLink onClick={() => setStep("forgot")} label="Забыли пароль?" />
            </div>

            <Divider />
            <TextLink
              onClick={() => { setStep("register"); setRegEmail(email); }}
              label="Нет аккаунта — зарегистрироваться"
              highlight
            />
            <TermsNote />
          </div>
        )}

        {/* ── CODE VERIFY STEP ── */}
        {step === "code-verify" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={() => setStep("password")} />

            <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
              Мы отправили 6-значный код на <span className="text-zinc-200">{email}</span>
            </p>

            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2.5">
              <Input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                className="text-center text-[22px] tracking-[0.35em] font-mono"
              />
              <PrimaryButton
                type="submit"
                label="Подтвердить"
                loading={authLoading}
                disabled={authLoading || code.length !== 6}
              />
            </form>

            {authError && <ErrorNote msg={authError} />}

            <TextLink onClick={handleSendCode} label="Отправить код повторно" />
            <TermsNote />
          </div>
        )}

        {/* ── FORGOT PASSWORD STEP ── */}
        {step === "forgot" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={() => setStep("password")} />
            <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
              Отправим ссылку для сброса пароля на <span className="text-zinc-200">{email}</span>
            </p>
            <PrimaryButton
              type="button"
              label="Отправить письмо"
              loading={authLoading}
              disabled={authLoading}
              onClick={handleSendCode}
            />
            <TermsNote />
          </div>
        )}

        {/* ── REGISTER STEP ── */}
        {step === "register" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={regEmail} onBack={goBack} label="Уже есть аккаунт — войти" />

            <form onSubmit={handleRegister} className="flex flex-col gap-2.5">
              <Input
                type="email"
                placeholder="Электронная почта"
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
              {regError && <ErrorNote msg={regError} />}
              {authError && <ErrorNote msg={authError} />}
              <PrimaryButton
                type="submit"
                label="Создать аккаунт"
                loading={authLoading}
                disabled={authLoading}
              />
            </form>

            <TermsNote />
          </div>
        )}
      </div>
    </div>
  );
}

function BackRow({ email, onBack, label }: { email: string; onBack: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors w-fit"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      {label ?? <span className="truncate max-w-[220px]">{email}</span>}
    </button>
  );
}

function OAuthButton({
  label, icon, onClick, disabled, light,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 rounded-xl flex items-center justify-center gap-2 text-[13.5px] font-medium transition-all border",
        "focus:outline-none active:scale-[0.98]",
        light
          ? "bg-white border-white/20 text-[#111] hover:bg-zinc-100"
          : "bg-[#0F0F11] border-white/10 text-zinc-200 hover:bg-[#1A1A1F] hover:border-white/20",
        disabled && "opacity-60 cursor-not-allowed active:scale-100",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function PrimaryButton({
  label, loading, disabled, type, onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  type: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold transition-all",
        "bg-[#F97316] text-white hover:bg-[#EA6C0A] active:scale-[0.98]",
        "focus:outline-none focus:ring-2 focus:ring-[#F97316]/40",
        disabled && "opacity-60 cursor-not-allowed active:scale-100",
      )}
    >
      {loading
        ? <span className="w-[18px] h-[18px] rounded-full border-2 border-white border-t-transparent animate-spin" />
        : label}
    </button>
  );
}

function TextLink({ onClick, label, highlight }: { onClick: () => void; label: string; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[12.5px] text-center transition-colors w-full",
        highlight
          ? "text-[#F97316] hover:text-[#EA6C0A]"
          : "text-zinc-500 hover:text-zinc-300",
      )}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-white/6" />;
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
      <p className="text-[12px] text-red-400 text-center">{msg}</p>
    </div>
  );
}

function TermsNote() {
  return (
    <p className="text-center text-[11px] text-zinc-600 leading-relaxed">
      Входя, вы принимаете{" "}
      <span className="text-zinc-500 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2">
        условия использования
      </span>{" "}
      и{" "}
      <span className="text-zinc-500 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2">
        политику конфиденциальности
      </span>
    </p>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
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
