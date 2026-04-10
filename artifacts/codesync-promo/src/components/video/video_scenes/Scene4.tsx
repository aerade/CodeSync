// Scene 4 — Built-in terminal
// GPU-only: translateX + opacity for entry, translateY + opacity for lines
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { playTypeSound, playClickSound } from '@/lib/audio';

const LINES = [
  { text: '$ node server.ts',                          color: 'text-gray-400',  delay: 350  },
  { text: 'Server listening on :3000',                 color: 'text-emerald-400', delay: 800  },
  { text: 'WebSocket server ready ✓',                  color: 'text-emerald-400', delay: 1150 },
  { text: 'User "Alex" joined room #4f2a',             color: 'text-blue-400',  delay: 1550 },
  { text: 'User "Maria" joined room #4f2a',            color: 'text-blue-400',  delay: 1950 },
  { text: 'Syncing 3 pending changes...',              color: 'text-yellow-500', delay: 2400 },
  { text: 'All changes synced ✓',                      color: 'text-emerald-400', delay: 2900 },
  { text: '$ █',                                       color: 'text-gray-500',  delay: 3300 },
];

export function Scene4() {
  const [phase, setPhase]           = useState(0);
  const [visibleLines, setVisible]  = useState(0);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { setPhase(1); playClickSound(); }, 200),
      ...LINES.map((l, i) =>
        setTimeout(() => {
          setVisible(i + 1);
          if (!l.text.startsWith('$')) playTypeSound();
          else playClickSound();
        }, l.delay)
      ),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, x: '-6vw' }}
      animate={{ opacity: 1, x: '0vw'  }}
      exit={{ opacity: 0, x: '6vw'     }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex gap-8 w-[85vw] h-[70vh] items-stretch">
        {/* Side label */}
        <motion.div
          className="w-[26vw] flex flex-col justify-center gap-4"
          style={{ willChange: 'transform, opacity' }}
          initial={{ opacity: 0, x: -28 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -28 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-10 h-px bg-white/25" />
          <h2 className="text-white font-bold leading-tight tracking-tight" style={{ fontSize: '3.2vw' }}>
            Встроенный<br />терминал
          </h2>
          <p className="text-gray-500 leading-relaxed" style={{ fontSize: '1.25vw' }}>
            Запускайте код прямо в браузере — без установки окружения
          </p>
          <div className="flex flex-col gap-2">
            {['Node.js / Python / Go', 'Вывод в реальном времени', 'Общий доступ к сессии'].map((f, i) => (
              <motion.div
                key={f}
                className="flex items-center gap-2.5 text-gray-600"
                style={{ fontSize: '1.1vw', willChange: 'transform, opacity' }}
                initial={{ opacity: 0, x: -16 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              >
                <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Terminal panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 h-10 px-5 border-b border-white/[0.06] bg-white/[0.03] shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            </div>
            <span className="font-mono text-gray-500" style={{ fontSize: '1.1vw' }}>Terminal</span>
          </div>

          <div className="flex-1 p-6 font-mono leading-relaxed flex flex-col gap-0.5 overflow-hidden"
            style={{ fontSize: '1.3vw' }}>
            {LINES.map((line, i) => (
              <motion.div
                key={i}
                className={line.color}
                style={{ willChange: 'transform, opacity' }}
                initial={{ opacity: 0, y: 8 }}
                animate={visibleLines > i ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.22, ease: 'circOut' }}
              >
                {line.text}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
