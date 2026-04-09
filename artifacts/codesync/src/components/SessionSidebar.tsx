import { motion, AnimatePresence } from "framer-motion";

interface Member {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

interface Event {
  id: string;
  username: string;
  description: string;
  type: string;
  createdAt: string;
}

interface Props {
  members: Member[];
  events: Event[];
  activeMemberIds: Set<string>;
}

export function SessionSidebar({ members, events, activeMemberIds }: Props) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#1C2128", borderLeft: "1px solid #30363D" }}>
      {/* Header */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid #30363D", flexShrink: 0 }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8B949E" }}>
          Участники
        </span>
      </div>

      {/* Members */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 flex flex-col gap-1">
          <AnimatePresence>
            {members.map((member) => {
              const isOnline = activeMemberIds.has(member.userId);
              return (
                <motion.div
                  key={member.userId}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{ background: isOnline ? "rgba(88,166,255,0.05)" : "transparent" }}
                  data-testid={`member-${member.userId}`}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: member.color, color: "#0D1117", fontSize: 10 }}
                  >
                    {member.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium truncate" style={{ color: "#E6EDF3" }}>
                        {member.username}
                      </span>
                      {member.isGuest && (
                        <span className="text-xs" style={{ color: "#8B949E" }}>(гость)</span>
                      )}
                    </div>
                  </div>
                  {isOnline && <span className="online-dot flex-shrink-0" />}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Events feed */}
        {events.length > 0 && (
          <>
            <div className="px-3 py-2" style={{ borderTop: "1px solid #30363D", borderBottom: "1px solid #30363D" }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8B949E" }}>
                События
              </span>
            </div>
            <div className="p-2 flex flex-col gap-1">
              <AnimatePresence>
                {events.slice(0, 8).map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: "#0D1117", border: "1px solid #30363D" }}
                  >
                    <span style={{ color: "#58A6FF", fontWeight: 500 }}>{event.username}</span>
                    <span style={{ color: "#8B949E" }}> {event.description}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
