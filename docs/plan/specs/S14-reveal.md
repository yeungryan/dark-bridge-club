# S14 · The 4-hand reveal
**Milestone:** M2 · **Depends on:** S04, S06, S16 · **Size:** M

## Purpose
Balatro's lesson: **if you hide something, the reveal has to be worth it.** Hands are secret for the whole deal, so seeing them all at the end is the payoff and the moment you all start talking (R9).

## Behaviour
1. **The server sends `Revealed`** with all four *original* hands (only now, see S06).
2. **Sequence (~2.5 s total, can be skipped):**
   - The result banner lands first: **"MADE"** or **"SET"**, in the winning pair's colors, and that pair's session tally ticks up +1 with a satisfying count-up.
   - Then the four hands **flip face-up in turn**, starting from declarer's right (`next()` order). Each flip has a soft card-turn sound (S17), and its **HCP badge counts up** from 0.
   - Small automatic captions highlight anything notable (from S19): *"Kim held 21 HCP and never declared"*, *"Robbery: Adrian & Ryan made it with 14 HCP between them."* *(M3: captions arrive with S19.)*
3. **Then it stays on screen.** The reveal **remains until everyone taps "Next deal"** (a small avatar fills in for each player who's ready). *No timer.* This is the banter pause.
4. You can tap a hand to view it larger. The full trick-by-trick history of the deal is a tap away in history (S20).

## Feel notes
- The flip should feel weighty: a 3D-ish rotation, card backs in the session theme (S18), and a tiny pause on each card at 90°.
- Intensity depends on the deal's drama: a decider-clinch or a big contract gets a richer reveal. A routine 1NT gets the plain version.

## Acceptance criteria
- [ ] Before `Revealed`, no other player's card exists in any client's memory or network log.
- [ ] The reveal never starts a new deal by itself. The "all 4 ready" gate holds.
- [ ] Skipping jumps straight to the final, fully revealed layout.
