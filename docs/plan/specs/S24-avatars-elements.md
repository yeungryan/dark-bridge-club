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
6. **Takes about 20 seconds** (a 30 s limit is optional). ~~A player who idles gets "Surprise me" picked for them only after the other three are done and 30 s have passed.~~ **Revised (Ryan, round 12):** nobody is picked for automatically; the night waits for the last player to choose, so they have time to be sure they are ready.

## Where avatars appear
- The **seat badge** (replaces the plain color dot), the **auction strip**, and the **4-hand reveal**.
- **Pair names** on the score banner: *"Fire Tiger & Water Otter."* (These replace the generated pair names in S15.)
- **Signature clinch effect** (S16; replaced in round 8, see "Set-win attacks" below): the deciding trick's level-5 effect takes on the **element of the player who played the clinching card**:

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

**Faces only, in Twemoji (Ryan, PR #16).** Every animal is now a face, drawn with bundled Twemoji art (CC-BY 4.0; credit in `packages/client/src/assets/animals/README.md`), so all four phones show the same pictures. Ten animals changed: Otter → Dog, Owl → Raccoon, Hawk → Chicken, Badgermole → Hamster, Elephant → Gorilla, Turtle → Frog, Penguin → Polar bear, Lemur → Monkey, Bison → Cow, Crane → Deer. Dragon uses the dragon face (🐲) and Koi the tropical fish (🐠). The four elements are Twemoji too: 🔥 fire, 💧 water, 💨 air (dashing away), ⛰️ earth (mountain). The final 24:
Tiger · Wolf · Bear · Fox · Lion · Panda · Koala · Boar · Dog · Raccoon · Chicken · Hamster · Gorilla · Frog · Polar bear · Monkey · Cow · Deer · Eagle · Rhino · Dragon · Shark · Koi · Octopus
- Old ids saved in past nights map to their replacements (`RENAMED_ANIMALS`), and last night's animal is still not offered again under its new id.
- Set icons (scoreboard, replay, the declarer under the contract) are the same art as a solid silhouette in the team colour.
- *Lobby:* picking happens **in the lobby while waiting for everyone**, instead of as a separate step after the night starts, so it doesn't add 20 s to the start. The night starts once all four are here **and** locked in. Nobody is auto-picked (round 12).

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
- **Winning a set shows the winner's element** (replaced in round 8, see "Set-win attacks" below):

  | Element | Normal win | Win by trumping a different suit |
  |---|---|---|
  | Fire | fireball | lightning |
  | Air | tornado | sound waves |
  | Water | tsunami | ice |
  | Earth | rock smash | metal |

  The clinch keeps the full element signature. A player with no avatar gets the plain glow or trump symbols.
- **Round 4 (Ryan):**
  - Element backdrops take a primary colour: red fire, yellow air, blue water, green earth.
  - Two animals on offer, not three.
  - The lobby picker has no words and no buttons: tapping an animal and an element locks you in, and tapping another changes it.
  - ~~Anyone who doesn't pick within 30 s of the others being ready is still auto-picked by the server.~~ Removed in round 12: the server no longer auto-picks, and the lobby shows no countdown.

**At the table, final (Ryan, option E + O3):** no circle behind the animal. It wears a thin aura in its element's colour (red fire, yellow air, blue water, green earth) that shows on any theme. The cards-left count is a 19 px solid circle on the animal's bottom-right, in the player's team colour with a thin white rim and a centred plain bold number. On a player's turn, the animal and badge pulse together and a faint ring ripples out (replacing the glow and the gold name). Waiting seats dim, but never their badge.

## Set-win attacks (Ryan, round 8)
Winning a set now aims the winner's element at the **three losing cards** (friendly fire included: the partner's card too). The losers stay on the table, wrecked, until the sweep. Every effect, particles included, is over in **0.80 s**, the hold before the sweep (was 0.65 s). The game-winning set takes 1.6 s, inside the ~3 s the game already waits before the results.

| Element | Set won | Won by trumping another suit | Game-winning set's finisher |
|---|---|---|---|
| Fire | **Ignite:** sparks suck in, a white-hot pop, fireballs; the losers burn to char with eaten edges | **Lightning** (blue): one bolt jumps card to card, leaving a burnt lightning scar on each | Char crumbles to ash and blows away; a scorch mark is left. Trumped: a last bolt from the sky burns each card away |
| Air | **Wind slash:** crescents fly in and cut each loser in two; the halves part and settle | **Sound:** a sonic boom; the cards crumple like paper | A gust blasts the halves off the table. Trumped: a bigger boom blows the crumpled cards away |
| Water | **Splash crown:** ripples under the winning card, jets punch holes through the losers, which soak, crease, warp and drip | **Ice:** shards fly and stick fast in each card, frost round them | A wave washes the cards off, leaving a damp patch. Trumped: the cards freeze white and shatter |
| Earth | **Boulder slam:** a giant boulder punches a big ragged hole through each loser, with cracks and dirt | **Metal:** spinning blades slash each card twice; the last sticks in | The holed cards crack into chunks that fall away, leaving a crater. Trumped: the blades shred the cards into falling strips |

- **The game-winning set:** a gold power-up on the winning card, the attack, then the finisher wipes the losers off the table, then the finale: the clinch chord, a gold flash, a burst, the big shake and the vibration. Only the winning card is left.
- **Sound:** each attack and finisher has its own sounds, fired at its impacts (S17). They replace the generic set-won chime and the trump-set brass; the first-trump fanfare and the combo chime stay.
- **Effects settings:** Reduced and Off keep the old signatures (no card damage). Fast plays everything at 0.6×.
- **Built:**
  - `lib/juice/setWin.ts`, the director's one entry: `setWon`, `gameWon`.
  - Attacks: `cardFx.ts` (elements) and `subFx.ts` (sub-elements). Finishers and finale: `finishFx*.ts`. Card damage uses the Web Animations API on the trick area's `.face`, so the sweep carries it.
  - A felt layer under the cards holds ripples and marks. It's cleared when a new set goes live, and a new card on the table drops any beats still to come.
  - Cut-up copies of a card are hidden from screen readers and tests.
  - Particles now advance on the clock (a fixed 1/60 s step) so the timing holds at 30 fps and 120 Hz alike.
- **Effects lab** (`fxlab.html`, dev only): every option Ryan saw, side by side, with sound.
