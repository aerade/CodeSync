import { useState, useEffect } from "react";
import { User, Server, Palette, Keyboard, Info, ExternalLink, Check } from "lucide-react";
import { useAuth } from "@/store/auth";
import { getApiBase, setApiBase, invalidateApiConfig } from "@/lib/apiConfig";
import { cn } from "@/lib/utils";

type Section = "account" | "appearance" | "server" | "keybindings" | "about";

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: "account", label: "Аккаунт", icon: User },
  { id: "appearance", label: "Внешний вид", icon: Palette },
  { id: "server", label: "Сервер", icon: Server },
  { id: "keybindings", label: "Клавиши", icon: Keyboard },
  { id: "about", label: "О программе", icon: Info },
];

export function SettingsPanel() {
  const [section, setSection] = useState<Section>("account");

  return (
    <div className="w-80 shrink-0 border-l border-white/5 bg-[#0F0F11] flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">Настройки</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Nav */}
        <nav className="w-[108px] shrink-0 border-r border-white/5 py-2 flex flex-col gap-0.5 px-1.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-2 rounded-lg text-[12px] text-left transition-colors w-full",
                  active
                    ? "bg-[#F97316]/12 text-[#FB923C]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/4",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {section === "account" && <AccountSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "server" && <ServerSection />}
          {section === "keybindings" && <KeybindingsSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{children}</h3>
    </div>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 gap-2">
      <div className="min-w-0">
        <div className="text-[12.5px] text-zinc-200">{label}</div>
        {sub && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{sub}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

function AccountSection() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
        <div className="text-[13px] text-zinc-400">Вы не вошли в аккаунт</div>
      </div>
    );
  }

  return (
    <>
      <SectionTitle>Профиль</SectionTitle>
      <div className="mx-3 mb-2 bg-[#18181B] border border-white/8 rounded-xl p-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#F97316]/20 border border-[#F97316]/30 shrink-0">
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-zinc-200 truncate">{user.name}</div>
          <div className="text-[11px] text-zinc-500 truncate">{user.email}</div>
        </div>
        <span className="text-[10px] text-[#FB923C] bg-[#F97316]/10 border border-[#F97316]/20 px-1.5 py-0.5 rounded-full capitalize shrink-0">
          {user.provider}
        </span>
      </div>

      <SectionTitle>Данные</SectionTitle>
      <SettingRow label="Имя" sub={user.name} />
      <SettingRow label="Email" sub={user.email} />
      <SettingRow label="Вход через" sub={user.provider === "google" ? "Google" : "GitHub"} />

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={signOut}
          className="w-full h-8 rounded-lg bg-[#E26F6F]/10 border border-[#E26F6F]/20 text-[#E26F6F] text-[12.5px] hover:bg-[#E26F6F]/15 transition-colors"
        >
          Выйти из аккаунта
        </button>
      </div>
    </>
  );
}

function AppearanceSection() {
  const themes = [
    { id: "dark", label: "Тёмная", active: true },
    { id: "darker", label: "Глубокая тёмная", active: false },
    { id: "light", label: "Светлая", active: false },
  ];
  const accents = [
    { color: "#F97316", active: true },
    { color: "#3B82F6", active: false },
    { color: "#22C55E", active: false },
    { color: "#A855F7", active: false },
    { color: "#EC4899", active: false },
  ];

  return (
    <>
      <SectionTitle>Тема</SectionTitle>
      <div className="px-3 flex flex-col gap-1 mb-1">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "flex items-center justify-between h-8 px-2.5 rounded-lg text-[12.5px] transition-colors border",
              t.active
                ? "bg-[#F97316]/10 border-[#F97316]/30 text-[#FB923C]"
                : "bg-white/3 border-white/6 text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
            )}
          >
            {t.label}
            {t.active && <Check className="w-3 h-3" />}
          </button>
        ))}
      </div>

      <SectionTitle>Акцент</SectionTitle>
      <div className="px-3 flex gap-2 pb-2">
        {accents.map((a) => (
          <button
            key={a.color}
            type="button"
            className={cn("w-6 h-6 rounded-full transition-all", a.active && "ring-2 ring-offset-2 ring-offset-[#0F0F11] ring-white/30 scale-110")}
            style={{ background: a.color }}
            title={a.color}
          />
        ))}
      </div>

      <SectionTitle>Редактор</SectionTitle>
      <SettingRow label="Размер шрифта">
        <select className="bg-[#1F1F23] border border-white/10 text-zinc-300 text-[11.5px] rounded-md px-1.5 py-1 outline-none">
          {[12, 13, 14, 15, 16, 18].map((n) => <option key={n}>{n}px</option>)}
        </select>
      </SettingRow>
    </>
  );
}

function ServerSection() {
  const [apiUrl, setApiUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { getApiBase().then(setApiUrl); }, []);

  const save = async () => {
    await setApiBase(apiUrl);
    invalidateApiConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <SectionTitle>Подключение</SectionTitle>
      <div className="px-3 flex flex-col gap-2">
        <label className="text-[11px] text-zinc-500">Адрес API-сервера</label>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://api.codesync.app"
          className="h-8 bg-[#131316] border border-white/10 rounded-lg px-2.5 text-[12.5px] text-zinc-200 outline-none focus:border-[#F97316]/40 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={save}
          className={cn(
            "h-8 rounded-lg text-[12.5px] font-medium transition-colors",
            saved
              ? "bg-[#56C271]/15 border border-[#56C271]/30 text-[#56C271]"
              : "bg-[#F97316] text-white hover:bg-[#EA580C]",
          )}
        >
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      <SectionTitle>Статус</SectionTitle>
      <SettingRow label="Подключение" sub="api-server">
        <span className="text-[10.5px] text-[#56C271] bg-[#56C271]/10 border border-[#56C271]/20 px-2 py-0.5 rounded-full">
          Онлайн
        </span>
      </SettingRow>
    </>
  );
}

function KeybindingsSection() {
  const bindings = [
    { action: "Палитра команд", keys: ["Ctrl", "K"] },
    { action: "Открыть папку", keys: ["Ctrl", "O"] },
    { action: "Новый файл", keys: ["Ctrl", "N"] },
    { action: "Сохранить файл", keys: ["Ctrl", "S"] },
    { action: "Боковая панель", keys: ["Ctrl", "B"] },
    { action: "Терминал", keys: ["Ctrl", "`"] },
    { action: "ИИ-помощник", keys: ["Ctrl", "I"] },
    { action: "Новый терминал", keys: ["Ctrl", "⇧", "T"] },
  ];

  return (
    <>
      <SectionTitle>Горячие клавиши</SectionTitle>
      <div className="px-3 flex flex-col">
        {bindings.map((b) => (
          <div key={b.action} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
            <span className="text-[12px] text-zinc-300">{b.action}</span>
            <div className="flex items-center gap-0.5">
              {b.keys.map((k) => <span key={k} className="kbd">{k}</span>)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <SectionTitle>О программе</SectionTitle>
      <div className="mx-3 mb-3 bg-[#18181B] border border-white/8 rounded-xl p-3 flex flex-col items-center gap-2 text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] grid place-items-center">
          <span className="text-white font-bold text-base">C</span>
        </div>
        <div className="text-[14px] font-semibold text-zinc-200">CodeSync Desktop</div>
        <div className="text-[11.5px] text-zinc-500">Версия 0.1.0</div>
      </div>

      <div className="px-3 flex flex-col gap-1.5">
        {[
          { label: "Документация", href: "https://github.com/replit/codesync-desktop#readme" },
          { label: "Сообщить о проблеме", href: "#" },
          { label: "Лицензия MIT", href: "#" },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between h-8 px-2.5 bg-white/3 border border-white/6 rounded-lg text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            {l.label}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </>
  );
}
