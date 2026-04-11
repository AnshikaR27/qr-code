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

// ── Internal scheduling helper ─────────────────────────────────────────────────

interface NoteSpec {
  freq: number;
  /** Seconds after scheduling start */
  offset: number;
  duration: number;
  gain: number;
}

/**
 * Schedule notes on an already-running context.
 * All times are relative to c.currentTime at the moment of call.
 */
function _schedule(c: AudioContext, notes: NoteSpec[]): void {
  const now = c.currentTime;
  for (const { freq, offset, duration, gain: peakGain } of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = now + offset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }
}

/**
 * Play notes, resuming the context first if it is suspended.
 * Notes are scheduled relative to the moment the context is confirmed running,
 * so they never fire at stale/past timestamps (which causes instant burst playback
 * after a delayed resume).
 */
function _play(notes: NoteSpec[]): void {
  try {
    const c = getCtx();
    if (c.state === 'suspended') {
      // Resume may succeed if the context was previously unlocked and then
      // auto-suspended by the browser (tab blur etc.). Schedule notes only
      // after the resume promise resolves so currentTime is fresh.
      c.resume()
        .then(() => _schedule(c, notes))
        .catch(() => { /* browser blocked audio — silent fail */ });
    } else {
      _schedule(c, notes);
    }
  } catch { /* AudioContext unavailable */ }
}

// ── One-shot sounds ────────────────────────────────────────────────────────────

const NEW_ORDER_NOTES: NoteSpec[] = [
  { freq: 523.25, offset: 0,    duration: 0.55, gain: 0.4 }, // C5
  { freq: 659.25, offset: 0.22, duration: 0.55, gain: 0.4 }, // E5
];

const WAITER_CALL_NOTES: NoteSpec[] = [
  { freq: 880, offset: 0,    duration: 0.18, gain: 0.55 }, // A5
  { freq: 880, offset: 0.22, duration: 0.18, gain: 0.55 },
  { freq: 880, offset: 0.44, duration: 0.18, gain: 0.55 },
];

/**
 * Three ascending dings repeated 3 times — used when an order auto-prints.
 * Each arpeggio (C5 → E5 → G5) takes ~1 s; total ~3.1 s.
 */
const TRIPLE_CHIME_NOTES: NoteSpec[] = [
  // 1st arpeggio
  { freq: 523.25, offset: 0.00, duration: 0.55, gain: 0.4 },
  { freq: 659.25, offset: 0.22, duration: 0.55, gain: 0.4 },
  { freq: 784.0,  offset: 0.44, duration: 0.55, gain: 0.4 },
  // 2nd arpeggio
  { freq: 523.25, offset: 1.10, duration: 0.55, gain: 0.4 },
  { freq: 659.25, offset: 1.32, duration: 0.55, gain: 0.4 },
  { freq: 784.0,  offset: 1.54, duration: 0.55, gain: 0.4 },
  // 3rd arpeggio
  { freq: 523.25, offset: 2.20, duration: 0.55, gain: 0.4 },
  { freq: 659.25, offset: 2.42, duration: 0.55, gain: 0.4 },
  { freq: 784.0,  offset: 2.64, duration: 0.55, gain: 0.4 },
];

function _playNewOrder():   void { _play(NEW_ORDER_NOTES);    }
function _playWaiterCall(): void { _play(WAITER_CALL_NOTES);  }

// ── Loop control ───────────────────────────────────────────────────────────────

let orderLoopId:  ReturnType<typeof setInterval> | null = null;
let waiterLoopId: ReturnType<typeof setInterval> | null = null;

/** Start looping the new-order sound every 4 seconds. No-op if already looping. */
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

/** Start looping the waiter-call sound every 3 seconds. No-op if already looping. */
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

/** Play the new-order sound once (e.g. for the Enable Sound preview). */
export function playNewOrder(): void { _playNewOrder(); }

/**
 * Three ascending dings (C5 → E5 → G5) for auto-printed orders.
 * Clearly audible even if staff aren't looking at the screen.
 */
export function playTripleChime(): void { _play(TRIPLE_CHIME_NOTES); }
