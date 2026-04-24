import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Users, Settings, Activity, Code2, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import type { RoomMember, User } from "@/lib/api";
import { clearAuth } from "@/lib/api";
import { generateUserColor } from "@/lib/utils";

interface Props {
  roomId: string;
  members: RoomMember[];
  currentUser: User | null;
  room: { title: string; inviteCode: string; ownerId: string } | null;
  onSettingsOpen?: () => void;
}

export function SessionSidebar({ roomId, members, currentUser, room, onSettingsOpen }: Props) {
  const [, navigate] = useLocation();
  const [showMembers, setShowMembers] = useState(false);

  function handleLogout() {
    clearAuth();
    navigate("/");
  }

  return (
    <div
      className="flex flex-col items-center py-2.5 gap-0.5 border-r shrink-0"
      style={{ width: "56px", borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Logo mark */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
        style={{
          background: "linear-gradient(135deg, #7C6FF7, #9B8FFB)",
          boxShadow: "0 2px 8px rgba(124,111,247,0.3)",
        }}
      >
        <Code2 size={14} color="#fff" />
      </div>

      <div className="w-5 h-px mb-1" style={{ background: "var(--border)" }} />

      {/* Nav buttons */}
      <SidebarBtn icon={Home} label="Главная" onClick={() => navigate("/")} />

      {/* Members panel */}
      <div className="relative">
        <SidebarBtn
          icon={Users}
          label={`Участники (${members.length})`}
          onClick={() => setShowMembers((v) => !v)}
          active={showMembers}
          badge={members.length > 1 ? members.length : undefined}
        />
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ opacity: 0, x: -6, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="fixed left-[60px] top-[72px] z-50 rounded-xl py-2 min-w-[190px]"
              style={{
                background: "var(--elevated)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <p
                className="text-xs font-semibold px-3 pb-2 uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Участники
              </p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:opacity-80 transition-opacity">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: m.color || generateUserColor(m.userId), color: "#fff" }}
                  >
                    {m.username[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{m.username}</p>
                    {m.isGuest && (
                      <p className="text-xs leading-none mt-0.5" style={{ color: "var(--muted-foreground)" }}>Гость</p>
                    )}
                  </div>
                  {m.userId === currentUser?.id && (
                    <span
                      className="ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                    >
                      Вы
                    </span>
                  )}
                </div>
              ))}
              {room && (
                <div
                  className="mt-2 mx-3 pt-2 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="text-xs mb-0.5" style={{ color: "var(--muted-foreground)" }}>Код приглашения:</p>
                  <p
                    className="text-xs font-mono px-2 py-1 rounded-md"
                    style={{ color: "var(--foreground)", background: "var(--elevated-2)", letterSpacing: "0.08em" }}
                  >
                    {room.inviteCode}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SidebarBtn icon={Activity} label="Активность" onClick={() => {}} />

      <div className="flex-1" />

      {onSettingsOpen && (
        <SidebarBtn icon={Settings} label="Настройки" onClick={onSettingsOpen} />
      )}

      {/* User avatar with logout */}
      {currentUser && (
        <div className="relative group mt-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer"
            style={{ background: "var(--primary)", color: "#fff" }}
            title={currentUser.username}
          >
            {currentUser.username[0]?.toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: "var(--elevated-2)",
              border: "1px solid var(--border)",
            }}
            title="Выйти"
          >
            <LogOut size={8} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarBtn({
  icon: Icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="sidebar-tooltip relative w-9 h-9 rounded-lg flex items-center justify-center transition-all"
      data-tooltip={label}
      style={{
        background: active ? "var(--primary-muted)" : "transparent",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
        borderLeft: active ? "2px solid var(--primary)" : "2px solid transparent",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--elevated)";
          (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
        }
      }}
    >
      <Icon size={15} />
      {badge !== undefined && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
          style={{ background: "var(--primary)", color: "#fff", fontSize: "8px", boxShadow: "0 0 4px var(--primary-glow)" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
