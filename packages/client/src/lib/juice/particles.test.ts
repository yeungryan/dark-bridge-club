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

describe('effects run on the clock, not per screen frame', () => {
  const { stepsFor, STEP_MS, MAX_STEPS } = fx;

  it('takes one 1/60 s step per 16.7 ms of real time', () => {
    expect(stepsFor(0, 16.7).steps).toBe(1);
    // A 30 fps frame takes two steps.
    expect(stepsFor(0, 33).steps).toBe(2);
  });

  it('carries leftover time to the next frame (120 Hz: a step every other frame)', () => {
    const first = stepsFor(0, 8);
    expect(first.steps).toBe(0);
    const second = stepsFor(first.carry, 8);
    expect(second.steps).toBe(1);
  });

  it('keeps 60 steps a second over a long run at any frame rate', () => {
    for (const dt of [1000 / 120, 1000 / 60, 1000 / 45, 1000 / 30]) {
      let carry = 0;
      let total = 0;
      for (let t = 0; t < 1000 - 1e-6; t += dt) {
        const r = stepsFor(carry, dt);
        carry = r.carry;
        total += r.steps;
      }
      expect(Math.abs(total - 60)).toBeLessThanOrEqual(1);
    }
  });

  it("doesn't stutter at 60 Hz when frames jitter a little under 16.7 ms", () => {
    let carry = 0;
    const steps: number[] = [];
    for (const dt of [16.5, 16.6, 16.4, 16.8, 16.5, 16.6]) {
      const r = stepsFor(carry, dt);
      carry = r.carry;
      steps.push(r.steps);
    }
    expect(steps).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('caps the steps in one frame and drops the backlog after a stall', () => {
    const r = stepsFor(0, 100);
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.carry).toBe(0);
    expect(stepsFor(0, MAX_STEPS * STEP_MS).steps).toBe(MAX_STEPS);
  });

  it('throws frozen (hit-stop) time away instead of catching up', () => {
    expect(stepsFor(10, 50, true)).toEqual({ steps: 0, carry: 0 });
    // After the freeze, an ordinary frame is just one step.
    expect(stepsFor(0, 16.7).steps).toBe(1);
  });
});
