interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 42, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
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
