# S01 · Cards, seats, counter-clockwise order, shuffle and deal
**Milestone:** M0 · **Depends on:** none · **Size:** S · **Package:** `engine`

## Purpose
Basic types and the **one** definition of table direction.

## Behaviour
- `Suit = ♣ ♦ ♥ ♠`, `Rank = 2..A`. A card is `{suit, rank}`, and 52 unique cards make a deck.
- `Seat = 0 | 1 | 2 | 3`. `partner(s) = (s + 2) % 4`.
- **`next(s)` = the next seat counter-clockwise** = the seat on `s`'s **right**. This is the **only** function anywhere that encodes direction. It's used for bidding order, play order, the opening lead (`next(declarer)`), and dealer rotation.
- `deal(rng)`: Fisher–Yates shuffle using an injected random number generator, then 13 cards to each seat, starting with `next(dealer)` *(the order doesn't affect fairness; it's here so replays reproduce exactly)*.
- The server's random generator uses `crypto.getRandomValues`. The seed is stored with each deal so it can be replayed later (S09).
- `hcp(hand)`: A=4, K=3, Q=2, J=1.
- Sorting a hand for display: by suit (alternating colors ♠♥♣♦), high to low within each suit.

## Acceptance criteria
- [ ] 10,000 dealt hands: always 52 unique cards, 13 per seat.
- [ ] A chi-square test on how often each card lands in each seat passes (no seat bias).
- [ ] The same seed always produces the same deal.
- [ ] Applying `next` 4 times returns to the starting seat. `next(next(s)) === partner(s)`.
- [ ] No other module contains the literals `+1`, `+3` or `% 4` applied to seats (a lint rule or test enforces this).

## Out of scope
Anything about bids, play or display.
