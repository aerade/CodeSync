import { useState, useCallback } from "react";
import { Github, ArrowLeft, Sparkles, Eye, EyeOff, Wand2 } from "lucide-react";
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

type Step = "start" | "password" | "code-verify" | "forgot" | "register";

function generatePassword(len = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+";
  const all = upper + lower + digits + symbols;
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let pwd = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
    ...Array.from({ length: len - 4 }, (_, i) => all[arr[i + 4] % all.length]),
  ];
  crypto.getRandomValues(arr);
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join("");
}

type StrengthLevel = "weak" | "fair" | "good" | "strong";

function getStrength(pwd: string): { level: StrengthLevel; label: string; color: string; width: string } {
  if (!pwd) return { level: "weak", label: "", color: "", width: "0%" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: "weak",   label: "Слабый",    color: "#ef4444", width: "20%" };
  if (score === 2) return { level: "fair",   label: "Средний",   color: "#f97316", width: "45%" };
  if (score === 3) return { level: "good",   label: "Хороший",   color: "#eab308", width: "70%" };
  return               { level: "strong", label: "Надёжный",  color: "#22c55e", width: "100%" };
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");

  const [devCode, setDevCode] = useState<string | null>(null);

  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const strength = getStrength(regPassword);

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthActive(provider);
    await signIn(provider);
    setOauthActive(null);
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmail(email, password);
  };

  const handleSendCode = async () => {
    const returned = await requestEmailCode(email);
    setDevCode(returned);
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

  const handleGeneratePassword = useCallback(() => {
    const pwd = generatePassword();
    setRegPassword(pwd);
    setRegConfirm(pwd);
    setShowRegPassword(true);
  }, []);

  const goBack = () => {
    setStep("start");
    setPassword("");
    setCode("");
    setDevCode(null);
    setRegError(null);
  };

  return (
    <div className="h-screen w-screen bg-[#0A0A0C] flex items-center justify-center overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#F97316]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[#F97316]/3 blur-[100px]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

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

        {/* ── START ── */}
        {step === "start" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-4">
            {oauthActive ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="w-6 h-6 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
                <p className="text-[12.5px] text-zinc-400 text-center">
                  Открываем браузер для входа через {oauthActive === "google" ? "Google" : "GitHub"}…
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <OAuthButton label="Google" icon={<GoogleIcon className="w-[17px] h-[17px]" />}
                  onClick={() => handleOAuth("google")} disabled={!!oauthActive} light />
                <OAuthButton label="GitHub" icon={<Github className="w-[16px] h-[16px]" strokeWidth={2} />}
                  onClick={() => handleOAuth("github")} disabled={!!oauthActive} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-zinc-600">или через email</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            <form onSubmit={handleContinue} className="flex flex-col gap-2.5">
              <Input type="email" placeholder="Электронная почта" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              <PrimaryButton type="submit" label="Продолжить" loading={false} disabled={!email.trim()} />
              <TextLink
                onClick={() => { setStep("register"); setRegEmail(email); }}
                label="Нет аккаунта? Зарегистрироваться"
                highlight
              />
            </form>

            <TermsNote />
          </div>
        )}

        {/* ── PASSWORD ── */}
        {step === "password" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={goBack} />

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2.5">
              <PasswordInput
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword(v => !v)}
                placeholder="Пароль"
                autoFocus
                autoComplete="current-password"
              />
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => setStep("forgot")}
                  className="text-[11.5px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  Забыли пароль?
                </button>
              </div>
              <PrimaryButton type="submit" label="Войти" loading={authLoading} disabled={authLoading || !password} />
            </form>

            {authError && <ErrorNote msg={authError} />}

            <TextLink onClick={handleSendCode} label="Войти по коду на почте" />
            <TermsNote />
          </div>
        )}

        {/* ── CODE VERIFY ── */}
        {step === "code-verify" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={() => setStep("password")} />
            {devCode ? (
              <div className="rounded-xl bg-[#F97316]/10 border border-[#F97316]/25 px-4 py-3 flex flex-col items-center gap-1">
                <p className="text-[11px] text-[#F97316]/80 text-center">SMTP не настроен — код для входа:</p>
                <p className="text-[28px] font-mono font-bold tracking-[0.3em] text-[#F97316] select-all">{devCode}</p>
              </div>
            ) : (
              <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
                Мы отправили 6-значный код на <span className="text-zinc-200">{email}</span>
              </p>
            )}
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2.5">
              <Input type="text" placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required autoFocus autoComplete="one-time-code" inputMode="numeric"
                className="text-center text-[22px] tracking-[0.35em] font-mono" />
              <PrimaryButton type="submit" label="Подтвердить" loading={authLoading}
                disabled={authLoading || code.length !== 6} />
            </form>
            {authError && <ErrorNote msg={authError} />}
            <TextLink onClick={handleSendCode} label="Отправить код повторно" />
            <TermsNote />
          </div>
        )}

        {/* ── FORGOT ── */}
        {step === "forgot" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow email={email} onBack={() => setStep("password")} />
            <p className="text-[13px] text-zinc-400 text-center leading-relaxed">
              Отправим ссылку для сброса пароля на <span className="text-zinc-200">{email}</span>
            </p>
            <PrimaryButton type="button" label="Отправить письмо" loading={authLoading}
              disabled={authLoading} onClick={handleSendCode} />
            <TermsNote />
          </div>
        )}

        {/* ── REGISTER ── */}
        {step === "register" && (
          <div className="bg-[#18181B] border border-white/8 rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <BackRow onBack={goBack} label="Уже есть аккаунт — войти" email="" />

            <form onSubmit={handleRegister} className="flex flex-col gap-2.5">
              <Input type="email" placeholder="Электронная почта" value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" />

              <div className="flex flex-col gap-1">
                <PasswordInput
                  value={regPassword}
                  onChange={setRegPassword}
                  show={showRegPassword}
                  onToggleShow={() => setShowRegPassword(v => !v)}
                  onGenerate={handleGeneratePassword}
                  placeholder="Пароль"
                  autoComplete="new-password"
                />
                {regPassword && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: strength.width, background: strength.color }}
                      />
                    </div>
                    <span className="text-[11px] shrink-0 transition-colors" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <PasswordInput
                value={regConfirm}
                onChange={setRegConfirm}
                show={showRegPassword}
                onToggleShow={() => setShowRegPassword(v => !v)}
                placeholder="Подтвердите пароль"
                autoComplete="new-password"
              />

              {regError && <ErrorNote msg={regError} />}
              {authError && <ErrorNote msg={authError} />}
              <PrimaryButton type="submit" label="Создать аккаунт" loading={authLoading} disabled={authLoading} />
            </form>

            <TermsNote />
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggleShow, onGenerate, placeholder, autoFocus, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  onGenerate?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        required
        className={cn(
          "w-full h-11 rounded-xl bg-white/[0.05] border border-white/10 text-[14px] text-zinc-100 placeholder:text-zinc-600",
          "focus:outline-none focus:border-[#F97316]/50 focus:ring-1 focus:ring-[#F97316]/30 transition-all",
          onGenerate ? "pl-3.5 pr-20" : "pl-3.5 pr-11",
        )}
      />
      <div className="absolute right-1.5 flex items-center gap-0.5">
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            title="Сгенерировать пароль"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-[#F97316] hover:bg-white/5 transition-all"
          >
            <Wand2 className="w-[15px] h-[15px]" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleShow}
          title={show ? "Скрыть пароль" : "Показать пароль"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
        >
          {show ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
        </button>
      </div>
    </div>
  );
}

function BackRow({ email, onBack, label }: { email: string; onBack: () => void; label?: string }) {
  return (
    <button type="button" onClick={onBack}
      className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors w-fit">
      <ArrowLeft className="w-3.5 h-3.5" />
      {label ?? <span className="truncate max-w-[220px]">{email}</span>}
    </button>
  );
}

function OAuthButton({ label, icon, onClick, disabled, light }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled: boolean; light?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "h-10 rounded-xl flex items-center justify-center gap-2 text-[13.5px] font-medium transition-all border focus:outline-none active:scale-[0.98]",
        light ? "bg-white border-white/20 text-[#111] hover:bg-zinc-100"
              : "bg-[#0F0F11] border-white/10 text-zinc-200 hover:bg-[#1A1A1F] hover:border-white/20",
        disabled && "opacity-60 cursor-not-allowed active:scale-100",
      )}>
      {icon}<span>{label}</span>
    </button>
  );
}

function PrimaryButton({ label, loading, disabled, type, onClick }: {
  label: string; loading: boolean; disabled: boolean; type: "button" | "submit"; onClick?: () => void;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn(
        "w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold transition-all",
        "bg-[#F97316] text-white hover:bg-[#EA6C0A] active:scale-[0.98]",
        "focus:outline-none focus:ring-2 focus:ring-[#F97316]/40",
        disabled && "opacity-60 cursor-not-allowed active:scale-100",
      )}>
      {loading
        ? <span className="w-[18px] h-[18px] rounded-full border-2 border-white border-t-transparent animate-spin" />
        : label}
    </button>
  );
}

function TextLink({ onClick, label, highlight }: { onClick: () => void; label: string; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "text-[12.5px] text-center transition-colors w-full",
        highlight ? "text-[#F97316] hover:text-[#EA6C0A]" : "text-zinc-500 hover:text-zinc-300",
      )}>
      {label}
    </button>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
      <p className="text-[12px] text-red-400 text-center">{msg}</p>
    </div>
  );
}

const TOS_CONTENT = `УСЛОВИЯ ИСПОЛЬЗОВАНИЯ CODESYNC
Последнее обновление: 29 апреля 2026 г.

1. ПРИНЯТИЕ УСЛОВИЙ
Устанавливая, открывая или используя CodeSync («Программа»), вы соглашаетесь соблюдать настоящие Условия использования. Если вы не согласны — не устанавливайте и не используйте Программу.

2. ЛИЦЕНЗИЯ
При соблюдении настоящих Условий CodeSync предоставляет вам ограниченную, неисключительную, непередаваемую, отзывную лицензию на установку и использование Программы на устройствах, которыми вы владеете или управляете.

3. ОПИСАНИЕ СЕРВИСА
CodeSync — совместная среда разработки (IDE), обеспечивающая редактирование кода в реальном времени, синхронизацию проектов и командную работу.

4. УЧЁТНЫЕ ЗАПИСИ
Вы несёте ответственность за конфиденциальность учётных данных, за все действия под вашей учётной записью и обязаны немедленно уведомить нас о любом несанкционированном доступе.

5. ДОПУСТИМОЕ ИСПОЛЬЗОВАНИЕ
Запрещается: использовать Программу в незаконных целях; пытаться получить несанкционированный доступ к системам; осуществлять реверс-инжиниринг; распространять вредоносный код; нарушать работу Программы.

6. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ
Программа и все связанные материалы являются собственностью CodeSync и её лицензиаров. Вы сохраняете права на код, созданный вами в Программе.

7. КОНФИДЕНЦИАЛЬНОСТЬ
Использование Программы регулируется нашей Политикой конфиденциальности, которая является неотъемлемой частью настоящих Условий.

8. ОГРАНИЧЕНИЕ ОТВЕТСТВЕННОСТИ
ПРОГРАММА ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ» БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ. В МАКСИМАЛЬНОЙ СТЕПЕНИ, ДОПУСКАЕМОЙ ПРИМЕНИМЫМ ПРАВОМ, CODESYNC НЕ НЕСЁТ ОТВЕТСТВЕННОСТИ ЗА КОСВЕННЫЕ ИЛИ СЛУЧАЙНЫЕ УБЫТКИ.

9. ПРИМЕНИМОЕ ПРАВО
Настоящие Условия регулируются применимым законодательством без учёта коллизионных норм.

10. КОНТАКТЫ
По вопросам, связанным с настоящими Условиями: legal@codesync.app`;

const PRIVACY_CONTENT = `ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ CODESYNC
Последнее обновление: 29 апреля 2026 г.

1. КАКУЮ ИНФОРМАЦИЮ МЫ СОБИРАЕМ
• Данные учётной записи: email-адрес, отображаемое имя или имя пользователя.
• Данные проектов: файлы кода и конфигурации, созданные или загруженные в Программе.
• Данные об использовании: используемые функции, продолжительность сессий, выполненные действия.
• Системные данные: версия ОС, версия приложения, отчёты об ошибках.
• Данные о совместной работе: метаданные сессий (идентификаторы, временны́е метки).

2. КАК МЫ ИСПОЛЬЗУЕМ ВАШУ ИНФОРМАЦИЮ
Мы используем информацию для предоставления Программы, аутентификации, обеспечения совместной работы, отправки уведомлений, поддержки, улучшения UX, предотвращения мошенничества и соблюдения законодательства.

3. ПЕРЕДАЧА ИНФОРМАЦИИ ТРЕТЬИМ ЛИЦАМ
Мы не продаём вашу персональную информацию. Передача возможна: участникам совместной работы (имя пользователя и контент сессии), поставщикам услуг, по требованию закона, при переходе бизнеса.

4. ХРАНЕНИЕ ДАННЫХ
Данные хранятся до тех пор, пока ваша учётная запись активна. Запросить удаление: privacy@codesync.app

5. БЕЗОПАСНОСТЬ ДАННЫХ
Мы применяем надлежащие технические и организационные меры защиты. Ни один метод хранения не является полностью безопасным.

6. ВАШИ ПРАВА
Вы вправе запросить доступ, исправление, удаление, перенос данных или возражать против их обработки. Контакт: privacy@codesync.app

7. КОНФИДЕНЦИАЛЬНОСТЬ ДЕТЕЙ
Программа не предназначена для лиц младше 13 лет. Мы сознательно не собираем данные детей до 13 лет.

8. ИЗМЕНЕНИЯ В ПОЛИТИКЕ
Мы можем обновлять настоящую Политику. О существенных изменениях сообщим через обновление даты или уведомления в Программе.

9. КОНТАКТЫ
Email: privacy@codesync.app`;

function LegalModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-white/10"
        style={{ background: "#111115" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <span className="text-[14px] font-semibold text-zinc-100">{title}</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          <pre className="text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    </div>
  );
}

function TermsNote() {
  const [modal, setModal] = useState<"tos" | "privacy" | null>(null);
  return (
    <>
      <p className="text-center text-[11px] text-zinc-600 leading-relaxed">
        Входя, вы принимаете{" "}
        <span
          onClick={() => setModal("tos")}
          className="text-zinc-500 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2"
        >
          условия использования
        </span>{" "}
        и{" "}
        <span
          onClick={() => setModal("privacy")}
          className="text-zinc-500 cursor-pointer hover:text-zinc-200 transition-colors underline underline-offset-2"
        >
          политику конфиденциальности
        </span>
      </p>
      {modal === "tos" && (
        <LegalModal title="Условия использования" content={TOS_CONTENT} onClose={() => setModal(null)} />
      )}
      {modal === "privacy" && (
        <LegalModal title="Политика конфиденциальности" content={PRIVACY_CONTENT} onClose={() => setModal(null)} />
      )}
    </>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={cn(
        "w-full h-11 rounded-xl bg-white/[0.05] border border-white/10 px-3.5 text-[14px] text-zinc-100 placeholder:text-zinc-600",
        "focus:outline-none focus:border-[#F97316]/50 focus:ring-1 focus:ring-[#F97316]/30 transition-all",
        className,
      )}
    />
  );
}
