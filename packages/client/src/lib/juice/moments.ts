import {
  trumpSuit,
  winningPlay,
  type Call,
  type Card,
  type PlayedCard,
  type PublicEvent,
  type Seat,
  type Side,
  type Suit,
  type TableView,
} from '@dark/engine';
import { sameCard } from '../format';
import type { Level } from './timing';

// Spec S16: turn raw server events into "moments" the juice engine responds to.
// Pure functions, so the intensity rules are unit tested.

export type Moment =
  /** `going`: passes since the last bid, before the auction ends (1 = "going once", 2 = "going twice"). */
  | { kind: 'call'; seat: Seat; mine: boolean; call: Call; going: number }
  | { kind: 'contractSet'; declarer: Seat }
  | { kind: 'passedOut' }
  /**
   * `lead`: how many times the lead of this trick has changed, counting this card (0 = it doesn't lead).
   * `trumpIn`: it takes the lead by trumping a trick led in another suit.
   * `completes`: it is the trick's fourth card (the trick-won moment takes over from there).
   */
  | { kind: 'cardPlayed'; seat: Seat; mine: boolean; card: Card; lead: number; trumpIn: boolean; completes: boolean }
  /**
   * `trump`: won by a trump card. `trumpOver`: won by trumping another suit (a ruff).
   * `firstTrump`: the first trick of this deal won by a trump.
   */
  | { kind: 'trickWon'; side: Side; winner: Seat; trump: boolean; trumpOver: boolean; firstTrump: boolean; pip: number }
  | { kind: 'oneAway'; side: Side }
  | { kind: 'decider' }
  | { kind: 'clinch'; side: Side; seat: Seat; card: Card; drama: number }
  | { kind: 'dealComplete' }
  | { kind: 'nightEnded' };

/** The ladder (S16): each moment's size. Only the clinch and the end of the night reach 5. */
export function intensityOf(m: Moment): Level {
  switch (m.kind) {
    case 'call':
    case 'passedOut':
      return 1;
    case 'cardPlayed':
      return m.trumpIn ? 3 : m.lead > 0 ? 2 : 1;
    case 'trickWon':
      return m.firstTrump ? 4 : m.trump ? 3 : 2;
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

/** How a card changed the trick it was played to. */
export function leadChange(cards: readonly PlayedCard[], index: number, trump: Suit | null): { lead: number; trumpIn: boolean } {
  if (index <= 0) return { lead: 0, trumpIn: false };
  let changes = 0;
  let leader = cards[0]!;
  for (let i = 1; i <= index; i++) {
    const best = winningPlay(cards.slice(0, i + 1), trump);
    if (best !== leader) {
      changes++;
      leader = best;
    }
  }
  const card = cards[index]!;
  if (leader !== card) return { lead: 0, trumpIn: false };
  const led = cards[0]!.card.suit;
  return { lead: changes, trumpIn: trump !== null && card.card.suit === trump && led !== trump };
}

/** Finds the trick (current or just completed) holding a played card. */
function trickOf(view: TableView, seat: Seat, card: Card): { cards: readonly PlayedCard[]; index: number } | null {
  const deal = view.deal;
  for (const trick of [deal?.currentTrick, deal?.lastTrick]) {
    const index = trick?.cards.findIndex((p) => p.seat === seat && sameCard(p.card, card)) ?? -1;
    if (trick && index >= 0) return { cards: trick.cards, index };
  }
  return null;
}

export function momentsFrom(events: readonly PublicEvent[], view: TableView): Moment[] {
  const moments: Moment[] = [];
  const me = view.mySeat;
  const deal = view.deal;
  const calls = deal?.calls ?? [];
  // Calls in this batch are the last ones in the auction; find each one's position.
  let callIndex = calls.length - events.filter((e) => e.type === 'deal' && e.event.type === 'callMade').length;
  const auctionEnds = events.some((e) => e.type === 'deal' && (e.event.type === 'contractSet' || e.event.type === 'passedOut'));

  for (const e of events) {
    if (e.type === 'nightEnded') moments.push({ kind: 'nightEnded' });
    if (e.type !== 'deal') continue;
    const ev = e.event;
    switch (ev.type) {
      case 'callMade': {
        const upTo = calls.slice(0, callIndex + 1);
        callIndex++;
        let passes = 0;
        for (let i = upTo.length - 1; i >= 0 && upTo[i]!.call.type === 'pass'; i--) passes++;
        const anyBid = upTo.some((c) => c.call.type === 'bid');
        const going = ev.call.type === 'pass' && anyBid && !(auctionEnds && passes >= 3) ? Math.min(passes, 2) : 0;
        moments.push({ kind: 'call', seat: ev.seat, mine: ev.seat === me, call: ev.call, going });
        break;
      }
      case 'contractSet':
        moments.push({ kind: 'contractSet', declarer: ev.contract.declarer });
        break;
      case 'passedOut':
        moments.push({ kind: 'passedOut' });
        break;
      case 'cardPlayed': {
        const trump = deal?.contract ? trumpSuit(deal.contract.strain) : null;
        const found = trickOf(view, ev.seat, ev.card);
        const change = found ? leadChange(found.cards, found.index, trump) : { lead: 0, trumpIn: false };
        moments.push({
          kind: 'cardPlayed',
          seat: ev.seat,
          mine: ev.seat === me,
          card: ev.card,
          ...change,
          completes: found?.index === 3,
        });
        break;
      }
      case 'trickWon': {
        if (!deal?.contract) break;
        const trick = deal.lastTrick;
        const trump = trumpSuit(deal.contract.strain);
        const led = trick?.cards[0]?.card.suit;
        const isTrump = !!trump && ev.card.suit === trump;
        moments.push({
          kind: 'trickWon',
          side: ev.side,
          winner: ev.winner,
          trump: isTrump,
          trumpOver: isTrump && led !== trump,
          firstTrump: isTrump && deal.trumpTricksWon === 1,
          pip: ev.tricksWon[ev.side] - 1,
        });

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

/**
 * How many sets in a row the side that won the latest set has now won (1 = just this one).
 * Partners sit opposite, so a side is the seats with the same parity.
 */
export function streak(winners: readonly Seat[]): number {
  const last = winners.at(-1);
  if (last === undefined) return 0;
  let n = 0;
  for (let i = winners.length - 1; i >= 0 && winners[i]! % 2 === last % 2; i--) n++;
  return n;
}
