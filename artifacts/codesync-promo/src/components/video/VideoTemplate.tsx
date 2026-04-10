import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  intro: 4000,
  collab: 4500,
  ai: 4000,
  terminal: 4000,
  outro: 4500,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#030303]">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Subtle noise texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />
        
        {/* Animated glowing orbs */}
        <motion.div 
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-10 bg-white"
          animate={{
            x: currentScene === 0 ? '-20vw' : currentScene === 1 ? '10vw' : currentScene === 2 ? '40vw' : '-10vw',
            y: currentScene === 0 ? '-20vh' : currentScene === 1 ? '30vh' : currentScene === 2 ? '-10vh' : '40vh',
            scale: currentScene === 0 ? 1 : currentScene === 1 ? 1.5 : currentScene === 2 ? 0.8 : 1.2,
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
        <motion.div 
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-[0.07] bg-blue-500"
          animate={{
            x: currentScene === 0 ? '50vw' : currentScene === 1 ? '20vw' : currentScene === 2 ? '-10vw' : '60vw',
            y: currentScene === 0 ? '50vh' : currentScene === 1 ? '-20vh' : currentScene === 2 ? '40vh' : '10vh',
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />
      </div>

      {/* Grid Lines */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw',
        }}
        animate={{
          opacity: currentScene === 0 ? 0.3 : currentScene === 4 ? 0.2 : 0.8,
          scale: currentScene === 1 ? 1.05 : 1,
        }}
        transition={{ duration: 2 }}
      />

      {/* Scene Content */}
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="intro" />}
        {currentScene === 1 && <Scene2 key="collab" />}
        {currentScene === 2 && <Scene3 key="ai" />}
        {currentScene === 3 && <Scene4 key="terminal" />}
        {currentScene === 4 && <Scene5 key="outro" />}
      </AnimatePresence>
    </div>
  );
}