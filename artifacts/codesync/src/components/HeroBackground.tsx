import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Cursor {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  trail: { x: number; y: number }[];
  blinkPhase: number;
}

interface CodeStream {
  x: number;
  y: number;
  chars: string[];
  speed: number;
  color: string;
  alpha: number;
  charIndex: number;
}

interface ArchNode {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  label: string;
  color: string;
  size: number;
  alpha: number;
  connections: number[];
}

const PALETTE = [
  "#58a6ff",
  "#3fb950",
  "#d2a8ff",
  "#ffa657",
  "#79c0ff",
  "#56d364",
  "#ff7b72",
  "#f0883e",
];

const CODE_SNIPPETS = [
  "const ws = new WebSocket(url);",
  "socket.emit('sync', delta);",
  "import { Yjs } from 'yjs';",
  "const doc = new Y.Doc();",
  "db.query('SELECT * FROM rooms');",
  "app.use(cors({ origin }));",
  "export async function handler() {",
  "await redis.publish(channel, msg);",
  "function merge(a: Node, b: Node) {",
  "return { ...state, users };",
  "io.on('connection', (s) => {",
  "const token = jwt.sign(payload);",
];

const ARCH_LABELS = ["API", "DB", "WS", "Auth", "CRDT", "CDN"];

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({
    particles: [] as Particle[],
    cursors: [] as Cursor[],
    codeStreams: [] as CodeStream[],
    archNodes: [] as ArchNode[],
    phase: 0,
    phaseTime: 0,
    globalTime: 0,
    pulseRadius: 0,
    pulseAlpha: 0,
  });

  const initCursors = useCallback((w: number, h: number) => {
    const colors = ["#58a6ff", "#3fb950", "#d2a8ff", "#ffa657", "#ff7b72"];
    return colors.map((color) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      targetX: Math.random() * w,
      targetY: Math.random() * h,
      color,
      trail: [] as { x: number; y: number }[],
      blinkPhase: Math.random() * Math.PI * 2,
    }));
  }, []);

  const initCodeStreams = useCallback((w: number, h: number) => {
    const streams: CodeStream[] = [];
    const count = Math.floor(w / 140);
    for (let i = 0; i < count; i++) {
      streams.push({
        x: (w / count) * i + Math.random() * 60,
        y: Math.random() * h,
        chars: CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)].split(""),
        speed: 0.3 + Math.random() * 0.7,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        alpha: 0.08 + Math.random() * 0.12,
        charIndex: Math.floor(Math.random() * 30),
      });
    }
    return streams;
  }, []);

  const initArchNodes = useCallback((w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    return ARCH_LABELS.map((label, i) => {
      const angle = (i / ARCH_LABELS.length) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(w, h) * 0.2;
      return {
        x: cx,
        y: cy,
        targetX: cx + Math.cos(angle) * radius,
        targetY: cy + Math.sin(angle) * radius,
        label,
        color: PALETTE[i % PALETTE.length],
        size: 28 + Math.random() * 12,
        alpha: 0,
        connections: [(i + 1) % ARCH_LABELS.length, (i + 3) % ARCH_LABELS.length],
      };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const s = stateRef.current;
      s.cursors = initCursors(w, h);
      s.codeStreams = initCodeStreams(w, h);
      s.archNodes = initArchNodes(w, h);
    }

    resize();
    window.addEventListener("resize", resize);

    const PHASE_DURATION = [6000, 2000, 3000, 4000, 2000];

    function spawnBurstParticles(cx: number, cy: number, count: number) {
      const s = stateRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        s.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 3,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          alpha: 0.6 + Math.random() * 0.4,
          life: 0,
          maxLife: 60 + Math.random() * 80,
        });
      }
    }

    function drawCodeStreams(s: typeof stateRef.current, fadeAlpha: number) {
      ctx!.save();
      ctx!.font = "12px 'JetBrains Mono', monospace";
      for (const stream of s.codeStreams) {
        stream.charIndex += stream.speed;
        stream.y -= stream.speed * 0.5;
        if (stream.y < -20) stream.y = h + 20;

        const text = stream.chars.join("");
        const ci = Math.floor(stream.charIndex) % (text.length + 10);
        const visible = text.substring(0, Math.min(ci, text.length));

        ctx!.globalAlpha = stream.alpha * fadeAlpha;
        ctx!.fillStyle = stream.color;
        ctx!.fillText(visible, stream.x, stream.y);

        if (ci < text.length) {
          ctx!.globalAlpha = (0.4 + Math.sin(s.globalTime * 0.005) * 0.3) * fadeAlpha;
          const cursorX = stream.x + ctx!.measureText(visible).width;
          ctx!.fillRect(cursorX, stream.y - 10, 2, 14);
        }
      }
      ctx!.restore();
    }

    function drawCursors(s: typeof stateRef.current, fadeAlpha: number) {
      ctx!.save();
      for (const cursor of s.cursors) {
        if (Math.random() < 0.01) {
          cursor.targetX = Math.random() * w;
          cursor.targetY = Math.random() * h;
        }
        cursor.x += (cursor.targetX - cursor.x) * 0.015;
        cursor.y += (cursor.targetY - cursor.y) * 0.015;

        cursor.trail.push({ x: cursor.x, y: cursor.y });
        if (cursor.trail.length > 30) cursor.trail.shift();

        ctx!.globalAlpha = 0.08 * fadeAlpha;
        ctx!.strokeStyle = cursor.color;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        for (let i = 0; i < cursor.trail.length; i++) {
          const t = cursor.trail[i];
          if (i === 0) ctx!.moveTo(t.x, t.y);
          else ctx!.lineTo(t.x, t.y);
        }
        ctx!.stroke();

        cursor.blinkPhase += 0.06;
        const blink = Math.sin(cursor.blinkPhase) > -0.3;
        if (blink) {
          ctx!.globalAlpha = 0.5 * fadeAlpha;
          ctx!.fillStyle = cursor.color;
          ctx!.beginPath();
          ctx!.moveTo(cursor.x, cursor.y);
          ctx!.lineTo(cursor.x + 10, cursor.y + 5);
          ctx!.lineTo(cursor.x + 4, cursor.y + 10);
          ctx!.closePath();
          ctx!.fill();

          ctx!.globalAlpha = 0.15 * fadeAlpha;
          ctx!.shadowColor = cursor.color;
          ctx!.shadowBlur = 20;
          ctx!.beginPath();
          ctx!.arc(cursor.x, cursor.y, 8, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.shadowBlur = 0;
        }
      }
      ctx!.restore();
    }

    function drawPulse(s: typeof stateRef.current) {
      if (s.pulseAlpha <= 0) return;
      ctx!.save();
      const cx = w / 2;
      const cy = h / 2;

      for (let i = 0; i < 3; i++) {
        const r = s.pulseRadius * (1 - i * 0.15);
        if (r <= 0) continue;
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(88,166,255,${0.15 * s.pulseAlpha})`);
        grad.addColorStop(0.5, `rgba(210,168,255,${0.08 * s.pulseAlpha})`);
        grad.addColorStop(1, `rgba(63,185,80,${0 * s.pulseAlpha})`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.globalAlpha = 0.3 * s.pulseAlpha;
      ctx!.strokeStyle = "#58a6ff";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(cx, cy, s.pulseRadius, 0, Math.PI * 2);
      ctx!.stroke();

      ctx!.restore();
    }

    function drawParticles(s: typeof stateRef.current) {
      ctx!.save();
      s.particles = s.particles.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;
        const lifeRatio = 1 - p.life / p.maxLife;
        if (lifeRatio <= 0) return false;

        ctx!.globalAlpha = p.alpha * lifeRatio;
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 8;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
        ctx!.fill();
        return true;
      });
      ctx!.shadowBlur = 0;
      ctx!.restore();
    }

    function drawArchNodes(s: typeof stateRef.current) {
      ctx!.save();
      for (const node of s.archNodes) {
        if (node.alpha <= 0.01) continue;

        for (const ci of node.connections) {
          const target = s.archNodes[ci];
          if (target.alpha <= 0.01) continue;
          ctx!.globalAlpha = Math.min(node.alpha, target.alpha) * 0.2;
          ctx!.strokeStyle = node.color;
          ctx!.lineWidth = 1;
          ctx!.setLineDash([4, 6]);
          ctx!.beginPath();
          ctx!.moveTo(node.x, node.y);
          ctx!.lineTo(target.x, target.y);
          ctx!.stroke();
          ctx!.setLineDash([]);
        }

        ctx!.globalAlpha = node.alpha * 0.15;
        ctx!.fillStyle = node.color;
        ctx!.shadowColor = node.color;
        ctx!.shadowBlur = 30;
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.size * 1.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;

        ctx!.globalAlpha = node.alpha * 0.7;
        ctx!.strokeStyle = node.color;
        ctx!.lineWidth = 1.5;
        const wobble = Math.sin(s.globalTime * 0.002 + s.archNodes.indexOf(node)) * 2;
        drawHexagon(ctx!, node.x, node.y + wobble, node.size);
        ctx!.stroke();

        ctx!.globalAlpha = node.alpha * 0.9;
        ctx!.fillStyle = "#fff";
        ctx!.font = "bold 10px 'Inter', sans-serif";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(node.label, node.x, node.y + wobble);
      }
      ctx!.restore();
    }

    function drawHexagon(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    }

    let lastGlitchTime = 0;
    function drawGlitch(s: typeof stateRef.current) {
      if (s.globalTime - lastGlitchTime < 800 || Math.random() > 0.15) return;
      lastGlitchTime = s.globalTime;
      ctx!.save();
      const sliceH = 2 + Math.random() * 6;
      const sliceY = Math.random() * h;
      const shift = (Math.random() - 0.5) * 16;
      const sliceW = Math.min(w, 600);
      const sliceX = Math.floor((w - sliceW) / 2);
      const imageData = ctx!.getImageData(sliceX, sliceY, sliceW, sliceH);
      ctx!.globalAlpha = 0.5;
      ctx!.putImageData(imageData, sliceX + shift, sliceY);
      ctx!.restore();
    }

    function drawVignette() {
      const grad = ctx!.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
      grad.addColorStop(0, "rgba(3,3,3,0)");
      grad.addColorStop(1, "rgba(3,3,3,0.7)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);
    }

    let lastTime = performance.now();

    function animate(now: number) {
      const dt = Math.min(now - lastTime, 33);
      lastTime = now;
      const s = stateRef.current;
      s.globalTime += dt;
      s.phaseTime += dt;

      const phaseDur = PHASE_DURATION[s.phase];
      const phaseProgress = Math.min(s.phaseTime / phaseDur, 1);

      if (s.phaseTime >= phaseDur) {
        s.phase = (s.phase + 1) % PHASE_DURATION.length;
        s.phaseTime = 0;
      }

      ctx!.clearRect(0, 0, w, h);

      const fadeIn = Math.min(phaseProgress * 4, 1);
      const fadeOut = phaseProgress > 0.75 ? 1 - (phaseProgress - 0.75) * 4 : 1;
      const fade = fadeIn * fadeOut;

      switch (s.phase) {
        case 0:
          drawCodeStreams(s, fade);
          drawCursors(s, fade);
          break;

        case 1: {
          drawCodeStreams(s, fadeOut);
          const cx = w / 2;
          const cy = h / 2;
          for (const cursor of s.cursors) {
            cursor.targetX = cx + (Math.random() - 0.5) * 40;
            cursor.targetY = cy + (Math.random() - 0.5) * 40;
            cursor.x += (cursor.targetX - cursor.x) * 0.05;
            cursor.y += (cursor.targetY - cursor.y) * 0.05;
          }
          drawCursors(s, fade);
          s.pulseRadius = phaseProgress * Math.max(w, h) * 0.3;
          s.pulseAlpha = fade;
          drawPulse(s);
          break;
        }

        case 2:
          s.pulseAlpha = fadeOut;
          drawPulse(s);
          if (phaseProgress < 0.1 && s.particles.length < 200) {
            spawnBurstParticles(w / 2, h / 2, 8);
          }
          drawParticles(s);
          break;

        case 3:
          for (const node of s.archNodes) {
            node.alpha += (fade - node.alpha) * 0.05;
            node.x += (node.targetX - node.x) * 0.03;
            node.y += (node.targetY - node.y) * 0.03;
          }
          drawArchNodes(s);
          drawParticles(s);
          break;

        case 4: {
          const cx2 = w / 2;
          const cy2 = h / 2;
          for (const node of s.archNodes) {
            node.alpha *= 0.96;
            node.x += (cx2 - node.x) * 0.03;
            node.y += (cy2 - node.y) * 0.03;
          }
          drawArchNodes(s);

          for (const stream of s.codeStreams) {
            stream.charIndex = 0;
          }
          for (const cursor of s.cursors) {
            cursor.targetX = Math.random() * w;
            cursor.targetY = Math.random() * h;
          }
          break;
        }
      }

      drawGlitch(s);
      drawVignette();

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [initCursors, initCodeStreams, initArchNodes]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
