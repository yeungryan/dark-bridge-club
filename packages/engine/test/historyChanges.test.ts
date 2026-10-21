import { describe, expect, it } from 'vitest';
import {
  applyChangeAction,
  emptyChangeQueue,
  matchupKey,
  MAX_PENDING_CHANGES,
  withOverride,
  type ChangeAction,
  type ChangeOutcome,
  type ChangeQueue,
  type ScoreSide,
} from '../src/historyChanges';

const P = ['darren', 'adrian', 'ryan', 'kim'];
const NOW = Date.UTC(2026, 9, 21, 12);
const sides: [ScoreSide, ScoreSide] = [
  { players: ['darren', 'kim'], nightsWon: 5, gamesWon: 21 },
  { players: ['adrian', 'ryan'], nightsWon: 3, gamesWon: 17 },
];
const propose = (s: unknown = sides) => ({ type: 'propose', change: { kind: 'score', sides: s } }) as ChangeAction;

function act(q: ChangeQueue, by: string, action: ChangeAction, now = NOW): ChangeOutcome {
  const out = applyChangeAction(q, by, action, now, P);
  if (!out.ok) throw new Error(out.error.code);
  return out.state;
}
const code = (q: ChangeQueue, by: string, action: ChangeAction) => {
  const out = applyChangeAction(q, by, action, NOW, P);
  return out.ok ? 'ok' : out.error.code;
};

describe("setting the all-time score takes everyone's approval", () => {
  it('applies only once all four have approved; the proposer counts', () => {
    let o = act(emptyChangeQueue(), 'ryan', propose());
    expect(o.applied).toBeNull();
    const id = o.queue.pending[0]!.id;
    expect(o.queue.pending[0]!.approvals).toEqual(['ryan']);
    o = act(o.queue, 'kim', { type: 'approve', id });
    o = act(o.queue, 'kim', { type: 'approve', id }); // twice is still once
    o = act(o.queue, 'darren', { type: 'approve', id });
    expect(o.applied).toBeNull();
    o = act(o.queue, 'adrian', { type: 'approve', id });
    expect(o.applied?.change).toEqual({ kind: 'score', sides });
    expect(o.applied?.at).toBe(NOW);
    expect(o.queue.pending).toEqual([]);
  });

  it('any one player can turn it down', () => {
    let o = act(emptyChangeQueue(), 'ryan', propose());
    o = act(o.queue, 'adrian', { type: 'reject', id: o.queue.pending[0]!.id });
    expect(o.queue.pending).toEqual([]);
    expect(o.applied).toBeNull();
  });

  it('the numbers must make sense: a real split of the four, whole numbers from zero', () => {
    const e = emptyChangeQueue();
    expect(code(e, 'ryan', propose([{ ...sides[0], players: ['darren', 'darren'] }, sides[1]]))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', propose([{ ...sides[0], players: ['darren', 'bob'] }, sides[1]]))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', propose([{ ...sides[0], nightsWon: -1 }, sides[1]]))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', propose([{ ...sides[0], gamesWon: 2.5 }, sides[1]]))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', propose([sides[0]]))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', propose(null))).toBe('BAD_SCORE');
    expect(code(e, 'ryan', { type: 'dance' } as unknown as ChangeAction)).toBe('BAD_ACTION');
    // All zeros is fine: that's starting again.
    expect(code(e, 'ryan', propose(sides.map((s) => ({ ...s, nightsWon: 0, gamesWon: 0 }))))).toBe('ok');
  });

  it('one change per matchup waits at a time, and a few changes at most', () => {
    const q = act(emptyChangeQueue(), 'ryan', propose()).queue;
    const flipped = [{ ...sides[1], players: ['ryan', 'adrian'] }, { ...sides[0], players: ['kim', 'darren'] }];
    expect(code(q, 'kim', propose(flipped))).toBe('ALREADY');
    let full = emptyChangeQueue();
    for (let i = 0; i < MAX_PENDING_CHANGES; i++) full = { ...full, pending: [...full.pending, { ...q.pending[0]!, id: `x${i}`, change: { kind: 'score', sides: [{ ...sides[0], players: [`p${i}`, 'q'] }, sides[1]] } }] };
    expect(code(full, 'ryan', propose())).toBe('TOO_MANY');
  });

  it('an approved score replaces the last one for that matchup, from when it was proposed', () => {
    let o = act(emptyChangeQueue(), 'ryan', propose(), NOW - 5000);
    for (const p of ['darren', 'adrian', 'kim']) o = act(o.queue, p, { type: 'approve', id: o.queue.pending[0]!.id });
    const once = withOverride([], o.applied!);
    expect(once).toEqual([{ sides, from: NOW - 5000 }]);
    const again = withOverride(once, { ...o.applied!, at: NOW, change: { kind: 'score', sides: sides.map((s) => ({ ...s, nightsWon: 0, gamesWon: 0 })) as [ScoreSide, ScoreSide] } });
    expect(again).toHaveLength(1);
    expect(again[0]!.from).toBe(NOW);
    expect(matchupKey(['kim', 'darren'], ['ryan', 'adrian'])).toBe(matchupKey(['adrian', 'ryan'], ['darren', 'kim']));
  });
});
