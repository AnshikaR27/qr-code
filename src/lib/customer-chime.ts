// Web Audio API chime tones + speech for customer order status page.
// No audio files needed — tones are generated programmatically,
// and speech uses the browser's built-in Speech Synthesis API.
//
// IMPORTANT: Browsers block AudioContext creation and speechSynthesis.speak()
// unless triggered by a user gesture. Call unlockCustomerAudio() from a click
// handler before any sound can play.

let ctx: AudioContext | null = null;
let notifyAudio: HTMLAudioElement | null = null;

/**
 * Unlock audio for the customer page. Must be called from a user gesture
 * (click/tap). Creates the AudioContext, resumes it, plays a silent buffer,
 * and pre-warms speech synthesis voices.
 */
export async function unlockCustomerAudio(): Promise<void> {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  // Play a silent buffer to fully unlock on iOS/Android
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);

  // Unlock the notify audio element from within this user gesture so it can
  // be played later from a non-gesture context (realtime event).
  if (!notifyAudio) {
    notifyAudio = new Audio('/notify.mp3');
    notifyAudio.load();
  }
  // Play + immediately pause — this "unlocks" the element on Android/iOS
  try {
    await notifyAudio.play();
    notifyAudio.pause();
    notifyAudio.currentTime = 0;
  } catch { /* ignore */ }
}

/** Play one ready chime burst — E5 → G5 → B5 ascending arpeggio. */
function _doReadyChime(ac: AudioContext) {
  const now = ac.currentTime;
  playTone(ac, 659, now,        0.35, 0.9); // E5
  playTone(ac, 784, now + 0.18, 0.35, 0.9); // G5
  playTone(ac, 988, now + 0.36, 0.5,  0.9); // B5
}

function _fireReadyChime() {
  if (!ctx || ctx.state === 'closed') return;
  const c = ctx;
  if (c.state === 'suspended') {
    c.resume().then(() => _doReadyChime(c)).catch(() => {});
  } else {
    _doReadyChime(c);
  }
}

// ── Ready chime loop ───────────────────────────────────────────────────────────

let readyLoopId: ReturnType<typeof setInterval> | null = null;

/**
 * Start looping the ready chime every 4 seconds until stopReadyChimeLoop() is
 * called. Plays once immediately, then repeats. No-op if already looping.
 * Also speaks the ready message once via TTS (requires prior unlockCustomerAudio()).
 */
export function startReadyChimeLoop() {
  if (readyLoopId !== null) return;
  _fireReadyChime();
  // Speak once after the chime finishes — primed by the silent utterance in
  // unlockCustomerAudio(), so it works on Android Chrome and most mobile browsers
  setTimeout(() => _speakReady(), 900);
  readyLoopId = setInterval(_fireReadyChime, 4000);
}

function _speakReady() {
  if (!notifyAudio) return;
  try {
    notifyAudio.currentTime = 0;
    notifyAudio.play().catch(() => { /* blocked — chime still plays */ });
  } catch { /* ignore */ }
}

/** Stop the ready chime loop (call when customer taps / acknowledges). */
export function stopReadyChimeLoop() {
  if (readyLoopId !== null) {
    clearInterval(readyLoopId);
    readyLoopId = null;
  }
}

/** One-shot ready chime (kept for backward compat). */
export function playReadyChime() { _fireReadyChime(); }

/**
 * Soft single-tone "boop" for preparing status.
 * ~0.5 second, lower volume, gentle.
 */
export function playPreparingChime() {
  if (!ctx || ctx.state === 'closed') return;
  const c = ctx;
  const doPlay = (ac: AudioContext) => playTone(ac, 523, ac.currentTime, 0.35, 0.3);
  if (c.state === 'suspended') {
    c.resume().then(() => doPlay(c)).catch(() => {});
  } else {
    doPlay(c);
  }
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
