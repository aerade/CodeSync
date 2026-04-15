// Scene 1: OPEN — Brand identity reveal. Logo materializes from code particles.
// Duration: 4500ms

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 2400),
      setTimeout(() => setPhase(5), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const chars = 'СИНХРОН'.split('');

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
      transition={{ duration: 0.6, ease: 'circOut' }}
    >
      {/* Radial teal gradient burst */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 2 ? 1 : 0 }}
        transition={{ duration: 1.2 }}
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,194,168,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, #00C2A8, transparent)', top: '50%' }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: phase >= 1 ? 1 : 0, opacity: phase >= 1 ? 0.6 : 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Terminal window frame */}
      <motion.div
        className="absolute"
        style={{
          width: '7vw',
          height: '7vw',
          border: '2px solid',
          borderColor: '#00C2A8',
          borderRadius: '0.75vw',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: phase >= 2 ? [0, 1, 1, 0] : 0,
          scale: phase >= 2 ? [0.5, 1, 1, 0.4] : 0.5,
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Logo terminal icon SVG */}
      <motion.svg
        viewBox="0 0 48 48"
        style={{ width: '7vw', height: '7vw', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.6 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <rect x="4" y="4" width="40" height="40" rx="6" fill="none" stroke="#00C2A8" strokeWidth="2.5" />
        <line x1="4" y1="14" x2="44" y2="14" stroke="#00C2A8" strokeWidth="2" opacity="0.6" />
        <circle cx="10" cy="9" r="1.8" fill="#00C2A8" opacity="0.7" />
        <circle cx="17" cy="9" r="1.8" fill="#00C2A8" opacity="0.5" />
        <text x="10" y="33" fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#00C2A8" fontWeight="700">{'>_'}</text>
      </motion.svg>

      {/* Main title */}
      <div
        className="absolute flex items-center justify-center"
        style={{ top: '58%', left: '50%', transform: 'translate(-50%, 0)' }}
      >
        {chars.map((char, i) => (
          <motion.span
            key={i}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '8vw',
              fontWeight: 700,
              color: '#E8EDF5',
              letterSpacing: '-0.02em',
              display: 'inline-block',
            }}
            initial={{ opacity: 0, y: 50, rotateX: -60 }}
            animate={
              phase >= 3
                ? { opacity: 1, y: 0, rotateX: 0 }
                : { opacity: 0, y: 50, rotateX: -60 }
            }
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 24,
              delay: phase >= 3 ? i * 0.055 : 0,
            }}
          >
            {char}
          </motion.span>
        ))}
      </div>

      {/* Tagline */}
      <motion.p
        className="absolute"
        style={{
          top: '72%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: '1.3vw',
          color: '#00C2A8',
          letterSpacing: '0.25em',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={
          phase >= 4
            ? { opacity: 1, filter: 'blur(0px)' }
            : { opacity: 0, filter: 'blur(8px)' }
        }
        transition={{ duration: 0.7 }}
      >
        коллаборативная IDE нового поколения
      </motion.p>

      {/* Exit drift elements */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent, #00C2A8, transparent)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 4 ? 0.4 : 0 }}
        transition={{ duration: 0.5 }}
      />
    </motion.div>
  );
}
