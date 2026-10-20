import { describe, expect, it, vi } from 'vitest';

vi.mock('./settings.svelte', () => ({ settings: { motion: true } }));

const fx = await import('./particles');
const { hotter, toRgb } = await import('./glow');

describe('particles without a canvas', () => {
  it('comet still lands at once, so the score updates', () => {
    const onArrive = vi.fn();
    fx.comet({ x: 0, y: 0 }, { x: 10, y: 10 }, 300, '#e8c25a', onArrive);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('every effect is a safe no-op', () => {
    expect(() => {
      fx.lightBurst(10, 10, ['#fff', '#e8c25a'], 3);
      fx.pop(10, 10, '#e8c25a');
      fx.screenFlash('#ffd27a', 0.9, 10);
      fx.freeze(120);
      fx.freeze(-5);
      for (const el of ['fire', 'air', 'water', 'earth'] as const) {
        fx.elementBurst(el, 10, 10, 3);
        fx.elementWin(el, 10, 10);
        fx.elementStrike(el, 10, 10, 2);
      }
    }).not.toThrow();
  });
});

describe('glow colours', () => {
  it('parses hex colours', () => {
    expect(toRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(toRgb('#fff')).toEqual([255, 255, 255]);
  });

  it('pushes a colour toward white', () => {
    expect(hotter('#000000', 0.5)).toBe('rgb(128,128,128)');
    expect(hotter('#ff0000', 0)).toBe('rgb(255,0,0)');
  });
});
