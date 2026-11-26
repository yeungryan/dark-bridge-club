# S08 · Presence, pause, reconnect
**Milestone:** M1 · **Depends on:** S06, S07 · **Size:** S

## Purpose
Mobile browsers drop connections all the time (locked screen, switching to Messenger). The game should shrug it off (P7).

## Behaviour
- Each seat shows its presence: **connected / reconnecting / away**.
- A seat whose socket closes gets a **10-second grace period** before showing as "away."
- **Pause:** while any seat is away, input is frozen for everyone. A calm banner reads *"Waiting for Adrian…"* No penalty. The banner shows a quiet countdown only in its last 5 minutes. **After 30 minutes away, the night closes automatically** (S05).
- **Reconnect:** the client retries with backoff (0.5 s → 8 s). On reconnect it asks for a snapshot and **restores its hand and the trick in progress** instantly, with no reshuffle animation.
- Coming back to the app (the `visibilitychange` event) triggers an immediate reconnect check.
- Anything you'd selected but not confirmed (a raised card, a bid selection) is cleared after a reconnect *(a safe default)*.

## Acceptance criteria
- [ ] Locking the phone for 60 s mid-trick, then unlocking → back in the game within 2 s, in the same state.
- [ ] Switching to Messenger and back on iOS Safari and Android Chrome → same as above.
- [ ] Killing the server's isolate mid-deal → the state survives (it's persisted after every intent).

## Out of scope
Substitutes or bots in real games (P8).

## Round 23 (Ryan): what counts as gone, and who we're waiting for
- **The rule, on every screen:** a lost connection is *reconnecting* for **2 minutes**, then *away* (it was 10 seconds). Only *away* pauses a game ("Waiting for Kim…"). Locking a phone or switching apps for less than 2 minutes pauses nothing. After 30 minutes away the night still closes (unchanged).
- **What drops a connection:**
  - **iPhone:** locking the screen or switching apps closes it almost at once, and the page can wake up holding a dead connection that still looks open.
  - **Android:** background pages are frozen or closed; how soon varies by phone and battery settings.
  - **Computer:** switching tabs or windows keeps it (Chrome may freeze a tab left in the background 5+ minutes); closing the laptop drops it.
  - Also: weak signal or switching networks, closing the tab or app, opening the game on another device (the newer one takes the seat), and a new version going live (everyone reconnects by themselves).
- **Heartbeat:** every 15 s each phone sends "ping" and the Cloudflare runtime answers "pong" without waking the table (`setWebSocketAutoResponse`). A phone silent for 45 s has vanished without saying goodbye (battery, lost signal); the server closes it and counts the 2 minutes from when it was last heard. A phone with no answer for 35 s, or none within 3 s of coming back to the app, reconnects at once. Phones on an older version that never ping are left alone.
- **On another screen:** each phone says whether the game is on screen. Connected but hidden shows as "(on another screen)" in the lobby line and in the seat badge's tooltip. It blocks nothing.
- **Starting the night:** once all four have picked an animal and **nobody is away**. Someone still *reconnecting* doesn't hold it up; they come back to the partner pick.
- **The lobby (option C):** a player who picked but dropped has their letter fade and its check dim and pulse slowly. Once you've picked, one line names who the night is waiting for and why: "Waiting for Darren to pick · Kim to come back" (or "to join" for someone not here yet). It's hidden otherwise.
- **Tests:** the server's away time can be shortened for tests only (`TEST_AWAY_MS`; 4 s in the e2e run).
