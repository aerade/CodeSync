// Scene 3: SOLUTION — Real-time collaboration. Multiple cursors writing code together live.
// Duration: 5000ms

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const collaborators = [
  { name: 'Алиса', color: '#00C2A8', x: '25%', y: '38%' },
  { name: 'Борис', color: '#4A90E2', x: '62%', y: '52%' },
  { name: 'Карина', color: '#B07AF5', x: '44%', y: '68%' },
];

const codeReveal = [
  { text: 'import { sync } from "@synkhron/core"', color: '#9B8FF5' },
  { text: '', color: '' },
  { text: 'const session = await sync.join({', color: '#E8EDF5' },
  { text: '  room: "project-alpha",', color: '#00C2A8' },
  { text: '  user: currentUser,', color: '#4A90E2' },
  { text: '  cursor: true,', color: '#B07AF5' },
  { text: '})', color: '#E8EDF5' },
  { text: '', color: '' },
  { text: '// Все видят изменения в реальном времени ✓', color: '#6B7A99' },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    const interval = setInterval(() => {
      setLineCount(n => n < codeReveal.length ? n + 1 : n);
    }, 350);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(100% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Teal radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,194,168,0.08) 0%, transparent 65%)',
        }}
      />

      {/* Center code editor panel */}
      <motion.div
        style={{
          width: '60vw',
          background: '#0B1220',
          borderRadius: '1vw',
          border: '1px solid rgba(0,194,168,0.25)',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(0,194,168,0.1)',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.9 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Title bar */}
        <div style={{
          padding: '0.9vw 1.5vw',
          background: '#0F1B2D',
          borderBottom: '1px solid rgba(0,194,168,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8vw',
        }}>
          <div style={{ display: 'flex', gap: '0.5vw' }}>
            <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', background: '#E25F4A' }} />
            <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', background: '#E2C24A' }} />
            <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', background: '#4AE27D' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8vw', color: '#6B7A99' }}>synkhron — session.ts</span>

          {/* Live collaborator badges */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4vw' }}>
            {collaborators.map((c, i) => (
              <motion.div
                key={i}
                style={{
                  background: c.color,
                  borderRadius: '2vw',
                  padding: '0.2vw 0.6vw',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.7vw',
                  color: '#080C14',
                  fontWeight: 600,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: i * 0.15 }}
              >
                {c.name}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: '1.5vw 1.5vw', fontFamily: 'var(--font-mono)', fontSize: '1vw', lineHeight: 1.8, position: 'relative', minHeight: '20vw' }}>
          {codeReveal.slice(0, lineCount).map((line, i) => (
            <motion.div
              key={i}
              style={{ display: 'flex', gap: '1vw', color: line.color || '#E8EDF5' }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span style={{ color: '#3A4560', width: '1.5vw', textAlign: 'right', fontSize: '0.8vw', userSelect: 'none' }}>{i + 1}</span>
              <span>{line.text}</span>
              {i === lineCount - 1 && (
                <span className="cursor-blink" style={{ display: 'inline-block', width: '0.6vw', height: '1.2em', background: '#00C2A8', verticalAlign: 'text-bottom', marginLeft: '0.1vw' }} />
              )}
            </motion.div>
          ))}

          {/* Floating cursor labels for collaborators */}
          {collaborators.map((c, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                pointerEvents: 'none',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 3 ? 1 : 0 }}
              transition={{ duration: 0.4, delay: i * 0.2 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3vw' }}>
                <svg width="10" height="14" viewBox="0 0 10 14" fill={c.color}>
                  <path d="M0 0 L10 5 L5.5 6.5 L8 14 L6 13 L3.5 6 L0 8 Z" />
                </svg>
                <div style={{
                  background: c.color,
                  color: '#080C14',
                  borderRadius: '0.3vw',
                  padding: '0.15vw 0.4vw',
                  fontSize: '0.7vw',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {c.name}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Bottom headline */}
      <motion.div
        className="absolute"
        style={{ bottom: '10%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 20 }}
        transition={{ duration: 0.6 }}
      >
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '2vw', fontWeight: 700, color: '#E8EDF5', letterSpacing: '-0.01em' }}>
          Один редактор. <span style={{ color: '#00C2A8' }}>Вся команда.</span>
        </p>
      </motion.div>
    </motion.div>
  );
}
