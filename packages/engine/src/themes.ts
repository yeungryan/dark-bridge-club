// Spec S18: which theme a night gets. The look itself (colours, textures, fonts, sound
// tweaks) lives in the client; the server only rolls and remembers the theme id.
// Themes never change rules or timing.

export const THEME_IDS = ['clubhouse', 'marina', 'shibuya', 'berlin', 'bali', 'manila'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Rolled from a shuffled bag, so every regular theme comes up once before any repeats. */
export const REGULAR_THEMES: readonly ThemeId[] = ['clubhouse', 'marina', 'shibuya', 'berlin', 'bali'];
/** "Your Place" (Manila Sleepover): slipped into only some refills of the bag, so it stays rare. */
export const RARE_THEME: ThemeId = 'manila';
export const RARE_CHANCE = 0.35;

export interface ThemeBag {
  /** Themes still to come before the bag refills. */
  readonly remaining: readonly ThemeId[];
}

/** The very first night is always the Clubhouse (the "home" theme). */
export const FIRST_BAG: ThemeBag = { remaining: ['clubhouse'] };

export function rollTheme(bag: ThemeBag, random: () => number, last?: ThemeId): { theme: ThemeId; bag: ThemeBag } {
  let remaining = [...bag.remaining];
  if (remaining.length === 0) {
    remaining = [...REGULAR_THEMES];
    if (random() < RARE_CHANCE) remaining.push(RARE_THEME);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j]!, remaining[i]!];
    }
    // Never the same theme twice in a row across a refill.
    if (remaining[0] === last && remaining.length > 1) [remaining[0], remaining[1]] = [remaining[1]!, remaining[0]!];
  }
  const [theme, ...rest] = remaining;
  return { theme: theme!, bag: { remaining: rest } };
}

export const isThemeId = (x: unknown): x is ThemeId => typeof x === 'string' && (THEME_IDS as readonly string[]).includes(x);
