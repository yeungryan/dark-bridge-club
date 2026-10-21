import type { Schedule, Slot } from '@dark/engine';

// Spec S21: times in each person's own time zone, the quick picks, the countdown, the invite
// and the calendar file. Pure (no page or network), so it's unit tested across time zones.

/** A time as "Fri 24 Oct" and "8:00 PM" in `zone` (this phone's zone if omitted). */
export function slotLabel(at: number, zone?: string, locale?: string): { day: string; time: string } {
  const opts = zone ? { timeZone: zone } : {};
  return {
    day: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', ...opts }).format(at),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', ...opts }).format(at),
  };
}

/** The proposer's own time, when it reads differently from yours ("Darren: 9:00 PM Sat 25 Oct"). */
export function theirTime(slot: Slot, viewerZone: string, locale?: string): string | null {
  if (slot.proposerZone === viewerZone) return null;
  const mine = slotLabel(slot.at, viewerZone, locale);
  const theirs = slotLabel(slot.at, slot.proposerZone, locale);
  if (mine.day === theirs.day && mine.time === theirs.time) return null;
  return `${theirs.time} ${theirs.day}`;
}

/** Quick picks: the next seven evenings at `hour`:`minute` local time, skipping any already past. */
export function quickTimes(now: number, hour = 20, minute = 0, count = 7): number[] {
  const out: number[] = [];
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  while (out.length < count) {
    out.push(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** "in 2 days", "in 5 h 20 min", "in 12 min", "now". */
export function countdown(ms: number): string {
  if (ms <= 60_000) return ms > -3 * 60 * 60 * 1000 ? 'now' : 'over';
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const days = Math.floor(h / 24);
  if (days >= 2) return `in ${days} days`;
  if (h >= 1) return `in ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `in ${min} min`;
}

/** The "Copy invite" message for Messenger. */
export function inviteText(schedule: Schedule, link: string, zone?: string): string {
  if (schedule.locked) {
    const { day, time } = slotLabel(schedule.locked.at, zone);
    return `🂡 DARK Bridge Club is on: ${day}, ${time}! See you at the table: ${link}`;
  }
  const times = schedule.slots.slice(0, 5).map((s) => {
    const { day, time } = slotLabel(s.at, zone);
    return `${day} ${time}`;
  });
  return `🂡 Bridge night? ${times.length ? `Options: ${times.join(' · ')}. ` : ''}Vote here: ${link}`;
}

const icsDate = (at: number) => new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** An .ics calendar file for the locked night (3 hours, in UTC, so any calendar converts it). */
export function icsFor(slot: Slot, link: string, now = Date.now()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DARK Bridge Club//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${slot.id}-${slot.at}@dark-bridge-club`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(slot.at)}`,
    `DTEND:${icsDate(slot.at + 3 * 60 * 60 * 1000)}`,
    `SUMMARY:${icsText('DARK Bridge Club')}`,
    `DESCRIPTION:${icsText(`Bridge night. Join on the call, then: ${link}`)}`,
    `URL:${link}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText('Bridge night in 30 minutes')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
