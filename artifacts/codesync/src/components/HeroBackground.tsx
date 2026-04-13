import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  hue: number;
}

const NODE_COUNT = 80;
const CONNECT_DIST = 160;
const BASE_HUES = [210, 260, 150, 30];

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function initNodes() {
      const { w, h } = sizeRef.current;
      const nodes: Node[] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: 1.2 + Math.random() * 2,
          baseAlpha: 0.15 + Math.random() * 0.35,
          hue: BASE_HUES[Math.floor(Math.random() * BASE_HUES.length)] + (Math.random() - 0.5) * 20,
        });
      }
      nodesRef.current = nodes;
    }

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      sizeRef.current = { w, h };
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodesRef.current.length === 0) initNodes();
    }

    resize();
    window.addEventListener("resize", resize);

    function handleMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let time = 0;

    function animate() {
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      time += 0.008;
      const nodes = nodesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx!.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;

        const dx = mx - n.x;
        const dy = my - n.y;
        const md = Math.sqrt(dx * dx + dy * dy);
        if (md < 200) {
          const force = (200 - md) / 200 * 0.015;
          n.vx -= dx * force;
          n.vy -= dy * force;
        }
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 1.2) {
          n.vx *= 0.98;
          n.vy *= 0.98;
        }
      }

      ctx!.save();
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECT_DIST) continue;

          const alpha = (1 - dist / CONNECT_DIST) * 0.12;
          const hue = (a.hue + b.hue) / 2 + Math.sin(time + i * 0.1) * 10;
          ctx!.globalAlpha = alpha;
          ctx!.strokeStyle = `hsla(${hue}, 60%, 65%, 1)`;
          ctx!.lineWidth = 0.6;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
      ctx!.restore();

      ctx!.save();
      for (const n of nodes) {
        const pulse = 0.7 + Math.sin(time * 2 + n.hue * 0.01) * 0.3;
        const alpha = n.baseAlpha * pulse;

        ctx!.globalAlpha = alpha * 0.25;
        ctx!.fillStyle = `hsla(${n.hue + Math.sin(time) * 15}, 60%, 65%, 1)`;
        ctx!.shadowColor = `hsla(${n.hue}, 70%, 60%, 1)`;
        ctx!.shadowBlur = 20;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius * 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;

        ctx!.globalAlpha = alpha;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();

      const grad = ctx!.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
      grad.addColorStop(0, "rgba(3,3,3,0)");
      grad.addColorStop(1, "rgba(3,3,3,0.85)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);

      ctx!.fillStyle = "rgba(3,3,3,0.9)";
      ctx!.fillRect(0, h - 60, w, 60);
      const fadeGrad = ctx!.createLinearGradient(0, h - 120, 0, h - 60);
      fadeGrad.addColorStop(0, "rgba(3,3,3,0)");
      fadeGrad.addColorStop(1, "rgba(3,3,3,0.9)");
      ctx!.fillStyle = fadeGrad;
      ctx!.fillRect(0, h - 120, w, 60);

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
    />
  );
}
