// Scene 5 — Outro / closing lockup
// GPU-only: scale + opacity, clip-path for pill reveals
// Looping arpeggio audio on entrance
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { playArpeggio, playClickSound } from '@/lib/audio';

const FEATURES = [
  'Реальное время',
  'Monaco Editor',
  'AI‑ассистент',
  'Терминал',
  'Гостевой доступ',
  '8 тем оформления',
];

const TITLE = 'CodeSync';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = [
      setTimeout(() => { setPhase(1); playArpeggio(110, 8); }, 200),
      setTimeout(() => { setPhase(2); playClickSound(); },      1100),
      setTimeout(() => { setPhase(3); playClickSound(); },      1900),
      setTimeout(() => { setPhase(4); playClickSound(); },      2800),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-7"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Slow-rotating ring — no blur, just border */}
      <motion.div
        className="absolute rounded-full border border-white/[0.05]"
        style={{ width: '55vw', height: '55vw', willChange: 'transform' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute rounded-full border border-white/[0.03]"
        style={{ width: '72vw', height: '72vw', willChange: 'transform' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
      />

      {/* Title */}
      <div className="relative z-10 overflow-hidden">
        <h1
          className="flex text-white font-bold tracking-tight leading-none"
          style={{ fontSize: '11vw', fontFamily: 'var(--font-display)' }}
        >
          {TITLE.split('').map((ch, i) => (
            <motion.span
              key={i}
              style={{ display: 'inline-block', willChange: 'transform, opacity' }}
              initial={{ opacity: 0, y: '90%' }}
              animate={phase >= 1 ? { opacity: 1, y: '0%' } : { opacity: 0, y: '90%' }}
              transition={{
                type: 'spring',
                stiffness: 180,
                damping: 20,
                delay: phase >= 1 ? i * 0.06 : 0,
              }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* Tagline */}
      <motion.p
        className="relative z-10 text-gray-500 font-mono uppercase tracking-widest"
        style={{ fontSize: '1.5vw', willChange: 'transform, opacity' }}
        initial={{ opacity: 0, y: '1em' }}
        animate={phase >= 2 ? { opacity: 1, y: '0em' } : { opacity: 0, y: '1em' }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      >
        Код. Вместе. Без границ.
      </motion.p>

      {/* Feature pills */}
      <motion.div
        className="relative z-10 flex flex-wrap justify-center gap-2.5"
        style={{ maxWidth: '62vw', willChange: 'opacity' }}
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {FEATURES.map((feat, i) => (
          <motion.div
            key={feat}
            className="glass-panel px-4 py-2 rounded-full text-gray-500 font-mono border border-white/[0.06]"
            style={{ fontSize: '1.1vw', willChange: 'transform, opacity' }}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.75 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22, delay: i * 0.07 }}
          >
            {feat}
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom accent line */}
      <motion.div
        className="relative z-10 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          willChange: 'transform, opacity',
        }}
        initial={{ width: 0, opacity: 0 }}
        animate={phase >= 4 ? { width: '44vw', opacity: 1 } : { width: 0, opacity: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}
