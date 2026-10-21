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
- **Clinch (S04):** the clinching card gets the **biggest moment in the game** (S16). The winning meter fills completely and glows, and the losing one dims. Then the "Play it out?" prompt appears (R11): two buttons, **Play on** and **Done**, with a thin countdown bar *(5 s)*. *(M2: ships with **Play on** only. Letting the 5 s run out is the "Done", which avoids a second button that does nothing.)*

## Acceptance criteria
- [ ] At any moment, any player can answer "what's the contract and how close are we?" in under 1 second.
- [ ] The meters always match the engine's trick counts exactly.
- [ ] The last-trick peek works during the pause and while the clinch prompt is showing.

## Changes after the first M2 playtest
- The card currently winning the trick wears a gold ring and pops when it takes the lead; beaten cards dim. Anyone could work this out, so it's shown.
- A finished trick sweeps into the winner's name badge. A glowing orb then flies from there to that side's score bar, and the pip pops when it arrives (with a rising bell).
- Trump flourishes: a big translucent trump symbol flashes behind the trick on a trump-in and on a trick won by a trump. The **first trick of a deal won by a trump** gets a "First trump!" banner and a longer hold. "Won by a trump" means the winning card is a trump, including trump leads (decided by Ryan).
- **Last-trick peek:** the four cards flip up one by one in play order, then the winner lights up; tap to turn them back down. The button always takes its space, so the trick area doesn't jump after trick 1.

## Round 5: the score bug (Ryan)
- The contract and the race are one panel, laid out like a playoff score bug. On the left is the winning bid, large, with the declarer's name under it led by their animal as a team-coloured silhouette the height of the name (Ryan; tap it for the auction). On the right is one row per pair: initials ("D·K"), then a silhouette of the animal that won each set in the team colour (empty outlines for sets still needed), then sets/target, then the pair's games won tonight in a series column.
- The newest set is the bigger, ringed, breathing silhouette. Tapping it opens the last set, which replaces the old "Last set" button.
- `DealView.trickWinners` (public information) supplies who won each set.
- The header reads **"Game N"**, centred.
- The table is the same square during bidding and play, and anchored to the top, so seats never move when the bidding box opens. The table shrinks on short phones so everything still fits.
- **Revised (Ryan):** the table is anchored where it sits during play, centred between the header and the scoreboard, which leaves room above for the theme's scene. It is not pinned to the top. The scoreboard's slot is a fixed 64px in every phase. The bidding box is now two rows (levels + Pass, then suits + Confirm, with a one-line hint on top), and it floats up from that slot over the empty felt below my seat, so the middle area never resizes. Seat badges are a fixed 84×96, so a role tag or a wider name can't shift a seat or push the table off-centre. Measured at four phone sizes: no seat moves between bidding and play, and "Game N" is centred exactly over the table.
