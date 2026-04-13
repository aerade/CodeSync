import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TransitionOverlayProps {
  active: boolean;
  originX?: number;
  originY?: number;
  onComplete: () => void;
}

interface TParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

const COLORS = ["#58a6ff", "#3fb950", "#d2a8ff", "#ffa657", "#79c0ff", "#fff"];

export function TransitionOverlay({ active, originX, originY, onComplete }: TransitionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTime = useRef(0);
  const completed = useRef(false);

  const runAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = originX ?? w / 2;
    const cy = originY ?? h / 2;
    const maxRadius = Math.sqrt(w * w + h * h);
    const DURATION = 1800;
    startTime.current = performance.now();
    completed.current = false;

    const particles: TParticle[] = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.8 + Math.random() * 0.2,
        life: 0,
      });
    }

    function animate(now: number) {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / DURATION, 1);

      ctx!.clearRect(0, 0, w, h);

      const eased = 1 - Math.pow(1 - progress, 3);
      const ringRadius = eased * maxRadius;

      const flashAlpha = progress < 0.15 ? progress / 0.15 * 0.6 : progress < 0.3 ? 0.6 * (1 - (progress - 0.15) / 0.15) : 0;
      if (flashAlpha > 0) {
        ctx!.globalAlpha = flashAlpha;
        ctx!.fillStyle = "#fff";
        ctx!.fillRect(0, 0, w, h);
      }

      const ringAlpha = progress < 0.5 ? 0.8 : 0.8 * (1 - (progress - 0.5) / 0.5);
      if (ringAlpha > 0 && ringRadius > 0) {
        ctx!.globalAlpha = ringAlpha;
        const grad = ctx!.createRadialGradient(cx, cy, ringRadius * 0.7, cx, cy, ringRadius);
        grad.addColorStop(0, "rgba(88,166,255,0)");
        grad.addColorStop(0.85, "rgba(88,166,255,0.3)");
        grad.addColorStop(0.95, "rgba(210,168,255,0.5)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.save();
      for (const p of particles) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        const fade = Math.max(0, 1 - p.life / 100);
        ctx!.globalAlpha = p.alpha * fade * (1 - progress * 0.5);
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 12;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;
      ctx!.restore();

      if (progress > 0.5) {
        const coverAlpha = (progress - 0.5) / 0.5;
        ctx!.globalAlpha = coverAlpha;
        ctx!.fillStyle = "#030303";
        ctx!.fillRect(0, 0, w, h);
      }

      if (progress >= 1) {
        if (!completed.current) {
          completed.current = true;
          onComplete();
        }
        return;
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
  }, [originX, originY, onComplete]);

  useEffect(() => {
    if (active) {
      runAnimation();
    }
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [active, runAnimation]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            pointerEvents: "all",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
