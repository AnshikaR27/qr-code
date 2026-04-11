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
      const utterance = new SpeechSynthesisUtterance('Your order is ready! Please collect from the counter.');
      utterance.rate = 1;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      // Prefer a natural-sounding English voice if available
      const voices = speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
        || voices.find(v => v.lang.startsWith('en'))
        || null;
      if (englishVoice) utterance.voice = englishVoice;
      speechSynthesis.speak(utterance);
    }, 700); // wait for chime to finish
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
