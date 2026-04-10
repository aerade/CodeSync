// Scene 2 — Real-time collaboration
// Shows Monaco editor mock + two animated cursors
// GPU-only transitions: translateX + opacity
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { playClickSound, playTypeSound } from '@/lib/audio';

const CODE_LINES = [
  { tokens: [
    { t: 'import', c: 'code-keyword' }, { t: ' { Server } ', c: 'text-gray-400' },
    { t: 'from', c: 'code-keyword' }, { t: " 'socket.io'", c: 'code-string' }, { t: ';', c: 'text-gray-500' },
  ]},
  { tokens: [{ t: '', c: '' }] },
  { tokens: [
    { t: 'const', c: 'code-keyword' }, { t: ' io = ', c: 'text-gray-400' },
    { t: 'new', c: 'code-keyword' }, { t: ' ', c: '' },
    { t: 'Server', c: 'code-function' }, { t: '(3000);', c: 'text-gray-500' },
  ]},
  { tokens: [{ t: '', c: '' }] },
  { tokens: [
    { t: 'io', c: 'text-gray-300' }, { t: '.', c: 'text-gray-500' },
    { t: 'on', c: 'code-function' }, { t: '(', c: 'text-gray-500' },
    { t: "'connection'", c: 'code-string' }, { t: ', (socket) => {', c: 'text-gray-400' },
  ]},
  { tokens: [
    { t: '  socket', c: 'text-gray-400' }, { t: '.', c: 'text-gray-500' },
    { t: 'on', c: 'code-function' }, { t: "(", c: 'text-gray-500' },
    { t: "'code-change'", c: 'code-string' }, { t: ', (d) => {', c: 'text-gray-400' },
  ]},
  { tokens: [
    { t: '    socket', c: 'text-gray-400' }, { t: '.', c: 'text-gray-500' },
    { t: 'broadcast', c: 'code-function' }, { t: '.', c: 'text-gray-500' },
    { t: 'emit', c: 'code-function' }, { t: "(", c: 'text-gray-500' },
    { t: "'code-update'", c: 'code-string' }, { t: ', d);', c: 'text-gray-500' },
  ]},
  { tokens: [{ t: '  });', c: 'text-gray-500' }] },
  { tokens: [{ t: '});', c: 'text-gray-500' }] },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const t = [
      setTimeout(() => { setPhase(1); playClickSound(); },   300),
    ];
    // Stagger code lines with type sounds
    CODE_LINES.forEach((_, i) => {
      t.push(setTimeout(() => {
        setVisibleLines(i + 1);
        if (CODE_LINES[i].tokens[0].t !== '') playTypeSound();
      }, 500 + i * 160));
    });
    t.push(setTimeout(() => { setPhase(2); playClickSound(); }, 1800));
    t.push(setTimeout(() => { setPhase(3); playClickSound(); }, 2500));
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, x: '6vw' }}
      animate={{ opacity: 1, x: '0vw' }}
      exit={{ opacity: 0, x: '-6vw' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex gap-8 w-[85vw] h-[70vh] items-stretch">
        {/* Editor panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-3 h-10 px-5 border-b border-white/[0.06] bg-white/[0.03] shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            </div>
            <span className="font-mono text-gray-500" style={{ fontSize: '1.1vw' }}>server.ts</span>
          </div>

          {/* Code */}
          <div className="flex-1 p-6 font-mono leading-relaxed relative overflow-hidden"
            style={{ fontSize: '1.3vw' }}>
            {CODE_LINES.map((line, i) => (
              <motion.div
                key={i}
                style={{ willChange: 'transform, opacity' }}
                initial={{ opacity: 0, x: -8 }}
                animate={visibleLines > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: 0.25, ease: 'circOut' }}
              >
                {line.tokens.map((tok, j) => (
                  <span key={j} className={tok.c}>{tok.t}</span>
                ))}
              </motion.div>
            ))}

            {/* Cursor Alex */}
            <motion.div
              className="absolute"
              style={{ willChange: 'transform, opacity', top: '38%', left: '15%' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={phase >= 2 ? {
                opacity: [0, 1, 1, 1],
                x: [0, 40, 90, 130],
                y: [0, 15, 5, 25],
                scale: 1,
              } : { opacity: 0, scale: 0.6 }}
              transition={{ duration: 2.5, ease: 'easeInOut', times: [0, 0.3, 0.6, 1] }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 3L19 12L12 14L9 21L5 3Z" fill="#3B82F6" stroke="white" strokeWidth="1.5"/>
              </svg>
              <div className="bg-[#3B82F6] text-white px-2 py-0.5 rounded text-[0.8vw] mt-0.5 whitespace-nowrap">Alex</div>
            </motion.div>

            {/* Cursor Maria */}
            <motion.div
              className="absolute"
              style={{ willChange: 'transform, opacity', top: '58%', left: '40%' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={phase >= 3 ? {
                opacity: [0, 1, 1, 1],
                x: [0, -25, -70, -50],
                y: [0, 30, 15, 40],
                scale: 1,
              } : { opacity: 0, scale: 0.6 }}
              transition={{ duration: 2.2, ease: 'easeInOut', times: [0, 0.3, 0.6, 1] }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 3L19 12L12 14L9 21L5 3Z" fill="#10B981" stroke="white" strokeWidth="1.5"/>
              </svg>
              <div className="bg-[#10B981] text-white px-2 py-0.5 rounded text-[0.8vw] mt-0.5 whitespace-nowrap">Maria</div>
            </motion.div>
          </div>
        </div>

        {/* Side label */}
        <motion.div
          className="w-[26vw] flex flex-col justify-center gap-4"
          style={{ willChange: 'transform, opacity' }}
          initial={{ opacity: 0, x: 30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-10 h-px bg-white/25" />
          <h2 className="text-white font-bold leading-tight tracking-tight" style={{ fontSize: '3.2vw' }}>
            Коллаборация<br />в реальном<br />времени
          </h2>
          <p className="text-gray-500 leading-relaxed" style={{ fontSize: '1.25vw' }}>
            Несколько разработчиков — один код. Каждое изменение мгновенно у всех участников
          </p>
          <div className="flex flex-col gap-2">
            {['Yjs CRDT синхронизация', 'Курсоры коллег', 'До 5 участников'].map((f, i) => (
              <motion.div
                key={f}
                className="flex items-center gap-2.5 text-gray-600"
                style={{ fontSize: '1.1vw', willChange: 'transform, opacity' }}
                initial={{ opacity: 0, x: 16 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                transition={{ delay: 0.25 + i * 0.1, duration: 0.5 }}
              >
                <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
