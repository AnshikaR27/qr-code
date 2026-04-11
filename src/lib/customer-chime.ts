// Web Audio API chime tones for customer order status page.
// No audio files needed — tones are generated programmatically.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

/**
 * Pleasant two-tone "ding-ding" chime for order ready.
 * ~1 second, full volume, major third interval (E5 → G5).
 */
export function playReadyChime() {
  const ac = getCtx();
  const now = ac.currentTime;

  // First tone — E5 (659 Hz)
  playTone(ac, 659, now, 0.4, 0.8);
  // Second tone — G5 (784 Hz), slightly delayed
  playTone(ac, 784, now + 0.2, 0.5, 0.8);
}

/**
 * Soft single-tone "boop" for preparing status.
 * ~0.5 second, lower volume, gentle.
 */
export function playPreparingChime() {
  const ac = getCtx();
  const now = ac.currentTime;

  playTone(ac, 523, now, 0.35, 0.3); // C5, soft
}

function playTone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // Envelope: quick attack, sustain, smooth decay
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
