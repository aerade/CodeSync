interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="28" height="28" rx="7" fill="white" />
      {/* Left bracket < */}
      <path
        d="M10.5 8.5L6.5 14L10.5 19.5"
        stroke="#030303"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right bracket > */}
      <path
        d="M17.5 8.5L21.5 14L17.5 19.5"
        stroke="#030303"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center sync arrows (small) */}
      <path
        d="M12.5 12.5L15.5 15.5"
        stroke="#030303"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.5 12.5L12.5 15.5"
        stroke="#030303"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
