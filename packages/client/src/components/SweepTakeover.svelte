<script lang="ts">
  import { onMount } from 'svelte';
  import { buzz } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import type { Sweeper, SweepShow } from '../lib/juice/sweep';
  import AnimalIcon from './AnimalIcon.svelte';

  // Ryan (round 15): a sweep takes over the screen for 5 s, straight after the game-winning
  // effects. It blends out of the "SWEEEP ×13" stamp, which is the first thing to move.
  //  - Broom God (option A, "The Ascension"): the screen dims, a gold beam comes down and lifts
  //    the stamp away, a giant broom spins down and plants itself, the 13 sets pile up under it.
  //  - Dog Moorb (option B, "Upside-Down World"): a record scratch and the table flips upside
  //    down, the declarers dangle from the top, an upside-down broom sweeps their contract away,
  //    then the world flips back.
  // Both say who swept whom in team colours, and end with the +10 or +100 flying into the
  // sweepers' score for the night.
  let { show }: { show: SweepShow } = $props();

  const god = $derived(show.kind === 'broomGod');
  const names = (list: readonly Sweeper[]) => list.map((p) => p.name).join(' & ');
  const from = $derived(show.from ?? { x: innerWidth / 2, y: innerHeight * 0.4 });
  const to = $derived(show.to ?? { x: innerWidth - 40, y: innerHeight - 160 });
  // The 13 sets, flying in from all round the edge to pile up under the broom.
  const sets = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2;
    return { x: Math.cos(a) * 70, y: Math.sin(a) * 70, i };
  });

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, settings.ms(ms)));
    const root = document.documentElement;
    if (god) {
      sound.choir();
      at(1000, () => (sound.impact(3), buzz('clinch')));
      at(2400, () => sound.stamp(7, true));
      at(3400, () => sound.combo(6));
      at(4000, () => sound.pip(12));
    } else {
      sound.scratch();
      buzz('clinch');
      // The table (not this overlay) turns upside down, then back (CSS in app.css).
      if (settings.motion) {
        at(150, () => root.classList.add('world-flipped'));
        at(2900, () => (root.classList.remove('world-flipped'), sound.whoosh()));
      }
      at(1400, () => sound.sweep());
      at(3000, () => sound.stamp(7, true));
      at(3400, () => sound.combo(6));
      at(4000, () => sound.pip(12));
    }
    return () => {
      timers.forEach(clearTimeout);
      root.classList.remove('world-flipped');
    };
  });
</script>

<div
  class="takeover {show.kind}"
  class:still={!settings.motion}
  role="status"
  style="--fx: {from.x}px; --fy: {from.y}px; --tx: {to.x - innerWidth / 2}px; --ty: {to.y - innerHeight * 0.66}px"
>
  <span class="sr">
    {god ? 'Broom God' : 'Dog Moorb'}: {names(show.winners)} swept all 13 sets against {names(show.losers)}. Plus {show.worth} games.
  </span>
  <div class="veil" aria-hidden="true"></div>

  {#if god}
    <div class="beam" aria-hidden="true"></div>
    <div class="stamp-copy" aria-hidden="true"><b>Sweeep</b><span>×13</span></div>
    <div class="pile" aria-hidden="true">
      {#each sets as s (s.i)}<i style="--sx: {s.x * 4}px; --sy: {s.y * 4}px; --d: {s.i * 40}ms"></i>{/each}
    </div>
    <div class="broom" aria-hidden="true">🧹</div>
    <div class="ring" aria-hidden="true"></div>
  {:else}
    <div class="stamp-copy fall" aria-hidden="true"><b>Sweeep</b><span>×13</span></div>
    <div class="dangle" aria-hidden="true">
      {#each show.losers as p, i (p.name)}
        <div class="hang {show.loserTeam}" style="--d: {i * 160}ms">
          <i class="string"></i>
          <span class="who-hang"><AnimalIcon animal={p.animal} size="1.6em" /> {p.name}</span>
        </div>
      {/each}
    </div>
    <div class="sweep-line" aria-hidden="true">
      <span class="badge">{show.contract} <small>LOST</small></span>
      <span class="broom flipped">🧹</span>
    </div>
  {/if}

  <div class="title" aria-hidden="true">
    <h2>{god ? 'Broom God' : 'Dog Moorb'}</h2>
    <p class="who">
      <span class="side {show.winnerTeam}">
        {#each show.winners as p (p.name)}<AnimalIcon animal={p.animal} size="1.2em" />{/each}
        {names(show.winners)}
      </span>
      <span class="verb">{god ? 'swept' : 'reverse-swept'}</span>
      <span class="side loser {show.loserTeam}">{names(show.losers)}</span>
    </p>
  </div>
  <div class="worth" aria-hidden="true">+{show.worth}</div>
</div>

<style>
  .takeover {
    --t: calc(5000ms * var(--speed));
    position: fixed;
    inset: 0;
    z-index: 80;
    overflow: hidden;
    pointer-events: none;
    animation: out var(--t) linear both;
  }
  /* Everything fades away over the last 0.4 s. */
  @keyframes out {
    0%,
    92% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .veil {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 40%, rgba(10, 8, 4, 0.55), rgba(0, 0, 0, 0.88));
    animation: fade-in calc(400ms * var(--speed)) ease-out both;
  }
  .dogMoorb .veil {
    background: radial-gradient(ellipse at 50% 40%, rgba(20, 8, 30, 0.5), rgba(0, 0, 0, 0.85));
  }

  /* The stamp, picked up where the real one landed. */
  .stamp-copy {
    position: absolute;
    left: var(--fx);
    top: var(--fy);
    translate: -50% -50%;
    display: grid;
    justify-items: center;
    padding: 5px 11px 4px;
    border: 3px solid #fff2c0;
    border-radius: 11px;
    background: rgba(70, 30, 6, 0.94);
    color: #fff;
    rotate: -8deg;
    scale: 1.18;
    box-shadow: 0 0 18px #fff2c0, 0 0 50px rgba(255, 190, 80, 1);
  }
  .stamp-copy b {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #fffbe8;
  }
  .stamp-copy span {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.2em;
  }
  /* Broom God: the beam lifts it up and away. */
  .broomGod .stamp-copy {
    animation: ascend calc(1100ms * var(--speed)) cubic-bezier(0.5, 0, 0.8, 0.4) calc(200ms * var(--speed)) both;
  }
  @keyframes ascend {
    to {
      top: -10vh;
      scale: 0.5;
      rotate: 0deg;
      opacity: 0;
    }
  }
  .beam {
    position: absolute;
    left: 50%;
    top: 0;
    width: 46vw;
    height: 62vh;
    translate: -50% 0;
    background: linear-gradient(180deg, rgba(255, 236, 170, 0.95), rgba(255, 210, 110, 0.55) 60%, rgba(255, 200, 90, 0));
    clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%);
    filter: blur(6px);
    transform-origin: top;
    animation:
      beam-down calc(700ms * var(--speed)) ease-out both,
      beam-glow calc(1400ms * var(--speed)) ease-in-out calc(700ms * var(--speed)) infinite alternate;
  }
  @keyframes beam-down {
    from {
      transform: scaleY(0);
      opacity: 0;
    }
  }
  @keyframes beam-glow {
    to {
      opacity: 0.7;
    }
  }
  /* The broom spins down out of the beam and plants itself in the middle. */
  .broom {
    position: absolute;
    left: 50%;
    top: 40%;
    font-size: 128px;
    line-height: 1;
    translate: -50% -50%;
    /* Stood upright, handle to the sky, once it lands. */
    rotate: -45deg;
    filter: drop-shadow(0 0 22px rgba(255, 215, 120, 0.95));
    animation: descend calc(900ms * var(--speed)) cubic-bezier(0.3, 0, 0.4, 1.35) calc(150ms * var(--speed)) both;
  }
  @keyframes descend {
    from {
      transform: translateY(-60vh) rotate(-720deg) scale(0.4);
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
  }
  .ring {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 40px;
    height: 40px;
    translate: -50% -50%;
    border: 4px solid #ffe6a0;
    border-radius: 50%;
    opacity: 0;
    animation: shock calc(700ms * var(--speed)) ease-out calc(1050ms * var(--speed)) both;
  }
  @keyframes shock {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(14);
    }
  }
  /* The 13 sets fly in from the edges and pile up under the broom. */
  .pile {
    position: absolute;
    left: 50%;
    top: 54%;
  }
  .pile i {
    position: absolute;
    width: 18px;
    height: 24px;
    margin: -12px 0 0 -9px;
    border-radius: 3px;
    background: linear-gradient(160deg, #fff6d0, #e7b94e);
    box-shadow: 0 0 10px rgba(255, 210, 110, 0.9);
    animation: to-pile calc(600ms * var(--speed)) cubic-bezier(0.3, 0.8, 0.4, 1) calc(1250ms * var(--speed) + var(--d) * var(--speed)) both;
  }
  .pile i:nth-child(odd) {
    rotate: 12deg;
  }
  .pile i:nth-child(3n) {
    rotate: -18deg;
  }
  @keyframes to-pile {
    from {
      transform: translate(var(--sx), var(--sy));
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
  }

  /* Dog Moorb: the stamp flips with the world and drops off the bottom. */
  .stamp-copy.fall {
    animation: fall calc(1000ms * var(--speed)) cubic-bezier(0.5, 0, 1, 0.5) calc(250ms * var(--speed)) both;
  }
  @keyframes fall {
    30% {
      rotate: 172deg;
      top: var(--fy);
    }
    to {
      rotate: 200deg;
      top: 120vh;
    }
  }
  /* The declarers dangle upside down from the top, swinging. */
  .dangle {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    display: flex;
    justify-content: center;
    gap: 22vw;
  }
  .hang {
    display: grid;
    justify-items: center;
    transform-origin: top center;
    animation:
      drop calc(500ms * var(--speed)) cubic-bezier(0.3, 1.4, 0.6, 1) calc(700ms * var(--speed) + var(--d) * var(--speed)) both,
      swing calc(900ms * var(--speed)) ease-in-out calc(1200ms * var(--speed)) 2 alternate,
      hang-off calc(400ms * var(--speed)) ease-in calc(2900ms * var(--speed)) forwards;
  }
  .string {
    width: 2px;
    height: 16vh;
    background: rgba(255, 255, 255, 0.55);
  }
  .who-hang {
    display: grid;
    justify-items: center;
    gap: 2px;
    rotate: 180deg;
    font-family: var(--font-name);
    font-size: 15px;
    color: #fff;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.45);
    border: 2px solid var(--c, #c9ced6);
  }
  .hang.red {
    --c: var(--team-red, #d23a3a);
  }
  @keyframes drop {
    from {
      transform: translateY(-40vh);
    }
  }
  @keyframes swing {
    from {
      rotate: -7deg;
    }
    to {
      rotate: 7deg;
    }
  }
  @keyframes hang-off {
    to {
      transform: translateY(-50vh);
      opacity: 0;
    }
  }
  /* The upside-down broom sweeps the swept contract off the screen. */
  .sweep-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 120px;
  }
  .sweep-line .badge {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    padding: 6px 14px;
    border-radius: 10px;
    background: #f4efe2;
    color: #1b1b1b;
    font: 800 30px var(--font-display, Georgia, serif);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
    animation:
      fade-in calc(300ms * var(--speed)) ease-out calc(900ms * var(--speed)) both,
      swept-away calc(700ms * var(--speed)) cubic-bezier(0.6, 0, 0.9, 0.5) calc(2000ms * var(--speed)) forwards;
  }
  .badge small {
    font-size: 14px;
    color: #c0392b;
    letter-spacing: 0.1em;
  }
  @keyframes swept-away {
    to {
      transform: translateX(-110vw) rotate(-30deg);
    }
  }
  .sweep-line .broom.flipped {
    position: absolute;
    top: 50%;
    left: 100%;
    font-size: 110px;
    line-height: 1;
    scale: 1 -1;
    translate: 0 -50%;
    animation: broom-across calc(1500ms * var(--speed)) cubic-bezier(0.45, 0, 0.6, 1) calc(1300ms * var(--speed)) both;
  }
  @keyframes broom-across {
    from {
      left: 105%;
      rotate: 10deg;
    }
    to {
      left: -40%;
      rotate: -25deg;
    }
  }

  /* The title and who swept whom, in team colours. */
  .title {
    position: absolute;
    left: 0;
    right: 0;
    top: 66%;
    display: grid;
    justify-items: center;
    gap: 8px;
    text-align: center;
    animation: title-in calc(450ms * var(--speed)) cubic-bezier(0.2, 1.5, 0.5, 1) calc(2400ms * var(--speed)) both;
  }
  .dogMoorb .title {
    animation-name: title-flip;
    animation-delay: calc(3000ms * var(--speed));
  }
  @keyframes title-in {
    from {
      transform: scale(2.4);
      opacity: 0;
    }
  }
  @keyframes title-flip {
    from {
      transform: rotate(180deg) scale(1.6);
      opacity: 0;
    }
  }
  .title h2 {
    margin: 0;
    font-size: 46px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #ffe7a3;
    text-shadow:
      0 0 16px rgba(255, 190, 80, 0.9),
      0 3px 0 #7a4a10;
  }
  .dogMoorb .title h2 {
    color: #e6d6ff;
    text-shadow:
      0 0 16px rgba(170, 120, 255, 0.9),
      0 3px 0 #3d1f66;
  }
  .who {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px 8px;
    padding: 0 16px;
    font-size: 15px;
    color: #f1f1f1;
  }
  .side {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    font-family: var(--font-name);
    font-weight: 700;
    border: 2px solid var(--c, #c9ced6);
    background: rgba(0, 0, 0, 0.45);
  }
  .side.red {
    --c: var(--team-red, #d23a3a);
  }
  .side.loser {
    opacity: 0.6;
    filter: grayscale(0.6);
  }
  .verb {
    font-style: italic;
    color: #ddd;
  }
  /* +10 / +100, then into the sweepers' score for the night. */
  .worth {
    position: absolute;
    left: 50%;
    top: 66%;
    translate: -50% 0;
    margin-top: 92px;
    font: 900 56px var(--font-card, Georgia, serif);
    color: #fff3c4;
    text-shadow: 0 0 20px rgba(255, 200, 90, 1);
    animation:
      worth-in calc(350ms * var(--speed)) cubic-bezier(0.2, 1.6, 0.5, 1) calc(3400ms * var(--speed)) both,
      worth-fly calc(600ms * var(--speed)) cubic-bezier(0.5, 0, 0.75, 0.4) calc(4000ms * var(--speed)) forwards;
  }
  @keyframes worth-in {
    from {
      transform: scale(3);
      opacity: 0;
    }
  }
  @keyframes worth-fly {
    to {
      transform: translate(var(--tx), var(--ty)) scale(0.3);
      opacity: 0.4;
    }
  }

  /* Reduced effects: nothing flies or flips; the words fade in where they are. */
  .still :is(.stamp-copy, .broom, .ring, .pile, .dangle, .sweep-line) {
    display: none;
  }
  .still :is(.beam, .title, .worth) {
    animation-name: fade-in;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
