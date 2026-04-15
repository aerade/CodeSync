import logoIcon from "@assets/image_1776235333066.png";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 28, className }: LogoProps) {
  const radius = Math.round(size * 0.27);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#00C2A8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <img
        src={logoIcon}
        alt="СИНХРОН"
        style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56), display: "block" }}
      />
    </div>
  );
}
