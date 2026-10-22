// Spec S16: every timing and every intensity response, in one place.
// All durations are in ms at Normal speed; Fast multiplies them by SPEED.fast.

export const SPEED = { normal: 1, fast: 0.6 } as const;

/**
 * Tests only: `?turbo=1` on the practice page plays everything at 0.15× and makes the bots
 * answer at once, so end-to-end tests don't spend minutes watching animations. Players never
 * see it (it's not a setting).
 */
export const TURBO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('turbo');
const TURBO_SPEED = 0.15;
export const speedFactor = (mode: keyof typeof SPEED) => (TURBO ? TURBO_SPEED : SPEED[mode]);

export const TIMING = {
  /** Card lifts when tapped. */
  raise: 160,
  /** A played card travels from its player's side to the trick. */
  cardFly: 220,
  /** How long a finished trick stays visible before sweeping to the winner: the set-win
   *  effect's 0.80 s (Ryan's cap, S24), so the wrecked cards are seen before they go. */
  trickHold: 800,
  /** After a set's last card lands, a beat to see the cards and who won before the effects
   *  start (Ryan, round 10: the effects reinforce what you've already seen). */
  scan: 400,
  /** The game-winning set's attack and finisher (S24: 1.6 s). */
  gameWonFx: 1600,
  /** Extra hold for the first trump trick of a deal, so its banner can land. */
  firstTrumpHold: 450,
  /** A trick's glowing orb travelling to its side's score bar. */
  orbFly: 380,
  /** The last-trick peek: each card's flip, and the gap between cards. */
  peekFlip: 260,
  peekGap: 70,
  /** A dragged card must travel this far up (px), or be flicked this fast (px/ms), to be played. */
  dragToPlay: 70,
  flickSpeed: 0.6,
  flickMin: 24,
  /** The sweep of a finished trick toward its winner. */
  sweep: 280,
  /** A meter pip filling. */
  pipPop: 320,
  /** Shake decays to nothing over this long. */
  shakeDecay: 320,
  /** After a game's last set has finished its effects (and its orb and any streak stamp have
   *  reached the scoreboard), the table stays up this long before the results (Ryan: 3 s). */
  resultsDelay: 3000,
  /** "Play it out?" fades in after the clinch moment has landed. */
  clinchPromptDelay: 650,
  /** Numbers counting up (tallies, HCP). */
  countUp: 600,
  reveal: { banner: 450, firstFlip: 500, flipGap: 260, flip: 320 },
  ceremony: { crestFlare: 2600, spotlightStep: 110, spotlightSteps: 14, pairSnap: 1600 },
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
//   1 a card or a call · 2 takes the lead, trick won · 3 trump-in, trump trick, contract set
//   4 first trump trick, decider · 5 the clinch (and the end of the night)
export const RESPONSES: Record<Level, Response> = {
  0: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  1: { hitPauseMs: 0, shakePx: 0, particles: 0 },
  2: { hitPauseMs: 0, shakePx: 2, particles: 12 },
  3: { hitPauseMs: 40, shakePx: 4, particles: 26 },
  4: { hitPauseMs: 90, shakePx: 6, particles: 45 },
  5: { hitPauseMs: 120, shakePx: 7, particles: 60 },
};

/** Extra shake and particles per point of clinch drama (0–3). */
export const DRAMA_BOOST = { shakePx: 3, particles: 30 } as const;

/** Phones get a hard particle budget so the clinch stays smooth. */
export const PARTICLE_BUDGET = 150;
