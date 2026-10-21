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

## The replay (Ryan, M3)
- **Opening it:** "▶ Replay this game" on the reveal opens a step-through of the finished game, on that phone only. It isn't synced; to show the others, share your screen on the Messenger call.
- **The steps:** step 0 is the bidding with all four hands as dealt. Each later step puts that set's four cards on the table.
  - The player who led gets a "led" tag and the winner gets "won" plus the gold ring; one player who did both gets "led · won".
  - Every hand shows what that player still holds, with the card they just played struck through.
  - A running tally shows both sides' progress toward their targets.
- **Getting around:** ◀ ▶ buttons, swiping, the arrow keys, or the set strip. The strip has two team lanes like the scoreboard (declarers above defenders, with their initials): each set is a tappable column with its number on top and the winner's animal, in their team colour, in the lane of the team that won it, so the swing of the game reads at a glance. A "Bids" column goes back to the bidding, the current column lights up, and the set that decided the game shows ★ instead of its number. The set label and tally sit between ◀ and ▶. Tonight's theme scene stays along the top, as at the table.
- **Games that stopped early:** a game stopped at the clinch ends with "The game stopped here", and the unplayed cards stay in hand.
- **When the data arrives:** every set (`DealView.playedTricks`) is sent only once the game is complete. During play, only the last set is ever sent (R8: remembering cards is part of the skill).
