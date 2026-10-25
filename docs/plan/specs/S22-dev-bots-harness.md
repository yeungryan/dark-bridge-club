# S22 · Dev bots and test harness
**Milestone:** M1 · **Depends on:** S01–S06 · **Size:** S · **Dev only, never in real games (P8)**

## Purpose
So you (and I) can test the game alone, and so the M0 rule-trace checkpoint is easy to read.

## Contents
- **Rule-trace generator:** prints a deal in plain English for your M0 checkpoint, e.g.
  `Dealer: Darren. Bidding (counter-clockwise): Darren 1♥ → Adrian Pass → Kim 1♠ → Ryan 2♣ → Darren Pass → Adrian Pass → Kim Pass. Contract 2♣ by Ryan (final bidder). Ryan's right (Darren) leads ♠K…`
- **Bots:** `random-legal` (for fuzz testing) and `simple` (follows basic heuristics, so a test deal makes sense). Selectable only in **dev mode**. A bot agrees when a person proposes ending the night, and never answers concessions.
- **Four-tab mode:** a dev URL opens four seats in one browser window as a 2×2 grid.
- **Seeded deals:** `?seed=…` in dev mode, to reproduce bugs and stage dramatic scenarios (a decider clinch, a Yarborough) for tuning effects.
- **End-to-end tests:** Playwright with four browser contexts plays full deals headlessly in CI.

## Acceptance criteria
- [ ] One command runs the engine unit tests, the property tests and the end-to-end tests.
- [ ] A bot-only session of 100 deals finishes with no errors.
- [x] Bots only ever run in a seat opened with `bot=1` (the dev page). *(Changed in M1: bots run in the browser, deciding from that seat's own view, so they can never see other hands. The bot code ships in the app bundle but is inert unless a seat is opened as a bot.)*

## Round 15 bidding
Ryan's report: bots raised partner for nothing ("Ryan 2♣, Kim pass, Adrian 3♣"), and once anyone had bid they could never bid their own hand. Under our house rules a contract is simply won or lost, so bidding higher than needed only adds risk. The bots now bid **"just enough"**: only to win the auction for their side, at the cheapest level, and never above what they think their side can make.

- **Safe level.** For each strain (♣ ♦ ♥ ♠ NT) a bot estimates how many sets its side can win: its own points plus what partner's bids have shown (an opening 1-bid shows 12+ points and 4+ cards, 1NT 15+, a new suit 5+ cards, support 3+ cards), or a cautious share of the unseen points if partner hasn't bid. About 26 points with an 8-card trump fit makes 10 sets (25 points in no trumps makes 9); a long, strong suit counts for at least the sets it wins on its own. The safe level is that estimate − 6, with half a set to spare. A bot never bids above it.
- **Partner holds the contract → pass.** Raising wins nothing. *Rule 1, "bid against partner":* with 0–2 cards in partner's suit and a 5+ card suit of its own that is safe at the cheapest level, a bot may offer its suit instead. Only once per auction, and a bot whose suit partner turned down never bids it again, so partners can't get into a bidding war.
- **An opponent holds the contract.** *Rule 3:* with 3+ cards in partner's suit, raise it to the cheapest level that beats the opponents (a fit beats a new suit). Otherwise compete in its own best strain (a 5+ card suit, or NT with a balanced hand and a stopper in their suits) at the cheapest winning level. Only within the safe level; otherwise pass.
- **Opening.** 12+ points open at level 1 (1NT with a balanced 15–17, otherwise the longest suit). *Rule 2, "skip level 1 to block":* a 7+ card suit with two of the top three honours, whose own sets (the suit's length minus its losers, plus side aces and ace-kings) reach 8 or more, opens straight at that level (at most 4). Weaker hands pass.
- Bots still decide only from their own view, and always the same way for the same view (no randomness).

`npx tsx scripts/bot-bidding-sim.ts` (in `packages/engine`) compares old and new bidding over 2,000 all-bot deals: contracts made 74% → 84%, uncontested partner raises in 47% of deals → none, and about one auction in seven is now contested.
