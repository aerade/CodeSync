import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3200), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 flex flex-col items-center">
        {/* Code Brackets */}
        <motion.div 
          className="text-[#333] text-[20vw] font-mono leading-none absolute -z-10"
          initial={{ opacity: 0, rotate: -10, scale: 0.5 }}
          animate={phase >= 1 ? { opacity: 0.3, rotate: 0, scale: 1 } : { opacity: 0, rotate: -10, scale: 0.5 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        >
          {`{}`}
        </motion.div>

        {/* Title */}
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[8vw] font-bold text-white tracking-tight"
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          >
            CodeSync
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p 
          className="text-[2vw] text-gray-400 mt-4 tracking-widest uppercase font-mono"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          Совместная онлайн-IDE
        </motion.p>
      </div>
    </motion.div>
  );
}