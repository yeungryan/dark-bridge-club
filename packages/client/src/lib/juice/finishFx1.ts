import { at, center, F, fx, many, overlay, pick, ragged, rand, T, type Pt } from './cardFx';
import { finale, type Finish } from './finishFx';
import { sound } from './sound';

// Batch 1 finishers (fire, air, water, earth): the game-winning set wipes the wrecked losing
// cards off the table, each element its own way, and the finale lands at the climax. Timed for
// 1.0 s, played at K = 0.8 (see finishFx.ts).

const FIRE = ['#ffb347', '#ff7a2f', '#e8402a', '#ffd27a'];
const ASH = ['#3a3430', '#5a524c', '#7d746c', '#2a2420'];
const WATER = ['#5fd6d0', '#2fa7d6', '#1b6fb8', '#bff0ff'];
const EARTH = ['#8a9a4b', '#7a5a36', '#a37b4c', '#5b6e33'];

const angle = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x);

/** A mark left on the felt where a card was (in the layer under the cards). */
function feltMark(under: HTMLElement, card: HTMLElement, style: string): HTMLElement {
  const u = under.getBoundingClientRect();
  const r = card.getBoundingClientRect();
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:${r.left - u.left - 6}px;top:${r.top - u.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px;border-radius:50%;pointer-events:none;${style}`;
  under.appendChild(el);
  return el;
}

/** Fire: the char flares up once more, and each card crumbles to ash that blows away. */
const fire: Finish = (win, losers, ctx) => {
  const w = center(win);
  sound.fireCrumble();
  losers.forEach((l, k) => {
    const c = center(l);
    const th = angle(w, c);
    at(k * 60, () => {
      // The embers in the char flare orange again from the edges in.
      const flare = overlay(l, 'box-shadow: inset 0 0 8px 3px rgba(255,122,47,.9), inset 0 0 2px 1px #ffd27a; opacity: 0;');
      flare.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.6 }], T({ duration: 420, fill: 'forwards' }));
      const box = l.getBoundingClientRect();
      // It crumbles: the edges eat inward, it shrinks and it's gone.
      l.animate(
        [
          { clipPath: ragged(box.width, box.height, 36, 6), transform: 'scale(0.95) rotate(-3deg)', opacity: 1 },
          { clipPath: ragged(box.width, box.height, 36, 12), transform: 'scale(0.8) rotate(-6deg)', opacity: 1, offset: 0.5 },
          { clipPath: ragged(box.width, box.height, 36, 26), transform: `translate(${Math.cos(th) * 10}px, -16px) scale(0.35) rotate(-14deg)`, opacity: 0 },
        ],
        T({ duration: 620, delay: 80, easing: 'ease-in', fill: 'forwards' }),
      );
      // Ash flakes and embers lift off and blow away from the winner.
      fx([
        ...many(22, (i) => ({
          shape: 'square',
          x: c.x + rand(-22, 22),
          y: c.y + rand(-30, 30),
          vx: Math.cos(th) * rand(0.6, 1.6) + rand(-0.4, 0.4),
          vy: rand(-2.2, -0.8),
          gravity: -0.015,
          drag: 0.98,
          max: rand(26, 40),
          delay: 6 + i * 0.9,
          size: rand(2, 4),
          color: pick(ASH, i),
          vrot: rand(-0.3, 0.3),
        })),
        ...many(10, (i) => ({ shape: 'dot', x: c.x + rand(-18, 18), y: c.y + rand(-24, 24), vx: Math.cos(th) * 0.8 + rand(-0.5, 0.5), vy: rand(-2.6, -1.4), gravity: -0.03, max: rand(20, 30), delay: 4 + i * 1.5, size: rand(1.2, 2.2), color: pick(FIRE, i), wobble: 1 })),
      ]);
      // A scorch mark is left on the felt.
      const scorch = feltMark(ctx.under, l, 'background: radial-gradient(ellipse at 50% 50%, rgba(10,6,4,.42), rgba(30,18,8,.18) 45%, transparent 68%);');
      scorch.animate([{ opacity: 0 }, { opacity: 1 }], T({ duration: 300, delay: 200, fill: 'both' }));
    });
  });
  at(560, () => finale(win, ctx));
};

/** Air: a last gust blasts the parted halves off the table, spinning away. */
const air: Finish = (win, losers, ctx) => {
  const w = center(win);
  sound.airBlast();
  fx(
    many(18, (i) => {
      const a = rand(0, Math.PI * 2);
      return { shape: 'streak', x: w.x + Math.cos(a) * 10, y: w.y + Math.sin(a) * 10, vx: Math.cos(a) * rand(7, 10), vy: Math.sin(a) * rand(7, 10), drag: 0.93, max: rand(16, 24), size: 1.6, color: pick(['#fff6cf', '#fffdf2', '#f4e7a1'], i), trailLen: 7 };
    }),
  );
  for (const l of losers) {
    const pieces = [...(l.parentElement?.querySelectorAll<HTMLElement>('[data-piece]') ?? [])];
    const c = center(l);
    const th = angle(w, c);
    const d = Math.hypot(c.x - w.x, c.y - w.y);
    // The gust reaches each card a moment after it leaves the winner.
    at(d * 0.9, () => {
      pieces.forEach((p, k) => {
        const spread = (k ? 1 : -1) * rand(0.25, 0.5);
        const a = th + spread;
        const go = rand(150, 190);
        const spin = (k ? 1 : -1) * rand(200, 320);
        const from = getComputedStyle(p).transform;
        p.animate(
          [
            { transform: from === 'none' ? 'none' : from, opacity: 1 },
            { transform: `translate(${Math.cos(a) * go}px, ${Math.sin(a) * go}px) rotate(${spin}deg) scale(0.7)`, opacity: 0 },
          ],
          T({ duration: 560, easing: 'cubic-bezier(.3,0,.8,.5)', fill: 'forwards' }),
        );
      });
      fx(many(6, (i) => ({ shape: 'streak', x: c.x + rand(-20, 20), y: c.y + rand(-30, 30), vx: Math.cos(th) * rand(7, 10), vy: Math.sin(th) * rand(7, 10), drag: 0.9, max: rand(12, 18), size: 1.3, color: '#fffdf2', trailLen: 6, delay: i })));
    });
  }
  at(560, () => finale(win, ctx));
};

/** Water: a wave rolls out from the winner and washes the soaked cards away. */
const water: Finish = (win, losers, ctx) => {
  const w = center(win);
  sound.waterWash();
  for (const l of losers) {
    const c = center(l);
    const th = angle(w, c);
    const N = 14;
    // A crest racing out at the card.
    fx([
      ...many(3, (k) => ({ shape: 'arc', x: w.x, y: w.y, vx: ((c.x - w.x) / N) * 1.2, vy: ((c.y - w.y) / N) * 1.2, size: 18 + k * 6, grow: 0.6, max: N + 6, delay: k * 2, color: pick(WATER, k), wobble: 5 - k, span: [th - 0.9, th + 0.9] as [number, number] })),
      ...many(10, (i) => ({ shape: 'dot', x: w.x, y: w.y, vx: ((c.x - w.x) / N) * rand(0.9, 1.3) + rand(-0.6, 0.6), vy: ((c.y - w.y) / N) * rand(0.9, 1.3) + rand(-0.6, 0.6), max: N + 4, delay: i * 0.8, size: rand(1.6, 2.6), color: pick(WATER, i), light: false })),
    ]);
    at(N * F, () => {
      // Swept off: it slides away with the water, blurring and dissolving.
      const from = getComputedStyle(l).transform;
      l.animate(
        [
          { transform: from === 'none' ? 'none' : from, opacity: 1, filter: 'saturate(0.55) brightness(0.86)' },
          { transform: `translate(${Math.cos(th) * 40}px, ${Math.sin(th) * 40 + 10}px) rotate(${rand(-20, 20)}deg) scale(0.8)`, opacity: 0.6, filter: 'saturate(0.4) brightness(0.8) blur(1px)', offset: 0.5 },
          { transform: `translate(${Math.cos(th) * 90}px, ${Math.sin(th) * 90 + 26}px) rotate(${rand(-40, 40)}deg) scale(0.6)`, opacity: 0, filter: 'blur(3px)' },
        ],
        T({ duration: 520, easing: 'ease-in', fill: 'forwards' }),
      );
      fx([
        ...many(5, (i) => ({ shape: 'puff', x: c.x + rand(-20, 20), y: c.y + rand(-24, 24), vx: Math.cos(th) * rand(1, 2), vy: Math.sin(th) * rand(1, 2), drag: 0.94, max: rand(20, 28), size: rand(4, 6), grow: 0.3, alpha: 0.45, color: '#eefbff', light: false, delay: i })),
        ...many(10, (i) => {
          const a = th + rand(-0.8, 0.8);
          return { shape: 'dot', x: c.x, y: c.y, vx: Math.cos(a) * rand(2, 4), vy: Math.sin(a) * rand(2, 4) - 1.5, gravity: 0.22, max: rand(18, 26), size: rand(1.4, 2.4), color: pick(WATER, i), light: false };
        }),
      ]);
      // A wet patch is left on the felt.
      const wet = feltMark(ctx.under, l, 'background: radial-gradient(ellipse at 50% 50%, rgba(0,10,20,.28), rgba(20,70,110,.1) 50%, transparent 70%);');
      wet.animate([{ opacity: 0 }, { opacity: 1 }], T({ duration: 300, fill: 'both' }));
    });
  }
  at(560, () => finale(win, ctx));
};

/** Earth: each holed card cracks apart into chunks that drop off the table. */
const earth: Finish = (win, losers, ctx) => {
  const w = center(win);
  ctx.shake(4);
  fx([{ shape: 'ring', x: w.x, y: w.y + 14, size: 12, grow: 7, max: 16, color: EARTH[1]!, wobble: 7, squash: 0.35, light: false }]);
  losers.forEach((l, k) => {
    const c = center(l);
    const th = angle(w, c);
    at(120 + k * 50, () => {
      const box = l.getBoundingClientRect();
      const W = box.width;
      const H = box.height;
      const cx = W * rand(0.4, 0.6);
      const cy = H * rand(0.4, 0.6);
      const n = 6;
      const rim = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
        return { x: cx + Math.cos(a) * 200, y: cy + Math.sin(a) * 200, a };
      });
      const from = getComputedStyle(l).transform;
      rim.forEach((p, i) => {
        const q = rim[(i + 1) % n]!;
        const mid = (p.a + (q.a < p.a ? q.a + Math.PI * 2 : q.a)) / 2;
        const piece = l.cloneNode(true) as HTMLElement;
        piece.style.cssText += `position:absolute;left:${l.offsetLeft}px;top:${l.offsetTop}px;margin:0;transform:${from === 'none' ? 'none' : from};clip-path:polygon(${cx}px ${cy}px, ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, ${q.x.toFixed(0)}px ${q.y.toFixed(0)}px);`;
        l.parentElement!.appendChild(piece);
        const out = rand(8, 16);
        const fall = rand(120, 170);
        piece.animate(
          [
            { transform: `${from === 'none' ? '' : from} translate(0,0)`, opacity: 1 },
            { transform: `${from === 'none' ? '' : from} translate(${(Math.cos(mid) * out).toFixed(1)}px, ${(Math.sin(mid) * out - 8).toFixed(1)}px) rotate(${rand(-10, 10)}deg)`, opacity: 1, offset: 0.25 },
            { transform: `${from === 'none' ? '' : from} translate(${(Math.cos(mid) * out * 2 + Math.cos(th) * 10).toFixed(1)}px, ${fall}px) rotate(${rand(-70, 70)}deg) scale(0.8)`, opacity: 0 },
          ],
          T({ duration: 620, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' }),
        );
      });
      l.style.visibility = 'hidden';
      ctx.shake(3);
      if (k === 0) sound.earthCrumble();
      fx([
        ...many(12, (i) => {
          const a = rand(0, Math.PI * 2);
          return { shape: 'square', x: c.x, y: c.y, vx: Math.cos(a) * rand(2, 4.5), vy: Math.sin(a) * rand(2, 4.5) - 2, gravity: 0.42, max: rand(20, 30), size: rand(2.5, 5), color: pick(EARTH, i), vrot: rand(-0.4, 0.4) };
        }),
        ...many(4, (i) => ({ shape: 'puff', x: c.x + (i % 2 ? 1 : -1) * rand(16, 26), y: c.y + rand(10, 30), vx: (i % 2 ? 1 : -1) * rand(0.6, 1.2), drag: 0.94, max: rand(22, 30), size: rand(3, 5), grow: 0.3, alpha: 0.25, color: EARTH[2]! })),
      ]);
      // A crater left in the felt.
      const crater = feltMark(ctx.under, l, 'background: radial-gradient(ellipse 40% 34% at 50% 50%, rgba(14,10,6,.5), rgba(60,44,26,.22) 60%, transparent 100%);');
      crater.animate([{ opacity: 0 }, { opacity: 1 }], T({ duration: 200, fill: 'both' }));
    });
  });
  at(560, () => finale(win, ctx));
};

export const FINISH_1: Record<string, Finish> = { fire, air, water, earth };
