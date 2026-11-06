# S04 · Deal result, clinch, concession
**Milestone:** M0 · **Depends on:** S02, S03 · **Size:** S · **Package:** `engine`

## Purpose
Decide who wins each deal and **the exact moment it's decided**. That moment is where the biggest effects in the game happen (S16).

## Behaviour
- Declarers' and defenders' tricks are tracked against `declarerTarget` and `defenderTarget` (S02).
- **Clinch:** the first trick after which either side reaches its target. The engine emits `Clinched {side, trickNumber, clinchingCard, clinchingSeat}`. This is the "clinching trick."
- **Clinch choice (R11):** the state becomes `AwaitingPlayOn`. Any seat may send `PlayOn`, and play then continues to trick 13. Otherwise the server sends `EndAtClinch` after a **5 s window** *(confirmed; set in config)*. The engine only reacts to these two inputs; the server owns the timer.
- **Result:** declarers made it → `+1` win to the declaring pair. Otherwise `+1` win to the defenders. **The level never affects the score.**
- **Over/undertricks:** recorded only if the deal was played out. Otherwise `null`.
- **Concession (R7):** any player may propose `Concede` for their side, and their **partner must accept**. If accepted, the deal ends and the **other** side wins it. A declined or ignored proposal disappears silently *(confirmed: it expires after 15 s)*. Only one proposal at a time.
- Trick counts are part of the public state on every update (principle 1: show what players can work out anyway).

## Acceptance criteria
- [ ] For each level 1–7, the clinch fires on exactly the right trick for both the "made" and "defeated" cases.
- [ ] If anyone sends PlayOn, the deal continues and over/undertricks are recorded. Otherwise they're `null`.
- [ ] A concession without the partner's acceptance changes nothing.
- [ ] A concession by declarer's side → defenders win. A concession by defenders → declarers win.
- [ ] The result can't change after the clinch, even if the deal is played out.

## Out of scope
The reveal (S14). Session tally (S05).

## Play On needs your partner (Ryan, round 21)
- **The window:** when a game is decided before the 13th set, everyone gets the 5 s "Play the rest out?" window, as before. It's offered whether or not a sweep is still possible.
- **The button says what's at stake:**
  - **Go for a sweep:** the winners, while the losers haven't won a set yet (`sweepStillOn`).
  - **Ask to be swept:** the losers, while the winners can still take every set.
  - **Play on:** everyone, once a sweep is no longer possible.
- **Asking:** tapping it asks; it doesn't play on yet. The asker's partner sees "Ryan wants to go for a sweep: No / Agree" and has 10 s. Agree, and play goes on; the trick winner leads.
- **A no:** if the partner says no, or doesn't answer in time, the **other** pair gets a fresh 10 s window to ask in the same way. Only they can ask now; it rarely happens. If they also say no, or let it run out, the game ends where it was decided.
- **No one asks:** when the first window runs out with no ask, the game ends as before.
- **Bots** never ask to play on, but always agree when their partner asks.
- **Engine and server:**
  - Engine: `playOn` asks, or agrees when sent by the asker's partner. `declinePlayOn` says no. `endAtClinch` from the timer counts an unanswered ask as a no. State: `playOnAsk`, `playOnDeclined`.
  - Server: an ask or a no restarts the window (`PLAY_ON_ANSWER_MS`).

## End the game (Ryan, round 21)
- **Where:** a menu option above "End the night", available while a game is being played.
- **Voting:** all four have to agree. It pops up on everyone's screen with "Keep playing" / "Agree", and any "Keep playing" calls it off.
- **What happens:** the game counts for no one. Nothing is added to the night's score or the all-time records, and the seat-swap count doesn't move. The next dealer deals.
- **Night log:** History shows it as "Ended early · not counted".
- **Bots** agree.
- **Engine:** `voteEndGame` / `cancelEndGame`, and a `DealRecord` with `voided: true`.
