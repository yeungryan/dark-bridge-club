import { at, center, F, fx, ghost, many, overlay, pick, type Pt, ragged, rand, T, toward } from './cardFx';
import { finale, type Finish } from './finishFx';
import { sound } from './sound';
import { angle, bolt, BOLT, frostBg } from './subFx';

// Batch 2 finishers (lightning, sound, ice, metal): see finishFx.ts. Each starts once the
// attack is over (the losers already scarred, crumpled, impaled or slashed) and leaves only the
// winning card on the table. Timed for 1.0 s, played at K = 0.8 (0.80 s).

const ICE = ['#e8fbff', '#a8e6ff', '#6cc7f0'];
const METAL = ['#f2f4f7', '#c3c9d2', '#8a929e', '#ffcf8a'];
const PAPER = ['#f3ead2', '#e6dcc2', '#fbf8f0'];

/** The card's look as it stands now (its attack's animations), to start a new one from. */
const now = (card: HTMLElement) => {
  const cs = getComputedStyle(card);
  return { transform: cs.transform === 'none' ? 'none' : cs.transform, filter: cs.filter === 'none' ? 'none' : cs.filter };
};

/** Copies of the card, each clipped to one polygon, laid exactly over it (the card is hidden). */
function pieces(card: HTMLElement, clips: string[]): HTMLElement[] {
  const { transform, filter } = now(card);
  const parent = card.parentElement!;
  const out = clips.map((clip) => {
    const p = ghost(card.cloneNode(true) as HTMLElement);
    p.style.cssText += `position:absolute;left:${card.offsetLeft}px;top:${card.offsetTop}px;margin:0;clip-path:${clip};transform:${transform};filter:${filter};z-index:3;`;
    parent.appendChild(p);
    return p;
  });
  card.style.visibility = 'hidden';
  return out;
}

// ── Lightning: a last strike from the sky, and each card burns away to ash ───────────────────

const lightning: Finish = (win, losers, ctx) => {
  sound.boltStrike();
  losers.forEach((l, k) => {
    at(k * 30, () => {
      const t = center(l);
      bolt({ x: t.x + rand(-24, 24), y: t.y - 180 }, t, { size: 4.2, max: 14, branches: 3 });
      fx([
        { shape: 'flash', x: t.x, y: t.y, size: 52, max: 12, alpha: 1, color: BOLT[0]!, glow: 'hot' },
        { shape: 'ring', x: t.x, y: t.y, size: 8, grow: 4, max: 12, color: BOLT[1]!, wobble: 3 },
      ]);
      ctx.shake(3);
      const box = l.getBoundingClientRect();
      const { transform } = now(l);
      // Blinding white-blue, then it crumbles inward to nothing.
      l.animate(
        [
          { filter: 'brightness(1)', clipPath: ragged(box.width, box.height, 34, 0), opacity: 1, transform },
          { filter: 'brightness(2.6) saturate(0.2) drop-shadow(0 0 6px #4aa3ff)', clipPath: ragged(box.width, box.height, 34, 2), opacity: 1, offset: 0.2 },
          { filter: 'brightness(0.5) sepia(0.4)', clipPath: ragged(box.width, box.height, 34, box.width * 0.42), opacity: 0, transform },
        ],
        T({ duration: 520, delay: 40, easing: 'ease-in', fill: 'forwards' }),
      );
      // Blue sparks crackling off it, and glowing ash lifting away.
      fx([
        ...many(12, (i) => {
          const a = rand(0, Math.PI * 2);
          return { shape: 'streak', x: t.x + rand(-16, 16), y: t.y + rand(-24, 24), vx: Math.cos(a) * rand(2, 4.5), vy: Math.sin(a) * rand(2, 4.5) - 1, drag: 0.88, max: rand(10, 16), delay: 4 + i, size: 1.4, color: pick(BOLT, i), trailLen: 4 };
        }),
        ...many(14, (i) => ({ shape: 'square', x: t.x + rand(-20, 20), y: t.y + rand(-28, 28), vx: rand(-0.6, 0.6), vy: rand(-1.8, -0.8), drag: 0.97, max: rand(22, 30), delay: 10 + i * 1.2, size: rand(1.6, 3), color: pick(['#2a2622', '#3d3630', '#1b1815'], i), vrot: rand(-0.2, 0.2) })),
        ...many(8, (i) => ({ shape: 'dot', x: t.x + rand(-18, 18), y: t.y + rand(-24, 24), vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.8), max: rand(18, 26), delay: 12 + i * 1.5, size: rand(1.2, 2), color: pick(BOLT, i + 1), wobble: 1 })),
      ]);
      // A scorch mark left on the felt where it lay (beneath the cards).
      const u = ctx.under.getBoundingClientRect();
      const mark = document.createElement('div');
      mark.style.cssText = `position:absolute;left:${(t.x - u.left - 34).toFixed(0)}px;top:${(t.y - u.top - 42).toFixed(0)}px;width:68px;height:84px;border-radius:50%;background:radial-gradient(ellipse at 50% 50%, rgba(8,6,4,.42) 0%, rgba(20,14,10,.22) 40%, rgba(40,60,90,.1) 60%, transparent 70%);pointer-events:none;`;
      ctx.under.appendChild(mark);
      mark.animate([{ opacity: 0 }, { opacity: 1 }], T({ duration: 300, delay: 120, fill: 'both' }));
    });
  });
  at(560, () => finale(win, ctx));
};

// ── Sound: a second, bigger boom blows the crumpled cards off the table ──────────────────────

const sonic: Finish = (win, losers, ctx) => {
  const w = center(win);
  sound.boomBlast();
  fx([
    { shape: 'flash', x: w.x, y: w.y, size: 40, max: 10, alpha: 1, color: '#ffffff', glow: 'hot' },
    ...many(3, (k) => ({ shape: 'ring', x: w.x, y: w.y, size: 12, grow: 12, max: 18, delay: k * 3, color: pick(['#ffffff', '#f4d27a', '#fff6cf'], k), wobble: 6 - k * 1.5 })),
  ]);
  ctx.shake(5);
  for (const l of losers) {
    const t = center(l);
    const th = angle(w, t);
    const d = Math.hypot(t.x - w.x, t.y - w.y);
    // The ring's front reaches it after d / 12 frames.
    at((d / 12) * F, () => {
      const { transform } = now(l);
      const far = 105;
      const spin = (Math.cos(th) >= 0 ? 1 : -1) * rand(300, 480);
      l.animate(
        [
          { transform: `translate(0px, 0px) ${transform === 'none' ? '' : transform}`, opacity: 1 },
          { transform: `translate(${(Math.cos(th) * far * 0.35).toFixed(1)}px, ${(Math.sin(th) * far * 0.35).toFixed(1)}px) ${transform === 'none' ? '' : transform} rotate(${(spin * 0.3).toFixed(0)}deg) scale(0.85)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${(Math.cos(th) * far * 0.75).toFixed(1)}px, ${(Math.sin(th) * far * 0.75).toFixed(1)}px) ${transform === 'none' ? '' : transform} rotate(${(spin * 0.75).toFixed(0)}deg) scale(0.55)`, opacity: 0.85, offset: 0.65 },
          { transform: `translate(${(Math.cos(th) * far).toFixed(1)}px, ${(Math.sin(th) * far).toFixed(1)}px) ${transform === 'none' ? '' : transform} rotate(${spin.toFixed(0)}deg) scale(0.35)`, opacity: 0 },
        ],
        T({ duration: 600, easing: 'cubic-bezier(.25,.6,.45,1)', fill: 'forwards' }),
      );
      // Paper scraps torn off, fluttering after it.
      fx(
        many(10, (i) => {
          const a = th + rand(-0.6, 0.6);
          const v = rand(2.5, 5.5);
          return { shape: 'ribbon', x: t.x + rand(-12, 12), y: t.y + rand(-18, 18), vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0.05, drag: 0.93, max: rand(22, 32), delay: i, size: rand(2.5, 4), color: pick(PAPER, i), rot: rand(0, 6), vrot: rand(-0.3, 0.3), wobble: rand(0.4, 1) };
        }),
      );
    });
  }
  at(560, () => finale(win, ctx));
};

// ── Ice: frozen solid from its shards, then shattered to fragments ───────────────────────────

const ice: Finish = (win, losers, ctx) => {
  losers.forEach((l, li) => {
    const t = center(l);
    // Frost floods over it from the middle (where the shards went in).
    const frost = overlay(l, `background: ${frostBg}; z-index: 1;`);
    frost.animate([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)' }], T({ duration: 260, delay: li * 30, easing: 'ease-out', fill: 'both' }));
    // Frozen white for a beat.
    const { transform } = now(l);
    l.animate([{ filter: 'none', transform }, { filter: 'brightness(1.5) saturate(0.2)', transform }], T({ duration: 160, delay: 260 + li * 30, fill: 'forwards' }));
    at(460 + li * 30, () => {
      ctx.shake(3);
      if (li === 0) sound.iceShatter();
      const box = l.getBoundingClientRect();
      const W = box.width;
      const H = box.height;
      const cx = W * rand(0.4, 0.6);
      const cy = H * rand(0.4, 0.6);
      const n = 7;
      const rim = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + rand(-0.2, 0.2));
      const clips = rim.map((a, i) => {
        const b = rim[(i + 1) % n]! + (i === n - 1 ? Math.PI * 2 : 0);
        const p = (x: number) => `${(cx + Math.cos(x) * 200).toFixed(0)}px ${(cy + Math.sin(x) * 200).toFixed(0)}px`;
        return `polygon(${cx.toFixed(0)}px ${cy.toFixed(0)}px, ${p(a)}, ${p(b)})`;
      });
      const parts = pieces(l, clips);
      parts.forEach((p, i) => {
        p.style.filter = 'brightness(1.3) saturate(0.3)';
        const mid = (rim[i]! + rim[(i + 1) % n]! + (i === n - 1 ? Math.PI * 2 : 0)) / 2;
        const push = rand(28, 48);
        p.animate(
          [
            { translate: '0px 0px', rotate: '0deg', opacity: 1 },
            { translate: `${(Math.cos(mid) * push).toFixed(1)}px ${(Math.sin(mid) * push + 10).toFixed(1)}px`, rotate: `${rand(-50, 50).toFixed(0)}deg`, opacity: 0 },
          ],
          T({ duration: 380, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }),
        );
      });
      fx([
        { shape: 'flash', x: t.x, y: t.y, size: 40, max: 10, alpha: 1, color: '#ffffff', glow: 'hot' },
        ...many(12, (j) => {
          const a = rand(0, Math.PI * 2);
          return { shape: 'shard', x: t.x, y: t.y, vx: Math.cos(a) * rand(2.5, 5), vy: Math.sin(a) * rand(2.5, 5), drag: 0.88, max: rand(14, 20), size: rand(2.5, 4.5), color: pick(ICE, j), rot: a + Math.PI / 2 };
        }),
        ...many(6, (j) => ({ shape: 'flash', x: t.x + rand(-26, 26), y: t.y + rand(-34, 34), max: rand(8, 12), delay: j * 1.5, size: rand(4, 7), alpha: 1, color: '#ffffff', glow: 'star' })),
      ]);
    });
  });
  at(480, () => finale(win, ctx));
};

// ── Metal: the blades whirl back and shred each card into falling strips ─────────────────────

const metal: Finish = (win, losers, ctx) => {
  const w = center(win);
  losers.forEach((l, li) => {
    const t = center(l);
    const N = 10;
    const d = li * 2;
    for (let k = 0; k < 3; k++) {
      const aim = { x: t.x + (k - 1) * 12, y: t.y + rand(-10, 10) };
      fx([{ shape: 'shard', x: w.x, y: w.y, ...toward(w, aim, N), max: N, delay: d + k, size: 6.5, color: pick(METAL, k), vrot: 1 }]);
    }
    at((N + d + 2) * F, () => {
      ctx.shake(3);
      if (li === 0) sound.metalShred();
      const box = l.getBoundingClientRect();
      const W = box.width;
      const strips = 5;
      const cuts = Array.from({ length: strips - 1 }, (_, i) => ((i + 1) / strips) * W + rand(-2, 2));
      const edges = [0, ...cuts, W];
      const clips = edges.slice(0, -1).map((x0, i) => {
        const x1 = edges[i + 1]!;
        // A slightly slanted cut, so the strips read as sliced, not printed.
        return `polygon(${(x0 - 1).toFixed(1)}px -20px, ${(x1 + 1).toFixed(1)}px -20px, ${(x1 + 2).toFixed(1)}px ${box.height + 20}px, ${(x0).toFixed(1)}px ${box.height + 20}px)`;
      });
      const parts = pieces(l, clips);
      parts.forEach((p, i) => {
        const drop = rand(50, 90);
        p.animate(
          [
            { translate: '0px 0px', rotate: '0deg', opacity: 1 },
            { translate: `${((i - 2) * 1.5).toFixed(1)}px 3px`, rotate: `${rand(-3, 3).toFixed(1)}deg`, opacity: 1, offset: 0.15 },
            { translate: `${((i - 2) * rand(4, 8)).toFixed(1)}px ${drop.toFixed(0)}px`, rotate: `${rand(-14, 14).toFixed(0)}deg`, opacity: 0 },
          ],
          T({ duration: 440, delay: i * 25, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'both' }),
        );
      });
      // Sparks spraying from each cut.
      fx(
        cuts.flatMap((cx, ci) =>
          many(4, (j) => {
            const x = box.left + cx;
            const y = box.top + rand(0.15, 0.85) * box.height;
            const a = (j % 2 ? 0 : Math.PI) + rand(-0.6, 0.6);
            return { shape: 'streak', x, y, vx: Math.cos(a) * rand(2.5, 5), vy: Math.sin(a) * rand(2.5, 5) - 1.5, gravity: 0.3, drag: 0.92, max: rand(10, 16), delay: ci, size: 1.3, color: pick(['#ffcf8a', '#ffffff', '#ffb347'], j), trailLen: 4 };
          }),
        ),
      );
    });
  });
  at(560, () => finale(win, ctx));
};

export const FINISH_2: Record<string, Finish> = { lightning, sound: sonic, ice, metal };
