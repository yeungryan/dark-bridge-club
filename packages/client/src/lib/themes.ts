import type { ThemeId } from '@dark/engine';

// Spec S18: each theme is only design values (colours, textures, fonts, sound tweaks and a
// greeting). Player names and card ranks take the theme's fonts (loaded from Google Fonts in
// the HTML; system fonts stand in until they arrive). Timing never changes between themes. Adding a theme = adding an entry here.
// Every theme must pass the contrast checks in themes.test.ts.

export interface Theme {
  id: ThemeId;
  name: string;
  /** The place it's for (flag + country). */
  place: string;
  /** Shown to the left of the theme's name in the lobby. */
  flag: string;
  greeting: string;
  /** CSS custom properties applied to :root. */
  tokens: Record<string, string>;
  /** Sound variant: pitch multiplier, and an optional inharmonic bell partial (gamelan-like). */
  sound: { pitch: number; bellPartial?: number };
}

const base = {
  '--good': '#63c58b',
  '--bad': '#e2725b',
  '--trump': '#c58bff',
  /* The other pair's colour during play (yours is --accent). */
  '--silver': '#c9ced6',
  '--font': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  '--font-display': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export const THEMES: Record<ThemeId, Theme> = {
  clubhouse: {
    id: 'clubhouse',
    flag: '♠',
    name: 'The Clubhouse',
    place: '♠ Home',
    greeting: 'Evening, gentlemen. The lamp is on.',
    sound: { pitch: 1 },
    tokens: {
      ...base,
      '--surface': "radial-gradient(circle at 50% 40%, #1d5a3e 0%, #154630 70%, #113a28 100%)",
      '--surface-rim': '0 0 0 7px #5a3a22, 0 0 0 8px rgba(201, 164, 92, 0.6), 0 10px 30px rgba(0, 0, 0, 0.45)',
      '--surface-radius': '50%',
      '--font-name': "'Playfair Display', Georgia, serif",
      '--font-card': "'Libre Baskerville', Georgia, serif",
      '--felt': '#0f2a1e',
      '--felt-light': '#16392a',
      '--felt-bg':
        'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255, 214, 140, 0.16), transparent 70%), radial-gradient(ellipse at 50% 45%, #18402e 0%, #0f2a1e 65%, #0a1f16 100%)',
      '--sheet': '#0b1f16',
      '--ink': '#f3efe4',
      '--ink-dim': '#b9b4a5',
      '--line': 'rgba(243, 239, 228, 0.18)',
      '--panel': 'rgba(0, 0, 0, 0.35)',
      '--card': '#fbf8f0',
      '--card-ink': '#1d1d1d',
      '--card-red': '#c0392b',
      '--red-on-felt': '#ff8a7a',
      '--accent': '#e8c25a',
      '--accent-ink': '#1d1a10',
      '--accent-glow': 'rgba(232, 194, 90, 0.6)',
      '--card-back': 'repeating-linear-gradient(45deg, #1d4a35 0 6px, #16392a 6px 12px)',
      '--font-display': "Georgia, 'Times New Roman', serif",
    },
  },
  marina: {
    id: 'marina',
    flag: '🇸🇬',
    name: 'Marina Riviera',
    place: '🇸🇬 Singapore',
    greeting: 'Sunset over the bay. Orchids on the table.',
    sound: { pitch: 1.04 },
    tokens: {
      ...base,
      '--surface': "radial-gradient(circle at 50% 30%, rgba(122, 214, 230, 0.35), rgba(16, 80, 99, 0.65) 70%)",
      '--surface-rim': '0 0 0 6px #e8dccb, 0 0 0 7px rgba(255, 143, 107, 0.5), 0 10px 30px rgba(0, 0, 0, 0.4)',
      '--surface-radius': '50%',
      '--font-name': "'Poppins', 'Avenir Next', system-ui, sans-serif",
      '--font-card': "'Poppins', 'Avenir Next', system-ui, sans-serif",
      '--felt': '#0c3440',
      '--felt-light': '#134654',
      '--felt-bg':
        'linear-gradient(180deg, rgba(255, 143, 107, 0.28) 0%, rgba(214, 51, 108, 0.12) 22%, transparent 45%), radial-gradient(ellipse at 50% 60%, #105063 0%, #0c3440 60%, #082630 100%)',
      '--sheet': '#082a33',
      '--ink': '#fff4ea',
      '--ink-dim': '#bcd3d6',
      '--line': 'rgba(255, 244, 234, 0.2)',
      '--panel': 'rgba(0, 20, 26, 0.4)',
      '--card': '#fffaf2',
      '--card-ink': '#14262b',
      '--card-red': '#c42c4a',
      '--red-on-felt': '#ff9aa8',
      '--accent': '#ff8f6b',
      '--accent-ink': '#2a0f06',
      '--accent-glow': 'rgba(255, 143, 107, 0.6)',
      '--card-back': 'repeating-linear-gradient(-45deg, #d6336c 0 5px, #b0275a 5px 10px)',
    },
  },
  shibuya: {
    id: 'shibuya',
    flag: '🇯🇵',
    name: 'Shibuya Neon',
    place: '🇯🇵 Japan',
    greeting: 'Rain on the glass, neon on the felt.',
    sound: { pitch: 1.07 },
    tokens: {
      ...base,
      '--surface': "radial-gradient(circle, rgba(34, 22, 63, 0.85) 0%, rgba(19, 11, 38, 0.9) 100%)",
      '--surface-rim': '0 0 0 2px #35f2ff, 0 0 14px 2px rgba(53, 242, 255, 0.55), 0 0 0 7px rgba(255, 62, 165, 0.35), 0 0 30px 6px rgba(255, 62, 165, 0.25)',
      '--surface-radius': '50%',
      '--font-name': "'Orbitron', 'Avenir Next', system-ui, sans-serif",
      '--font-card': "'Space Mono', 'SF Mono', Menlo, monospace",
      '--felt': '#130b26',
      '--felt-light': '#22163f',
      '--felt-bg':
        'radial-gradient(circle at 15% 10%, rgba(255, 62, 165, 0.28), transparent 40%), radial-gradient(circle at 90% 85%, rgba(53, 242, 255, 0.2), transparent 45%), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 28px), #130b26',
      '--sheet': '#1a1033',
      '--ink': '#f5f0ff',
      '--ink-dim': '#bfb2e0',
      '--line': 'rgba(181, 150, 255, 0.3)',
      '--panel': 'rgba(10, 4, 24, 0.55)',
      '--card': '#fdfcff',
      '--card-ink': '#17122a',
      '--card-red': '#d81b5c',
      '--red-on-felt': '#ff7fb6',
      '--accent': '#35f2ff',
      '--accent-ink': '#06222a',
      '--accent-glow': 'rgba(53, 242, 255, 0.65)',
      '--card-back': 'repeating-linear-gradient(90deg, #ff3ea5 0 3px, #22163f 3px 9px)',
      '--font-display': "'Hiragino Sans', 'Avenir Next', system-ui, sans-serif",
    },
  },
  berlin: {
    id: 'berlin',
    flag: '🇩🇪',
    name: 'Berlin Midnight',
    place: '🇩🇪 Germany',
    greeting: 'A late set in a Berlin bar. Brass and smoke.',
    sound: { pitch: 0.94 },
    tokens: {
      ...base,
      '--surface': "radial-gradient(circle at 50% 35%, #2a1d14 0%, #1c130d 80%)",
      '--surface-rim': '0 0 0 3px #c9a45c, 0 0 0 9px #141d3a, 0 0 0 10px rgba(201, 164, 92, 0.5), 0 10px 30px rgba(0, 0, 0, 0.5)',
      '--surface-radius': '50%',
      '--font-name': "'Bodoni Moda', Didot, Georgia, serif",
      '--font-card': "'Bodoni Moda', Didot, Georgia, serif",
      '--felt': '#0d1630',
      '--felt-light': '#18244a',
      '--felt-bg':
        'radial-gradient(ellipse 70% 40% at 30% 20%, rgba(201, 164, 92, 0.12), transparent 70%), radial-gradient(ellipse 60% 50% at 75% 70%, rgba(140, 150, 190, 0.1), transparent 70%), radial-gradient(ellipse at 50% 50%, #142046 0%, #0d1630 60%, #080e22 100%)',
      '--sheet': '#0a1228',
      '--ink': '#efe9dc',
      '--ink-dim': '#aeb2c4',
      '--line': 'rgba(201, 164, 92, 0.28)',
      '--panel': 'rgba(4, 8, 20, 0.45)',
      '--card': '#f6f1e3',
      '--card-ink': '#141414',
      '--card-red': '#a8282a',
      '--red-on-felt': '#ff8f86',
      '--accent': '#c9a45c',
      '--accent-ink': '#1a1406',
      '--accent-glow': 'rgba(201, 164, 92, 0.55)',
      '--card-back': 'repeating-linear-gradient(45deg, #c9a45c 0 2px, #0d1630 2px 8px), #0d1630',
      '--font-display': "'Didot', 'Bodoni 72', Georgia, serif",
    },
  },
  bali: {
    id: 'bali',
    flag: '🇮🇩',
    name: 'Bali Batik',
    place: '🇮🇩 Indonesia',
    greeting: 'Teak table, frangipani, gamelan in the distance.',
    sound: { pitch: 1, bellPartial: 2.76 },
    tokens: {
      ...base,
      '--surface': "radial-gradient(circle, rgba(242, 193, 78, 0.12) 0 6px, transparent 7px) 0 0 / 22px 22px, radial-gradient(circle at 50% 40%, #5a3820 0%, #432914 80%)",
      '--surface-rim': '0 0 0 5px #6b3a1c, 0 0 0 7px #f2c14e, 0 0 0 11px #4e321d, 0 10px 30px rgba(0, 0, 0, 0.45)',
      '--surface-radius': '50%',
      '--font-name': "'Marcellus', Optima, Georgia, serif",
      '--font-card': "'Marcellus', Optima, Georgia, serif",
      '--felt': '#3a2414',
      '--felt-light': '#4e321d',
      '--felt-bg':
        'radial-gradient(circle at 25% 25%, rgba(242, 193, 78, 0.07) 0 18px, transparent 19px) 0 0 / 64px 64px, radial-gradient(circle at 75% 75%, rgba(196, 98, 45, 0.09) 0 12px, transparent 13px) 0 0 / 64px 64px, repeating-linear-gradient(100deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 9px), radial-gradient(ellipse at 50% 45%, #4a2e19 0%, #3a2414 60%, #2a190d 100%)',
      '--sheet': '#2c1a0e',
      '--ink': '#fbf1e2',
      '--ink-dim': '#d6bfa3',
      '--line': 'rgba(251, 241, 226, 0.2)',
      '--panel': 'rgba(20, 10, 4, 0.4)',
      '--card': '#fff8ec',
      '--card-ink': '#24160b',
      '--card-red': '#a92d22',
      '--red-on-felt': '#ffab92',
      '--accent': '#f2c14e',
      '--accent-ink': '#2a1a04',
      '--accent-glow': 'rgba(242, 193, 78, 0.55)',
      '--card-back': 'radial-gradient(circle, #f2c14e 0 2px, transparent 3px) 0 0 / 10px 10px, #6b3a1c',
    },
  },
  manila: {
    id: 'manila',
    flag: '🇵🇭',
    name: 'Manila Sleepover',
    place: '🇵🇭 Your place',
    greeting: 'Lights low, cards on the bed. Like college.',
    sound: { pitch: 0.97 },
    tokens: {
      ...base,
      '--surface': "repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.07) 0 8px, transparent 8px 22px), repeating-linear-gradient(90deg, rgba(120, 140, 255, 0.1) 0 8px, transparent 8px 22px), #2b3466",
      '--surface-rim': '0 8px 0 -2px rgba(255, 255, 255, 0.08), 0 12px 26px rgba(0, 0, 0, 0.45)',
      '--surface-radius': '22%',
      '--font-name': "'Patrick Hand', 'Comic Sans MS', system-ui, sans-serif",
      '--font-card': "'Nunito', 'Arial Rounded MT Bold', system-ui, sans-serif",
      '--felt': '#1c2140',
      '--felt-light': '#283058',
      '--felt-bg':
        'radial-gradient(circle at 8% 6%, rgba(255, 211, 107, 0.5) 0 3px, transparent 10px), radial-gradient(circle at 30% 3%, rgba(255, 170, 120, 0.45) 0 3px, transparent 10px), radial-gradient(circle at 55% 7%, rgba(255, 211, 107, 0.5) 0 3px, transparent 10px), radial-gradient(circle at 80% 4%, rgba(255, 170, 120, 0.45) 0 3px, transparent 10px), radial-gradient(ellipse 100% 30% at 50% 0%, rgba(255, 200, 120, 0.14), transparent), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 10px, transparent 10px 30px), repeating-linear-gradient(90deg, rgba(120, 140, 255, 0.06) 0 10px, transparent 10px 30px), #1c2140',
      '--sheet': '#171b36',
      '--ink': '#fff7e8',
      '--ink-dim': '#c8c6dc',
      '--line': 'rgba(255, 247, 232, 0.2)',
      '--panel': 'rgba(8, 10, 28, 0.42)',
      '--card': '#fffdf6',
      '--card-ink': '#1a1a2a',
      '--card-red': '#c0362f',
      '--red-on-felt': '#ff9d8f',
      '--accent': '#ffd36b',
      '--accent-ink': '#2a1d02',
      '--accent-glow': 'rgba(255, 211, 107, 0.6)',
      '--card-back': 'repeating-linear-gradient(0deg, #3b4a8a 0 4px, #2a356a 4px 8px)',
      '--font': "'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif",
      '--font-display': "'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif",
    },
  },
};

export const themeOf = (id: ThemeId | undefined | null): Theme => THEMES[id ?? 'clubhouse'] ?? THEMES.clubhouse;

let applied: ThemeId | null = null;

/** Put a theme's tokens on the page (and remember its sound variant). */
export function applyTheme(id: ThemeId | undefined | null): void {
  const theme = themeOf(id);
  if (applied === theme.id) return;
  applied = theme.id;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens['--felt']!);
  soundTheme.pitch = theme.sound.pitch;
  soundTheme.bellPartial = theme.sound.bellPartial ?? 2;
}

/** Read by sound.ts: the current theme's sound variant. */
export const soundTheme = { pitch: 1, bellPartial: 2 };

/** A CSS colour token's current value (for canvas effects, which can't read CSS). */
export function cssColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
