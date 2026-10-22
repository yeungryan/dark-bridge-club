<script lang="ts">
  import type { Team } from '../lib/avatars';
  import { STAMP_PEAK } from '../lib/juice/streak';

  // A streak stamp (lib/juice/streak.ts): it slams down in the streaking pair's colour, holds
  // while the attack plays, then shrinks away into that pair's row on the scoreboard (dx, dy from
  // the middle of the table), landing as the "×n" there pops in. Hotter and bigger every step.
  let { n, name, team, dx, dy, holdMs, flyMs }: { n: number; name: string; team: Team; dx: number; dy: number; holdMs: number; flyMs: number } =
    $props();
  const level = $derived(Math.min(n, STAMP_PEAK));
</script>

<div class="fly" style="--dx: {dx}px; --dy: {dy}px; --hold: {holdMs}ms; --fly: {flyMs}ms" aria-hidden="true">
  <div class="stamp {team} l{level}">
    <b>{name}</b>
    <span>×{n}</span>
  </div>
</div>
<span class="sr" role="status">{name}: {n} sets in a row</span>

<style>
  .fly {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 6;
    translate: -50% -50%;
    pointer-events: none;
    animation: to-score var(--fly) cubic-bezier(0.5, 0, 0.75, 0.4) var(--hold) both;
  }
  @keyframes to-score {
    to {
      transform: translate(var(--dx), var(--dy)) scale(0.15);
      opacity: 0.2;
    }
  }
  .stamp {
    display: grid;
    justify-items: center;
    max-width: 150px;
    padding: 5px 11px 4px;
    border: 3px solid var(--edge);
    border-radius: 11px;
    background: var(--base);
    color: var(--ink);
    text-align: center;
    rotate: -8deg;
    scale: var(--size);
    box-shadow: 0 0 var(--glow-r) var(--glow);
    animation: slam calc(280ms * var(--speed)) cubic-bezier(0.2, 1.5, 0.5, 1) backwards;
  }
  @keyframes slam {
    from {
      scale: calc(var(--size) * 2.3);
      opacity: 0;
    }
  }
  .stamp b {
    font-size: 17px;
    font-weight: 900;
    line-height: 1.02;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--word);
    text-shadow: var(--word-glow, none);
  }
  .stamp span {
    margin-top: 2px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.2em;
    opacity: 0.9;
  }
  /* The two teams' own colours for the first steps. */
  .red {
    --edge: #d23a3a;
    --base: rgba(40, 8, 10, 0.9);
    --ink: #fff;
    --word: #ff6a5a;
    --glow: rgba(210, 58, 58, 0.6);
  }
  .black {
    --edge: #c9ccd6;
    --base: rgba(16, 17, 22, 0.92);
    --ink: #f1f3f8;
    --word: #e8ebf2;
    --glow: rgba(200, 205, 220, 0.45);
  }
  /* Then hotter for both: orange, amber, gold, and white-gold at the top. */
  .l3 { --size: 0.86; --glow-r: 12px; }
  .l4 { --size: 0.92; --glow-r: 18px; }
  .l5 { --size: 0.97; --glow-r: 24px; --edge: #ff7a3a; --word: #ff9a5a; --glow: rgba(255, 120, 50, 0.8); }
  .l6 { --size: 1.02; --glow-r: 28px; --edge: #ff9a3a; --word: #ffb06a; --glow: rgba(255, 145, 55, 0.85); }
  .l7 { --size: 1.06; --glow-r: 32px; --edge: #ffb040; --word: #ffc878; --glow: rgba(255, 170, 60, 0.9); --word-glow: 0 0 8px #ff8a30; }
  .l8 { --size: 1.1; --glow-r: 36px; --edge: #ffc860; --word: #ffd890; --glow: rgba(255, 190, 70, 0.95); --word-glow: 0 0 10px #ff9a30; }
  .l9 { --size: 1.14; --glow-r: 42px; --edge: #ffe08a; --word: #ffeab0; --glow: rgba(255, 205, 90, 1); --word-glow: 0 0 12px #ffb040; }
  .l10 {
    --size: 1.18;
    --glow-r: 50px;
    --edge: #fff2c0;
    --base: rgba(70, 30, 6, 0.94);
    --word: #fffbe8;
    --glow: rgba(255, 190, 80, 1);
    --word-glow: 0 0 12px #ffd070, 0 0 24px #ff9a30;
    box-shadow: 0 0 18px #fff2c0, 0 0 var(--glow-r) var(--glow);
  }
  /* Reduced effects: no slam, no flight; it fades in and out where it is. */
  :global(.fx-reduced) .stamp {
    animation: fade calc(200ms * var(--speed)) backwards;
  }
  :global(.fx-reduced) .fly {
    animation: fade-out var(--fly) var(--hold) both;
  }
  :global(.fx-off) .stamp,
  :global(.fx-off) .fly {
    animation: none;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
