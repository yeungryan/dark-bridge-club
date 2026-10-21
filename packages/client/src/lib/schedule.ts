import type { ProfileId, Schedule, ScheduleAction, Slot } from '@dark/engine';
import { icsFor } from './when';
import { roomKey, token } from './session';

// Spec S21 on the phone: talking to the server, the share link and saving the calendar file.
// (The time formatting is in when.ts.)

export interface ScheduleState {
  readonly schedule: Schedule;
  readonly players: readonly ProfileId[];
  readonly serverTime: number;
}

export async function loadSchedule(): Promise<ScheduleState> {
  const res = await fetch(`/api/schedule?token=${encodeURIComponent(token() ?? '')}`);
  if (!res.ok) throw new Error(`schedule ${res.status}`);
  return (await res.json()) as ScheduleState;
}

/** Sends a proposal or a vote; resolves to the new schedule, or rejects with the reason. */
export async function sendSchedule(action: ScheduleAction): Promise<ScheduleState> {
  const res = await fetch('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token(), action }),
  });
  const body = (await res.json().catch(() => ({}))) as ScheduleState & { message?: string };
  if (!res.ok) throw new Error(body.message ?? 'That didn’t go through. Try again.');
  return body;
}

/** This phone's time zone, e.g. "Asia/Manila". */
export const myZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** The site's link, with the room key so a tap from Messenger lands straight in. */
export function shareLink(): string {
  const key = roomKey();
  return `${location.origin}/${key ? `?k=${encodeURIComponent(key)}` : ''}`;
}

/** Saves the calendar file (opens the calendar app on most phones). */
export function downloadIcs(slot: Slot, link: string): void {
  const blob = new Blob([icsFor(slot, link)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dark-bridge-night.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
