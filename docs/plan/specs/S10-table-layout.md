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
- The header holds the menu button (top-left), "Game N" (with tonight's all-time score just under it, round 12, S15), and a Settings gear (top-right, Ryan); the theme's scene owns the rest of the top of the screen. Settings left the menu.
- The contract and the race to each side's target moved to where "X to play" was, above your hand. The "X to play" line is gone.
- **Whose turn:** the active player's avatar ring breathes and their name lights in the accent colour, and the other seats dim slightly. On your own turn your seat lifts and the cards you can play glow. A hidden live region still announces the turn to screen readers.

**No role tags (Ryan):** the seats no longer say Declarer / Partner / Defender under the names; the scoreboard shows who declared. Seat badges are 80px tall (was 96).

**Team Red vs Team Black (Ryan):** partnership colour is red and black, like the cards' suits. Team Red is the pair Ryan sits in (Adrian & Ryan), the same on every phone; the other pair is Team Black. It shows on the cards-left badge, the bid tiles' bottom stripe, the scoreboard (initials and set animals) and the replay strip. Where Team Black sits on a dark panel it gets a thin light rim. **Gold means winning or leading only**, the same gold in every theme: the bid to beat, the card winning the set, the replay's winning card.

## Pull to refresh (Ryan, QoL)
- **What it does:** at the top of a screen, pull down and let go to reload the page.
  - A circle with a refresh icon follows your thumb (or the mouse) down, reading "Pull to refresh".
  - Past about 72 px it turns the accent colour, reads "Let go to refresh" and gives a light buzz.
  - Letting go there reloads the page; letting go earlier cancels.
- **Where it works:** every screen, the table included (Ryan, round 23: during a game too), and inside History and Next night wherever they are open, when scrolled to the top. Reloading mid-game is safe: the game lives on the server and you come straight back to your seat.
- **Where it doesn't:**
  - starting on your hand, where swipes play and lower cards;
  - starting in the bid box, which scrolls;
  - in a replay.
  - The browser's own pull-to-refresh stays off (`overscroll-behavior: none`) for the same reason.
- **Gestures it ignores:** a sideways swipe (player chips, award cards) or an upward scroll is not a pull.
- **With a mouse:** the press doesn't select text, so a second pull can't turn into dragging the selection.

## Screen stays on, new-version bar, add to home screen (Ryan, QoL)
- **Screen stays on during a night:**
  - From picking partners to the last game, the page asks the browser to keep the screen awake (Screen Wake Lock), so phones don't dim and lock while you wait to bid or play.
  - It's off in the lobby and on the end-of-night screen.
  - The browser drops the lock whenever the page is hidden, so it's taken again when you come back.
  - Browsers without it (iPhones before iOS 16.4) simply don't.
- **"A new version is ready" bar:**
  - Each build writes `version.json` with its build id.
  - An open tab checks it every 5 minutes and whenever it comes back to the screen.
  - When the build has changed, a slim bar at the top shows **Refresh** (reloads) and **✕** (not now, for this build).
  - It never reloads by itself, so it can't interrupt a game.
- **Add to home screen:**
  - A quiet link, "add to home screen", sits after "sound check" and the practice or multiplayer table link on the title screen. It's hidden once the app runs from the home screen.
  - Where the browser offers an install prompt (Android Chrome), the link opens it. Otherwise (iPhone) it shows the steps.
  - The steps add that you'll sign in with your PIN once: an iPhone home-screen app keeps its own storage.
- **How the install works:**
  - The Worker serves `/manifest.webmanifest`. Its start address includes the private link's key, but only for a request that already carries the right key; anyone else gets `/`.
  - The icon is the D A R K tiles in a 2 × 2 grid (`icon-v3-192.png`, `icon-v3-512.png`, `apple-touch-icon-v3.png`, all four letters filled; renamed when redrawn so phones fetch the new one).

## Desktop layout B (Ryan, round 22)
- **When it applies:** on a screen at least 1100 px wide and 620 px tall. Smaller screens keep the phone layout unchanged.
- **The table:** the table and your hand take the left. The table grows to fit the height (up to 400 px), table cards up to 96 px and hand cards up to 100 px.
- **The seats:** the four seats keep the phone's layout, with each name below its avatar.
- **The side panel:** 400 px on the right, always in this order, with whatever applies:
  1. **The Bids:** the calls so far.
  2. **The scoreboard:** the contract and the race, or who deals before the contract is set.
  3. **Previous Set:** the last set's four cards, once there is one. While it's your call, the bid box takes this place, scrolling two levels at a time like the phone (round 23).
- **Wording:** the same as the phone ("The Bids", "Previous Set").
- **No floats:** the scoreboard, bid box and sheets no longer float over the table on desktop. The Play On, concession and end-of-night prompts still appear above the hand.
- **Implementation:** `lib/layout.svelte.ts` (`layout.wide`, `tableCardWidth`, `handCardWidth`).
