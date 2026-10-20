// Spec S16: every timing and every intensity response, in one place.
// All durations are in ms at Normal speed; Fast multiplies them by SPEED.fast.

export const SPEED = { normal: 1, fast: 0.6 } as const;

export const TIMING = {
  /** Card lifts when tapped. */
  raise: 160,
  /** A played card travels from its player's side to the trick. */
  cardFly: 220,
  /** How long a finished trick stays visible before sweeping to the winner. */
  trickHold: 650,
  /** The sweep of a finished trick toward its winner. */
  sweep: 280,
  /** A meter pip filling. */
  pipPop: 320,
  /** Shake decays to nothing over this long. */
  shakeDecay: 320,
  /** "Play it out?" fades in after the clinch moment has landed. */
  clinchPromptDelay: 650,
  /** Numbers counting up (tallies, HCP). */
  countUp: 600,
  reveal: { banner: 450, firstFlip: 500, flipGap: 260, flip: 320 },
  ceremony: { crestFlare: 1200, spotlightStep: 110, spotlightSteps: 14, pairSnap: 1600 },
} as const;

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

export interface Response {
  /** Freeze the visuals briefly before the payoff. Input is never frozen. */
  hitPauseMs: number;
  /** Peak shake in px, applied to the trick area only. */
  shakePx: number;
  /** Particle burst size. */
  particles: number;
}

/** The intensity table (S16). Level 5 values grow further with drama (see clinchDrama). */
export const RESPONSES: Record<Level, Response> = {
  0: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  1: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  2: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  3: { hitPauseMs: 60, shakePx: 0, particles: 0 },
  4: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  5: { hitPauseMs: 120, shakePx: 7, particles: 60 },
};

/** Extra shake and particles per point of clinch drama (0–3). */
export const DRAMA_BOOST = { shakePx: 3, particles: 30 } as const;

/** Phones get a hard particle budget so the clinch stays smooth. */
export const PARTICLE_BUDGET = 150;
