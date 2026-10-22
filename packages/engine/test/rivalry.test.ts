import { describe, expect, it } from 'vitest';
import { allMatchups, headToHead, lastNight, pairKey, partnerRecords, partnershipRecords, winRate, type SavedGame, type SavedNight } from '../src/rivalry';
import type { PairId } from '../src/session';
import type { ScoreOverride } from '../src/historyChanges';

const P = ['darren', 'adrian', 'ryan', 'kim'];

const game = (n: number, winningPair: PairId | null): SavedGame => ({
  dealNumber: n,
  dealer: 0,
  contract: winningPair ? { level: 2, strain: 'S', declarer: 0 } : null,
  result: null,
  winningPair,
  replayable: winningPair !== null,
});

function night(id: string, startedAt: number, A: [string, string], B: [string, string], winners: (PairId | null)[], final: PairId | 'tie' | null): SavedNight {
  const wins = { A: winners.filter((w) => w === 'A').length, B: winners.filter((w) => w === 'B').length };
  return {
    id,
    startedAt,
    endedAt: final ? startedAt + 1000 : null,
    theme: 'clubhouse',
    pairs: { A, B },
    seating: null,
    avatars: null,
    final: final ? { winner: final, reason: 'agreed', wins, discardedDeal: false } : null,
    games: winners.map((w, i) => game(i + 1, w)),
    topAward: null,
  };
}

describe('S20 rivalry and history', () => {
  it('four players split three ways, each player once with each partner', () => {
    const m = allMatchups(P);
    expect(m).toHaveLength(3);
    const keys = m.map(([a, b]) => [pairKey(a), pairKey(b)].sort().join(' vs '));
    expect(new Set(keys).size).toBe(3);
    for (const [a, b] of m) expect(new Set([...a, ...b]).size).toBe(4);
  });

  it('a partnership is the same whichever way round its players are named', () => {
    expect(pairKey(['ryan', 'darren'])).toBe(pairKey(['darren', 'ryan']));
  });

  it('head to head counts nights and games for the right side, whichever pair letter it had', () => {
    const nights = [
      // Darren & Kim as pair A win 2–1.
      night('1', 100, ['darren', 'kim'], ['adrian', 'ryan'], ['A', 'B', 'A'], 'A'),
      // The same split, letters swapped: Adrian & Ryan (now A) win 3–1, with a pass-out.
      night('2', 200, ['adrian', 'ryan'], ['kim', 'darren'], ['A', null, 'B', 'A', 'A'], 'A'),
      // A tie the same way round.
      night('3', 300, ['darren', 'kim'], ['adrian', 'ryan'], ['A', 'B'], 'tie'),
      // Unfinished: its games count, the night doesn't.
      night('4', 400, ['kim', 'darren'], ['ryan', 'adrian'], ['B'], null),
      // A different split.
      night('5', 500, ['darren', 'ryan'], ['adrian', 'kim'], ['B'], 'B'),
    ];
    const board = headToHead(P, nights);
    const dk = board.find((m) => m.sides.some((s) => pairKey(s.players) === pairKey(['darren', 'kim'])))!;
    const side = (k: string) => dk.sides.find((s) => pairKey(s.players) === k)!;
    expect(side(pairKey(['darren', 'kim']))).toMatchObject({ nightsWon: 1, gamesWon: 2 + 1 + 1 });
    expect(side(pairKey(['adrian', 'ryan']))).toMatchObject({ nightsWon: 1, gamesWon: 1 + 3 + 1 + 1 });
    expect(dk.nights).toBe(3);
    expect(dk.games).toBe(10);
    expect(dk.lastPlayed).toBe(400);
    // Every finished night is counted once across the board, and every won game once.
    const all = headToHead(P, nights);
    expect(all.reduce((t, m) => t + m.nights, 0)).toBe(4);
    expect(all.reduce((t, m) => t + m.games, 0)).toBe(nights.flatMap((n) => n.games).filter((g) => g.winningPair).length);
  });

  it('a score all four agreed is where a matchup starts; nights begun since count on top', () => {
    const nights = [
      night('1', 100, ['darren', 'kim'], ['adrian', 'ryan'], ['A', 'B', 'A'], 'A'),
      // Started after the agreed score: counts on top of it.
      night('2', 900, ['adrian', 'ryan'], ['kim', 'darren'], ['A', 'A'], 'A'),
      // A different matchup: untouched.
      night('3', 950, ['darren', 'ryan'], ['adrian', 'kim'], ['B'], 'B'),
    ];
    const set: ScoreOverride = {
      sides: [
        { players: ['kim', 'darren'], nightsWon: 7, gamesWon: 30 },
        { players: ['ryan', 'adrian'], nightsWon: 4, gamesWon: 22 },
      ],
      from: 500,
    };
    const board = headToHead(P, nights, [set]);
    const dk = board.find((m) => m.sides.some((s) => pairKey(s.players) === pairKey(['darren', 'kim'])))!;
    const side = (k: string) => dk.sides.find((s) => pairKey(s.players) === k)!;
    // Night 1 (before) is replaced by the agreed score; night 2 (after) adds to it.
    expect(side(pairKey(['darren', 'kim']))).toMatchObject({ nightsWon: 7, gamesWon: 30 });
    expect(side(pairKey(['adrian', 'ryan']))).toMatchObject({ nightsWon: 5, gamesWon: 24 });
    expect(dk).toMatchObject({ nights: 12, games: 54, setAt: 500, lastPlayed: 900 });
    const other = board.find((m) => m.sides.some((s) => pairKey(s.players) === pairKey(['darren', 'ryan'])))!;
    expect(other).toMatchObject({ nights: 1, games: 1, setAt: null });
    // Starting again from zero.
    const zero: ScoreOverride = { sides: set.sides.map((s) => ({ ...s, nightsWon: 0, gamesWon: 0 })) as unknown as ScoreOverride['sides'], from: 1000 };
    expect(headToHead(P, nights, [zero]).find((m) => m.setAt === 1000)).toMatchObject({ nights: 0, games: 0 });
    // Partner records read the same agreed numbers.
    expect(partnerRecords('kim', P, nights, [set]).find((r) => r.partner === 'darren')).toMatchObject({ nights: 12, nightsWon: 7, games: 54, gamesWon: 30 });
  });

  it('partner records: nights and games with each partner', () => {
    const nights = [
      night('1', 100, ['darren', 'kim'], ['adrian', 'ryan'], ['A', 'B', 'A'], 'A'),
      night('2', 200, ['ryan', 'darren'], ['adrian', 'kim'], ['B', 'B'], 'B'),
    ];
    const darren = partnerRecords('darren', P, nights);
    expect(darren.map((r) => r.partner)).toEqual(['adrian', 'ryan', 'kim']);
    expect(darren.find((r) => r.partner === 'kim')).toMatchObject({ nights: 1, nightsWon: 1, games: 3, gamesWon: 2 });
    expect(darren.find((r) => r.partner === 'ryan')).toMatchObject({ nights: 1, nightsWon: 0, games: 2, gamesWon: 0 });
    expect(darren.find((r) => r.partner === 'adrian')).toMatchObject({ nights: 0, games: 0 });
  });

  it('six partnerships, each the same record whichever partner you ask', () => {
    const nights = [
      night('1', 100, ['darren', 'kim'], ['adrian', 'ryan'], ['A', 'B', 'A'], 'A'),
      night('2', 200, ['ryan', 'darren'], ['adrian', 'kim'], ['B', 'B'], 'B'),
    ];
    const all = partnershipRecords(P, nights);
    expect(all).toHaveLength(6);
    const dk = all.find((r) => pairKey(r.pair) === pairKey(['darren', 'kim']))!;
    expect(dk).toMatchObject({ nights: 1, nightsWon: 1, games: 3, gamesWon: 2 });
    const kd = partnerRecords('kim', P, nights).find((r) => r.partner === 'darren')!;
    expect(kd).toMatchObject({ nights: dk.nights, nightsWon: dk.nightsWon, games: dk.games, gamesWon: dk.gamesWon });
  });

  it('win rates show "—" (null) until there are 5 games behind them', () => {
    expect(winRate(3, 4)).toBeNull();
    expect(winRate(3, 5)).toBe(60);
    expect(winRate(0, 0)).toBeNull();
  });

  it('"Last time…" is the latest finished night, never the current one', () => {
    const nights = [
      night('1', 100, ['darren', 'kim'], ['adrian', 'ryan'], ['A'], 'A'),
      night('2', 300, ['darren', 'kim'], ['adrian', 'ryan'], ['B'], 'B'),
      night('3', 500, ['darren', 'kim'], ['adrian', 'ryan'], ['B'], null),
    ];
    expect(lastNight(nights)?.id).toBe('2');
    expect(lastNight(nights, '2')?.id).toBe('1');
    expect(lastNight([])).toBeNull();
  });
});
