import { describe, expect, it } from 'vitest';
import { carryForward, countedNights, emptyCarried, withoutMatchup, type Carried } from '../src/carried';
import { animalRecords, elementRecords, playerStats } from '../src/playerStats';
import { headToHead, partnershipRecords, type SavedGame, type SavedNight } from '../src/rivalry';
import type { PairId } from '../src/session';
import type { Level, Seat, Strain } from '../src/types';

const P = ['darren', 'adrian', 'ryan', 'kim'];
const seating = { 0: 'darren', 1: 'adrian', 2: 'ryan', 3: 'kim' } as const;
const swapped = { 0: 'ryan', 1: 'adrian', 2: 'darren', 3: 'kim' } as const;

function game(n: number, declarer: Seat, level: Level, strain: Strain, tricks: number, extra: Partial<SavedGame> = {}): SavedGame {
  const made = tricks >= level + 6;
  const declarerPair: PairId = declarer % 2 === 0 ? 'A' : 'B';
  return {
    dealNumber: n,
    dealer: 0,
    contract: { level, strain, declarer },
    result: { winner: made ? 'declarers' : 'defenders', reason: made ? 'made' : 'defeated', declarerTricks: tricks, defenderTricks: 13 - tricks, playedOut: true, overUnder: tricks - level - 6 },
    winningPair: made ? declarerPair : declarerPair === 'A' ? 'B' : 'A',
    replayable: true,
    ...extra,
  };
}
const passOut = (n: number): SavedGame => ({ dealNumber: n, dealer: 0, contract: null, result: null, winningPair: null, replayable: false });

function night(id: string, startedAt: number, games: SavedGame[], extra: Partial<SavedNight> = {}): SavedNight {
  return {
    id,
    startedAt,
    endedAt: startedAt + 1,
    theme: 'clubhouse',
    pairs: { A: ['darren', 'ryan'], B: ['adrian', 'kim'] },
    seating,
    avatars: {
      darren: { animal: 'raccoon', element: 'earth' },
      adrian: { animal: 'dragon', element: 'fire' },
      ryan: { animal: 'eagle', element: 'water' },
      kim: { animal: 'tiger', element: 'air' },
    },
    final: { winner: 'A', reason: 'agreed', wins: { A: 2, B: 1 }, discardedDeal: false },
    games,
    topAward: null,
    awards: [{ kind: 'mvp', profile: 'ryan', payload: {} }],
    ...extra,
  };
}

// Oldest first, as pruning goes: three nights, a different matchup in the middle one, seats
// swapped mid-night, pass-outs, and an unfinished night at the end.
const history: SavedNight[] = [
  night('1', 100, [game(1, 2, 2, 'S', 9), game(2, 1, 3, 'NT', 8), passOut(3), game(4, 0, 4, 'H', 10), game(5, 2, 1, 'C', 7), game(6, 0, 2, 'D', 9, { seating: swapped })]),
  night('2', 200, [game(1, 1, 4, 'S', 10), game(2, 3, 2, 'H', 7)], {
    pairs: { A: ['darren', 'adrian'], B: ['ryan', 'kim'] },
    seating: { 0: 'darren', 1: 'ryan', 2: 'adrian', 3: 'kim' },
    avatars: { darren: { animal: 'owl', element: 'fire' }, adrian: { animal: 'dragon', element: 'fire' }, ryan: { animal: 'eagle', element: 'air' }, kim: { animal: 'tiger', element: 'air' } },
    final: { winner: 'tie', reason: 'agreed', wins: { A: 1, B: 1 }, discardedDeal: false },
  }),
  night('3', 300, [game(1, 2, 3, 'NT', 9), game(2, 1, 1, 'S', 7)], { final: null, endedAt: null, awards: [] }),
];

/** Delete the oldest `n` games the way the server does, carrying them forward. */
function prune(nights: SavedNight[], n: number, overrides: Parameters<typeof carryForward>[5] = []): { kept: SavedNight[]; carried: Carried } {
  let carried = emptyCarried();
  const kept: SavedNight[] = [];
  let left = n;
  for (const nt of nights) {
    const take = Math.min(left, nt.games.length);
    left -= take;
    if (take === 0) {
      kept.push(nt);
      continue;
    }
    const whole = take === nt.games.length && nt.final !== null;
    carried = carryForward(carried, P, nt, nt.games.slice(0, take), false, overrides);
    if (whole) carried = carryForward(carried, P, nt, [], true, overrides);
    else kept.push({ ...nt, games: nt.games.slice(take) });
  }
  return { kept, carried };
}

describe('carrying deleted games forward (Ryan: keep 300 games, stats stack forever)', () => {
  const total = history.reduce((t, n) => t + n.games.length, 0);
  for (let n = 0; n <= total; n++) {
    it(`gives the same all-time numbers with the oldest ${n} games deleted`, () => {
      const { kept, carried } = prune(history, n);
      for (const p of P) {
        const all = playerStats(p, P, history);
        const now = playerStats(p, P, kept, carried);
        expect({ ...now, partners: [...now.partners].sort((a, b) => a.partner.localeCompare(b.partner)) }).toEqual({
          ...all,
          partners: [...all.partners].sort((a, b) => a.partner.localeCompare(b.partner)),
        });
      }
      expect(headToHead(P, kept, [], carried)).toEqual(headToHead(P, history));
      expect(partnershipRecords(P, kept, [], carried)).toEqual(partnershipRecords(P, history));
      expect(animalRecords(P, kept, carried)).toEqual(animalRecords(P, history));
      expect(elementRecords(P, kept, carried)).toEqual(elementRecords(P, history));
    });
  }

  it('(control) without the carried totals the numbers really would drop', () => {
    const { kept } = prune(history, 6);
    expect(playerStats('ryan', P, kept)).not.toEqual(playerStats('ryan', P, history));
    expect(headToHead(P, kept)).not.toEqual(headToHead(P, history));
  });

  it('a matchup set by hand only carries nights begun after it, as the board counts them', () => {
    const override = { sides: [{ players: ['darren', 'ryan'], nightsWon: 5, gamesWon: 40 }, { players: ['adrian', 'kim'], nightsWon: 4, gamesWon: 30 }], from: 150 } as const;
    const { kept, carried } = prune(history, 8, [override]);
    expect(headToHead(P, kept, [override], carried)).toEqual(headToHead(P, history, [override]));
  });

  it('setting a score by hand drops what was carried for that matchup (it is part of the new score)', () => {
    const { carried } = prune(history, 6);
    const override = { sides: [{ players: ['darren', 'ryan'], nightsWon: 0, gamesWon: 0 }, { players: ['adrian', 'kim'], nightsWon: 0, gamesWon: 0 }], from: 999 } as const;
    const cleared = withoutMatchup(carried, override);
    const board = headToHead(P, [], [override], cleared).find((m) => m.sides.some((s) => s.players.includes('darren') && s.players.includes('ryan')))!;
    expect(board.sides.map((s) => s.gamesWon)).toEqual([0, 0]);
    expect(board.lastPlayed).toBe(100);
  });

  it('after a reset, only nights begun since count', () => {
    expect(countedNights(history, 200).map((n) => n.id)).toEqual(['2', '3']);
    expect(countedNights(history, null)).toHaveLength(3);
  });
});
