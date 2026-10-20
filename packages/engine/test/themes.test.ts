import { describe, expect, it } from 'vitest';
import { FIRST_BAG, RARE_THEME, REGULAR_THEMES, rollTheme, type ThemeBag, type ThemeId } from '../src/themes';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('S18 theme roll', () => {
  it('the first night is the Clubhouse', () => {
    expect(rollTheme(FIRST_BAG, Math.random).theme).toBe('clubhouse');
  });

  it('every regular theme comes up before any repeats, never twice in a row, and Manila stays rare', () => {
    const random = seeded(42);
    let bag: ThemeBag = { remaining: [] };
    let last: ThemeId | undefined;
    const nights: ThemeId[] = [];
    for (let i = 0; i < 3000; i++) {
      const out = rollTheme(bag, random, last);
      expect(out.theme).not.toBe(last);
      nights.push(out.theme);
      bag = out.bag;
      last = out.theme;
    }
    // Each refill holds every regular theme once, so their counts never drift apart by more than one.
    const counts = Object.fromEntries(REGULAR_THEMES.map((t) => [t, nights.filter((n) => n === t).length]));
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    const rare = nights.filter((n) => n === RARE_THEME).length;
    expect(rare).toBeGreaterThan(0);
    expect(rare).toBeLessThan(values[0]! * 0.5);
  });
});
