import { AnimatePresence, motion } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  open: 4000,
  collab: 4500,
  ai_term: 4500,
  themes: 4000,
  close: 4000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0D1117]">
      
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <motion.div className="absolute w-[80vw] h-[80vw] rounded-full opacity-[0.03] blur-3xl"
          style={{ background: 'radial-gradient(circle, #58A6FF, transparent)' }}
          animate={{ 
            x: ['-20%', '30%', '-10%'], 
            y: ['-10%', '20%', '-20%'], 
            scale: [1, 1.2, 0.9] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} 
        />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0wIDYwTDYwIDYwTTAgMExwIDYwIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
      </div>

      {/* Persistent Decorative Elements */}
      <motion.div
        className="absolute w-[2px] bg-accent/50 z-0"
        animate={{
          left: ['10%', '85%', '15%', '50%', '50%'][currentScene],
          height: ['30vh', '60vh', '40vh', '100vh', '0vh'][currentScene],
          top: ['10%', '20%', '50%', '0%', '50%'][currentScene],
          opacity: currentScene === 4 ? 0 : 0.6,
        }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
      
      <motion.div
        className="absolute w-[20vw] h-[20vw] border border-white/5 rounded-full z-0"
        animate={{
          x: ['80vw', '10vw', '70vw', '20vw', '40vw'][currentScene],
          y: ['60vh', '10vh', '80vh', '20vh', '40vh'][currentScene],
          scale: [1, 1.5, 0.8, 2, 0],
          opacity: currentScene === 4 ? 0 : 0.8,
        }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="collab" />}
        {currentScene === 2 && <Scene3 key="ai_term" />}
        {currentScene === 3 && <Scene4 key="themes" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}
