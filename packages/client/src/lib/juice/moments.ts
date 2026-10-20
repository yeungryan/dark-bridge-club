import { trumpSuit, type Card, type PublicEvent, type Seat, type Side, type TableView } from '@dark/engine';
import type { Level } from './timing';

// Spec S16: turn raw server events into "moments" the juice engine responds to.
// Pure functions, so the intensity rules are unit tested.

export type Moment =
  | { kind: 'call'; seat: Seat; mine: boolean }
  | { kind: 'contractSet' }
  | { kind: 'passedOut' }
  | { kind: 'cardPlayed'; seat: Seat; mine: boolean }
  | { kind: 'trickWon'; side: Side; winner: Seat; trumpOver: boolean; pip: number }
  | { kind: 'oneAway'; side: Side }
  | { kind: 'decider' }
  | { kind: 'clinch'; side: Side; seat: Seat; card: Card; drama: number }
  | { kind: 'dealComplete' }
  | { kind: 'nightEnded' };

export function intensityOf(m: Moment): Level {
  switch (m.kind) {
    case 'call':
    case 'cardPlayed':
    case 'passedOut':
      return 1;
    case 'trickWon':
      return m.trumpOver ? 3 : 2;
    case 'contractSet':
    case 'oneAway':
      return 3;
    case 'decider':
      return 4;
    case 'clinch':
    case 'nightEnded':
      return 5;
    case 'dealComplete':
      return 0;
  }
}

/**
 * How dramatic a clinch is, 0–3 (S16 drama modifiers): it came on the decider trick,
 * the contract was a slam (level 6–7), or the clinching card was a trump-over.
 */
export function clinchDrama(input: { decider: boolean; level: number; trumpOver: boolean }): number {
  return Math.min(3, (input.decider ? 1 : 0) + (input.level >= 6 ? 1 : 0) + (input.trumpOver ? 1 : 0));
}

/** Tricks each side still needs. */
function remaining(view: TableView, won: { declarers: number; defenders: number }) {
  const d = view.deal!;
  return { declarers: d.declarerTarget! - won.declarers, defenders: d.defenderTarget! - won.defenders };
}

export function momentsFrom(events: readonly PublicEvent[], view: TableView): Moment[] {
  const moments: Moment[] = [];
  const me = view.mySeat;
  const deal = view.deal;

  for (const e of events) {
    if (e.type === 'nightEnded') moments.push({ kind: 'nightEnded' });
    if (e.type !== 'deal') continue;
    const ev = e.event;
    switch (ev.type) {
      case 'callMade':
        moments.push({ kind: 'call', seat: ev.seat, mine: ev.seat === me });
        break;
      case 'contractSet':
        moments.push({ kind: 'contractSet' });
        break;
      case 'passedOut':
        moments.push({ kind: 'passedOut' });
        break;
      case 'cardPlayed':
        moments.push({ kind: 'cardPlayed', seat: ev.seat, mine: ev.seat === me });
        break;
      case 'trickWon': {
        if (!deal?.contract) break;
        const trick = deal.lastTrick;
        const trump = trumpSuit(deal.contract.strain);
        const led = trick?.cards[0]?.card.suit;
        const trumpOver = !!trump && ev.card.suit === trump && led !== trump;
        moments.push({ kind: 'trickWon', side: ev.side, winner: ev.winner, trumpOver, pip: ev.tricksWon[ev.side] - 1 });

        // Getting close: a side just became one trick away; both at once is the decider.
        const after = remaining(view, ev.tricksWon);
        const before = remaining(view, { ...ev.tricksWon, [ev.side]: ev.tricksWon[ev.side] - 1 });
        const settled = after.declarers <= 0 || after.defenders <= 0;
        if (!settled) {
          if (after.declarers === 1 && after.defenders === 1 && !(before.declarers === 1 && before.defenders === 1)) {
            moments.push({ kind: 'decider' });
          } else if (after[ev.side] === 1 && before[ev.side] > 1) {
            moments.push({ kind: 'oneAway', side: ev.side });
          }
        }
        break;
      }
      case 'clinched': {
        if (!deal?.contract) break;
        const c = ev.clinch;
        const won = deal.result ? { declarers: deal.result.declarerTricks, defenders: deal.result.defenderTricks } : deal.tricksWon;
        // Tricks before the clinching one: the clinching side had one fewer.
        const before = remaining(view, { ...won, [c.side]: won[c.side] - 1 });
        const prior = [...moments].reverse().find((m) => m.kind === 'trickWon');
        const trumpOver = prior?.kind === 'trickWon' ? prior.trumpOver : false;
        moments.push({
          kind: 'clinch',
          side: c.side,
          seat: c.seat,
          card: c.card,
          drama: clinchDrama({ decider: before.declarers === 1 && before.defenders === 1, level: deal.contract.level, trumpOver }),
        });
        break;
      }
      case 'dealComplete':
        moments.push({ kind: 'dealComplete' });
        break;
    }
  }
  return moments;
}
