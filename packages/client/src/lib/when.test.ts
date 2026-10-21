import { describe, expect, it } from 'vitest';
import { emptySchedule, type Slot } from '@dark/engine';
import { countdown, icsFor, inviteText, quickTimes, slotLabel, theirTime } from './when';

const slot = (at: number, proposerZone: string): Slot => ({ id: 's1', at, proposedBy: 'darren', proposerZone, votes: {} });
const H = 60 * 60 * 1000;

describe('S21 times in each person\'s own zone', () => {
  it('two zones on either side of a daylight-saving change both read correctly', () => {
    // New York leaves daylight time on Sun 1 Nov 2026; Manila has none.
    const before = Date.UTC(2026, 10, 1, 0, 0); // 8 PM Sat 31 Oct in New York (UTC−4)
    const after = Date.UTC(2026, 10, 3, 1, 0); // 8 PM Mon 2 Nov in New York (UTC−5)
    expect(slotLabel(before, 'America/New_York', 'en-US')).toEqual({ day: 'Sat, Oct 31', time: '8:00 PM' });
    expect(slotLabel(after, 'America/New_York', 'en-US')).toEqual({ day: 'Mon, Nov 2', time: '8:00 PM' });
    // The same moments in Manila: 8 AM, then 9 AM, as New York's clocks fall back.
    expect(slotLabel(before, 'Asia/Manila', 'en-US')).toEqual({ day: 'Sun, Nov 1', time: '8:00 AM' });
    expect(slotLabel(after, 'Asia/Manila', 'en-US')).toEqual({ day: 'Tue, Nov 3', time: '9:00 AM' });
  });

  it("shows the proposer's own time only when it reads differently", () => {
    const at = Date.UTC(2026, 10, 1, 0, 0);
    expect(theirTime(slot(at, 'America/New_York'), 'Asia/Manila', 'en-US')).toBe('8:00 PM Sat, Oct 31');
    expect(theirTime(slot(at, 'Asia/Manila'), 'Asia/Manila', 'en-US')).toBeNull();
    // A different zone name that reads the same right now (Manila and Singapore are both UTC+8).
    expect(theirTime(slot(at, 'Asia/Singapore'), 'Asia/Manila', 'en-US')).toBeNull();
  });

  it('quick picks: the next seven evenings at 8 PM local, none in the past', () => {
    const now = Date.UTC(2026, 9, 21, 12, 0);
    const picks = quickTimes(now);
    expect(picks).toHaveLength(7);
    for (const p of picks) {
      expect(p).toBeGreaterThan(now);
      expect(new Date(p).getHours()).toBe(20);
    }
    for (let i = 1; i < picks.length; i++) expect(Math.abs(picks[i]! - picks[i - 1]! - 24 * H)).toBeLessThanOrEqual(H);
  });

  it('counts down in words', () => {
    expect(countdown(3 * 24 * H)).toBe('in 3 days');
    expect(countdown(5 * H + 20 * 60_000)).toBe('in 5 h 20 min');
    expect(countdown(2 * H)).toBe('in 2 h');
    expect(countdown(12 * 60_000)).toBe('in 12 min');
    expect(countdown(0)).toBe('now');
  });

  it('the invite lists the times, or the night that is on', () => {
    const s = { ...emptySchedule(), slots: [slot(Date.UTC(2026, 10, 1, 0, 0), 'UTC')] };
    const text = inviteText(s, 'https://x/?k=a', 'America/New_York');
    expect(text.startsWith('🂡 Bridge night? Options: ')).toBe(true);
    expect(text).toContain(slotLabel(s.slots[0]!.at, 'America/New_York').time);
    expect(text.endsWith('Vote here: https://x/?k=a')).toBe(true);
    expect(inviteText({ ...s, locked: s.slots[0]!, slots: [] }, 'L')).toMatch(/is on: .* See you at the table: L$/);
  });

  it('the calendar file: CRLF lines, UTC times, three hours, a 30-minute reminder', () => {
    const at = Date.UTC(2026, 10, 1, 0, 0);
    const ics = icsFor(slot(at, 'UTC'), 'https://x/?k=a,b', Date.UTC(2026, 9, 21));
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(lines).toContain('DTSTART:20261101T000000Z');
    expect(lines).toContain('DTEND:20261101T030000Z');
    expect(lines).toContain('TRIGGER:-PT30M');
    expect(lines.find((l) => l.startsWith('DESCRIPTION:Bridge night'))).toContain('a\\,b');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });
});
