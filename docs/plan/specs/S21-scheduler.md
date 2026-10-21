# S21 · Next-game scheduler
**Milestone:** M4 · **Depends on:** S07, S09 · **Size:** S

## Purpose
Scheduling is the **main reason you don't meet**, so this is probably the most important feature for the real goal, even though it's the least glamorous.

## Behaviour
- Anyone can **propose 1–5 time slots**. They pick them in their own time zone, and each slot is stored in UTC.
- Everyone sees every slot **in their own local time** (`Intl.DateTimeFormat`), with the proposer's local time in small text underneath.
- Each person marks each slot **Yes / Maybe / No**. A slot with **4 Yes** is **locked automatically**: confetti (level 3), an **"Add to calendar" (.ics)** download, and a **countdown on the home screen**.
- **Share to Messenger:** a "Copy invite" button writes a friendly message with the link, e.g. *"Bridge Night? Vote here: …"*. (No push notifications in v1. Messenger is already your notification channel.)
- **Ending a night leads here** (S15), so the next session gets proposed while everyone is still in a good mood.
- Gentle social nudge: the home screen shows who hasn't voted yet. No automatic messages.

## Acceptance criteria
- [ ] With two people in different time zones on simulated clocks, both see correct local times, including across a daylight-saving change.
- [ ] The .ics file imports correctly into Google Calendar and Apple Calendar.
- [ ] Proposing a slot takes ≤ 4 taps.

## Built (M4)
- **Where:** a "Next night" card on the home screen (the lobby) opens the scheduler; so does **📅 Plan the next night**, now the main button when a night ends ("Start a new night" stays under it). The practice table has none of this.
- **Proposing (3 taps from the scheduler):** ＋ Propose times → tap up to 5 of the next seven evenings (8 PM your time) or add any day and time → Propose. The proposer counts as a Yes. Proposing a time that's already up just adds your Yes.
- **Voting:** each time shows in your own time zone, with the proposer's time underneath when it reads differently; Yes / Maybe / No; four initials coloured by each vote (green Yes, amber Maybe, struck-out No, dashed not yet); "Waiting on …" names who hasn't voted on every time. The proposer can take a time back.
- **Lock:** the first time all four say Yes locks; the other times close; confetti and a fanfare for whoever sees it happen; the card shows the day, time and a countdown, with **📅 Add to calendar** (an .ics file: UTC start, 3 hours, a 30-minute reminder) and **💬 Copy invite**. "Plans changed? Reopen voting" unlocks it (votes reset). A locked night disappears 12 hours after it starts; open times an hour after theirs.
- **Copy invite:** "🂡 Bridge night? Options: … Vote here: <link with the room key>", or "… is on: <day, time>! See you at the table: <link>" once locked. No messages are ever sent by the app.
- **Server:** the schedule is stored on its own (not part of any night); `GET /api/schedule` and `POST /api/schedule` (propose / vote / withdraw / unlock), signed-in only; anything malformed is refused.
- **Tests:** engine rules (propose limits, duplicates, lock at four Yes, tidy-up, withdraw, unlock, bad input); times across a daylight-saving change in two zones; the .ics format; and the full flow in the four-browser e2e (propose in 3 taps, three votes, lock, calendar download, the home-screen countdown).
