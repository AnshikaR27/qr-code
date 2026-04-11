// Web Audio API chime tones + speech for customer order status page.
// No audio files needed — tones are generated programmatically,
// and speech uses the browser's built-in Speech Synthesis API.
//
// IMPORTANT: Browsers block AudioContext creation and speechSynthesis.speak()
// unless triggered by a user gesture. Call unlockCustomerAudio() from a click
// handler before any sound can play.

let ctx: AudioContext | null = null;

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

  // Pre-warm speech synthesis voices
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
  }
}

/** Returns the existing AudioContext, or null if not yet unlocked. */
function getCtx(): AudioContext | null {
  if (!ctx || ctx.state === 'closed') return null;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Speaks "Your order is ready!" using the browser Speech Synthesis API,
 * with a short chime beforehand to grab attention.
 * Falls back to chime-only if speech synthesis is unavailable or blocked.
 */
export function playReadyChime() {
  const ac = getCtx();
  if (!ac) return; // not unlocked yet — skip silently

  const now = ac.currentTime;

  // Attention chime first — E5 → G5
  playTone(ac, 659, now, 0.4, 0.8);
  playTone(ac, 784, now + 0.2, 0.5, 0.8);

  // Speak "Your order is ready!" after the chime finishes
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    setTimeout(() => {
      speakUS('Your order is ready! Please collect from the counter.');
    }, 700); // wait for chime to finish
  }
}

/** Speak text in a US English accent. Handles async voice loading. */
function speakUS(text: string) {
  try {
    // Cancel any in-progress speech to avoid overlap
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      return voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang.startsWith('en'))
        || null;
    };

    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      speechSynthesis.speak(utterance);
    } else {
      // Voices not loaded yet — wait for them, then speak
      const onVoices = () => {
        const v = pickVoice();
        if (v) utterance.voice = v;
        try {
          speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('[customer-chime] speech blocked after voiceschanged:', e);
        }
        speechSynthesis.removeEventListener('voiceschanged', onVoices);
      };
      speechSynthesis.addEventListener('voiceschanged', onVoices);
      // Fallback: if voiceschanged never fires, speak anyway after 500ms
      setTimeout(() => {
        speechSynthesis.removeEventListener('voiceschanged', onVoices);
        if (!speechSynthesis.speaking) {
          try {
            speechSynthesis.speak(utterance);
          } catch (e) {
            console.warn('[customer-chime] speech fallback blocked:', e);
          }
        }
      }, 500);
    }
  } catch (e) {
    // Chrome on Android may block speechSynthesis.speak() entirely
    // if not in a direct user gesture chain — fall back to chime-only
    console.warn('[customer-chime] speechSynthesis blocked, falling back to chime-only:', e);
  }
}

/**
 * Soft single-tone "boop" for preparing status.
 * ~0.5 second, lower volume, gentle.
 */
export function playPreparingChime() {
  const ac = getCtx();
  if (!ac) return; // not unlocked yet — skip silently

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
