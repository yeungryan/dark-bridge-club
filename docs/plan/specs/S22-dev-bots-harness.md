# S22 · Dev bots and test harness
**Milestone:** M1 · **Depends on:** S01–S06 · **Size:** S · **Dev only, never in real games (P8)**

## Purpose
So you (and I) can test the game alone, and so the M0 rule-trace checkpoint is easy to read.

## Contents
- **Rule-trace generator:** prints a deal in plain English for your M0 checkpoint, e.g.
  `Dealer: Darren. Bidding (counter-clockwise): Darren 1♥ → Adrian Pass → Kim 1♠ → Ryan 2♣ → Darren Pass → Adrian Pass → Kim Pass. Contract 2♣ by Ryan (final bidder). Ryan's right (Darren) leads ♠K…`
- **Bots:** `random-legal` (for fuzz testing) and `simple` (follows basic heuristics, so a test deal makes sense). Selectable only in **dev mode**.
- **Four-tab mode:** a dev URL opens four seats in one browser window as a 2×2 grid.
- **Seeded deals:** `?seed=…` in dev mode, to reproduce bugs and stage dramatic scenarios (a decider clinch, a Yarborough) for tuning effects.
- **End-to-end tests:** Playwright with four browser contexts plays full deals headlessly in CI.

## Acceptance criteria
- [ ] One command runs the engine unit tests, the property tests and the end-to-end tests.
- [ ] A bot-only session of 100 deals finishes with no errors.
- [ ] Production builds contain no bot code.
