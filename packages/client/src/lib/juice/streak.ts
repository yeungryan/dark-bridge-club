// Ryan's streak stamps (Option B, round 9): from the third set won in a row, a stamp slams onto
// the table after the attack, then shrinks into the scoreboard, where the plain "×n" stays.
// The names echo DOTA's kill-streak announcer, with "Kill" swapped for "Skill" and bridge words.
// Two in a row gets no stamp (the "×2" and the rising note are enough). The look stops growing at
// ten; eleven to thirteen (only in a game played out) have their own sweep names (round 10).

export const STREAK_NAMES: Readonly<Record<number, string>> = {
  3: 'Skilling Spree',
  4: 'Dominating',
  5: 'Mega Skill',
  6: 'Untrumpable',
  7: 'Wicked Slick',
  8: 'Monster Skill',
  9: 'Goldlike',
  10: 'Beyond Goldlike',
  11: 'Peekasweep',
  12: 'Sweeplike',
  13: 'Sweeep',
};

/** The first streak that gets a stamp, and the one where the look stops growing. */
export const STAMP_FROM = 3;
export const STAMP_PEAK = 10;
/** A deal has 13 sets, so 13 is the longest streak there is. */
const LAST_NAME = 13;

/** The stamp's words for `n` sets in a row, or null for no stamp. */
export function streakName(n: number): string | null {
  return n < STAMP_FROM ? null : STREAK_NAMES[Math.min(n, LAST_NAME)]!;
}
