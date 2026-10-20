# S24 · Session avatars: animals and elements
**Milestone:** M3 (pick screen runs inside the M2 start ceremony as a placeholder until then) · **Depends on:** S07, S09, S15, S16 · **Size:** M

## Purpose
Each night, each of you becomes a character: an **animal with a bending element** (inspired by Avatar: The Last Airbender). It keeps things fresh and gives you something to call each other on the call, and it's **purely cosmetic: it never affects rules or results.**

## Pick flow (inside the start ceremony, S15, after the "Last time…" card)
1. **Everyone picks at the same time and in private.** Each player is offered **3 random animals** from the roster, with **one reroll** per session.
2. Then they choose an **element**: 🔥 Fire · 🌬 Air · 🌊 Water · 🪨 Earth.
3. When all 4 have locked in, the **avatars flip over together** in the four seats. Each element plays a short entrance: an ember burst, a swirl of wind, a splash, or a stone slam.
4. **No duplicate animals in the same session.** Each player's 3 offered animals never overlap with another player's. Elements **can** repeat.
5. The same animal can't be offered to the same player two sessions in a row.
6. **Takes about 20 seconds** (a 30 s limit is optional). A player who idles gets "Surprise me" picked for them only after the other three are done and 30 s have passed.

## Where avatars appear
- The **seat badge** (replaces the plain color dot), the **auction strip**, and the **4-hand reveal**.
- **Pair names** on the score banner: *"Fire Tiger & Water Otter."* (These replace the generated pair names in S15.)
- **Signature clinch effect** (S16): the deciding trick's level-5 effect takes on the **element of the player who played the clinching card**:

| Element | Clinch effect | Colors |
|---|---|---|
| 🔥 Fire | An ember burst rises from the card, plus a warm flash | Orange to red |
| 🌬 Air | A gust swirls through and sweeps the trick to the winning pile | Pale yellow to cream |
| 🌊 Water | Ripple rings spread from the card and the table "wobbles" | Teal to blue |
| 🪨 Earth | A stone-thud shake with dust kicking up | Moss to brown |

  **Same timing and intensity for all four elements** (principle 4). Only the look changes.

## Starting roster (24 animals; you can edit the list at the M3 checkpoint)
Tiger · Wolf · Bear · Fox · Otter · Owl · Eagle · Hawk · Badger · Rhino · Elephant · Lion · Panda · Red Panda · Turtle · Koala · Penguin · Shark · Octopus · Lemur · Bison · Boar · Crane · Raccoon

## Art approach
- **One base portrait for each animal** plus an **element ring and particle aura drawn in code**. That means 24 pieces of art, not 96.
- **v1 placeholder:** freely licensed animal emoji (Twemoji, CC-BY 4.0, which needs a credit). The portraits can be upgraded later.
- **IP guardrail:** use our own element glyphs. No logos, character art or creature names from the show. This is inspiration only.

## Saved data (S09)
`session_avatars(session_id, profile_id, animal, element, offered[3], rerolled)`, which feeds the element and animal stats (S20).

## Acceptance criteria
- [ ] The pick screen works at 360 px wide, with tappable animal cards of at least 88 px.
- [ ] No two players end up with the same animal in a session (tested over 1,000 simulated sessions).
- [ ] Nobody sees anyone else's choice before the reveal.
- [ ] Each element's clinch effect holds 60 fps on a mid-range Android phone.
- [ ] Turning avatars off (a dev flag) leaves the game fully playable with plain name badges.


## Roster edits (M3 input, 2026-10-20)
Ryan: replace **Red Panda → Dragon**, **Badger → Badgermole**, **Raccoon → Koi**. The final 24:
Tiger · Wolf · Bear · Fox · Otter · Owl · Eagle · Hawk · Badgermole · Rhino · Elephant · Lion · Panda · Dragon · Turtle · Koala · Penguin · Shark · Octopus · Lemur · Bison · Boar · Crane · Koi

- *IP note:* "Badgermole" is a creature from the show. The guardrail above was written for a public product. This is a private game for four friends, so the name stays at Ryan's call.
- *v1 art:* native emoji. Hawk, Lemur, Crane, Koi and Badgermole have no exact emoji, so they use the nearest one, and the animal's name always shows next to it. Custom portraits can come later.
- *Lobby:* picking happens **in the lobby while waiting for everyone**, instead of as a separate step after the night starts, so it doesn't add 20 s to the start. The night starts once all four are here **and** locked in. A player who hasn't picked 30 s after the other three are ready gets "Surprise me".

## Clean-up before launch (Ryan, 2026-10-20)
- **No rerolls.** Three animals on offer, pick one.
- **No avatar names in text** ("Water Bear" is gone everywhere). The avatar speaks for itself.
- **The element lives on the avatar:** a small element badge on the bottom-right of the avatar circle.
- **Colour means team during play:** avatar rings, auction underlines, reveal stripes and effects use your pair's theme accent, and silver for the other pair. Names are plain ink in the theme's name font. Personal colours stay in the lobby, crest and history.
- **Seat badges are avatar-first:** big round avatar, cards left as a tiny card with the number on it (bottom-left), dealer chip (top-right), the name underneath, and a role tag (Declarer / Partner / Defender). On your turn the ring glows.
- **Round 3 (Ryan):**
  - No badges around the avatar. The element is a quiet backdrop inside the circle: embers for fire, ripples for water, a swirl for air, rock strata for earth.
  - Cards left sit as a tiny card to the left of the name.
  - The dealer chip is gone; the header says who deals.
  - Your own seat uses the same badge as the other three.
- **Winning a set shows the winner's element:**

  | Element | Normal win | Win by trumping a different suit |
  |---|---|---|
  | Fire | fireball | lightning |
  | Air | tornado | sound waves |
  | Water | tsunami | ice |
  | Earth | rock smash | metal |

  The clinch keeps the full element signature. A player with no avatar gets the plain glow or trump symbols.
