import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const languages = ["JavaScript", "Python", "Rust", "Go", "TypeScript", "C++"];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, rotateY: 90 }}
      transition={{ duration: 0.8 }}
      style={{ perspective: 1200 }}
    >
      <motion.h2 
        className="text-[4vw] font-bold text-white mb-12 tracking-tight text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      >
        <span className="text-accent">Мультиязычность</span> и 8 тем
      </motion.h2>

      <div className="flex flex-wrap justify-center gap-4 max-w-[60vw]">
        {languages.map((lang, idx) => (
          <motion.div
            key={lang}
            className="px-6 py-3 rounded-full border border-white/20 bg-secondary text-white font-mono text-[1.5vw] shadow-lg"
            initial={{ opacity: 0, scale: 0, y: 50 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0, y: 50 }}
            transition={{ type: 'spring', delay: idx * 0.1 }}
          >
            {lang}
          </motion.div>
        ))}
      </div>

      <div className="mt-16 flex gap-6">
        <motion.div 
          className="w-[20vw] h-[15vh] rounded-xl bg-[#282a36] border border-[#6272a4] p-4 flex flex-col"
          initial={{ opacity: 0, x: -50, rotateZ: -10 }}
          animate={phase >= 3 ? { opacity: 1, x: 0, rotateZ: -5 } : { opacity: 0, x: -50, rotateZ: -10 }}
          transition={{ type: 'spring' }}
        >
          <span className="text-[#f8f8f2] font-bold">Dracula</span>
          <div className="mt-auto h-2 w-1/2 bg-[#ff79c6] rounded-full" />
          <div className="mt-2 h-2 w-3/4 bg-[#8be9fd] rounded-full" />
        </motion.div>

        <motion.div 
          className="w-[20vw] h-[15vh] rounded-xl bg-[#fafafa] border border-[#e5e5e5] p-4 flex flex-col shadow-xl z-10"
          initial={{ opacity: 0, y: 50 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ type: 'spring', delay: 0.1 }}
        >
          <span className="text-[#333333] font-bold">GitHub Light</span>
          <div className="mt-auto h-2 w-2/3 bg-[#005cc5] rounded-full" />
          <div className="mt-2 h-2 w-1/2 bg-[#d73a49] rounded-full" />
        </motion.div>

        <motion.div 
          className="w-[20vw] h-[15vh] rounded-xl bg-[#1e1e1e] border border-[#3c3c3c] p-4 flex flex-col"
          initial={{ opacity: 0, x: 50, rotateZ: 10 }}
          animate={phase >= 3 ? { opacity: 1, x: 0, rotateZ: 5 } : { opacity: 0, x: 50, rotateZ: 10 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          <span className="text-[#d4d4d4] font-bold">VS Dark</span>
          <div className="mt-auto h-2 w-3/5 bg-[#569cd6] rounded-full" />
          <div className="mt-2 h-2 w-full bg-[#ce9178] rounded-full" />
        </motion.div>
      </div>

    </motion.div>
  );
}
