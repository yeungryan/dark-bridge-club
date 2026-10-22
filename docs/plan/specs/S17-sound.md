# S17 · Call-safe sound
**Milestone:** M2 · **Depends on:** S16 · **Size:** S

## Purpose
Sound adds weight to the game without ever competing with your friends' voices (P4, principle 13).

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

## Fixes after the first M2 playtest (no sound was heard)
- **Bug:** audio was only unlocked on `pointerdown`. Phones only allow audio from a completed tap (`touchend` / `pointerup` / `click`), so on phones sound never started. It now unlocks on all of those, every time (which also recovers after switching to Messenger and back), and plays a silent buffer for iOS.
- **Redesign:** M2's "call-safe" thumps (80–140 Hz) are below what phone speakers can play, and the default volume was ~20%. Every sound now has its body at 300 Hz–5 kHz (short knocks, snaps, bells, brass), the default volume is 70%, and phones that saved M2's quiet default are reset once.
- **Haptics:** short vibrations on your own taps and card plays, and on big table moments (Android only; iPhone browsers have no vibration API). Settings → Vibrate.
- On an iPhone, the ring/silent switch mutes web game sounds; this is not overridable without risking interrupting the call.
- **lab.html** (the sound check page) plays every sound on demand, to check volume on a real Messenger call. **practice.html** is you against three bots in the browser, and nothing is recorded.

## Set-win attack sounds (Ryan, round 8)
Each set-win attack (S24) has its own sounds, built from the same synth parts and kept in the phone band (300 Hz–5 kHz). Each is fired at the effect's own impacts, so sound and picture stay together on a slow phone too.

**Set won:**
- **Fire:** a suck-in and a "whoomp", then a crackle as each card burns.
- **Air:** a gust, then a "shing" per cut.
- **Water:** a splash and a jet, a plop per hole, then drips.
- **Earth:** a slam and a whistle, then a crunch per boulder.
- **Lightning:** a zap per jump, rising.
- **Sound:** a boom, then a paper crumple.
- **Ice:** a whistle, then a glassy tink per shard and a frost crackle.
- **Metal:** a whirr, then slashes, and a thunk and twang as the last blade sticks.

**The game-winning set:** a rising gold power-up, then each finisher's own sound, leading into the clinch chord at the finale:
- **Fire:** a roar and crackling ash.
- **Air:** a blasting gust.
- **Water:** a rushing wave.
- **Earth:** a crack and clatter.
- **Lightning:** a thunder crack and sizzle.
- **Sound:** a bigger boom with fluttering paper.
- **Ice:** a glass shatter.
- **Metal:** shredding slashes.

These replace the generic set-won chime (`lead`) and the trump-set brass (`trumpTrick`) whenever an attack plays.

