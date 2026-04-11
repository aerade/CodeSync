import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="flex items-center space-x-6 mb-8 relative">
        <motion.div 
          className="w-24 h-24 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_50px_rgba(88,166,255,0.4)]"
          initial={{ scale: 0, rotate: -45 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </motion.div>
        
        <motion.h1 
          className="text-[6vw] font-black tracking-tighter text-white leading-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {'CodeSync'.split('').map((char, i) => (
            <motion.span key={i} style={{ display: 'inline-block' }}
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: phase >= 2 ? i * 0.05 : 0 }}>
              {char}
            </motion.span>
          ))}
        </motion.h1>
      </div>

      <motion.p 
        className="text-[2vw] text-text-secondary font-medium tracking-wide"
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={phase >= 3 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        Совместная IDE онлайн
      </motion.p>
    </motion.div>
  );
}
