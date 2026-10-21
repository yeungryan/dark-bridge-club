import { describe, expect, it } from 'vitest';
import { applyChangeAction, emptyChangeQueue, MAX_PENDING_CHANGES, type ChangeAction, type ChangeOutcome, type ChangeQueue, type OfflineNight } from '../src/historyChanges';

const P = ['darren', 'adrian', 'ryan', 'kim'];
const NOW = Date.UTC(2026, 9, 21, 12);
const night: OfflineNight = { playedAt: Date.UTC(2026, 8, 5), pairs: { A: ['darren', 'kim'], B: ['adrian', 'ryan'] }, wins: { A: 5, B: 3 } };

function act(q: ChangeQueue, by: string, action: ChangeAction, offline: string[] = []): ChangeOutcome {
  const out = applyChangeAction(q, by, action, NOW, P, offline);
  if (!out.ok) throw new Error(out.error.code);
  return out.state;
}
const code = (q: ChangeQueue, by: string, action: ChangeAction, offline: string[] = []) => {
  const out = applyChangeAction(q, by, action, NOW, P, offline);
  return out.ok ? 'ok' : out.error.code;
};

describe('adding offline nights takes everyone\'s approval', () => {
  it('applies only once all four have approved; the proposer counts', () => {
    let o = act(emptyChangeQueue(), 'ryan', { type: 'propose', change: { kind: 'add', night } });
    expect(o.applied).toBeNull();
    const id = o.queue.pending[0]!.id;
    expect(o.queue.pending[0]!.approvals).toEqual(['ryan']);
    o = act(o.queue, 'kim', { type: 'approve', id });
    o = act(o.queue, 'kim', { type: 'approve', id }); // twice is still once
    o = act(o.queue, 'darren', { type: 'approve', id });
    expect(o.applied).toBeNull();
    o = act(o.queue, 'adrian', { type: 'approve', id });
    expect(o.applied).toEqual({ kind: 'add', night });
    expect(o.queue.pending).toEqual([]);
  });

  it('any one player can turn it down', () => {
    let o = act(emptyChangeQueue(), 'ryan', { type: 'propose', change: { kind: 'add', night } });
    o = act(o.queue, 'adrian', { type: 'reject', id: o.queue.pending[0]!.id });
    expect(o.queue.pending).toEqual([]);
    expect(o.applied).toBeNull();
  });

  it('the night must make sense: a real split of the four, sensible games, a past date', () => {
    const e = emptyChangeQueue();
    const add = (n: unknown) => ({ type: 'propose', change: { kind: 'add', night: n } }) as ChangeAction;
    expect(code(e, 'ryan', add({ ...night, pairs: { A: ['darren', 'darren'], B: ['adrian', 'ryan'] } }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add({ ...night, pairs: { A: ['darren', 'bob'], B: ['adrian', 'ryan'] } }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add({ ...night, wins: { A: 0, B: 0 } }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add({ ...night, wins: { A: -1, B: 3 } }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add({ ...night, wins: { A: 2.5, B: 3 } }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add({ ...night, playedAt: NOW + 7 * 24 * 3600e3 }))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', add(null))).toBe('BAD_NIGHT');
    expect(code(e, 'ryan', { type: 'dance' } as unknown as ChangeAction)).toBe('BAD_ACTION');
  });

  it('only offline nights can be taken out, and also with everyone\'s approval', () => {
    expect(code(emptyChangeQueue(), 'ryan', { type: 'propose', change: { kind: 'remove', nightId: '7' } }, ['o1'])).toBe('NOT_OFFLINE');
    let o = act(emptyChangeQueue(), 'ryan', { type: 'propose', change: { kind: 'remove', nightId: 'o1' } }, ['o1']);
    expect(code(o.queue, 'kim', { type: 'propose', change: { kind: 'remove', nightId: 'o1' } }, ['o1'])).toBe('ALREADY');
    for (const p of ['darren', 'adrian', 'kim']) o = act(o.queue, p, { type: 'approve', id: o.queue.pending[0]!.id }, ['o1']);
    expect(o.applied).toEqual({ kind: 'remove', nightId: 'o1' });
  });

  it('a few changes can wait at once, not an endless pile', () => {
    let q = emptyChangeQueue();
    for (let i = 0; i < MAX_PENDING_CHANGES; i++) q = act(q, 'ryan', { type: 'propose', change: { kind: 'add', night } }).queue;
    expect(code(q, 'ryan', { type: 'propose', change: { kind: 'add', night } })).toBe('TOO_MANY');
  });
});
