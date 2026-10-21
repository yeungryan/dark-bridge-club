import { describe, expect, it } from 'vitest';
import { applySessionAction, newSession, type SessionState } from './session';
import { newThinkClock, tickThinkClock, MAX_TURN_MS } from './thinkclock';
import { seatToAct } from './deal';

const PROFILES = ['a', 'b', 'c', 'd'] as const;

function startedGame(): SessionState {
  let s = newSession({ profiles: PROFILES, usualPartner: { a: 'b', b: 'a', c: 'd', d: 'c' }, seed: '0123456789abcdef0123456789abcdef' });
  const step = (action: Parameters<typeof applySessionAction>[1]) => {
    const out = applySessionAction(s, action);
    if (!out.ok) throw new Error(out.error.message);
    s = out.state;
  };
  step({ type: 'start' });
  step({ type: 'pickPartner', by: s.captain!, partner: PROFILES.find((p) => p !== s.captain)! });
  return s;
}

/** The player due to call passes. */
function pass(s: SessionState): SessionState {
  const seat = seatToAct(s.deal!)!;
  const out = applySessionAction(s, { type: 'deal', by: s.seating![seat], action: { type: 'call', call: { type: 'pass' } } });
  if (!out.ok) throw new Error(out.error.message);
  return out.state;
}

describe('think clock', () => {
  it('credits each turn to the player who was due to act', () => {
    let s = startedGame();
    const first = seatToAct(s.deal!)!;
    let c = tickThinkClock(newThinkClock(), s, false, 1000);
    expect(c.turn).toBe(first);
    s = pass(s);
    c = tickThinkClock(c, s, false, 5000);
    expect(c.totals[first]).toBe(4000);
    const second = seatToAct(s.deal!)!;
    s = pass(s);
    c = tickThinkClock(c, s, false, 6500);
    expect(c.totals[second]).toBe(1500);
  });

  it('never counts the same time twice when other things happen mid-turn', () => {
    const s = startedGame();
    const seat = seatToAct(s.deal!)!;
    let c = tickThinkClock(newThinkClock(), s, false, 0);
    c = tickThinkClock(c, s, false, 1000); // someone reconnected
    c = tickThinkClock(c, s, false, 3000); // and again
    expect(c.totals[seat]).toBe(3000);
  });

  it('stops while paused and caps one very long turn', () => {
    const s = startedGame();
    const seat = seatToAct(s.deal!)!;
    let c = tickThinkClock(newThinkClock(), s, false, 0);
    c = tickThinkClock(c, s, true, 2000); // paused after 2 s
    c = tickThinkClock(c, s, true, 600_000); // ten minutes away
    c = tickThinkClock(c, s, false, 600_000); // back
    c = tickThinkClock(c, s, false, 600_000 + 10 * 60_000); // then a 10-minute stare
    expect(c.totals[seat]).toBe(2000 + MAX_TURN_MS);
  });

  it('starts fresh totals for a new game', () => {
    const s = startedGame();
    const c = tickThinkClock({ ...newThinkClock(s.dealNumber - 1), totals: { 0: 9, 1: 9, 2: 9, 3: 9 } }, s, false, 0);
    expect(c.dealNumber).toBe(s.dealNumber);
    expect(c.totals).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 });
  });
});
