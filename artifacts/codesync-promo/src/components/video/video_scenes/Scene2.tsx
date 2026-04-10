import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3800), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw', filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[80vw] h-[70vh] glass-panel rounded-2xl flex flex-col overflow-hidden relative">
        {/* Editor Header */}
        <div className="h-12 border-b border-white/10 flex items-center px-6 gap-4 bg-white/5">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <div className="text-sm font-mono text-gray-400">server.ts</div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 p-8 font-mono text-[1.5vw] leading-relaxed relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          >
            <span className="code-keyword">import</span> {`{ Server }`} <span className="code-keyword">from</span> <span className="code-string">'socket.io'</span>;<br/>
            <br/>
            <span className="code-keyword">const</span> io = <span className="code-keyword">new</span> <span className="code-function">Server</span>(3000);<br/>
            <br/>
            io.<span className="code-function">on</span>(<span className="code-string">'connection'</span>, (socket) {`=>`} {`{`}<br/>
            &nbsp;&nbsp;console.<span className="code-function">log</span>(<span className="code-string">'User connected:'</span>, socket.id);<br/>
            &nbsp;&nbsp;<br/>
            &nbsp;&nbsp;socket.<span className="code-function">on</span>(<span className="code-string">'code-change'</span>, (data) {`=>`} {`{`}<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;socket.<span className="code-function">broadcast</span>.<span className="code-function">emit</span>(<span className="code-string">'code-update'</span>, data);<br/>
            &nbsp;&nbsp;{`}`});<br/>
            {`}`});
          </motion.div>

          {/* Cursors */}
          <motion.div 
            className="absolute top-[40%] left-[25%]"
            initial={{ opacity: 0, x: -50, y: -50 }}
            animate={phase >= 2 ? { opacity: 1, x: [0, 50, 100], y: [0, 20, 10] } : { opacity: 0 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 3L19 12L12 14L9 21L5 3Z" fill="#3B82F6" stroke="white" strokeWidth="2"/>
            </svg>
            <div className="bg-[#3B82F6] text-white text-xs px-2 py-0.5 rounded-sm mt-1">Alex</div>
          </motion.div>

          <motion.div 
            className="absolute top-[60%] left-[45%]"
            initial={{ opacity: 0, x: 50, y: 50 }}
            animate={phase >= 3 ? { opacity: 1, x: [0, -30, -80], y: [0, 40, 20] } : { opacity: 0 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 3L19 12L12 14L9 21L5 3Z" fill="#10B981" stroke="white" strokeWidth="2"/>
            </svg>
            <div className="bg-[#10B981] text-white text-xs px-2 py-0.5 rounded-sm mt-1">Maria</div>
          </motion.div>
        </div>
      </div>

      {/* Floating Text */}
      <motion.div 
        className="absolute bottom-12 right-12 text-right"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-[3vw] font-bold text-white leading-tight">Коллаборация <br/>в реальном времени</h2>
        <p className="text-[1.5vw] text-gray-400 mt-2 font-mono">Yjs CRDT &bull; Monaco Editor</p>
      </motion.div>
    </motion.div>
  );
}