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
      <rect width="28" height="28" rx="7" fill="#00C2A8" />
      {/* Window frame */}
      <rect x="4" y="4.5" width="20" height="17" rx="3" stroke="#080C14" strokeWidth="1.8" fill="none" />
      {/* Title bar divider */}
      <line x1="4" y1="10" x2="24" y2="10" stroke="#080C14" strokeWidth="1.4" />
      {/* Traffic light dots */}
      <circle cx="7.2" cy="7.2" r="1.1" fill="#080C14" opacity="0.55" />
      <circle cx="10.4" cy="7.2" r="1.1" fill="#080C14" opacity="0.55" />
      {/* > prompt */}
      <path d="M 7 14.5 L 10.2 16.5 L 7 18.5" stroke="#080C14" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cursor underscore */}
      <line x1="11.8" y1="18.5" x2="17" y2="18.5" stroke="#080C14" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
