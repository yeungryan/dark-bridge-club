import { describe, expect, it } from 'vitest';
import { animalRecords, awardCounts, elementRecords, leaderboard, momentsWall, playerStats, shares } from '../src/playerStats';
import type { SavedGame, SavedNight } from '../src/rivalry';
import type { PairId } from '../src/session';
import type { Level, Seat, Strain } from '../src/types';

const P = ['darren', 'adrian', 'ryan', 'kim'];
// Seats: darren 0, adrian 1, ryan 2, kim 3, so darren & ryan sit opposite (pair A), adrian & kim (pair B).
const seating = { 0: 'darren', 1: 'adrian', 2: 'ryan', 3: 'kim' } as const;

/** A game declared from `declarer` at `level strain`, the declarers taking `tricks` of 13. */
function game(n: number, declarer: Seat, level: Level, strain: Strain, tricks: number): SavedGame {
  const made = tricks >= level + 6;
  const declarerPair: PairId = declarer % 2 === 0 ? 'A' : 'B';
  return {
    dealNumber: n,
    dealer: 0,
    contract: { level, strain, declarer },
    result: { winner: made ? 'declarers' : 'defenders', reason: made ? 'made' : 'defeated', declarerTricks: tricks, defenderTricks: 13 - tricks, playedOut: true, overUnder: tricks - level - 6 },
    winningPair: made ? declarerPair : declarerPair === 'A' ? 'B' : 'A',
    replayable: true,
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
    final: { winner: 'A', reason: 'agreed', wins: { A: 1, B: 1 }, discardedDeal: false },
    games,
    topAward: null,
    ...extra,
  };
}

describe('seat swaps (Ryan: his pair trades seats every five games)', () => {
  it('credits each game to whoever sat in the declaring seat for that game', () => {
    // Game 2: Ryan and Darren have traded seats, so seat 0 is Ryan's.
    const swapped = { 0: 'ryan', 1: 'adrian', 2: 'darren', 3: 'kim' } as const;
    const nights = [night('1', 100, [game(1, 0, 2, 'S', 8), { ...game(2, 0, 3, 'NT', 9), seating: swapped }])];
    expect(playerStats('darren', P, nights).declaring).toEqual({ won: 1, lost: 0 });
    expect(playerStats('ryan', P, nights).declaring).toEqual({ won: 1, lost: 0 });
    expect(playerStats('ryan', P, nights).levels[3]).toBe(1);
  });
});

describe('S20 player cards and the leaderboard', () => {
  const nights = [
    night('1', 100, [
      { ...game(1, 2, 2, 'S', 9), setsBySeat: { 0: 3, 1: 2, 2: 6, 3: 2 } }, // Ryan declares 2♠, makes it with 9 (6 his own)
      { ...game(2, 1, 3, 'NT', 8), setsBySeat: { 0: 4, 1: 5, 2: 1, 3: 3 } }, // Adrian declares 3NT, one down
      passOut(3),
      { ...game(4, 2, 4, 'H', 9), setsBySeat: { 0: 2, 1: 3, 2: 7, 3: 1 } }, // Ryan declares 4♥, one down
    ]),
  ];

  it('counts sets, games, declaring (declarer only) and defending (both defenders) for the right side', () => {
    const ryan = playerStats('ryan', P, nights);
    // Ryan (round 10): only the sets his own card won, not Darren's.
    expect(ryan.sets).toEqual({ won: 6 + 1 + 7, played: 39 });
    expect(playerStats('darren', P, nights).sets).toEqual({ won: 3 + 4 + 2, played: 39 });
    expect(ryan.games).toEqual({ won: 2, played: 3 });
    expect(ryan.declaring).toEqual({ won: 1, lost: 1 });
    expect(ryan.defending).toEqual({ won: 1, lost: 0 });
    // Darren is Ryan's partner: Ryan's contracts aren't his to declare.
    const darren = playerStats('darren', P, nights);
    expect(darren.declaring).toEqual({ won: 0, lost: 0 });
    expect(darren.defending).toEqual({ won: 1, lost: 0 });
    // Kim defended both of Ryan's contracts.
    expect(playerStats('kim', P, nights).defending).toEqual({ won: 1, lost: 1 });
    expect(ryan.partners.find((p) => p.partner === 'darren')).toEqual({ partner: 'darren', played: 3, won: 2 });
    expect(ryan.nights).toBe(1);
  });

  it('favourite suit and level are shares of the contracts you declared', () => {
    const ryan = playerStats('ryan', P, nights);
    expect(shares(ryan.strains).slice(0, 2)).toEqual([
      { key: 'H', pct: 50 },
      { key: 'S', pct: 50 },
    ]);
    expect(shares(ryan.levels)[0]!.pct).toBe(50);
    expect(shares(playerStats('kim', P, nights).strains)[0]!.pct).toBe(0);
  });

  it('ranks sets and games by wins, declaring and defending by games played in that role', () => {
    const all = P.map((p) => playerStats(p, P, nights));
    const board = leaderboard(all);
    expect(board.declaring[0]).toMatchObject({ profile: 'ryan', value: '1–1', rank: 2 });
    // Adrian and Kim both defended Ryan's two contracts: 1–1 each, ahead of the 1–0s.
    expect(board.defending.slice(0, 2).map((r) => [r.profile, r.value])).toEqual([
      ['adrian', '1–1'],
      ['kim', '1–1'],
    ]);
    expect(board.games[0]!.rank).toBe(2);
  });

  it('awards: counted per player for the tracker, and the moments wall keeps two a night by priority', () => {
    const awarded = night('2', 200, [], {
      awards: [
        { kind: 'mvp', profile: 'ryan', payload: {} },
        { kind: 'heartbreakHotel', profile: 'kim', payload: {} },
        { kind: 'heist', profile: 'kim', payload: { dealNumber: 3 } },
        { kind: 'wall', profile: 'darren', payload: {} },
      ],
    });
    const all = P.map((p) => playerStats(p, P, [...nights, awarded]));
    expect(awardCounts('heist', all)[0]).toEqual({ profile: 'kim', count: 1 });
    const titles: Record<string, string> = { mvp: 'MVP', heartbreakHotel: 'Heartbreak Hotel', heist: 'Heist Master', wall: 'The Wall' };
    const wall = momentsWall([...nights, awarded], (k) => titles[k]!);
    expect(wall).toHaveLength(1);
    expect(wall[0]!.awards.map((a) => a.kind)).toEqual(['heist', 'heartbreakHotel']);
    // Filtered to one player: their awards only (MVP outranks The Wall alphabetically for Ryan… only one here).
    expect(momentsWall([awarded], (k) => titles[k]!, 'ryan')[0]!.awards.map((a) => a.kind)).toEqual(['mvp']);
  });

  it('animals and elements: most picked, luckiest and element win rates wait for 5 games', () => {
    const many = night('3', 300, [1, 2, 3, 4, 5].map((n) => game(n, 2, 1, 'C', 8)));
    const animals = animalRecords(P, [many]);
    expect(animals.find((a) => a.profile === 'ryan')).toMatchObject({ mostPicked: { animal: 'eagle', nights: 1 }, luckiest: { animal: 'eagle', pct: 100 } });
    expect(animalRecords(P, nights).find((a) => a.profile === 'ryan')!.luckiest).toBeNull();
    const el = elementRecords(P, [many]);
    expect(el.find((e) => e.profile === 'ryan')!.pct.water).toBe(100);
    expect(el.find((e) => e.profile === 'ryan')!.pct.fire).toBeNull();
  });
});
