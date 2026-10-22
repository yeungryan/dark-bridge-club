# S03 · Trick play
**Milestone:** M0 · **Depends on:** S01, S02 · **Size:** S · **Package:** `engine`

## Purpose
Card play with **no dummy** and **counter-clockwise** order (R4, R5).

## Behaviour
- **The opening lead is made by `next(declarer)`** (the player on declarer's right), **except in no-trumps, where declarer leads** (Ryan, round 10).
- Each trick: the leader plays first, then `next()` three times. So on trick 1 the order is: declarer's right → declarer's partner → declarer's left → **declarer plays last**.
- **Follow suit:** if you hold the suit led, you must play it. Otherwise any card is legal.
- **Trick winner:** the highest trump if any trump was played (trumps = the contract's strain; none in NT), otherwise the highest card of the suit led.
- **The winner leads the next trick.**
- All four hands are hidden. The engine has no idea of a dummy at all.
- `legalPlays(state, seat)` drives card dimming (S11).
- Each completed trick is stored as `{leader, cards[4] in play order, winner}` for the last-trick peek (S13) and replays.

## Acceptance criteria
- [ ] Playing out of turn is rejected. Revoking (not following suit when able) is **impossible**, because the server rejects it.
- [ ] In NT, the highest card of the suit led wins, and off-suit aces lose.
- [ ] A trump beats any non-trump card. Of two trumps, the higher one wins.
- [ ] A golden test plays a full scripted 13-trick deal and checks every leader and winner.
- [ ] Property test: across 5,000 random legal play-outs, every card is played exactly once and every trick has exactly 4 cards.

## Out of scope
When the deal *ends* (S04). Animation (S13).
