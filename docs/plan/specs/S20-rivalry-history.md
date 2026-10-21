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
- Still to come: player cards, the moments wall, element and animal records.

## Offline nights (Ryan)
- History keeps every night, all time: nothing is ever trimmed, and every number is recalculated from all of them.
- **Add an offline night** (History → Nights): the date, who partnered whom (the three splits), and the games each pair won. It goes to the others for approval and counts only once **all four** approve; any one can turn it down. Taking an offline night back out also needs all four.
- Waiting changes show at the top of History (Approve / Turn down, or Withdraw your own) and as a nudge on the lobby's Last time card. At most 5 wait at once.
- Offline nights count in head to head and partnerships (their games and winner), show in the night log marked "Offline" (no games to replay), and can be the "Last time…" night.
- Server: an `offline_nights` table, the waiting changes in storage, `POST /api/history/change` (propose / approve / reject), signed-in only; the engine's `historyChanges.ts` holds the rules (unit tested).
