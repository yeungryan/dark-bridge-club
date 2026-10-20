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
