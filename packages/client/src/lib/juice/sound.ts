import { settings } from './settings.svelte';

// Spec S17: call-safe sound. Generated with Web Audio (no files to download), short, and kept
// out of the main speech range (~300 Hz–3 kHz): soft high "clicks and bells", low "thumps".
// Only your own actions and shared big moments are full volume; other people's card plays are
// much quieter, so four phones on one call don't make four times the noise.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Browsers only allow audio after a tap; this runs on the first one. */
function unlock(): void {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
}

function ready(): { ctx: AudioContext; out: GainNode; now: number } | null {
  const volume = settings.effectiveVolume;
  if (!ctx || !master || ctx.state !== 'running' || volume <= 0) return null;
  master.gain.value = volume * 0.5;
  return { ctx, out: master, now: ctx.currentTime };
}

function tone(freq: number, dur: number, gain: number, opts: { type?: OscillatorType; delay?: number; glideTo?: number } = {}): void {
  const a = ready();
  if (!a) return;
  const t = a.now + (opts.delay ?? 0);
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, highpass: number, delay = 0): void {
  const a = ready();
  if (!a) return;
  const t = a.now + delay;
  const length = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
  const buffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  const g = a.ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.out);
  src.start(t);
}

/** Semitone steps upward from a bright base, for rising sequences (pips, count-ups). */
const bell = (step: number) => 3200 * 2 ** (step / 12);

export const sound = {
  /** A card lands. Yours is a crisp tick with a soft thud; others' are faint. */
  card(mine: boolean) {
    noise(0.03, mine ? 0.35 : 0.08, 5000);
    tone(140, 0.06, mine ? 0.25 : 0.06);
  },
  /** A call is stamped into the auction. */
  stamp(mine: boolean) {
    tone(170, 0.06, mine ? 0.22 : 0.08);
    noise(0.015, mine ? 0.15 : 0.05, 6000);
  },
  /** A meter pip fills; each one higher than the last. */
  pip(step: number) {
    tone(bell(step), 0.14, 0.09);
  },
  /** Contract set, trump-over: a small accent. */
  accent() {
    tone(110, 0.12, 0.3);
    tone(bell(4), 0.18, 0.07, { delay: 0.02 });
  },
  /** One side is one trick away. */
  close() {
    tone(bell(7), 0.25, 0.05, { glideTo: bell(9) });
  },
  /** Both sides one away: a low rising swell. */
  decider() {
    tone(90, 0.5, 0.18, { glideTo: 130 });
    tone(bell(5), 0.45, 0.04, { glideTo: bell(10), delay: 0.05 });
  },
  /** The clinch: a thump and a bright chord, richer with drama. */
  clinch(drama: number) {
    tone(80, 0.28, 0.45);
    const chord = [0, 4, 7, 12].slice(0, 2 + Math.min(2, drama));
    chord.forEach((s, i) => tone(bell(s), 0.6 + drama * 0.1, 0.08, { delay: 0.01 * i }));
  },
  /** A card turning over in the reveal. */
  flip() {
    noise(0.045, 0.12, 6500);
  },
  /** A number ticking up. */
  count(step: number) {
    tone(bell(step % 12), 0.05, 0.04);
  },
  /** That card can't be played. */
  no() {
    tone(200, 0.12, 0.08, { type: 'triangle', glideTo: 150 });
  },
  /** Spotlight passing a name during the captain draw. */
  tick() {
    tone(bell(10), 0.03, 0.05);
  },
  /** Celebration (end of night, crest complete). */
  fanfare() {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(bell(s), 0.35, 0.06, { delay: i * 0.08 }));
    tone(90, 0.4, 0.3);
  },
};
