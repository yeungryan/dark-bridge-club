# S20 · Rivalry and history
**Milestone:** M3 · **Depends on:** S09, S19 · **Size:** M

## Purpose
Make history matter (promise D) and give each night a link to the last one.

## Screens
1. **"Last time…" card** (shown at session start, S15): date, partnerships, final score, best moment, and the mood of the night (e.g. *"Darren & Kim won 7–5 with a grand-slam Robbery"*).
2. **Rivalry board:** with four people there are **only three possible partnership matchups** (AB–CD, AC–BD, AD–BC). Show the all-time **nights won** and **deals won** for each matchup, plus each player's record **with** each partner. *(This turns "who are you picking?" at the captain pick into real strategy and real teasing.)*
3. **Player cards:** nights won, deals won as declarer and as defender, contracts made %, favorite strain, awards cabinet.
4. **Night log:** a list of every session → open one → each deal → **replay** (the auction, then trick by trick, with all hands visible, using the saved seed).
5. **Moments wall:** every moment ever, filterable by player.
6. **Element and animal records** (S24): all-time deals and nights won by element (*"Earth is 9–4"*), each player's record by element, and each player's most-picked and luckiest animal.

## Rules
- History is visible to the four of you only (same login as S07).
- Stats show "—" until the sample is big enough to mean something (e.g., at least 5 deals), instead of misleading percentages.

## Acceptance criteria
- [ ] Every number on these screens can be recalculated from the saved deals (no separately stored counters that could drift).
- [ ] Replaying any saved deal exactly matches what happened.

## Built in M3 part 4 (first round)
- **"Last time…" card** in the lobby: when and where, who won and by how much (or a dead heat), and that night's headline award, with a way into History. Nothing shows before the first finished night.
- **History** (from the lobby card, or ☰ → History & rivals at the table). The practice table has no history.
  - **Rivals:** the three ways the four of you can pair up, each with nights won side by side, games won, and when it was last played; then all six partnerships with nights and games won/played, and a win rate once a partnership has 5 games (otherwise "—").
  - **Nights:** every night, newest first: date, theme, result and pairs. Tap one for its games (contract, declarer, made/defeated with over/under, or passed out); ▶ replays any game that was played out, from your seat that night, in the same replay as after a game.
- **Server:** `GET /api/history` and `GET /api/history/game?night=&game=`, signed-in only. A night's id is its row number, never its seed (which would give away the hands of games still to come).
- **Engine (`rivalry.ts`):** `headToHead`, `partnerRecords`, `partnershipRecords`, `winRate`, `lastNight`, all worked out from the saved nights and games on every request.
- Player cards, the moments wall, and element and animal records: built in round 7 (below).

## Setting the score by hand (Ryan; replaces "offline nights")
- History keeps every night, all time: nothing is ever trimmed, and every number is recalculated from all of them.
- **Change score** on any head-to-head matchup: steppers for each pair's nights won and games won, starting from the score as it stands, and "Start again from 0–0". Use it to add nights played away from the app, to stop counting some wins, or to reset. Kept simple on purpose: just the numbers, no dates or notes.
- It goes to the others and counts only once **all four** approve; any one can turn it down. One change per matchup waits at a time, at most 5 in all. Waiting changes show at the top of History ("Darren & Kim 5–3 Adrian & Ryan · games 21–17", with what it is now) and as a nudge on the lobby's Last time card.
- Once approved, the agreed numbers are that matchup's score as of when it was proposed; nights begun after that count on top. The card says "Score agreed by all four on …". Partnerships read the same numbers (with four players, each partnership is one side of one matchup). The night log is untouched.
- Server: the agreed scores and the waiting changes in storage, `POST /api/history/change` (propose / approve / reject), signed-in only; the engine's `historyChanges.ts` holds the rules and `headToHead` applies them (unit tested).

## Players and moments (Ryan's designs, round 7)
History has four tabs: **Rivals · Players · Moments · Nights**. Every number is worked out from the saved nights (engine `playerStats.ts`, unit tested).
- **Players → All:**
  - **Leaderboard (LB2):** four gold champion cards: Sets won, Games won, Declaring W–L, Defending W–L. Each shows the leader big (animal, name, number), 2nd and 3rd on one line, 4th on the next. Sets and games rank by wins; Declaring and Defending rank by games played in that role. Declaring counts only the declarer (not their partner); Defending counts both defenders.
  - **Awards (T5):** Epic Attic ("Booked high, fell well short"), Daredevil ("Bids the highest on average"), Heist Master ("Made it with fewer points"): name, meaning, the leader's count as a big number over the award's icon, the leader, then everyone else's count.
  - **Animals:** each player's most-picked animal (nights) and luckiest (best share of games won, once picked for 5+ games).
  - **Elements:** each player's share of games won with each element, best in gold, "—" until 5 games.
- **Players → a player's card:** their latest animal and name, with icon chips for The Wall, Epic Attic, Heist Master and Daredevil (×count, no names); nights and since when. Four tall tiles: Sets won (of all sets played, %), Games won (of games played, %), Declaring (made–down), Defending (beaten–made). **Fave bid suit** and **Fave bid level** side by side: the favourite as a headline (the suit; the level as a little card-white bid tile) with its %, the rest as one quiet line of percentages. **Fave partner:** a tile per partner with win % (once 5 games together) and games played; the best in gold.
- **Moments:** each night (newest first) shows at most two of its awards, by priority: Epic Attic, Heist Master, Daredevil, That's 10 Dollars, Heartbreak Hotel, then the rest alphabetically. Filter by player; ▶ replays the game it happened in when the award names one.
- **Server:** each saved night now carries all of its awards (not just the top one).
