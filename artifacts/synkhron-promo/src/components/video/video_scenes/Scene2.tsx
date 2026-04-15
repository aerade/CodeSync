// Scene 2: PROBLEM — Developers working in isolation. Code typed in parallel by different people.
// Duration: 4000ms

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const codeLines = [
  { text: 'const render = () => {', indent: 0, user: 'A' },
  { text: '  return <App />', indent: 1, user: 'B' },
  { text: '}', indent: 0, user: 'A' },
  { text: '', indent: 0, user: '' },
  { text: '// TODO: merge conflict?', indent: 0, user: 'C' },
];

const conflictLines = [
  '<<<<<<< HEAD',
  '  return <App />',
  '=======',
  '  return <NewApp />',
  '>>>>>>> feature/rewrite',
];

export function Scene2() {
  const [phase, setPhase] = useState(0);
  const [typedCount, setTypedCount] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    const interval = setInterval(() => {
      setTypedCount(n => n < conflictLines.length ? n + 1 : n);
    }, 300);
    return () => clearInterval(interval);
  }, [phase]);

  const userColors: Record<string, string> = {
    A: '#00C2A8',
    B: '#4A90E2',
    C: '#E2744A',
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,194,168,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,168,0.3) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw',
        }}
      />

      {/* Left panel: title */}
      <motion.div
        className="absolute"
        style={{ left: '8%', top: '50%', transform: 'translateY(-50%)' }}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -40 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9vw', color: '#00C2A8', letterSpacing: '0.2em', marginBottom: '1.5vw', textTransform: 'uppercase' }}>
          Проблема
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '4.5vw', fontWeight: 700, color: '#E8EDF5', lineHeight: 1.05, maxWidth: '20vw' }}>
          Код в<br />
          <span style={{ color: '#00C2A8' }}>изоляции</span>
        </h2>
        <motion.p
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.1vw', color: '#6B7A99', marginTop: '1.5vw', maxWidth: '20vw', lineHeight: 1.6 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 0.6 }}
        >
          Конфликты слияний.<br />Потеря контекста.<br />Задержки между командой.
        </motion.p>
      </motion.div>

      {/* Right panel: code terminal with conflict */}
      <motion.div
        className="absolute"
        style={{
          right: '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '45vw',
          background: '#0D1520',
          borderRadius: '0.8vw',
          border: '1px solid rgba(0,194,168,0.2)',
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 30 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        {/* Terminal title bar */}
        <div style={{ padding: '0.8vw 1.2vw', background: '#111826', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
          <div style={{ width: '0.7vw', height: '0.7vw', borderRadius: '50%', background: '#E25F4A' }} />
          <div style={{ width: '0.7vw', height: '0.7vw', borderRadius: '50%', background: '#E2C24A' }} />
          <div style={{ width: '0.7vw', height: '0.7vw', borderRadius: '50%', background: '#4AE27D' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8vw', color: '#6B7A99', marginLeft: '0.8vw' }}>main.tsx — конфликт слияния</span>
        </div>

        {/* Code lines */}
        <div style={{ padding: '1.2vw', fontFamily: 'var(--font-mono)', fontSize: '1vw', lineHeight: 1.7 }}>
          {codeLines.map((line, i) => (
            <motion.div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -10 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
            >
              <span style={{ color: '#3A4560', width: '1.5vw', textAlign: 'right', userSelect: 'none', fontSize: '0.85vw' }}>{i + 1}</span>
              <span style={{ paddingLeft: `${line.indent * 1.5}vw`, color: '#E8EDF5', opacity: 0.7 }}>{line.text}</span>
              {line.user && (
                <span style={{ marginLeft: 'auto', width: '1.2vw', height: '1.2vw', borderRadius: '50%', background: userColors[line.user], display: 'inline-block', flexShrink: 0, opacity: 0.8 }} />
              )}
            </motion.div>
          ))}

          {/* Conflict block appears */}
          <motion.div
            style={{ marginTop: '0.5vw', borderLeft: '3px solid #E2744A', paddingLeft: '0.8vw' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: phase >= 2 ? 1 : 0, height: phase >= 2 ? 'auto' : 0 }}
            transition={{ duration: 0.4 }}
          >
            {conflictLines.slice(0, typedCount).map((line, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9vw', color: i === 0 || i === 4 ? '#E2744A' : i === 2 ? '#00C2A8' : '#E8EDF5', opacity: 0.85 }}>
                {line}
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Glitch effect overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: phase >= 3 ? [0, 0.04, 0, 0.02, 0] : 0,
        }}
        transition={{ duration: 0.4, repeat: phase >= 3 ? 3 : 0 }}
        style={{ background: 'rgba(226, 116, 74, 0.15)' }}
      />
    </motion.div>
  );
}
