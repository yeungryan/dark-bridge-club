import type { PublicEvent, TableView } from '@dark/engine';
import { describe, expect, it } from 'vitest';
import { clinchDrama, intensityOf, momentsFrom } from './moments';

// A minimal view of 4♠ by seat 0, seen by seat 1, after some tricks.
function view(won: { declarers: number; defenders: number }, lastTrickLed: 'S' | 'H' = 'H'): TableView {
  return {
    me: 'ryan',
    mySeat: 1,
    deal: {
      contract: { level: 4, strain: 'S', declarer: 0 },
      declarerTarget: 10,
      defenderTarget: 4,
      tricksWon: won,
      lastTrick: {
        leader: 0,
        cards: [
          { seat: 0, card: { suit: lastTrickLed, rank: 9 } },
          { seat: 1, card: { suit: 'S', rank: 2 } },
        ],
        winner: 1,
        winningCard: { suit: 'S', rank: 2 },
      },
      result: null,
    },
  } as unknown as TableView;
}

const trickWon = (side: 'declarers' | 'defenders', won: { declarers: number; defenders: number }, card = { suit: 'S' as const, rank: 2 as const }): PublicEvent => ({
  type: 'deal',
  event: { type: 'trickWon', trickNumber: won.declarers + won.defenders, winner: 1, card, side, tricksWon: won },
});

describe('S16 intensity scale', () => {
  it('maps moments to the levels in the spec table', () => {
    expect(intensityOf({ kind: 'cardPlayed', seat: 0, mine: true })).toBe(1);
    expect(intensityOf({ kind: 'trickWon', side: 'declarers', winner: 0, trumpOver: false, pip: 0 })).toBe(2);
    expect(intensityOf({ kind: 'trickWon', side: 'declarers', winner: 0, trumpOver: true, pip: 0 })).toBe(3);
    expect(intensityOf({ kind: 'contractSet' })).toBe(3);
    expect(intensityOf({ kind: 'decider' })).toBe(4);
    expect(intensityOf({ kind: 'clinch', side: 'defenders', seat: 1, card: { suit: 'S', rank: 2 }, drama: 0 })).toBe(5);
  });

  it('clinch drama adds one for a decider, a slam and a trump-over, capped at 3', () => {
    expect(clinchDrama({ decider: false, level: 1, trumpOver: false })).toBe(0);
    expect(clinchDrama({ decider: true, level: 2, trumpOver: false })).toBe(1);
    expect(clinchDrama({ decider: true, level: 6, trumpOver: true })).toBe(3);
    expect(clinchDrama({ decider: true, level: 7, trumpOver: true })).toBe(3);
  });
});

describe('S16 moments from server events', () => {
  it('a trump played on a different led suit is a trump-over', () => {
    const won = { declarers: 0, defenders: 1 };
    const [m] = momentsFrom([trickWon('defenders', won)], view(won, 'H'));
    expect(m).toMatchObject({ kind: 'trickWon', trumpOver: true, pip: 0 });
  });

  it('following suit with a trump is not a trump-over', () => {
    const won = { declarers: 0, defenders: 1 };
    const [m] = momentsFrom([trickWon('defenders', won)], view(won, 'S'));
    expect(m).toMatchObject({ kind: 'trickWon', trumpOver: false });
  });

  it('flags one-away when a side first needs just one more trick', () => {
    const won = { declarers: 2, defenders: 3 }; // defenders need 4
    expect(momentsFrom([trickWon('defenders', won)], view(won)).map((m) => m.kind)).toEqual(['trickWon', 'oneAway']);
  });

  it('flags the decider when both sides first need just one more', () => {
    const won = { declarers: 9, defenders: 3 }; // need 10 and 4
    expect(momentsFrom([trickWon('declarers', won)], view(won)).map((m) => m.kind)).toEqual(['trickWon', 'decider']);
  });

  it('a clinch on the decider trick with a trump-over has drama 2', () => {
    const won = { declarers: 9, defenders: 4 };
    const events: PublicEvent[] = [
      trickWon('defenders', won),
      { type: 'deal', event: { type: 'clinched', clinch: { side: 'defenders', trickNumber: 13, card: { suit: 'S', rank: 2 }, seat: 1 } } },
    ];
    const clinch = momentsFrom(events, view(won, 'H')).find((m) => m.kind === 'clinch');
    expect(clinch).toMatchObject({ kind: 'clinch', side: 'defenders', drama: 2 });
  });
});
