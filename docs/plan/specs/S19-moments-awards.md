# S19 · Moments and awards
**Milestone:** M3 · **Depends on:** S04, S09 · **Size:** M · **Package:** `engine/moments` (pure functions on saved deals)

## Purpose
Turn each night into **stories you'll repeat** (promise D, success measure 2). Everything is calculated from saved deal data, so new detectors can be run on **old** deals too.

## Moment detectors (run when each deal finishes)
| Moment | Trigger |
|---|---|
| **Grand Ambition** | Contract at level 6 or 7, made or not. |
| **Robbery** | Declarers made it with fewer combined HCP than the defenders. |
| **Heartbreak** | Declarers were 1 trick from making it and were set on that trick. (Always known at the clinch, whether or not the deal is played out.) |
| **The Decider** | The clinch came when both sides were 1 trick from their target. |
| **Trump Card** | The clinching card was a trump-over. |
| **Yarborough** | Someone was dealt a hand with no card above a 9 (shown at the reveal). |
| **Powerhouse Benched** | The player with the most HCP at the table was a defender who lost. |
| **Comeback Night** | Session level: the pair that won was down by 3 or more at some point. |
| **Streak** | One pair won 4 or more deals in a row. |

Each moment saves `{kind, deal, seat(s), payload}`. **Caption templates** are a data file, so your own jokes and nicknames can go in.

## Awards (end of night, 3–5 shown)
Chosen by priority with variety (no award twice in a row across sessions unless it's clearly earned):
- **MVP:** most clinching cards played.
- **The Wall:** most contracts set as a defender.
- **Daredevil:** highest average contract level as declarer.
- **Heist of the Night:** the biggest Robbery.
- **Heartbreak Hotel:** most Heartbreaks.
- **Plus your custom awards** (M3 checkpoint): names and inside jokes you supply.

## Acceptance criteria
- [ ] Every detector has unit tests on scripted deals, including a negative case.
- [ ] Re-running detectors on all saved history produces identical results (deterministic).
- [ ] Captions never misattribute a player. Tests check seat→profile mapping.

## House awards from your inside jokes (M3 input, 2026-10-20)
Each award goes to **whoever earns it** on the night, so the joke's namesake can be roasted with their own line, and so can anyone else. Captions are data and can be edited. The Taglish is deliberate.

| Award | The joke | Who earns it | Caption |
|---|---|---|---|
| **Epic Attic** | Kim booked a Boracay "room for 10" that was a 10 sqm attic. | Biggest overbid: the declarer whose contract went down by the most tricks. | "Booked for ten, delivered an attic. Epic attic levels na yan!" |
| **Why Don't You Blog About It** | Ryan built a whole blog for his high-school crush. | The night's most dramatic moment: the highest-drama clinch or the cruelest Heartbreak. | "Why don't you blog about that?" |
| **Banner Moment** | Darren's whole review of his Vietnam trip: "great, they had a banner at the airport." | The most anticlimactic win: a low contract made exactly, with no drama. | "Banner moment na ba yan?" |
| **That's 10 Dollars** | Adrian's old boss wanted to charge him for long breaks. | The player who spent the longest thinking in total tonight. This needs per-move timing, which the server will record from M3. | "Oh, 10 dollars na yan!" |

## Built (M3 part 3)
- **Engine** (`moments.ts`, `captions.ts`): every detector and award is calculated from saved history (`DealHistory` / `NightHistory`) by replaying the saved sets against the contract, so old nights can be re-run with the same result.
- **Thinking time** (`thinkclock.ts`): the clock runs for whoever is due to call or play. It stops while the table is paused, and one turn counts as 3 minutes at most. Totals are saved per game (`deals.think_json`).
- **Saved data:** each night's seating (`sessions.seating_json`) and the `moments` and `awards` tables.
- **On screen:** the reveal shows the game's moments as caption chips once all four hands are face up. At the end of the night, up to five award cards flip in one at a time after the winners' banner.
- **Award selection:**
  - Each award is scored against a "clearly earned" level.
  - House awards get a bonus.
  - Each award kind appears at most once.
  - A player gets at most two awards, unless that's needed to reach three.
  - A kind given last night is skipped unless it's clearly earned again.
- **Epic Attic** counts how far short the declarers would still be even if they had won every set that wasn't played (games stop at the clinch). A defeat qualifies when it's 2+ short or at level 4 or higher. A one-short loss on the last set is a Heartbreak, not an attic.
- **Award cards trimmed (Ryan):** no avatars. The house awards lead with their joke line as the headline, and the others with their name. One plain line follows: the player · the fact (e.g. "Darren · 2♠, made exactly").
