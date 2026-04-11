import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      <motion.div 
        className="w-24 h-24 rounded-2xl bg-accent flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(88,166,255,0.6)]"
        initial={{ scale: 0 }}
        animate={phase >= 1 ? { scale: 1 } : { scale: 0 }}
        transition={{ type: 'spring', bounce: 0.5 }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </motion.div>

      <motion.h1 
        className="text-[5vw] font-black text-white tracking-tighter"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        CodeSync
      </motion.h1>

      <motion.p 
        className="text-[2vw] text-text-secondary mt-4 mb-12 text-center max-w-[60vw]"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.2 }}
      >
        Гостевой режим. До 5 человек в комнате.<br/>Начните кодить вместе прямо сейчас.
      </motion.p>

      <motion.div 
        className="bg-accent text-bg-dark font-bold text-[1.5vw] px-10 py-4 rounded-full shadow-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ type: 'spring' }}
      >
        Создать комнату
      </motion.div>
    </motion.div>
  );
}
