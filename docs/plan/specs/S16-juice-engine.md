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

## The ladder, revised after the first M2 playtest
In M2, levels 1–4 had no shake, particles or hit-pause, so nothing between a card and the clinch felt like anything. The new ladder (`RESPONSES` in `lib/juice/timing.ts`):

| Level | Moments | Hit-pause | Shake | Particles |
|---|---|---|---|---|
| 1 | a card, a call | – | – | – |
| 2 | takes the lead, trick won | – | 2 px | 12 |
| 3 | trump-in, trick won by a trump, contract set (Sold!) | 40 ms | 4 px | 26 |
| 4 | first trump trick, decider | 90 ms | 6 px | 45 |
| 5 | the clinch, end of night | 120 ms | 7 px + drama | 60 + drama |

Beats are timed to visuals: a card's sound plays when it lands, the trick payoff when its last card lands, and a pip when the orb reaches the score bar. Moments are detected in `moments.ts`, which is unit tested. `DealView.trumpTricksWon` (public information) lets clients detect "first trump" even after a reconnect.

## Effect vocabulary (M3, after Ryan's note that the confetti got repetitive)
Each moment now has its own shape, not just more or fewer of the same squares (`lib/juice/particles.ts`). The most frequent moment gets the quietest effect.

| Moment | Effect |
|---|---|
| Takes the lead | Spark streaks, no fall |
| Trick won (13 a deal) | A soft glow only; the sweep and the orb carry it |
| Trump-in | A shockwave ring and thrown trump-suit shards |
| Trick won by a trump | The trump suit drifts up off the card |
| First trump trick | A big ring and a shower of the trump suit |
| The ace of trumps played (Ryan) | An area-of-effect blast: the biggest hit-stop on a purple wash, three shockwaves rolling across the table, a shower of the trump suit, and the other cards on the table knocked back by the wave |
| Sold! | An ink-stamp dust puff |
| Clinch | The element signature of the player who played the deciding card (S24) |
| Big contract at the reveal | A gold ring and sparks |
| Winning the night | **The only confetti:** paper ribbons that flutter and spin |

## The juice overhaul (Ryan: "Balatro-level", own engine first)
- **Light, not dots.** Effects that are light (sparks, embers, lightning, orbs, glows) are drawn additively with soft pre-rendered glow sprites, and fast ones leave short trails. Matter (earth debris, dust, paper confetti) stays solid. New helpers in `particles.ts`: `lightBurst` (the generic pop), `pop` (score pips and UI), `screenFlash`, `freeze`.
- **Hit-stop.** On a big impact (trump-in, a trump set, the first trump, the clinch), the table holds for a beat (55–130 ms by power) on an overexposed freeze-frame with a punchy `impact` sound, then everything bursts on. Input is never frozen. When a set-win attack plays on the cards (S24, round 8), its sets skip the freeze (the `impact` sound stays), since the freeze would hold the particles but not the damage to the cards.
- **Combos.** A side winning sets in a row gets a rising chime (`sound.combo`), more light each time, and a springy "×n" on its scoreboard row once the orb lands.
- **Streak stamps (Ryan, round 9).** From three in a row, a stamp slams onto the table just after the attack (in the streaking pair's team colour), holds until the sweep, then shrinks into that pair's scoreboard row, landing as the "×n" pops in. Two in a row gets no stamp. Names, after DOTA's kill streaks: ×3 Skilling Spree, ×4 Dominating, ×5 Mega Skill, ×6 Untrumpable, ×7 Wicked Slick, ×8 Monster Skill, ×9 Goldlike, ×10 Beyond Goldlike, and (round 10) ×11 Peekasweep, ×12 Sweeplike, ×13 Sweeep. On the set that wins the game, the stamp comes just after the finisher (round 10), then shrinks into the scoreboard as usual; the results wait for it. So every streak name can appear, SWEEEP included. Each step is bigger and hotter (team colours, then orange, amber, gold, white-gold at ×10+); the scoreboard always shows the true count. Defenders can't pass ×6 (they need at most 7 sets and the deciding set has the clinch instead), so ×7 and up belong to declarers on bigger contracts. Reduced effects: it fades in and out in place. `lib/juice/streak.ts`, `StreakStamp.svelte`.
- **Springs.** Every pop (taking the lead, the set winner, a card landing, stamps, pips, bid tiles) jumps to its peak and settles on a real spring (`spring.ts` samples a damped spring into a CSS `linear()` easing; older browsers fall back to an overshoot curve).
- **Cards in the hand** lean in 3D: toward your finger when pressed, and into the motion while dragged, with a sheen sliding across the face. A raised card sways gently while it waits.
- **Sound** is layered (transient + body + sparkle), runs through a gentle limiter and a short, quiet room reverb per theme, and keeps everything in the phone-speaker band. Repeated sounds vary slightly so they never machine-gun.

**Settings, trimmed (Ryan):** the menu, settings and header use monochrome Lucide icons. The Vibrate setting is gone (it couldn't be changed on most phones); vibration stays on where the phone supports it.

## Round 10 timing (Ryan)
- **A beat to look first.** After a set's last card lands, 0.4 s with the cards (and the winning card's highlight) still before the effects start, so the effects reinforce what you've already seen. The same before the deciding set's clinch. The 0.80 s effects cap is unchanged (tabled).
- **The last set of a game stays up.** Whether it's the deciding set or the 13th set of a game played out after it was decided, the results wait until that set's effects have finished (the attack, the sweep, the orb and any streak stamp reaching the scoreboard, or the finisher), then 3 s more. A game ended by the clinch window, with no card just played, goes straight to the results.
