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

/** The 24-animal roster (Ryan's edits: Dragon, Badgermole and Koi replace Red Panda, Badger and Raccoon). */
export const ANIMALS: readonly Animal[] = [
  { id: 'tiger', name: 'Tiger', emoji: '🐯' },
  { id: 'wolf', name: 'Wolf', emoji: '🐺' },
  { id: 'bear', name: 'Bear', emoji: '🐻' },
  { id: 'fox', name: 'Fox', emoji: '🦊' },
  { id: 'otter', name: 'Otter', emoji: '🦦' },
  { id: 'owl', name: 'Owl', emoji: '🦉' },
  { id: 'eagle', name: 'Eagle', emoji: '🦅' },
  { id: 'hawk', name: 'Hawk', emoji: '🪶' },
  { id: 'badgermole', name: 'Badgermole', emoji: '🦡' },
  { id: 'rhino', name: 'Rhino', emoji: '🦏' },
  { id: 'elephant', name: 'Elephant', emoji: '🐘' },
  { id: 'lion', name: 'Lion', emoji: '🦁' },
  { id: 'panda', name: 'Panda', emoji: '🐼' },
  { id: 'dragon', name: 'Dragon', emoji: '🐉' },
  { id: 'turtle', name: 'Turtle', emoji: '🐢' },
  { id: 'koala', name: 'Koala', emoji: '🐨' },
  { id: 'penguin', name: 'Penguin', emoji: '🐧' },
  { id: 'shark', name: 'Shark', emoji: '🦈' },
  { id: 'octopus', name: 'Octopus', emoji: '🐙' },
  { id: 'lemur', name: 'Lemur', emoji: '🐒' },
  { id: 'bison', name: 'Bison', emoji: '🦬' },
  { id: 'boar', name: 'Boar', emoji: '🐗' },
  { id: 'crane', name: 'Crane', emoji: '🦢' },
  { id: 'koi', name: 'Koi', emoji: '🐠' },
];

export const animalById = (id: string): Animal | undefined => ANIMALS.find((a) => a.id === id);

export interface Avatar {
  readonly animal: string;
  readonly element: Element;
}

/** "Fire Tiger". */
export function avatarName(a: Avatar): string {
  return `${ELEMENT_INFO[a.element].name} ${animalById(a.animal)?.name ?? a.animal}`;
}

/** One player's private pick. */
export interface AvatarPick {
  /** The three animals on offer to this player (never overlapping anyone else's). */
  readonly offered: readonly string[];
  readonly rerolled: boolean;
  /** Set once locked in. */
  readonly avatar: Avatar | null;
}

export interface AvatarLobby {
  readonly picks: Readonly<Record<ProfileId, AvatarPick>>;
  /** Each player's animal last night: not offered to them again tonight. */
  readonly last: Readonly<Record<ProfileId, string | undefined>>;
}

export type AvatarAction =
  | { type: 'reroll' }
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

/** Fresh offers for a new night: three animals each, no overlaps, nobody's last animal again. */
export function newAvatarLobby(profiles: readonly ProfileId[], random: Random, last: Record<ProfileId, string | undefined> = {}): AvatarLobby {
  const taken = new Set<string>();
  const picks: Record<ProfileId, AvatarPick> = {};
  for (const p of profiles) {
    const offered = draw(
      random,
      ANIMALS.map((a) => a.id).filter((id) => !taken.has(id) && id !== last[p]),
      3,
    );
    offered.forEach((id) => taken.add(id));
    picks[p] = { offered, rerolled: false, avatar: null };
  }
  return { picks, last };
}

export function applyAvatarAction(lobby: AvatarLobby, by: ProfileId, action: AvatarAction, random: Random): Outcome<AvatarLobby, never> {
  const mine = lobby.picks[by];
  if (!mine) return fail('NOT_A_PLAYER', 'You are not at this table.');
  const set = (pick: AvatarPick): Outcome<AvatarLobby, never> => ({ ok: true, state: { ...lobby, picks: { ...lobby.picks, [by]: pick } }, events: [] });

  switch (action.type) {
    case 'reroll': {
      if (mine.rerolled) return fail('NO_REROLL', 'You have already used your reroll tonight.');
      if (mine.avatar) return fail('LOCKED_IN', 'Unlock your pick first.');
      // Three new animals nobody else is holding (and not your last one, or your current three).
      const held = new Set(Object.entries(lobby.picks).flatMap(([p, pick]) => (p === by ? [] : pick.offered)));
      const pool = ANIMALS.map((a) => a.id).filter((id) => !held.has(id) && !mine.offered.includes(id) && id !== lobby.last[by]);
      return set({ offered: draw(random, pool, 3), rerolled: true, avatar: null });
    }
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
