# S17 · Call-safe sound
**Milestone:** M2 · **Depends on:** S16 · **Size:** S

## Purpose
Sound adds weight to the game without ever competing with your friends' voices (P4, principle 8).

## Behaviour
- **Sound effects only. No music.** Each player has their own volume slider and a mute (remembered on each device).
- **Default volume is low** (about 40%).
- **Sound design rules:**
  - Short sounds (< 300 ms except at level 5) with **quick fades**, so they don't trigger the call's echo cancellation or hold onto the call audio.
  - Avoid the **main speech frequencies (~300 Hz–3 kHz)**: keep card sounds soft and higher, put "thump" sounds low.
  - **Rising pitch:** consecutive meter pips go up in pitch, and count-ups climb. *(Borrowed from Balatro's scoring sounds.)*
- Sounds are triggered **only by S16** (one mapping table).
- Only **your own** actions and shared events make sound on your device. Other players' card plays make a much quieter sound, so four phones in a call don't make four times the noise.
- Audio initializes on the first tap (a browser autoplay requirement).

## Acceptance criteria
- [ ] Real-call test at the M2 checkpoint: none of the four reports hearing the game "through" someone else's microphone at default volume on laptop speakers.
- [ ] The full sound set is under 300 KB in total.

## Open
- Generate the sounds procedurally (Web Audio, tiny and easy to theme) or use a royalty-free pack. **Recommendation: procedural first**, and swap in samples only where it sounds cheap.
