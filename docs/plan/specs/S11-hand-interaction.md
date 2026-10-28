# S11 · Hand and card interaction
**Milestone:** M1 (works) → M2 (feels great) · **Depends on:** S03, S10, S16 · **Size:** M

## Purpose
Playing a card should feel physical and be impossible to misclick (T3).

## Behaviour
- The hand is a **fan** of 13 cards, sorted per S01, with overlap that adapts to screen width.
- **Legal cards** are full brightness. Illegal ones are dimmed and slightly lowered. *(Only on your turn. Otherwise the hand stays calm and neutral, so the screen's visual "energy" points at whoever is acting.)*
- **Tap once → the card raises** (lifts about 18 px, tilts slightly toward the center, casts a soft shadow). **Tap again → it plays.** Tapping another card moves the raise to that card.
- **Drag:** pull a card above a threshold line → it plays on release. Releasing below the line → it springs back. *(Moved to M2: M1 ships tap-to-raise, tap-to-play only.)*
- **Response time:** the raise starts **within one frame** of touch. Playing sends the intent immediately, and the card flies to the trick area *optimistically*. If the server rejects it, the card springs back with a soft "no" wobble.
- No undo.

## Feel notes (M2)
- **Raise:** a spring with a small overshoot (stiffness high, damping medium) and a ~1° tilt.
- **Play:** the card moves along a slight curve to its spot in the trick, landing with a **2-frame squash** and a soft thud (S17).
- **Hover** (laptop): the card lifts slightly and leans toward the cursor.
- With reduced motion on, everything becomes a short fade or move with no overshoot.

## Acceptance criteria
- [ ] Zero accidental plays across 50 deals in playtest.
- [ ] Measured input-to-visible-response time ≤ 16 ms on a mid-range Android phone.
- [ ] A rejected play recovers cleanly with no ghost cards.

## Decision after the first M2 playtest (locked with Ryan)
- **Tap only lifts a card** (it rises ~26 px and grows to 112%). **You play a card by dragging or flicking it up to the table.** The card follows your finger in any direction, the trick area glows (a dashed ring) once letting go would play it, and the card flies on from exactly where you let go.
  - Plays if dragged ≥ 70 px up, or flicked upward faster than 0.6 px/ms over at least 24 px.
  - A second tap on a lifted card makes it hop and shows "Swipe it up to the table to play." It does not play, so a double tap can never misplay.
- **Settings → Play cards: Tap twice** restores tap-to-raise, tap-again-to-play for anyone who prefers it. Keyboard Enter always plays the lifted card.
- Other players' cards fly in from their name badge, not from a fixed offset.
- Why: the second tap landed on a small, overlapped card, and the card vanished from the hand instead of travelling to the table. That broke the link between the gesture and the card on the table.

## Polish (Ryan, M3)
- **Where suits start:** in the ♣ ♦ ♥ ♠ order, each suit's first card gets a subtle deeper shadow and a thin outline, so ♦ and ♥ (and ♣ and ♠) never run together.
- **Bid preview:** while bidding, the bid you've picked but not confirmed raises the matching cards in your hand (your screen only): its suit, or your honours (A, K, Q, J) for NT. With nothing picked, the cards of the bid to beat are raised instead, and the bidding box's top line counts what you hold of it ("you hold 2 ♣", "you hold no ♥", or "you hold 2 aces" over NT).
- **Trumps marked (Ryan, option D):** once the contract is set, every trump in your hand and on the table carries a short purple bar along its top (inset from the card's edges, so in an overlapping hand each trump shows its own bar) and a faint purple tint, for the rest of the game. Nothing for NT.
- **No glow on playable cards (Ryan):** the cards you can't play are dimmed on your turn; the ones you can are left plain.
- **Team colours:** your pair is gold and the other pair silver in every theme (`--gold` and `--silver`): avatar rings, the scoreboard's set icons and the set-win effects.

## Round 19 (Ryan): one way to play, cued on the card itself
Replaces the "Decision after the first M2 playtest" above and the Settings choice.
- **Tap a card** to raise it (gold border). If you can play it, a **gold double chevron** blinks in the middle of the card, its two halves in turn (bottom, then top). There is no pill or button around it: the whole card is the button. The old text hint under the hand is gone, so nothing shifts when you raise a card.
- **Tap it again** to play it, or **swipe it up** a little (30 px, or a quick 16 px flick).
- **Swipe it down** (24 px), or **tap anywhere outside your hand**, to lower it. Tapping another card raises that one instead.
- **A card that isn't raised can't be swiped onto the table.** A swipe up on it only raises it.
- A second tap within 250 ms of raising is ignored, so a quick double-tap can't raise and play in one go (the reason the M2 decision stopped the second tap playing).
- Settings → "Play cards" is removed: everyone plays the same way. Keyboard Enter still plays the raised card.
