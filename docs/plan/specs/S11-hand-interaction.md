# S11 · Hand and card interaction
**Milestone:** M1 (works) → M2 (feels great) · **Depends on:** S03, S10, S16 · **Size:** M

## Purpose
Playing a card should feel physical and be impossible to misclick (T3).

## Behaviour
- The hand is a **fan** of 13 cards, sorted per S01, with overlap that adapts to screen width.
- **Legal cards** are full brightness. Illegal ones are dimmed and slightly lowered. *(Only on your turn. Otherwise the hand stays calm and neutral, so the screen's visual "energy" points at whoever is acting.)*
- **Tap once → the card raises** (lifts about 18 px, tilts slightly toward the center, casts a soft shadow). **Tap again → it plays.** Tapping another card moves the raise to that card.
- **Drag:** pull a card above a threshold line → it plays on release. Releasing below the line → it springs back.
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
