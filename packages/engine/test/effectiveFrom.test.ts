import { describe, expect, it } from 'vitest';
import { countedNights, effectiveFrom } from '../src';

// Ryan: we reset everything to 0–0 at the table, then won 3–0, and the night didn't count.
describe('when an agreed score or a reset takes effect', () => {
  const oct25 = { startedAt: 1000, endedAt: 1900, firstGameAt: 1200 };
  const oct30 = { startedAt: 3000, endedAt: null, firstGameAt: null };

  it('agreed after partners were picked but before the first game: counts from that night\'s start', () => {
    expect(effectiveFrom(3100, [oct25, oct30])).toBe(3000);
    // The night then counts toward the all-time stats.
    expect(countedNights([{ startedAt: 3000 }, { startedAt: 1000 }] as never, effectiveFrom(3100, [oct25, oct30]))).toHaveLength(1);
  });

  it('the same once that night has finished its games, looking back', () => {
    const played = { startedAt: 3000, endedAt: 9000, firstGameAt: 3500 };
    expect(effectiveFrom(3100, [oct25, played])).toBe(3000);
  });

  it('agreed after a game was already finished that night: counts from then (the night does not)', () => {
    expect(effectiveFrom(1500, [oct25])).toBe(1500);
  });

  it('agreed between nights: counts from then', () => {
    expect(effectiveFrom(2500, [oct25, oct30])).toBe(2500);
    expect(effectiveFrom(2500, [])).toBe(2500);
  });

  it('a night that ended before it was agreed is not reopened', () => {
    expect(effectiveFrom(2000, [{ startedAt: 1000, endedAt: 1500, firstGameAt: null }])).toBe(2000);
  });
});
