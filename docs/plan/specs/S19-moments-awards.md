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
