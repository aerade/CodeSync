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

// Persistent orb positions per scene — use left/top % (not x/y transforms)
// to avoid framer-motion transform conflicts with CSS translate
const orbPositions = [
  { left: '65%', top: '10%', scale: 1.8, opacity: 0.18 },
  { left: '5%',  top: '60%', scale: 1.2, opacity: 0.12 },
  { left: '55%', top: '50%', scale: 1.5, opacity: 0.15 },
  { left: '2%',  top: '20%', scale: 1.0, opacity: 0.10 },
  { left: '30%', top: '30%', scale: 2.0, opacity: 0.20 },
];

// Accent line positions per scene
const linePos = [
  { left: '10%', width: '35%', top: '20%' },
  { left: '5%',  width: '60%', top: '80%' },
  { left: '30%', width: '20%', top: '12%' },
  { left: '55%', width: '30%', top: '65%' },
  { left: '15%', width: '50%', top: '48%' },
];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  const orb = orbPositions[currentScene];
  const line = linePos[currentScene];

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
        style={{ opacity: 0.15, mixBlendMode: 'screen' }}
        src={`${import.meta.env.BASE_URL}videos/teal-code-flow-bg.mp4`}
      />

      {/* Floating teal ambient orb — persists, animates left/top between scenes */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(0,194,168,0.9) 0%, transparent 70%)',
          filter: 'blur(9vw)',
        }}
        animate={{
          left: orb.left,
          top: orb.top,
          scale: orb.scale,
          opacity: orb.opacity,
        }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Secondary blue ambient orb — continuous drift */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '30vw',
          height: '30vw',
          background: 'radial-gradient(circle, rgba(74, 144, 226, 0.7) 0%, transparent 70%)',
          filter: 'blur(7vw)',
          right: '-5vw',
          bottom: '-5vw',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Persistent accent line — transforms position between scenes */}
      <motion.div
        className="absolute h-[2px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, #00C2A8, transparent)',
          opacity: 0.5,
        }}
        animate={{
          left: line.left,
          width: line.width,
          top: line.top,
        }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Scanline sweep — subtle CRT feel */}
      <div
        className="absolute left-0 right-0 pointer-events-none scanline"
        style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0,194,168,0.12), transparent)',
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
