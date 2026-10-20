import { settings } from './settings.svelte';
import { PARTICLE_BUDGET } from './timing';
import { drawGlow, hotter, toRgb, type GlowKind } from './glow';

// Spec S16: a small canvas overlay for effects. Runs only while something is alive.
// One vocabulary of shapes, each kept for its own kind of moment so nothing gets samey:
//   sparks (takes the lead) · ring (trump-in shockwave) · glyphs (trump suits) · puff (Sold!)
//   ribbons (confetti: winning the night only) · element signatures (S24: the clinch)
// The most frequent moment (trick won) deliberately uses no particles at all.
//
// Light vs matter: light (sparks, embers, rings, bolts, flashes, comets) is drawn with
// additive 'lighter' blending and cached glow sprites (never per-particle shadowBlur, which
// is slow on phones). Matter (earth debris, dust puffs, paper confetti, suit glyphs) stays
// normal blending so it reads as stuff, not glow.

type Shape = 'square' | 'streak' | 'ring' | 'glyph' | 'puff' | 'ribbon' | 'dot' | 'flash' | 'bolt' | 'arc' | 'shard';

interface Particle {
  shape: Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Per-frame velocity changes. */
  gravity: number;
  drag: number;
  life: number;
  max: number;
  /** Frames to wait before appearing. */
  delay: number;
  size: number;
  /** Size change per frame (rings, puffs). */
  grow: number;
  color: string;
  alpha: number;
  rot: number;
  vrot: number;
  text?: string;
  /** Sideways flutter (ribbons) or flicker (embers), 0 for none. */
  wobble: number;
  /** Orbit around a centre (air swirl, tornado). `rise` moves the centre up; `squash` flattens it. */
  orbit?: { cx: number; cy: number; angle: number; radius: number; spin: number; spread: number; rise?: number; squash?: number };
  /** A lightning bolt's path. */
  points?: { x: number; y: number }[];
  /** An arc's span in radians (sound waves, a wave crest). */
  span?: [number, number];
  /** Drawn as additive light (true) or as matter (false). Defaults by shape. */
  light: boolean;
  /** Flash sprite style: 'soft' bloom (default) or 'hot' white core. */
  glow?: GlowKind;
  /** How many past positions to keep for a trail (0 = none). */
  trailLen: number;
  /** Past positions, flat [x0, y0, x1, y1, ...], oldest first. */
  trail?: number[];
  /** The colour pushed toward white, for the bright core of lines. */
  hot: string;
}

/** A glowing orb travelling along a curve (a won trick heading to its score bar). */
interface Comet {
  from: { x: number; y: number };
  to: { x: number; y: number };
  start: number;
  duration: number;
  color: string;
  hot: string;
  trail: { x: number; y: number }[];
  onArrive: () => void;
}

/** A full-canvas wash of light (big hits). */
interface Wash {
  /** "r,g,b" of the colour pushed toward white. */
  rgb: string;
  strength: number;
  frames: number;
  life: number;
  /** Where the light comes from (the hit), in px; the screen's centre if not given. */
  at: { x: number; y: number } | null;
}

export type Element = 'fire' | 'air' | 'water' | 'earth';

const LIGHT_SHAPES: ReadonlySet<Shape> = new Set<Shape>(['streak', 'ring', 'flash', 'bolt', 'arc', 'dot']);
const COMET_TRAIL = 18;
const MAX_WASH = 0.5;

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let comets: Comet[] = [];
let wash: Wash | null = null;
let running = false;
let frame = 0;
let dpr = 1;
/** Hit-stop: nothing advances until this time (performance.now() ms). */
let frozenUntil = 0;
let lastNow = 0;
/**
 * Frame-time governor: a smoothed frame time, and `lite` when the device is falling behind.
 * Lite keeps every effect's shape, timing and the big blooms/rings/bolts, but drops the
 * per-particle glow sprites (the costliest part on a slow phone) back to plain additive dots.
 */
let frameEma = 16.7;
let lite = false;

/** The layer the screen wash is drawn on (screen-blended, so it only ever brightens). */
let washEl: HTMLElement | null = null;

export function attachParticleCanvas(el: HTMLCanvasElement, washLayer?: HTMLElement): () => void {
  canvas = el;
  washEl = washLayer ?? null;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    el.width = innerWidth * dpr;
    el.height = innerHeight * dpr;
    el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  return () => {
    removeEventListener('resize', resize);
    (washEl ?? el).style.background = '';
    canvas = null;
    washEl = null;
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length]!;

type Spec = Partial<Omit<Particle, 'light' | 'trailLen' | 'hot'>> & { light?: boolean; trailLen?: number };

function add(list: Spec[]): void {
  if (!canvas || !settings.motion) return;
  const room = Math.max(0, PARTICLE_BUDGET - particles.length);
  for (const p of list.slice(0, room)) {
    const max = p.max ?? 40;
    const shape = p.shape ?? 'square';
    const color = p.color ?? '#fff';
    const light = p.light ?? LIGHT_SHAPES.has(shape);
    // Fast light leaves a short trail; orbiting streaks curve so keep theirs shorter.
    const trailLen = p.trailLen ?? (shape === 'streak' ? (p.orbit ? 4 : 5) : shape === 'dot' && light ? 3 : 0);
    particles.push({
      shape,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      delay: 0,
      size: 3,
      grow: 0,
      alpha: 1,
      rot: 0,
      vrot: 0,
      wobble: 0,
      ...p,
      color,
      light,
      trailLen,
      hot: hotter(color, 0.55),
      life: max,
      max,
    });
  }
  start();
}

/** The original square burst (kept for small accents, e.g. an orb landing). */
export function burst(x: number, y: number, count: number, colors: readonly string[]): void {
  add(
    Array.from({ length: count }, (_, i) => {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(2, 7);
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, gravity: 0.18, drag: 0.98, max: rand(40, 70), size: rand(2, 5), color: pick(colors, i) };
    }),
  );
}

/** Quick bright streaks shooting outward, no fall: a card taking the lead. */
export function sparks(x: number, y: number, count: number, colors: readonly string[]): void {
  add(
    Array.from({ length: count }, (_, i) => {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(4, 8);
      return { shape: 'streak' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.88, max: rand(14, 22), size: 2, color: pick(colors, i) };
    }),
  );
}

function ringFx(x: number, y: number, color: string, opts: { radius?: number; width?: number; delay?: number; frames?: number; light?: boolean }): void {
  const frames = opts.frames ?? 24;
  add([{ shape: 'ring', x, y, size: 8, grow: ((opts.radius ?? 70) - 8) / frames, max: frames, delay: opts.delay ?? 0, color, wobble: opts.width ?? 3, light: opts.light }]);
}

/** An expanding shockwave ring. */
export function ring(x: number, y: number, color: string, opts: { radius?: number; width?: number; delay?: number; frames?: number } = {}): void {
  ringFx(x, y, color, opts);
}

/** Suit symbols: drifting up (`rise`) or thrown out and falling (`shower`). */
export function glyphs(x: number, y: number, count: number, symbol: string, colors: readonly string[], mode: 'rise' | 'shower' = 'rise'): void {
  add(
    Array.from({ length: count }, (_, i) => {
      if (mode === 'rise') {
        return { shape: 'glyph' as Shape, text: symbol, x: x + rand(-30, 30), y: y + rand(-10, 10), vx: rand(-0.4, 0.4), vy: rand(-2.6, -1.2), gravity: 0.015, drag: 0.99, max: rand(45, 70), delay: i * 2, size: rand(12, 20), color: pick(colors, i), wobble: 0.6 };
      }
      const angle = rand(-Math.PI, 0);
      const speed = rand(3, 7);
      return { shape: 'glyph' as Shape, text: symbol, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, gravity: 0.2, drag: 0.985, max: rand(50, 75), size: rand(12, 22), color: pick(colors, i), vrot: rand(-0.15, 0.15) };
    }),
  );
}

/** Soft dust puffs, like an ink stamp hitting paper: Sold! */
export function puff(x: number, y: number, count: number, color: string): void {
  add(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      return { shape: 'puff' as Shape, x, y, vx: Math.cos(angle) * rand(0.8, 1.8), vy: Math.sin(angle) * rand(0.4, 1), drag: 0.95, max: rand(28, 40), size: rand(5, 9), grow: 0.55, alpha: 0.4, color };
    }),
  );
}

/** Real paper confetti that flutters and spins. Reserved for winning the night. */
export function ribbons(x: number, y: number, count: number, colors: readonly string[]): void {
  add(
    Array.from({ length: count }, (_, i) => {
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const speed = rand(5, 11);
      return { shape: 'ribbon' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.13, drag: 0.975, max: rand(110, 160), size: rand(5, 8), color: pick(colors, i), rot: rand(0, 6), vrot: rand(-0.25, 0.25), wobble: rand(0.5, 1.4) };
    }),
  );
}

/** A quick soft glow (e.g. under the card that won the trick). */
export function flash(x: number, y: number, color: string, radius = 50): void {
  add([{ shape: 'flash', x, y, size: radius, max: 16, alpha: 0.4, color }]);
}

/**
 * A wash of light bursting from the hit (`at`) and fading out over `frames`: for big hits.
 * `strength` 0–1 (capped at 0.5 alpha). A new wash replaces a weaker one. It fades to
 * nothing toward the screen's edges, so it lights the table up instead of greying it out.
 */
export function screenFlash(color: string, strength = 0.35, frames = 10, at?: { x: number; y: number }): void {
  if (!canvas || !settings.motion) return;
  const s = Math.max(0, Math.min(MAX_WASH, strength));
  const f = Math.max(1, Math.round(frames));
  if (wash && wash.strength * (wash.life / wash.frames) > s) return;
  wash = { rgb: toRgb(hotter(color, 0.35)).join(','), strength: s, frames: f, life: f, at: at ?? null };
  start();
}

/**
 * The generic "Balatro pop": a white-hot core flash, one shock ring and 14 + power·8
 * glowing sparks with trails flying out with drag. `power` 0–3.
 */
export function lightBurst(x: number, y: number, colors: readonly string[], power = 0): void {
  const pw = Math.max(0, Math.min(3, power));
  const main = colors[0] ?? '#ffffff';
  const core = 30 + pw * 12;
  add([
    { shape: 'flash', x, y, size: core * 1.45, max: 14 + pw * 2, alpha: 0.4, color: main },
    { shape: 'flash', x, y, size: core * 0.85, max: 10 + pw * 2, alpha: 0.95, color: main, glow: 'hot' },
  ]);
  ringFx(x, y, pick(colors, 1), { radius: 58 + pw * 22, width: 3 + pw * 0.6, frames: 18 + pw * 2 });
  const n = 14 + Math.round(pw * 8);
  add(
    Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
      const speed = rand(4.5, 9.5) * (1 + pw * 0.12);
      return { shape: 'streak' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.89, gravity: 0.04, max: rand(18, 28) + pw * 3, size: rand(1.6, 2.6), color: pick(colors, i), trailLen: 6 };
    }),
  );
}

/** A tiny glow pop for score pips and UI: a core flash and six sparks, ~12 frames. */
export function pop(x: number, y: number, color: string): void {
  add([{ shape: 'flash', x, y, size: 18, max: 12, alpha: 0.9, color, glow: 'hot' }]);
  add(
    Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(2.5, 4.5);
      return { shape: 'streak' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.86, max: rand(10, 14), size: 1.5, color, trailLen: 4 };
    }),
  );
}

/** Hit-stop: particles and comets hold still (still drawn) for `ms`. Overlapping calls take the max. */
export function freeze(ms: number): void {
  if (!(ms > 0)) return;
  frozenUntil = Math.max(frozenUntil, performance.now() + ms);
}

export const ELEMENT_COLORS: Record<Element, string[]> = {
  fire: ['#ffb347', '#ff7a2f', '#e8402a', '#ffd27a'],
  air: ['#fff6cf', '#f4e7a1', '#fffdf2', '#e9dcb0'],
  water: ['#5fd6d0', '#2fa7d6', '#1b6fb8', '#bff0ff'],
  earth: ['#8a9a4b', '#7a5a36', '#a37b4c', '#5b6e33'],
};

/**
 * The four signature effects (S24): same timing and the same overall size for each element
 * (principle 4); only the look changes. `power` 0–3 adds a little more for dramatic clinches.
 */
export function elementBurst(element: Element, x: number, y: number, power = 0): void {
  const c = ELEMENT_COLORS[element];
  const n = 46 + power * 12;
  switch (element) {
    case 'fire':
      flash(x, y, '#ff8a3a', 95);
      add([{ shape: 'flash', x, y, size: 34, max: 12, alpha: 0.8, color: '#ffb347', glow: 'hot' }]);
      ring(x, y, '#ff7a2f', { radius: 90, width: 4, frames: 22 });
      add(
        Array.from({ length: n }, (_, i) => ({
          shape: 'dot' as Shape,
          x: x + rand(-34, 34),
          y: y + rand(-14, 18),
          vx: rand(-1.4, 1.4),
          vy: rand(-5.5, -2),
          gravity: -0.035,
          drag: 0.985,
          max: rand(55, 90),
          delay: rand(0, 14),
          size: rand(2.5, 5.5),
          color: pick(c, i),
          wobble: 1,
          // A trail on every third ember: enough to read as motion, a third of the cost.
          trailLen: i % 3 === 0 ? 3 : 0,
        })),
      );
      break;
    case 'air':
      ring(x, y, c[0]!, { radius: 80, width: 2 });
      ring(x, y, c[2]!, { radius: 110, width: 1.5, delay: 6 });
      add(
        Array.from({ length: n }, (_, i) => ({
          shape: 'streak' as Shape,
          x,
          y,
          max: rand(50, 75),
          size: 2.5,
          color: pick(c, i),
          orbit: { cx: x, cy: y, angle: (i / n) * Math.PI * 2, radius: rand(6, 24), spin: rand(0.12, 0.2), spread: rand(1.5, 2.4) },
        })),
      );
      break;
    case 'water':
      flash(x, y, '#5fd6d0', 70);
      for (let k = 0; k < 4; k++) ring(x, y, pick(c, k), { radius: 70 + k * 35, width: 4 - k * 0.8, delay: k * 7, frames: 34 });
      add(
        Array.from({ length: Math.round(n * 0.7) }, (_, i) => {
          const angle = rand(-Math.PI * 0.9, -Math.PI * 0.1);
          const speed = rand(3.5, 7.5);
          // Droplets are matter with a light rim.
          return { shape: 'dot' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.24, drag: 0.99, max: rand(45, 65), size: rand(2.5, 4.5), color: pick(c, i), light: false };
        }),
      );
      break;
    case 'earth':
      add([
        ...Array.from({ length: 14 }, (_, i) => ({
          shape: 'puff' as Shape,
          x: x + rand(-24, 24),
          y: y + rand(6, 18),
          vx: (i % 2 ? 1 : -1) * rand(1.2, 3.4),
          vy: rand(-0.7, 0),
          drag: 0.94,
          max: rand(45, 65),
          size: rand(7, 12),
          grow: 0.6,
          alpha: 0.45,
          color: pick(c, i + 1),
        })),
        ...Array.from({ length: Math.round(n * 0.7) }, (_, i) => {
          const angle = rand(-Math.PI * 0.9, -Math.PI * 0.1);
          const speed = rand(3, 7);
          return { shape: 'square' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.35, drag: 0.98, max: rand(45, 65), size: rand(3, 6.5), color: pick(c, i), vrot: rand(-0.3, 0.3) };
        }),
      ]);
      break;
  }
}

/** A jagged path from (x0, y0) to (x1, y1). */
function zigzag(x0: number, y0: number, x1: number, y1: number, segments: number, jitter: number) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const j = i === 0 || i === segments ? 0 : rand(-jitter, jitter);
    return { x: x0 + (x1 - x0) * t + j, y: y0 + (y1 - y0) * t };
  });
}

const SUB_COLORS = {
  lightning: ['#fff7b0', '#ffe14d', '#ffb347'],
  sound: ['#fff6cf', '#f4e7a1', '#ffffff'],
  ice: ['#e8fbff', '#a8e6ff', '#6cc7f0'],
  metal: ['#f2f4f7', '#c3c9d2', '#8a929e', '#ffcf8a'],
};

/**
 * Winning a set (S16 + S24): the winner's element, small. Fire: a fireball. Air: a tornado.
 * Water: a tsunami crest. Earth: a rock smash. Same timing and size for all four.
 */
export function elementWin(element: Element, x: number, y: number): void {
  const c = ELEMENT_COLORS[element];
  switch (element) {
    case 'fire':
      flash(x, y, '#ff8a3a', 55);
      // The fireball itself: light, not smoke.
      add([{ shape: 'puff', x, y, size: 12, grow: 1.6, max: 16, alpha: 0.9, color: '#ffb347', light: true }]);
      add(
        Array.from({ length: 22 }, (_, i) => {
          const a = rand(0, Math.PI * 2);
          const v = rand(1.5, 4);
          return { shape: 'dot' as Shape, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, gravity: -0.06, drag: 0.95, max: rand(30, 48), size: rand(2, 4), color: pick(c, i), wobble: 1 };
        }),
      );
      break;
    case 'air':
      add(
        Array.from({ length: 40 }, (_, i) => ({
          shape: 'streak' as Shape,
          x,
          y,
          max: rand(48, 62),
          delay: (i % 8) * 2,
          size: 2.5,
          color: pick(c, i),
          // A funnel: tight at the bottom, widening as it climbs.
          orbit: { cx: x, cy: y + 30, angle: (i / 40) * Math.PI * 2, radius: 2 + (i % 8) * 1.5, spin: 0.34, spread: 0.7, rise: -2.1, squash: 0.3 },
        })),
      );
      break;
    case 'water':
      for (let k = 0; k < 3; k++) {
        add([{ shape: 'arc', x, y: y + 34, size: 12, grow: 2.4, max: 26, delay: k * 5, color: pick(c, k), wobble: 4 - k, span: [-Math.PI * 0.9, -Math.PI * 0.1] }]);
      }
      add(
        Array.from({ length: 16 }, (_, i) => {
          const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
          const v = rand(3, 6);
          return { shape: 'dot' as Shape, x, y: y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.25, max: rand(30, 45), delay: 6, size: rand(2, 3.5), color: pick(c, i), light: false };
        }),
      );
      break;
    case 'earth':
      ringFx(x, y + 12, c[1]!, { radius: 46, width: 3, frames: 18, light: false });
      add([
        ...Array.from({ length: 14 }, (_, i) => {
          const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
          const v = rand(3, 6.5);
          return { shape: 'square' as Shape, x, y: y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.42, drag: 0.98, max: rand(30, 45), size: rand(4, 7), color: pick(c, i), vrot: rand(-0.3, 0.3) };
        }),
        ...Array.from({ length: 6 }, (_, i) => ({
          shape: 'puff' as Shape,
          x: x + rand(-18, 18),
          y: y + 16,
          vx: (i % 2 ? 1 : -1) * rand(1, 2.5),
          drag: 0.93,
          max: rand(30, 40),
          size: rand(5, 8),
          grow: 0.5,
          alpha: 0.4,
          color: c[1]!,
        })),
      ]);
      break;
  }
}

/**
 * Winning a set by trumping a different suit: the element's sub-element, sharper.
 * Fire: lightning. Air: sound. Water: ice. Earth: metal. `power` (0–2) for the first trump.
 */
export function elementStrike(element: Element, x: number, y: number, power = 0): void {
  switch (element) {
    case 'fire': {
      const col = SUB_COLORS.lightning;
      const top = y - 150 - power * 20;
      // Two strikes, the second a beat later, then the afterglow.
      add([{ shape: 'bolt', x, y, max: 22, size: 3.5, color: col[1]!, points: zigzag(x + rand(-30, 30), top, x, y, 8, 14) }]);
      add([{ shape: 'bolt', x, y, max: 16, delay: 6, size: 2.5, color: col[0]!, points: zigzag(x + rand(-30, 30), top + 20, x, y, 7, 16) }]);
      add([{ shape: 'bolt', x, y, max: 12, delay: 3, size: 1.5, color: col[0]!, points: zigzag(x + rand(-20, 20), top + 40, x + rand(-40, 40), y - 40, 5, 10) }]);
      flash(x, y, '#fff3b0', 60 + power * 15);
      sparks(x, y, 14 + power * 6, col);
      break;
    }
    case 'air':
      for (let k = 0; k < 3 + power; k++) {
        for (const side of [0, Math.PI]) {
          add([{ shape: 'arc', x, y, size: 14, grow: 2.6, max: 24, delay: k * 5, color: pick(SUB_COLORS.sound, k), wobble: 3, span: [side - 0.55, side + 0.55] }]);
        }
      }
      ring(x, y, SUB_COLORS.sound[0]!, { radius: 30, width: 2, frames: 12 });
      break;
    case 'water': {
      const n = 14 + power * 6;
      flash(x, y, '#bfefff', 44);
      ring(x, y, '#e8fbff', { radius: 64, width: 1.5, frames: 22 });
      add(
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          const v = rand(3.5, 5.5);
          return { shape: 'shard' as Shape, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.82, max: rand(38, 50), size: rand(4, 7), color: pick(SUB_COLORS.ice, i), rot: a + Math.PI / 2 };
        }),
      );
      break;
    }
    case 'earth': {
      ring(x, y, '#ffffff', { radius: 52, width: 3, frames: 14 });
      ring(x, y, SUB_COLORS.metal[1]!, { radius: 86, width: 2, delay: 3, frames: 18 });
      sparks(x, y, 22 + power * 8, SUB_COLORS.metal);
      add(
        Array.from({ length: 6 }, (_, i) => {
          const a = rand(-Math.PI, 0);
          const v = rand(3, 5);
          return { shape: 'shard' as Shape, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.3, max: rand(30, 40), size: rand(3, 5), color: pick(SUB_COLORS.metal, i + 1), rot: a + Math.PI / 2, vrot: rand(-0.2, 0.2) };
        }),
      );
      break;
    }
  }
}

/**
 * Send an orb from one screen point to another; `onArrive` runs when it lands (or at once
 * when motion effects are off, so the score still updates).
 */
export function comet(from: { x: number; y: number }, to: { x: number; y: number }, duration: number, color: string, onArrive: () => void): void {
  if (!canvas || !settings.motion) return onArrive();
  comets.push({ from, to, start: performance.now(), duration, color, hot: hotter(color, 0.5), trail: [], onArrive });
  start();
}

function start(): void {
  if (!running) {
    running = true;
    lastNow = performance.now();
    frameEma = 16.7;
    requestAnimationFrame(step);
  }
}

/** Comets are pure light: call with 'lighter' set. */
function drawComets(c: CanvasRenderingContext2D, now: number, frozen: boolean): void {
  const arrived: Comet[] = [];
  for (const k of comets) {
    const t = Math.min(1, (now - k.start) / k.duration);
    const e = t * t * (3 - 2 * t);
    // Arc upward a little on the way, like a thrown chip.
    const lift = Math.min(80, Math.abs(k.to.x - k.from.x) * 0.3 + 30);
    const x = k.from.x + (k.to.x - k.from.x) * e;
    const y = k.from.y + (k.to.y - k.from.y) * e - Math.sin(Math.PI * e) * lift;
    if (!frozen || k.trail.length === 0) {
      k.trail.push({ x, y });
      if (k.trail.length > COMET_TRAIL) k.trail.shift();
    }
    // A tapering luminous tail: a wide soft pass and a bright core, thickening toward the head.
    const n = k.trail.length;
    // Butt caps: round caps overlap at every joint and additive blending turns them into beads.
    c.lineCap = 'butt';
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1);
      const a = k.trail[i - 1]!;
      const b = k.trail[i]!;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.strokeStyle = k.color;
      c.globalAlpha = f * f * 0.35;
      c.lineWidth = 2 + f * 9;
      c.stroke();
      c.strokeStyle = k.hot;
      c.globalAlpha = f * 0.9;
      c.lineWidth = 0.8 + f * 2.6;
      c.stroke();
    }
    for (const q of k.trail) mark(q.x, q.y, 8);
    mark(x, y, 32);
    c.globalAlpha = 0.45;
    drawGlow(c, 'soft', k.color, x, y, 30, dpr);
    c.globalAlpha = 1;
    drawGlow(c, 'hot', k.color, x, y, 13, dpr);
    if (t >= 1) arrived.push(k);
  }
  if (arrived.length) {
    comets = comets.filter((k) => !arrived.includes(k));
    for (const k of arrived) {
      ring(k.to.x, k.to.y, k.color, { radius: 16, width: 2, frames: 14 });
      pop(k.to.x, k.to.y, k.color);
      k.onArrive();
    }
  }
}

/**
 * The wash is the canvas element's own background colour, not a full-canvas fill: filling
 * every pixel each frame is the single most expensive thing a phone canvas can do, while a
 * background colour is free for the compositor. Light drawn this frame still sits on top.
 */
function drawWash(el: HTMLElement, w: Wash | null): void {
  if (!w) {
    if (el.style.background) el.style.background = '';
    return;
  }
  const f = w.life / w.frames;
  const a = Math.min(MAX_WASH, w.strength * Math.pow(f, 1.5));
  const x = w.at ? `${Math.round(w.at.x)}px` : '50%';
  const y = w.at ? `${Math.round(w.at.y)}px` : '45%';
  // The glow spreads out from the hit as it fades.
  const reach = Math.round(38 + (1 - f) * 30);
  el.style.background = `radial-gradient(circle at ${x} ${y}, rgba(${w.rgb},${a.toFixed(3)}), rgba(${w.rgb},${(a * 0.35).toFixed(3)}) ${Math.round(reach * 0.45)}vmax, transparent ${reach}vmax)`;
}

function move(p: Particle): void {
  if (p.orbit) {
    const o = p.orbit;
    const sq = o.squash ?? 1;
    const px = o.cx + Math.cos(o.angle) * o.radius;
    const py = o.cy + Math.sin(o.angle) * o.radius * sq;
    o.angle += o.spin;
    o.radius += o.spread;
    o.cy += o.rise ?? 0;
    p.x = o.cx + Math.cos(o.angle) * o.radius;
    p.y = o.cy + Math.sin(o.angle) * o.radius * sq;
    p.vx = p.x - px;
    p.vy = p.y - py;
  } else {
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx + (p.shape === 'ribbon' || p.shape === 'glyph' ? Math.sin((frame + p.max) * 0.12) * p.wobble : 0);
    p.y += p.vy;
    p.rot += p.vrot;
    p.size = Math.max(0, p.size + p.grow);
  }
  if (p.trailLen) {
    const tr = (p.trail ??= []);
    tr.push(p.x, p.y);
    if (tr.length > p.trailLen * 2) tr.splice(0, 2);
  }
}

/** Add the particle's trail (oldest → current position) to the current path. */
function addTrail(c: CanvasRenderingContext2D, p: Particle, fallback: number): void {
  const tr = p.trail;
  if (tr && tr.length >= 4) {
    c.moveTo(tr[0]!, tr[1]!);
    for (let i = 2; i < tr.length; i += 2) c.lineTo(tr[i]!, tr[i + 1]!);
  } else {
    c.moveTo(p.x - p.vx * fallback, p.y - p.vy * fallback);
    c.lineTo(p.x, p.y);
  }
}

function baseAlpha(p: Particle): number {
  const fade = Math.max(0, p.life / p.max);
  return p.alpha * (p.shape === 'ring' || p.shape === 'flash' ? fade : Math.min(1, fade * 1.6));
}

/** Matter: normal blending. */
function drawMatter(c: CanvasRenderingContext2D, p: Particle): void {
  const a = baseAlpha(p);
  c.globalAlpha = a;
  c.fillStyle = p.color;
  c.strokeStyle = p.color;
  switch (p.shape) {
    case 'square':
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      c.restore();
      break;
    case 'ring': {
      const fade = Math.max(0, p.life / p.max);
      c.lineWidth = p.wobble * fade + 0.5;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case 'glyph':
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.font = `700 ${p.size}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.text ?? '•', 0, 0);
      c.restore();
      break;
    case 'puff':
    case 'flash':
    case 'dot':
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
      break;
    case 'shard':
      // A thin crystal/metal sliver pointing the way it flies.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.beginPath();
      c.moveTo(0, -p.size * 1.8);
      c.lineTo(p.size * 0.45, 0);
      c.lineTo(0, p.size * 0.7);
      c.lineTo(-p.size * 0.45, 0);
      c.closePath();
      c.fill();
      c.restore();
      break;
    case 'ribbon':
      // A paper strip turning over: its width follows the spin.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillRect(-p.size / 2, -p.size, p.size * Math.abs(Math.cos(p.rot * 2)) + 1, p.size * 2);
      c.restore();
      break;
    default:
      break;
  }
}

/**
 * Trail strokes are batched per (colour, alpha step, width step) into one path each: one
 * stroke call instead of one per particle is the biggest saving on a software canvas.
 */
interface StrokeBatch {
  color: string;
  alpha: number;
  width: number;
  list: Particle[];
}
const batches = new Map<string, StrokeBatch>();

function queueStroke(p: Particle, color: string, alpha: number, width: number): void {
  const qa = Math.round(alpha * 10) / 10;
  if (qa <= 0) return;
  const qw = Math.max(0.5, Math.round(width * 2) / 2);
  const key = `${color}|${qa}|${qw}`;
  let b = batches.get(key);
  if (!b) batches.set(key, (b = { color, alpha: qa, width: qw, list: [] }));
  b.list.push(p);
}

function flushStrokes(c: CanvasRenderingContext2D): void {
  if (!batches.size) return;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const b of batches.values()) {
    c.beginPath();
    for (const p of b.list) addTrail(c, p, p.orbit ? 1.2 : p.shape === 'streak' ? 2.5 : 0);
    c.strokeStyle = b.color;
    c.globalAlpha = Math.min(1, b.alpha);
    c.lineWidth = b.width;
    c.stroke();
  }
  batches.clear();
}

/** Light: called with 'lighter' compositing. Also adds highlights to some matter. */
function drawLight(c: CanvasRenderingContext2D, p: Particle): void {
  const a = baseAlpha(p);
  if (a <= 0.01) return;
  const fade = Math.max(0, p.life / p.max);
  if (!p.light) {
    // Highlights on matter: a glint on ice/metal, a light rim on water droplets.
    if (p.shape === 'shard') {
      if (!lite) {
        c.globalAlpha = a * 0.3;
        drawGlow(c, 'soft', p.color, p.x, p.y, p.size * 1.9, dpr);
      }
      const g = Math.sin(p.life * 0.35 + p.max * 7);
      if (g > 0.5) {
        const tipX = p.x + Math.sin(p.rot) * p.size * 1.2;
        const tipY = p.y - Math.cos(p.rot) * p.size * 1.2;
        c.globalAlpha = a * ((g - 0.5) / 0.5);
        drawGlow(c, 'star', '#ffffff', tipX, tipY, p.size * 2.2, dpr);
      }
    } else if (p.shape === 'dot' && !lite) {
      c.globalAlpha = a * 0.55;
      drawGlow(c, 'hot', p.color, p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 1.3, dpr);
    }
    return;
  }
  c.fillStyle = p.color;
  switch (p.shape) {
    case 'streak': {
      // A thin white-hot trail (batched: strokes are the costly part on phones) plus sprites:
      // a hot head and, for free-flying sparks, a soft halo halfway down the trail.
      if (p.orbit) {
        // Air swirls come in dense swarms of near-white: keep each one airy so the swarm adds
        // up to light rather than blowing out to a white blob.
        queueStroke(p, p.color, a * 0.75, p.size * 0.8);
        if (!lite) {
          c.globalAlpha = a * 0.3;
          drawGlow(c, 'soft', p.color, p.x, p.y, p.size * 2.8, dpr);
        }
      } else {
        // Two strokes, batched: a soft coloured halo and a white-hot core.
        queueStroke(p, p.color, a * 0.3, p.size * 2.6);
        queueStroke(p, p.hot, a, p.size * 0.85);
        if (!lite) {
          c.globalAlpha = a * 0.85;
          drawGlow(c, 'hot', p.color, p.x, p.y, p.size * 2.8, dpr);
        }
      }
      break;
    }
    case 'ring':
    case 'arc': {
      const w = p.wobble * fade + 0.5;
      const [s0, s1] = p.shape === 'arc' ? p.span! : [0, Math.PI * 2];
      c.lineCap = 'round';
      c.beginPath();
      c.arc(p.x, p.y, p.size, s0, s1);
      c.strokeStyle = p.color;
      c.globalAlpha = a * 0.22;
      c.lineWidth = w * 2.5 + 3;
      c.stroke();
      c.strokeStyle = p.hot;
      c.globalAlpha = a;
      c.lineWidth = w;
      c.stroke();
      break;
    }
    case 'flash':
      // Bloom: the old flat disc at 0.4 alpha becomes a soft additive glow.
      c.globalAlpha = Math.min(1, a * (p.glow === 'hot' ? 1 : 2));
      drawGlow(c, p.glow ?? 'soft', p.color, p.x, p.y, p.size, dpr);
      break;
    case 'puff':
      c.globalAlpha = a;
      drawGlow(c, 'hot', p.color, p.x, p.y, p.size * 1.4, dpr);
      break;
    case 'dot': {
      // Embers flicker and leave a faint trail; they cool as they age.
      const fl = p.wobble ? 0.7 + 0.3 * Math.sin(frame * 0.6 + p.max) : 1;
      if (p.trail && p.trail.length >= 4) queueStroke(p, p.color, a * 0.35, p.size * 0.9);
      c.globalAlpha = a * fl;
      if (lite) {
        c.beginPath();
        c.arc(p.x, p.y, p.size * fl, 0, Math.PI * 2);
        c.fill();
      } else drawGlow(c, fade > 0.55 ? 'hot' : 'soft', p.color, p.x, p.y, p.size * 2.1 * fl, dpr);
      break;
    }
    case 'bolt': {
      // Lightning flickers: on for three frames, off for one. Glow from wide translucent strokes.
      if (frame % 4 === 3 || !p.points) break;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      p.points.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.strokeStyle = p.color;
      c.globalAlpha = a * 0.16;
      c.lineWidth = p.size * 6;
      c.stroke();
      c.globalAlpha = a * 0.55;
      c.lineWidth = p.size * 1.8;
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.globalAlpha = a;
      c.lineWidth = Math.max(1, p.size * 0.5);
      c.stroke();
      const end = p.points[p.points.length - 1]!;
      c.globalAlpha = a * 0.7;
      drawGlow(c, 'hot', p.color, end.x, end.y, 10 + p.size * 6, dpr);
      break;
    }
    default:
      // Any other shape flagged as light: just a glow.
      c.globalAlpha = a;
      drawGlow(c, 'hot', p.color, p.x, p.y, p.size * 2, dpr);
      break;
  }
}

/** The area drawn last frame (CSS px), so only that needs clearing: a full-screen clear is costly on phones. */
let box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
let next = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

function mark(x: number, y: number, r: number): void {
  if (x - r < next.x0) next.x0 = x - r;
  if (y - r < next.y0) next.y0 = y - r;
  if (x + r > next.x1) next.x1 = x + r;
  if (y + r > next.y1) next.y1 = y + r;
}

/** How far from (p.x, p.y) a particle can paint, generously. */
function reach(p: Particle): number {
  switch (p.shape) {
    case 'ring':
    case 'arc':
      return p.size + p.wobble * 2 + 4;
    case 'flash':
    case 'puff':
      return p.size * 1.45;
    case 'streak':
      return p.size * 3 + 2;
    case 'dot':
      return p.size * 2.8 + 2;
    case 'shard':
      return p.size * 3.6;
    case 'glyph':
    case 'ribbon':
      return p.size * 1.6 + 2;
    default:
      return p.size * 1.5 + 2;
  }
}

function markParticle(p: Particle): void {
  const r = reach(p);
  mark(p.x, p.y, r);
  const tr = p.trail;
  if (tr) for (let i = 0; i < tr.length; i += 2) mark(tr[i]!, tr[i + 1]!, r);
  if (p.points) {
    const pad = p.size * 3 + 2;
    for (const q of p.points) mark(q.x, q.y, pad);
    const end = p.points[p.points.length - 1]!;
    mark(end.x, end.y, 12 + p.size * 6);
  }
  if (p.shape === 'streak' && (!tr || tr.length < 4)) mark(p.x - p.vx * 2.5, p.y - p.vy * 2.5, r);
}

const isBloom = (p: Particle) => p.light && (p.shape === 'flash' || p.shape === 'puff');

function step(): void {
  const c = canvas?.getContext('2d');
  if (!canvas || !c) {
    running = false;
    particles = [];
    wash = null;
    box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const pending = comets;
    comets = [];
    pending.forEach((k) => k.onArrive());
    return;
  }
  const now = performance.now();
  const dt = Math.min(100, Math.max(0, now - lastNow));
  lastNow = now;
  const frozen = now < frozenUntil;
  frameEma = frameEma * 0.8 + Math.max(8, dt) * 0.2;
  if (!lite && frameEma > 21) lite = true;
  else if (lite && frameEma < 17.5) lite = false;
  if (frozen) {
    // Hold comets in place by pushing their start forward.
    for (const k of comets) k.start += dt;
  } else {
    frame++;
  }
  if (box.x1 > box.x0) c.clearRect(box.x0 - 2, box.y0 - 2, box.x1 - box.x0 + 4, box.y1 - box.y0 + 4);
  next = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  c.globalCompositeOperation = 'source-over';

  // Pass 1: advance everything.
  if (!frozen) particles = particles.filter((p) => p.life > 0);
  if (!frozen) {
    for (const p of particles) {
      if (p.delay > 0) p.delay--;
      else {
        move(p);
        p.life -= 1;
      }
    }
  }
  // Pass 2: big blooms first, with plain blending. Over an empty canvas that looks the same
  // as additive but is far cheaper to fill on phones, and everything else adds on top.
  for (const p of particles) {
    if (p.life < p.max && p.delay <= 0 && isBloom(p)) {
      drawLight(c, p);
      markParticle(p);
    }
  }
  // Pass 3: matter.
  for (const p of particles) {
    if (p.life < p.max && p.delay <= 0 && !p.light) drawMatter(c, p);
  }
  // Pass 4: light, added on top.
  c.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (p.life < p.max && p.delay <= 0 && !isBloom(p)) {
      drawLight(c, p);
      markParticle(p);
    }
  }
  flushStrokes(c);
  drawComets(c, now, frozen);
  drawWash(washEl ?? canvas, wash);
  if (wash && !frozen) {
    wash.life -= 1;
    if (wash.life <= 0) wash = null;
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  box = next;
  if (particles.length > 0 || comets.length > 0 || wash) requestAnimationFrame(step);
  else {
    running = false;
    drawWash(canvas, null);
  }
}
