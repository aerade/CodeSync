import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-[85vw] h-[60vh] gap-8">
        
        {/* Terminal */}
        <motion.div 
          className="flex-1 bg-secondary rounded-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
        >
          <div className="h-10 bg-bg-dark border-b border-white/5 flex items-center px-4">
            <span className="text-sm text-text-muted font-mono">Terminal</span>
          </div>
          <div className="p-6 font-mono text-[1.2vw] text-text-primary">
            <div className="text-success">➜  project git:(main) ✗</div>
            <motion.div 
              className="mt-2"
              initial={{ width: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}
              animate={phase >= 2 ? { width: '100%' } : { width: 0 }}
              transition={{ duration: 1 }}
            >
              npm run build
            </motion.div>
            <motion.div 
              className="mt-2 text-text-secondary"
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              Building for production...<br/>
              ✓ Compiled successfully in 1.2s
            </motion.div>
          </div>
        </motion.div>

        {/* AI Assistant */}
        <motion.div 
          className="w-[30vw] bg-bg-dark border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col relative"
          initial={{ opacity: 0, x: 50 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
          <div className="p-4 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center text-accent font-bold">AI</div>
            <span className="font-semibold text-white">AI Assistant</span>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <motion.div 
              className="bg-secondary p-3 rounded-lg text-sm text-white self-end max-w-[80%]"
              initial={{ opacity: 0, scale: 0.8, originX: 1, originY: 1 }}
              animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              How do I optimize this array?
            </motion.div>
            <motion.div 
              className="bg-accent/10 border border-accent/20 p-3 rounded-lg text-sm text-text-primary self-start max-w-[90%]"
              initial={{ opacity: 0, scale: 0.8, originX: 0, originY: 1 }}
              animate={phase >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              <div className="text-accent mb-2">CodeSync AI</div>
              You can use a Set to remove duplicates in O(n) time complexity:
              <div className="bg-bg-dark p-2 mt-2 rounded font-mono text-xs text-text-muted">
                const unique = [...new Set(arr)];
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>
      
      <div className="absolute top-[8vh] w-full text-center">
        <motion.h2 
          className="text-[3vw] font-bold text-white tracking-tight"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          Встроенный терминал и ИИ
        </motion.h2>
      </div>
    </motion.div>
  );
}
