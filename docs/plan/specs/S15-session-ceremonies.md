# S15 · Start and end-of-night ceremonies
**Milestone:** M2 · **Depends on:** S05, S16, S18–S20 · **Size:** M

## Purpose
Make each night feel like an **event** (promise B), spending the big ceremonies only at session boundaries (the attention budget).

## Start of night (~45 s total, every step skippable)
1. **Lobby:** the **DARK crest** (a monogram of D·A·R·K) sits above four empty chairs. **Each letter lights up** as that friend arrives, and the chair greets them: *"Kim has entered the club."* When all four letters are lit, the crest flares once. A "next session" pointer appears if one is scheduled (S21).
2. **"Last time…" card** (S20): the last session's result, its best moment, and the current all-time head-to-head record. *(This is what connects one night to the next.)*
3. **Theme roll** (S18): a slot-machine reel lands on tonight's theme, and the table re-skins in front of you.
4. **Avatar pick** (S24): everyone privately picks an animal from 3 random choices plus an element, then all four avatars flip together.
5. **Captain draw:** a spotlight sweeps the four seats with a slowing tick, lands on the captain, then a short drumroll.
6. **Partner pick:** the captain's **usual partner is pre-selected**, so one tap confirms or the captain picks someone else. The two avatars **snap together** under their **avatar pair name** (*"Fire Tiger & Water Otter"*). The other two pair up automatically.
7. Seats animate into place → the first dealer is chosen → deal.

## End of night
*(M2 built: crest light-up and flare, captain spotlight, pairs announcement, end-of-night count-up, banner and confetti. Still to come: the "Last time…" card and rivalry (M3, S20), the theme roll (M3, S18), the avatar pick (M3, S24), awards (M3, S19), and "Next time?" (M4, S21).)*

1. Someone proposes "End night" → all 4 confirm (S05).
2. **Final tally** count-up → winners' banner (or a "dead heat" banner for a tie).
3. **Awards** (S19): the top two award cards flip in side by side, one at a time.
4. **Updated rivalry** (S20): the head-to-head totals move with this night's result.
5. **"Next time?"** button → straight to the scheduler (S21). *This is where the ritual keeps itself going.*

## Acceptance criteria
- [ ] First-ever session: the full ceremony. Later sessions: each step can be fast-forwarded with one tap.
- [ ] From "all four connected" to the first card dealt ≤ 80 s without skipping (including the ~20 s avatar pick), ≤ 30 s skipping.

## Lobby clean-up (Ryan, round 4)
- **The DARK crest is the guest list.** A letter is dim grey while its player is away, lights in their colour when they arrive (with a chime), and fills solid with a check once they've picked their avatar. The player list, the "4/4 here" line and the theme's greeting are gone.
- The theme's flag sits left of its name.
- The lobby starts below the theme's scene, so nothing overlaps it.

## The deal (Ryan, M3)
- **Shuffling:** each game waits for its dealer (engine phase `awaitingDeal`). The deck riffles in the middle of the table; only the dealer's phone plays the riffle sound. The dealer gets a glowing **Deal** button with a shuffle icon, and everyone else sees "Kim is shuffling…". There's **no automatic deal**: starting the game is the dealer's moment. Only the dealer can deal, and no hand exists until they do.
- **Dealing:** after the tap, 52 cards fly from the deck round the table from the dealer's left, one every 27 ms, each with a light flick that rises in pitch. Your 13 land in your hand, which fans open with a paper sweep. Bidding opens once the cards have landed.
- **Pass-outs:** the next dealer shuffles and deals again.

**Crest colour (Ryan):** all four DARK letters share one colour, the theme's accent (dim until the player arrives, lit when here, solid once they've picked), as does "DARK" on the sign-in screen: the name reads as the title.

**The DARK crest, revised (Ryan, L1 faint):** each letter is a tile in its team colour: D and K Team Black, A and R Team Red, each with its suit small and faint in the top-left corner (♣ D, ♦ A, ♥ R, ♠ K: the bidding order, lowest first; round 11, was ♠ ♥ ♦ ♣). Not here: a dim outline; here: the letter and edge lit in the team colour (black letters with a light rim); picked: filled, with the ✓. The login title is the same crest, all four filled, with BRIDGE CLUB beneath.
