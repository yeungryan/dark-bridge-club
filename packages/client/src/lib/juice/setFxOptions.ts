import { elementStrike, elementWin, flash, glyphs, spawn, ELEMENT_COLORS, type Spec } from './particles';

// The set-win effects review (Ryan, round 8): each effect as it plays now, beside three
// options with more juice. Played in the effects lab (fxlab.html); nothing here is in the game.
//
// Every option keeps the set win small and quick (about a second, within ~110px of the card):
// it's the most frequent moment of the night, so no screen washes and no hit-stop, which stay
// for the big hits.

export interface FxOption {
  label: string;
  name: string;
  /** What's different, in a few words. */
  note: string;
  play: (x: number, y: number) => void;
  /** The table shake with it, in px (now: 2 for a set, 4 for a trump set). */
  shake: number;
}

export interface FxRow {
  id: string;
  title: string;
  options: FxOption[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length]!;
const many = (n: number, f: (i: number) => Spec): Spec[] => Array.from({ length: n }, (_, i) => f(i));

/** A jagged line from (x0, y0) toward an angle, for cracks. */
function crack(x: number, y: number, angle: number, length: number, segments: number, jitter: number) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const j = i === 0 ? 0 : rand(-jitter, jitter);
    return { x: x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * j, y: y + Math.sin(angle) * length * t * 0.45 + j * 0.3 };
  });
}

/** A short anticipation: specks sucked into the card before the burst (`frames` long). */
function implode(x: number, y: number, colors: readonly string[], n = 10, radius = 52, frames = 6): void {
  spawn(
    many(n, (i) => {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const r = radius * rand(0.8, 1.1);
      return { shape: 'streak', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: (-Math.cos(a) * r) / frames, vy: (-Math.sin(a) * r) / frames, max: frames, size: 1.6, color: pick(colors, i), trailLen: 3 };
    }),
  );
}

const F = ELEMENT_COLORS.fire;
const A = ELEMENT_COLORS.air;
const W = ELEMENT_COLORS.water;
const E = ELEMENT_COLORS.earth;

export const SET_FX: FxRow[] = [
  {
    id: 'fire',
    title: 'Fire · set won',
    options: [
      { label: 'Now', name: 'Fireball', note: 'Glow, fireball, 22 embers', shake: 2, play: (x, y) => elementWin('fire', x, y) },
      {
        label: 'A',
        name: 'Ignite',
        note: 'Sparks suck in, then a white-hot pop, a ring and trailing embers',
        shake: 3,
        play: (x, y) => {
          implode(x, y, F);
          const d = 6;
          spawn([
            { shape: 'flash', x, y, size: 70, max: 18, delay: d, alpha: 0.45, color: '#ff8a3a' },
            { shape: 'flash', x, y, size: 30, max: 12, delay: d, alpha: 0.95, color: '#ffd27a', glow: 'hot' },
            { shape: 'ring', x, y, size: 10, grow: 4, max: 16, delay: d, color: '#ff7a2f', wobble: 3 },
            { shape: 'puff', x, y, size: 12, grow: 1.9, max: 16, delay: d, alpha: 0.9, color: '#ffb347', light: true },
            ...many(28, (i) => {
              const a = rand(0, Math.PI * 2);
              const v = rand(2.5, 5.5);
              return { shape: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, gravity: -0.07, drag: 0.93, max: rand(32, 50), delay: d, size: rand(2, 4), color: pick(F, i), wobble: 1, trailLen: 4 };
            }),
          ]);
        },
      },
      {
        label: 'B',
        name: 'Flame burst',
        note: 'Tongues of flame lick upward, then a curl of smoke',
        shake: 2,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y, size: 55, max: 16, alpha: 0.4, color: '#ff8a3a' },
            { shape: 'flash', x, y: y + 4, size: 24, max: 10, alpha: 0.9, color: '#ffd27a', glow: 'hot' },
            ...many(11, (i) => {
              const a = -Math.PI / 2 + ((i - 5) / 5) * 0.95 + rand(-0.08, 0.08);
              const v = rand(5.5, 8.5) * (1 - Math.abs(i - 5) * 0.06);
              return { shape: 'streak', x: x + (i - 5) * 3, y: y + 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: -0.05, drag: 0.9, max: rand(20, 28), size: rand(2.6, 3.6), color: pick(F, i), trailLen: 9 };
            }),
            ...many(14, (i) => ({ shape: 'dot', x: x + rand(-20, 20), y: y + rand(-6, 10), vx: rand(-0.8, 0.8), vy: rand(-3.4, -1.5), gravity: -0.03, drag: 0.98, max: rand(36, 56), delay: rand(4, 12), size: rand(1.8, 3.2), color: pick(F, i), wobble: 1 })),
            ...many(4, (i) => ({ shape: 'puff', x: x + rand(-14, 14), y: y - 60, vx: rand(-0.4, 0.4), vy: rand(-1.2, -0.7), drag: 0.97, max: rand(30, 40), delay: 14 + i * 2, size: rand(4, 6), grow: 0.35, alpha: 0.16, color: '#c9b8a8', light: false })),
          ]);
        },
      },
      {
        label: 'C',
        name: 'Fire nova',
        note: 'A ring of flame bursts out from the card and floats up as embers',
        shake: 3,
        play: (x, y) => {
          const n = 26;
          spawn([
            { shape: 'flash', x, y, size: 80, max: 18, alpha: 0.45, color: '#ff8a3a' },
            { shape: 'flash', x, y, size: 28, max: 10, alpha: 1, color: '#ffd27a', glow: 'hot' },
            ...many(n, (i) => {
              const a = (i / n) * Math.PI * 2;
              return { shape: 'dot', x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, gravity: -0.05, drag: 0.91, max: rand(36, 46), size: 3.6, color: pick(F, i), wobble: 1, trailLen: 5 };
            }),
            ...many(18, (i) => ({ shape: 'dot', x: x + rand(-10, 10), y, vx: rand(-1.2, 1.2), vy: rand(-4.5, -2), gravity: -0.04, drag: 0.97, max: rand(40, 60), delay: rand(6, 16), size: rand(1.8, 3), color: pick(F, i + 1), wobble: 1 })),
          ]);
        },
      },
    ],
  },
  {
    id: 'air',
    title: 'Air · set won',
    options: [
      { label: 'Now', name: 'Tornado', note: '40 streaks in a rising funnel', shake: 2, play: (x, y) => elementWin('air', x, y) },
      {
        label: 'A',
        name: 'Gust',
        note: 'The tornado, plus a ring of wind on the table and flecks flung off',
        shake: 2,
        play: (x, y) => {
          elementWin('air', x, y);
          spawn([
            { shape: 'flash', x, y: y + 20, size: 40, max: 14, alpha: 0.35, color: A[2]! },
            { shape: 'ring', x, y: y + 30, size: 10, grow: 4.2, max: 20, color: A[0]!, wobble: 3, squash: 0.32 },
            { shape: 'ring', x, y: y + 30, size: 10, grow: 5.2, max: 22, delay: 5, color: A[2]!, wobble: 2, squash: 0.32 },
            ...many(10, (i) => {
              const a = (i / 10) * Math.PI * 2;
              return { shape: 'dot', x: x + Math.cos(a) * 14, y: y + 10 + Math.sin(a) * 6, vx: -Math.sin(a) * 5, vy: Math.cos(a) * 2 - 1.5, drag: 0.94, max: rand(26, 36), delay: 8, size: rand(1.5, 2.5), color: pick(A, i), trailLen: 4 };
            }),
          ]);
        },
      },
      {
        label: 'B',
        name: 'Wind slash',
        note: 'Three quick crescent slashes across the card and speed lines',
        shake: 3,
        play: (x, y) => {
          const cuts: [number, number][] = [
            [-0.6, 0],
            [2.4, 4],
            [0.9, 8],
          ];
          spawn([
            ...cuts.map(([rot, d], k) => ({ shape: 'arc' as const, x, y, size: 26, grow: 3.4, max: 14, delay: d, color: pick(A, k), wobble: 4.5, span: [rot - 1.1, rot + 1.1] as [number, number] })),
            { shape: 'flash', x, y, size: 30, max: 10, alpha: 0.8, color: A[2]!, glow: 'hot' },
            ...many(14, (i) => {
              const dir = i % 2 ? 1 : -1;
              return { shape: 'streak', x: x + rand(-10, 10), y: y + rand(-40, 40), vx: dir * rand(8, 12), vy: rand(-0.6, 0.6), drag: 0.88, max: rand(14, 20), delay: rand(2, 10), size: rand(1.2, 2), color: pick(A, i), trailLen: 6 };
            }),
          ]);
        },
      },
      {
        label: 'C',
        name: 'Cyclone',
        note: 'A tighter, faster funnel that throws streaks off the top',
        shake: 3,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y, size: 36, max: 12, alpha: 0.7, color: A[2]!, glow: 'hot' },
            { shape: 'ring', x, y: y + 32, size: 8, grow: 3.6, max: 22, color: A[0]!, wobble: 3, squash: 0.3 },
            ...many(48, (i) => ({
              shape: 'streak',
              x,
              y,
              max: rand(44, 56),
              delay: (i % 8) * 1.5,
              size: 2.6,
              color: pick(A, i),
              orbit: { cx: x, cy: y + 32, angle: (i / 48) * Math.PI * 2, radius: 3 + (i % 8) * 1.8, spin: 0.46, spread: 0.85, rise: -2.6, squash: 0.28 },
            })),
            ...many(10, (i) => {
              const a = -Math.PI / 2 + rand(-1.2, 1.2);
              return { shape: 'streak', x: x + rand(-12, 12), y: y - 70, vx: Math.cos(a) * 5, vy: Math.sin(a) * 3, drag: 0.92, max: rand(18, 26), delay: 22 + rand(0, 6), size: 1.8, color: pick(A, i), trailLen: 6 };
            }),
          ]);
        },
      },
    ],
  },
  {
    id: 'water',
    title: 'Water · set won',
    options: [
      { label: 'Now', name: 'Tsunami', note: 'Three wave crests and 16 droplets', shake: 2, play: (x, y) => elementWin('water', x, y) },
      {
        label: 'A',
        name: 'Splash crown',
        note: 'A crown of droplets and a spout, ripples on the table',
        shake: 2,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y, size: 50, max: 16, alpha: 0.4, color: W[0]! },
            { shape: 'ring', x, y: y + 16, size: 10, grow: 3.6, max: 26, color: W[3]!, wobble: 3, squash: 0.35 },
            { shape: 'ring', x, y: y + 16, size: 10, grow: 3, max: 30, delay: 7, color: W[0]!, wobble: 2, squash: 0.35 },
            ...many(20, (i) => {
              const a = (i / 20) * Math.PI * 2;
              return { shape: 'dot', x: x + Math.cos(a) * 16, y: y + 10 + Math.sin(a) * 5, vx: Math.cos(a) * rand(2.4, 3.4), vy: rand(-5.5, -4), gravity: 0.26, drag: 0.99, max: rand(32, 42), size: rand(2.2, 3.4), color: pick(W, i), light: false };
            }),
            ...many(8, (i) => ({ shape: 'dot', x: x + rand(-4, 4), y, vx: rand(-0.6, 0.6), vy: rand(-8.5, -6.5), gravity: 0.3, drag: 0.99, max: rand(36, 44), delay: 3, size: rand(2.6, 3.8), color: pick(W, i + 2), light: false })),
          ]);
        },
      },
      {
        label: 'B',
        name: 'Ripples',
        note: 'Calm rings spread over the felt, with glints on the water',
        shake: 1,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y, size: 40, max: 14, alpha: 0.5, color: W[3]!, glow: 'hot' },
            ...many(4, (k) => ({ shape: 'ring', x, y: y + 12, size: 8, grow: 3.2, max: 34, delay: k * 7, color: pick(W, k + 3), wobble: 3.4 - k * 0.6, squash: 0.38 })),
            ...many(12, (i) => {
              const a = rand(0, Math.PI * 2);
              const r = rand(30, 90);
              return { shape: 'flash', x: x + Math.cos(a) * r, y: y + 12 + Math.sin(a) * r * 0.38, size: rand(5, 9), max: rand(10, 16), delay: 6 + (r / 90) * 20, alpha: 0.9, color: '#e8fbff', glow: 'star' };
            }),
            ...many(6, (i) => ({ shape: 'dot', x, y, vx: rand(-1.5, 1.5), vy: rand(-5, -3.5), gravity: 0.28, max: rand(22, 30), size: rand(2, 3), color: pick(W, i), light: false })),
          ]);
        },
      },
      {
        label: 'C',
        name: 'Big wave',
        note: 'Taller crests that break into spray and white foam',
        shake: 3,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y, size: 60, max: 18, alpha: 0.4, color: W[0]! },
            ...many(4, (k) => ({ shape: 'arc', x, y: y + 40, size: 14, grow: 2.9, max: 26, delay: k * 4, color: pick(W, k), wobble: 5 - k, span: [-Math.PI * 0.92, -Math.PI * 0.08] as [number, number] })),
            ...many(18, (i) => {
              const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
              const v = rand(3.5, 7);
              return { shape: 'dot', x, y: y + 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.25, max: rand(30, 44), delay: 8, size: rand(2, 3.6), color: pick(W, i), light: false };
            }),
            ...many(14, (i) => ({ shape: 'dot', x: x + rand(-60, 60), y: y - rand(40, 70), vx: rand(-1.6, 1.6), vy: rand(-0.6, 0.2), drag: 0.96, max: rand(20, 30), delay: 14 + rand(0, 6), size: rand(1, 1.8), color: '#e8fbff' })),
            ...many(6, (i) => ({ shape: 'puff', x: x + rand(-40, 40), y: y - rand(30, 55), vx: rand(-0.8, 0.8), vy: 0.3, drag: 0.95, max: rand(26, 34), delay: 16, size: rand(5, 8), grow: 0.4, alpha: 0.5, color: '#eefbff', light: false })),
          ]);
        },
      },
    ],
  },
  {
    id: 'earth',
    title: 'Earth · set won',
    options: [
      { label: 'Now', name: 'Rock smash', note: 'A dust ring, 14 rocks, 6 dust puffs', shake: 2, play: (x, y) => elementWin('earth', x, y) },
      {
        label: 'A',
        name: 'Quake',
        note: 'Cracks split the felt from the card, rocks jump, a harder shake',
        shake: 5,
        play: (x, y) => {
          spawn([
            ...many(6, (i) => ({ shape: 'bolt', x, y, points: (() => {
              const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
              return crack(x + Math.cos(a) * 34, y + 18 + Math.sin(a) * 14, a, rand(45, 70), 5, 7);
            })(), max: 40, size: 2.4, color: '#2a1d12', alpha: 0.85, light: false })),
            { shape: 'ring', x, y: y + 18, size: 10, grow: 4, max: 20, color: E[1]!, wobble: 4, squash: 0.35, light: false },
            ...many(14, (i) => {
              const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
              const v = rand(3.5, 6.5);
              return { shape: 'square', x: x + rand(-14, 14), y: y + 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.42, drag: 0.98, max: rand(30, 42), delay: 2, size: rand(3.5, 6.5), color: pick(E, i), vrot: rand(-0.3, 0.3) };
            }),
            ...many(6, (i) => ({ shape: 'puff', x: x + rand(-30, 30), y: y + 20, vx: (i % 2 ? 1 : -1) * rand(1, 2.4), drag: 0.93, max: rand(30, 40), size: rand(5, 8), grow: 0.5, alpha: 0.4, color: E[1]! })),
          ]);
        },
      },
      {
        label: 'B',
        name: 'Boulder slam',
        note: 'Fewer, bigger chunks, a heavy shockwave and a low dust cloud',
        shake: 4,
        play: (x, y) => {
          spawn([
            { shape: 'ring', x, y: y + 16, size: 12, grow: 4.6, max: 18, color: E[1]!, wobble: 7, squash: 0.35, light: false },
            { shape: 'ring', x, y: y + 16, size: 12, grow: 3, max: 24, delay: 4, color: E[2]!, wobble: 3, squash: 0.35, light: false },
            ...many(5, (i) => {
              const a = -Math.PI / 2 + (i - 2) * 0.5 + rand(-0.15, 0.15);
              const v = rand(4, 5.5);
              return { shape: 'square', x, y: y + 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.38, drag: 0.985, max: rand(36, 44), size: rand(9, 12), color: pick(E, i + 1), vrot: rand(-0.18, 0.18) };
            }),
            ...many(12, (i) => {
              const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
              const v = rand(3, 6);
              return { shape: 'square', x, y: y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.45, max: rand(26, 36), size: rand(2, 3.5), color: pick(E, i), vrot: rand(-0.4, 0.4) };
            }),
            ...many(10, (i) => ({ shape: 'puff', x: x + (i % 2 ? 1 : -1) * rand(24, 34), y: y + 26, vx: (i % 2 ? 1 : -1) * rand(1.6, 3.6), vy: rand(-0.3, 0), drag: 0.94, max: rand(30, 40), size: rand(4, 7), grow: 0.4, alpha: 0.3, color: pick([E[1]!, E[2]!], i) })),
          ]);
        },
      },
      {
        label: 'C',
        name: 'Eruption',
        note: 'Rocks shoot straight up with a few glowing embers, dust billows',
        shake: 3,
        play: (x, y) => {
          spawn([
            { shape: 'flash', x, y: y + 10, size: 40, max: 14, alpha: 0.5, color: '#ff8a3a' },
            { shape: 'ring', x, y: y + 16, size: 10, grow: 3, max: 20, color: E[1]!, wobble: 4, squash: 0.35, light: false },
            ...many(16, (i) => {
              const a = -Math.PI / 2 + rand(-0.38, 0.38);
              const v = rand(6, 9);
              return { shape: 'square', x: x + rand(-6, 6), y: y + 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.4, drag: 0.985, max: rand(34, 44), delay: rand(0, 5), size: rand(3.5, 7), color: pick(E, i), vrot: rand(-0.3, 0.3) };
            }),
            ...many(8, (i) => {
              const a = -Math.PI / 2 + rand(-0.3, 0.3);
              const v = rand(5, 7.5);
              return { shape: 'dot', x, y: y + 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.3, drag: 0.98, max: rand(28, 36), size: rand(2, 3), color: pick(['#ff8a3a', '#ffb347'], i), trailLen: 4 };
            }),
            ...many(6, (i) => ({ shape: 'puff', x: x + (i % 2 ? 1 : -1) * rand(26, 34), y: y + 24, vx: (i % 2 ? 1 : -1) * rand(0.6, 1.4), vy: rand(-1, -0.4), drag: 0.96, max: rand(30, 40), delay: 4 + i, size: rand(4, 6), grow: 0.4, alpha: 0.3, color: pick([E[1]!, E[2]!], i) })),
          ]);
        },
      },
    ],
  },
];

/** The rest as they play now (the current-state sheet; their options come in later batches). */
const TRUMP = '#c58bff';
export const CURRENT_OTHERS: FxRow[] = [
  { id: 'lightning', title: 'Lightning (fire, trump set)', options: [{ label: 'Now', name: 'Lightning', note: '', shake: 4, play: (x, y) => elementStrike('fire', x, y) }] },
  { id: 'sound', title: 'Sound (air, trump set)', options: [{ label: 'Now', name: 'Sound', note: '', shake: 4, play: (x, y) => elementStrike('air', x, y) }] },
  { id: 'ice', title: 'Ice (water, trump set)', options: [{ label: 'Now', name: 'Ice', note: '', shake: 4, play: (x, y) => elementStrike('water', x, y) }] },
  { id: 'metal', title: 'Metal (earth, trump set)', options: [{ label: 'Now', name: 'Metal', note: '', shake: 4, play: (x, y) => elementStrike('earth', x, y) }] },
  { id: 'plain', title: 'No element · set won', options: [{ label: 'Now', name: 'Gold glow', note: '', shake: 2, play: (x, y) => flash(x, y, '#e8c25a', 42) }] },
  { id: 'plainTrump', title: 'No element · trump set', options: [{ label: 'Now', name: 'Trump suits', note: '', shake: 4, play: (x, y) => glyphs(x, y, 7, '♠', [TRUMP, '#f2e6ff'], 'rise') }] },
];

