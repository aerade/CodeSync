// Web Audio API synthesizer for CodeSync promo video
// Provides background ambient music + per-scene sound effects

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientOscillators: OscillatorNode[] = [];
let rhythmInterval: ReturnType<typeof setInterval> | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function getMaster(): GainNode {
  getContext();
  return masterGain!;
}

// Low-pass filter for warmth
function makeLowPass(ctx: AudioContext, freq: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = 0.5;
  return f;
}

// Reverb-like effect using delay
function makeReverb(ctx: AudioContext): DelayNode {
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.18;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  delay.connect(feedback);
  feedback.connect(delay);
  return delay;
}

export function startAmbientMusic() {
  const ctx = getContext();
  const master = getMaster();

  // Stop any existing oscillators
  stopAmbientMusic();

  const t = ctx.currentTime;

  // Ambient pad chords — A minor feel, techy/atmospheric
  // Notes: A2, C3, E3, G3, A3 — soft Am7 chord
  const frequencies = [
    110.0,   // A2
    130.81,  // C3
    164.81,  // E3
    196.0,   // G3
    220.0,   // A3
    261.63,  // C4 (subtle)
  ];

  const reverb = makeReverb(ctx);
  const lpf = makeLowPass(ctx, 800);
  lpf.connect(master);
  reverb.connect(lpf);

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = i < 2 ? 'sine' : 'triangle';
    osc.frequency.value = freq;

    // Very slight detune for richness
    osc.detune.value = (i % 3) * 4 - 4;

    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.04 - i * 0.004, t + 2);

    osc.connect(oscGain);
    oscGain.connect(reverb);

    osc.start(t);
    ambientOscillators.push(osc);
  });

  // Slow rhythmic pulse — subtle hi-hat like texture
  let beat = 0;
  rhythmInterval = setInterval(() => {
    if (!ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    if (beat % 4 === 0) {
      playSubtleTick(ctx, master, 0.08);
    } else if (beat % 2 === 0) {
      playSubtleTick(ctx, master, 0.04);
    }
    beat++;
  }, 480); // ~125bpm quarter notes halved
}

function playSubtleTick(ctx: AudioContext, dest: AudioNode, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lpf = makeLowPass(ctx, 3000);

  osc.type = 'square';
  osc.frequency.value = 2400;

  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

  osc.connect(gain);
  gain.connect(lpf);
  lpf.connect(dest);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

export function stopAmbientMusic() {
  if (rhythmInterval) {
    clearInterval(rhythmInterval);
    rhythmInterval = null;
  }
  ambientOscillators.forEach(osc => {
    try { osc.stop(); } catch (_) {}
  });
  ambientOscillators = [];
}

// Scene transition whoosh — rising sweep
export function playTransitionSound(sceneIndex: number) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = getMaster();

  // Frequency sweep
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lpf = makeLowPass(ctx, 2000);

  osc.type = 'sine';

  const baseFreq = 220 + sceneIndex * 40;
  osc.frequency.setValueAtTime(baseFreq * 0.5, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.25);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(lpf);
  lpf.connect(master);

  osc.start(now);
  osc.stop(now + 0.45);

  // Sub thump
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(60, now);
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  subGain.gain.setValueAtTime(0.35, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(now);
  sub.stop(now + 0.3);
}

// Soft click — for UI element reveals
export function playClickSound(delay = 0) {
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const master = getMaster();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(master);

  osc.start(now);
  osc.stop(now + 0.08);
}

// Typing sound — for code scenes
export function playTypeSound(delay = 0) {
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const master = getMaster();

  const noise = ctx.createOscillator();
  const gain = ctx.createGain();
  const lpf = makeLowPass(ctx, 2500);

  noise.type = 'square';
  noise.frequency.value = 1200 + Math.random() * 400;

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  noise.connect(gain);
  gain.connect(lpf);
  lpf.connect(master);

  noise.start(now);
  noise.stop(now + 0.04);
}

// Rising arpeggio — for outro/reveal moments
export function playArpeggio(baseFreq = 220, numNotes = 6) {
  if (!ctx) return;
  const master = getMaster();
  const ratios = [1, 1.25, 1.5, 1.875, 2.25, 3];

  ratios.slice(0, numNotes).forEach((ratio, i) => {
    const delay = i * 0.08;
    const now = ctx!.currentTime + delay;

    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.value = baseFreq * ratio;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  });
}

export function fadeOutMusic(duration = 2) {
  if (!masterGain || !ctx) return;
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
}

export function setMasterVolume(v: number) {
  if (!masterGain || !ctx) return;
  masterGain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.1);
}
