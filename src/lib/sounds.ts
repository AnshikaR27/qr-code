/**
 * Web Audio API sound synthesizer — no MP3 files needed.
 * All sounds are generated programmatically.
 *
 * Loop control: each sound type has a start/stop pair.
 * The loop replays the sound every N seconds until stopped.
 * Only one loop per sound type runs at a time.
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

// ── One-shot sounds ────────────────────────────────────────────────────────────

/** Warm two-note ding for a new order. */
function _playNewOrder(): void {
  try {
    const c = getCtx();
    const notes = [523.25, 659.25]; // C5 → E5
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
  } catch { /* audio context not ready */ }
}

/** Urgent triple-ring for a waiter call. */
function _playWaiterCall(): void {
  try {
    const c = getCtx();
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.value = 880; // A5
      const t = c.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  } catch { /* ignore */ }
}

// ── Loop control ───────────────────────────────────────────────────────────────

let orderLoopId: ReturnType<typeof setInterval> | null = null;
let waiterLoopId: ReturnType<typeof setInterval> | null = null;

/**
 * Start looping the new-order sound every 4 seconds.
 * No-op if already looping.
 */
export function startNewOrderLoop(): void {
  if (orderLoopId !== null) return;
  _playNewOrder();
  orderLoopId = setInterval(_playNewOrder, 4000);
}

/** Stop the new-order loop. */
export function stopNewOrderLoop(): void {
  if (orderLoopId !== null) {
    clearInterval(orderLoopId);
    orderLoopId = null;
  }
}

/**
 * Start looping the waiter-call sound every 3 seconds.
 * No-op if already looping.
 */
export function startWaiterCallLoop(): void {
  if (waiterLoopId !== null) return;
  _playWaiterCall();
  waiterLoopId = setInterval(_playWaiterCall, 3000);
}

/** Stop the waiter-call loop. */
export function stopWaiterCallLoop(): void {
  if (waiterLoopId !== null) {
    clearInterval(waiterLoopId);
    waiterLoopId = null;
  }
}

/** Play the new-order sound once (for the Enable preview). */
export function playNewOrder(): void { _playNewOrder(); }
