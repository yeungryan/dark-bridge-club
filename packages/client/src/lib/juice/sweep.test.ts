import { describe, expect, it } from 'vitest';
import { sweepOf } from './sweep';

// Round 15: which takeover a finished game gets, and who it names.
const profiles = ['darren', 'adrian', 'ryan', 'kim'].map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1), color: '#888' }));
const seating = { 0: 'darren', 1: 'adrian', 2: 'kim', 3: 'ryan' };
const conn = (declarer: 0 | 1 | 2 | 3, declarerTricks: number) =>
  ({
    view: {
      seating,
      mySeat: 3,
      deal: {
        contract: { level: 2, strain: 'H', declarer },
        result: { winner: declarerTricks >= 8 ? 'declarers' : 'defenders', declarerTricks, defenderTricks: 13 - declarerTricks },
      },
    },
    room: { profiles, avatars: { darren: { animal: 'raccoon', element: 'fire' } } },
  }) as never;

describe('sweepOf', () => {
  it('no takeover without all 13 sets to one side', () => {
    expect(sweepOf(conn(0, 12))).toBeNull();
    expect(sweepOf(conn(0, 1))).toBeNull();
  });

  it('Broom God when the declarers sweep: +10 to their pair, in their team colour', () => {
    const s = sweepOf(conn(0, 13))!;
    expect(s.kind).toBe('broomGod');
    expect(s.worth).toBe(10);
    expect(s.contract).toBe('2♥');
    expect(s.winners.map((w) => w.name)).toEqual(['Darren', 'Kim']);
    expect(s.winners[0]!.animal).toBe('raccoon');
    expect(s.losers.map((w) => w.name)).toEqual(['Adrian', 'Ryan']);
    expect([s.winnerTeam, s.loserTeam]).toEqual(['black', 'red']);
  });

  it('Dog Moorb when the defenders sweep: +100 (not 110)', () => {
    const s = sweepOf(conn(0, 0))!;
    expect(s.kind).toBe('dogMoorb');
    expect(s.worth).toBe(100);
    expect(s.winners.map((w) => w.name)).toEqual(['Adrian', 'Ryan']);
    expect(s.winnerTeam).toBe('red');
  });
});
