import { describe, expect, it } from 'vitest';
import {
  bid,
  fullDeck,
  newDeal,
  newDealWithHands,
  next,
  partner,
  PASS,
  Rng,
  sameCard,
  seatToAct,
  sortHand,
  type Call,
  type Card,
  type DealState,
  type PerSeat,
  type Rank,
  type Seat,
  type Suit,
} from '../src';
import { botCall, safeLevels } from '../src/bots';
import { act, runAuction, seatView } from './helpers';

// Round 15 bidding: bots bid "just enough" to win the auction, within the level they think
// their side can make, and never raise a partner who already holds the contract.

const RANK: Record<string, Rank> = { A: 14, K: 13, Q: 12, J: 11, T: 10, '10': 10 };

/** "AKQ2.K32.Q2.A432" = spades.hearts.diamonds.clubs, as bridge books write it. */
function hand(text: string): Card[] {
  const order: Suit[] = ['S', 'H', 'D', 'C'];
  const cards = text.split('.').flatMap((part, i) =>
    (part.match(/10|[2-9TJQKA]/g) ?? []).map((r) => ({ suit: order[i]!, rank: RANK[r] ?? (Number(r) as Rank) })),
  );
  if (cards.length !== 13) throw new Error(`${text} has ${cards.length} cards`);
  return cards;
}

/**
 * The view of whoever acts after `calls`, holding `mine`. The other hands get the rest of the
 * deck in order: the bot never sees them, so they don't matter.
 */
function viewAfter(mine: string, calls: Call[], dealer: Seat = 0) {
  let seat = next(dealer);
  for (let i = 0; i < calls.length; i++) seat = next(seat);
  const own = hand(mine);
  const rest = fullDeck().filter((c) => !own.some((o) => sameCard(o, c)));
  const others = [0, 1, 2].map((i) => rest.slice(i * 13, i * 13 + 13));
  let k = 0;
  const hands = [0, 1, 2, 3].map((s) => (s === seat ? own : others[k++]!)).map(sortHand) as unknown as PerSeat<Card[]>;
  const state = runAuction(newDealWithHands(hands, dealer), calls);
  expect(seatToAct(state)).toBe(seat);
  return { view: seatView(state, seat), seat };
}

const call = (mine: string, calls: Call[], dealer: Seat = 0) => {
  const { view, seat } = viewAfter(mine, calls, dealer);
  return botCall(view, seat);
};

describe('S22 bot bidding (round 15)', () => {
  it("Ryan's example: partner opened 2♣, the opponent passed, so a bot with club support passes (no 3♣)", () => {
    expect(call('K32.Q32.K32.Q432', [bid(2, 'C'), PASS])).toEqual(PASS);
    expect(call('K32.Q32.K32.Q432', [bid(1, 'C'), PASS])).toEqual(PASS);
    // Even with a good hand: partner already holds the contract.
    expect(call('K32.AQ3.K32.KQ43', [bid(1, 'C'), PASS])).toEqual(PASS);
  });

  it("the other pair works the same way: an opponent's partner doesn't raise uncontested either", () => {
    // Seat 1 passes, seat 2 opens 1♥, seat 3 passes; seat 0 (seat 2's partner) has hearts.
    expect(call('K32.Q432.K32.Q32', [PASS, bid(1, 'H'), PASS])).toEqual(PASS);
  });

  it("rule 3: partner bid ♠, an opponent overcalled, a bot with 3 spades and values raises to the cheapest winning level", () => {
    const { view, seat } = viewAfter('K32.32.AQ32.K432', [bid(1, 'S'), bid(2, 'H')]);
    expect(botCall(view, seat)).toEqual(bid(2, 'S'));
    expect(safeLevels(view, seat).S).toBeGreaterThanOrEqual(2);
  });

  it('rule 3: a fit beats switching to a new suit', () => {
    // Three spades and a five-card club suit: support partner rather than bid clubs.
    expect(call('K32.3.Q32.AKJ432', [bid(1, 'S'), bid(2, 'H')])).toEqual(bid(2, 'S'));
  });

  it('rule 3: never raises past the safe level, even with support', () => {
    const { view, seat } = viewAfter('K32.32.AQ32.K432', [bid(1, 'S'), bid(4, 'H')]);
    expect(safeLevels(view, seat).S).toBeLessThan(4);
    expect(botCall(view, seat)).toEqual(PASS);
  });

  it('competes in its own good suit over an opponent, and passes with nothing to say', () => {
    // An opponent opened 1♦; a strong six-card spade suit overcalls at the cheapest level.
    expect(call('AKQJ32.K32.32.A2', [bid(1, 'D')])).toEqual(bid(1, 'S'));
    expect(call('5432.432.432.432', [bid(1, 'D')])).toEqual(PASS);
  });

  it('rule 1: with a singleton in partner’s ♥ and a strong six-card club suit, offers clubs once', () => {
    const me = 'A32.2.K32.AKQ432';
    expect(call(me, [bid(1, 'H'), PASS])).toEqual(bid(2, 'C'));
    // Partner insists on hearts: no second switch, no bidding war.
    expect(call(me, [bid(1, 'H'), PASS, bid(2, 'C'), PASS, bid(2, 'H'), PASS])).toEqual(PASS);
    expect(call(me, [bid(1, 'H'), PASS, bid(2, 'C'), PASS, bid(3, 'H'), PASS])).toEqual(PASS);
  });

  it('rule 1: the partner who was switched on passes rather than re-bidding their own suit', () => {
    // I opened 1♥ with six hearts and a club void; partner offered 2♣. I don't bid hearts again.
    expect(call('A32.AKQ432.KQ32.', [])).toEqual(bid(1, 'H'));
    expect(call('A32.AKQ432.KQ32.', [PASS, bid(1, 'H'), PASS, bid(2, 'C'), PASS], 3)).toEqual(PASS);
  });

  it('rule 1 needs a misfit: with 3+ cards in partner’s suit it just passes', () => {
    expect(call('A2.32.K32.AKQ432', [bid(1, 'D'), PASS])).toEqual(PASS);
  });

  it('rule 2: a strong eight-card spade suit opens above level 1, at most 4', () => {
    const opening = call('AKQJ10987.A2.32.2', []);
    expect(opening.type).toBe('bid');
    if (opening.type === 'bid') {
      expect(opening.strain).toBe('S');
      expect(opening.level).toBeGreaterThanOrEqual(2);
      expect(opening.level).toBeLessThanOrEqual(4);
    }
  });

  it('an ordinary 13-point hand opens at level 1; 15–17 balanced opens 1NT; a weak hand passes', () => {
    expect(call('AK32.K32.Q32.J32', [])).toEqual(bid(1, 'S'));
    expect(call('AK32.K432.Q32.J2', [])).toEqual(bid(1, 'S'));
    expect(call('AK3.K432.Q32.KJ2', [])).toEqual(bid(1, 'NT'));
    expect(call('5432.432.432.432', [])).toEqual(PASS);
    // A long suit without the strength to make tricks on its own is not a blocking hand.
    expect(call('J8765432.32.32.2', [])).toEqual(PASS);
  });
});

/** Every bid in an all-bot auction, with what the bidder could see at the time. */
function botAuctions(count: number, check: (state: DealState, seat: Seat, made: Call) => void): DealState[] {
  const rng = Rng.fromSeed('5eed5eed5eed5eed5eed5eed5eed0015');
  const done: DealState[] = [];
  for (let i = 0; i < count; i++) {
    let s = newDeal(rng.deriveSeed(), (i % 4) as Seat);
    while (s.phase === 'auction') {
      const seat = seatToAct(s)!;
      const made = botCall(seatView(s, seat), seat);
      check(s, seat, made);
      s = act(s, { type: 'call', seat, call: made });
    }
    done.push(s);
  }
  return done;
}

describe('S22 bot bidding properties (500 random deals)', () => {
  it('always makes a legal call, and never bids above its safe level (except an opening 1-bid)', () => {
    botAuctions(500, (s, seat, made) => {
      const view = seatView(s, seat);
      expect(view.legalCalls).toContainEqual(made);
      if (made.type !== 'bid') return;
      const opening = !s.auction.calls.some((c) => c.call.type === 'bid');
      if (opening && made.level === 1) return;
      expect(made.level).toBeLessThanOrEqual(safeLevels(view, seat)[made.strain]);
    });
  });

  it('never raises a partner who already holds the contract, and switches suit on partner at most once', () => {
    botAuctions(500, (s, seat, made) => {
      if (made.type !== 'bid') return;
      const bids = s.auction.calls.filter((c) => c.call.type === 'bid');
      const last = bids[bids.length - 1];
      if (last?.seat === partner(seat) && last.call.type === 'bid') expect(made.strain).not.toBe(last.call.strain);
    });
    for (const s of botAuctions(500, () => {})) {
      for (const seat of [0, 1, 2, 3] as Seat[]) {
        let partnerStrain: string | null = null;
        let switches = 0;
        for (const c of s.auction.calls) {
          if (c.call.type !== 'bid') continue;
          if (c.seat === partner(seat)) partnerStrain = c.call.strain;
          else if (c.seat === seat && partnerStrain !== null && c.call.strain !== partnerStrain) switches++;
        }
        expect(switches).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic: the same view always gets the same call', () => {
    const first: Call[] = [];
    botAuctions(50, (_s, _seat, made) => first.push(made));
    const second: Call[] = [];
    botAuctions(50, (_s, _seat, made) => second.push(made));
    expect(second).toEqual(first);
  });
});
