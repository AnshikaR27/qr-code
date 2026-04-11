// Web Audio API chime tones + speech for customer order status page.
// No audio files needed — tones are generated programmatically,
// and speech uses the browser's built-in Speech Synthesis API.

let ctx: AudioContext | null = null;

// Pre-load voices — browsers load them asynchronously, so getVoices()
// returns [] on the first call. This ensures they're ready when needed.
let voicesLoaded = false;
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.getVoices(); // kick off loading
  speechSynthesis.addEventListener('voiceschanged', () => {
    voicesLoaded = true;
  });
  // Some browsers (Firefox) load voices synchronously
  if (speechSynthesis.getVoices().length > 0) voicesLoaded = true;
}

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
 * Speaks "Your order is ready!" using the browser Speech Synthesis API,
 * with a short chime beforehand to grab attention.
 * Falls back to the chime-only if speech synthesis is unavailable.
 */
export function playReadyChime() {
  const ac = getCtx();
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
      speechSynthesis.speak(utterance);
      speechSynthesis.removeEventListener('voiceschanged', onVoices);
    };
    speechSynthesis.addEventListener('voiceschanged', onVoices);
    // Fallback: if voiceschanged never fires (some browsers), speak anyway after 500ms
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', onVoices);
      // Only speak if not already speaking (the event handler may have fired)
      if (!speechSynthesis.speaking) {
        speechSynthesis.speak(utterance);
      }
    }, 500);
  }
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
