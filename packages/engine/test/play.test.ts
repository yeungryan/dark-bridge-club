import { describe, expect, it } from 'vitest';
import {
  applyDealAction,
  bid,
  legalPlays,
  newDealWithHands,
  next,
  PASS,
  seatToAct,
  winningPlay,
  type Card,
  type PlayedCard,
} from '../src';
import { act, highestLegal, playUntil, runAuction, suitHands } from './helpers';

const c = (id: string): Card => {
  const suit = id[0] as Card['suit'];
  const r = id.slice(1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return { suit, rank: rank as Card['rank'] };
};
const trick = (...ids: string[]): PlayedCard[] => ids.map((id, i) => ({ seat: i as 0 | 1 | 2 | 3, card: c(id) }));

describe('S03 trick rules', () => {
  it('you must follow the suit led when you can', () => {
    const hand = [c('S2'), c('H9'), c('HA')];
    expect(legalPlays(hand, trick('H5'))).toEqual([c('H9'), c('HA')]);
    expect(legalPlays(hand, trick('D5'))).toEqual(hand);
    expect(legalPlays(hand, [])).toEqual(hand);
  });

  it('in NT the highest card of the suit led wins; off-suit aces lose', () => {
    expect(winningPlay(trick('H5', 'SA', 'H9', 'DA'), null).seat).toBe(2);
  });

  it('any trump beats any non-trump; the higher of two trumps wins', () => {
    expect(winningPlay(trick('HA', 'S2', 'HK', 'HQ'), 'S').seat).toBe(1);
    expect(winningPlay(trick('HA', 'S2', 'S3', 'HQ'), 'S').seat).toBe(2);
  });

  it('a discard of a third suit never wins', () => {
    expect(winningPlay(trick('H2', 'CA', 'DA', 'H3'), 'S').seat).toBe(3);
  });
});

describe('S03 golden deals', () => {
  // Seat 0 holds every spade, 1 every heart, 2 every diamond, 3 every club.
  const hands = suitHands({ 0: 'S', 1: 'H', 2: 'D', 3: 'C' });

  it('1♠ by seat 0: trumps win every trick; clinch on trick 7; play on to +6', () => {
    let s = runAuction(newDealWithHands(hands, 0), [bid(1, 'S'), PASS, PASS, PASS]);
    expect(s.currentTrick!.leader).toBe(next(0)); // opening lead from declarer's right

    // Trick 1: hearts led, diamonds and clubs discarded, declarer ruffs last.
    s = playUntil(s, (x) => x.tricks.length === 1);
    expect(s.tricks[0]!.cards.map((p) => p.seat)).toEqual([1, 2, 3, 0]);
    expect(s.tricks[0]!.winner).toBe(0);

    s = playUntil(s, (x) => x.phase !== 'play');
    expect(s.phase).toBe('awaitingPlayOn');
    expect(s.clinch).toMatchObject({ side: 'declarers', trickNumber: 7, seat: 0 });
    for (const t of s.tricks) expect(t.leader === 1 || t.leader === 0).toBe(true);

    s = act(s, { type: 'playOn', seat: 2 });
    s = playUntil(s, (x) => x.phase !== 'play');
    expect(s.phase).toBe('complete');
    expect(s.tricks).toHaveLength(13);
    expect(s.tricks.every((t) => t.winner === 0)).toBe(true);
    expect(s.result).toEqual({ winner: 'declarers', reason: 'made', declarerTricks: 13, defenderTricks: 0, playedOut: true, overUnder: 6 });
  });

  it('1NT by seat 0: the heart holder wins every trick; defenders clinch on trick 7', () => {
    let s = runAuction(newDealWithHands(hands, 0), [bid(1, 'NT'), PASS, PASS, PASS]);
    s = playUntil(s, (x) => x.phase !== 'play');
    expect(s.clinch).toMatchObject({ side: 'defenders', trickNumber: 7, seat: 1 });
    s = act(s, { type: 'endAtClinch' });
    expect(s.result).toEqual({ winner: 'defenders', reason: 'defeated', declarerTricks: 0, defenderTricks: 7, playedOut: false, overUnder: null });
  });

  it('playing out of turn, a card you do not hold, or revoking is rejected', () => {
    const s = runAuction(newDealWithHands(hands, 0), [bid(1, 'NT'), PASS, PASS, PASS]);
    const outOfTurn = applyDealAction(s, { type: 'play', seat: 0, card: c('SA') });
    expect(!outOfTurn.ok && outOfTurn.error.code).toBe('NOT_YOUR_TURN');
    const notHeld = applyDealAction(s, { type: 'play', seat: 1, card: c('SA') });
    expect(!notHeld.ok && notHeld.error.code).toBe('NOT_IN_HAND');
  });

  it('a revoke is impossible', () => {
    const mixed = {
      0: [...'SA SK SQ SJ S10 S9 S8 S7 S6 S5 S4 S3 H2'.split(' ').map(c)],
      1: [...'HA HK HQ HJ H10 H9 H8 H7 H6 H5 H4 H3 S2'.split(' ').map(c)],
      2: [...'DA DK DQ DJ D10 D9 D8 D7 D6 D5 D4 D3 D2'.split(' ').map(c)],
      3: [...'CA CK CQ CJ C10 C9 C8 C7 C6 C5 C4 C3 C2'.split(' ').map(c)],
    };
    let s = runAuction(newDealWithHands(mixed, 0), [bid(1, 'NT'), PASS, PASS, PASS]);
    s = act(s, { type: 'play', seat: 1, card: c('HA') });
    s = act(s, { type: 'play', seat: 2, card: c('D2') });
    s = act(s, { type: 'play', seat: 3, card: c('C2') });
    expect(seatToAct(s)).toBe(0);
    const revoke = applyDealAction(s, { type: 'play', seat: 0, card: c('SA') });
    expect(!revoke.ok && revoke.error.code).toBe('MUST_FOLLOW_SUIT');
    expect(highestLegal(s)).toEqual(c('H2'));
  });
});
