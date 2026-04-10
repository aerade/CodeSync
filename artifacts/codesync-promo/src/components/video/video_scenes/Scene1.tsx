// Scene 1 — Intro
// Entry: scale(1.08) → scale(1) + opacity 0→1
// Exit:  translateY(0) → translateY(-3vh) + opacity 1→0
// NO filter:blur() anywhere — GPU only
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { playClickSound, playArpeggio } from '@/lib/audio';

const TITLE = 'CodeSync';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = [
      setTimeout(() => { setPhase(1); playClickSound(0); },   300),
      setTimeout(() => { setPhase(2); playArpeggio(110, 8); }, 800),
      setTimeout(() => { setPhase(3); playClickSound(0); },  1700),
      setTimeout(() => { setPhase(4); playClickSound(0); },  2600),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-3vh' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Decorative brackets */}
      <motion.div
        className="absolute text-white/5 font-mono leading-none select-none"
        style={{ fontSize: '22vw', willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {'{}'}
      </motion.div>

      {/* Title — per-character spring */}
      <div className="relative z-10 overflow-hidden">
        <h1
          className="flex text-white font-bold tracking-tight leading-none"
          style={{ fontSize: '9vw', fontFamily: 'var(--font-display)' }}
        >
          {TITLE.split('').map((ch, i) => (
            <motion.span
              key={i}
              style={{ display: 'inline-block', willChange: 'transform, opacity' }}
              initial={{ opacity: 0, y: '80%' }}
              animate={phase >= 2 ? { opacity: 1, y: '0%' } : { opacity: 0, y: '80%' }}
              transition={{
                type: 'spring',
                stiffness: 220,
                damping: 22,
                delay: phase >= 2 ? i * 0.055 : 0,
              }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* Accent line */}
      <motion.div
        className="relative z-10 h-px bg-white/25 mt-6"
        style={{ willChange: 'transform, opacity' }}
        initial={{ width: 0, opacity: 0 }}
        animate={phase >= 3 ? { width: '28vw', opacity: 1 } : { width: 0, opacity: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Subtitle */}
      <motion.p
        className="relative z-10 font-mono uppercase tracking-widest text-gray-500 mt-5"
        style={{ fontSize: '1.6vw', willChange: 'transform, opacity' }}
        initial={{ opacity: 0, y: '1.2em' }}
        animate={phase >= 4 ? { opacity: 1, y: '0em' } : { opacity: 0, y: '1.2em' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        Совместная онлайн‑IDE
      </motion.p>

      {/* Corner dot grid — static decoration */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white/15"
          style={{
            left:  `${15 + (i % 3) * 35}%`,
            top:   `${20 + Math.floor(i / 3) * 55}%`,
            willChange: 'opacity',
          }}
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.5 }}
        />
      ))}
    </motion.div>
  );
}
