import { freeze, spawn, type Spec } from './particles';

// Ryan's round 8 mockups: the winning card's element attacks the three losing cards of the set.
//   Fire: Ignite, then fireballs set the losers burning; they end charred, edges eaten.
//   Air: Wind slashes fly at the losers, slice each in two, and the halves fly away.
//   Water: The splash crown with ripples under the card; jets pierce the losers, leaving holes.
//   Earth: The boulder slam; boulders hit the losers, which tumble down off the table.
// Effects lab only (fxlab.html?set=attack). Card damage is done with the Web Animations API on
// the card's own element so it can be held still for screenshots.

type Pt = { x: number; y: number };
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length]!;
const many = (n: number, f: (i: number) => Spec): Spec[] => Array.from({ length: n }, (_, i) => f(i));
const center = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
/** Frames are 60 a second. */
const F = 1000 / 60;

let timers: ReturnType<typeof setTimeout>[] = [];
const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

/** Hold everything still (for the screenshots). */
export function holdStill(): void {
  timers.forEach(clearTimeout);
  timers = [];
  document.getAnimations().forEach((a) => a.pause());
  freeze(1e7);
}

const FIRE = ['#ffb347', '#ff7a2f', '#e8402a', '#ffd27a'];
const AIR = ['#fff6cf', '#f4e7a1', '#fffdf2', '#e9dcb0'];
const WATER = ['#5fd6d0', '#2fa7d6', '#1b6fb8', '#bff0ff'];
const EARTH = ['#8a9a4b', '#7a5a36', '#a37b4c', '#5b6e33'];

/** Something flying from a to b, arriving after `frames`. */
const toward = (a: Pt, b: Pt, frames: number) => ({ vx: (b.x - a.x) / frames, vy: (b.y - a.y) / frames });

function implode(p: Pt, colors: readonly string[], n = 10, radius = 40, frames = 6): void {
  spawn(
    many(n, (i) => {
      const a = (i / n) * Math.PI * 2;
      const r = radius * rand(0.8, 1.1);
      return { shape: 'streak', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: (-Math.cos(a) * r) / frames, vy: (-Math.sin(a) * r) / frames, max: frames, size: 1.6, color: pick(colors, i), trailLen: 3 };
    }),
  );
}

/** An overlay inside a card, the card's size and shape. */
function overlay(card: HTMLElement, style: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;border-radius:6px;pointer-events:none;${style}`;
  card.appendChild(el);
  return el;
}

/** A card outline with `n` points, pushed in at random (`bite` px) for eaten edges. */
function ragged(w: number, h: number, n: number, bite: number): string {
  const pts: string[] = [];
  const per = 2 * (w + h);
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per;
    let x: number, y: number, nx: number, ny: number;
    if (d < w) [x, y, nx, ny] = [d, 0, 0, 1];
    else if ((d -= w) < h) [x, y, nx, ny] = [w, d, -1, 0];
    else if ((d -= h) < w) [x, y, nx, ny] = [w - d, h, 0, -1];
    else [x, y, nx, ny] = [0, h - (d - w), 1, 0];
    const k = bite ? rand(0, bite) : 0;
    pts.push(`${(x + nx * k).toFixed(1)}px ${(y + ny * k).toFixed(1)}px`);
  }
  return `polygon(${pts.join(',')})`;
}

// ── Fire ─────────────────────────────────────────────────────────────────────────────────────

export function fireAttack(win: HTMLElement, losers: HTMLElement[]): void {
  const w = center(win);
  implode(w, FIRE);
  at(100, () => {
    spawn([
      { shape: 'flash', x: w.x, y: w.y, size: 60, max: 16, alpha: 0.45, color: '#ff8a3a' },
      { shape: 'flash', x: w.x, y: w.y, size: 26, max: 10, alpha: 0.95, color: '#ffd27a', glow: 'hot' },
      { shape: 'ring', x: w.x, y: w.y, size: 8, grow: 3.4, max: 14, color: '#ff7a2f', wobble: 3 },
    ]);
    // A fireball at each loser, with a tail of embers.
    for (const l of losers) {
      const t = center(l);
      const v = toward(w, t, 13);
      spawn([
        { shape: 'flash', x: w.x, y: w.y, ...v, size: 16, max: 13, alpha: 1, color: '#ffb347', glow: 'hot' },
        { shape: 'streak', x: w.x, y: w.y, ...v, size: 4, max: 13, color: '#ff7a2f', trailLen: 10 },
        ...many(6, (i) => ({ shape: 'dot', x: w.x, y: w.y, vx: v.vx * 0.9, vy: v.vy * 0.9, drag: 0.97, max: 14, delay: i, size: rand(1.5, 2.6), color: pick(FIRE, i), wobble: 1 })),
      ]);
      at(13 * F, () => burn(l, w));
    }
  });
}

function burn(card: HTMLElement, from: Pt): void {
  const r = card.getBoundingClientRect();
  const c = center(card);
  // Where it was hit: the side facing the winner.
  const hx = Math.max(10, Math.min(90, 50 + ((from.x - c.x) / r.width) * 60));
  const hy = Math.max(10, Math.min(90, 50 + ((from.y - c.y) / r.height) * 60));
  spawn([
    { shape: 'flash', x: r.left + (r.width * hx) / 100, y: r.top + (r.height * hy) / 100, size: 34, max: 12, alpha: 0.9, color: '#ffb347', glow: 'hot' },
    ...many(10, (i) => {
      const a = rand(0, Math.PI * 2);
      return { shape: 'dot', x: c.x, y: c.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 - 1, gravity: -0.05, drag: 0.93, max: rand(20, 30), size: rand(1.5, 2.5), color: pick(FIRE, i), wobble: 1 };
    }),
  ]);
  // The burning front: a glowing rim racing out from the hit, the char right behind it.
  const front = overlay(card, 'background: radial-gradient(circle at 50% 60%, #fff3b0 0%, #ffb347 35%, rgba(232,64,42,.85) 75%, rgba(232,64,42,.4) 100%); filter: blur(1.5px);');
  const char = overlay(card, 'background: radial-gradient(circle at 50% 45%, #3a2416 0%, #1d120b 55%, #0d0805 100%); opacity: 0.93;');
  const grow = (el: HTMLElement, pad: number) =>
    el.animate([{ clipPath: `circle(0% at ${hx}% ${hy}%)` }, { clipPath: `circle(${150 + pad}% at ${hx}% ${hy}%)` }], { duration: 640, easing: 'cubic-bezier(.3,.5,.5,1)', fill: 'both', delay: pad ? 0 : 90 });
  grow(front, 8);
  grow(char, 0);
  front.animate([{ opacity: 1 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
  // Flames licking up off the card while it burns.
  spawn(
    many(14, (i) => ({ shape: 'streak', x: c.x + rand(-20, 20), y: c.y + rand(-14, 30), vx: rand(-0.3, 0.3), vy: rand(-2.6, -1.6), gravity: -0.04, drag: 0.96, max: rand(12, 18), delay: 2 + i * 1.6, size: rand(2.2, 3.2), color: pick(FIRE, i), trailLen: 6 })),
  );
  // Embers lift off it as it burns.
  spawn(many(16, (i) => ({ shape: 'dot', x: c.x + rand(-22, 22), y: c.y + rand(-30, 30), vx: rand(-0.4, 0.4), vy: rand(-1.8, -0.8), gravity: -0.02, max: rand(24, 40), delay: 4 + i * 2, size: rand(1.2, 2.2), color: pick(FIRE, i), wobble: 1 })));
  // Burnt: the edges crumble in, the card curls and darkens.
  const box = card.getBoundingClientRect();
  card.animate([{ clipPath: ragged(box.width, box.height, 36, 0), transform: 'none' }, { clipPath: ragged(box.width, box.height, 36, 6), transform: 'scale(0.95) rotate(-3deg)' }], {
    duration: 520,
    delay: 300,
    easing: 'ease-out',
    fill: 'forwards',
  });
  // A last few embers glowing on the char.
  const ember = overlay(card, 'background: radial-gradient(circle at 25% 70%, rgba(255,122,47,.9) 0 2px, transparent 4px), radial-gradient(circle at 70% 30%, rgba(255,179,71,.85) 0 1.5px, transparent 3.5px), radial-gradient(circle at 60% 80%, rgba(232,64,42,.8) 0 1.5px, transparent 3.5px); opacity: 0;');
  ember.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 520, fill: 'forwards' });
}

// ── Air ──────────────────────────────────────────────────────────────────────────────────────

export function airAttack(win: HTMLElement, losers: HTMLElement[]): void {
  const w = center(win);
  spawn([{ shape: 'flash', x: w.x, y: w.y, size: 26, max: 10, alpha: 0.8, color: AIR[2]!, glow: 'hot' }]);
  losers.forEach((l, k) => {
    const t = center(l);
    const th = Math.atan2(t.y - w.y, t.x - w.x);
    const N = 10;
    const v = toward(w, t, N);
    const d = k * 3;
    // A crescent of wind flying at it, bowed toward its target, with speed lines alongside.
    spawn([
      { shape: 'arc', x: w.x, y: w.y, ...v, size: 16, grow: 0.5, max: N + 2, delay: d, color: AIR[0]!, wobble: 4.5, span: [th - 1.1, th + 1.1] },
      ...many(4, (i) => {
        const off = (i - 1.5) * 7;
        return { shape: 'streak', x: w.x - Math.sin(th) * off, y: w.y + Math.cos(th) * off, vx: v.vx * 1.05, vy: v.vy * 1.05, max: N, delay: d + i, size: 1.4, color: pick(AIR, i), trailLen: 6 };
      }),
    ]);
    at((N + d) * F, () => slice(l, th));
  });
}

function slice(card: HTMLElement, th: number): void {
  const r = card.getBoundingClientRect();
  const c = center(card);
  // The cut runs across the card, roughly square to the way the wind came in.
  const phi = th + Math.PI / 2 + rand(-0.35, 0.35);
  const L = 140;
  const dx = Math.cos(phi) * L;
  const dy = Math.sin(phi) * L;
  spawn([
    { shape: 'bolt', x: c.x, y: c.y, points: [{ x: c.x - dx * 0.5, y: c.y - dy * 0.5 }, { x: c.x + dx * 0.5, y: c.y + dy * 0.5 }], max: 9, size: 2.4, color: '#ffffff' },
    { shape: 'flash', x: c.x, y: c.y, size: 22, max: 8, alpha: 0.9, color: '#ffffff', glow: 'hot' },
  ]);
  // Two copies of the card, each clipped to one side of the cut, fly apart and away.
  const cx = r.width / 2;
  const cy = r.height / 2;
  const nx = -Math.sin(phi);
  const ny = Math.cos(phi);
  const half = (s: number) => {
    const p = (k: number, m: number) => `${(cx + Math.cos(phi) * L * k + nx * L * m * s).toFixed(1)}px ${(cy + Math.sin(phi) * L * k + ny * L * m * s).toFixed(1)}px`;
    return `polygon(${p(-1, 0)}, ${p(1, 0)}, ${p(1, 1)}, ${p(-1, 1)})`;
  };
  const parent = card.parentElement!;
  for (const s of [1, -1]) {
    const piece = card.cloneNode(true) as HTMLElement;
    piece.style.cssText += `position:absolute;left:${card.offsetLeft}px;top:${card.offsetTop}px;clip-path:${half(s)};margin:0;`;
    parent.appendChild(piece);
    const away = 70;
    const ax = (nx * s * 0.8 + Math.cos(th) * 0.6) * away;
    const ay = (ny * s * 0.8 + Math.sin(th) * 0.6) * away;
    piece.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${nx * s * 4}px, ${ny * s * 4}px) rotate(${s * 3}deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${ax}px, ${ay}px) rotate(${s * 38}deg)`, opacity: 0 },
      ],
      { duration: 620, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' },
    );
  }
  card.style.visibility = 'hidden';
  spawn(many(8, (i) => ({ shape: 'streak', x: c.x, y: c.y, vx: Math.cos(phi + (i % 2) * Math.PI) * rand(3, 6), vy: Math.sin(phi + (i % 2) * Math.PI) * rand(3, 6), drag: 0.88, max: rand(10, 16), size: 1.4, color: pick(AIR, i), trailLen: 5 })));
}

// ── Water ────────────────────────────────────────────────────────────────────────────────────

export function waterAttack(win: HTMLElement, losers: HTMLElement[], under: HTMLElement): void {
  const w = center(win);
  // Ripples spread under the winning card (in the layer beneath the cards).
  const u = under.getBoundingClientRect();
  for (let k = 0; k < 3; k++) {
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${w.x - u.left - 30}px;top:${w.y - u.top + 18}px;width:60px;height:22px;border-radius:50%;border:2px solid ${pick(['#bff0ff', '#5fd6d0', '#2fa7d6'], k)};box-shadow:0 0 6px rgba(95,214,208,.6);pointer-events:none;`;
    under.appendChild(ring);
    ring.animate([{ transform: 'scale(0.4)', opacity: 0.95 }, { transform: 'scale(3)', opacity: 0 }], { duration: 760, delay: k * 140, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
  }
  // The splash crown.
  spawn([
    { shape: 'flash', x: w.x, y: w.y, size: 40, max: 14, alpha: 0.4, color: WATER[0]! },
    ...many(16, (i) => {
      const a = (i / 16) * Math.PI * 2;
      return { shape: 'dot', x: w.x + Math.cos(a) * 12, y: w.y + 10 + Math.sin(a) * 4, vx: Math.cos(a) * rand(1.8, 2.6), vy: rand(-4.5, -3.2), gravity: 0.26, max: rand(26, 34), size: rand(1.8, 2.8), color: pick(WATER, i), light: false };
    }),
  ]);
  // A jet at each loser: a stream of droplets with a bright core.
  losers.forEach((l) => {
    const t = center(l);
    const N = 9;
    const v = toward(w, t, N);
    spawn([
      ...many(18, (i) => ({ shape: 'dot', x: w.x + rand(-1.5, 1.5), y: w.y + rand(-1.5, 1.5), ...v, max: N, delay: 4 + i * 0.8, size: rand(1.8, 2.8), color: pick(WATER, i), light: false })),
      ...many(6, (i) => ({ shape: 'streak', x: w.x, y: w.y, ...v, max: N, delay: 4 + i * 2.4, size: 1.6, color: '#e8fbff', trailLen: 7 })),
    ]);
    const th = Math.atan2(t.y - w.y, t.x - w.x);
    at((4 + N) * F, () => pierce(l, th));
  });
}

function pierce(card: HTMLElement, th: number): void {
  const r = card.getBoundingClientRect();
  const holes: { x: number; y: number; r: number }[] = [];
  const n = 4;
  const soak = overlay(card, 'background: radial-gradient(circle at 50% 50%, rgba(27,111,184,.35), rgba(27,111,184,.12) 70%); opacity: 0;');
  soak.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'forwards' });
  for (let i = 0; i < n; i++) {
    at(i * 55, () => {
      const hx = rand(0.22, 0.78) * r.width;
      const hy = rand(0.18, 0.82) * r.height;
      const hr = rand(3.5, 5.5);
      holes.push({ x: hx, y: hy, r: hr });
      // Punch it: the hole shows the felt through (a mask), grown in two steps.
      const set = (scale: number) => {
        const m = holes.map((h, j) => `radial-gradient(circle at ${h.x.toFixed(1)}px ${h.y.toFixed(1)}px, transparent ${(j === holes.length - 1 ? h.r * scale : h.r).toFixed(1)}px, #000 ${((j === holes.length - 1 ? h.r * scale : h.r) + 0.8).toFixed(1)}px)`).join(',');
        card.style.maskImage = m;
        card.style.webkitMaskImage = m;
        card.style.maskComposite = 'intersect';
        (card.style as unknown as Record<string, string>).webkitMaskComposite = 'source-in';
      };
      set(0.5);
      at(40, () => set(1));
      // A wet, torn rim round the hole.
      const rim = overlay(card, `background: radial-gradient(circle at ${hx.toFixed(1)}px ${hy.toFixed(1)}px, transparent ${hr.toFixed(1)}px, rgba(14,52,96,.75) ${(hr + 0.5).toFixed(1)}px, rgba(47,167,214,.45) ${(hr + 1.8).toFixed(1)}px, transparent ${(hr + 3.4).toFixed(1)}px);`);
      rim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'forwards' });
      // Water bursts out the far side.
      const x = r.left + hx;
      const y = r.top + hy;
      spawn([
        { shape: 'flash', x, y, size: 12, max: 8, alpha: 0.9, color: '#e8fbff', glow: 'hot' },
        ...many(7, (j) => {
          const a = th + rand(-0.6, 0.6);
          const v = rand(2.5, 5);
          return { shape: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.2, max: rand(16, 26), size: rand(1.2, 2.2), color: pick(WATER, j), light: false };
        }),
      ]);
    });
  }
  // Soaked: it sags a little.
  card.animate([{ transform: 'none' }, { transform: `translate(${Math.cos(th) * 3}px, ${Math.sin(th) * 3}px) rotate(${rand(-4, 4)}deg)` }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
}

// ── Earth ────────────────────────────────────────────────────────────────────────────────────

export function earthAttack(win: HTMLElement, losers: HTMLElement[], shake: (px: number) => void): void {
  const w = center(win);
  // The slam at the winner: a heavy ring on the felt and a low dust cloud.
  spawn([
    { shape: 'ring', x: w.x, y: w.y + 14, size: 10, grow: 3.6, max: 16, color: EARTH[1]!, wobble: 6, squash: 0.35, light: false },
    ...many(6, (i) => ({ shape: 'puff', x: w.x + (i % 2 ? 1 : -1) * rand(18, 26), y: w.y + 22, vx: (i % 2 ? 1 : -1) * rand(1, 2.4), drag: 0.94, max: rand(26, 34), size: rand(3.5, 6), grow: 0.35, alpha: 0.3, color: pick([EARTH[1]!, EARTH[2]!], i) })),
  ]);
  shake(3);
  // Boulders lobbed at each loser.
  const N = 16;
  const g = 0.45;
  losers.forEach((l, k) => {
    const t = center(l);
    const throwAt = (size: number, delay: number, spread: number): Spec => {
      const dx = t.x + rand(-spread, spread) - w.x;
      const dy = t.y + rand(-spread, spread) - w.y;
      return { shape: 'square', x: w.x, y: w.y, vx: dx / N, vy: (dy - (g * N * (N + 1)) / 2) / N, gravity: g, max: N, delay, size, color: pick(EARTH, k + delay), vrot: rand(-0.25, 0.25) };
    };
    spawn([throwAt(11, k * 2, 0), throwAt(6, k * 2 + 2, 8), throwAt(4.5, k * 2 + 3, 10)]);
    at((N + k * 2) * F, () => {
      topple(l, Math.atan2(t.y - w.y, t.x - w.x));
      shake(4);
    });
  });
}

function topple(card: HTMLElement, th: number): void {
  const c = center(card);
  spawn([
    ...many(10, (i) => {
      const a = th + rand(-1, 1);
      const v = rand(2, 5);
      return { shape: 'square', x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, gravity: 0.4, max: rand(20, 30), size: rand(2, 4), color: pick(EARTH, i), vrot: rand(-0.4, 0.4) };
    }),
    ...many(4, (i) => ({ shape: 'puff', x: c.x + (i % 2 ? 1 : -1) * rand(22, 30), y: c.y + rand(10, 30), vx: (i % 2 ? 1 : -1) * rand(0.6, 1.2), vy: rand(-0.6, 0), drag: 0.94, max: rand(22, 30), size: rand(3, 4.5), grow: 0.3, alpha: 0.22, color: EARTH[2]! })),
  ]);
  // Knocked back along the hit, then it drops off the table, spinning, faster and faster.
  const spin = (Math.cos(th) >= 0 ? 1 : -1) * rand(60, 95);
  const kx = Math.cos(th) * 12;
  const ky = Math.sin(th) * 12;
  card.style.zIndex = '3';
  card.animate(
    [
      { transform: 'perspective(400px) translate(0,0) rotate(0deg) rotateX(0deg)', opacity: 1, filter: 'brightness(1)' },
      { transform: `perspective(400px) translate(${kx}px, ${ky - 6}px) rotate(${spin * 0.12}deg) rotateX(8deg)`, opacity: 1, filter: 'brightness(0.85)', offset: 0.14, easing: 'cubic-bezier(.5,0,.75,0)' },
      { transform: `perspective(400px) translate(${kx * 2.2}px, 240px) rotate(${spin}deg) rotateX(55deg) scale(0.8)`, opacity: 0.0, filter: 'brightness(0.55)' },
    ],
    { duration: 760, fill: 'forwards' },
  );
}
