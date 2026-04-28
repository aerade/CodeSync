import { useState, useEffect } from "react";
import { User, Server, Keyboard, Info, ExternalLink, Check, Monitor, Trash2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { getApiBase, setApiBase, invalidateApiConfig } from "@/lib/apiConfig";
import { cn } from "@/lib/utils";

type Section = "application" | "account" | "server" | "keybindings" | "about";

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: "application", label: "Приложение", icon: Monitor },
  { id: "account", label: "Аккаунт", icon: User },
  { id: "server", label: "Сервер", icon: Server },
  { id: "keybindings", label: "Клавиши", icon: Keyboard },
  { id: "about", label: "О программе", icon: Info },
];

export function SettingsPanel() {
  const [section, setSection] = useState<Section>("application");

  return (
    <div className="w-80 shrink-0 border-l border-white/5 bg-[#0F0F11] flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">Настройки</span>
      </div>

      <div className="flex flex-1 min-h-0">
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

        <div className="flex-1 overflow-y-auto min-w-0">
          {section === "application" && <ApplicationSection />}
          {section === "account" && <AccountSection />}
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "w-8 h-4.5 rounded-full transition-colors relative shrink-0",
        value ? "bg-[#F97316]" : "bg-white/10",
      )}
      style={{ height: "18px" }}
    >
      <span
        className={cn(
          "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all",
          value ? "left-[calc(100%-16px)]" : "left-0.5",
        )}
      />
    </button>
  );
}

function SettingRow({
  label, sub, children,
}: { label: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 gap-2">
      <div className="min-w-0">
        <div className="text-[12.5px] text-zinc-200">{label}</div>
        {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

const FONT_FAMILIES = ["JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", "Consolas", "monospace"];
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const TAB_SIZES = [2, 4, 8];

function ApplicationSection() {
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("JetBrains Mono");
  const [tabSize, setTabSize] = useState(2);
  const [wordWrap, setWordWrap] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [confirmOnClose, setConfirmOnClose] = useState(true);

  const themes = [
    { id: "dark", label: "Тёмная", active: true },
    { id: "darker", label: "Глубокая тёмная", active: false },
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
      <SectionTitle>Внешний вид</SectionTitle>
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
      <div className="px-3 flex gap-2 pb-1">
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
      <SettingRow label="Семейство шрифта">
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="bg-[#1F1F23] border border-white/10 text-zinc-300 text-[11.5px] rounded-md px-1.5 py-1 outline-none max-w-[110px]"
        >
          {FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
        </select>
      </SettingRow>
      <SettingRow label="Размер шрифта">
        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="bg-[#1F1F23] border border-white/10 text-zinc-300 text-[11.5px] rounded-md px-1.5 py-1 outline-none"
        >
          {FONT_SIZES.map((n) => <option key={n} value={n}>{n}px</option>)}
        </select>
      </SettingRow>
      <SettingRow label="Размер таба">
        <select
          value={tabSize}
          onChange={(e) => setTabSize(Number(e.target.value))}
          className="bg-[#1F1F23] border border-white/10 text-zinc-300 text-[11.5px] rounded-md px-1.5 py-1 outline-none"
        >
          {TAB_SIZES.map((n) => <option key={n} value={n}>{n} пробела</option>)}
        </select>
      </SettingRow>
      <SettingRow label="Перенос строк" sub="word wrap">
        <Toggle value={wordWrap} onChange={setWordWrap} />
      </SettingRow>

      <SectionTitle>Поведение</SectionTitle>
      <SettingRow label="Автосохранение" sub="при потере фокуса">
        <Toggle value={autoSave} onChange={setAutoSave} />
      </SettingRow>
      <SettingRow label="Подтверждение при закрытии" sub="спрашивать перед выходом">
        <Toggle value={confirmOnClose} onChange={setConfirmOnClose} />
      </SettingRow>
    </>
  );
}

function AccountSection() {
  const { user, signOut } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
        <div className="text-[13px] text-zinc-400">Вы не вошли в аккаунт</div>
      </div>
    );
  }

  const handleDeleteData = () => {
    localStorage.clear();
    signOut();
  };

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

      {/* Danger zone */}
      <div className="mx-3 mt-5 mb-3 border border-[#E26F6F]/25 rounded-xl overflow-hidden">
        <div className="bg-[#E26F6F]/6 px-3 py-2 border-b border-[#E26F6F]/20 flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5 text-[#E26F6F]" />
          <span className="text-[11.5px] font-semibold text-[#E26F6F] uppercase tracking-wider">Опасная зона</span>
        </div>
        <div className="p-3">
          <p className="text-[12px] text-zinc-500 mb-2.5 leading-relaxed">
            Удалить все локальные данные (кэш, токены, недавние проекты, настройки). Это действие необратимо.
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full h-8 rounded-lg bg-transparent border border-[#E26F6F]/30 text-[#E26F6F] text-[12px] hover:bg-[#E26F6F]/10 transition-colors"
            >
              Удалить локальные данные
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-zinc-300 text-[12px] hover:bg-white/8 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteData}
                className="flex-1 h-8 rounded-lg bg-[#E26F6F]/20 border border-[#E26F6F]/40 text-[#E26F6F] text-[12px] hover:bg-[#E26F6F]/30 transition-colors font-medium"
              >
                Подтвердить
              </button>
            </div>
          )}
        </div>
      </div>
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
    { action: "Настройки", keys: ["Ctrl", ","] },
    { action: "Новый терминал", keys: ["Ctrl", "⇧", "T"] },
    { action: "Командная строка", keys: ["Ctrl", "⇧", "P"] },
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] grid place-items-center shadow-[0_0_24px_rgba(249,115,22,0.3)]">
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

      <SectionTitle>Технологии</SectionTitle>
      <div className="px-3 pb-4 flex flex-col">
        {[
          { name: "Monaco Editor", version: "0.55" },
          { name: "Yjs CRDT", version: "13.6" },
          { name: "xterm.js", version: "6.0" },
          { name: "React", version: "19" },
          { name: "Vite", version: "7" },
        ].map((d) => (
          <div key={d.name} className="flex items-center justify-between py-1.5 border-b border-white/4 last:border-0">
            <span className="text-[12px] text-zinc-400">{d.name}</span>
            <span className="text-[11px] text-zinc-600 font-mono">v{d.version}</span>
          </div>
        ))}
      </div>
    </>
  );
}
