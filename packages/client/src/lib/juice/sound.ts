import { settings } from './settings.svelte';

// Spec S17: call-friendly sound, generated with Web Audio (nothing to download).
// Phone speakers can't play much below ~300 Hz, so every sound has its body in the
// 300 Hz–5 kHz band: short snaps, knocks and bells. Sounds are brief transients, which
// a call's echo cancelling handles well. Other people's card plays are quieter than yours.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/**
 * Phones only let a page make sound from inside a completed tap (touchend / pointerup /
 * click), not from the moment a finger lands. We listen to all of them, every time, so the
 * sound also comes back after the phone suspends it (switching to Messenger and back).
 */
function unlock(): void {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state !== 'running') {
      void ctx.resume();
      // iOS also wants something to actually play inside the gesture.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, 22050);
      silent.connect(ctx.destination);
      silent.start(0);
    }
  } catch {
    ctx = null;
  }
}

if (typeof document !== 'undefined') {
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { passive: true, capture: true });
  }
}

/** Sounds that actually reached the speaker, for tests (see e2e/sound.spec.ts). */
const played: string[] = [];
if (typeof window !== 'undefined') (window as unknown as { __darkSounds: string[] }).__darkSounds = played;

function ready(): { ctx: AudioContext; out: GainNode; now: number } | null {
  const volume = settings.effectiveVolume;
  if (!ctx || !master || ctx.state !== 'running' || volume <= 0) return null;
  master.gain.value = volume * 0.9;
  return { ctx, out: master, now: ctx.currentTime };
}

interface ToneOptions {
  type?: OscillatorType;
  delay?: number;
  glideTo?: number;
  /** Low-pass the tone (softens saw/square waves into something brassy). */
  lowpass?: number;
}

function tone(freq: number, dur: number, gain: number, opts: ToneOptions = {}): void {
  const a = ready();
  if (!a) return;
  const t = a.now + (opts.delay ?? 0);
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (opts.lowpass) {
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lowpass;
    node = node.connect(f);
  }
  node.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

interface NoiseOptions {
  delay?: number;
  /** Band-pass centre; sweeps to `sweepTo` over the duration if given. */
  band?: number;
  sweepTo?: number;
  q?: number;
  highpass?: number;
}

function noise(dur: number, gain: number, opts: NoiseOptions = {}): void {
  const a = ready();
  if (!a) return;
  const t = a.now + (opts.delay ?? 0);
  const length = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
  const buffer = a.ctx.createBuffer(1, length, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  if (opts.highpass) {
    filter.type = 'highpass';
    filter.frequency.value = opts.highpass;
  } else {
    filter.type = 'bandpass';
    filter.Q.value = opts.q ?? 0.9;
    filter.frequency.setValueAtTime(opts.band ?? 2500, t);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
  }
  const g = a.ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.out);
  src.start(t);
}

/** Log and play: `name` is what tests see. */
function play(name: string, make: () => void): void {
  if (!ready()) return;
  played.push(name);
  if (played.length > 200) played.splice(0, 100);
  make();
}

/** A bright bell `step` semitones above C6, with a soft octave partial. */
function bell(step: number, dur: number, gain: number, delay = 0): void {
  const f = 1047 * 2 ** (step / 12);
  tone(f, dur, gain, { delay });
  tone(f * 2, dur * 0.6, gain * 0.25, { delay });
}

/** A short wooden/card knock: the body of most of our sounds. */
function knock(freq: number, gain: number, delay = 0): void {
  noise(0.035, gain, { band: freq * 4, q: 1.1, delay });
  tone(freq, 0.07, gain * 0.6, { type: 'triangle', glideTo: freq * 0.7, delay });
}

export const sound = {
  /** Pressing a bidding button. */
  tap() {
    play('tap', () => tone(1800, 0.025, 0.08, { type: 'triangle' }));
  },
  /** A bid stamped into the auction: heavier and higher as the level rises. */
  stamp(level: number, mine: boolean) {
    play('stamp', () => {
      const v = mine ? 1 : 0.6;
      knock(330 + level * 40, (0.32 + level * 0.04) * v);
      if (level >= 5) bell(level, 0.25, 0.08 * v, 0.03);
    });
  },
  /** A pass: a soft swish. */
  pass(mine: boolean) {
    play('pass', () => noise(0.13, mine ? 0.3 : 0.18, { band: 900, sweepTo: 2400, q: 0.7 }));
  },
  /** "Going once" (1), "going twice" (2). */
  going(n: number) {
    play('going', () => {
      knock(700 + n * 180, 0.3);
      knock(700 + n * 180, 0.22, 0.09);
    });
  },
  /** The auction is won: a gavel and a bright chord. */
  sold() {
    play('sold', () => {
      knock(260, 0.7);
      [0, 4, 7].forEach((s, i) => bell(s, 0.5, 0.09, 0.06 + i * 0.05));
    });
  },
  /** No contract: four passes, cards gathered up. */
  passedOut() {
    play('passedOut', () => noise(0.35, 0.2, { band: 2400, sweepTo: 700, q: 0.6 }));
  },
  /** A card lands on the table. */
  card(mine: boolean) {
    play('card', () => {
      const v = mine ? 1 : 0.45;
      noise(0.04, 0.55 * v, { band: 2600, q: 0.9 });
      tone(620, 0.05, 0.22 * v, { type: 'triangle', glideTo: 430 });
    });
  },
  /** A card takes the lead of the trick. `n` = how many times the lead has changed (1–3). */
  lead(n: number) {
    play('lead', () => bell(2 + n * 3, 0.26, 0.12, 0.02));
  },
  /** A trump lands on a trick led in another suit. */
  trumpIn() {
    play('trumpIn', () => {
      noise(0.08, 0.6, { band: 1100, q: 0.7 });
      tone(330, 0.18, 0.22, { type: 'sawtooth', glideTo: 220, lowpass: 1800 });
      noise(0.3, 0.07, { highpass: 5500, delay: 0.03 });
      bell(7, 0.3, 0.1, 0.04);
    });
  },
  /** The trick is gathered toward its winner. */
  sweep() {
    play('sweep', () => noise(0.16, 0.22, { band: 700, sweepTo: 2200, q: 0.8 }));
  },
  /** A trick pip lands in the score bar; each one a little higher. */
  pip(step: number) {
    play('pip', () => bell(step, 0.18, 0.11));
  },
  /** A trick won with a trump: a two-note brass call. */
  trumpTrick() {
    play('trumpTrick', () => {
      tone(392, 0.16, 0.16, { type: 'sawtooth', lowpass: 2400 });
      tone(587, 0.26, 0.16, { type: 'sawtooth', lowpass: 2400, delay: 0.12 });
      bell(7, 0.3, 0.07, 0.12);
    });
  },
  /** The first trick of the deal won with a trump: a rising fanfare. */
  firstTrump() {
    play('firstTrump', () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 0.15, { type: 'sawtooth', lowpass: 2600, delay: i * 0.07 }));
      noise(0.45, 0.06, { highpass: 6000, delay: 0.2 });
      bell(12, 0.5, 0.08, 0.28);
    });
  },
  /** One side is one trick away. */
  close() {
    play('close', () => tone(1568, 0.3, 0.06, { glideTo: 1760 }));
  },
  /** Both sides one away: a rising swell. */
  decider() {
    play('decider', () => {
      tone(330, 0.55, 0.12, { type: 'sawtooth', glideTo: 494, lowpass: 1500 });
      bell(5, 0.5, 0.05, 0.1);
    });
  },
  /** The clinch: a big knock and a chord, richer with drama. */
  clinch(drama: number) {
    play('clinch', () => {
      knock(240, 0.8);
      const chord = [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, drama));
      chord.forEach((s, i) => bell(s, 0.8 + drama * 0.15, 0.09, 0.02 * i));
      tone(523, 0.6, 0.1, { type: 'sawtooth', lowpass: 2000 });
    });
  },
  /** A card turning over. */
  flip() {
    play('flip', () => noise(0.05, 0.3, { band: 3200, q: 1 }));
  },
  /** A number ticking up. */
  count(step: number) {
    play('count', () => tone(1047 * 2 ** ((step % 12) / 12), 0.05, 0.06));
  },
  /** That card can't be played. */
  no() {
    play('no', () => tone(330, 0.13, 0.14, { type: 'triangle', glideTo: 247 }));
  },
  /** Spotlight passing a name during the captain draw. */
  tick() {
    play('tick', () => tone(2093, 0.03, 0.06));
  },
  /** A small accent (captain chosen). */
  accent() {
    play('accent', () => {
      knock(440, 0.35);
      bell(4, 0.25, 0.08, 0.02);
    });
  },
  /** Celebration (end of night, crest complete). */
  fanfare() {
    play('fanfare', () => {
      knock(300, 0.5);
      [0, 4, 7, 12, 16].forEach((s, i) => bell(s, 0.4, 0.08, i * 0.08));
    });
  },
};

export type SoundName = keyof typeof sound;
