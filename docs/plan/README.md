# DARK Bridge Club — Build & Design Plan
*(Working title. "DARK" = **D**arren, **A**drian, **R**yan, **K**im.)*

A private, browser-based bridge table for exactly four friends (Darren, Adrian, Ryan and Kim), played while on a Messenger video call.
Builder: Claude. Reviewer, product owner and first playtester: you.
Plan date: 2026-10-20. Every decision below has been confirmed by you, unless marked **(assumed)**.

---

## 1. The real goal

> **Create a standing ritual.** The game is the campfire, and the friendship is the point.

The game succeeds if the four of you **actually meet more often** and **want to come back**. Being technically impressive bridge software doesn't count. The main thing stopping you from meeting is **scheduling across time zones**, so the app also has to get people to the table, not just entertain them once they're there.

**Measures of success** (checked informally, never tracked inside the app):
1. Sessions per quarter go up compared with today.
2. At least one moment from each session ("remember when…") comes up again later in the group chat.
3. Nobody ever says the app got in the way of the conversation.

**Not goals:** strangers, matchmaking, ranked play, monetization, AI opponents in real games, teaching bridge, or changing bridge rules.

---

## 2. Promises to the players

GMTK's Balatro video calls the hidden score preview a "cursed problem": two things the designer wants that can't both be true (the excitement of a slot machine and the predictability of a spreadsheet). The same trap applies here, so write the promises down and look for conflicts before building.

| # | Promise |
|---|---|
| **A** | *This is our bridge.* The house rules are implemented exactly. Nothing changes who wins. |
| **B** | *Every night feels like an event.* There are ceremonies, a rotating theme, and stories to keep. |
| **C** | *The app never makes us wait or fight it.* The call and the cards come first. |
| **D** | *Our history matters.* Rivalries, records and memories carry over between nights. |

**Known conflict: B (ceremony) vs C (pace).** Resolved by an **attention budget**:
- Big ceremonies happen only at **session boundaries** (start and end of the night) and at the **clinch** of each deal.
- Feedback for each card finishes within **400 ms**. A set win plays inside the **0.80 s** hold before the trick sweeps (S24). Neither ever **blocks input**.
- Every ceremony can be **skipped**, and any repeat ceremony gets shorter.

**Possible conflict: A vs Balatro-style freshness.** Balatro feels fresh because its rules change every run, and you've ruled that out. So freshness here comes **only** from presentation (themes), memory (history), and stories (awards and moments). That is a deliberate constraint, not a gap.

---

## 3. Design principles drawn from the two GMTK videos

Sources, checked line by line (rewritten 2026-10-22):
- **Balatro video:** GMTK's "Balatro has a fundamental design flaw" (script read from GMTK's Substack).
- **Juice video:** GMTK's "Secrets of Game Feel and Juice" (transcript supplied by Ryan).
- **Our playtests:** Ryan's notes from playing the build.

Where a principle comes from our own playtests rather than a video, it says so. An earlier version credited two ideas to the videos that neither one says (an "Alex Jaffe" framing, and "big effects only for big moments"); both are corrected here.

### What players know

| # | Principle | Source | What it means here |
|---|---|---|---|
| 1 | **Show what players can work out anyway; hide only what's truly unknown.** | Balatro video: information that is "hidden, but attainable" gets worked out by hand anyway, because "given the opportunity, players will optimize the fun out of a game" (Soren Johnson). | **Always visible:** the auction, the contract, **both pairs' trick targets and counts**, and the last trick. **Hidden:** other players' hands and earlier tricks. Remembering played cards is a real bridge skill, so hiding past tricks isn't busywork. **Your own HCP stays hidden** (Ryan's decision, 2026-10-22): counting your own points is part of the game at your table. Principle 6 is the check on that call. |
| 2 | **If you hide something, make the reveal worth it.** | Balatro video: the pageantry matters because you "watch it go before knowing" the result. Knowing ahead "would just get in the way." | Hands stay hidden all deal, so the **4-hand reveal** at the end is the big payoff (S14). |
| 3 | **Turn an existing quantity into a visible race.** | Balatro video: after each hand "the numbers tick up, with escalating sound effects." | Your scoring is win or lose, so the drama is the **race between two trick meters**: declarers need `6+level`, defenders need `8−level`. The counts are already part of the game. Showing them as a race costs nothing and creates tension every trick. |

### How it feels

| # | Principle | Source | What it means here |
|---|---|---|---|
| 4 | **Every bit of polish should speak to what the game is about.** | Juice video's thesis: juice is "doubling down on whatever your game is about." | This game is about **winning sets as a pair** with your friends. Effects concentrate on the set win, the trick race and the clinch, and stay warm, never harsh: the target feeling is *"a private clubhouse with your best friends."* **Timing stays the same in every theme, and only the look changes**, so muscle memory carries over. |
| 5 | **Fundamentals first: the blank-room test.** | Juice video: Mario 64 was "just hopping around a blank room" for months while the movement was tuned. Ask whether it is fun with the trappings stripped out. | Rules engine first (M0), then a playable but plain version (M1), and only then the effects (M2). The **reduced-effects setting** is the standing blank-room test: a deal must still feel good with it on. |
| 6 | **Make impact unmistakable.** | Juice video: screen shake, a split-second hit-pause, flashes and knockback. "Anything you can add to make it really clear that you're damaging an enemy is worth it." | The winning element **attacks the three losing cards**, with a hit-pause and a shake (S24). |
| 7 | **Keep the "camera" still where precision matters.** | Juice video: a jumping game keeps "the camera still so you can land each jump." | Shake moves the **trick area only**. Your hand, the bidding box and the scoreboard never shake, so you can always read and tap accurately. |
| 8 | **Escalate repeats; don't repeat at the same size.** | Our playtests (Ryan: the confetti got repetitive, S16 M3), plus the Balatro video ("burn hotter and hotter with each multiplication") and the juice video ("rising pitch… to sell the tenuous joy of nursing a combo"). Note the juice video itself never asks for restraint; the restraint comes from us. | One **intensity scale** (S16) drives every effect, and the biggest moments are rare: the clinch and the night's end (the only confetti). **Streaks escalate:** sets won in a row raise the pitch (a pentatonic ladder) and the visuals. |
| 9 | **Vary sounds, and fit them to the room.** | Juice video: "randomized sound effects to avoid repetition"; make them "bassy and loud". | Every sound has slight pitch variation. **Deliberate deviation from "bassy and loud":** you play on phone speakers during a Messenger call, so sounds are tuned to the band phones can play, and sit under your voices. |
| 10 | **Let the aftermath linger.** | Juice video: in Hotline Miami, bodies "stick around", giving "a little short-term nostalgia of the chaos you've caused." | Losing cards stay **wrecked on the table until the sweep**. Over a longer span, the reveal, the moments, the awards, the replays and the rivalry history are the night's permanence. |

### Who it is for

| # | Principle | Source | What it means here |
|---|---|---|---|
| 11 | **Know who the game is for, and protect them.** | Balatro video: "you need to be certain who the game is for - and then protect that player base from certain design choices", even when a choice is offered only as an option. | Four friends on a call, not strangers. Features that would serve strangers, ranked play or teaching (see §1, Not goals) stay out, even as options. |
| 12 | **Watch how players actually play, and change your mind when they show you.** | Balatro video: the deck view exists because playtesters were tracking cards by hand. "The best intentions in game design sometimes have to change, when you see how players actually interact with your game." | Playtests (S23) look for notepads, finger-counting and "wait, what's the contract?" Each one is a UI bug, and it can overturn an earlier decision, including principle 1's call on HCP. |
| 13 | **The call is the soundtrack.** | Your setup. | Quiet sound effects, no music, no in-app chat. Pauses (reveal, awards) are timed to leave room for banter. |

---|---|---|---|
| 1 | **Show what players can work out anyway; hide only what's truly unknown.** | Balatro video | **Always visible:** the auction, the contract, **both pairs' trick targets and counts**, and the last trick. **Hidden:** other players' hands and earlier tricks. Remembering played cards is a real bridge skill, so hiding past tricks isn't busywork. |
| 2 | **If you hide something, make the reveal worth it.** | Balatro video | Hands stay hidden all deal, so the **4-hand reveal** at the end is the big payoff (S14). |
| 3 | **Big effects only for big moments.** | Game feel video | One **intensity scale** (S16) drives every effect. A routine card scarcely registers. The **clinching trick** gets the hit pause, the shake and the big sound. |
| 4 | **Pick the feeling first, then tune effects toward it.** | Game feel video | The target feeling is *"a private clubhouse with your best friends."* Effects should feel warm and satisfying, never loud. **Timing stays the same in every theme, and only the look changes**, so muscle memory carries over. |
| 5 | **Effects can't fix weak foundations.** | Game feel video | Rules engine first (M0), then a playable but plain version (M1), and only then the effects (M2). |
| 6 | **Watch for players tracking things by hand.** | Balatro video (the deck view story) | Playtests (S23) look for notepads, finger-counting and "wait, what's the contract?" Each one is a UI bug. |
| 7 | **Turn an existing quantity into a visible race.** | Balatro's score climb | Your scoring is win or lose, so the drama is the **race between two trick meters**: declarers need `6+level`, defenders need `8−level`. The counts are already part of the game. Showing them as a race costs nothing and creates tension every trick. |
| 8 | **The call is the soundtrack.** | Your setup | Quiet sound effects, no music, no in-app chat. Pauses (reveal, awards) are timed to leave room for banter. |

---

## 4. Locked decisions (verified)

### Rules: your house variant
- **R1** Fixed partners for the whole session, seated opposite. At the start a random **captain** is drawn and chooses a partner. **Their usual partner (Darren ↔ Kim, Adrian ↔ Ryan) is pre-selected**, and the captain can override it. Seats are then randomized, with partners always opposite.
- **R2** The first dealer is random. **The deal passes counter-clockwise** each deal, including after a pass-out.
- **R3** **Bidding is counter-clockwise starting with the dealer.** Calls are `1♣…7NT` and `Pass` only, with **no double or redouble**. Each bid must outrank the last. Three passes after a bid end the auction. Four opening passes mean a redeal.
- **R4** **Declarer = whoever made the final bid.** The opening lead comes from **declarer's right**, which is the next seat counter-clockwise. **Play is counter-clockwise.** You must follow suit if you can. The trick goes to the highest trump, otherwise the highest card of the suit led. The trick winner leads next.
- **R5** **No dummy.** All four hands stay hidden, and each player plays their own.
- **R6** Declarers need at least `6 + level` tricks. **Making it scores +1 win for declarers. Failing scores +1 win for defenders.** The level never matters.
- **R7** **No claims.** A player may propose **conceding** the rest of the deal, and **their partner must accept**.
- **R8** You can see **the last trick only**. The auction, contract and trick counts are always visible.
- **R9** When a deal ends, **all four original hands are revealed**, with each hand's high-card points.
- **R10** The session lasts **until you stop**. The pair with more wins takes the night. Ties are allowed.
- **R13** **Auto-close:** if a disconnected player hasn't come back within **30 minutes**, the night closes automatically with the tally as it stands. *(Assumed detail: an unfinished deal is discarded.)*
- **R11** **At the clinch, players choose.** When the result is settled, a "Play it out?" prompt appears. If any player taps **Play on**, play continues. Otherwise the deal ends. The prompt closes as "End" after **5 seconds** (confirmed). Over- and undertricks are recorded only if the deal was played out.
- **R12** **No turn timer.** After about 20 seconds idle, the active seat gets a gentle glow.

### Product
- **P1** What keeps sessions fresh: **rivalry and history**, **awards and highlights**, a **theme that rotates each session**, and **session avatars**. No side challenges.
- **P1a** **Session avatars (S24):** each night everyone privately picks an **animal from 3 random choices (one reroll)** plus an **element** (Fire/Air/Water/Earth, inspired by ATLA), revealed together. Cosmetic only. The element sets **your signature effect on deciding tricks**. Element and animal **stats** are kept, and **avatar pair names** appear on the score banner. *(Rare hybrid creatures: not in v1.)*
- **P1b** **DARK branding:** "DARK" is in the **app name** and the **lobby crest** (each letter lights up as that friend joins).
- **P2** A **simple scheduling page**: propose times in each person's own time zone, a yes/no from everyone, and an add-to-calendar link.
- **P3** **Phones first** (portrait, alongside a Messenger call), scaling up to laptops.
- **P4** **Quiet sound effects, no music**, with a mute for each player.
- **P5** **Four fixed profiles plus a 4-digit PIN** (Darren, Adrian, Ryan, Kim), entered once per device.
- **P6** **No chat or emotes in the app.**
- **P7** **The server holds all four hands** and sends each phone only its own cards. If someone disconnects, the game **pauses** until they rejoin.
- **P8** **Friends see it only once it's polished.** Bots are a **development tool only**.

### Tech
- **T1** **Cloudflare Workers + Durable Objects.** One object holds the table: game state, live connections, and stored history. Target cost: **$0/month on the free tier**. *(Verify free-tier limits at M1, see Risks.)*
- **T2** **TypeScript + Svelte** for the interface. The rules engine is a pure, separately tested TypeScript package shared by server and client.
- **T3** **Bids need a two-tap confirm.** Tap a card to **raise** it, tap again to **play** it (drag also works). There's **no undo**.

---

## 5. Architecture at a glance

```
 Phone / laptop browser (Svelte)            Cloudflare (free tier)
 ┌────────────────────────────┐   WebSocket   ┌──────────────────────────────┐
 │ Table UI  ·  Juice engine  │◄────────────►│ TableRoom Durable Object      │
 │ Sound     ·  Theme skin    │   per-seat    │  - authoritative game state   │
 │ History / Awards / Schedule│   filtered    │  - engine (shared package)    │
 └────────────────────────────┘   views       │  - SQLite: sessions, deals,   │
            ▲                                 │    moments, schedule, PINs    │
            │ static assets                   └──────────────────────────────┘
            └──────────── Workers static assets
 packages/engine  ← pure TS: rules, no I/O, 100% deterministic given a seed
```

Seats are numbered `0..3`. **`next(seat)` is the single source of truth for counter-clockwise order.** Nothing else in the code may hard-code a direction.

---

## 6. Milestones and checkpoints you sign off

Each milestone ends with a **checkpoint you sign off on explicitly**. Nothing moves forward without your "yes."

| Milestone | Specs | What you get | Your sign-off |
|---|---|---|---|
| **M0 Engine** | S01–S05 | The rules as a tested library. No interface. | You read a plain-English **rule trace** of 5 sample deals (bids, leads, follows, winners, clinch) and confirm every step matches how your group plays. |
| **M1 Playable, plain** | S06–S13, S22 | Real multiplayer on your phone and laptop. You play against 3 bots or across 4 browser tabs. Plain visuals. | You play 10 deals on a phone **with a Messenger call running**. You confirm the rules feel right, the layout leaves room for the call, and reconnecting works. |
| **M2 Feel** | S14–S17 | The juice pass: intensity scale, clinch moment, reveal, session-start ceremony, sound. | **Side-by-side check:** you play with effects on and off. Effects on must feel better *and* no slower. You confirm the sound doesn't bother people on a real call. |
| **M3 Freshness** | S18–S20, S24 | Rotating themes, moments and awards, rivalry and history. | You review award names and wording (personal jokes welcome), 3 themes rendered on the real table, the animal roster, and all four element effects. |
| **M4 Ritual** | S21, S23 | Scheduling page, end-to-end polish, private launch. | **Dress rehearsal** with 1–2 friends, then the first real night. |

---

## 7. Spec index (each about one page, each buildable on its own)

| Spec | Title | Milestone |
|---|---|---|
| [S01](specs/S01-cards-seats-deal.md) | Cards, seats, counter-clockwise order, shuffle and deal | M0 |
| [S02](specs/S02-auction.md) | Auction state machine | M0 |
| [S03](specs/S03-trick-play.md) | Trick play | M0 |
| [S04](specs/S04-deal-result-clinch-concede.md) | Deal result, clinch, concession | M0 |
| [S05](specs/S05-session-state.md) | Session: captain, partners, dealer rotation, tally | M0 |
| [S06](specs/S06-table-server.md) | Table server and message protocol | M1 |
| [S07](specs/S07-identity-pin.md) | Four profiles plus PIN | M1 |
| [S08](specs/S08-presence-pause-reconnect.md) | Presence, pause, reconnect | M1 |
| [S09](specs/S09-persistence.md) | What gets saved | M1 |
| [S10](specs/S10-table-layout.md) | Table layout (phone first) | M1 |
| [S11](specs/S11-hand-interaction.md) | Hand and card interaction | M1 → M2 |
| [S12](specs/S12-bidding-box.md) | Bidding box | M1 → M2 |
| [S13](specs/S13-trick-area-race-meters.md) | Trick area, last-trick peek, race meters | M1 → M2 |
| [S14](specs/S14-reveal.md) | The 4-hand reveal | M2 |
| [S15](specs/S15-session-ceremonies.md) | Start and end-of-night ceremonies | M2 |
| [S16](specs/S16-juice-engine.md) | Juice engine and intensity scale | M2 |
| [S17](specs/S17-sound.md) | Call-safe sound | M2 |
| [S18](specs/S18-themes.md) | Rotating session themes | M3 |
| [S19](specs/S19-moments-awards.md) | Moments and awards | M3 |
| [S20](specs/S20-rivalry-history.md) | Rivalry and history | M3 |
| [S21](specs/S21-scheduler.md) | Next-game scheduler | M4 |
| [S22](specs/S22-dev-bots-harness.md) | Dev bots and test harness | M1 |
| [S23](specs/S23-playtest-protocol.md) | Playtest protocol and polish standards | M2–M4 |
| [S24](specs/S24-avatars-elements.md) | Session avatars: animals and elements | M3 |

---

## 8. Risks and unknowns

| Risk | How likely / how bad | Mitigation |
|---|---|---|
| **Free-tier limits change.** I believe Durable Objects with SQLite storage are on the Workers Free plan, but I haven't checked this in this session. | Medium / Medium | Check first thing in M1. Four users is a tiny load. Fallback: Workers Paid (~$5/month), or PartyKit or Supabase Realtime. |
| **Messenger on the same phone.** I'm not sure Messenger keeps video in a floating window while you switch to the browser on every OS version. | Medium / High | The M1 checkpoint tests this on your actual phones. The layout leaves the **top-right corner** clear. If floating video fails, the fallback is call on laptop and game on phone, or the reverse. |
| **Game sound gets picked up by microphones** on laptop speakers. | Medium / Low | Quiet, short, high-pitched sounds (S17), muted per player, tested on a real call at the M2 checkpoint. |
| **Mobile browsers silently drop the connection** when the screen locks or you switch apps. | High / Medium | Automatic pause plus instant rejoin (S08). Hands are restored from the server. |
| **The rules engine misreads a house rule** (counter-clockwise order in particular). | Medium / High | A single `next()` function, rule traces at the M0 checkpoint, and property tests. |
| **Too much polish delays the first real night**, and the ritual never starts. | Medium / High | Hard milestone scope. The "Later" list (§9) absorbs new ideas. |

---

## 9. Later (written down so it doesn't creep into v1)
Blind-partner mode · side challenges · rare hybrid-creature unlocks · emotes or reactions · real-account login · native app wrapper · seasons or leagues · exportable "night recap" video.

## 10. Still open (none of these block M0)
1. ~~Display names~~ ✅ Darren, Adrian, Ryan, Kim. Still wanted: any **inside jokes** for award names and messages, and final edits to the **animal roster** (needed by M3).
2. The **first 3–5 themes** you'd like (S18 suggests some).
3. A **custom domain** or the free `*.workers.dev` address.
4. A **GitHub repo** for the code. In progress: Ryan is setting up GitHub.
5. **App name:** "DARK Bridge Club" is a working title. Rename any time before M4.
