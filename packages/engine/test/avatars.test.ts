import { describe, expect, it } from 'vitest';
import { ANIMALS, animalById, applyAvatarAction, RENAMED_ANIMALS, avatarName, lockedIn, newAvatarLobby, type AvatarLobby, type Random } from '../src/avatars';

const PLAYERS = ['darren', 'adrian', 'ryan', 'kim'];

/** A small seeded random, so failures are reproducible. */
function seeded(seed: number): Random {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function ok(out: ReturnType<typeof applyAvatarAction>): AvatarLobby {
  if (!out.ok) throw new Error(out.error.code);
  return out.state;
}

describe('S24 avatar picks', () => {
  it('the roster has 24 distinct animals, including Ryan’s edits', () => {
    expect(new Set(ANIMALS.map((a) => a.id)).size).toBe(24);
    for (const id of ['dragon', 'koi', 'dog', 'raccoon', 'polarbear', 'deer']) expect(ANIMALS.some((a) => a.id === id)).toBe(true);
    for (const id of ['red-panda', 'badger', 'otter', 'badgermole', 'penguin']) expect(ANIMALS.some((a) => a.id === id)).toBe(false);
  });

  it('an animal saved under an old id shows as the one that replaced it', () => {
    expect(animalById('otter')?.name).toBe('Dog');
    expect(animalById('crane')?.name).toBe('Deer');
    expect(avatarName({ animal: 'badgermole', element: 'earth' })).toBe('Earth Hamster');
    for (const id of Object.values(RENAMED_ANIMALS)) expect(animalById(id)).toBeDefined();
  });

  it('last night’s animal under its old id is still not offered again', () => {
    for (let n = 1; n <= 200; n++) {
      const lobby = newAvatarLobby(PLAYERS, seeded(n), { [PLAYERS[0]!]: 'otter' });
      expect(lobby.picks[PLAYERS[0]!]!.offered).not.toContain('dog');
    }
  });

  it('across 1,000 simulated nights, nobody shares an animal, offers never overlap, and nobody gets last night’s animal', () => {
    let last: Record<string, string | undefined> = {};
    for (let night = 0; night < 1000; night++) {
      const random = seeded(night + 1);
      let lobby = newAvatarLobby(PLAYERS, random, last);
      // Everyone locks in (some by "Surprise me").
      for (const p of PLAYERS) {
        const offers = PLAYERS.map((q) => lobby.picks[q]!.offered);
        expect(new Set(offers.flat()).size).toBe(offers.flat().length);
        expect(lobby.picks[p]!.offered).toHaveLength(2);
        expect(lobby.picks[p]!.offered).not.toContain(last[p]);
      }
      for (const [i, p] of PLAYERS.entries()) {
        const offered = lobby.picks[p]!.offered;
        lobby = ok(
          i % 2
            ? applyAvatarAction(lobby, p, { type: 'surprise' }, random)
            : applyAvatarAction(lobby, p, { type: 'lock', animal: offered[night % 2]!, element: 'water' }, random),
        );
      }
      const animals = PLAYERS.map((p) => lobby.picks[p]!.avatar!.animal);
      expect(new Set(animals).size).toBe(4);
      expect(lockedIn(lobby)).toHaveLength(4);
      last = Object.fromEntries(PLAYERS.map((p) => [p, lobby.picks[p]!.avatar!.animal]));
    }
  });

  it('only animals on offer can be picked', () => {
    const random = seeded(7);
    const lobby = newAvatarLobby(PLAYERS, random);
    const notMine = lobby.picks['kim']!.offered[0]!;
    expect(applyAvatarAction(lobby, 'ryan', { type: 'lock', animal: notMine, element: 'fire' }, random)).toMatchObject({
      ok: false,
      error: { code: 'NOT_OFFERED' },
    });
  });

  it('names read "Element Animal"', () => {
    expect(avatarName({ animal: 'polarbear', element: 'water' })).toBe('Water Polar bear');
  });
});
