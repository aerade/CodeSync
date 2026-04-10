import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const features = ['Реальное время', 'Monaco Editor', 'AI-ассистент', 'Терминал', 'Гостевой доступ'];

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => setPhase(5), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(14px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Decorative ring */}
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full border border-white/5"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute w-[70vw] h-[70vw] rounded-full border border-white/[0.03]"
        animate={{ rotate: -360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      />

      {/* Logo mark */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        <div className="text-[12vw] font-bold text-white tracking-tight leading-none"
          style={{ fontFamily: 'var(--font-display)' }}>
          {'CodeSync'.split('').map((char, i) => (
            <motion.span
              key={i}
              style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 40, rotateX: -30 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -30 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22, delay: phase >= 1 ? i * 0.05 : 0 }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.p
          className="text-[2vw] text-gray-400 tracking-widest uppercase font-mono"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.8 }}
        >
          Код. Вместе. Без границ.
        </motion.p>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        className="relative z-10 flex flex-wrap justify-center gap-3 max-w-[60vw]"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {features.map((feat, i) => (
          <motion.div
            key={feat}
            className="px-4 py-2 glass-panel rounded-full text-[1.2vw] text-gray-400 font-mono border border-white/10"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.08 }}
          >
            {feat}
          </motion.div>
        ))}
      </motion.div>

      {/* Accent line */}
      <motion.div
        className="relative z-10 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"
        initial={{ width: 0 }}
        animate={phase >= 4 ? { width: '40vw' } : { width: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}
