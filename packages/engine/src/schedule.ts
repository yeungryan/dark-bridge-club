import { fail, type Outcome } from './types';
import type { ProfileId } from './session';

// Spec S21, the next-game scheduler: scheduling is the main reason the four of you don't meet,
// so it's as quick as we can make it. Anyone proposes 1–5 times (each stored in UTC, with the
// proposer's time zone so others can see "their" time too); everyone marks each Yes / Maybe /
// No; the first time all four say Yes to locks automatically. Times in the past tidy away.

export type Vote = 'yes' | 'maybe' | 'no';
export const VOTES: readonly Vote[] = ['yes', 'maybe', 'no'];

export interface Slot {
  readonly id: string;
  /** The start, in UTC milliseconds. */
  readonly at: number;
  readonly proposedBy: ProfileId;
  /** The proposer's IANA time zone (e.g. "Asia/Manila"), to show their local time too. */
  readonly proposerZone: string;
  readonly votes: Readonly<Record<ProfileId, Vote>>;
}

export interface Schedule {
  /** Open times, soonest first. */
  readonly slots: readonly Slot[];
  /** The time everyone said Yes to, if any (kept until it's well past). */
  readonly locked: Slot | null;
  /** Bumped on every change, so a slot id is never reused. */
  readonly seq: number;
}

export type ScheduleAction =
  | { readonly type: 'propose'; readonly times: readonly number[]; readonly zone: string }
  | { readonly type: 'vote'; readonly slot: string; readonly vote: Vote }
  /** Withdraw a time you proposed (before anyone has locked it). */
  | { readonly type: 'withdraw'; readonly slot: string }
  /** Unlock: plans changed; everyone votes again. */
  | { readonly type: 'unlock' };

export const MAX_PER_PROPOSAL = 5;
export const MAX_OPEN_SLOTS = 12;
/** Times are proposed at most this far ahead. */
export const MAX_AHEAD_MS = 120 * 24 * 60 * 60 * 1000;
/** A locked night stays on the home screen until this long after it starts. */
export const LOCK_KEEP_MS = 12 * 60 * 60 * 1000;
/** An open time disappears once it's this far in the past. */
const OPEN_KEEP_MS = 60 * 60 * 1000;

export const emptySchedule = (): Schedule => ({ slots: [], locked: null, seq: 0 });

/** Drops times that have passed (and a locked night once it's well over). */
export function tidySchedule(s: Schedule, now: number): Schedule {
  const slots = s.slots.filter((slot) => slot.at > now - OPEN_KEEP_MS);
  const locked = s.locked && s.locked.at > now - LOCK_KEEP_MS ? s.locked : null;
  return slots.length === s.slots.length && locked === s.locked ? s : { ...s, slots, locked };
}

const isZone = (zone: unknown): zone is string => typeof zone === 'string' && zone.length > 0 && zone.length < 64;

export function applySchedule(
  schedule: Schedule,
  by: ProfileId,
  action: ScheduleAction,
  now: number,
  players: readonly ProfileId[],
): Outcome<Schedule, never> {
  const s = tidySchedule(schedule, now);
  switch (action.type) {
    case 'propose': {
      if (!Array.isArray(action.times)) return fail('BAD_TIMES', `Propose 1 to ${MAX_PER_PROPOSAL} times.`);
      const times = [...new Set(action.times)];
      if (times.length < 1 || times.length > MAX_PER_PROPOSAL) return fail('BAD_TIMES', `Propose 1 to ${MAX_PER_PROPOSAL} times.`);
      if (!isZone(action.zone)) return fail('BAD_ZONE', 'Missing your time zone.');
      for (const t of times) {
        if (typeof t !== 'number' || !Number.isFinite(t) || t < now) return fail('PAST_TIME', 'Pick times that are still to come.');
        if (t > now + MAX_AHEAD_MS) return fail('TOO_FAR', 'Pick times within the next four months.');
      }
      // The same time twice is one slot: a duplicate proposal just counts as your Yes.
      const fresh = times.filter((t) => !s.slots.some((slot) => slot.at === t));
      if (s.slots.length + fresh.length > MAX_OPEN_SLOTS) return fail('TOO_MANY', 'There are already plenty of times to vote on.');
      let seq = s.seq;
      const added: Slot[] = fresh.map((at) => ({ id: `s${++seq}`, at, proposedBy: by, proposerZone: action.zone, votes: { [by]: 'yes' } }));
      const slots = [...s.slots.map((slot) => (times.includes(slot.at) ? { ...slot, votes: { ...slot.votes, [by]: 'yes' as Vote } } : slot)), ...added].sort(
        (a, b) => a.at - b.at,
      );
      return ok(lockIfAgreed({ ...s, slots, seq }, players));
    }
    case 'vote': {
      if (!VOTES.includes(action.vote)) return fail('BAD_VOTE', 'Vote Yes, Maybe or No.');
      if (!s.slots.some((slot) => slot.id === action.slot)) return fail('NO_SLOT', 'That time has gone.');
      const slots = s.slots.map((slot) => (slot.id === action.slot ? { ...slot, votes: { ...slot.votes, [by]: action.vote } } : slot));
      return ok(lockIfAgreed({ ...s, slots, seq: s.seq + 1 }, players));
    }
    case 'withdraw': {
      const slot = s.slots.find((x) => x.id === action.slot);
      if (!slot) return fail('NO_SLOT', 'That time has gone.');
      if (slot.proposedBy !== by) return fail('NOT_YOURS', 'Only whoever proposed a time can take it back.');
      return ok({ ...s, slots: s.slots.filter((x) => x !== slot), seq: s.seq + 1 });
    }
    case 'unlock':
      if (!s.locked) return ok(s);
      return ok({ ...s, slots: [...s.slots, { ...s.locked, votes: {} }].sort((a, b) => a.at - b.at), locked: null, seq: s.seq + 1 });
    default:
      // From the network: anything else is refused, never thrown.
      return fail('BAD_ACTION', 'Unknown action.');
  }
}

const ok = (state: Schedule): Outcome<Schedule, never> => ({ ok: true, state, events: [] });

/** All four say Yes to a time: it locks (the soonest, if several), and the rest close. */
function lockIfAgreed(s: Schedule, players: readonly ProfileId[]): Schedule {
  if (s.locked) return s;
  const agreed = s.slots.find((slot) => players.every((p) => slot.votes[p] === 'yes'));
  return agreed ? { ...s, locked: agreed, slots: [] } : s;
}

/** Who hasn't voted on every open time yet (the home screen's gentle nudge). */
export function stillToVote(s: Schedule, players: readonly ProfileId[]): ProfileId[] {
  if (s.slots.length === 0) return [];
  return players.filter((p) => s.slots.some((slot) => !slot.votes[p]));
}
