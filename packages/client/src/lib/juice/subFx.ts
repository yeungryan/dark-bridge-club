import { at, center, F, fx, many, overlay, pick, ragged, rand, svgUrl, T, toward, type Pt } from './cardFx';
import { elementStrike } from './particles';

// Ryan's picks (round 8): Lightning A (chain), Sound A (sonic boom), Ice B (shards), Metal A
// (blade storm). Batch 1: Fire Ignite → burnt, Air Wind slash → sliced, Water Splash crown →
// pierced, Earth Boulder slam → holed. Friendly fire is fine.
//
// Ryan's round 8, batch 2: the sub-elements (a set won by trumping a different suit). Like
// batch 1, the winner attacks the three losing cards (friendly fire included), which stay on the
// table wrecked, and it's all over in 0.80 s (timed here for 1.0 s, played at K = 0.8 by the
// helpers). Lightning is blue now (Ryan). Effects lab only (fxlab.html?set=lightning, …).

export interface Ctx {
  /** A layer under the cards (for things on the felt). */
  under: HTMLElement;
  shake: (px: number) => void;
}
type Attack = (win: HTMLElement, losers: HTMLElement[], ctx: Ctx) => void;

const BOLT = ['#eaf6ff', '#9fd6ff', '#4aa3ff', '#6f8bff'];
const SOUND = ['#fff6cf', '#f4d27a', '#ffffff'];
const ICE = ['#e8fbff', '#a8e6ff', '#6cc7f0'];
const METAL = ['#f2f4f7', '#c3c9d2', '#8a929e', '#ffcf8a'];

const angle = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x);

/** A jagged line from a to b. */
function zigzag(a: Pt, b: Pt, segments: number, jitter: number): Pt[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const j = i === 0 || i === segments ? 0 : rand(-jitter, jitter);
    const n = angle(a, b) + Math.PI / 2;
    return { x: a.x + (b.x - a.x) * t + Math.cos(n) * j, y: a.y + (b.y - a.y) * t + Math.sin(n) * j };
  });
}
function bolt(a: Pt, b: Pt, opts: { size?: number; max?: number; delay?: number; color?: string; branches?: number } = {}): void {
  const pts = zigzag(a, b, 8, 9);
  fx([{ shape: 'bolt', x: b.x, y: b.y, points: pts, max: opts.max ?? 12, delay: opts.delay ?? 0, size: opts.size ?? 2.6, color: opts.color ?? BOLT[2]! }]);
  for (let k = 0; k < (opts.branches ?? 2); k++) {
    const from = pts[2 + Math.floor(rand(0, 5))]!;
    const th = angle(a, b) + rand(-1, 1);
    const len = rand(14, 28);
    fx([{ shape: 'bolt', x: from.x, y: from.y, points: zigzag(from, { x: from.x + Math.cos(th) * len, y: from.y + Math.sin(th) * len }, 3, 5), max: (opts.max ?? 12) * 0.7, delay: opts.delay ?? 0, size: 1.2, color: BOLT[1]! }]);
  }
}

/** A quick shove along `th` that settles a little back, with a twist. */
function jolt(card: HTMLElement, th: number, px = 5, end: string = ''): void {
  card.animate(
    [
      { transform: 'none' },
      { transform: `translate(${Math.cos(th) * px}px, ${Math.sin(th) * px}px) rotate(${rand(-6, 6)}deg)`, offset: 0.35 },
      { transform: end || `translate(${Math.cos(th) * px * 0.6}px, ${Math.sin(th) * px * 0.6}px) rotate(${rand(-4, 4)}deg)` },
    ],
    T({ duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }),
  );
}

/** Lines branching out from (x, y) like a lightning scar (a Lichtenberg figure), as an SVG path. */
function scar(x: number, y: number, n: number, len: number): string {
  let d = '';
  const grow = (px: number, py: number, a: number, l: number, depth: number) => {
    let cx = px;
    let cy = py;
    d += `M${cx.toFixed(1)} ${cy.toFixed(1)}`;
    for (let k = 0; k < 3; k++) {
      cx += Math.cos(a + rand(-0.6, 0.6)) * (l / 3);
      cy += Math.sin(a + rand(-0.6, 0.6)) * (l / 3);
      d += `L${cx.toFixed(1)} ${cy.toFixed(1)}`;
      if (depth < 2 && Math.random() < 0.5) grow(cx, cy, a + rand(-1, 1), l * 0.55, depth + 1);
    }
  };
  for (let i = 0; i < n; i++) grow(x, y, (i / n) * Math.PI * 2 + rand(-0.3, 0.3), len, 0);
  return d;
}
const svg = (w: number, h: number, body: string) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`);
const fade = (el: HTMLElement, ms = 160, delay = 0) => el.animate([{ opacity: 0 }, { opacity: 1 }], T({ duration: ms, delay, fill: 'both' }));
const local = (card: HTMLElement, p: Pt) => {
  const r = card.getBoundingClientRect();
  return { x: p.x - r.left, y: p.y - r.top, w: r.width, h: r.height };
};

// ── Lightning (blue) ─────────────────────────────────────────────────────────────────────────

/** A: one bolt jumps winner → loser → loser → loser; each is left with a burnt lightning scar. */
const chain: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 34, max: 10, alpha: 0.9, color: BOLT[1]!, glow: 'hot' }]);
  // Round the table from the winner: left, top, right.
  let from = w;
  losers.forEach((l, i) => {
    const to = center(l);
    const a = from;
    at(i * 120, () => {
      bolt(a, to, { size: 3, max: 14 });
      fx([
        { shape: 'flash', x: to.x, y: to.y, size: 30, max: 10, alpha: 1, color: BOLT[0]!, glow: 'hot' },
        ...many(10, (k) => {
          const th = rand(0, Math.PI * 2);
          return { shape: 'streak', x: to.x, y: to.y, vx: Math.cos(th) * rand(3, 6), vy: Math.sin(th) * rand(3, 6), drag: 0.86, max: rand(10, 16), size: 1.4, color: pick(BOLT, k), trailLen: 4 };
        }),
      ]);
      shake(3);
      const p = local(l, to);
      const hx = p.w / 2 + rand(-6, 6);
      const hy = p.h / 2 + rand(-10, 10);
      const scarEl = overlay(
        l,
        `background: ${svg(p.w, p.h, `<path d='${scar(hx, hy, 6, 26)}' fill='none' stroke='#1a1410' stroke-width='1.3' stroke-linecap='round' opacity='.85'/>`)} center/100% 100%, radial-gradient(circle at ${hx.toFixed(0)}px ${hy.toFixed(0)}px, rgba(20,14,10,.85) 0 4px, rgba(60,40,24,.45) 8px, transparent 16px);`,
      );
      const glow = overlay(l, `background: ${svg(p.w, p.h, `<path d='${scar(hx, hy, 6, 26)}' fill='none' stroke='#9fd6ff' stroke-width='2' stroke-linecap='round'/>`)} center/100% 100%; filter: drop-shadow(0 0 3px #4aa3ff);`);
      fade(scarEl, 80);
      glow.animate([{ opacity: 1 }, { opacity: 0 }], T({ duration: 420, fill: 'forwards' }));
      jolt(l, angle(a, to), 4);
    });
    from = to;
  });
};

/** B: the winner charges, then bolts from the sky strike all three at once; they're left fried. */
const thunder: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx(
    many(12, (i) => {
      const a = (i / 12) * Math.PI * 2;
      return { shape: 'streak', x: w.x + Math.cos(a) * 40, y: w.y + Math.sin(a) * 40, vx: -Math.cos(a) * 4.4, vy: -Math.sin(a) * 4.4, max: 9, size: 1.5, color: pick(BOLT, i), trailLen: 3 };
    }),
  );
  at(170, () => {
    fx([{ shape: 'flash', x: w.x, y: w.y, size: 40, max: 10, alpha: 1, color: BOLT[0]!, glow: 'hot' }]);
    shake(4);
    for (const l of losers) {
      const t = center(l);
      bolt({ x: t.x + rand(-30, 30), y: t.y - 170 }, t, { size: 3.6, max: 16, branches: 3 });
      fx([
        { shape: 'flash', x: t.x, y: t.y, size: 46, max: 12, alpha: 0.9, color: BOLT[1]! },
        ...many(6, (k) => ({ shape: 'puff', x: t.x + rand(-14, 14), y: t.y + rand(-20, 10), vx: rand(-0.3, 0.3), vy: rand(-1.4, -0.8), drag: 0.97, max: rand(26, 34), delay: 8 + k * 2, size: rand(4, 6), grow: 0.35, alpha: 0.28, color: '#9aa0a8', light: false })),
      ]);
      const box = l.getBoundingClientRect();
      // Overexposed white for an instant, then fried: grey, singed edges, crackle.
      l.animate(
        [
          { filter: 'brightness(1)', clipPath: ragged(box.width, box.height, 30, 0) },
          { filter: 'brightness(2.4) saturate(0)', offset: 0.12 },
          { filter: 'grayscale(0.8) brightness(0.62) contrast(1.15)', clipPath: ragged(box.width, box.height, 30, 2.5) },
        ],
        T({ duration: 520, fill: 'forwards' }),
      );
      const singe = overlay(l, `box-shadow: inset 0 0 10px 3px rgba(20,12,6,.85); background: ${svg(box.width, box.height, `<path d='${scar(box.width / 2, 6, 4, 30)}' fill='none' stroke='#120c08' stroke-width='1.1' opacity='.8'/>`)} center/100% 100%;`);
      fade(singe, 200, 60);
      l.animate(
        [0, 1, 2, 3, 4, 5].map((k) => ({ transform: `translate(${k % 2 ? 2 : -2}px, ${k % 3 ? 1 : -1}px)` })).concat([{ transform: `rotate(${rand(-4, 4)}deg)` }]),
        T({ duration: 300, fill: 'forwards', composite: 'replace' }),
      );
    }
  });
};

/** C: crackling arcs hold all three for a beat, the cards jitter, and they're left frazzled. */
const arcStorm: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 36, max: 30, alpha: 0.6, color: BOLT[2]! }]);
  for (let k = 0; k < 7; k++) {
    at(k * 60, () => {
      for (const l of losers) bolt(w, center(l), { size: rand(1.6, 2.6), max: 5, branches: 1, color: pick(BOLT, k + 1) });
    });
  }
  shake(2);
  for (const l of losers) {
    const box = l.getBoundingClientRect();
    l.animate(
      Array.from({ length: 12 }, (_, k) => ({ transform: `translate(${rand(-2.5, 2.5)}px, ${rand(-2.5, 2.5)}px)`, boxShadow: `0 0 ${k % 2 ? 10 : 4}px #4aa3ff` })).concat([{ transform: `rotate(${rand(-3, 3)}deg)`, boxShadow: '0 0 0 transparent' }]),
      T({ duration: 520, fill: 'forwards' }),
    );
    const crackle = overlay(
      l,
      `background: ${svg(box.width, box.height, `<path d='${scar(box.width / 2, box.height / 2, 5, 34)}' fill='none' stroke='#2a3550' stroke-width='1' opacity='.75'/>`)} center/100% 100%, radial-gradient(circle at 50% 50%, rgba(40,30,20,.5), transparent 60%);`,
    );
    fade(crackle, 300, 200);
    l.animate([{ filter: 'none' }, { filter: 'saturate(0.6) brightness(0.85)' }], T({ duration: 300, delay: 300, fill: 'both' }));
  }
};

// ── Sound ────────────────────────────────────────────────────────────────────────────────────

/** A: a sonic boom; the shockwave hits each card, it shudders and crumples like paper. */
const sonicBoom: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([
    { shape: 'flash', x: w.x, y: w.y, size: 30, max: 8, alpha: 0.9, color: '#ffffff', glow: 'hot' },
    ...many(3, (k) => ({ shape: 'ring', x: w.x, y: w.y, size: 10, grow: 9, max: 16, delay: k * 3, color: pick(SOUND, k + 1), wobble: 4 - k })),
  ]);
  shake(3);
  for (const l of losers) {
    const t = center(l);
    const d = Math.hypot(t.x - w.x, t.y - w.y);
    // The ring's front reaches it after d / 9 frames.
    at((d / 9) * F, () => {
      const box = l.getBoundingClientRect();
      const th = angle(w, t);
      l.animate(
        [
          { transform: 'none', clipPath: ragged(box.width, box.height, 30, 0) },
          { transform: `translate(${Math.cos(th) * 6}px, ${Math.sin(th) * 6}px) skewX(8deg)`, offset: 0.15 },
          { transform: 'skewX(-6deg) scale(0.97)', offset: 0.3 },
          { transform: 'skewX(4deg) scale(0.94)', offset: 0.45 },
          { transform: `translate(${Math.cos(th) * 4}px, ${Math.sin(th) * 4}px) rotate(${rand(-8, 8)}deg) scale(0.88, 0.84)`, clipPath: ragged(box.width, box.height, 30, 5) },
        ],
        T({ duration: 560, easing: 'ease-out', fill: 'forwards' }),
      );
      const creases = overlay(
        l,
        `background: repeating-linear-gradient(${rand(20, 70).toFixed(0)}deg, transparent 0 7px, rgba(0,0,0,.18) 7px 8px, rgba(255,255,255,.5) 8px 9px, transparent 9px 15px), repeating-linear-gradient(${rand(-70, -20).toFixed(0)}deg, transparent 0 9px, rgba(0,0,0,.14) 9px 10px, transparent 10px 18px), radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,.18));`,
      );
      fade(creases, 260, 160);
    });
  }
};

/** B: a piercing note; waves travel at each card, it buzzes, then cracks like glass. */
const shatterNote: Attack = (win, losers) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 24, max: 10, alpha: 0.9, color: SOUND[1]!, glow: 'hot' }]);
  for (const l of losers) {
    const t = center(l);
    const th = angle(w, t);
    const N = 12;
    const v = toward(w, t, N);
    fx(many(3, (k) => ({ shape: 'arc', x: w.x, y: w.y, ...v, size: 10, grow: 0.6, max: N, delay: k * 4, color: pick(SOUND, k + 1), wobble: 3, span: [th - 0.8, th + 0.8] })));
    at((N + 4) * F, () => {
      l.animate(
        Array.from({ length: 10 }, () => ({ transform: `translate(${rand(-1.6, 1.6)}px, ${rand(-1, 1)}px)` })).concat([{ transform: `rotate(${rand(-3, 3)}deg)` }]),
        T({ duration: 260, fill: 'forwards' }),
      );
      at(200, () => {
        const box = l.getBoundingClientRect();
        const cx = box.width * rand(0.35, 0.65);
        const cy = box.height * rand(0.35, 0.6);
        let d = '';
        const spokes = 8;
        const ends: Pt[] = [];
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2 + rand(-0.2, 0.2);
          const r = rand(28, 46);
          d += `M${cx} ${cy}L${(cx + Math.cos(a) * r * 0.5).toFixed(1)} ${(cy + Math.sin(a) * r * 0.5 + rand(-2, 2)).toFixed(1)}L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
          ends.push({ x: Math.cos(a), y: Math.sin(a) });
        }
        for (const rr of [9, 18]) d += 'M' + ends.map((e) => `${(cx + e.x * rr * rand(0.85, 1.15)).toFixed(1)} ${(cy + e.y * rr * rand(0.85, 1.15)).toFixed(1)}`).join('L') + 'Z';
        const crack = overlay(l, `background: ${svg(box.width, box.height, `<path d='${d}' fill='none' stroke='#5b6370' stroke-width='0.9' stroke-linejoin='round'/><path d='${d}' fill='none' stroke='#ffffff' stroke-width='0.6' transform='translate(0.8 0.8)' opacity='.8'/>`)} center/100% 100%;`);
        fade(crack, 60);
        fx([{ shape: 'flash', x: box.left + cx, y: box.top + cy, size: 10, max: 10, alpha: 1, color: '#ffffff', glow: 'star' }]);
      });
    });
  }
};

/** C: a bass drop; the table thumps, the cards jump twice and land askew, squashed flat. */
const bassDrop: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([
    { shape: 'ring', x: w.x, y: w.y + 16, size: 10, grow: 5, max: 14, color: SOUND[1]!, wobble: 5, squash: 0.35 },
    { shape: 'ring', x: w.x, y: w.y + 16, size: 10, grow: 5, max: 14, delay: 14, color: SOUND[1]!, wobble: 5, squash: 0.35 },
  ]);
  shake(4);
  at(230, () => shake(4));
  for (const l of losers) {
    const t = center(l);
    const th = angle(w, t);
    const ox = Math.cos(th) * 7;
    const oy = Math.sin(th) * 7;
    l.animate(
      [
        { transform: 'none' },
        { transform: 'translateY(-12px) scale(1.04)', offset: 0.14 },
        { transform: 'translateY(0) scale(1.06, 0.88)', offset: 0.3 },
        { transform: `translate(${ox * 0.6}px, ${oy * 0.6 - 8}px) rotate(${rand(-6, 6)}deg)`, offset: 0.48 },
        { transform: `translate(${ox}px, ${oy}px) scale(1.08, 0.86) rotate(${rand(-9, 9)}deg)`, offset: 0.66 },
        { transform: `translate(${ox}px, ${oy}px) scale(1.05, 0.9) rotate(${rand(-9, 9)}deg)` },
      ],
      T({ duration: 620, easing: 'ease-in-out', fill: 'forwards' }),
    );
    for (const k of [0, 14]) fx([{ shape: 'ring', x: t.x, y: t.y + 30, size: 8, grow: 2.8, max: 12, delay: 10 + k, color: SOUND[0]!, wobble: 3, squash: 0.3 }]);
    const dent = overlay(l, 'background: radial-gradient(ellipse 70% 40% at 50% 55%, rgba(0,0,0,.18), transparent 70%), linear-gradient(180deg, rgba(0,0,0,.12), transparent 30%, transparent 70%, rgba(0,0,0,.16));');
    fade(dent, 200, 400);
  }
};

// ── Ice ──────────────────────────────────────────────────────────────────────────────────────

const frostBg = `radial-gradient(circle at 30% 25%, rgba(255,255,255,.75), transparent 30%), repeating-conic-gradient(from 10deg at 50% 50%, rgba(232,251,255,.55) 0 6deg, rgba(168,230,255,.25) 6deg 14deg), linear-gradient(160deg, rgba(232,251,255,.65), rgba(108,199,240,.45))`;

/** A: a freezing beam; frost spreads over each card and seals it in a block of ice. */
const deepFreeze: Attack = (win, losers) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 30, max: 10, alpha: 0.9, color: ICE[0]!, glow: 'hot' }]);
  for (const l of losers) {
    const t = center(l);
    const N = 10;
    const v = toward(w, t, N);
    fx([
      ...many(14, (i) => ({ shape: 'streak', x: w.x, y: w.y, ...v, max: N, delay: i * 0.6, size: 1.6, color: pick(ICE, i), trailLen: 6 })),
      ...many(8, (i) => ({ shape: 'flash', x: w.x, y: w.y, ...v, max: N, delay: i, size: 5, alpha: 0.9, color: '#ffffff', glow: 'star' })),
    ]);
    at(N * F, () => {
      const p = local(l, t);
      const hx = Math.max(10, Math.min(90, 50 + ((w.x - t.x) / p.w) * 60));
      const hy = Math.max(10, Math.min(90, 50 + ((w.y - t.y) / p.h) * 60));
      const frost = overlay(l, `background: ${frostBg}; mix-blend-mode: normal;`);
      frost.animate([{ clipPath: `circle(0% at ${hx}% ${hy}%)` }, { clipPath: `circle(150% at ${hx}% ${hy}%)` }], T({ duration: 360, easing: 'ease-out', fill: 'both' }));
      // Sealed in ice: a glassy rim and shine, and icicles hanging off the bottom edge.
      l.animate([{ boxShadow: '0 0 0 0 transparent', filter: 'none' }, { boxShadow: '0 0 0 2px rgba(168,230,255,.9), 0 0 10px rgba(108,199,240,.7)', filter: 'saturate(0.5) brightness(1.05) hue-rotate(-10deg)' }], T({ duration: 300, delay: 260, fill: 'both' }));
      const icicles = Array.from({ length: 6 }, (_, i) => {
        const x = (p.w / 6) * (i + 0.5) + rand(-2, 2);
        const len = rand(4, 9);
        return `M${(x - 2.2).toFixed(1)} ${p.h - 1}L${x.toFixed(1)} ${(p.h - 1 + len).toFixed(1)}L${(x + 2.2).toFixed(1)} ${p.h - 1}Z`;
      }).join('');
      const ice = overlay(l, `inset: 0 0 -10px 0; background: ${svg(p.w, p.h + 10, `<path d='${icicles}' fill='#cfefff' stroke='#8fd3f5' stroke-width='.6'/>`)} top/100% 100% no-repeat, linear-gradient(135deg, transparent 30%, rgba(255,255,255,.55) 38%, transparent 46%) top/100% calc(100% - 10px) no-repeat;`);
      fade(ice, 200, 380);
    });
  }
};

/** B: ice shards fly and stick fast in each card, frost blooming round where they went in. */
const iceShards: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 30, max: 10, alpha: 0.9, color: ICE[1]!, glow: 'hot' }]);
  losers.forEach((l, li) => {
    const t = center(l);
    for (let k = 0; k < 3; k++) {
      const th0 = angle(w, t);
      // Aim past the middle, so each shard lands well inside the card.
      const aim = { x: t.x + Math.cos(th0) * 6 + rand(-8, 8), y: t.y + Math.sin(th0) * 8 + rand(-14, 14) };
      const th = angle(w, aim);
      const N = 10;
      const v = toward(w, aim, N);
      const delay = k * 3 + li;
      // In flight: a bigger crystal with a cold trail behind it.
      fx([
        { shape: 'shard', x: w.x, y: w.y, ...v, max: N, delay, size: 8, color: pick(ICE, k), rot: th + Math.PI / 2 },
        { shape: 'streak', x: w.x, y: w.y, ...v, max: N, delay, size: 1.6, color: ICE[1]!, trailLen: 6 },
      ]);
      at((N + delay) * F, () => {
        const p = local(l, aim);
        // The shard stuck in the card: its point buried past the hit, pointing the way it flew,
        // its base trailing back toward the winner. A faceted crystal (light face over dark).
        const s = document.createElement('div');
        const len = 26;
        const ht = 9;
        s.style.cssText = `position:absolute;left:${(p.x + Math.cos(th) * len * 0.45).toFixed(1)}px;top:${(p.y + Math.sin(th) * len * 0.45 - ht / 2).toFixed(1)}px;width:${len}px;height:${ht}px;transform-origin:0 50%;transform:rotate(${th + Math.PI}rad);background:linear-gradient(180deg,#ffffff 0 30%,#cdeeff 30% 50%,#7fcaf0 50% 78%,#4fa9dc 78%);clip-path:polygon(0 50%,30% 0,100% 38%,100% 62%,30% 100%);filter:drop-shadow(0 1.5px 1px rgba(0,40,80,.55));pointer-events:none;z-index:2;`;
        l.appendChild(s);
        s.animate([{ opacity: 0, transform: `rotate(${th + Math.PI}rad) translateX(6px)` }, { opacity: 1, transform: `rotate(${th + Math.PI}rad)` }], T({ duration: 50, fill: 'both' }));
        // Frost where it went in: short crystal spikes and a cold bloom, not a glow.
        const spikes = Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + rand(-0.2, 0.2);
          const r1 = 3;
          const r2 = rand(7, 12);
          return `M${(p.x + Math.cos(a) * r1).toFixed(1)} ${(p.y + Math.sin(a) * r1).toFixed(1)}L${(p.x + Math.cos(a) * r2).toFixed(1)} ${(p.y + Math.sin(a) * r2).toFixed(1)}`;
        }).join('');
        const frost = overlay(
          l,
          `background: ${svg(p.w, p.h, `<path d='${spikes}' stroke='#ffffff' stroke-width='1.2' stroke-linecap='round'/><path d='${spikes}' stroke='#6cc7f0' stroke-width='.6' transform='translate(.6 .6)'/>`)} center/100% 100%, radial-gradient(circle at ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, rgba(168,230,255,.55) 0 5px, rgba(168,230,255,.18) 10px, transparent 14px);`,
        );
        fade(frost, 120);
        fx(many(3, (j) => ({ shape: 'flash', x: t.x + p.x - p.w / 2 + rand(-8, 8), y: t.y + p.y - p.h / 2 + rand(-8, 8), max: rand(8, 12), size: rand(3, 5), alpha: 1, color: '#ffffff', glow: 'star', delay: j * 2 })));
        if (k === 2) {
          jolt(l, th, 4);
          shake(2);
          l.animate([{ filter: 'none' }, { filter: 'saturate(0.7) brightness(1.03) hue-rotate(-8deg)' }], T({ duration: 240, fill: 'forwards' }));
        }
      });
    }
  });
};

/** C: each card freezes solid in a blink, then shatters into pieces that stay where they fall. */
const iceShatter: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([
    { shape: 'flash', x: w.x, y: w.y, size: 34, max: 10, alpha: 0.9, color: ICE[0]!, glow: 'hot' },
    { shape: 'ring', x: w.x, y: w.y, size: 10, grow: 8, max: 14, color: ICE[1]!, wobble: 3 },
  ]);
  for (const l of losers) {
    const t = center(l);
    const d = Math.hypot(t.x - w.x, t.y - w.y);
    at((d / 8) * F, () => {
      const frost = overlay(l, `background: ${frostBg}; opacity: 0;`);
      fade(frost, 100);
      at(170, () => {
        shake(3);
        const box = l.getBoundingClientRect();
        const W = box.width;
        const H = box.height;
        // A rough grid of shards, each a little cell of the card, nudged apart.
        const cx = W * rand(0.4, 0.6);
        const cy = H * rand(0.4, 0.6);
        const rim = Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 + rand(-0.2, 0.2);
          const r = 200;
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a };
        });
        rim.forEach((p, i) => {
          const q = rim[(i + 1) % rim.length]!;
          const mid = (p.a + (q.a < p.a ? q.a + Math.PI * 2 : q.a)) / 2;
          const piece = l.cloneNode(true) as HTMLElement;
          piece.querySelectorAll('div[style*="absolute"]').forEach((e) => (e as HTMLElement).remove());
          piece.style.cssText += `position:absolute;left:${l.offsetLeft}px;top:${l.offsetTop}px;margin:0;clip-path:polygon(${cx}px ${cy}px, ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, ${q.x.toFixed(0)}px ${q.y.toFixed(0)}px);`;
          const fr = overlay(piece, `background: ${frostBg};`);
          fr.style.opacity = '0.9';
          l.parentElement!.appendChild(piece);
          const push = rand(3, 6);
          piece.animate(
            [{ transform: 'none' }, { transform: `translate(${(Math.cos(mid) * push).toFixed(1)}px, ${(Math.sin(mid) * push).toFixed(1)}px) rotate(${rand(-6, 6)}deg)` }],
            T({ duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }),
          );
        });
        l.style.visibility = 'hidden';
        fx([
          { shape: 'flash', x: t.x, y: t.y, size: 30, max: 8, alpha: 1, color: '#ffffff', glow: 'hot' },
          ...many(10, (j) => {
            const a = rand(0, Math.PI * 2);
            return { shape: 'shard', x: t.x, y: t.y, vx: Math.cos(a) * rand(2, 4), vy: Math.sin(a) * rand(2, 4), drag: 0.85, max: rand(14, 20), size: rand(2.5, 4), color: pick(ICE, j), rot: a + Math.PI / 2 };
          }),
        ]);
      });
    });
  }
};

// ── Metal ────────────────────────────────────────────────────────────────────────────────────

/** A: spinning blades fly at each card, slash it twice, and the last one sticks in. */
const bladeStorm: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([{ shape: 'ring', x: w.x, y: w.y, size: 8, grow: 4, max: 12, color: '#ffffff', wobble: 3 }]);
  losers.forEach((l, li) => {
    const t = center(l);
    for (let k = 0; k < 3; k++) {
      const aim = { x: t.x + rand(-10, 10), y: t.y + rand(-14, 14) };
      const N = 11;
      const delay = k * 5 + li * 2;
      const v = toward(w, aim, N);
      fx([{ shape: 'shard', x: w.x, y: w.y, ...v, max: N, delay, size: 6, color: pick(METAL, k), vrot: 0.9 }]);
      at((N + delay) * F, () => {
        const p = local(l, aim);
        const th = angle(w, aim);
        fx(many(8, (j) => {
          const a = th + Math.PI + rand(-1, 1);
          return { shape: 'streak', x: aim.x, y: aim.y, vx: Math.cos(a) * rand(3, 6), vy: Math.sin(a) * rand(3, 6), gravity: 0.25, drag: 0.9, max: rand(10, 16), size: 1.3, color: pick(['#ffcf8a', '#ffffff', '#ffb347'], j), trailLen: 4 };
        }));
        if (k < 2) {
          // A slash: a dark cut with a bright edge, across the card.
          const a = th + Math.PI / 2 + rand(-0.4, 0.4);
          const L = 26;
          const d = `M${(p.x - Math.cos(a) * L).toFixed(1)} ${(p.y - Math.sin(a) * L).toFixed(1)}L${(p.x + Math.cos(a) * L).toFixed(1)} ${(p.y + Math.sin(a) * L).toFixed(1)}`;
          fade(overlay(l, `background: ${svg(p.w, p.h, `<path d='${d}' stroke='#3a3f47' stroke-width='2.2' stroke-linecap='round'/><path d='${d}' stroke='#ffffff' stroke-width='.7' transform='translate(.9 .9)'/>`)} center/100% 100%;`), 40);
        } else {
          const s = document.createElement('div');
          s.style.cssText = `position:absolute;left:${(p.x - 9).toFixed(1)}px;top:${(p.y - 9).toFixed(1)}px;width:18px;height:18px;transform:rotate(${(th * 180) / Math.PI + 45}deg);background:conic-gradient(from 0deg,#f2f4f7,#8a929e,#c3c9d2,#f2f4f7,#8a929e,#c3c9d2,#f2f4f7);clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);filter:drop-shadow(0 1px 1px rgba(0,0,0,.6));z-index:2;pointer-events:none;`;
          l.appendChild(s);
          s.animate([{ transform: `rotate(${(th * 180) / Math.PI}deg) scale(1.4)` }, { transform: `rotate(${(th * 180) / Math.PI + 45}deg) scale(1)` }], T({ duration: 120, fill: 'both' }));
          jolt(l, th, 5);
          shake(2);
        }
      });
    }
  });
};

/** B: a rivet gun; bolts hammer into each card, pinning it with dented rivets. */
const rivets: Attack = (win, losers, { shake }) => {
  const w = center(win);
  for (let k = 0; k < 4; k++) {
    losers.forEach((l, li) => {
      const t = center(l);
      const box = l.getBoundingClientRect();
      const spot = { x: (k % 2 ? 0.75 : 0.25) * box.width, y: (k < 2 ? 0.22 : 0.78) * box.height };
      const aim = { x: box.left + spot.x, y: box.top + spot.y };
      const N = 7;
      const delay = k * 6 + li;
      fx([
        { shape: 'streak', x: w.x, y: w.y, ...toward(w, aim, N), max: N, delay, size: 2.2, color: METAL[1]!, trailLen: 6 },
        { shape: 'flash', x: w.x, y: w.y, max: 6, delay, size: 12, alpha: 0.8, color: '#ffcf8a', glow: 'hot' },
      ]);
      at((N + delay) * F, () => {
        fx([
          { shape: 'flash', x: aim.x, y: aim.y, size: 12, max: 8, alpha: 1, color: '#ffcf8a', glow: 'hot' },
          ...many(5, (j) => {
            const a = rand(0, Math.PI * 2);
            return { shape: 'streak', x: aim.x, y: aim.y, vx: Math.cos(a) * rand(2, 4), vy: Math.sin(a) * rand(2, 4) - 1, gravity: 0.2, max: rand(8, 12), size: 1.1, color: pick(['#ffcf8a', '#ffffff'], j), trailLen: 3 };
          }),
        ]);
        const r = overlay(l, `background: radial-gradient(circle at ${spot.x.toFixed(0)}px ${spot.y.toFixed(0)}px, #f2f4f7 0 1.2px, #9aa2ad 2.4px, #5a616b 3.8px, rgba(0,0,0,.35) 4.6px, rgba(0,0,0,.12) 7px, transparent 9px);`);
        fade(r, 30);
        l.animate([{ transform: `translate(0,0)` }, { transform: `translate(${rand(-1.5, 1.5)}px, 1.5px)` }, { transform: 'translate(0,0)' }], T({ duration: 80 }));
        if (k === 3 && li === 0) shake(2);
      });
    });
  }
  for (const l of losers) l.animate([{ filter: 'none' }, { filter: 'contrast(1.05) brightness(0.92)' }], T({ duration: 300, delay: 400, fill: 'both' }));
};

/** C: steel slabs slam down on each card, sparks spray, and it's left flattened and stamped. */
const anvil: Attack = (win, losers, { shake }) => {
  const w = center(win);
  fx([{ shape: 'flash', x: w.x, y: w.y, size: 30, max: 10, alpha: 0.8, color: '#ffcf8a', glow: 'hot' }]);
  losers.forEach((l, li) => {
    const t = center(l);
    const N = 12;
    const delay = li * 3;
    fx([{ shape: 'square', x: t.x, y: t.y - 150, vy: 150 / N - (0.4 * (N + 1)) / 2, gravity: 0.4, max: N, delay, size: 30, color: '#6f7782' }]);
    at((N + delay) * F, () => {
      shake(4);
      fx([
        { shape: 'flash', x: t.x, y: t.y, size: 40, max: 10, alpha: 0.9, color: '#ffcf8a', glow: 'hot' },
        ...many(14, (j) => {
          const a = (j % 2 ? 0 : Math.PI) + rand(-0.5, 0.3) * (j % 2 ? 1 : -1);
          return { shape: 'streak', x: t.x + (j % 2 ? 14 : -14), y: t.y + rand(-10, 20), vx: Math.cos(a) * rand(3, 6), vy: -rand(1, 3), gravity: 0.3, drag: 0.94, max: rand(14, 22), size: 1.4, color: pick(['#ffcf8a', '#ffb347', '#ffffff'], j), trailLen: 5 };
        }),
      ]);
      const box = l.getBoundingClientRect();
      l.animate(
        [
          { transform: 'none', clipPath: ragged(box.width, box.height, 30, 0) },
          { transform: 'scale(1.14, 0.7)', offset: 0.3 },
          { transform: `scale(1.08, 0.8) rotate(${rand(-4, 4)}deg)`, clipPath: ragged(box.width, box.height, 30, 2.5) },
        ],
        T({ duration: 300, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }),
      );
      const stamp = overlay(l, 'background: linear-gradient(180deg, rgba(60,66,74,.15), rgba(60,66,74,.45) 50%, rgba(60,66,74,.15)), repeating-linear-gradient(90deg, transparent 0 5px, rgba(0,0,0,.1) 5px 6px); box-shadow: inset 0 0 0 2px rgba(60,66,74,.5);');
      fade(stamp, 80);
    });
  });
};

// ── Now (as it plays today, on the winning card) and the options ──────────────────────────────

const now =
  (el: 'fire' | 'air' | 'water' | 'earth'): Attack =>
  (win) => {
    const w = center(win);
    elementStrike(el, w.x, w.y);
  };

export const SUB_SETS: Record<string, { title: string; options: { label: string; name: string; note: string; play: Attack }[] }> = {
  lightning: {
    title: 'Lightning (fire, trump set) · blue',
    options: [
      { label: 'Now', name: 'Lightning (yellow)', note: 'Bolts strike the winning card', play: now('fire') },
      { label: 'A', name: 'Chain lightning', note: 'One bolt jumps card to card; each is left with a burnt lightning scar', play: chain },
      { label: 'B', name: 'Thunderstrike', note: 'Bolts from the sky hit all three at once; they end fried grey', play: thunder },
      { label: 'C', name: 'Arc storm', note: 'Crackling arcs hold all three; they jitter and end frazzled', play: arcStorm },
    ],
  },
  sound: {
    title: 'Sound (air, trump set)',
    options: [
      { label: 'Now', name: 'Sound', note: 'Sound waves from the winning card', play: now('air') },
      { label: 'A', name: 'Sonic boom', note: 'The shockwave hits; cards shudder and crumple like paper', play: sonicBoom },
      { label: 'B', name: 'Shatter note', note: 'A piercing note; cards buzz, then crack like glass', play: shatterNote },
      { label: 'C', name: 'Bass drop', note: 'The table thumps; cards jump twice and land squashed', play: bassDrop },
    ],
  },
  ice: {
    title: 'Ice (water, trump set)',
    options: [
      { label: 'Now', name: 'Ice', note: 'Ice shards burst from the winning card', play: now('water') },
      { label: 'A', name: 'Deep freeze', note: 'Frost spreads over each card and seals it in ice', play: deepFreeze },
      { label: 'B', name: 'Ice shards', note: 'Shards fly and stick fast in each card', play: iceShards },
      { label: 'C', name: 'Shatter', note: 'Each card freezes solid, then shatters where it lies', play: iceShatter },
    ],
  },
  metal: {
    title: 'Metal (earth, trump set)',
    options: [
      { label: 'Now', name: 'Metal', note: 'Clang rings and sparks on the winning card', play: now('earth') },
      { label: 'A', name: 'Blade storm', note: 'Spinning blades slash each card; one sticks in', play: bladeStorm },
      { label: 'B', name: 'Rivet gun', note: 'Bolts hammer into each card, pinning it with rivets', play: rivets },
      { label: 'C', name: 'Anvil', note: 'Steel slabs slam down; cards end flattened and stamped', play: anvil },
    ],
  },
};
