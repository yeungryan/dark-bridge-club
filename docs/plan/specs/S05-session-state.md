# S05 · Session: captain, partners, dealer rotation, tally
**Milestone:** M0 · **Depends on:** S01–S04 · **Size:** S · **Package:** `engine`

## Purpose
Everything that spans more than one deal in a single night.

## Behaviour
1. **Lobby:** the session starts when all 4 profiles are connected (S07, S08).
2. **Captain draw:** a random profile becomes captain. *(The ceremony is S15.)*
3. **Partner pick:** the captain chooses 1 of the other 3. **The captain's usual partner is pre-selected** (Darren ↔ Kim, Adrian ↔ Ryan), and one tap confirms it or the captain can pick someone else. The remaining two are the other pair. **Partnerships are fixed for the whole night (R1).**
4. **Seating:** random, with partners always opposite (`partner(s)`).
5. **First dealer:** random. After every deal, *including pass-outs*, `dealer = next(dealer)` (R2).
6. **Tally:** `wins[pairA]`, `wins[pairB]`, plus the deal count and pass-out count.
7. **End of night:** anyone may propose "End night", and **all 4 confirm** *(confirmed)*. Final result: more wins / tied / fewer wins (R10). Then the end-of-night ceremony (S15).
8. **Dropped session:** if a missing player hasn't reconnected within **30 minutes**, the night **closes automatically** with the tally as it stands *(confirmed)*. A deal in progress at that point is discarded and doesn't count. Closing still runs the end-of-night results, awards and history update (S15). The clock is per player: it starts when they go "away" (S08) and resets when they reconnect.

## Acceptance criteria
- [ ] The captain can't pick themselves. The partnership can't change mid-session.
- [ ] The dealer sequence follows `next()` across 8 deals, including a pass-out redeal.
- [ ] The tally always equals the number of deals played minus pass-outs.
- [ ] A tied night is a valid final state.

## Out of scope
Display (S10, S15). Persistence (S09).
