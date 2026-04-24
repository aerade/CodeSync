interface LoadingScreenProps {
  exiting?: boolean;
}

export function LoadingScreen({ exiting = false }: LoadingScreenProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        gap: "1.5rem",
        opacity: exiting ? 0 : 1,
        transition: exiting ? "opacity 250ms ease-out" : "opacity 300ms ease-in",
        pointerEvents: exiting ? "none" : "auto",
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes cs-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cs-logo-pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes cs-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cs-progress {
          0% { width: 0%; opacity: 1; }
          70% { width: 85%; opacity: 1; }
          100% { width: 95%; opacity: 0.7; }
        }
        .cs-logo-wrap {
          animation: cs-logo-pulse 2s ease-in-out infinite;
        }
        .cs-label {
          animation: cs-fadein 0.4s ease-out 0.1s both;
        }
        .cs-spinner-wrap {
          animation: cs-fadein 0.4s ease-out 0.2s both;
        }
        .cs-progress-bar {
          animation: cs-progress 8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>

      <div className="cs-logo-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, #7C6FF7 0%, #9B8FFB 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 32px rgba(124,111,247,0.35)",
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 6L3 12L8 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 6L21 12L16 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <div className="cs-label" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>CodeSync</span>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", letterSpacing: "0.02em" }}>Загрузка...</span>
      </div>

      <div className="cs-spinner-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "2px solid var(--border)",
            borderTopColor: "var(--primary)",
            animation: "cs-spin 0.7s linear infinite",
          }}
          role="status"
          aria-label="Загрузка…"
        />
        <div style={{ width: "160px", height: "2px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
          <div
            className="cs-progress-bar"
            style={{ height: "100%", background: "var(--primary)", borderRadius: "2px", width: "0%" }}
          />
        </div>
      </div>
    </div>
  );
}
