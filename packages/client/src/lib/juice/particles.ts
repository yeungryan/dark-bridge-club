import { settings } from './settings.svelte';
import { PARTICLE_BUDGET } from './timing';

// Spec S16: a small canvas overlay for effects. Runs only while something is alive.
// One vocabulary of shapes, each kept for its own kind of moment so nothing gets samey:
//   sparks (takes the lead) · ring (trump-in shockwave) · glyphs (trump suits) · puff (Sold!)
//   ribbons (confetti: winning the night only) · element signatures (S24: the clinch)
// The most frequent moment (trick won) deliberately uses no particles at all.

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
  /** Orbit around a centre (air swirl). */
  /** Orbit around a centre (air swirl, tornado). `rise` moves the centre up; `squash` flattens it. */
  orbit?: { cx: number; cy: number; angle: number; radius: number; spin: number; spread: number; rise?: number; squash?: number };
  /** A lightning bolt's path. */
  points?: { x: number; y: number }[];
  /** An arc's span in radians (sound waves, a wave crest). */
  span?: [number, number];
}

/** A glowing orb travelling along a curve (a won trick heading to its score bar). */
interface Comet {
  from: { x: number; y: number };
  to: { x: number; y: number };
  start: number;
  duration: number;
  color: string;
  trail: { x: number; y: number }[];
  onArrive: () => void;
}

export type Element = 'fire' | 'air' | 'water' | 'earth';

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let comets: Comet[] = [];
let running = false;
let frame = 0;

export function attachParticleCanvas(el: HTMLCanvasElement): () => void {
  canvas = el;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = innerWidth * dpr;
    el.height = innerHeight * dpr;
    el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  return () => {
    removeEventListener('resize', resize);
    canvas = null;
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length]!;

function add(list: Partial<Particle>[]): void {
  if (!canvas || !settings.motion) return;
  const room = Math.max(0, PARTICLE_BUDGET - particles.length);
  for (const p of list.slice(0, room)) {
    const max = p.max ?? 40;
    particles.push({
      shape: 'square',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      delay: 0,
      size: 3,
      grow: 0,
      color: '#fff',
      alpha: 1,
      rot: 0,
      vrot: 0,
      wobble: 0,
      ...p,
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

/** An expanding shockwave ring. */
export function ring(x: number, y: number, color: string, opts: { radius?: number; width?: number; delay?: number; frames?: number } = {}): void {
  const frames = opts.frames ?? 24;
  add([{ shape: 'ring', x, y, size: 8, grow: ((opts.radius ?? 70) - 8) / frames, max: frames, delay: opts.delay ?? 0, color, wobble: opts.width ?? 3 }]);
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
          return { shape: 'dot' as Shape, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.24, drag: 0.99, max: rand(45, 65), size: rand(2.5, 4.5), color: pick(c, i) };
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
      add([{ shape: 'puff', x, y, size: 10, grow: 1.6, max: 16, alpha: 0.7, color: '#ffd27a' }]);
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
          return { shape: 'dot' as Shape, x, y: y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.25, max: rand(30, 45), delay: 6, size: rand(2, 3.5), color: pick(c, i) };
        }),
      );
      break;
    case 'earth':
      ring(x, y + 12, c[1]!, { radius: 46, width: 3, frames: 18 });
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
  comets.push({ from, to, start: performance.now(), duration, color, trail: [], onArrive });
  start();
}

function start(): void {
  if (!running) {
    running = true;
    requestAnimationFrame(step);
  }
}

function drawComets(c: CanvasRenderingContext2D, now: number): void {
  const arrived: Comet[] = [];
  for (const k of comets) {
    const t = Math.min(1, (now - k.start) / k.duration);
    const e = t * t * (3 - 2 * t);
    // Arc upward a little on the way, like a thrown chip.
    const lift = Math.min(80, Math.abs(k.to.x - k.from.x) * 0.3 + 30);
    const x = k.from.x + (k.to.x - k.from.x) * e;
    const y = k.from.y + (k.to.y - k.from.y) * e - Math.sin(Math.PI * e) * lift;
    k.trail.push({ x, y });
    if (k.trail.length > 10) k.trail.shift();
    k.trail.forEach((p, i) => {
      c.globalAlpha = ((i + 1) / k.trail.length) * 0.5;
      c.fillStyle = k.color;
      c.beginPath();
      c.arc(p.x, p.y, 2 + i * 0.4, 0, Math.PI * 2);
      c.fill();
    });
    c.globalAlpha = 1;
    c.shadowColor = k.color;
    c.shadowBlur = 14;
    c.fillStyle = '#fffbe8';
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    if (t >= 1) arrived.push(k);
  }
  if (arrived.length) {
    comets = comets.filter((k) => !arrived.includes(k));
    for (const k of arrived) {
      ring(k.to.x, k.to.y, k.color, { radius: 16, width: 2, frames: 14 });
      k.onArrive();
    }
  }
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
    return;
  }
  p.vx *= p.drag;
  p.vy = p.vy * p.drag + p.gravity;
  p.x += p.vx + (p.shape === 'ribbon' || p.shape === 'glyph' ? Math.sin((frame + p.max) * 0.12) * p.wobble : 0);
  p.y += p.vy;
  p.rot += p.vrot;
  p.size = Math.max(0, p.size + p.grow);
}

function draw(c: CanvasRenderingContext2D, p: Particle): void {
  const fade = Math.max(0, p.life / p.max);
  c.globalAlpha = p.alpha * (p.shape === 'ring' || p.shape === 'flash' ? fade : Math.min(1, fade * 1.6));
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
    case 'streak':
      c.lineWidth = p.size;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(p.x, p.y);
      // Orbiting streaks (air) move fast along the circle; keep their tails short.
      c.lineTo(p.x - p.vx * (p.orbit ? 1.2 : 2.5), p.y - p.vy * (p.orbit ? 1.2 : 2.5));
      c.stroke();
      break;
    case 'ring':
      c.lineWidth = p.wobble * fade + 0.5;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.stroke();
      break;
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
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
      break;
    case 'dot': {
      // Embers flicker.
      const s = p.wobble ? p.size * (0.7 + 0.3 * Math.sin(frame * 0.6 + p.max)) : p.size;
      c.beginPath();
      c.arc(p.x, p.y, s, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'bolt': {
      // Lightning flickers: on for three frames, off for one, with a white-hot core.
      if (frame % 4 === 3 || !p.points) break;
      c.lineJoin = 'round';
      c.shadowColor = p.color;
      c.shadowBlur = 14;
      for (const [w, col] of [[p.size, p.color], [p.size * 0.4, '#ffffff']] as const) {
        c.lineWidth = w;
        c.strokeStyle = col;
        c.beginPath();
        p.points.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
        c.stroke();
      }
      c.shadowBlur = 0;
      break;
    }
    case 'arc':
      c.lineWidth = p.wobble * fade + 0.5;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(p.x, p.y, p.size, p.span![0], p.span![1]);
      c.stroke();
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
    case 'ribbon': {
      // A paper strip turning over: its width follows the spin.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillRect(-p.size / 2, -p.size, p.size * Math.abs(Math.cos(p.rot * 2)) + 1, p.size * 2);
      c.restore();
      break;
    }
  }
}

function step(): void {
  const c = canvas?.getContext('2d');
  if (!canvas || !c) {
    running = false;
    particles = [];
    const pending = comets;
    comets = [];
    pending.forEach((k) => k.onArrive());
    return;
  }
  frame++;
  c.clearRect(0, 0, canvas.width, canvas.height);
  drawComets(c, performance.now());
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    if (p.delay > 0) {
      p.delay--;
      continue;
    }
    move(p);
    p.life -= 1;
    draw(c, p);
  }
  c.globalAlpha = 1;
  if (particles.length > 0 || comets.length > 0) requestAnimationFrame(step);
  else running = false;
}
