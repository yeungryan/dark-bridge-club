# S18 · Rotating session themes
**Milestone:** M3 · **Depends on:** S15, S16 · **Size:** M

## Purpose
Fresh **presentation** every night without touching the rules (P1). This replaces the "every run is different" variety Balatro gets from its rule changes.

## Behaviour
- A theme is **only a set of design values**: palette, felt texture, card back and face style, fonts, particle sprite, sound variants (pitch/timbre), and the lobby greeting line.
- **Timing never changes between themes** (principle 4).
- **Theme roll:** at the start of each session (S15), drawn at random **without repeats until every theme has been seen**.
- **Readability rule:** every theme must pass a WCAG AA contrast check on card faces and meters, and keep the four suits distinct (♥♦ in red tones, ♠♣ in dark tones; an optional **four-color deck** setting overrides this).

## Suggested launch set (you pick 3–5 at the M3 checkpoint)
| Theme | Look |
|---|---|
| **The Clubhouse** | Green felt, brass lamp light, cream cards. The "home" theme. |
| **Neon Parlor** | Saturated CRT-style glow, a nod to Balatro. Punchy particles. |
| **Midnight Jazz** | Navy and gold, smoky gradients, soft vinyl crackle as the sound variant. |
| **Riviera** | Sunset palette, linen texture, gull-white cards. |
| **Your Place** ★ | **Built around a place or memory the four of you share** (a city, a bar, a dorm). You provide the reference, and it becomes the rarest roll. |

## Acceptance criteria
- [ ] Adding a theme = adding one data file plus assets. No component code changes.
- [ ] Every theme passes the automated contrast check.
- [ ] Assets for each theme are ≤ 400 KB and load lazily after the roll.

## Ryan's picks (M3 input, 2026-10-20)
Keep the four suggested looks, but tie them to the countries that matter to the four of you (Singapore, Germany, Indonesia, Japan), plus "Your Place". Proposed launch set (Ryan to confirm on the real table):

| Theme | Country | Look |
|---|---|---|
| **The Clubhouse** | home | Green felt, brass lamp light, cream cards. The default and first night's theme. |
| **Marina Riviera** | 🇸🇬 Singapore | Riviera, retuned: a sunset over the bay in coral and teal, with orchid accents. |
| **Shibuya Neon** | 🇯🇵 Japan | Neon Parlor at night: magenta and cyan glow, a rain-slick sheen, koi accents. |
| **Berlin Midnight** | 🇩🇪 Germany | Midnight Jazz in a Berlin bar: navy, brass, smoky gradients, vinyl crackle. |
| **Bali Batik** | 🇮🇩 Indonesia | Teak wood and batik-pattern felt, frangipani, a gamelan-bell sound variant. |
| ★ **Manila Sleepover** | 🇵🇭 Your Place | Bridge on a bed at a college sleepover in Manila: cards on a bedsheet, pillows, string lights. The rarest roll. |

**UI polish:** Ryan wants the bidding box, the menu and the lobby improved. Because themes restyle every screen anyway, that pass rides with the themes PR (M3 part 2) rather than waiting for a later module.
- **Fonts:** each theme sets the player-name and card-rank fonts as well (Google Fonts, with system fallbacks): Clubhouse Playfair/Baskerville, Marina Poppins, Shibuya Orbitron/Space Mono, Berlin Bodoni, Bali Marcellus, Manila Patrick Hand/Nunito.
- **Suits are drawn, not typed:** one SVG per suit at the digits' cap height, used on cards, in the bidding box, the auction, the header and the reveal, so they're the same size as the numbers on every phone.
- **Wording (Ryan):** on screen, a trick is a **set** and a deal is a **game**. So a defeated contract says **"Defeated"**, never "set". The code and these specs keep the bridge terms.
- **Character without clutter (round 3):**
  - Each theme has a scene along the top of the screen, faded out before it reaches the cards:
    - Clubhouse: a banker's lamp and its pool of light.
    - Marina: the three towers with the ship on top, Supertrees and a sunset.
    - Shibuya: towers with lit windows and a neon ブリッジ sign.
    - Berlin: the TV tower, the Brandenburg Gate and a crescent moon.
    - Bali: a split temple gate, a palm and frangipani.
    - Manila: string lights, a pillow and the electric fan.
  - The table in the middle is themed too:
    - Clubhouse: felt with a wood rim.
    - Marina: an infinity pool with a stone edge.
    - Shibuya: a neon ring.
    - Berlin: walnut with brass.
    - Bali: carved teak.
    - Manila: a bedsheet.
- **Layout:** the four seats sit in a 3×3 grid around the table with one gap, so all four are the same distance from it.
