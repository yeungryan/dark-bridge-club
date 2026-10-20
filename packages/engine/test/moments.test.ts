import { describe, expect, it } from 'vitest';
import {
  allMoments,
  AWARDS,
  awardCandidates,
  bid,
  dealMoments,
  MOMENT_CAPTIONS,
  nightAwards,
  nightMoments,
  PASS,
  RANKS,
  selectAwards,
  type Award,
  type AwardKind,
  type Call,
  type Card,
  type DealHistory,
  type DealState,
  type NightHistory,
  type PerSeat,
  type ProfileId,
  type Suit,
} from '../src';
import { act, highestLegal, newDealWithHands, playUntil, runAuction, suitHands } from './helpers';

// Seat order deliberately differs from profile order and pair order, so a seat/profile mix-up shows.
const SEATING: PerSeat<ProfileId> = { 0: 'darren', 1: 'kim', 2: 'adrian', 3: 'ryan' };
const PAIRS = { A: ['kim', 'ryan'], B: ['darren', 'adrian'] } as const;
const NAMES: Record<string, string> = { darren: 'Darren', kim: 'Kim', adrian: 'Adrian', ryan: 'Ryan' };
const name = (id: ProfileId) => NAMES[id]!;

const cards = (suit: Suit, ranks: readonly number[]): Card[] => ranks.map((rank) => ({ suit, rank }) as Card);
const range = (lo: number, hi: number) => RANKS.filter((r) => r >= lo && r <= hi);

/** Play a whole game through the real reducer (dealer 0, so calls start with seat 0). */
function game(
  dealNumber: number,
  hands: PerSeat<Card[]>,
  calls: Call[],
  opts: { playOn?: boolean; thinkMs?: PerSeat<number> } = {},
): DealHistory {
  let s: DealState = runAuction(newDealWithHands(hands, 0), calls);
  if (s.phase !== 'passedOut') {
    s = playUntil(s, (x) => x.phase !== 'play', highestLegal);
    if (s.phase === 'awaitingPlayOn') {
      if (opts.playOn) {
        s = act(s, { type: 'playOn', seat: 0 });
        s = playUntil(s, (x) => x.phase !== 'play', highestLegal);
      } else {
        s = act(s, { type: 'endAtClinch' });
      }
    }
  }
  return {
    dealNumber,
    dealer: 0,
    contract: s.contract,
    result: s.result,
    hands: s.originalHands,
    tricks: s.tricks,
    thinkMs: opts.thinkMs ?? null,
  };
}

const SUITS4 = suitHands({ 0: 'S', 1: 'H', 2: 'D', 3: 'C' });

/** Darren (seat 0) makes 1♠ exactly at the clinch: no moments. Pair B wins. */
const oneSpade = (n: number, opts = {}) => game(n, SUITS4, [bid(1, 'S'), PASS, PASS, PASS], opts);
/** Darren makes 6♠ (clinched on trick 12, led in trumps). Pair B wins. */
const sixSpades = (n: number) => game(n, SUITS4, [bid(6, 'S'), PASS, PASS, PASS]);
/** Adrian (seat 2) bids 7♥; Ryan leads ♣A, Kim ruffs with ♥A: clinched on trick 1. Pair A wins. */
const trumpOver = (n: number, opts = {}) => game(n, SUITS4, [PASS, PASS, bid(7, 'H'), PASS, PASS, PASS], opts);
/** Darren 7♠: wins 12 tricks, then Ryan's ♣3 beats his ♣2 on trick 13. Pair A wins. */
const heartbreakHands: PerSeat<Card[]> = {
  0: [...cards('S', range(3, 14)), ...cards('C', [2])],
  1: cards('H', range(2, 14)),
  2: cards('D', range(2, 14)),
  3: [...cards('C', range(3, 14)), ...cards('S', [2])],
};
const heartbreak = (n: number) => game(n, heartbreakHands, [bid(7, 'S'), PASS, PASS, PASS]);
/** Same, but Darren keeps ♣A for trick 13 and makes it: a Decider without a Heartbreak. */
const deciderHands: PerSeat<Card[]> = {
  0: [...cards('S', range(3, 14)), ...cards('C', [14])],
  1: cards('H', range(2, 14)),
  2: cards('D', range(2, 14)),
  3: [...cards('C', range(2, 13)), ...cards('S', [2])],
};
const deciderMade = (n: number) => game(n, deciderHands, [bid(7, 'S'), PASS, PASS, PASS]);
/** Darren (10 HCP) + Adrian (0 HCP, a Yarborough) make 1♠ against Kim (10) + Ryan (20). */
const robberyHands: PerSeat<Card[]> = {
  0: cards('S', range(2, 14)),
  1: cards('H', range(2, 14)),
  2: [...cards('D', range(2, 9)), ...cards('C', range(2, 6))],
  3: [...cards('D', range(10, 14)), ...cards('C', range(7, 14))],
};
const robbery = (n: number) => game(n, robberyHands, [bid(1, 'S'), PASS, PASS, PASS]);
const passOut = (n: number) => game(n, SUITS4, [PASS, PASS, PASS, PASS]);

const night = (deals: DealHistory[]): NightHistory => ({ seating: SEATING, pairs: PAIRS, deals });
const kinds = (ms: { kind: string }[]) => ms.map((m) => m.kind);
const momentsOf = (d: DealHistory) => dealMoments(d, night([d]));

describe('scripted games are what they claim', () => {
  it('heartbreak game: defenders clinch on trick 13 with declarers on 12', () => {
    const d = heartbreak(1);
    expect(d.result).toMatchObject({ winner: 'defenders', declarerTricks: 12, playedOut: true });
    expect(d.tricks![12]!.winner).toBe(3);
  });
  it('trump-over game: clinched on trick 1 by Kim', () => {
    const d = trumpOver(1);
    expect(d.tricks).toHaveLength(1);
    expect(d.tricks![0]!.winner).toBe(1);
  });
});

describe('Grand Ambition', () => {
  it('fires for a made 6♠ and a failed 7♥', () => {
    expect(momentsOf(sixSpades(1)).find((m) => m.kind === 'grandAmbition')).toMatchObject({
      players: ['darren', 'adrian'],
      payload: { level: 6, strain: 'S', made: 1 },
    });
    expect(momentsOf(trumpOver(1)).find((m) => m.kind === 'grandAmbition')).toMatchObject({
      players: ['adrian', 'darren'],
      payload: { level: 7, made: 0 },
    });
  });
  it('does not fire below level 6', () => {
    expect(kinds(momentsOf(oneSpade(1)))).not.toContain('grandAmbition');
  });
});

describe('Robbery', () => {
  it('fires when declarers make it with fewer HCP', () => {
    expect(momentsOf(robbery(1)).find((m) => m.kind === 'robbery')).toMatchObject({
      players: ['darren', 'adrian'],
      payload: { hcpGap: 20 },
    });
  });
  it('does not fire with equal HCP, or when declarers lose', () => {
    expect(kinds(momentsOf(oneSpade(1)))).not.toContain('robbery');
    expect(kinds(momentsOf(heartbreak(1)))).not.toContain('robbery');
  });
});

describe('Heartbreak', () => {
  it('fires when set on the trick that would have made it', () => {
    expect(momentsOf(heartbreak(1)).find((m) => m.kind === 'heartbreak')).toMatchObject({
      players: ['darren', 'adrian'],
      payload: { trickNumber: 13, level: 7 },
    });
  });
  it('does not fire for a heavy defeat or a made contract', () => {
    expect(kinds(momentsOf(trumpOver(1)))).not.toContain('heartbreak');
    expect(kinds(momentsOf(deciderMade(1)))).not.toContain('heartbreak');
  });
});

describe('The Decider', () => {
  it('fires when both sides were one away, crediting the clinching side', () => {
    expect(momentsOf(deciderMade(1)).find((m) => m.kind === 'decider')).toMatchObject({
      players: ['darren', 'adrian'],
      payload: { side: 'declarers', trickNumber: 13 },
    });
    expect(momentsOf(heartbreak(1)).find((m) => m.kind === 'decider')).toMatchObject({
      players: ['ryan', 'kim'],
      payload: { side: 'defenders' },
    });
  });
  it('does not fire for a one-sided game', () => {
    expect(kinds(momentsOf(sixSpades(1)))).not.toContain('decider');
    expect(kinds(momentsOf(trumpOver(1)))).not.toContain('decider');
  });
});

describe('Trump Card', () => {
  it('fires when a ruff wins the clinching trick', () => {
    expect(momentsOf(trumpOver(1)).find((m) => m.kind === 'trumpCard')).toMatchObject({
      players: ['kim'],
      payload: { card: '♥A', trickNumber: 1 },
    });
  });
  it('does not fire when the clinching trick was led in trumps, or an early ruff', () => {
    // 6♠: trick 1 is a ruff, but the clinch (trick 12) is led in spades.
    expect(kinds(momentsOf(sixSpades(1)))).not.toContain('trumpCard');
    // The heartbreak clinch is won by a club on a club lead.
    expect(kinds(momentsOf(heartbreak(1)))).not.toContain('trumpCard');
  });
});

describe('Yarborough', () => {
  it('fires for a hand with nothing above a 9', () => {
    expect(momentsOf(robbery(1)).filter((m) => m.kind === 'yarborough')).toEqual([
      { kind: 'yarborough', dealNumber: 1, players: ['adrian'], payload: {} },
    ]);
  });
  it('fires on a pass-out too (hands are revealed)', () => {
    const hands = { ...robberyHands };
    const d = game(2, hands, [PASS, PASS, PASS, PASS]);
    expect(kinds(momentsOf(d))).toEqual(['yarborough']);
  });
  it('does not fire when every hand has a 10 or better', () => {
    expect(kinds(momentsOf(oneSpade(1)))).not.toContain('yarborough');
  });
});

describe('Powerhouse Benched', () => {
  it('fires when the top-HCP player defended a made contract', () => {
    expect(momentsOf(robbery(1)).find((m) => m.kind === 'powerhouseBenched')).toMatchObject({
      players: ['ryan'],
      payload: { hcp: 20 },
    });
  });
  it('does not fire on a tie for most HCP, or when the powerhouse declared', () => {
    expect(kinds(momentsOf(oneSpade(1)))).not.toContain('powerhouseBenched');
    expect(kinds(momentsOf(deciderMade(1)))).not.toContain('powerhouseBenched');
  });
});

describe('Comeback Night', () => {
  it('fires when the night winner was 3 down', () => {
    const n = night([oneSpade(1), oneSpade(2), oneSpade(3), trumpOver(4), trumpOver(5), trumpOver(6), trumpOver(7)]);
    expect(nightMoments(n).find((m) => m.kind === 'comebackNight')).toEqual({
      kind: 'comebackNight',
      dealNumber: 7,
      players: ['kim', 'ryan'],
      payload: { maxDeficit: 3, wins: 4, losses: 3 },
    });
  });
  it('does not fire for a 2-game deficit, or when the leader holds on', () => {
    expect(nightMoments(night([oneSpade(1), oneSpade(2), trumpOver(3), trumpOver(4), trumpOver(5)]))).toEqual([]);
    expect(kinds(nightMoments(night([oneSpade(1), oneSpade(2), oneSpade(3), trumpOver(4)])))).not.toContain('comebackNight');
  });
});

describe('Streak', () => {
  it('reports the longest run of 4+ per pair; pass-outs do not break it', () => {
    const n = night([trumpOver(1), trumpOver(2), passOut(3), trumpOver(4), trumpOver(5), trumpOver(6), oneSpade(7)]);
    expect(nightMoments(n).filter((m) => m.kind === 'streak')).toEqual([
      { kind: 'streak', dealNumber: 6, players: ['kim', 'ryan'], payload: { length: 5 } },
    ]);
  });
  it('does not fire for 3 in a row', () => {
    expect(kinds(nightMoments(night([trumpOver(1), trumpOver(2), trumpOver(3), oneSpade(4)])))).not.toContain('streak');
  });
});

describe('missing data', () => {
  it('pass-outs, missing hands/tricks and unfinished games do not throw', () => {
    const six = sixSpades(5);
    const deals: DealHistory[] = [
      passOut(1),
      { ...six, dealNumber: 2, hands: null, tricks: null },
      { ...six, dealNumber: 3, result: null, tricks: six.tricks!.slice(0, 5) },
      { dealNumber: 4, dealer: 0, contract: null, result: null, hands: null, tricks: null, thinkMs: null },
    ];
    const n = night(deals);
    expect(() => allMoments(n)).not.toThrow();
    expect(() => nightAwards(n)).not.toThrow();
    // A contract with no saved cards still shows its ambition; nothing card-based is guessed.
    expect(kinds(dealMoments(deals[1]!, n))).toEqual(['grandAmbition']);
    expect(kinds(dealMoments(deals[0]!, n))).toEqual([]);
    expect(nightMoments(night([passOut(1)]))).toEqual([]);
  });
});

// ---- Awards -----------------------------------------------------------------------------------

const candidate = (n: NightHistory, kind: AwardKind) => awardCandidates(n).find((a) => a.kind === kind);

describe('award candidates', () => {
  const comeback = night([oneSpade(1), oneSpade(2), oneSpade(3), trumpOver(4), trumpOver(5), trumpOver(6), trumpOver(7)]);

  it('MVP: most clinching cards', () => {
    expect(candidate(comeback, 'mvp')).toEqual({ kind: 'mvp', profile: 'kim', score: 4, payload: { clinches: 4 } });
    expect(candidate(night([oneSpade(1)]), 'mvp')).toBeUndefined();
  });
  it('The Wall: most contracts set (partner tie → more tricks won)', () => {
    expect(candidate(comeback, 'wall')).toMatchObject({ profile: 'kim', score: 4 });
    expect(candidate(night([oneSpade(1), oneSpade(2)]), 'wall')).toBeUndefined();
  });
  it('Daredevil: highest average level, 2+ contracts', () => {
    expect(candidate(night([sixSpades(1), deciderMade(2)]), 'daredevil')).toMatchObject({
      profile: 'darren',
      score: 6.5,
      payload: { contracts: 2 },
    });
    expect(candidate(night([sixSpades(1)]), 'daredevil')).toBeUndefined();
    expect(candidate(night([oneSpade(1), oneSpade(2)]), 'daredevil')).toBeUndefined();
  });
  it('Heist of the Night: the biggest Robbery, to the declarer', () => {
    expect(candidate(night([robbery(1)]), 'heist')).toMatchObject({ profile: 'darren', score: 20 });
    expect(candidate(night([oneSpade(1)]), 'heist')).toBeUndefined();
  });
  it('Heartbreak Hotel: most Heartbreaks as declarer', () => {
    expect(candidate(night([heartbreak(1)]), 'heartbreakHotel')).toMatchObject({ profile: 'darren', score: 1 });
    expect(candidate(night([trumpOver(1)]), 'heartbreakHotel')).toBeUndefined();
  });
  it('Epic Attic: the biggest overbid, never counting sets that were not played', () => {
    // 7♥ beaten on the first set: the game stopped there, so it is one short, not thirteen.
    expect(candidate(night([heartbreak(1), trumpOver(2)]), 'epicAttic')).toMatchObject({
      profile: 'adrian',
      score: 1,
      payload: { tricksShort: 1, level: 7, strain: 'H' },
    });
    // One short on the very last set is a Heartbreak, not an attic.
    expect(candidate(night([heartbreak(1)]), 'epicAttic')).toBeUndefined();
    // A made contract is never an attic.
    expect(candidate(night([oneSpade(1)]), 'epicAttic')).toBeUndefined();
  });
  it('Why Don’t You Blog About It: the clinching card of the most dramatic game', () => {
    // Heartbreak game: grandAmbition 1 + heartbreak 2 + decider 2 = 5; Ryan played the clinching ♣3.
    expect(candidate(night([trumpOver(1), heartbreak(2), trumpOver(3)]), 'blogAboutIt')).toMatchObject({
      profile: 'ryan',
      score: 5,
      payload: { dealNumber: 2 },
    });
    // Ties go to the later game.
    expect(candidate(night([trumpOver(1), trumpOver(2)]), 'blogAboutIt')).toMatchObject({ profile: 'kim', payload: { dealNumber: 2 } });
    expect(candidate(night([oneSpade(1), sixSpades(2)]), 'blogAboutIt')).toBeUndefined();
  });
  it('Banner Moment: a low contract made exactly with no moments', () => {
    expect(candidate(night([sixSpades(1), oneSpade(2)]), 'bannerMoment')).toMatchObject({
      profile: 'darren',
      payload: { spare: 0, level: 1, dealNumber: 2 },
    });
    // Played out, 1♠ makes 13 tricks: six to spare is no banner.
    expect(candidate(night([oneSpade(1, { playOn: true })]), 'bannerMoment')).toBeUndefined();
    // A made 1♠ with a Robbery in it has drama.
    expect(candidate(night([robbery(1)]), 'bannerMoment')).toBeUndefined();
  });
  it('That’s 10 Dollars: most thinking time, 60 s+ and 20% over the median', () => {
    const slowKim = { 0: 20_000, 1: 100_000, 2: 25_000, 3: 30_000 };
    expect(candidate(night([oneSpade(1, { thinkMs: slowKim }), oneSpade(2, { thinkMs: slowKim })]), 'tenDollars')).toEqual({
      kind: 'tenDollars',
      profile: 'kim',
      score: 200,
      payload: { minutes: 3, seconds: 200 },
    });
    const short = { 0: 10_000, 1: 50_000, 2: 10_000, 3: 10_000 };
    expect(candidate(night([oneSpade(1, { thinkMs: short })]), 'tenDollars')).toBeUndefined();
    const even = { 0: 90_000, 1: 100_000, 2: 90_000, 3: 90_000 };
    expect(candidate(night([oneSpade(1, { thinkMs: even })]), 'tenDollars')).toBeUndefined();
    expect(candidate(night([oneSpade(1)]), 'tenDollars')).toBeUndefined();
  });
});

describe('award selection', () => {
  const a = (kind: AwardKind, profile: ProfileId, score: number): Award => ({ kind, profile, score, payload: {} });

  it('shows at most 5, house awards first, ordered by priority', () => {
    const picked = selectAwards([
      a('mvp', 'kim', 4),
      a('wall', 'ryan', 4),
      a('daredevil', 'adrian', 5),
      a('heist', 'darren', 10),
      a('heartbreakHotel', 'adrian', 2),
      a('epicAttic', 'kim', 2),
      a('bannerMoment', 'ryan', 8),
    ]);
    // epicAttic (0.5 + house 0.5) ties heist (1.0): the fixed order puts the house award first.
    expect(picked.map((x) => x.kind)).toEqual(['bannerMoment', 'epicAttic', 'heist', 'mvp', 'heartbreakHotel']);
  });

  it('gives each player at most two awards when others qualify', () => {
    const picked = selectAwards([
      a('blogAboutIt', 'kim', 4),
      a('epicAttic', 'kim', 4),
      a('bannerMoment', 'kim', 8),
      a('mvp', 'ryan', 1),
    ]);
    expect(picked.map((x) => x.kind)).toEqual(['blogAboutIt', 'epicAttic', 'mvp']);
  });

  it('relaxes the two-per-player rule to reach three', () => {
    const picked = selectAwards([a('blogAboutIt', 'kim', 4), a('epicAttic', 'kim', 4), a('bannerMoment', 'kim', 8)]);
    expect(picked).toHaveLength(3);
  });

  it('returns fewer than three only if fewer qualify', () => {
    expect(selectAwards([a('mvp', 'kim', 2)])).toHaveLength(1);
    expect(selectAwards([])).toEqual([]);
  });

  it("skips last night's kinds unless clearly earned", () => {
    const list = [a('mvp', 'kim', 3), a('wall', 'ryan', 4), a('heist', 'darren', 5)];
    expect(selectAwards(list, ['mvp', 'wall']).map((x) => x.kind)).toEqual(['wall', 'heist']);
  });

  it('is deterministic: same night, same awards', () => {
    const n = night([robbery(1), heartbreak(2), trumpOver(3), oneSpade(4), sixSpades(5), trumpOver(6), deciderMade(7)]);
    expect(nightAwards(n)).toEqual(nightAwards(n));
    expect(allMoments(n)).toEqual(allMoments(n));
    const picked = nightAwards(n);
    expect(picked.length).toBeGreaterThanOrEqual(3);
    expect(picked.length).toBeLessThanOrEqual(5);
    expect(new Set(picked.map((x) => x.kind)).size).toBe(picked.length);
  });
});

// ---- Captions ---------------------------------------------------------------------------------

describe('captions', () => {
  const rich = night([
    robbery(1),
    heartbreak(2),
    trumpOver(3),
    oneSpade(4),
    sixSpades(5),
    trumpOver(6, { thinkMs: { 0: 1_000, 1: 200_000, 2: 2_000, 3: 3_000 } }),
    deciderMade(7),
    trumpOver(8),
    trumpOver(9),
    trumpOver(10),
    trumpOver(11),
  ]);
  const everyone = Object.values(SEATING);
  const others = (ids: readonly ProfileId[]) => everyone.filter((p) => !ids.includes(p)).map(name);

  it('every moment caption names its own players and nobody else', () => {
    const moments = allMoments(rich);
    expect(new Set(kinds(moments))).toEqual(
      new Set(['robbery', 'yarborough', 'powerhouseBenched', 'grandAmbition', 'heartbreak', 'decider', 'trumpCard', 'streak']),
    );
    for (const m of moments) {
      const text = MOMENT_CAPTIONS[m.kind](m, name);
      expect(text).toContain(name(m.players[0]!));
      for (const other of others(m.players)) expect(text).not.toContain(other);
    }
  });

  it('seat→profile mapping: Kim (seat 1) ruffed, Adrian (seat 2) holds the Yarborough', () => {
    const trump = allMoments(rich).find((m) => m.kind === 'trumpCard')!;
    expect(MOMENT_CAPTIONS.trumpCard(trump, name)).toBe('Trump card! Kim ruffed in with ♥A to settle it.');
    const yarb = allMoments(rich).find((m) => m.kind === 'yarborough')!;
    expect(MOMENT_CAPTIONS.yarborough(yarb, name)).toBe('Yarborough! Adrian was dealt nothing above a 9.');
  });

  it('every award caption names its winner and nobody else', () => {
    const cands = awardCandidates(rich);
    expect(cands.map((c) => c.kind).sort()).toEqual(Object.keys(AWARDS).sort());
    for (const c of cands) {
      const text = AWARDS[c.kind].caption(c, name);
      expect(text.startsWith(name(c.profile))).toBe(true);
      for (const other of others([c.profile])) expect(text).not.toContain(other);
    }
  });

  it("house awards keep Ryan's exact lines", () => {
    const by = Object.fromEntries(awardCandidates(rich).map((c) => [c.kind, c]));
    expect(AWARDS.epicAttic.caption(by.epicAttic!, name)).toBe(
      'Adrian: 7♥, one short. Booked for ten, delivered an attic. Epic attic levels na yan!',
    );
    expect(AWARDS.blogAboutIt.caption(by.blogAboutIt!, name)).toMatch(/Why don't you blog about that\?$/);
    expect(AWARDS.bannerMoment.caption(by.bannerMoment!, name)).toBe('Darren: 1♠, made exactly. Banner moment na ba yan?');
    expect(AWARDS.tenDollars.caption(by.tenDollars!, name)).toBe('Kim: 3 minutes of thinking. Oh, 10 dollars na yan!');
    expect(AWARDS.epicAttic.title).toBe('Epic Attic');
    expect(AWARDS.blogAboutIt.title).toBe("Why Don't You Blog About It");
    expect(AWARDS.bannerMoment.title).toBe('Banner Moment');
    expect(AWARDS.tenDollars.title).toBe("That's 10 Dollars");
  });
});
