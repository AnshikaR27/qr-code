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
 *
 * IMPORTANT: if no AudioContext exists yet (user has never clicked anything),
 * we skip silently. Creating a new AudioContext without a prior user gesture
 * triggers a browser warning. Only unlockAudio() — called from a real click —
 * should ever call new AudioContext().
 */
function _play(notes: NoteSpec[]): void {
  if (!ctx) return; // no user gesture yet — skip silently
  try {
    const c = ctx;
    if (c.state === 'suspended') {
      // Context was previously unlocked but auto-suspended (e.g. tab blur).
      // Resume is allowed without a gesture in that case.
      c.resume()
        .then(() => _schedule(c, notes))
        .catch(() => { /* browser blocked — silent fail */ });
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
 * 3-second ding-dong alert for auto-printed orders.
 * Three ding-dong pairs spaced 1 s apart; third pair rises in pitch for urgency.
 * Clearly audible in a noisy café.
 */
export function playOrderAlert(): void {
  if (!ctx) return; // AudioContext not yet unlocked — skip silently
  const c = ctx;
  const now = c.currentTime;

  const masterGain = c.createGain();
  masterGain.gain.value = 0.4;
  masterGain.connect(c.destination);

  const pairs = [
    { time: 0.0, highFreq: 880,  lowFreq: 660 },
    { time: 1.0, highFreq: 880,  lowFreq: 660 },
    { time: 2.0, highFreq: 1046, lowFreq: 784 }, // higher pitch on the last pair
  ];

  for (const { time, highFreq, lowFreq } of pairs) {
    // Ding
    const osc1 = c.createOscillator();
    const g1   = c.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = highFreq;
    g1.gain.setValueAtTime(0.4, now + time);
    g1.gain.exponentialRampToValueAtTime(0.01, now + time + 0.4);
    osc1.connect(g1).connect(masterGain);
    osc1.start(now + time);
    osc1.stop(now + time + 0.5);

    // Dong (slightly delayed)
    const osc2 = c.createOscillator();
    const g2   = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = lowFreq;
    g2.gain.setValueAtTime(0.3, now + time + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.01, now + time + 0.6);
    osc2.connect(g2).connect(masterGain);
    osc2.start(now + time + 0.2);
    osc2.stop(now + time + 0.7);
  }
}
