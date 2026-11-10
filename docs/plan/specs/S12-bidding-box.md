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

**Going once / twice (Ryan):** no longer small text above the top bid (where it collided with the calls and got clipped). It's a solid accent pill, "Going once…" (no emoji), in the middle of the table, small enough to sit between the side seats' calls. Calls and the stamp scale with the table, so small phones fit too.

**Calls on the table (Ryan):** the auction is no longer a strip of named calls. Each call lands on the table's edge right in front of the player who made it, flying in from their seat like a played card, so whose call it was needs no label. A player's calls overlap in a row (a column for the side seats), the latest on top, like bidding cards put down one after another; bids are card-white with the team colour along the bottom, passes look like the bidding box's Pass button (a dark, faintly lit tile), and the bid to beat is ringed in gold. **Firsts (Ryan):** every first gets the same small black-and-white "1st" badge: the game's opening bid, and the card that leads each set (at the table and in the replay). Each seat shows its last 4 calls. The replay's bidding step lays the calls out the same way. (During play, the auction button on the scoreboard still opens the full list with names.)

**"1st", revised (Ryan):** smaller, lowercase "1st", in a neutral stone colour (white on black belongs to Team Black), on the top-right corner of the tile or card so it never covers the call or the rank.

**"1st", final (Ryan, B4):** no text: a stone-coloured folded corner at the top-left of the opening bid's tile and of the card that leads each set, so the next call laid over it never hides it and it never covers a call or rank.

## Round 19 (Ryan): the picked bid is the Bid button
The separate yellow Bid button is gone. Tapping a bid tile picks it: it turns the theme's highlight colour (gold in some themes; Ryan, round 22: the highlight colour stays) and reads **"Bid 1♠"**, and the line on top still says what it needs. Tapping the picked tile again makes the bid; tapping another tile moves the pick there. A second tap within 250 ms of picking is ignored, so a quick double-tap can't pick and bid in one go. Pass stays one tap. With the Bid column gone, every bid tile is wider.

## Tap outside to let go (Ryan, round 21)
Tapping or clicking anywhere outside the bid box lets go of a picked bid: the tile goes back to normal and the hand's preview drops back to the bid to beat. Pick it again to bid.

## Chips (Ryan, round 22)
Bids no longer look like playing cards: every call is a **poker chip**, the same style everywhere (one shared `.chip` style in `app.css`).
- **The chip:** a round-ended dark disc with a soft top highlight, a white rim and a dashed inner ring with only **six dashes** (Ryan: fewer dashes, simpler). ♥/♦ bids are wine-red chips with pink suit ink; NT is a slate chip; Pass is a plain dark chip with no ring.
- **Bid box:** each tile is a chip. The picked chip still reads "Bid 1♠" in the theme's highlight colour, with no ring. Levels you can no longer bid fade to an outline.
- **On the table:** each call is a chip ringed in its player's team colour; the bid to beat adds the gold ring and glow. The opening bid's "1st" folded corner becomes a small stone dot at the top-left, because a chip has no corner.
- **The Bids list:** each call is a small chip.

## Hover and finger-slide (Ryan, round 23)
- **Desktop:** the chip or Pass under the mouse lifts 2 px, brightens and gets a bright rim, with a soft clack (a little higher for each strain to the right). Hovering picks nothing.
- **Phone:** run your finger sideways through the box and each chip (or Pass) lifts as you pass it, with the same clack. Letting go on a chip **picks** it ("Bid 3♥"), never bids it; letting go on Pass does nothing. Up and down still scroll the ladder.
- **Desktop bid box:** like the phone, two levels show with the third peeking and fading, and it scrolls a level at a time (it used to show all seven levels, faded past the second).

**Calls on the table, centred (Ryan, round 23):** each call sits in the middle of its chip, Pass included (it used to sit at the chip's leading edge). The next call overlaps a little less (about 9 px along the top and bottom, 5 px down the sides) so the covered call still reads.
