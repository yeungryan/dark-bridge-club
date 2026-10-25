<script lang="ts">
  import type { SweepShow } from '../lib/juice/sweep';
  import StreakStamp from './StreakStamp.svelte';
  import SweepTakeover from './SweepTakeover.svelte';

  // A preview of the sweep takeovers (round 15) on a stand-in table: lab.html?set=sweeps.
  // Each plays as in a game: the "SWEEEP ×13" stamp lands, then grows into the takeover.
  let stamp = $state<{ id: number; team: 'red' | 'black' } | null>(null);
  let show = $state<SweepShow | null>(null);
  let id = 0;
  let area: HTMLElement;
  let score: Record<'black' | 'red', HTMLElement> = $state({}) as Record<'black' | 'red', HTMLElement>;

  const RED = [
    { name: 'Adrian', animal: 'eagle' },
    { name: 'Ryan', animal: 'shark' },
  ];
  const BLACK = [
    { name: 'Darren', animal: 'raccoon' },
    { name: 'Kim', animal: 'tiger' },
  ];
  const centre = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function play(kind: SweepShow['kind'], team: 'red' | 'black') {
    show = null;
    stamp = { id: ++id, team };
    const other = team === 'red' ? 'black' : 'red';
    setTimeout(() => {
      stamp = null;
      show = {
        id: ++id,
        kind,
        winners: team === 'red' ? RED : BLACK,
        losers: team === 'red' ? BLACK : RED,
        winnerTeam: team,
        loserTeam: other,
        worth: kind === 'broomGod' ? 10 : 100,
        contract: kind === 'broomGod' ? '4♠' : '2♥',
        from: centre(area),
        to: centre(score[team]),
      };
      setTimeout(() => (show = null), 5200);
    }, 700);
  }
</script>

<main class="lab">
  <h1>Sweep takeovers</h1>
  <p class="muted">As in a game: the SWEEEP ×13 stamp lands, then the takeover. Sound on.</p>
  <div class="buttons">
    <button onclick={() => play('broomGod', 'red')}>🧹 Broom God · red sweeps</button>
    <button onclick={() => play('broomGod', 'black')}>🧹 Broom God · black sweeps</button>
    <button onclick={() => play('dogMoorb', 'red')}>🙃 Dog Moorb · red sweeps</button>
    <button onclick={() => play('dogMoorb', 'black')}>🙃 Dog Moorb · black sweeps</button>
  </div>
  <!-- A stand-in table, so Dog Moorb has something to turn upside down. -->
  <div class="table">
    <div class="seat top">Kim</div>
    <div class="seat left">Adrian</div>
    <div class="seat right">Ryan</div>
    <div class="area" bind:this={area}>
      {#if stamp}{#key stamp.id}<StreakStamp n={13} name="Sweeep" team={stamp.team} dx={0} dy={0} holdMs={2000} flyMs={0} />{/key}{/if}
    </div>
    <div class="seat bottom">Darren</div>
    <div class="board panel">
      <div class="row"><b class="red">A·R</b><span class="series" bind:this={score.red}>3</span></div>
      <div class="row"><b>D·K</b><span class="series" bind:this={score.black}>2</span></div>
    </div>
  </div>
</main>
{#if show}{#key show.id}<SweepTakeover {show} />{/key}{/if}

<style>
  .lab {
    max-width: 420px;
    margin: 0 auto;
    padding: 16px;
  }
  h1 {
    margin: 0 0 4px;
  }
  .buttons {
    display: grid;
    gap: 8px;
    margin: 12px 0;
  }
  .table {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: auto 220px auto auto;
    align-items: center;
    justify-items: center;
    gap: 8px;
  }
  .seat {
    font-family: var(--font-name);
    font-size: 18px;
  }
  .top {
    grid-column: 2;
  }
  .left {
    grid-column: 1;
    grid-row: 2;
  }
  .right {
    grid-column: 3;
    grid-row: 2;
  }
  .area {
    position: relative;
    grid-column: 2;
    grid-row: 2;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: var(--felt, #1d5b3f);
    border: 6px solid #6b4a2b;
  }
  .bottom {
    grid-column: 2;
    grid-row: 3;
  }
  .board {
    grid-column: 1 / -1;
    grid-row: 4;
    width: 100%;
    display: grid;
    gap: 6px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .red {
    color: var(--team-red, #d23a3a);
  }
  .series {
    display: grid;
    place-items: center;
    min-width: 28px;
    height: 22px;
    border: 1px solid var(--line);
    border-radius: 5px;
    font-weight: 800;
  }
</style>
