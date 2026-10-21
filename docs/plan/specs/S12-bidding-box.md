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

## The bid ladder (Ryan, M3)
Replaces the level and suit rows.
- **The bids:** every legal bid is its own little card, cheapest first, one level per row (♣ ♦ ♥ ♠ NT). Bids below the current one are greyed out on the lowest row; lower rows aren't shown.
- **Scrolling:** two levels show at a time, with the top of a third peeking out below, faded (Ryan), so the ladder reads as scrollable. Scrolling snaps a whole level to the top, with a soft tick. A thin fade at the top edge means levels lie above.
- **Picking:** tap a card to pick it; tap it again to drop it. The top line then reads "2♠: you need 8 sets, they need 6". With nothing picked, it reads "To beat: 1♥ by Kim" or "No bids yet: you can open".
- **Buttons:** Bid (gold once something is picked) and Pass sit in a column beside the ladder. Pass is one tap on a plain grey button, so the box doesn't push you toward passing.
- **Height:** the box is a little shorter than the old one, so the table never shrinks and seats never move.
- **Revised (Ryan):** Bid and Pass are two tall buttons in a row to the right of NT: Bid (with the picked bid under the word), then Pass.
- **Suit order everywhere** (Ryan): hands, the reveal and the replay all use the bidding box's order, ♣ ♦ ♥ ♠, left to right or top to bottom, highest card first within each suit (`sortHand`).

**Going once / twice (Ryan):** no longer small text above the top bid (where it collided with the calls and got clipped). It's a solid accent pill, "🔨 Going once…", in the middle of the table, small enough to sit between the side seats' calls. Calls and the stamp scale with the table, so small phones fit too.

**Calls on the table (Ryan):** the auction is no longer a strip of named calls. Each call lands on the table's edge right in front of the player who made it, flying in from their seat like a played card, so whose call it was needs no label. A player's calls overlap in a row (a column for the side seats), the latest on top, like bidding cards put down one after another; bids are card-white with the team colour along the bottom, passes are the bidding box's green, and the bid to beat is ringed. Each seat shows its last 4 calls. The replay's bidding step lays the calls out the same way. (During play, the auction button on the scoreboard still opens the full list with names.)
