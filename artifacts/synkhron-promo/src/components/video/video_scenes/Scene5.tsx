// Scene 5: CLOSE — Brand outro. Logo + tagline + call to sync. Loops back to Scene 1.
// Duration: 4500ms

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const letters = 'СИНХРОН'.split('');

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.15, filter: 'blur(20px)' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background radial */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,194,168,0.15) 0%, transparent 65%)',
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Concentric rings */}
      {[1, 2, 3].map(ring => (
        <motion.div
          key={ring}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            border: '1px solid rgba(0,194,168,0.15)',
            width: `${ring * 20}vw`,
            height: `${ring * 20}vw`,
          }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3 + ring * 0.5, repeat: Infinity, ease: 'easeInOut', delay: ring * 0.4 }}
        />
      ))}

      {/* Center content */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 10 }}>

        {/* Logo icon */}
        <motion.div
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5vw' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <svg viewBox="0 0 48 48" style={{ width: '6vw', height: '6vw' }}>
            <rect x="4" y="4" width="40" height="40" rx="6" fill="none" stroke="#00C2A8" strokeWidth="2.5" />
            <line x1="4" y1="14" x2="44" y2="14" stroke="#00C2A8" strokeWidth="2" opacity="0.5" />
            <circle cx="10" cy="9" r="1.8" fill="#00C2A8" opacity="0.7" />
            <circle cx="17" cy="9" r="1.8" fill="#00C2A8" opacity="0.5" />
            <text x="10" y="33" fontFamily="JetBrains Mono, monospace" fontSize="13" fill="#00C2A8" fontWeight="700">{'>_'}</text>
          </svg>
        </motion.div>

        {/* Brand name letter by letter */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5vw' }}>
          {letters.map((char, i) => (
            <motion.span
              key={i}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9vw',
                fontWeight: 700,
                color: '#E8EDF5',
                letterSpacing: '-0.02em',
                display: 'inline-block',
              }}
              initial={{ opacity: 0, y: -50, rotateX: 60 }}
              animate={
                phase >= 2
                  ? { opacity: 1, y: 0, rotateX: 0 }
                  : { opacity: 0, y: -50, rotateX: 60 }
              }
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: phase >= 2 ? i * 0.06 : 0,
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.2vw',
            color: '#00C2A8',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '3vw',
          }}
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={
            phase >= 3
              ? { opacity: 1, filter: 'blur(0px)' }
              : { opacity: 0, filter: 'blur(10px)' }
          }
          transition={{ duration: 0.7 }}
        >
          Кодируй вместе. В реальном времени.
        </motion.p>

        {/* URL / CTA text (no button — video only) */}
        <motion.div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.8vw',
            padding: '0.6vw 2vw',
            border: '1px solid rgba(0,194,168,0.4)',
            borderRadius: '4vw',
            background: 'rgba(0,194,168,0.08)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={
            phase >= 4
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.8 }
          }
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1vw', color: '#E8EDF5' }}>synkhron.dev</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1vw', color: '#00C2A8' }}>→</span>
        </motion.div>

        {/* Fade to dark for loop */}
        <motion.div
          style={{
            position: 'absolute',
            inset: '-50vw',
            background: '#080C14',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 5 ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </motion.div>
  );
}
