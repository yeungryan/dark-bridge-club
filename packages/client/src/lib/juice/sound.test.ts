import { describe, expect, it, vi } from 'vitest';

vi.mock('./settings.svelte', () => ({ settings: { effectiveVolume: 1 } }));

const { comboStep, makeImpulse, riffleTimes, sound } = await import('./sound');
const { THEMES } = await import('../themes');

describe('sound', () => {
  it('keeps every method the rest of the app (and the e2e tests) rely on', () => {
    const names = ['tap', 'stamp', 'pass', 'going', 'sold', 'passedOut', 'card', 'lead', 'trumpIn', 'sweep', 'pip', 'trumpTrick', 'firstTrump', 'close', 'decider', 'clinch', 'flip', 'count', 'no', 'tick', 'accent', 'fanfare', 'combo', 'pickup', 'impact', 'riser', 'whoosh', 'riffle', 'dealCard', 'fan', 'dealButton', 'choir', 'scratch'];
    for (const n of names) expect(typeof (sound as Record<string, unknown>)[n]).toBe('function');
  });

  it('does nothing (and throws nothing) before the audio is unlocked', () => {
    expect(() => {
      sound.card(true);
      sound.combo(3);
      sound.impact(3);
      sound.riffle();
      sound.dealCard(51, 52);
      sound.fan();
      sound.dealButton();
    }).not.toThrow();
  });

  it('climbs the combo ladder for 8 steps, then stays near the top', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => comboStep(n).semitones);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThan(steps[i - 1]!);
    for (let n = 9; n < 30; n++) {
      expect(comboStep(n).semitones).toBeGreaterThanOrEqual(12);
      expect(comboStep(n).level).toBe(1);
    }
    expect(comboStep(1).level).toBe(0);
  });

  it('builds a short, decaying, bass-free room for every theme', () => {
    for (const theme of Object.values(THEMES)) {
      const room = theme.sound.room!;
      expect(room.decay).toBeLessThanOrEqual(0.9);
      const [l, r] = makeImpulse(48000, room);
      expect(l!.length).toBe(r!.length);
      expect(l!.length / 48000).toBeLessThan(1);
      let energy = 0;
      let tail = 0;
      let dc = 0;
      l!.forEach((v, i) => {
        energy += v * v;
        dc += v;
        if (i > l!.length * 0.75) tail += v * v;
      });
      expect(energy).toBeCloseTo(1, 3);
      expect(tail / energy).toBeLessThan(1e-3);
      expect(Math.abs(dc)).toBeLessThan(0.5);
    }
  });

  it('times a riffle that speeds up into the middle and slows down at the end', () => {
    for (let run = 0; run < 20; run++) {
      const t = riffleTimes(25, 0.5);
      expect(t).toHaveLength(25);
      expect(t[0]).toBe(0);
      expect(t[24]!).toBeCloseTo(0.5, 6);
      for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]!);
      const gap = (i: number) => t[i + 1]! - t[i]!;
      const edges = (gap(0) + gap(1) + gap(22) + gap(23)) / 4;
      const middle = (gap(10) + gap(11) + gap(12) + gap(13)) / 4;
      expect(middle).toBeLessThan(edges);
    }
  });
});
