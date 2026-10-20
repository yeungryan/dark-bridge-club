# S12 · Bidding box
**Milestone:** M1 → M2 · **Depends on:** S02, S10 · **Size:** S

## Purpose
Fast, misclick-proof bidding that turns the auction into a small story.

## Behaviour
- When it's your turn, a bidding box slides up over your hand: **levels 1–7 across the top, strains ♣ ♦ ♥ ♠ NT below, a big Pass button.** No double or redouble.
- Calls that are no longer legal are hidden or dimmed (S02 `legalCalls`).
- **Two taps:** select a level and strain → a preview chip ("2♥") pulses → tap **Bid 2♥** to confirm. **Pass also needs a confirming tap** *(confirmed; Pass mistakes are just as costly)*.
- **Auction strip:** each call appears in turn order, attached to its player's color, with a small "stamp" as it lands.
- **Contract set:** when the auction ends, the final bid moves from the strip into the **contract badge** and the race meters appear (S13). This is the first *chapter break* of the deal. It gets moderate intensity (S16).
- **Pass-out:** the cards are swept back with a light shuffle sound, then *"Redeal: dealer passes right."*

## Acceptance criteria
- [ ] A typical bid takes ≤ 2 taps after deciding.
- [ ] An insufficient bid can't be made at all.
- [ ] The full auction can always be read again in one tap.

## Changes after the first M2 playtest
- **Levels and suits are always both showing,** and can be chosen in either order (some players think suit first). If a pick would make an illegal pair, the other half is dropped, and pairs that can't go together are shown faint.
- Feel:
  - Buttons press in with a soft click and a tiny vibration.
  - Bids stamp into the auction harder as the level rises; passes slide in quietly.
  - After a bid, passes count down on the top bid: "Going once…", "Going twice…". The third pass is **"Sold!"**: a gavel knock and chord, the contract slams into the header with sparks, and the score pips deal out.
