# S02 · Auction state machine
**Milestone:** M0 · **Depends on:** S01 · **Size:** S · **Package:** `engine`

## Purpose
Run the bidding exactly as your house rules (R3, R4) describe.

## Behaviour
- **Calls:** `Pass` or `Bid(level 1–7, strain ♣<♦<♥<♠<NT)`. **No double or redouble.**
- The player on the dealer's right (`next(dealer)`) calls first (Ryan, round 10; it was the dealer). After that, `next(current)`, counter-clockwise.
- A bid is legal only if it **outranks** the last bid: a higher level, or the same level with a higher strain.
- **The auction ends when** three consecutive passes follow a bid → contract = the last bid, **declarer = the seat that made it** (R4).
- **Pass-out:** four opening passes → `PassedOut`. The session layer (S05) redeals with the dealer rotated.
- The engine exposes `legalCalls(state)`, which the bidding box (S12) uses to grey out options.
- Contract targets are computed here and used everywhere else:
  - `declarerTarget = 6 + level`
  - `defenderTarget = 8 − level` (that is, 13 − declarerTarget + 1)

## Acceptance criteria
- [ ] Insufficient bids are rejected. Calls made out of turn are rejected.
- [ ] `1♠ P P P` → contract 1♠, declarer = the opener.
- [ ] `1♥ (P) 2♥ P P P` → declarer = the **raiser** (final bidder), not the opener. *(House rule R4. This differs from standard bridge, and a test is named after it.)*
- [ ] `P P P P` → PassedOut.
- [ ] 7NT can be bid and nothing can follow it except passes.
- [ ] Targets are correct for every level: L1 = 7 vs 7, L4 = 10 vs 4, L7 = 13 vs 1.

## Out of scope
Bidding conventions and alerts (you all know them, so the call handles that).
