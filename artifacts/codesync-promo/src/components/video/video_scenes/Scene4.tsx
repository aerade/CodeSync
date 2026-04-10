import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const lines = [
  { text: '$ node server.ts', color: 'text-gray-400', delay: 400 },
  { text: 'Server started on port 3000', color: 'text-emerald-400', delay: 900 },
  { text: 'WebSocket ready ✓', color: 'text-emerald-400', delay: 1300 },
  { text: 'User "Alex" joined room #4f2a', color: 'text-blue-400', delay: 1700 },
  { text: 'User "Maria" joined room #4f2a', color: 'text-blue-400', delay: 2100 },
  { text: 'Syncing 3 file changes...', color: 'text-yellow-400', delay: 2500 },
  { text: 'All changes synced ✓', color: 'text-emerald-400', delay: 3000 },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      ...lines.map((l, i) => setTimeout(() => setVisibleLines(i + 1), l.delay)),
      setTimeout(() => setPhase(2), 3700),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, y: '6vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-6vh', filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex gap-8 w-[85vw] h-[68vh] items-stretch">
        {/* Label */}
        <motion.div
          className="w-[28vw] flex flex-col justify-center gap-4"
          initial={{ opacity: 0, x: -40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-12 h-[2px] bg-white/30" />
          <h2 className="text-[3.5vw] font-bold text-white leading-tight tracking-tight">
            Встроенный<br />терминал
          </h2>
          <p className="text-[1.4vw] text-gray-400 leading-relaxed">
            Запускайте код прямо в браузере. Полноценный bash-терминал без установки зависимостей
          </p>
          <div className="flex flex-col gap-2 mt-2">
            {['Node.js / Python / Go', 'Вывод в реальном времени', 'Общий доступ к терминалу'].map((feat, i) => (
              <motion.div
                key={feat}
                className="flex items-center gap-3 text-[1.1vw] text-gray-500"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.6 }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {feat}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Terminal */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="h-11 border-b border-white/10 flex items-center px-5 gap-3 bg-white/5">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <span className="text-sm font-mono text-gray-400">Terminal</span>
          </div>
          <div className="flex-1 p-5 font-mono text-[1.4vw] leading-relaxed overflow-hidden flex flex-col gap-1">
            {lines.map((line, i) => (
              <motion.div
                key={i}
                className={`${line.color}`}
                initial={{ opacity: 0, x: -12 }}
                animate={visibleLines > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                transition={{ duration: 0.4, ease: 'circOut' }}
              >
                {line.text}
              </motion.div>
            ))}
            {/* Blinking cursor */}
            <motion.span
              className="inline-block w-2 h-4 bg-white mt-1"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
