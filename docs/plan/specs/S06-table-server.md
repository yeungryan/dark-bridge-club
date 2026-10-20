# S06 · Table server and message protocol
**Milestone:** M1 · **Depends on:** S01–S05 · **Size:** M · **Package:** `server`

## Purpose
One trusted referee that runs the engine and gives each player only what they're allowed to see.

## Behaviour
- **One `TableRoom` Durable Object** for your group, at a fixed, unguessable URL path.
- Live connections via **WebSocket**. Clients send *intents* (`Call`, `Play`, `PlayOn`, `Concede`, `AcceptConcede`, `PickPartner`, `EndNight`…). The server validates them with the engine and broadcasts the result.
- **A separate view for each seat:** each connection receives `PublicState` plus **only its own hand**. Other hands are **never sent** until the reveal event (S14). *(Inspecting the browser can't reveal cards.)*
- Every server message has an increasing `seq`. Clients apply them in order. A gap in the sequence → request a full snapshot.
- **Events, not just state:** the server also emits semantic events (`CardPlayed`, `TrickWon`, `Clinched`, `ContractSet`, `Revealed`…) that the juice engine (S16) responds to. Events tell the client *what happened*; state tells it *where things stand*.
- The server owns all timers (the clinch window, concession expiry).
- *(Uses hibernatable WebSockets so idle time costs nothing.)*

## Acceptance criteria
- [ ] Four tabs with four profiles play a full deal, and each tab's network log contains only its own cards before the reveal.
- [ ] Illegal or out-of-turn intents are rejected with a reason code, and the state doesn't change.
- [ ] A reconnect snapshot reproduces the exact current table.
- [ ] Logic latency on the server is under 50 ms per intent (excluding network).

## Out of scope
Identity (S07). Storage schema (S09).
