import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const messages = [
  { role: 'user', text: 'Объясни этот код', delay: 400 },
  { role: 'ai', text: 'Здесь создаётся WebSocket-сервер. Функция on("connection") вызывается при подключении каждого нового клиента и возвращает его socket.id.', delay: 1100 },
  { role: 'user', text: 'Как добавить авторизацию?', delay: 2200 },
  { role: 'ai', text: 'Добавьте middleware с проверкой JWT-токена перед io.on("connection")...', delay: 2900 },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      ...messages.map((m, i) => setTimeout(() => setVisibleMessages(i + 1), m.delay)),
      setTimeout(() => setPhase(2), 3700),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(100% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(12px)' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex gap-8 w-[85vw] h-[68vh] items-stretch">
        {/* Chat panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="h-11 border-b border-white/10 flex items-center px-5 gap-3 bg-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-mono text-gray-400">AI-ассистент</span>
          </div>
          <div className="flex-1 p-5 flex flex-col gap-3 justify-end overflow-hidden">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={visibleMessages > i ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-xl text-[1.2vw] leading-snug font-body ${
                    msg.role === 'user'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-300'
                  }`}
                >
                  {msg.role === 'ai' && (
                    <span className="text-blue-400 font-mono text-[0.9vw] block mb-1">AI</span>
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Label */}
        <motion.div
          className="w-[28vw] flex flex-col justify-center gap-4"
          initial={{ opacity: 0, x: 40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-12 h-[2px] bg-white/30" />
          <h2 className="text-[3.5vw] font-bold text-white leading-tight tracking-tight">
            AI-ассистент
          </h2>
          <p className="text-[1.4vw] text-gray-400 leading-relaxed">
            Встроенный чат-помощник понимает контекст вашего кода и отвечает на вопросы мгновенно
          </p>
          <div className="flex flex-col gap-2 mt-2">
            {['Объяснение кода', 'Генерация функций', 'Поиск ошибок'].map((feat, i) => (
              <motion.div
                key={feat}
                className="flex items-center gap-3 text-[1.1vw] text-gray-500"
                initial={{ opacity: 0, x: 20 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.6 }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {feat}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
