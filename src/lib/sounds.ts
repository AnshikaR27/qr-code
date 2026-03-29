/**
 * Web Audio API sound synthesizer — no MP3 files needed.
 * All sounds are generated programmatically.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext)();
  }
  return ctx;
}

/** Call once after a user gesture to unlock the audio context. */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (c.state === 'suspended') await c.resume();
  // Play a silent one-sample buffer to satisfy autoplay policy
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

/** Returns true if audio has been unlocked by a user gesture. */
export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === 'running';
}

/** Warm two-note ding for a new order. */
export function playNewOrder(): void {
  try {
    const c = getCtx();
    const notes = [523.25, 659.25]; // C5 → E5 ascending
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch { /* ignore — audio context not ready */ }
}

/** Urgent triple-ring for a waiter call. */
export function playWaiterCall(): void {
  try {
    const c = getCtx();
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.value = 880; // A5 — more urgent / higher pitch
      const t = c.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  } catch { /* ignore */ }
}
