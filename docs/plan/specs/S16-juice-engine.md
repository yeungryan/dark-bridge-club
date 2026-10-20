# S16 · Juice engine and intensity scale
**Milestone:** M2 · **Depends on:** S06 events · **Size:** M · **Package:** `client/juice`

## Purpose
One place that decides **how big each moment feels**, so effects stay proportional, consistent and tunable (principles 3 and 4). UI components never call screen shake or sounds directly. They emit events, and this engine decides the response.

## Intensity scale (0–5)
| Level | Example events | Response budget |
|---|---|---|
| 0 | Hover, selecting a call | Movement only. No sound. |
| 1 | Card played, call made | Small squash, quiet tick. ≤ 200 ms. |
| 2 | Trick won (routine), meter pip | Winner pulse, trick sweep, soft chime. ≤ 400 ms. |
| 3 | Contract set; trump-over; meter enters "1 away" | Accent color flash, slightly larger sound, ~60 ms **hit pause**. |
| 4 | **Decider trick** begins; reveal of a dramatic deal | Table lighting dims, focus on the trick area, rising tone. |
| 5 | **Clinch**; end-of-night winner | **~120 ms hit pause** → **screen shake** (amplitude set by drama, decays in ~300 ms) → particle burst in the theme's style → a big chord → the meter glows. Used at most once per deal. |

**Signature effect:** the level-5 clinch particles and colors come from the **element of the player who played the clinching card** (S24). The timing and intensity stay the same for every element.

**Drama modifiers** (+1, capped at 5): the clinch came on the decider trick; contract at level 6–7; the clinch was by a trump-over; the declarers had fewer HCP than the defenders ("Robbery"). *(M2: Robbery isn't used for the clinch, because hands aren't known until the reveal. It returns as a reveal caption in M3, S19.)* Values are tuned at the M2 checkpoint.

## Core tools
- **Springs and tweens** (a small in-house library or Svelte's `spring`/`tweened`), with all timing values in **one config file**.
- **Hit pause:** briefly freezes motion. **Input is never frozen.**
- **Screen shake:** applied to the table layer only. **Never** shakes text you need to read or the hand you're tapping.
- **Particles:** a small canvas overlay with a budget of 150 particles on phones.
- **Number count-ups:** tallies and HCP count up, faster for bigger numbers. Pitch rises as they go (S17).

## Global rules
- **Never block input.** Every animation can be interrupted, and a new event fast-forwards the old one.
- **Speed setting:** Normal / Fast (0.6×) for each player.
- **Reduced motion:** follows the OS setting, plus an in-app toggle. Shake and particles off, everything as fades.
- **Same timing in every theme:** only colors, textures and particle sprites change (principle 4).

## Acceptance criteria
- [ ] The side-by-side check (M2 checkpoint): effects on feel better and are not slower.
- [ ] 60 fps on a mid-range Android phone during a level-5 moment.
- [ ] Every intensity response is listed in one table in code.
