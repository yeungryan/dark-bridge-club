import type { ProfileId } from './session';
import { fail, type Outcome } from './types';

// Spec S24: each night, each player is an animal with a bending element. Purely cosmetic:
// nothing here touches the rules, the deal seeds or the results.
// Picking happens privately in the lobby; nobody sees anyone's choice until the night starts.

export type Element = 'fire' | 'air' | 'water' | 'earth';
export const ELEMENTS: readonly Element[] = ['fire', 'air', 'water', 'earth'];
export const ELEMENT_INFO: Record<Element, { name: string; glyph: string }> = {
  fire: { name: 'Fire', glyph: '🔥' },
  air: { name: 'Air', glyph: '🌬️' },
  water: { name: 'Water', glyph: '🌊' },
  earth: { name: 'Earth', glyph: '🪨' },
};

export interface Animal {
  readonly id: string;
  readonly name: string;
  /** v1 portrait: a native emoji (the nearest one where none exists; the name always shows). */
  readonly emoji: string;
}

/**
 * The 24-animal roster, all faces (Ryan): earlier edits brought in Dragon, Badgermole and Koi; then
 * ten became face icons (Otter → Dog, Owl → Raccoon, Hawk → Chicken, Badgermole → Hamster,
 * Elephant → Gorilla, Turtle → Frog, Penguin → Polar bear, Lemur → Monkey, Bison → Cow,
 * Crane → Deer). The client draws them with Twemoji art; `emoji` is the matching character.
 */
export const ANIMALS: readonly Animal[] = [
  { id: 'tiger', name: 'Tiger', emoji: '🐯' },
  { id: 'wolf', name: 'Wolf', emoji: '🐺' },
  { id: 'bear', name: 'Bear', emoji: '🐻' },
  { id: 'fox', name: 'Fox', emoji: '🦊' },
  { id: 'lion', name: 'Lion', emoji: '🦁' },
  { id: 'panda', name: 'Panda', emoji: '🐼' },
  { id: 'koala', name: 'Koala', emoji: '🐨' },
  { id: 'boar', name: 'Boar', emoji: '🐗' },
  { id: 'dog', name: 'Dog', emoji: '🐶' },
  { id: 'raccoon', name: 'Raccoon', emoji: '🦝' },
  { id: 'chicken', name: 'Chicken', emoji: '🐔' },
  { id: 'hamster', name: 'Hamster', emoji: '🐹' },
  { id: 'gorilla', name: 'Gorilla', emoji: '🦍' },
  { id: 'frog', name: 'Frog', emoji: '🐸' },
  { id: 'polarbear', name: 'Polar bear', emoji: '🐻‍❄️' },
  { id: 'monkey', name: 'Monkey', emoji: '🐵' },
  { id: 'cow', name: 'Cow', emoji: '🐮' },
  { id: 'deer', name: 'Deer', emoji: '🦌' },
  { id: 'eagle', name: 'Eagle', emoji: '🦅' },
  { id: 'rhino', name: 'Rhino', emoji: '🦏' },
  { id: 'dragon', name: 'Dragon', emoji: '🐲' },
  { id: 'shark', name: 'Shark', emoji: '🦈' },
  { id: 'koi', name: 'Koi', emoji: '🎏' },
  { id: 'octopus', name: 'Octopus', emoji: '🐙' },
];

/** Animals that were swapped out, by their old id: nights saved before the swap still show. */
export const RENAMED_ANIMALS: Readonly<Record<string, string>> = {
  otter: 'dog',
  owl: 'raccoon',
  hawk: 'chicken',
  badgermole: 'hamster',
  elephant: 'gorilla',
  turtle: 'frog',
  penguin: 'polarbear',
  lemur: 'monkey',
  bison: 'cow',
  crane: 'deer',
};

/** An animal id as it is today (an old id maps to the animal that replaced it). */
export const currentAnimalId = (id: string): string => RENAMED_ANIMALS[id] ?? id;

export const animalById = (id: string): Animal | undefined => {
  const current = currentAnimalId(id);
  return ANIMALS.find((a) => a.id === current);
};

export interface Avatar {
  readonly animal: string;
  readonly element: Element;
}

/** "Fire Tiger". */
export function avatarName(a: Avatar): string {
  return `${ELEMENT_INFO[a.element].name} ${animalById(a.animal)?.name ?? a.animal}`;
}

/** One player's private pick (two animals on offer, no rerolls: Ryan kept the choice small). */
export interface AvatarPick {
  /** The animals on offer to this player (never overlapping anyone else's). */
  readonly offered: readonly string[];
  /** Set once locked in. */
  readonly avatar: Avatar | null;
}

export interface AvatarLobby {
  readonly picks: Readonly<Record<ProfileId, AvatarPick>>;
  /** Each player's animal last night: not offered to them again tonight. */
  readonly last: Readonly<Record<ProfileId, string | undefined>>;
}

export type AvatarAction =
  | { type: 'lock'; animal: string; element: Element }
  | { type: 'unlock' }
  /** Pick at random from your offer (also used for a player who doesn't pick in time). */
  | { type: 'surprise' };

/** A source of numbers in [0, 1); cosmetic, so the server can use Math.random. */
export type Random = () => number;

function draw(random: Random, pool: readonly string[], count: number): string[] {
  const left = [...pool];
  const out: string[] = [];
  while (out.length < count && left.length > 0) out.push(left.splice(Math.floor(random() * left.length), 1)[0]!);
  return out;
}

/** How many animals each player is offered: two, to keep the choice quick. */
export const OFFER_SIZE = 2;

/** Fresh offers for a new night: two animals each, no overlaps, nobody's last animal again. */
export function newAvatarLobby(profiles: readonly ProfileId[], random: Random, last: Record<ProfileId, string | undefined> = {}): AvatarLobby {
  const taken = new Set<string>();
  const picks: Record<ProfileId, AvatarPick> = {};
  for (const p of profiles) {
    const offered = draw(
      random,
      ANIMALS.map((a) => a.id).filter((id) => !taken.has(id) && id !== currentAnimalId(last[p] ?? '')),
      OFFER_SIZE,
    );
    offered.forEach((id) => taken.add(id));
    picks[p] = { offered, avatar: null };
  }
  return { picks, last };
}

export function applyAvatarAction(lobby: AvatarLobby, by: ProfileId, action: AvatarAction, random: Random): Outcome<AvatarLobby, never> {
  const mine = lobby.picks[by];
  if (!mine) return fail('NOT_A_PLAYER', 'You are not at this table.');
  const set = (pick: AvatarPick): Outcome<AvatarLobby, never> => ({ ok: true, state: { ...lobby, picks: { ...lobby.picks, [by]: pick } }, events: [] });

  switch (action.type) {
    case 'lock':
      if (!mine.offered.includes(action.animal)) return fail('NOT_OFFERED', 'Pick one of the animals offered to you.');
      if (!ELEMENTS.includes(action.element)) return fail('BAD_ELEMENT', 'Pick an element.');
      return set({ ...mine, avatar: { animal: action.animal, element: action.element } });
    case 'unlock':
      return set({ ...mine, avatar: null });
    case 'surprise': {
      if (mine.avatar) return { ok: true, state: lobby, events: [] };
      const animal = mine.offered[Math.floor(random() * mine.offered.length)]!;
      const element = ELEMENTS[Math.floor(random() * ELEMENTS.length)]!;
      return set({ ...mine, avatar: { animal, element } });
    }
  }
}

export function lockedIn(lobby: AvatarLobby): ProfileId[] {
  return Object.entries(lobby.picks)
    .filter(([, pick]) => pick.avatar !== null)
    .map(([p]) => p);
}

/** Everyone's avatar (for after the reveal). */
export function avatarsOf(lobby: AvatarLobby): Record<ProfileId, Avatar | null> {
  return Object.fromEntries(Object.entries(lobby.picks).map(([p, pick]) => [p, pick.avatar]));
}
