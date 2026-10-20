// Dev-only practice bots (spec S22). They decide from a player's own view, exactly like a person,
// so they can never peek at other hands. Not exported from index.ts; never used in real games.
import { bid, PASS } from './auction';
import { hcp } from './cards';
import { partner } from './seats';
import { trumpSuit, winningPlay } from './play';
import { SUITS, type Call, type Card, type Seat, type Suit } from './types';
import type { DealView } from './views';

const lowest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank > a.rank ? b : a));

function longestSuit(hand: readonly Card[]): Suit {
  return SUITS.reduce((best, s) =>
    hand.filter((c) => c.suit === s).length >= hand.filter((c) => c.suit === best).length ? s : best,
  );
}

function isLegal(view: DealView, call: Call): boolean {
  return view.legalCalls.some(
    (c) => c.type === call.type && (c.type === 'pass' || (call.type === 'bid' && c.level === call.level && c.strain === call.strain)),
  );
}

/** Opens with 12+ HCP, raises partner's suit once with support and 6+ HCP, otherwise passes. */
export function botCall(view: DealView, me: Seat): Call {
  const hand = view.hand;
  const points = hcp(hand);
  const bids = view.calls.filter((c) => c.call.type === 'bid');
  if (bids.length === 0 && points >= 12) {
    const balanced = SUITS.every((s) => hand.filter((c) => c.suit === s).length >= 2);
    const opening = balanced && points >= 15 && points <= 17 ? bid(1, 'NT') : bid(1, longestSuit(hand));
    if (isLegal(view, opening)) return opening;
  }
  const last = bids[bids.length - 1];
  const myBids = view.calls.filter((c) => c.seat === me && c.call.type === 'bid').length;
  if (last && last.seat === partner(me) && last.call.type === 'bid' && myBids === 0 && points >= 6) {
    const strain = last.call.strain;
    const support = strain === 'NT' ? 0 : hand.filter((c) => c.suit === strain).length;
    if ((strain === 'NT' || support >= 3) && last.call.level < 4) {
      const raise = bid((last.call.level + 1) as 2 | 3 | 4, strain);
      if (isLegal(view, raise)) return raise;
    }
  }
  return PASS;
}

/** Leads top of the longest side suit; wins cheaply when partner isn't already winning. */
export function botCard(view: DealView, me: Seat): Card {
  const hand = view.hand;
  const trick = view.currentTrick?.cards ?? [];
  const trump = trumpSuit(view.contract!.strain);
  const legal = view.legalPlays;

  if (trick.length === 0) {
    const nonTrump = hand.filter((c) => c.suit !== trump);
    const pool = nonTrump.length > 0 ? nonTrump : hand;
    return highest(pool.filter((c) => c.suit === longestSuit(pool)));
  }

  const current = winningPlay(trick, trump);
  const partnerWinning = current.seat === partner(me);
  const winners = legal.filter((c) => winningPlay([...trick, { seat: me, card: c }], trump).seat === me);
  if (partnerWinning || winners.length === 0) {
    const discards = legal.filter((c) => c.suit !== trump);
    return lowest(discards.length > 0 ? discards : legal);
  }
  return lowest(winners);
}
