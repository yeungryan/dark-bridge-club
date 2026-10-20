import type { PublicEvent, TableView } from '@dark/engine';
import { describe, expect, it } from 'vitest';
import { clinchDrama, intensityOf, leadChange, momentsFrom, streak } from './moments';

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
      trumpTricksWon: 1,
      calls: [],
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
    const card = { kind: 'cardPlayed', seat: 0, mine: true, card: { suit: 'S', rank: 2 }, lead: 0, trumpIn: false, completes: false } as const;
    expect(intensityOf(card)).toBe(1);
    expect(intensityOf({ ...card, lead: 1 })).toBe(2);
    expect(intensityOf({ ...card, lead: 1, trumpIn: true })).toBe(3);
    const trick = { kind: 'trickWon', side: 'declarers', winner: 0, trump: false, trumpOver: false, firstTrump: false, pip: 0 } as const;
    expect(intensityOf(trick)).toBe(2);
    expect(intensityOf({ ...trick, trump: true })).toBe(3);
    expect(intensityOf({ ...trick, trump: true, firstTrump: true })).toBe(4);
    expect(intensityOf({ kind: 'contractSet', declarer: 0 })).toBe(3);
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
    expect(m).toMatchObject({ kind: 'trickWon', trump: true, trumpOver: true, firstTrump: true, pip: 0 });
  });

  it('following suit with a trump is not a trump-over', () => {
    const won = { declarers: 0, defenders: 1 };
    const [m] = momentsFrom([trickWon('defenders', won)], view(won, 'S'));
    expect(m).toMatchObject({ kind: 'trickWon', trump: true, trumpOver: false });
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

describe('S16 lead changes within a trick', () => {
  const p = (seat: 0 | 1 | 2 | 3, suit: 'S' | 'H' | 'D' | 'C', rank: number) => ({ seat, card: { suit, rank } }) as never;
  // Hearts led; trumps are spades.
  const trick = [p(0, 'H', 9), p(1, 'H', 12), p(2, 'S', 3), p(3, 'S', 7)];

  it('the first card never "takes the lead"', () => {
    expect(leadChange(trick, 0, 'S')).toEqual({ lead: 0, trumpIn: false });
  });
  it('a higher card of the suit led takes the lead', () => {
    expect(leadChange(trick, 1, 'S')).toEqual({ lead: 1, trumpIn: false });
  });
  it('trumping in is the second change, and a trump-in', () => {
    expect(leadChange(trick, 2, 'S')).toEqual({ lead: 2, trumpIn: true });
  });
  it('over-trumping is a third change', () => {
    expect(leadChange(trick, 3, 'S')).toEqual({ lead: 3, trumpIn: true });
  });
  it('a card that does not beat the leader changes nothing', () => {
    expect(leadChange([p(0, 'H', 9), p(1, 'H', 5)], 1, 'S')).toEqual({ lead: 0, trumpIn: false });
  });
  it('in no-trumps a discard never leads', () => {
    expect(leadChange([p(0, 'H', 9), p(1, 'S', 14)], 1, null)).toEqual({ lead: 0, trumpIn: false });
  });
});

describe('S12 auction countdown', () => {
  const callView = (calls: Array<'p' | '1S'>) =>
    ({
      me: 'ryan',
      mySeat: 0,
      deal: {
        contract: null,
        calls: calls.map((c, i) => ({ seat: i % 4, call: c === 'p' ? { type: 'pass' } : { type: 'bid', level: 1, strain: 'S' } })),
      },
    }) as unknown as TableView;
  const made = (seat: number, pass: boolean): PublicEvent =>
    ({ type: 'deal', event: { type: 'callMade', seat, call: pass ? { type: 'pass' } : { type: 'bid', level: 1, strain: 'S' } } }) as PublicEvent;

  it('opening passes are not a countdown', () => {
    const [m] = momentsFrom([made(1, true)], callView(['p', 'p']));
    expect(m).toMatchObject({ kind: 'call', going: 0 });
  });
  it('passes after a bid count "going once", then "going twice"', () => {
    expect(momentsFrom([made(1, true)], callView(['1S', 'p']))[0]).toMatchObject({ going: 1 });
    expect(momentsFrom([made(2, true)], callView(['1S', 'p', 'p']))[0]).toMatchObject({ going: 2 });
  });
  it('the third pass is "sold": the contract moment, not a countdown', () => {
    const events: PublicEvent[] = [
      made(3, true),
      { type: 'deal', event: { type: 'contractSet', contract: { level: 1, strain: 'S', declarer: 0 }, declarerTarget: 7, defenderTarget: 7, openingLeader: 1 } },
    ];
    const ms = momentsFrom(events, callView(['1S', 'p', 'p', 'p']));
    expect(ms.map((m) => m.kind)).toEqual(['call', 'contractSet']);
    expect(ms[0]).toMatchObject({ going: 0 });
  });
});

describe('streak (combos)', () => {
  it('counts the latest side’s run of sets, partners together', () => {
    expect(streak([])).toBe(0);
    expect(streak([0])).toBe(1);
    expect(streak([1, 0, 2, 0])).toBe(3);
    expect(streak([0, 2, 1])).toBe(1);
    expect(streak([3, 1, 3, 1, 3])).toBe(5);
  });
});
