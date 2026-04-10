// Scene 3 — AI assistant
// GPU-only transitions: clipPath + opacity, no filter:blur
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { playClickSound } from '@/lib/audio';

const MESSAGES = [
  { role: 'user', text: 'Объясни этот код',            delay: 400  },
  { role: 'ai',   text: 'Здесь создаётся WebSocket‑сервер. Функция on("connection") вызывается при каждом подключении и возвращает socket.id клиента.', delay: 1000 },
  { role: 'user', text: 'Как добавить JWT‑авторизацию?', delay: 2400 },
  { role: 'ai',   text: 'Добавьте middleware с проверкой токена перед io.on("connection"), используя socket.handshake.auth.',  delay: 3100 },
];

export function Scene3() {
  const [phase, setPhase]                   = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { setPhase(1); playClickSound(); }, 300),
      ...MESSAGES.map((m, i) =>
        setTimeout(() => { setVisibleMessages(i + 1); playClickSound(); }, m.delay)
      ),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)'   }}
      exit={{ opacity: 0, x: '-6vw' }}
      transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex gap-8 w-[85vw] h-[70vh] items-stretch">
        {/* Chat panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 h-10 px-5 border-b border-white/[0.06] bg-white/[0.03] shrink-0">
            {/* Status dot — framer-motion pulse, no CSS animate-pulse */}
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-mono text-gray-500" style={{ fontSize: '1.1vw' }}>AI‑ассистент</span>
          </div>

          {/* Messages */}
          <div className="flex-1 p-5 flex flex-col gap-3 justify-end overflow-hidden">
            {MESSAGES.map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ willChange: 'transform, opacity' }}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={visibleMessages > i
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 14, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              >
                <div
                  className={`max-w-[74%] px-4 py-2.5 rounded-xl leading-snug ${
                    msg.role === 'user'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/[0.04] border border-white/[0.08] text-gray-300'
                  }`}
                  style={{ fontSize: '1.15vw' }}
                >
                  {msg.role === 'ai' && (
                    <span className="text-blue-400 font-mono block mb-1" style={{ fontSize: '0.9vw' }}>AI</span>
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Side label */}
        <motion.div
          className="w-[28vw] flex flex-col justify-center gap-4"
          style={{ willChange: 'transform, opacity' }}
          initial={{ opacity: 0, x: 28 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 28 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-10 h-px bg-white/25" />
          <h2 className="text-white font-bold leading-tight tracking-tight" style={{ fontSize: '3.2vw' }}>
            AI‑<br />ассистент
          </h2>
          <p className="text-gray-500 leading-relaxed" style={{ fontSize: '1.25vw' }}>
            Понимает контекст вашего кода и отвечает на любые вопросы мгновенно
          </p>
          <div className="flex flex-col gap-2">
            {['Объяснение кода', 'Генерация функций', 'Поиск и исправление ошибок'].map((f, i) => (
              <motion.div
                key={f}
                className="flex items-center gap-2.5 text-gray-600"
                style={{ fontSize: '1.1vw', willChange: 'transform, opacity' }}
                initial={{ opacity: 0, x: 16 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              >
                <div className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
