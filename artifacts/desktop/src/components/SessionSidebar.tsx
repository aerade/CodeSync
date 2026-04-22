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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function handleLogout() {
    clearAuth();
    navigate("/");
  }

  return (
    <div
      className="flex flex-col items-center py-2 gap-1 border-r shrink-0"
      style={{ width: "48px", borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Logo */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
        style={{ background: "var(--primary)" }}
      >
        <Code2 size={14} color="#fff" />
      </div>

      <div className="w-full h-px my-1" style={{ background: "var(--border)" }} />

      {/* Nav buttons */}
      <SidebarBtn
        icon={Home}
        label="Home"
        onClick={() => navigate("/")}
      />

      {/* Members button */}
      <div className="relative">
        <SidebarBtn
          icon={Users}
          label={`Members (${members.length})`}
          onClick={() => setShowMembers((v) => !v)}
          active={showMembers}
          badge={members.length > 1 ? members.length : undefined}
        />
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.96 }}
              className="fixed left-14 top-20 z-50 rounded-xl py-2 min-w-[180px] shadow-xl"
              style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold px-3 pb-2" style={{ color: "var(--muted-foreground)" }}>
                Members in room
              </p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:opacity-80">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: m.color || generateUserColor(m.userId), color: "#fff" }}
                  >
                    {m.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{m.username}</p>
                    {m.isGuest && (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Guest</p>
                    )}
                  </div>
                  {m.userId === currentUser?.id && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(124,111,247,0.15)", color: "var(--primary)" }}>You</span>
                  )}
                </div>
              ))}
              {room && (
                <div className="mt-2 mx-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Invite code:</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground)" }}>{room.inviteCode}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SidebarBtn icon={Activity} label="Activity" onClick={() => {}} />

      <div className="flex-1" />

      {onSettingsOpen && (
        <SidebarBtn icon={Settings} label="Settings" onClick={onSettingsOpen} />
      )}

      {/* User avatar */}
      {currentUser && (
        <div className="relative group">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ background: "var(--primary)", color: "#fff" }}
            title={currentUser.username}
          >
            {currentUser.username[0]?.toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
            title="Sign out"
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
      title={label}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
      style={{
        background: active ? "rgba(124,111,247,0.15)" : "transparent",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
      }}
    >
      <Icon size={15} />
      {badge !== undefined && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--primary)", color: "#fff", fontSize: "9px" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
