interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#0d1117" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="'SF Mono', 'Fira Code', 'Fira Mono', monospace"
        fontSize="13"
        fontWeight="700"
        fill="#ffffff"
        letterSpacing="-0.5"
      >
        {"</>"}
      </text>
    </svg>
  );
}
