import { useState, useRef, useEffect } from "react";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { setRightPanelView, toggleRightPanel, showRightPanel, rightPanelView } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  const openSettings = () => {
    setOpen(false);
    setRightPanelView("settings");
    if (!showRightPanel || rightPanelView !== "settings") toggleRightPanel();
    if (showRightPanel && rightPanelView === "settings") {
    }
  };

  const initials = user.name
    .split(/[\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-1.5 rounded-md transition-colors",
          "hover:bg-white/5 text-zinc-300",
          open && "bg-white/5",
        )}
        title={user.name}
      >
        <Avatar user={user} size={22} />
        <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 z-50 bg-[#1F1F23] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* User info */}
          <div className="flex items-center gap-2.5 px-3 py-3 border-b border-white/8">
            <Avatar user={user} size={32} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-zinc-200 truncate">{user.name}</div>
              <div className="text-[11px] text-zinc-500 truncate">{user.email}</div>
            </div>
          </div>

          {/* Provider badge */}
          <div className="px-3 py-2 border-b border-white/6">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
              Вход через {user.provider === "google" ? "Google" : "GitHub"}
            </span>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <MenuItem icon={Settings} label="Настройки" onClick={openSettings} />
            <MenuItem icon={LogOut} label="Выйти" onClick={() => { setOpen(false); signOut(); }} danger />
          </div>
        </div>
      )}

      {/* Initials fallback shown only if avatar fails */}
      <style>{`
        .user-avatar-fallback { display: none; }
        .user-avatar-img:error + .user-avatar-fallback { display: flex; }
      `}</style>
    </div>
  );
}

function Avatar({ user, size }: { user: { name: string; avatarUrl: string }; size: number }) {
  const initials = user.name
    .split(/[\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div
      className="rounded-full overflow-hidden shrink-0 bg-[#F97316]/20 border border-[#F97316]/30 grid place-items-center"
      style={{ width: size, height: size }}
    >
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.style.display = "none";
          const fb = el.nextElementSibling as HTMLElement;
          if (fb) fb.style.display = "flex";
        }}
      />
      <span
        className="hidden items-center justify-center w-full h-full text-[#F97316] font-semibold"
        style={{ fontSize: size * 0.38 }}
      >
        {initials}
      </span>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof Settings;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left",
        danger
          ? "text-[#E26F6F] hover:bg-[#E26F6F]/10"
          : "text-zinc-300 hover:bg-white/5",
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
      {label}
    </button>
  );
}
