import { soundTheme, type SoundRoom } from '../themes';
import { settings } from './settings.svelte';

// Spec S17: call-friendly sound, generated with Web Audio (nothing to download).
// Phone speakers can't play much below ~300 Hz, so every sound has its body in the
// 300 Hz–5 kHz band: short snaps, knocks, bells and brass stabs. Sounds are brief transients,
// which a call's echo cancelling handles well. Other people's card plays are quieter than yours.
//
// Signal chain (built once per AudioContext):
//   voices ─┬─────────────────────────────────────────► master ─► high-pass ─► limiter ─► speaker
//           └─► send (per voice) ─► room (convolver) ─► wet ──┘
// The room is a short, procedurally generated impulse response (decaying filtered noise, stereo),
// tuned per theme (soundTheme.room). Most sounds are dry-ish; bells, chords and fanfares go wetter.

interface Engine {
  ctx: BaseAudioContext;
  /** Volume; dry voices connect here. */
  master: GainNode;
  /** Reverb send bus. */
  send: GainNode;
  room: ConvolverNode;
  /** Reverb return level (theme's room.wet). */
  wet: GainNode;
  roomKey: string;
  /** Two seconds of white noise, shared by every noisy layer. */
  noise: AudioBuffer;
  /** Start time of the sound being made. */
  now: number;
}

let ctx: AudioContext | null = null;
let live: Engine | null = null;
/** Set while rendering into an OfflineAudioContext for tests. */
let offline: { engine: Engine; volume: number; at?: number } | null = null;

function makeNoise(c: BaseAudioContext): AudioBuffer {
  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = mulberry32(7);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
  return buffer;
}

function buildEngine(c: BaseAudioContext): Engine {
  const master = c.createGain();
  // Nothing below ~250 Hz reaches a phone speaker; cutting it keeps headroom for the band that does.
  const highpass = c.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 260;
  highpass.Q.value = 0.7;
  // A gentle limiter so stacked layers never clip.
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(highpass).connect(limiter).connect(c.destination);
  const send = c.createGain();
  const room = c.createConvolver();
  room.normalize = false;
  const wet = c.createGain();
  send.connect(room).connect(wet).connect(master);
  return { ctx: c, master, send, room, wet, roomKey: '', noise: makeNoise(c), now: 0 };
}

/**
 * Phones only let a page make sound from inside a completed tap (touchend / pointerup /
 * click), not from the moment a finger lands. We listen to all of them, every time, so the
 * sound also comes back after the phone suspends it (switching to Messenger and back).
 */
function unlock(): void {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      live = buildEngine(ctx);
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
    live = null;
  }
}

if (typeof document !== 'undefined') {
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { passive: true, capture: true });
  }
}

/** Sounds that actually reached the speaker, for tests (see e2e/sound.spec.ts): the latest ones in
 *  order, and a running count of each that is never trimmed (a deal alone plays 52). */
const played: string[] = [];
const playedCount: Record<string, number> = {};
if (typeof window !== 'undefined') {
  (window as unknown as { __darkSounds: string[] }).__darkSounds = played;
  (window as unknown as { __darkSoundCount: Record<string, number> }).__darkSoundCount = playedCount;
}

// ---------------------------------------------------------------------------------------------
// The room: a procedurally generated impulse response.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A small room's stereo impulse response: exponentially decaying noise (−60 dB at `decay`),
 * low-passed more as it dies away (air and walls soak up the highs first), high-passed at
 * ~350 Hz so the tail never rumbles. Each channel has unit energy; the send/return gains set
 * the level. Deterministic (seeded), so every device gets the same room.
 */
export function makeImpulse(sampleRate: number, room: SoundRoom): Float32Array[] {
  const pre = 0.008;
  const decay = Math.min(1.2, Math.max(0.2, room.decay));
  const bright = Math.min(1, Math.max(0, room.bright));
  const length = Math.ceil((pre + decay) * sampleRate);
  const fHi = 3000 + bright * 7000;
  const fLo = 1200 + bright * 2300;
  const hpA = 1 - Math.exp((-2 * Math.PI * 350) / sampleRate);
  return [11, 23].map((seed) => {
    const rand = mulberry32(seed);
    const ir = new Float32Array(length);
    let lp = 0;
    let lo = 0;
    let energy = 0;
    for (let i = Math.floor(pre * sampleRate); i < length; i++) {
      const t = i / sampleRate - pre;
      const fc = fLo + (fHi - fLo) * Math.exp(-t / (decay * 0.3));
      lp += (1 - Math.exp((-2 * Math.PI * fc) / sampleRate)) * (rand() * 2 - 1 - lp);
      lo += hpA * (lp - lo);
      const fadeIn = Math.min(1, t / 0.004);
      const v = (lp - lo) * Math.exp((-6.91 * t) / decay) * fadeIn;
      ir[i] = v;
      energy += v * v;
    }
    const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = 0; i < length; i++) ir[i]! *= scale;
    return ir;
  });
}

const impulseCache = new Map<string, AudioBuffer>();

function tuneRoom(e: Engine): void {
  const room = soundTheme.room;
  e.wet.gain.value = room.wet;
  const key = `${e.ctx.sampleRate}|${room.decay}|${room.bright}`;
  if (e.roomKey === key) return;
  let buffer = impulseCache.get(key);
  if (!buffer) {
    const channels = makeImpulse(e.ctx.sampleRate, room);
    buffer = e.ctx.createBuffer(2, channels[0]!.length, e.ctx.sampleRate);
    channels.forEach((data, i) => buffer!.getChannelData(i).set(data));
    impulseCache.set(key, buffer);
  }
  e.room.buffer = buffer;
  e.roomKey = key;
}

function ready(): Engine | null {
  if (offline) {
    const e = offline.engine;
    e.master.gain.value = offline.volume * MASTER;
    tuneRoom(e);
    e.now = OFFLINE_LEAD + (offline.at ?? 0);
    return e;
  }
  const volume = settings.effectiveVolume;
  if (!ctx || !live || ctx.state !== 'running' || volume <= 0) return null;
  live.master.gain.value = volume * MASTER;
  tuneRoom(live);
  live.now = ctx.currentTime;
  return live;
}

const OFFLINE_LEAD = 0.3;

/** Master level into the limiter (the limiter also adds a little make-up gain). */
const MASTER = 0.7;

// ---------------------------------------------------------------------------------------------
// Building blocks. Every layer is one or two sources plus a gain: a sound is ~4–15 nodes.

/** A small random factor around 1 (±amount), so repeated sounds never sound machine-gunned. */
function vary(amount = 0.025): number {
  return 1 + (Math.random() * 2 - 1) * amount;
}

/** Connect a voice to the speaker, and (if `wet` > 0) to the room. */
function route(e: Engine, node: AudioNode, wet: number): void {
  node.connect(e.master);
  if (wet > 0) {
    const s = e.ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(e.send);
  }
}

interface ToneOptions {
  type?: OscillatorType;
  delay?: number;
  glideTo?: number;
  /** Low-pass the tone (softens saw/square waves into something brassy). */
  lowpass?: number;
  /** Seconds to reach full level (default 5 ms). */
  attack?: number;
  /** Reverb send, 0–1. */
  wet?: number;
  /** Extra pitch factor (on top of the theme's), e.g. vary(). */
  bend?: number;
}

function tone(e: Engine, freq: number, dur: number, gain: number, opts: ToneOptions = {}): void {
  const t = e.now + (opts.delay ?? 0);
  const attack = Math.min(opts.attack ?? 0.005, dur * 0.9);
  const osc = e.ctx.createOscillator();
  const g = e.ctx.createGain();
  osc.type = opts.type ?? 'sine';
  // Each theme tunes the whole set slightly (S18): same sounds, different room.
  const p = soundTheme.pitch * (opts.bend ?? 1);
  osc.frequency.setValueAtTime(freq * p, t);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo * p, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (opts.lowpass) {
    const f = e.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lowpass;
    node = node.connect(f);
  }
  node.connect(g);
  route(e, g, opts.wet ?? 0);
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
  /** 'hit' = instant attack, fast decay; 'swell' = rises to a peak at `peak` × dur, then fades. */
  shape?: 'hit' | 'swell';
  peak?: number;
  attack?: number;
  wet?: number;
  /** Stereo pan glide (−1…1), for whooshes. */
  pan?: [number, number];
}

function noise(e: Engine, dur: number, gain: number, opts: NoiseOptions = {}): void {
  const c = e.ctx;
  const t = e.now + (opts.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  if (opts.highpass) {
    filter.type = 'highpass';
    filter.frequency.value = opts.highpass;
  } else {
    filter.type = 'bandpass';
    filter.Q.value = opts.q ?? 0.9;
    filter.frequency.setValueAtTime(opts.band ?? 2500, t);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  if (opts.shape === 'swell') {
    g.gain.linearRampToValueAtTime(gain, t + dur * (opts.peak ?? 0.6));
  } else {
    g.gain.exponentialRampToValueAtTime(gain, t + (opts.attack ?? 0.001));
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = src.connect(filter).connect(g);
  if (opts.pan && 'createStereoPanner' in c) {
    const panner = c.createStereoPanner();
    panner.pan.setValueAtTime(opts.pan[0], t);
    panner.pan.linearRampToValueAtTime(opts.pan[1], t + dur);
    node = node.connect(panner);
  }
  route(e, node, opts.wet ?? 0);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.02);
}

/** A tiny bright click: the "snap" at the front of a sound. */
function snap(e: Engine, gain: number, delay = 0, highpass = 2800): void {
  noise(e, 0.014, gain, { highpass, delay });
}

/** A bell at `freq` Hz: fundamental, the theme's partial, and an optional high shimmer (wetter). */
function bellHz(e: Engine, freq: number, dur: number, gain: number, delay = 0, wet = 0.2, shimmer = 0, bend = 1): void {
  tone(e, freq, dur, gain, { delay, wet, attack: 0.003, bend });
  // Usually an octave; Bali Batik uses an inharmonic partial for a gamelan-like ring.
  const bp = soundTheme.bellPartial;
  tone(e, freq * bp, dur * 0.6, gain * (bp === 2 ? 0.25 : 0.4), { delay, wet, attack: 0.002, bend });
  if (shimmer > 0 && freq * 3 < 6500) tone(e, freq * 3.01, dur * 0.35, gain * shimmer, { delay, wet: Math.min(1, wet * 1.6), attack: 0.002, bend });
}

/** A bright bell `step` semitones above C6. */
function bell(e: Engine, step: number, dur: number, gain: number, delay = 0, wet = 0.2, shimmer = 0, bend = 1): void {
  bellHz(e, 1047 * 2 ** (step / 12), dur, gain, delay, wet, shimmer, bend);
}

/** A short wooden/card knock: noise strike + a falling triangle body (kept ≥ 340 Hz for phones). */
function knock(e: Engine, freq: number, gain: number, delay = 0, wet = 0.06): void {
  const body = Math.max(340, freq);
  noise(e, 0.035, gain, { band: freq * 4, q: 1.1, delay, wet });
  tone(e, body, 0.07, gain * 0.6, { type: 'triangle', glideTo: body * 0.82, delay, wet });
}

/** A brass stab: two detuned saws through a low-pass that opens fast and closes slowly. */
function brass(e: Engine, freq: number, dur: number, gain: number, delay = 0, wet = 0.12, bright = 6): void {
  const c = e.ctx;
  const t = e.now + delay;
  const f = freq * soundTheme.pitch;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(f * 1.5, t);
  filter.frequency.linearRampToValueAtTime(Math.min(4500, f * bright), t + 0.03);
  filter.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(gain * 0.5, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  filter.connect(g);
  for (const cents of [-6, 7]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  route(e, g, wet);
}

/** Air moving: a band of noise sweeping up and across. */
function whooshBody(e: Engine, dur: number, gain: number, wet: number): void {
  noise(e, dur, gain, { band: 500, sweepTo: 2600, q: 1.3, shape: 'swell', peak: 0.55, wet, pan: [-0.5, 0.5] });
  noise(e, dur * 0.8, gain * 0.35, { band: 1500, sweepTo: 5200, q: 2, shape: 'swell', peak: 0.6, delay: dur * 0.15, wet, pan: [-0.3, 0.6] });
}

/** A punchy hit: noise crack, mid "thump" and a falling knock body, all ≥ 300 Hz. power 0–3. */
function impactBody(e: Engine, power: number): void {
  const p = Math.min(3, Math.max(0, power));
  const wet = 0.04 + p * 0.05;
  noise(e, 0.03 + p * 0.012, 0.3 + p * 0.1, { highpass: 1800, wet });
  noise(e, 0.09 + p * 0.03, 0.45 + p * 0.15, { band: 620, sweepTo: 420, q: 1.4, wet });
  tone(e, 470, 0.12 + p * 0.05, 0.26 + p * 0.07, { type: 'triangle', glideTo: 350, attack: 0.002, wet });
  if (p >= 1) tone(e, 1130, 0.06 + p * 0.02, 0.05 + p * 0.03, { glideTo: 940, attack: 0.001, wet });
  if (p >= 2) noise(e, 0.25 + (p - 2) * 0.15, 0.05 + p * 0.02, { highpass: 5000, delay: 0.015, wet: 0.35 });
}

/** A tension swell of `d` seconds: filtered noise and a gliding tone, ending with a short fade. */
function riserBody(e: Engine, d: number, gain = 1): void {
  const peak = Math.max(0.7, 1 - 0.14 / d);
  noise(e, d, 0.2 * gain, { band: 600, sweepTo: 3600, q: 1.6, shape: 'swell', peak, wet: 0.12 });
  tone(e, 340, d, 0.07 * gain, { type: 'sawtooth', glideTo: 680, lowpass: 1900, attack: d * peak, wet: 0.1 });
  tone(e, 680, d, 0.04 * gain, { glideTo: 1360, attack: d * peak, wet: 0.15 });
}

interface Tick {
  /** Seconds after the sound starts. */
  at: number;
  gain: number;
  /** Band-pass centre, Hz. */
  freq: number;
  /** Length of the tick, seconds. */
  dur: number;
}

/**
 * A run of tiny papery clicks (card edges flicking past each other) on ONE noise source, ONE
 * band-pass and ONE gain: each tick is just automation events, so a 30-click riffle costs
 * 3–4 nodes. Ticks must be in time order and shouldn't overlap.
 */
function ticks(e: Engine, list: Tick[], q = 2.2, wet = 0): void {
  if (!list.length) return;
  const c = e.ctx;
  const t0 = e.now;
  const src = c.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  let end = t0;
  for (const k of list) {
    const t = Math.max(end, t0 + k.at);
    filter.frequency.setValueAtTime(k.freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(k.gain, t + 0.0006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + k.dur);
    end = t + k.dur + 0.0004;
  }
  g.gain.setValueAtTime(0, end);
  src.connect(filter).connect(g);
  route(e, g, wet);
  src.start(t0, Math.random() * 1.5);
  src.stop(end + 0.02);
}

/**
 * One riffle's click times over `dur` seconds: slow at the edges, fastest in the middle
 * (thumbs releasing the halves), with a little jitter so repeats never sound identical.
 */
export function riffleTimes(n: number, dur: number, rand: () => number = Math.random): number[] {
  const A = 0.62;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const u = (k + (k > 0 && k < n - 1 ? (rand() - 0.5) * 0.5 : 0)) / (n - 1);
    out.push(dur * (u + (A * Math.sin(2 * Math.PI * u)) / (2 * Math.PI)));
  }
  return out.sort((a, b) => a - b);
}

/** Major pentatonic ladder for combos: semitones above the base, and how "lit" the step is (0–1). */
export function comboStep(n: number): { semitones: number; level: number } {
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  let k = Math.max(0, Math.floor(n) - 1);
  // Past the 8th step, keep cycling the top three notes at full brightness.
  if (k > 7) k = 5 + ((k - 5) % 3);
  return { semitones: scale[k]!, level: Math.min(1, Math.max(0, Math.floor(n) - 1) / 7) };
}

/** Log and play: `name` is what tests see. */
function play(name: string, make: (e: Engine) => void): void {
  const e = ready();
  if (!e) return;
  if (!offline) {
    played.push(name);
    playedCount[name] = (playedCount[name] ?? 0) + 1;
    if (played.length > 200) played.splice(0, 100);
  }
  make(e);
}

export const sound = {
  /** Pressing a bidding button. */
  tap() {
    play('tap', (e) => {
      const v = vary();
      tone(e, 1800, 0.025, 0.08 * vary(0.03), { type: 'triangle', bend: v });
      snap(e, 0.05, 0, 3500);
    });
  },
  /** A card lifted/raised from the hand: a soft, quick "fwip". */
  pickup() {
    play('pickup', (e) => {
      noise(e, 0.05, 0.12 * vary(0.03), { band: 1200 * vary(), sweepTo: 3200, q: 1.2, shape: 'swell', peak: 0.4, wet: 0.03 });
      tone(e, 1400, 0.02, 0.025, { glideTo: 1900, bend: vary() });
    });
  },
  /** A bid stamped into the auction: heavier and higher as the level rises. */
  stamp(level: number, mine: boolean) {
    play('stamp', (e) => {
      const v = mine ? 1 : 0.6;
      snap(e, 0.12 * v);
      knock(e, 330 + level * 40, (0.32 + level * 0.04) * v, 0, 0.06);
      if (level >= 5) bell(e, level, 0.3, 0.08 * v, 0.03, 0.25, 0.2);
    });
  },
  /** A pass: a soft swish. */
  pass(mine: boolean) {
    play('pass', (e) => noise(e, 0.13, mine ? 0.3 : 0.18, { band: 900, sweepTo: 2400, q: 0.7, shape: 'swell', peak: 0.3, wet: 0.04 }));
  },
  /** "Going once" (1), "going twice" (2). */
  going(n: number) {
    play('going', (e) => {
      knock(e, 700 + n * 180, 0.3, 0, 0.1);
      knock(e, 700 + n * 180, 0.22, 0.09, 0.1);
    });
  },
  /** The auction is won: a gavel and a bright chord. */
  sold() {
    play('sold', (e) => {
      snap(e, 0.2);
      knock(e, 380, 0.6, 0, 0.08);
      [0, 4, 7].forEach((s, i) => bell(e, s, 0.55, 0.08, 0.06 + i * 0.05, 0.25, 0.25));
    });
  },
  /** No contract: four passes, cards gathered up. */
  passedOut() {
    play('passedOut', (e) => noise(e, 0.35, 0.2, { band: 2400, sweepTo: 700, q: 0.6, shape: 'swell', peak: 0.25, wet: 0.08, pan: [0.4, -0.4] }));
  },
  /** A card lands on the table: a "thwip" as it slides, then a crisp "snap" as it lands. */
  card(mine: boolean) {
    play('card', (e) => {
      const v = (mine ? 1 : 0.45) * vary(0.03);
      const b = vary();
      noise(e, 0.035, 0.22 * v, { band: 1800 * b, sweepTo: 4200 * b, q: 1.3, shape: 'swell', peak: 0.7, wet: 0.02 });
      noise(e, 0.03, 0.5 * v, { band: 2700 * b, q: 0.9, delay: 0.03, wet: 0.04 });
      snap(e, 0.18 * v, 0.03, 4000);
      tone(e, 640, 0.05, 0.2 * v, { type: 'triangle', glideTo: 470, delay: 0.03, bend: b, wet: 0.04 });
    });
  },
  /** A card takes the lead of the trick. `n` = how many times the lead has changed (1–3). */
  lead(n: number) {
    play('lead', (e) => {
      snap(e, 0.05, 0.02, 4500);
      bell(e, 2 + n * 3, 0.3, 0.11, 0.02, 0.22, 0.2);
    });
  },
  /** A trump lands on a trick led in another suit: a crack and a brassy hit. */
  trumpIn() {
    play('trumpIn', (e) => {
      noise(e, 0.08, 0.5, { band: 1100, q: 0.7, wet: 0.06 });
      snap(e, 0.2);
      brass(e, 392, 0.22, 0.13, 0.005, 0.12);
      brass(e, 587, 0.18, 0.06, 0.005, 0.12);
      noise(e, 0.3, 0.06, { highpass: 5500, delay: 0.03, wet: 0.3 });
      bell(e, 7, 0.32, 0.08, 0.04, 0.25, 0.2);
    });
  },
  /** The trick is gathered toward its winner. */
  sweep() {
    play('sweep', (e) => whooshBody(e, 0.2, 0.26, 0.05));
  },
  /** The trick sweeping/flying away: a fuller whoosh. */
  whoosh() {
    play('whoosh', (e) => whooshBody(e, 0.32, 0.32, 0.1));
  },
  /** A trick pip lands in the score bar; each one a little higher. */
  pip(step: number) {
    play('pip', (e) => {
      snap(e, 0.04, 0, 4500);
      bell(e, step, 0.2, 0.11 * vary(0.03), 0, 0.18, 0.15, vary(0.008));
    });
  },
  /** A trick won with a trump: a two-note brass call. */
  trumpTrick() {
    play('trumpTrick', (e) => {
      snap(e, 0.12);
      brass(e, 392, 0.16, 0.14, 0, 0.12);
      brass(e, 587, 0.3, 0.14, 0.12, 0.15);
      bell(e, 7, 0.32, 0.06, 0.12, 0.25, 0.2);
    });
  },
  /** The first trick of the deal won with a trump: a rising brass fanfare. */
  firstTrump() {
    play('firstTrump', (e) => {
      snap(e, 0.15);
      [523, 659, 784, 1047].forEach((f, i) => brass(e, f, i === 3 ? 0.4 : 0.2, 0.12, i * 0.07, 0.15));
      noise(e, 0.45, 0.05, { highpass: 6000, delay: 0.2, wet: 0.35 });
      bell(e, 12, 0.5, 0.07, 0.28, 0.3, 0.25);
    });
  },
  /** One side is one trick away. */
  close() {
    play('close', (e) => tone(e, 1568, 0.3, 0.06, { glideTo: 1760, wet: 0.2 }));
  },
  /** Both sides one away: a rising swell. */
  decider() {
    play('decider', (e) => {
      riserBody(e, 0.55, 0.9);
      bell(e, 5, 0.45, 0.05, 0.1, 0.25, 0.2);
    });
  },
  /** A short tension swell of `seconds` (filtered noise + a gliding tone) that ends gently. */
  riser(seconds: number) {
    play('riser', (e) => riserBody(e, Math.min(3, Math.max(0.25, seconds || 0.25))));
  },
  /** The clinch: a big hit, a brass chord and ringing bells, richer with drama (0–3). */
  clinch(drama: number) {
    play('clinch', (e) => {
      const d = Math.min(3, Math.max(0, drama));
      impactBody(e, 1 + d * 0.5);
      [523, 659, 784].forEach((f, i) => brass(e, f, 0.5 + d * 0.1, 0.075 - i * 0.01, 0.02, 0.15));
      const chord = [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, Math.round(d)));
      chord.forEach((s, i) => bell(e, s, 0.8 + d * 0.12, 0.07, 0.04 + i * 0.035, 0.28, 0.25));
      noise(e, 0.5 + d * 0.12, 0.035, { highpass: 6000, delay: 0.08, shape: 'swell', peak: 0.2, wet: 0.4 });
    });
  },
  /** The freeze-frame hit for big moments (power 0–3); plays at the start of a hit-stop. */
  impact(power: number) {
    play('impact', (e) => impactBody(e, power || 0));
  },
  /** Rising-pitch combo layer (n = 1, 2, 3, …): each step up the scale, brighter and louder. */
  combo(n: number) {
    play('combo', (e) => {
      const { semitones, level } = comboStep(n);
      const f = 784 * 2 ** (semitones / 12);
      const gain = 0.07 + 0.045 * level;
      const wet = 0.18 + 0.1 * level;
      snap(e, 0.04 + 0.05 * level, 0, 4000);
      bellHz(e, f, 0.32 + 0.14 * level, gain, 0, wet, 0.2 + 0.3 * level);
      if (n >= 3) bellHz(e, f * 1.5, 0.26 + 0.1 * level, gain * 0.35, 0.01, wet);
      if (n >= 5) tone(e, f * 2, 0.2, gain * 0.3, { delay: 0.035, wet: wet + 0.1, attack: 0.002 });
    });
  },
  /** A card turning over. */
  flip() {
    play('flip', (e) => {
      const b = vary();
      noise(e, 0.05, 0.28 * vary(0.03), { band: 3200 * b, q: 1, wet: 0.03 });
      snap(e, 0.06, 0.025, 4000);
    });
  },
  /** A number ticking up. */
  count(step: number) {
    play('count', (e) => tone(e, 1047 * 2 ** ((step % 12) / 12), 0.05, 0.06 * vary(0.03), { bend: vary(0.008), wet: 0.06 }));
  },
  /** That card can't be played. */
  no() {
    play('no', (e) => {
      tone(e, 420, 0.13, 0.13, { type: 'triangle', glideTo: 330 });
      tone(e, 423, 0.13, 0.05, { type: 'square', glideTo: 333, lowpass: 1500 });
    });
  },
  /** Spotlight passing a name during the captain draw. */
  tick() {
    play('tick', (e) => tone(e, 2093, 0.03, 0.06, { bend: vary(0.01) }));
  },
  /** A small accent (captain chosen). */
  accent() {
    play('accent', (e) => {
      knock(e, 440, 0.35, 0, 0.08);
      bell(e, 4, 0.3, 0.08, 0.02, 0.25, 0.2);
    });
  },
  /** Celebration (end of night, crest complete): a gavel, a brass run and a ringing chord. */
  fanfare() {
    play('fanfare', (e) => {
      snap(e, 0.25);
      knock(e, 380, 0.65, 0, 0.1);
      [523, 659, 784].forEach((f, i) => brass(e, f, 0.18, 0.13, i * 0.08, 0.15));
      [523, 659, 784, 1047].forEach((f, i) => brass(e, f, 0.65, 0.07, 0.3 + i * 0.012, 0.18));
      [0, 4, 7, 12, 16].forEach((s, i) => bell(e, s, 0.45, 0.065, i * 0.075, 0.25, 0.2));
      [0, 4, 7, 12].forEach((s) => bell(e, s, 0.85, 0.05, 0.38, 0.3, 0.3));
      noise(e, 0.7, 0.04, { highpass: 6000, delay: 0.3, shape: 'swell', peak: 0.25, wet: 0.4 });
    });
  },
  /** Broom God (round 15): a heavenly choir chord that swells as the beam comes down (~2.4 s). */
  choir() {
    play('choir', (e) => {
      // Soft "aah" voices: detuned triangles a fifth and octaves apart, slow attack, long tail.
      [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) =>
        [0.996, 1.004].forEach((d) => tone(e, f * d, 2.4, 0.045 - i * 0.004, { type: 'triangle', attack: 0.7, lowpass: 2200, delay: i * 0.06, wet: 0.6 })),
      );
      [0, 7, 12, 19].forEach((s, i) => bell(e, s, 1.6, 0.035, 0.9 + i * 0.12, 0.5, 0.2));
      noise(e, 2.2, 0.025, { highpass: 7000, shape: 'swell', peak: 0.5, wet: 0.6 });
    });
  },
  /** Dog Moorb (round 15): a record scratch as the world flips upside down (~0.5 s). */
  scratch() {
    play('scratch', (e) => {
      noise(e, 0.18, 0.35, { band: 1400, sweepTo: 5200, q: 2.2, shape: 'swell', peak: 0.3 });
      noise(e, 0.22, 0.3, { band: 4800, sweepTo: 900, q: 2.2, delay: 0.17, shape: 'swell', peak: 0.3 });
      tone(e, 520, 0.18, 0.12, { type: 'sawtooth', glideTo: 1500, lowpass: 2800 });
      tone(e, 1400, 0.24, 0.1, { type: 'sawtooth', glideTo: 380, lowpass: 2800, delay: 0.17 });
    });
  },
  /**
   * One riffle shuffle (~0.65 s): a burst of tiny papery clicks that speeds up then slows down,
   * then a soft "bridge" whoosh as the halves square up. Repeated every ~1.6 s while waiting for
   * the dealer, so it is quiet and a little different every time.
   */
  riffle() {
    play('riffle', (e) => {
      const n = 22 + Math.floor(Math.random() * 7);
      const dur = 0.5 * vary(0.06);
      const times = riffleTimes(n, dur);
      const tilt = vary(0.08);
      const list: Tick[] = times.map((at, k) => {
        const u = k / (n - 1);
        // Louder in the thick of it, softer as the last cards fall.
        const swell = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15));
        return { at, gain: 0.42 * swell * vary(0.25), freq: (2600 + 1600 * u) * tilt * vary(0.18), dur: 0.004 + Math.random() * 0.0035 };
      });
      ticks(e, list, 2.4, 0.04);
      // A faint papery bed under the clicks (the halves rubbing).
      noise(e, dur, 0.05, { band: 3200 * tilt, q: 0.8, shape: 'swell', peak: 0.5 });
      // The bridge: cards cascading back together, then squared with a light tap.
      noise(e, 0.16, 0.15, { band: 2400 * tilt, sweepTo: 1000, q: 1, shape: 'swell', peak: 0.55, delay: dur + 0.02, wet: 0.06, pan: [0.25, -0.15] });
      snap(e, 0.05, dur + 0.17, 3800);
    });
  },
  /**
   * One card dealt (`i` of `of`, ~52 in ~1.4 s): a light "thwip" sweeping up, then a tiny click
   * as it lands. Brightens gently through the deal; the last card lands a touch fuller.
   * Six nodes per card (the last one adds a small body).
   */
  dealCard(i: number, of: number) {
    play('dealCard', (e) => {
      const total = Math.max(1, of || 1);
      const p = Math.min(1, Math.max(0, (i || 0) / Math.max(1, total - 1)));
      const last = (i || 0) >= total - 1;
      const lift = 1 + 0.3 * p;
      const b = vary(0.06) * lift;
      const g = (0.1 + 0.03 * p) * vary(0.08);
      noise(e, 0.03, g, { band: 1500 * b, sweepTo: 4400 * b, q: 1.4, shape: 'swell', peak: 0.75 });
      noise(e, 0.012 * vary(0.2), (last ? 0.4 : 0.26) * vary(0.1), { band: 3300 * b * vary(0.08), q: 1.6, delay: 0.026 });
      if (last) {
        tone(e, 560, 0.06, 0.12, { type: 'triangle', glideTo: 430, delay: 0.026, wet: 0.08, bend: vary() });
        noise(e, 0.05, 0.08, { band: 1200, q: 0.9, delay: 0.026, wet: 0.06 });
      }
    });
  },
  /** A hand fanning open: a quick soft ascending paper sweep with a little shimmer in the room. */
  fan() {
    play('fan', (e) => {
      const v = vary(0.05);
      const n = 9;
      const list: Tick[] = Array.from({ length: n }, (_, k) => {
        const u = k / (n - 1);
        return { at: 0.02 + 0.2 * u ** 0.85, gain: (0.16 + 0.08 * u) * vary(0.15), freq: (1900 + 2600 * u) * v * vary(0.05), dur: 0.007 };
      });
      ticks(e, list, 1.8, 0.05);
      noise(e, 0.28, 0.18, { band: 800 * v, sweepTo: 3600 * v, q: 1.2, shape: 'swell', peak: 0.7, wet: 0.06, pan: [-0.35, 0.35] });
      noise(e, 0.3, 0.025, { highpass: 6500, delay: 0.18, shape: 'swell', peak: 0.2, wet: 0.5 });
      bell(e, 12, 0.3, 0.025, 0.22, 0.45, 0.3, v);
    });
  },
  // ── Set won: the winner's element attacks the three losing cards (Ryan, round 8) ──────────
  // Each attack calls these at its own impacts, so sound and picture stay together. Every one
  // keeps its body in the phone band (300 Hz–5 kHz) like the rest.

  /** Fire: sparks sucked into the card, then the "whoomp" as it ignites. */
  fireIgnite() {
    play('fireIgnite', (e) => {
      noise(e, 0.08, 0.16, { band: 700, sweepTo: 2600, q: 1.1, shape: 'swell', peak: 0.95, wet: 0.04 });
      noise(e, 0.2, 0.42, { band: 900, sweepTo: 420, q: 0.8, delay: 0.08, attack: 0.008, wet: 0.08 });
      tone(e, 420, 0.16, 0.2, { type: 'triangle', glideTo: 320, delay: 0.08, attack: 0.004, wet: 0.06 });
      noise(e, 0.12, 0.08, { highpass: 4200, delay: 0.085, wet: 0.1 });
    });
  },
  /** Fire: a fireball lands and the card catches; it crackles as it burns. */
  fireHit() {
    play('fireHit', (e) => {
      const b = vary(0.06);
      noise(e, 0.12, 0.3, { band: 1100 * b, sweepTo: 520, q: 0.9, attack: 0.004, wet: 0.06 });
      tone(e, 520 * b, 0.08, 0.1, { type: 'triangle', glideTo: 400, wet: 0.04 });
      const list: Tick[] = Array.from({ length: 9 }, (_, k) => ({ at: 0.06 + k * 0.034 + Math.random() * 0.02, gain: 0.22 * vary(0.4), freq: 2400 + Math.random() * 2600, dur: 0.004 + Math.random() * 0.004 }));
      ticks(e, list, 2.6, 0.06);
      noise(e, 0.35, 0.05, { band: 1800, q: 0.6, shape: 'swell', peak: 0.3, delay: 0.04, wet: 0.08 });
    });
  },
  /** Air: the wind gathers. */
  airGust() {
    play('airGust', (e) => whooshBody(e, 0.15, 0.3, 0.05));
  },
  /** Air: a card sliced in two, a sharp "shing". */
  airCut() {
    play('airCut', (e) => {
      const b = vary(0.05);
      noise(e, 0.05, 0.2, { band: 2200 * b, sweepTo: 5200, q: 1.4, shape: 'swell', peak: 0.7 });
      snap(e, 0.14, 0.04, 4200);
      tone(e, 3300 * b, 0.13, 0.05, { glideTo: 2500, delay: 0.04, attack: 0.002, wet: 0.12 });
      tone(e, 4700 * b, 0.07, 0.02, { delay: 0.04, attack: 0.001, wet: 0.12 });
    });
  },
  /** Water: the splash crown off the winning card. */
  waterSplash() {
    play('waterSplash', (e) => {
      noise(e, 0.16, 0.34, { band: 1300, sweepTo: 650, q: 0.8, attack: 0.004, wet: 0.08 });
      noise(e, 0.1, 0.1, { highpass: 4000, wet: 0.1 });
      for (let k = 0; k < 4; k++) tone(e, 700 + Math.random() * 300, 0.045, 0.06, { glideTo: 1300 + Math.random() * 400, delay: 0.05 + k * 0.035, attack: 0.002, wet: 0.08 });
    });
  },
  /** Water: a jet fires (one per losing card). */
  waterJet() {
    play('waterJet', (e) => noise(e, 0.09, 0.2, { band: 1400 * vary(0.08), sweepTo: 3800, q: 2, shape: 'swell', peak: 0.6, wet: 0.04, pan: [-0.2, 0.2] }));
  },
  /** Water: the jet punches a hole through the card, a wet "plop". */
  waterHole() {
    play('waterHole', (e) => {
      const b = vary(0.12);
      snap(e, 0.06, 0, 3800);
      tone(e, 820 * b, 0.05, 0.12, { glideTo: 1500 * b, attack: 0.002, wet: 0.08 });
      noise(e, 0.05, 0.08, { band: 2600 * b, q: 1.6, delay: 0.01, wet: 0.06 });
    });
  },
  /** Water: the soaked card drips. */
  waterDrip() {
    play('waterDrip', (e) => {
      for (let k = 0; k < 3; k++) tone(e, 1300 * vary(0.1), 0.035, 0.05, { glideTo: 2100, delay: k * (0.08 + Math.random() * 0.06), attack: 0.002, wet: 0.2 });
    });
  },
  /** Earth: the slam that launches the boulders, and the whistle of them in the air. */
  earthSlam() {
    play('earthSlam', (e) => {
      impactBody(e, 1);
      knock(e, 360, 0.4, 0, 0.08);
      tone(e, 1500, 0.2, 0.025, { glideTo: 900, delay: 0.03, attack: 0.05, wet: 0.08 });
    });
  },
  /** Earth: a boulder smashes through a card: a heavy crunch and gravel. */
  earthHit() {
    play('earthHit', (e) => {
      const b = vary(0.06);
      noise(e, 0.12, 0.5, { band: 820 * b, sweepTo: 480, q: 0.7, attack: 0.002, wet: 0.08 });
      knock(e, 380 * b, 0.42, 0, 0.06);
      snap(e, 0.16, 0, 2600);
      const list: Tick[] = Array.from({ length: 12 }, (_, k) => ({ at: 0.03 + k * 0.014 + Math.random() * 0.01, gain: 0.2 * vary(0.4), freq: 1200 + Math.random() * 2400, dur: 0.005 }));
      ticks(e, list, 1.8, 0.04);
    });
  },
  /** Lightning: the bolt jumps to the next card (`n` = 0, 1, 2), higher each time. */
  boltZap(n: number) {
    play('boltZap', (e) => {
      const k = Math.max(0, Math.min(3, n || 0));
      snap(e, 0.24, 0, 3000);
      noise(e, 0.09, 0.32, { highpass: 2400, attack: 0.001, wet: 0.12 });
      tone(e, 560 * 2 ** (k * 0.25), 0.12, 0.07, { type: 'sawtooth', glideTo: 360, lowpass: 3800, attack: 0.002, wet: 0.08 });
      const list: Tick[] = Array.from({ length: 8 }, (_, i) => ({ at: 0.02 + i * 0.018 + Math.random() * 0.01, gain: 0.18 * vary(0.4), freq: 3000 + Math.random() * 2500, dur: 0.003 }));
      ticks(e, list, 3, 0.08);
    });
  },
  /** Sound: the sonic boom. */
  soundBoom() {
    play('soundBoom', (e) => {
      impactBody(e, 1.5);
      noise(e, 0.3, 0.3, { band: 600, sweepTo: 360, q: 0.9, attack: 0.003, wet: 0.2 });
      tone(e, 430, 0.32, 0.18, { type: 'triangle', glideTo: 310, attack: 0.002, wet: 0.2 });
    });
  },
  /** Sound: a card crumpled like paper. */
  crumple() {
    play('crumple', (e) => {
      const n = 16;
      const list: Tick[] = Array.from({ length: n }, (_, k) => ({ at: (k / n) * 0.26 + Math.random() * 0.012, gain: 0.26 * vary(0.45), freq: 1900 + Math.random() * 2800, dur: 0.004 + Math.random() * 0.005 }));
      ticks(e, list, 1.6, 0.03);
      noise(e, 0.28, 0.1, { band: 2600, q: 0.8, shape: 'swell', peak: 0.35, wet: 0.03 });
    });
  },
  /** Ice: the shards fly, a thin cold whistle. */
  iceWhistle() {
    play('iceWhistle', (e) => {
      noise(e, 0.13, 0.1, { band: 2800, sweepTo: 5200, q: 3, shape: 'swell', peak: 0.8, wet: 0.1 });
      tone(e, 2600, 0.13, 0.03, { glideTo: 3500, attack: 0.06, wet: 0.15 });
    });
  },
  /** Ice: a shard sticks fast, a glassy "tink" (`n` steps the pitch about). */
  iceTink(n: number) {
    play('iceTink', (e) => {
      const f = [2637, 3136, 2794, 3520, 2960][Math.abs(Math.round(n || 0)) % 5]! * vary(0.01);
      snap(e, 0.1, 0, 4500);
      tone(e, f, 0.16, 0.06, { attack: 0.001, wet: 0.25 });
      tone(e, f * 2.76, 0.06, 0.015, { attack: 0.001, wet: 0.25 });
    });
  },
  /** Ice: frost creeping over a card, a fine crackle. */
  iceFrost() {
    play('iceFrost', (e) => {
      const list: Tick[] = Array.from({ length: 14 }, (_, k) => ({ at: k * 0.016 + Math.random() * 0.008, gain: 0.08 * vary(0.4), freq: 4200 + Math.random() * 1600, dur: 0.003 }));
      ticks(e, list, 3, 0.2);
    });
  },
  /** Metal: the blades spinning out, a fast whirr. */
  bladeWhirr() {
    play('bladeWhirr', (e) => {
      const list: Tick[] = Array.from({ length: 11 }, (_, k) => ({ at: k * 0.016, gain: 0.12 + k * 0.012, freq: 2200 + k * 120, dur: 0.008 }));
      ticks(e, list, 2.2, 0.05);
      noise(e, 0.18, 0.08, { band: 1800, sweepTo: 3200, q: 1.4, shape: 'swell', peak: 0.7, wet: 0.05, pan: [-0.3, 0.3] });
    });
  },
  /** Metal: a blade slashes a card. */
  bladeSlash() {
    play('bladeSlash', (e) => {
      const b = vary(0.05);
      noise(e, 0.06, 0.24, { highpass: 3400, attack: 0.002, wet: 0.06 });
      snap(e, 0.14, 0, 4000);
      tone(e, 2500 * b, 0.09, 0.05, { glideTo: 1900, attack: 0.001, wet: 0.1 });
    });
  },
  /** Metal: the last blade sticks in with a "thunk" and a ringing twang. */
  bladeStick() {
    play('bladeStick', (e) => {
      knock(e, 520, 0.4, 0, 0.06);
      snap(e, 0.12, 0, 3500);
      tone(e, 1480, 0.28, 0.05, { attack: 0.001, wet: 0.2, glideTo: 1440 });
      tone(e, 2310, 0.16, 0.025, { attack: 0.001, wet: 0.2 });
    });
  },
  // ── The game-winning set: the power-up and each element's finisher (Ryan, round 8) ─────────
  // The finale itself is clinch() (today's chord), so these lead into it and don't fight it.

  /** The winning card charging up gold as the attack starts: a quick bright rise. */
  powerUp() {
    play('powerUp', (e) => {
      noise(e, 0.16, 0.12, { band: 900, sweepTo: 4200, q: 1.4, shape: 'swell', peak: 0.95, wet: 0.15 });
      tone(e, 784, 0.16, 0.05, { glideTo: 1568, attack: 0.12, wet: 0.2 });
      bell(e, 12, 0.25, 0.04, 0.14, 0.3, 0.3);
    });
  },
  /** Fire: the char flares and crumbles to ash: a roar of flame, then a dry crackling hiss. */
  fireCrumble() {
    play('fireCrumble', (e) => {
      noise(e, 0.3, 0.32, { band: 700, sweepTo: 1800, q: 0.8, shape: 'swell', peak: 0.3, wet: 0.1 });
      const list: Tick[] = Array.from({ length: 18 }, (_, k) => ({ at: 0.05 + k * 0.022 + Math.random() * 0.012, gain: 0.2 * vary(0.45), freq: 2200 + Math.random() * 3000, dur: 0.004 + Math.random() * 0.004 }));
      ticks(e, list, 2.4, 0.08);
      noise(e, 0.45, 0.07, { highpass: 4500, delay: 0.1, shape: 'swell', peak: 0.3, wet: 0.2, pan: [-0.3, 0.4] });
    });
  },
  /** Air: the last gust that blasts the halves away. */
  airBlast() {
    play('airBlast', (e) => {
      whooshBody(e, 0.4, 0.42, 0.12);
      noise(e, 0.3, 0.1, { band: 3000, sweepTo: 5500, q: 2.5, shape: 'swell', peak: 0.4, delay: 0.05, wet: 0.15, pan: [0.4, -0.4] });
    });
  },
  /** Water: the wave rolling out and washing the cards away. */
  waterWash() {
    play('waterWash', (e) => {
      noise(e, 0.45, 0.36, { band: 600, sweepTo: 1600, q: 0.7, shape: 'swell', peak: 0.45, wet: 0.15, pan: [-0.3, 0.3] });
      noise(e, 0.35, 0.12, { highpass: 3500, delay: 0.12, shape: 'swell', peak: 0.3, wet: 0.2 });
      for (let k = 0; k < 5; k++) tone(e, 650 + Math.random() * 400, 0.05, 0.05, { glideTo: 1400 + Math.random() * 500, delay: 0.18 + k * 0.04, attack: 0.002, wet: 0.12 });
    });
  },
  /** Earth: the holed cards cracking apart and the chunks clattering down. */
  earthCrumble() {
    play('earthCrumble', (e) => {
      snap(e, 0.22, 0, 2400);
      noise(e, 0.1, 0.42, { band: 900, sweepTo: 500, q: 0.8, attack: 0.002, wet: 0.08 });
      knock(e, 420, 0.32, 0.02, 0.08);
      const list: Tick[] = Array.from({ length: 22 }, (_, k) => ({ at: 0.06 + k * 0.018 + Math.random() * 0.012, gain: 0.22 * vary(0.45) * (1 - k / 30), freq: 900 + Math.random() * 2400, dur: 0.006 }));
      ticks(e, list, 1.6, 0.06);
    });
  },
  /** Lightning: the last strike from the sky, a big thunder crack, then the cards sizzle away. */
  boltStrike() {
    play('boltStrike', (e) => {
      snap(e, 0.3, 0, 2600);
      noise(e, 0.14, 0.45, { highpass: 1800, attack: 0.001, wet: 0.2 });
      impactBody(e, 1.5);
      tone(e, 520, 0.18, 0.08, { type: 'sawtooth', glideTo: 300, lowpass: 3500, attack: 0.002, wet: 0.15 });
      const list: Tick[] = Array.from({ length: 16 }, (_, k) => ({ at: 0.08 + k * 0.022 + Math.random() * 0.01, gain: 0.14 * vary(0.4) * (1 - k / 20), freq: 3200 + Math.random() * 2400, dur: 0.003 }));
      ticks(e, list, 3, 0.12);
    });
  },
  /** Sound: the second, bigger boom that blows the crumpled cards off, paper fluttering. */
  boomBlast() {
    play('boomBlast', (e) => {
      impactBody(e, 2.2);
      noise(e, 0.4, 0.34, { band: 560, sweepTo: 340, q: 0.9, attack: 0.003, wet: 0.25 });
      tone(e, 420, 0.4, 0.2, { type: 'triangle', glideTo: 300, attack: 0.002, wet: 0.25 });
      const list: Tick[] = Array.from({ length: 12 }, (_, k) => ({ at: 0.12 + k * 0.03 + Math.random() * 0.015, gain: 0.12 * vary(0.4), freq: 2000 + Math.random() * 2500, dur: 0.006 }));
      ticks(e, list, 1.6, 0.05);
    });
  },
  /** Ice: the frozen cards shattering like glass. */
  iceShatter() {
    play('iceShatter', (e) => {
      snap(e, 0.26, 0, 4000);
      noise(e, 0.12, 0.3, { highpass: 3000, attack: 0.001, wet: 0.2 });
      for (let k = 0; k < 7; k++) tone(e, 2400 + Math.random() * 1800, 0.12 + Math.random() * 0.1, 0.035, { delay: k * 0.022 + Math.random() * 0.02, attack: 0.001, wet: 0.3 });
      const list: Tick[] = Array.from({ length: 14 }, (_, k) => ({ at: 0.04 + k * 0.02 + Math.random() * 0.01, gain: 0.14 * vary(0.4), freq: 3600 + Math.random() * 2000, dur: 0.003 }));
      ticks(e, list, 3, 0.15);
    });
  },
  /** Metal: the blades whirl back and shred the cards into strips. */
  metalShred() {
    play('metalShred', (e) => {
      for (let k = 0; k < 4; k++) {
        noise(e, 0.05, 0.2, { highpass: 3400, delay: k * 0.045, attack: 0.002, wet: 0.06 });
        tone(e, 2600 - k * 150, 0.07, 0.04, { glideTo: 1900 - k * 120, delay: k * 0.045, attack: 0.001, wet: 0.1 });
      }
      knock(e, 560, 0.24, 0.2, 0.08);
      tone(e, 1480, 0.3, 0.04, { delay: 0.2, attack: 0.001, wet: 0.25, glideTo: 1430 });
    });
  },
  /** The Deal button: the deck slapped on the table, a "thock" with a crisp snap on top. */
  dealButton() {
    play('dealButton', (e) => {
      snap(e, 0.16, 0, 3200);
      noise(e, 0.06, 0.32, { band: 1300, sweepTo: 800, q: 0.8, wet: 0.05 });
      knock(e, 420, 0.42, 0.002, 0.08);
      tone(e, 900, 0.04, 0.05, { type: 'triangle', glideTo: 760, delay: 0.002, wet: 0.05 });
    });
  },
};

export type SoundName = keyof typeof sound;

/**
 * Test hook: render one sound (at full volume, current theme) into an OfflineAudioContext through
 * the same chain, and return its stereo samples. Not used by the app.
 */
export async function __renderForTest(name: string, args: unknown[], seconds: number, sampleRate = 48000): Promise<Float32Array[]> {
  // The limiter needs a moment of silence to settle (as it has in the live context), so the
  // sound starts OFFLINE_LEAD seconds in and that lead-in is cut from the result.
  const lead = Math.round(OFFLINE_LEAD * sampleRate);
  const c = new OfflineAudioContext(2, lead + Math.ceil(seconds * sampleRate), sampleRate);
  offline = { engine: buildEngine(c), volume: 1 };
  try {
    (sound as unknown as Record<string, (...a: unknown[]) => void>)[name]!(...args);
  } finally {
    offline = null;
  }
  const out = await c.startRendering();
  return [out.getChannelData(0).slice(lead), out.getChannelData(1).slice(lead)];
}

/**
 * Test hook: render a timed sequence of sounds (`[name, args, startSeconds]`) into one
 * OfflineAudioContext through the same chain, so overlaps hit the limiter as they would live.
 */
export async function __renderSequenceForTest(steps: [string, unknown[], number][], seconds: number, sampleRate = 48000): Promise<Float32Array[]> {
  const lead = Math.round(OFFLINE_LEAD * sampleRate);
  const c = new OfflineAudioContext(2, lead + Math.ceil(seconds * sampleRate), sampleRate);
  const engine = buildEngine(c);
  try {
    for (const [name, args, at] of steps) {
      offline = { engine, volume: 1, at };
      (sound as unknown as Record<string, (...a: unknown[]) => void>)[name]!(...args);
    }
  } finally {
    offline = null;
  }
  const out = await c.startRendering();
  return [out.getChannelData(0).slice(lead), out.getChannelData(1).slice(lead)];
}
