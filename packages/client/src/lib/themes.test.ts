import { describe, expect, it } from 'vitest';
import { THEMES } from './themes';

// Spec S18 readability rule: every theme passes WCAG AA contrast on the things you read.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('S18 theme contrast (WCAG AA)', () => {
  for (const theme of Object.values(THEMES)) {
    const t = theme.tokens;
    it(`${theme.name}: text, cards, suits and buttons are readable`, () => {
      expect(contrast(t['--ink']!, t['--felt']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--ink-dim']!, t['--felt']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--card-ink']!, t['--card']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--card-red']!, t['--card']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--red-on-felt']!, t['--felt']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--accent-ink']!, t['--accent']!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--accent']!, t['--felt']!)).toBeGreaterThanOrEqual(3);
      // Red and black suits stay clearly different on the card.
      expect(contrast(t['--card-red']!, t['--card-ink']!)).toBeGreaterThanOrEqual(1.5);
    });
  }
});
