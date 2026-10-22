import { center, fx, many, pick, type Pt } from './cardFx';
import { screenFlash } from './particles';
import { sound } from './sound';
import type { Ctx } from './subFx';
import { FINISH_1 } from './finishFx1';
import { FINISH_2 } from './finishFx2';

// Ryan's round 8: the game-winning set. The winner's attack plays as on any set (0.80 s), then a
// finisher wipes the wrecked losing cards off the table, each element its own way, and the
// finale lands (gold flash, big shake, the clinch chord). About 1.6 s in all; the game already
// waits ~3 s after the deciding set, so it costs no time. Effects lab only (fxlab.html?set=finish1,
// finish2). Finishers are timed for 1.0 s and played at K = 0.8 by the cardFx helpers, like the
// attacks.

/** Wipe the wrecked losers off the table. Called once the attack is over. */
export type Finish = (win: HTMLElement, losers: HTMLElement[], ctx: Ctx) => void;

const GOLD = '#e8c25a';

/** The power-up as the attack starts: a gold charge on the winning card. */
export function powerUp(win: HTMLElement): void {
  sound.powerUp();
  const w = center(win);
  fx([
    { shape: 'flash', x: w.x, y: w.y, size: 70, max: 18, alpha: 0.5, color: GOLD },
    ...many(14, (i) => {
      const a = (i / 14) * Math.PI * 2;
      return { shape: 'streak', x: w.x + Math.cos(a) * 60, y: w.y + Math.sin(a) * 60, vx: -Math.cos(a) * 6, vy: -Math.sin(a) * 6, max: 10, size: 1.8, color: pick([GOLD, '#fff6d8'], i), trailLen: 4 };
    }),
  ]);
}

/**
 * The finale (call it at the finisher's climax, by at(560) on the 1.0 s timeline): a gold flash
 * from the winning card, a burst of light (a hot core, a shock ring and gold sparks), the big
 * shake and the clinch chord, as the game-winning set has today. Built on the scaled helpers so
 * it's over well inside the 1.6 s.
 */
export function finale(win: HTMLElement, ctx: Ctx, drama = 1): void {
  const w: Pt = center(win);
  sound.clinch(drama);
  screenFlash(GOLD, 0.34, 12, w);
  const n = 22 + drama * 6;
  fx([
    { shape: 'flash', x: w.x, y: w.y, size: 90, max: 16, alpha: 0.45, color: GOLD },
    { shape: 'flash', x: w.x, y: w.y, size: 46, max: 12, alpha: 1, color: '#fff6d8', glow: 'hot' },
    { shape: 'ring', x: w.x, y: w.y, size: 10, grow: 7, max: 16, color: GOLD, wobble: 4 },
    ...many(n, (i) => {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const v = 6 + Math.random() * 5;
      return { shape: 'streak', x: w.x, y: w.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.88, gravity: 0.04, max: 16 + Math.random() * 6, size: 2.2, color: pick([GOLD, '#fff6d8', '#ffffff'], i), trailLen: 6 };
    }),
  ]);
  ctx.shake(7 + 3 * drama);
}

export const FINISH: Record<string, Finish> = { ...FINISH_1, ...FINISH_2 };
