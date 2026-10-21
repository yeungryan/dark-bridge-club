import { describe, expect, it } from 'vitest';
import { applySchedule, emptySchedule, LOCK_KEEP_MS, MAX_PER_PROPOSAL, stillToVote, tidySchedule, type Schedule, type ScheduleAction } from '../src/schedule';

const P = ['darren', 'adrian', 'ryan', 'kim'];
const NOW = Date.UTC(2026, 9, 21, 12, 0);
const H = 60 * 60 * 1000;

function act(s: Schedule, by: string, action: ScheduleAction, now = NOW): Schedule {
  const out = applySchedule(s, by, action, now, P);
  if (!out.ok) throw new Error(out.error.code);
  return out.state;
}
const code = (s: Schedule, by: string, action: ScheduleAction, now = NOW) => {
  const out = applySchedule(s, by, action, now, P);
  return out.ok ? 'ok' : out.error.code;
};

describe('S21 the next-game scheduler', () => {
  it('proposing adds the times soonest first, each with the proposer already a Yes', () => {
    const s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + 48 * H, NOW + 24 * H], zone: 'Asia/Manila' });
    expect(s.slots.map((x) => x.at)).toEqual([NOW + 24 * H, NOW + 48 * H]);
    expect(s.slots.every((x) => x.votes.ryan === 'yes' && x.proposedBy === 'ryan' && x.proposerZone === 'Asia/Manila')).toBe(true);
    expect(new Set(s.slots.map((x) => x.id)).size).toBe(2);
  });

  it('1–5 times, still to come, within four months, with a time zone', () => {
    const e = emptySchedule();
    expect(code(e, 'ryan', { type: 'propose', times: [], zone: 'UTC' })).toBe('BAD_TIMES');
    expect(code(e, 'ryan', { type: 'propose', times: Array.from({ length: MAX_PER_PROPOSAL + 1 }, (_, i) => NOW + (i + 1) * H), zone: 'UTC' })).toBe('BAD_TIMES');
    expect(code(e, 'ryan', { type: 'propose', times: [NOW - H], zone: 'UTC' })).toBe('PAST_TIME');
    expect(code(e, 'ryan', { type: 'propose', times: [NOW + 200 * 24 * H], zone: 'UTC' })).toBe('TOO_FAR');
    expect(code(e, 'ryan', { type: 'propose', times: [NOW + H], zone: '' })).toBe('BAD_ZONE');
  });

  it('proposing a time that is already up just counts as a Yes', () => {
    let s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + 24 * H], zone: 'UTC' });
    s = act(s, 'kim', { type: 'propose', times: [NOW + 24 * H], zone: 'UTC' });
    expect(s.slots).toHaveLength(1);
    expect(s.slots[0]!.votes).toEqual({ ryan: 'yes', kim: 'yes' });
  });

  it('four Yes locks a time automatically and closes the rest; Maybe or No does not', () => {
    let s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + 24 * H, NOW + 48 * H], zone: 'UTC' });
    const [first, second] = s.slots;
    s = act(s, 'darren', { type: 'vote', slot: second!.id, vote: 'yes' });
    s = act(s, 'adrian', { type: 'vote', slot: second!.id, vote: 'yes' });
    s = act(s, 'kim', { type: 'vote', slot: second!.id, vote: 'maybe' });
    expect(s.locked).toBeNull();
    s = act(s, 'kim', { type: 'vote', slot: first!.id, vote: 'no' });
    s = act(s, 'kim', { type: 'vote', slot: second!.id, vote: 'yes' });
    expect(s.locked?.id).toBe(second!.id);
    expect(s.slots).toEqual([]);
    expect(stillToVote(s, P)).toEqual([]);
  });

  it('shows who still has to vote', () => {
    let s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + 24 * H], zone: 'UTC' });
    expect(stillToVote(s, P)).toEqual(['darren', 'adrian', 'kim']);
    s = act(s, 'kim', { type: 'vote', slot: s.slots[0]!.id, vote: 'no' });
    expect(stillToVote(s, P)).toEqual(['darren', 'adrian']);
  });

  it('times in the past tidy away; a locked night stays until well after it starts', () => {
    let s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + H, NOW + 3 * H], zone: 'UTC' });
    expect(tidySchedule(s, NOW + 2.5 * H).slots).toHaveLength(1);
    for (const p of ['darren', 'adrian', 'kim']) s = act(s, p, { type: 'vote', slot: s.slots[0]!.id, vote: 'yes' });
    expect(s.locked).not.toBeNull();
    expect(tidySchedule(s, NOW + 5 * H).locked).not.toBeNull();
    expect(tidySchedule(s, NOW + H + LOCK_KEEP_MS + 1).locked).toBeNull();
  });

  it('only the proposer can withdraw a time; unlocking puts it back to vote on', () => {
    let s = act(emptySchedule(), 'ryan', { type: 'propose', times: [NOW + 24 * H, NOW + 30 * H], zone: 'UTC' });
    expect(code(s, 'kim', { type: 'withdraw', slot: s.slots[0]!.id })).toBe('NOT_YOURS');
    s = act(s, 'ryan', { type: 'withdraw', slot: s.slots[1]!.id });
    expect(s.slots).toHaveLength(1);
    for (const p of ['darren', 'adrian', 'kim']) s = act(s, p, { type: 'vote', slot: s.slots[0]!.id, vote: 'yes' });
    s = act(s, 'kim', { type: 'unlock' });
    expect(s.locked).toBeNull();
    expect(s.slots).toHaveLength(1);
    expect(s.slots[0]!.votes).toEqual({});
  });

  it('anything malformed from the network is refused, not thrown', () => {
    const e = emptySchedule();
    expect(code(e, 'kim', { type: 'propose', times: 'soon', zone: 'UTC' } as unknown as ScheduleAction)).toBe('BAD_TIMES');
    expect(code(e, 'kim', { type: 'propose', times: ['x'], zone: 'UTC' } as unknown as ScheduleAction)).toBe('PAST_TIME');
    expect(code(e, 'kim', { type: 'dance' } as unknown as ScheduleAction)).toBe('BAD_ACTION');
    expect(code(e, 'kim', { type: 'vote', slot: 's1', vote: 'perhaps' } as unknown as ScheduleAction)).toBe('BAD_VOTE');
  });

  it('a vote on a time that has gone is refused', () => {
    expect(code(emptySchedule(), 'kim', { type: 'vote', slot: 's9', vote: 'yes' })).toBe('NO_SLOT');
  });
});
