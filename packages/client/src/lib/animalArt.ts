import { currentAnimalId } from '@dark/engine';

// The animal faces as Twemoji art (src/assets/animals, CC-BY 4.0), so every phone shows the same
// animals instead of its own emoji font. The files are tiny and get inlined into the bundle.
const files = import.meta.glob<string>('../assets/animals/*.svg', { eager: true, query: '?url', import: 'default' });

const ART: Record<string, string> = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]));

const elementFiles = import.meta.glob<string>('../assets/elements/*.svg', { eager: true, query: '?url', import: 'default' });
const ELEMENT_ART: Record<string, string> = Object.fromEntries(
  Object.entries(elementFiles).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

/** The picture for an element (🔥 fire, 💧 water, 💨 air, ⛰️ earth). */
export const elementArt = (element: string): string | null => ELEMENT_ART[element] ?? null;

/** The picture for an animal id (old ids map to their replacements), or null. */
export const animalArt = (id: string | null | undefined): string | null => (id ? (ART[currentAnimalId(id)] ?? null) : null);
