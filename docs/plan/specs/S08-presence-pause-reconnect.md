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
