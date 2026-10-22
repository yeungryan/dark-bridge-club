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

## Trimmed (Ryan, before M4)
The result screen is now: one bold result ("Made +1", "Defeated −2", "Conceded"), one quiet line (contract · declarer's animal and name · "7–5 sets") and who take the game; the moments; the four hands (unchanged, with each hand's HCP as a small pill); then a square **rewind** icon (the replay) beside a wide **Next game**, and the four animals lighting up as each player is ready. Gone: the "Tonight" tally (the scoreboard shows tonight's games), "Tap to skip" (tapping still skips) and "(you)".

**Scrub, no arrows (Ryan):** drag along the set strip and the highlighted column follows your finger, set by set. The ◀ ▶ buttons are gone so the strip gets the full width: bigger columns and animals, with a little room around each column's number and animal, on a soft panel. Swiping the table and the arrow keys still step. The replay **opens on the set that decided the game** (★), or the last set played if none did.

**Pause before the results (Ryan):** after a game's last card lands (the 13th set, or the end of a game played out after it was decided), the table stays up for 3 seconds before the results take over.
