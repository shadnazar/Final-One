// Lightweight cart "ding" sound using Web Audio API (no asset, no fetch)
// Plays a short, pleasant 2-tone chime tuned for e-commerce add-to-cart UX.

let audioCtx = null;

const getCtx = () => {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
};

const isSoundEnabled = () => {
  try {
    const v = localStorage.getItem('cg_sound_enabled');
    return v === null ? true : v === 'true';
  } catch { return true; }
};

export const setSoundEnabled = (enabled) => {
  try { localStorage.setItem('cg_sound_enabled', enabled ? 'true' : 'false'); } catch {}
};

export const playCartSound = () => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    // Two-note chime: G5 (783.99) -> C6 (1046.50) — bright, friendly
    const notes = [
      { freq: 783.99, start: 0,    dur: 0.14 },
      { freq: 1046.50, start: 0.09, dur: 0.22 },
    ];
    const master = ctx.createGain();
    master.gain.value = 0.18; // overall volume cap
    master.connect(ctx.destination);

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      // ADSR-ish envelope
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.9, now + n.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    });
  } catch (e) {
    // silent fail — never break UX over audio
  }
};

export { isSoundEnabled };
