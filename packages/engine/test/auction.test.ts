import { describe, expect, it } from 'vitest';
import {
  applyDealAction,
  auctionStatus,
  bid,
  declarerTarget,
  defenderTarget,
  isLegalCall,
  legalCalls,
  LEVELS,
  newDeal,
  next,
  PASS,
  seatToAct,
  type Level,
} from '../src';
import { act, runAuction } from './helpers';

const SEED = 'aaaaaaaabbbbbbbbccccccccdddddddd';

describe('S02 auction', () => {
  it("the player on the dealer's right calls first (Ryan, round 10), then bidding goes counter-clockwise", () => {
    let s = newDeal(SEED, 2);
    expect(seatToAct(s)).toBe(next(2));
    s = act(s, { type: 'call', seat: next(2), call: PASS });
    expect(seatToAct(s)).toBe(next(next(2)));
  });

  it('rejects calls made out of turn', () => {
    // The dealer doesn't open any more: it's seat 1's turn.
    const out = applyDealAction(newDeal(SEED, 0), { type: 'call', seat: 0, call: PASS });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects insufficient bids', () => {
    const s = runAuction(newDeal(SEED, 0), [bid(2, 'H')]);
    expect(isLegalCall(s.auction, bid(2, 'D'))).toBe(false);
    expect(isLegalCall(s.auction, bid(2, 'H'))).toBe(false);
    expect(isLegalCall(s.auction, bid(2, 'S'))).toBe(true);
    const out = applyDealAction(s, { type: 'call', seat: seatToAct(s)!, call: bid(1, 'NT') });
    expect(out.ok).toBe(false);
  });

  it('1♠ P P P: contract 1♠ and the opener declares', () => {
    const s = runAuction(newDeal(SEED, 0), [bid(1, 'S'), PASS, PASS, PASS]);
    expect(s.contract).toEqual({ level: 1, strain: 'S', declarer: next(0) });
    expect(s.phase).toBe('play');
  });

  it('house rule R4: 1♥ P 2♥ P P P makes the RAISER (final bidder) declarer, not the opener', () => {
    const s = runAuction(newDeal(SEED, 0), [bid(1, 'H'), PASS, bid(2, 'H'), PASS, PASS, PASS]);
    expect(s.contract).toEqual({ level: 2, strain: 'H', declarer: next(next(next(0))) });
  });

  it('house rule R4: in a suit contract the player on declarer’s right (next counter-clockwise) leads first', () => {
    const s = runAuction(newDeal(SEED, 3), [PASS, bid(1, 'S'), PASS, PASS, PASS]);
    expect(s.contract!.declarer).toBe(next(next(3)));
    expect(s.currentTrick!.leader).toBe(next(s.contract!.declarer));
    expect(seatToAct(s)).toBe(next(s.contract!.declarer));
  });

  it('house rule R4 (Ryan, round 10): in a no-trump contract the dealer leads first, whoever declares', () => {
    for (const dealer of [0, 1, 2, 3] as const) {
      for (const opener of [0, 1, 2, 3]) {
        // Pass round to the opener, then 1NT and three passes.
        const passes = (opener - next(dealer) + 4) % 4;
        const s = runAuction(newDeal(SEED, dealer), [...Array(passes).fill(PASS), bid(1, 'NT'), PASS, PASS, PASS]);
        expect(s.contract!.declarer).toBe(opener);
        expect(s.currentTrick!.leader).toBe(dealer);
      }
    }
  });

  it('four passes is a pass-out', () => {
    const s = runAuction(newDeal(SEED, 0), [PASS, PASS, PASS, PASS]);
    expect(s.phase).toBe('passedOut');
    expect(auctionStatus(s.auction).kind).toBe('passedOut');
  });

  it('three passes before any bid do not end the auction', () => {
    const s = runAuction(newDeal(SEED, 0), [PASS, PASS, PASS]);
    expect(s.phase).toBe('auction');
  });

  it('after 7NT only passes are possible', () => {
    const s = runAuction(newDeal(SEED, 0), [bid(7, 'NT')]);
    expect(legalCalls(s.auction)).toEqual([PASS]);
  });

  it('there is no double or redouble', () => {
    const calls = legalCalls(newDeal(SEED, 0).auction);
    expect(calls.every((c) => c.type === 'pass' || c.type === 'bid')).toBe(true);
    expect(calls).toHaveLength(36); // Pass + 35 bids
  });

  it('targets: declarers need 6+level, defenders need 8−level, and together they total 14', () => {
    const expected: Record<Level, [number, number]> = { 1: [7, 7], 2: [8, 6], 3: [9, 5], 4: [10, 4], 5: [11, 3], 6: [12, 2], 7: [13, 1] };
    for (const level of LEVELS) {
      expect([declarerTarget(level), defenderTarget(level)]).toEqual(expected[level]);
    }
  });
});
