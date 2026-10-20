# S10 · Table layout (phone first)
**Milestone:** M1 · **Depends on:** S06 · **Size:** M · **Package:** `client`

## Purpose
A table you can read at a glance on a phone while faces are talking in a floating window (P3).

## Layout (portrait phone, 360–430 px wide)
```
┌───────────────────────────── ┐
│ [contract + race meters]  ▢ ← top-right corner left clear for the Messenger video
│            Partner (top)    │
│ Left    [ trick area ]   Right │  ← "Right" = next(you), counter-clockwise
│                             │
│   [ auction strip / prompt ] │
│ ╭────── your hand (fan) ────╮ │
└───────────────────────────── ┘
```
- **You are always at the bottom.** Your partner is at the top. **The player who acts after you (counter-clockwise) is on your right.** This matches where your friends would really sit, so play order is visible on screen.
- Every seat badge shows: **session avatar** (animal + element ring, S24), name + color, presence (S08), dealer chip, a **turn glow**, and the declarer or defender role once there's a contract.
- **The contract and race meters** (S13) are always on screen. The full auction can be expanded with a tap.
- **Safe zone:** the top-right 30% × 22% of the screen is kept free of anything you need to tap. Confirmed as the starting point; the size gets measured against Messenger's floating window on your real phones at the M1 checkpoint.
- Landscape and laptop: the same structure, scaled. Your hand gets more room, and the trick area grows.
- **Text never smaller than 14 px. Tap targets of at least 44 px.**

## Acceptance criteria
- [ ] Works at 360 × 640 with no horizontal scrolling.
- [ ] **Whose turn it is can be read in under 1 second** from arm's length (checked in playtest S23).
- [ ] Nothing important is hidden under Messenger's floating window on your real phone.

## Round 4 (Ryan)
- The header holds only the menu button; the theme's scene owns the top of the screen.
- The contract and the race to each side's target moved to where "X to play" was, above your hand. The "X to play" line is gone.
- **Whose turn:** the active player's avatar ring breathes and their name lights in the accent colour, and the other seats dim slightly. On your own turn your seat lifts and the cards you can play glow. A hidden live region still announces the turn to screen readers.
