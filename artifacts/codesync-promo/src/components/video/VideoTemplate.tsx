import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { startAmbientMusic, stopAmbientMusic, playTransitionSound } from '@/lib/audio';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  intro:    4000,
  collab:   4500,
  ai:       4500,
  terminal: 4000,
  outro:    5000,
};

// Persistent element positions per scene — only GPU transforms, no filters
const ORB_A = [
  { x: '-15vw', y: '-15vh' },
  {  x: '10vw',  y: '20vh' },
  {  x: '40vw', y: '-5vh'  },
  { x: '-5vw',  y: '35vh' },
  {  x: '20vw',  y: '5vh'  },
];
const ORB_B = [
  {  x: '55vw', y: '45vh' },
  {  x: '20vw', y: '-15vh'},
  { x: '-5vw',  y: '30vh' },
  {  x: '50vw', y: '10vh' },
  {  x: '30vw', y: '-20vh'},
];
const LINE = [
  { left: '20%', width: '60%', top: '50%'  },
  { left:  '5%', width: '90%', top: '12%'  },
  { left: '50%', width: '30%', top: '88%'  },
  { left: '30%', width: '55%', top: '30%'  },
  { left: '15%', width: '70%', top: '92%'  },
];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });
  const prevScene = useRef(-1);

  // Start music on first render
  useEffect(() => {
    startAmbientMusic();
    return () => stopAmbientMusic();
  }, []);

  // Play transition sound on scene change
  useEffect(() => {
    if (prevScene.current !== -1 && prevScene.current !== currentScene) {
      playTransitionSound(currentScene);
    }
    prevScene.current = currentScene;
  }, [currentScene]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: '#030303' }}
    >
      {/* ── Persistent background: static dark gradient, no animating blur ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ willChange: 'transform' }}>
        {/* Static noise grain — no animation, just texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '256px 256px',
          }}
        />

        {/* Orb A — blurred statically (className), only TRANSLATES across scenes */}
        <motion.div
          className="absolute w-[55vw] h-[55vw] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)',
            willChange: 'transform',
          }}
          animate={{ x: ORB_A[currentScene].x, y: ORB_A[currentScene].y }}
          transition={{ duration: 3.5, ease: [0.4, 0, 0.2, 1] }}
        />

        {/* Orb B — blue tint */}
        <motion.div
          className="absolute w-[40vw] h-[40vw] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.07), transparent 70%)',
            willChange: 'transform',
          }}
          animate={{ x: ORB_B[currentScene].x, y: ORB_B[currentScene].y }}
          transition={{ duration: 4, ease: [0.4, 0, 0.2, 1] }}
        />

        {/* Static grid — opacity only, no scale */}
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '4vw 4vw',
          }}
          animate={{ opacity: currentScene === 0 || currentScene === 4 ? 0.4 : 0.9 }}
          transition={{ duration: 1.5 }}
        />
      </div>

      {/* ── Persistent midground accent line ── */}
      <motion.div
        className="absolute h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
          willChange: 'transform',
        }}
        animate={{
          left:   LINE[currentScene].left,
          width:  LINE[currentScene].width,
          top:    LINE[currentScene].top,
          opacity: currentScene === 0 ? 0 : 0.7,
        }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* ── Scene content — GPU-safe transitions only ── */}
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="intro"    />}
        {currentScene === 1 && <Scene2 key="collab"   />}
        {currentScene === 2 && <Scene3 key="ai"       />}
        {currentScene === 3 && <Scene4 key="terminal" />}
        {currentScene === 4 && <Scene5 key="outro"    />}
      </AnimatePresence>
    </div>
  );
}
