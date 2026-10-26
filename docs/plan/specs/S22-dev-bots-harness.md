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

## Round 16 bidding (Ryan: "the bots were too quiet")
Measured over 4,000 all-bot deals, round 15's bots ended 66% of auctions after a single bid; when the opponents of a 1-level opener held 21+ points they stayed silent 71% of the time and then won only 40% of those games. The fixes, measured head-to-head (one pair new, one pair old, same deals, seats swapped):
- **Partner's points:** once an opponent has bid, the unknown points are split between two hands, not three.
- **No extra half-set margin** on top of the estimate.
- **Light overcalls:** an opponent holds the contract and nothing is "safe", but 8+ points and a five-card suit still compete, up to level 2.
- **Strong six-card suit over partner's:** with three or fewer cards in partner's suit, a six-card suit with two of the top three honours is offered (once per auction).
- **Light openings:** 9–11 points with such a suit open (at 2 if safe); and by the Rule of 20, 10–11 points open when points + the two longest suits ≥ 20.
- **Own six-card suit over three-card support** when it's at least as safe.
- **Shape (Ryan):** suit contracts average the points estimate with a losing-trick count (24 − my losers − partner's), so a void and a doubleton beside a long suit rate it higher; shortness in partner's suit gets no credit (a misfit). NT is unchanged.

Result: single-bid auctions 66% → 22%, strong opponents silent 71% → 12%; the new bots win 56.4% of games against round 15's and 63.4% against the original (≈5,900 games each). Card play is unchanged; bots still only see the last trick, so the extra value of shape isn't fully cashed in play yet.

## Round 17 card play (Ryan: "Adrian led ♠K from K543 into Darren's ♠A")
The old rule was a single line: lead the top card of the longest side suit (ties went to spades), and win cheaply when partner isn't winning. It never asked whether that card could win. Card play now lives in `src/botPlay.ts`:
- **Memory (Ryan chose full memory).** A bot remembers every card played this deal: which cards are now the top of their suit, how many trumps are still out, and who has shown out of a suit. A player's view still shows only the last set (S06); the practice table hands the bots the earlier sets, which everyone saw played.
- **Leads.** Cash a sure winner. Never lead a king or queen while a higher card is still out (Ryan: a king usually comes after the ace has gone), except a **singleton**, which is lost to the ace anyway and leaves a void to ruff (Ryan). Top of a sequence (K-Q, Q-J), high from a short suit, otherwise low. The declaring side pulls trumps while it clearly holds more of them; defenders lead partner's bid suit, or a singleton to ruff.
- **Reading the auction (Ryan).** Bidding a new suit over partner's suit, without ever supporting it, shows shortness in partner's suit: expect a ruff there (pull trumps sooner, don't lead it into them). Raising partner's suit shows a fit: that pair holds the suit, so lead it at most once. A suit bid twice shows 5+ cards. Opponents' bid suits are avoided as leads.
- **Following.** Last to play: win as cheaply as possible, or throw the least useful card. Second hand plays low unless it holds a sure winner. Third hand overtakes partner only with a sure winner, and only when the last opponent could beat partner's card. Discards keep sure winners, guards for a king or queen, and partner's suit.

Measured head-to-head (same bidding, one pair new play, one pair old, same 10,000 deals, seats swapped): the new play wins **56.3%** of games. Declarers now make 73.5% of contracts (was 69.0%). Each part was checked by taking it out: trump pulling, reading the auction and third-hand overtaking each add about 1.5–2 points; the rest are neutral against the old bots but match how people play. Ryan's 3♣ deal (Adrian's ♠K) is a regression test: the old play went down 7–6 exactly as in his game; the new play pulls trumps first and makes it (9–4).
