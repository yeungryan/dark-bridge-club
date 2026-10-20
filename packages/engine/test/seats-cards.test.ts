import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardId, dealHands, fullDeck, hcp, next, partner, Rng, SEATS, seatsFrom, type Seat } from '../src';

describe('S01 seats and direction', () => {
  it('next() cycles through all four seats and returns home after four steps', () => {
    for (const s of SEATS) {
      expect(new Set(seatsFrom(s)).size).toBe(4);
      expect(next(next(next(next(s))))).toBe(s);
    }
  });

  it('partner is two steps counter-clockwise, and partnership is symmetric', () => {
    for (const s of SEATS) {
      expect(partner(s)).toBe(next(next(s)));
      expect(partner(partner(s))).toBe(s);
      expect(partner(s)).not.toBe(s);
    }
  });

  it('no module other than seats.ts does its own seat arithmetic', () => {
    const dir = join(__dirname, '../src');
    for (const file of readdirSync(dir)) {
      if (file === 'seats.ts') continue;
      const source = readFileSync(join(dir, file), 'utf8');
      expect(source, file).not.toMatch(/%\s*4\b/);
      expect(source, file).not.toMatch(/\+\s*[123]\s*\)\s*%/);
    }
  });
});

describe('S01 cards and the deal', () => {
  it('a full deck is 52 unique cards worth 40 HCP', () => {
    const deck = fullDeck();
    expect(new Set(deck.map(cardId)).size).toBe(52);
    expect(hcp(deck)).toBe(40);
  });

  it('10,000 deals always give 13 unique cards to each seat', () => {
    const seeds = new Rng([1, 2, 3, 4]);
    for (let i = 0; i < 10_000; i++) {
      const hands = dealHands(seeds.deriveSeed(), (i % 4) as Seat);
      const all = SEATS.flatMap((s) => hands[s].map(cardId));
      expect(new Set(all).size).toBe(52);
      for (const s of SEATS) expect(hands[s]).toHaveLength(13);
    }
  });

  it('cards land in every seat equally often (chi-square, no seat bias)', () => {
    const deals = 10_000;
    const seeds = new Rng([9, 8, 7, 6]);
    const counts = new Map<string, number>();
    for (let i = 0; i < deals; i++) {
      const hands = dealHands(seeds.deriveSeed(), 0);
      for (const s of SEATS) for (const c of hands[s]) {
        const key = `${cardId(c)}@${s}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const expected = deals / 4;
    let chi2 = 0;
    for (const card of fullDeck()) for (const s of SEATS) {
      const observed = counts.get(`${cardId(card)}@${s}`) ?? 0;
      chi2 += (observed - expected) ** 2 / expected;
    }
    // 156 degrees of freedom; 211 is roughly the 99.9th percentile.
    expect(chi2).toBeLessThan(211);
  });

  it('the same seed and dealer always produce the same deal', () => {
    const seed = '0123456789abcdef0123456789abcdef';
    expect(dealHands(seed, 2)).toEqual(dealHands(seed, 2));
    expect(dealHands(seed, 2)).not.toEqual(dealHands('fedcba9876543210fedcba9876543210', 2));
  });

  it('counts high-card points as A=4, K=3, Q=2, J=1', () => {
    expect(hcp([{ suit: 'S', rank: 14 }, { suit: 'H', rank: 13 }, { suit: 'D', rank: 12 }, { suit: 'C', rank: 11 }, { suit: 'C', rank: 10 }])).toBe(10);
  });
});

describe('Rng', () => {
  it('int(n) stays in range and covers every value', () => {
    const rng = new Rng([5, 6, 7, 8]);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = rng.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
  });

  it('state round-trips, so sessions can be saved and resumed mid-stream', () => {
    const a = Rng.fromSeed('00000000000000000000000000000001');
    a.int(10);
    const b = new Rng(a.state());
    expect(b.nextUint32()).toBe(a.nextUint32());
  });
});
