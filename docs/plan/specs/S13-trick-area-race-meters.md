# S13 · Trick area, last-trick peek, race meters
**Milestone:** M1 → M2 · **Depends on:** S03, S04, S10, S16 · **Size:** M

## Purpose
This is the heart of the game's tension. It's the bridge version of Balatro's climbing score (principle 7).

## Trick area
- Each played card lands on the side of the trick area facing its player.
- **Trick won:** a brief pause (~250 ms, so everyone sees all four cards) → the winning card **pulses** → all four cards slide toward the winner and stack into their pair's trick pile.
- **Trump-overs** (trumping when out of the suit led) get a slightly stronger pulse. Overtaking a high card also counts as a "beat" (S16 intensity +1).

## Last-trick peek (R8)
- Tap the trick pile (or the "last trick" button) → the previous trick shows as a small overlay, with each card labelled by its player. Only the most recent trick, never earlier ones.

## Race meters (always visible after the contract is set)
```
 DECLARERS  ●●●●○○○○○○   4 / 10 to make 4♠
 DEFENDERS  ●●○○          2 / 4  to set
```
- Two segmented bars, **declarers' needing `6+level` pips and defenders' needing `8−level`.** One pip fills per trick won, with a small pop.
- **Getting close:** when either side is **1 trick from its target**, that meter starts a slow, gentle shimmer. Both sides 1 away (a decider) = the most tension in the game. The table lighting dims slightly and the **next trick is marked as the "decider"** (S16, max-intensity setup).
- **Clinch (S04):** the clinching card gets the **biggest moment in the game** (S16). The winning meter fills completely and glows, and the losing one dims. Then the "Play it out?" prompt appears (R11): two buttons, **Play on** and **Done**, with a thin countdown bar *(5 s)*.

## Acceptance criteria
- [ ] At any moment, any player can answer "what's the contract and how close are we?" in under 1 second.
- [ ] The meters always match the engine's trick counts exactly.
- [ ] The last-trick peek works during the pause and while the clinch prompt is showing.
