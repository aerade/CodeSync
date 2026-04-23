export function LoadingScreen() {
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
        gap: "1.25rem",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="10" fill="var(--primary)" opacity="0.15" />
        <path
          d="M12 20 L18 14 L18 17 L28 17 L28 20 L18 20 L18 26 Z"
          fill="var(--primary)"
        />
      </svg>
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          border: "2.5px solid var(--border)",
          borderTopColor: "var(--primary)",
          animation: "codesync-spin 0.75s linear infinite",
        }}
        role="status"
        aria-label="Loading…"
      />
      <style>{`
        @keyframes codesync-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
