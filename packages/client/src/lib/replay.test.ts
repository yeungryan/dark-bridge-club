import { applyDealAction, bid, newDeal, PASS, seatToAct, legalPlays, type DealState } from '@dark/engine';
import { describe, expect, it } from 'vitest';
import { replaySteps } from './replay';

/** A whole game: 1♠ by the first to call, then everyone plays their first legal card. */
function playedGame(playOn: boolean): DealState {
  let d = newDeal('0123456789abcdef0123456789abcdef', 0);
  const act = (a: Parameters<typeof applyDealAction>[1]) => {
    const out = applyDealAction(d, a);
    if (!out.ok) throw new Error(out.error.message);
    d = out.state;
  };
  act({ type: 'call', seat: seatToAct(d)!, call: bid(1, 'S') });
  for (let i = 0; i < 3; i++) act({ type: 'call', seat: seatToAct(d)!, call: PASS });
  while (d.phase === 'play' || d.phase === 'awaitingPlayOn') {
    if (d.phase === 'awaitingPlayOn') {
      if (playOn) act({ type: 'playOn', seat: 0 });
      else act({ type: 'endAtClinch' });
      continue;
    }
    const seat = seatToAct(d)!;
    act({ type: 'play', seat, card: legalPlays(d.hands[seat], d.currentTrick!.cards)[0]! });
  }
  return d;
}

describe('replay steps', () => {
  it('starts with the auction and the hands as dealt, then one step per set', () => {
    const d = playedGame(true);
    const steps = replaySteps(d.originalHands, d.tricks, d.contract!);
    expect(steps).toHaveLength(14);
    expect(steps[0]!.trick).toBeNull();
    expect(steps[0]!.hands[0]).toHaveLength(13);
    expect(steps[5]!.hands[2]).toHaveLength(8);
    expect(steps[13]!.hands).toEqual({ 0: [], 1: [], 2: [], 3: [] });
    expect(steps.at(-1)!.stoppedHere).toBe(false);
  });

  it('marks exactly one decisive set, and keeps a running tally', () => {
    const d = playedGame(true);
    const steps = replaySteps(d.originalHands, d.tricks, d.contract!);
    expect(steps.filter((s) => s.decisive)).toHaveLength(1);
    const last = steps.at(-1)!.tally;
    expect(last.declarers + last.defenders).toBe(13);
    expect(last).toEqual(d.tricksWon);
  });

  it('a game stopped at the clinch ends on that set, with the rest still in hand', () => {
    const d = playedGame(false);
    const steps = replaySteps(d.originalHands, d.tricks, d.contract!);
    const last = steps.at(-1)!;
    expect(last.decisive).toBe(true);
    expect(last.stoppedHere).toBe(d.tricks.length < 13);
    expect(last.hands[0]).toHaveLength(13 - d.tricks.length);
  });
});
