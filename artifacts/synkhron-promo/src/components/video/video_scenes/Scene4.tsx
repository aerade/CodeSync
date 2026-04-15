// Scene 4: FEATURES — Three key capabilities revealed with kinetic typography.
// Duration: 5000ms

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '⚡',
    title: 'Мгновенная синхронизация',
    desc: 'Изменения распространяются за <10ms',
    accent: '#00C2A8',
    x: '18%',
    y: '35%',
  },
  {
    icon: '🔒',
    title: 'Изолированные сессии',
    desc: 'Безопасные приватные рабочие пространства',
    accent: '#4A90E2',
    x: '50%',
    y: '52%',
  },
  {
    icon: '🚀',
    title: 'Запуск в браузере',
    desc: 'Нет установки — просто открой ссылку',
    accent: '#B07AF5',
    x: '18%',
    y: '68%',
  },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30, filter: 'blur(8px)' }}
      transition={{ duration: 0.7 }}
    >
      {/* Left vertical accent bar */}
      <motion.div
        style={{
          position: 'absolute',
          left: '6%',
          top: '15%',
          bottom: '15%',
          width: '3px',
          background: 'linear-gradient(180deg, transparent, #00C2A8, #4A90E2, #B07AF5, transparent)',
        }}
        initial={{ scaleY: 0, originY: 0 }}
        animate={{ scaleY: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Right side headline */}
      <motion.div
        style={{
          position: 'absolute',
          right: '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          textAlign: 'right',
        }}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : 40 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9vw', color: '#00C2A8', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1vw' }}>
          Возможности
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '5vw', fontWeight: 700, color: '#E8EDF5', lineHeight: 1, maxWidth: '28vw', letterSpacing: '-0.02em' }}>
          Всё,<br />что нужно<br />
          <span style={{ color: '#00C2A8' }}>команде</span>
        </h2>
      </motion.div>

      {/* Feature cards */}
      {features.map((f, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            transform: 'translateY(-50%)',
            maxWidth: '26vw',
          }}
          initial={{ opacity: 0, x: -30 }}
          animate={{
            opacity: phase >= i + 2 ? 1 : 0,
            x: phase >= i + 2 ? 0 : -30,
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1vw' }}>
            {/* Icon circle */}
            <div style={{
              width: '3.5vw',
              height: '3.5vw',
              borderRadius: '50%',
              border: `2px solid ${f.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4vw',
              flexShrink: 0,
              background: `${f.accent}18`,
            }}>
              {f.icon}
            </div>

            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4vw', fontWeight: 600, color: '#E8EDF5', marginBottom: '0.3vw' }}>
                {f.title}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95vw', color: '#6B7A99', lineHeight: 1.5 }}>
                {f.desc}
              </p>
            </div>
          </div>

          {/* Connector line to accent bar */}
          <motion.div
            style={{
              position: 'absolute',
              right: '100%',
              top: '50%',
              height: '1px',
              width: '5.5vw',
              background: `linear-gradient(90deg, transparent, ${f.accent})`,
              transform: 'translateY(-50%)',
              marginRight: '0.5vw',
            }}
            initial={{ scaleX: 0, originX: 1 }}
            animate={{ scaleX: phase >= i + 2 ? 1 : 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </motion.div>
      ))}

      {/* Bottom stat bar */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '8%',
          display: 'flex',
          gap: '4vw',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: phase >= 5 ? 1 : 0, y: phase >= 5 ? 0 : 20 }}
        transition={{ duration: 0.5 }}
      >
        {[['<10ms', 'задержка'], ['∞', 'пользователей'], ['100%', 'в браузере']].map(([val, label], i) => (
          <div key={i}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.2vw', fontWeight: 700, color: '#00C2A8' }}>{val}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75vw', color: '#6B7A99', letterSpacing: '0.1em' }}>{label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
