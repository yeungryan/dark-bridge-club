import { airAttack, at, earthAttack, fireAttack, waterAttack } from './cardFx';
import { FINISH, powerUp } from './finishFx';
import type { Element } from './particles';
import { bladeStorm, chain, iceShards, sonicBoom, type Attack, type Ctx } from './subFx';

// Spec S24, the set-win effects (Ryan, round 8): what the director plays when a set is won.
// The winner's element attacks the three losing cards (cardFx.ts); won by trumping another
// suit, its sub-element does instead (subFx.ts); the set that decides the game adds a power-up,
// a finisher and the finale (finishFx.ts).

const ELEMENT: Record<Element, Attack> = {
  fire: (win, losers) => fireAttack(win, losers),
  air: (win, losers) => airAttack(win, losers),
  water: (win, losers, ctx) => waterAttack(win, losers, ctx.under),
  earth: (win, losers, ctx) => earthAttack(win, losers, ctx.shake),
};
/** Each element's sub-element, for a set won by trumping. */
const SUB: Record<Element, { name: string; attack: Attack }> = {
  fire: { name: 'lightning', attack: chain },
  air: { name: 'sound', attack: sonicBoom },
  water: { name: 'ice', attack: iceShards },
  earth: { name: 'metal', attack: bladeStorm },
};

/** A set won: `win` and `losers` are the cards on the table (the trick area's `.face`s). */
export function setWon(element: Element, trumpOver: boolean, win: HTMLElement, losers: HTMLElement[], ctx: Ctx): void {
  (trumpOver ? SUB[element].attack : ELEMENT[element])(win, losers, ctx);
}

/** The set that decides the game: power-up and attack (0.80 s), then the finisher and finale. */
export function gameWon(element: Element, trumpOver: boolean, win: HTMLElement, losers: HTMLElement[], ctx: Ctx): void {
  powerUp(win);
  setWon(element, trumpOver, win, losers, ctx);
  at(1000, () => FINISH[trumpOver ? SUB[element].name : element]?.(win, losers, ctx));
}
