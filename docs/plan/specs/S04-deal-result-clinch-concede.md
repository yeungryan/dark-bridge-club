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
