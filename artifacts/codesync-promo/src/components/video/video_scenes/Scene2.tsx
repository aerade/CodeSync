import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2200),
      setTimeout(() => setPhase(5), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-[15vh] text-center w-full">
        <motion.h2 
          className="text-[4vw] font-bold text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Пишите код <span className="text-accent">вместе</span>
        </motion.h2>
      </div>

      <motion.div 
        className="w-[70vw] h-[50vh] mt-[10vh] bg-secondary rounded-xl border border-white/10 shadow-2xl overflow-hidden relative"
        initial={{ opacity: 0, y: 50, rotateX: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 20 }}
        transition={{ duration: 1, type: "spring", bounce: 0.2 }}
        style={{ perspective: 1000 }}
      >
        <div className="h-8 bg-bg-dark border-b border-white/5 flex items-center px-4 space-x-2">
          <div className="w-3 h-3 rounded-full bg-error"></div>
          <div className="w-3 h-3 rounded-full bg-warning"></div>
          <div className="w-3 h-3 rounded-full bg-success"></div>
          <div className="ml-4 text-xs font-mono text-text-muted">app.ts</div>
        </div>
        <div className="p-6 font-mono text-[1.2vw] leading-relaxed text-text-primary relative">
          <div><span className="text-accent">import</span> &#123; Server &#125; <span className="text-accent">from</span> 'http';</div>
          <div className="mt-2"><span className="text-accent">const</span> server = <span className="text-accent">new</span> Server();</div>
          
          {/* Cursor 1 */}
          <motion.div 
            className="absolute flex flex-col items-start"
            initial={{ top: '40%', left: '10%', opacity: 0 }}
            animate={phase >= 3 ? { top: '50%', left: '45%', opacity: 1 } : { top: '40%', left: '10%', opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#58A6FF" xmlns="http://www.w3.org/2000/event"><path d="M4 2L20 12L11 14L8 22L4 2Z"/></svg>
            <div className="bg-accent text-bg-dark text-[0.8vw] px-2 py-1 rounded mt-1 font-bold">Alex</div>
          </motion.div>

          {/* Cursor 2 */}
          <motion.div 
            className="absolute flex flex-col items-start"
            initial={{ top: '80%', left: '80%', opacity: 0 }}
            animate={phase >= 4 ? { top: '65%', left: '30%', opacity: 1 } : { top: '80%', left: '80%', opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#10B981" xmlns="http://www.w3.org/2000/event"><path d="M4 2L20 12L11 14L8 22L4 2Z"/></svg>
            <div className="bg-success text-white text-[0.8vw] px-2 py-1 rounded mt-1 font-bold">Maria</div>
          </motion.div>
          
          <div className="mt-6 text-text-muted">server.listen(3000, () =&gt; &#123;</div>
          <div className="ml-8 text-text-muted">console.log('Running...');</div>
          <div className="text-text-muted">&#125;);</div>
        </div>
      </motion.div>
    </motion.div>
  );
}
