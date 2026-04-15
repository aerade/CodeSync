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
      <rect width="28" height="28" rx="7" fill="#0d1117" />
      <text
        x="14"
        y="19"
        textAnchor="middle"
        fontFamily="'SF Mono', 'Fira Code', 'Fira Mono', monospace"
        fontSize="11"
        fontWeight="700"
        fill="#58a6ff"
        letterSpacing="-0.5"
      >
        {"</>"}
      </text>
    </svg>
  );
}
