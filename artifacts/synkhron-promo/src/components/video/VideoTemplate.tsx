// СИНХРОН Promo Video — 5 scenes, ~23 seconds total loop
// Tech Product aesthetic — dark, teal accent, kinetic typography

import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  open:      4500,
  problem:   4000,
  solution:  5000,
  features:  5000,
  close:     4500,
};

// Persistent midground accent positions per scene
const accentOrb = [
  { x: '80vw', y: '15vh', scale: 2.2, opacity: 0.18 },
  { x: '10vw', y: '75vh', scale: 1.4, opacity: 0.12 },
  { x: '70vw', y: '60vh', scale: 1.8, opacity: 0.15 },
  { x: '5vw',  y: '30vh', scale: 1.2, opacity: 0.10 },
  { x: '50vw', y: '50vh', scale: 2.8, opacity: 0.20 },
];

const accentLine = {
  left:  ['10%', '5%', '30%', '55%', '15%'],
  width: ['35%', '60%', '20%', '30%', '50%'],
  top:   ['20%', '80%', '12%', '65%', '48%'],
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: '#080C14' }}
    >
      {/* === PERSISTENT BACKGROUND LAYER (outside AnimatePresence) === */}

      {/* Background video loop */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.18, mixBlendMode: 'screen' }}
        src={`${import.meta.env.BASE_URL}videos/teal-code-flow-bg.mp4`}
      />

      {/* Animated noise/grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.035,
        }}
      />

      {/* Floating ambient orb — persists and transforms across scenes */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, rgba(0,194,168,1) 0%, transparent 70%)',
          filter: 'blur(8vw)',
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={accentOrb[currentScene]}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Secondary ambient orb */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '30vw',
          height: '30vw',
          background: 'radial-gradient(circle, rgba(74, 144, 226, 0.6) 0%, transparent 70%)',
          filter: 'blur(6vw)',
          bottom: 0,
          right: 0,
        }}
        animate={{
          x: ['-5%', '5%', '-5%'],
          y: ['-5%', '5%', '-5%'],
          opacity: [0.12, 0.2, 0.12],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Persistent accent line — transforms position between scenes */}
      <motion.div
        className="absolute h-[2px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, #00C2A8, transparent)',
        }}
        animate={{
          left: accentLine.left[currentScene],
          width: accentLine.width[currentScene],
          top: accentLine.top[currentScene],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Scanline sweep — subtle CRT feel */}
      <div
        className="absolute left-0 right-0 pointer-events-none scanline"
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0,194,168,0.15), transparent)',
          zIndex: 50,
        }}
      />

      {/* === SCENE FOREGROUND (inside AnimatePresence) === */}
      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="problem" />}
        {currentScene === 2 && <Scene3 key="solution" />}
        {currentScene === 3 && <Scene4 key="features" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}
