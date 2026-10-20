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
