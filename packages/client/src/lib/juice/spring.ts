// Springs for CSS (Balatro-style pops): a damped spring simulated once and sampled into a
// CSS `linear()` easing, so a pop overshoots and settles with a little wobble instead of
// easing in a straight curve. Browsers without `linear()` get a plain overshoot curve.

export interface Spring {
  /** Stiffness and damping per unit mass. Lower damping = more wobble. */
  stiffness: number;
  damping: number;
}

/** Bouncy: cards popping, winners, stamps. */
export const POP: Spring = { stiffness: 700, damping: 26 };
/** Wobbly: a big hit settling (a few visible swings). */
export const WOBBLE: Spring = { stiffness: 900, damping: 20 };
/** Soft: lifting and settling cards, no visible swing back. */
export const SOFT: Spring = { stiffness: 450, damping: 34 };

/** Simulates the spring from 0 to 1; returns sampled positions and how long it takes to settle (ms). */
export function simulate(s: Spring, samples = 48): { points: number[]; ms: number } {
  const dt = 1 / 1000;
  let x = 0;
  let v = 0;
  const trace: number[] = [];
  // Run until it has settled (or 2 s at most).
  for (let t = 0; t < 2000; t++) {
    const a = -s.stiffness * (x - 1) - s.damping * v;
    v += a * dt;
    x += v * dt;
    trace.push(x);
    if (t > 50 && Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
  }
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    if (i === samples) return 1;
    return trace[Math.round((i / samples) * (trace.length - 1))]!;
  });
  return { points, ms: trace.length };
}

/** The CSS easing for a spring. */
export function springEasing(s: Spring): string {
  return `linear(${simulate(s)
    .points.map((p) => Math.round(p * 1000) / 1000)
    .join(', ')})`;
}

const FALLBACK = 'cubic-bezier(0.3, 1.6, 0.6, 1)';

/**
 * Puts the springs on the page as CSS variables: `--spring-pop`, `--spring-wobble`,
 * `--spring-soft` (easings) and `--spring-pop-ms` etc. (how long each takes to settle, before
 * the speed setting is applied).
 */
export function installSprings(root: HTMLElement): void {
  const supported = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');
  for (const [name, s] of [
    ['pop', POP],
    ['wobble', WOBBLE],
    ['soft', SOFT],
  ] as const) {
    root.style.setProperty(`--spring-${name}`, supported ? springEasing(s) : FALLBACK);
    root.style.setProperty(`--spring-${name}-ms`, `${simulate(s).ms}ms`);
  }
}
