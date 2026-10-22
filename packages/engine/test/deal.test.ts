import { describe, expect, it } from 'vitest';
import {
  applyDealAction,
  bid,
  cardId,
  declarerTarget,
  defenderTarget,
  legalCalls,
  LEVELS,
  newDeal,
  newDealWithHands,
  PASS,
  Rng,
  seatToAct,
  type Call,
  type DealState,
} from '../src';
import { act, playUntil, randomLegal, runAuction, suitHands } from './helpers';

// Seat 0 holds every spade, 1 every heart, 2 every diamond, 3 every club.
const hands = suitHands({ 0: 'S', 1: 'H', 2: 'D', 3: 'C' });
const toChoice = (s: DealState) => s.phase !== 'play';

describe('S04 clinch', () => {
  for (const level of LEVELS) {
    it(`level ${level}: a made contract clinches on trick ${declarerTarget(level)}`, () => {
      let s = runAuction(newDealWithHands(hands, 3), [bid(level, 'S'), PASS, PASS, PASS]);
      s = playUntil(s, toChoice);
      expect(s.clinch).toMatchObject({ side: 'declarers', trickNumber: declarerTarget(level) });
    });

    it(`level ${level}: a defeated contract clinches on trick ${defenderTarget(level)}`, () => {
      let s = runAuction(newDealWithHands(hands, 3), [bid(level, 'NT'), PASS, PASS, PASS]);
      s = playUntil(s, toChoice);
      expect(s.clinch).toMatchObject({ side: 'defenders', trickNumber: defenderTarget(level) });
    });
  }

  it('7♠ clinches on the last trick, so the deal completes as played out', () => {
    let s = runAuction(newDealWithHands(hands, 3), [bid(7, 'S'), PASS, PASS, PASS]);
    s = playUntil(s, toChoice);
    expect(s.phase).toBe('complete');
    expect(s.result).toMatchObject({ winner: 'declarers', playedOut: true, overUnder: 0 });
  });

  it('without Play on, over/undertricks are not recorded', () => {
    let s = runAuction(newDealWithHands(hands, 3), [bid(1, 'S'), PASS, PASS, PASS]);
    s = act(playUntil(s, toChoice), { type: 'endAtClinch' });
    expect(s.result).toMatchObject({ winner: 'declarers', reason: 'made', playedOut: false, overUnder: null });
  });

  it('any seat may choose Play on, and the trick winner leads the next trick', () => {
    let s = runAuction(newDealWithHands(hands, 3), [bid(1, 'S'), PASS, PASS, PASS]);
    s = playUntil(s, toChoice);
    s = act(s, { type: 'playOn', seat: 3 });
    expect(s.phase).toBe('play');
    expect(s.currentTrick!.leader).toBe(s.tricks[s.tricks.length - 1]!.winner);
  });

  it('the result cannot change after the clinch, even when played out', () => {
    // Declarers are defeated early in 4NT, then win nothing either way: result stays "defeated".
    let s = runAuction(newDealWithHands(hands, 3), [bid(4, 'NT'), PASS, PASS, PASS]);
    s = playUntil(s, toChoice);
    s = act(s, { type: 'playOn', seat: 0 });
    s = playUntil(s, toChoice);
    expect(s.result).toMatchObject({ winner: 'defenders', reason: 'defeated', playedOut: true, overUnder: -10 });
  });

  it('the clinch choice only accepts Play on or the timer', () => {
    let s = runAuction(newDealWithHands(hands, 3), [bid(1, 'S'), PASS, PASS, PASS]);
    s = playUntil(s, toChoice);
    expect(seatToAct(s)).toBeNull();
    expect(applyDealAction(s, { type: 'play', seat: 0, card: s.hands[0][0]! }).ok).toBe(false);
  });
});

describe('S04 concession', () => {
  const started = () => runAuction(newDealWithHands(hands, 3), [bid(3, 'S'), PASS, PASS, PASS]);

  it('needs the partner to accept; then the other side wins', () => {
    let s = act(started(), { type: 'proposeConcession', seat: 1 }); // a defender
    expect(applyDealAction(s, { type: 'acceptConcession', seat: 0 }).ok).toBe(false); // an opponent
    expect(applyDealAction(s, { type: 'acceptConcession', seat: 1 }).ok).toBe(false); // the proposer
    s = act(s, { type: 'acceptConcession', seat: 3 });
    expect(s.phase).toBe('complete');
    expect(s.result).toMatchObject({ winner: 'declarers', reason: 'conceded', overUnder: null });
  });

  it('a concession by the declaring side hands the deal to the defenders', () => {
    let s = act(started(), { type: 'proposeConcession', seat: 2 });
    s = act(s, { type: 'acceptConcession', seat: 0 });
    expect(s.result).toMatchObject({ winner: 'defenders', reason: 'conceded' });
  });

  it('declined or expired proposals change nothing', () => {
    const before = started();
    let s = act(before, { type: 'proposeConcession', seat: 1 });
    s = act(s, { type: 'declineConcession', seat: 3 });
    expect(s).toEqual(before);
    s = act(act(s, { type: 'proposeConcession', seat: 1 }), { type: 'expireConcession' });
    expect(s).toEqual(before);
  });

  it('only one proposal at a time, and play continues while it is open', () => {
    let s = act(started(), { type: 'proposeConcession', seat: 1 });
    expect(applyDealAction(s, { type: 'proposeConcession', seat: 2 }).ok).toBe(false);
    s = act(s, { type: 'play', seat: 1, card: s.hands[1][0]! });
    expect(s.concession).not.toBeNull();
  });

  it('cannot concede during the auction or after the clinch', () => {
    expect(applyDealAction(newDealWithHands(hands, 3), { type: 'proposeConcession', seat: 0 }).ok).toBe(false);
    const clinched = playUntil(started(), toChoice);
    expect(applyDealAction(clinched, { type: 'proposeConcession', seat: 1 }).ok).toBe(false);
  });

  it('a pending concession is cancelled if the deal clinches first', () => {
    let s = playUntil(started(), (x) => x.tricks.length === 8);
    s = act(s, { type: 'proposeConcession', seat: 1 });
    expect(s.clinch).toBeNull();
    s = playUntil(s, toChoice); // trick 9 is the clinch for 3♠
    expect(s.clinch).toMatchObject({ trickNumber: 9 });
    expect(s.concession).toBeNull();
  });
});

describe('S03/S04 property test', () => {
  it('5,000 random legal deals: every card played once, 4 cards a trick, result consistent', () => {
    const rng = new Rng([42, 42, 42, 42]);
    let completed = 0;
    for (let i = 0; i < 5_000; i++) {
      let s = newDeal(rng.deriveSeed(), rng.pick([0, 1, 2, 3] as const));
      while (s.phase === 'auction') {
        const options = legalCalls(s.auction);
        const call: Call = rng.int(10) < 6 || options.length === 1 ? PASS : options[1 + rng.int(Math.min(5, options.length - 1))]!;
        s = act(s, { type: 'call', seat: seatToAct(s)!, call });
      }
      if (s.phase === 'passedOut') continue;
      s = playUntil(s, toChoice, randomLegal(rng));
      if (s.phase === 'awaitingPlayOn') {
        s = act(s, { type: 'playOn', seat: 0 });
        s = playUntil(s, toChoice, randomLegal(rng));
      }
      expect(s.phase).toBe('complete');
      expect(s.tricks).toHaveLength(13);
      const played = s.tricks.flatMap((t) => t.cards.map((p) => cardId(p.card)));
      expect(new Set(played).size).toBe(52);
      for (const t of s.tricks) expect(t.cards).toHaveLength(4);
      const r = s.result!;
      expect(r.declarerTricks + r.defenderTricks).toBe(13);
      expect(r.winner === 'declarers').toBe(r.declarerTricks >= declarerTarget(s.contract!.level));
      completed++;
    }
    expect(completed).toBeGreaterThan(3_000);
  });
});
