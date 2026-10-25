import { describe, expect, it } from 'vitest';
import { gameWorth, REVERSE_SWEEP_WORTH, SWEEP_WORTH } from '../src/deal';
import { pickCounts, playerStats } from '../src/playerStats';
import { headToHead, partnershipRecords, type SavedGame, type SavedNight } from '../src/rivalry';
import type { Seat } from '../src/types';

// Ryan (round 15): a sweep counts as 10 games won, a reverse sweep as 100, for the pair, for the
// night and all time; a Dog Moorb doesn't also count the Broom God's 10.

const P = ['darren', 'adrian', 'ryan', 'kim'];
const seating = { 0: 'darren', 1: 'adrian', 2: 'ryan', 3: 'kim' } as const;

/** A 1♠ game by `declarer` in which the declaring side won `tricks` sets. */
function game(n: number, declarer: Seat, tricks: number): SavedGame {
  const made = tricks >= 7;
  const declarerPair = declarer % 2 === 0 ? 'A' : 'B';
  return {
    dealNumber: n,
    dealer: 0,
    contract: { level: 1, strain: 'S', declarer },
    result: { winner: made ? 'declarers' : 'defenders', reason: made ? 'made' : 'defeated', declarerTricks: tricks, defenderTricks: 13 - tricks, playedOut: true, overUnder: tricks - 7 },
    winningPair: made ? declarerPair : declarerPair === 'A' ? 'B' : 'A',
    replayable: true,
  };
}

const night = (games: SavedGame[]): SavedNight => ({
  id: '1',
  startedAt: 1,
  endedAt: 2,
  theme: 'clubhouse',
  pairs: { A: ['darren', 'ryan'], B: ['adrian', 'kim'] },
  seating,
  avatars: { darren: { animal: 'bear', element: 'fire' }, adrian: { animal: 'fox', element: 'air' }, ryan: { animal: 'eagle', element: 'water' }, kim: { animal: 'tiger', element: 'earth' } },
  final: { winner: 'A', reason: 'agreed', wins: { A: 0, B: 0 }, discardedDeal: false },
  games,
  topAward: null,
  awards: [],
});

describe('sweeps count for more (round 15)', () => {
  it('a game is worth 1, a sweep 10, a reverse sweep 100', () => {
    expect(gameWorth({ declarerTricks: 9, defenderTricks: 4 })).toBe(1);
    expect(gameWorth({ declarerTricks: 13, defenderTricks: 0 })).toBe(SWEEP_WORTH);
    expect(gameWorth({ declarerTricks: 0, defenderTricks: 13 })).toBe(REVERSE_SWEEP_WORTH);
    expect([SWEEP_WORTH, REVERSE_SWEEP_WORTH]).toEqual([10, 100]);
  });

  // Darren (A) sweeps, Kim (B) is reverse-swept as declarer... by A, and one ordinary game to B.
  const nights = [night([game(1, 0, 13), game(2, 1, 0), game(3, 1, 8)])];

  it('the head-to-head and partnerships add 10 and 100', () => {
    const m = headToHead(P, nights).find((r) => r.games > 0)!;
    const side = (p: string) => m.sides.find((s) => s.players.includes(p))!;
    expect(side('darren').gamesWon).toBe(10 + 100);
    expect(side('kim').gamesWon).toBe(1);
    expect(m.games).toBe(111);
    const dr = partnershipRecords(P, nights).find((r) => r.pair.includes('darren') && r.pair.includes('ryan'))!;
    expect([dr.gamesWon, dr.games]).toEqual([110, 111]);
  });

  it("players' games won count it too, and win rates never pass 100%", () => {
    const ryan = playerStats('ryan', P, nights);
    expect(ryan.games).toEqual({ played: 111, won: 110 });
    const kim = playerStats('kim', P, nights);
    expect(kim.games).toEqual({ played: 111, won: 1 });
    const picks = pickCounts(P, nights, 'element');
    expect(picks.ryan!.water).toEqual({ nights: 1, played: 111, won: 110 });
  });
});
