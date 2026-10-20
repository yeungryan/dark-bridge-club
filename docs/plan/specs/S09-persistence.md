# S09 · What gets saved
**Milestone:** M1 (schema), used from M3 · **Depends on:** S05, S06 · **Size:** S · **Store:** Durable Object SQLite

## Purpose
Save enough history to support rivalries (S20), awards and moments (S19), and "last time…" recaps, from the very first night. **History can't be filled in after the fact, so we save it from M1 even though nothing displays it until M3.**

## Tables (outline)
- `profiles(id, name, color, emoji, pin_hash)`
- `sessions(id, started_at, ended_at, theme_id, captain_id, pair_a[2], pair_b[2], wins_a, wins_b, passouts)`
- `deals(id, session_id, n, dealer, seed, hands_json, auction_json, contract, declarer, tricks_json, clinch_trick, played_out, result, over_under)`
- `moments(id, deal_id, kind, seat, payload_json)` (S19)
- `awards(id, session_id, kind, profile_id, payload_json)` (S19)
- `schedule_proposals / schedule_votes` (S21)

## Rules
- Write after every intent, using small transactions.
- Keep everything forever. The size is trivial: a few KB per deal.
- **Export:** a "Download our history (JSON)" button, so your history never depends on this app surviving.

## Acceptance criteria
- [ ] Any finished deal can be **replayed exactly** from its saved row.
- [ ] Export, then re-import into an empty room, produces identical stats.
