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
