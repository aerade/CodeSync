import { motion, AnimatePresence } from "framer-motion";

interface Member {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

interface Props {
  members: Member[];
  activeMemberIds: Set<string>;
}

export function SessionSidebar({ members, activeMemberIds }: Props) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0e0e0e", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Участники
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <AnimatePresence>
          {members.map((member) => {
            const isOnline = activeMemberIds.has(member.userId);
            return (
              <motion.div
                key={member.userId}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{
                  background: isOnline ? "rgba(255,255,255,0.04)" : "transparent",
                }}
                data-testid={`member-${member.userId}`}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: member.color, color: "#000", fontSize: 9 }}
                >
                  {member.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: isOnline ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)" }}
                    >
                      {member.username}
                    </span>
                    {member.isGuest && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>(гость)</span>
                    )}
                  </div>
                </div>
                {isOnline && (
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.6)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {members.length === 0 && (
          <p className="text-xs px-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Нет участников
          </p>
        )}
      </div>
    </div>
  );
}
