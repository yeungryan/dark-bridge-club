<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import { airAttack, earthAttack, fireAttack, holdStill, waterAttack } from '../lib/juice/cardFx';
  import { clearEffects } from '../lib/juice/particles';
  import Card from './Card.svelte';
  import Particles from './Particles.svelte';

  // fxlab.html?set=attack: Ryan's round 8 mockups. The set's winner (bottom) attacks the three
  // losing cards, at the real size of the table's trick area (190px, cards 52px wide).
  const ROWS = [
    { id: 'fire', title: 'Fire · Ignite → burnt', note: 'Fireballs set the losers alight; they end charred' },
    { id: 'air', title: 'Air · Wind slash → sliced', note: 'Slashes cut the losers in two; the halves fly off' },
    { id: 'water', title: 'Water · Splash crown → pierced', note: 'Ripples under the card; jets punch holes through' },
    { id: 'earth', title: 'Earth · Boulder slam → toppled', note: 'Boulders knock the losers off the table' },
  ] as const;
  const one = new URLSearchParams(location.search).get('only');
  const rows = one ? ROWS.filter((r) => r.id === one) : ROWS;
  const SPOTS: { spot: string; card: CardT }[] = [
    { spot: 'bottom', card: { suit: 'S', rank: 14 } },
    { spot: 'left', card: { suit: 'S', rank: 9 } },
    { spot: 'top', card: { suit: 'S', rank: 12 } },
    { spot: 'right', card: { suit: 'D', rank: 4 } },
  ];
  let cells: HTMLElement[] = $state([]);
  let gen = $state(0);

  function play(i: number): void {
    const cell = cells[i]!;
    const cards = [...cell.querySelectorAll<HTMLElement>('.slot')];
    const [win, ...losers] = cards;
    const shake = (px: number) => cell.animate([0, 1, 2, 3, 4].map((k) => ({ transform: `translate(${k % 2 ? px : -px}px, ${(k % 3) - 1}px)` })).concat([{ transform: 'none' }]), { duration: 160 });
    const id = rows[i]!.id;
    if (id === 'fire') fireAttack(win!, losers);
    else if (id === 'air') airAttack(win!, losers);
    else if (id === 'water') waterAttack(win!, losers, cell.querySelector<HTMLElement>('.under')!);
    else earthAttack(win!, losers, shake);
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function reset(): Promise<void> {
    clearEffects();
    gen++;
    await wait(80);
  }
  async function playAll(): Promise<void> {
    for (let i = 0; i < rows.length; i++) {
      await reset();
      await wait(300);
      play(i);
      await wait(1700);
    }
  }
  (window as unknown as { fx: object }).fx = {
    count: rows.length,
    async still(i: number, ms: number) {
      await reset();
      play(i);
      await wait(ms);
      holdStill();
    },
    playAll,
  };
</script>

<Particles />
<main>
  <header>
    <h1>Set won · the element attacks the losing cards</h1>
    <button onclick={playAll}>Play all</button>
    <button onclick={reset}>Reset</button>
  </header>
  <div class="grid">
    {#each rows as r, i (r.id)}
      <section class="cell" bind:this={cells[i]}>
        <h2>{r.title}</h2>
        <p>{r.note}</p>
        {#key gen}
          <div class="area" role="button" tabindex="0" aria-label="Play {r.title}" onclick={() => play(i)} onkeydown={() => play(i)}>
            <div class="under"></div>
            {#each SPOTS as s (s.spot)}
              <div class="spot {s.spot}"><div class="slot"><Card card={s.card} width={52} /></div></div>
            {/each}
          </div>
        {/key}
      </section>
    {/each}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0a1f16;
    color: #f3ead2;
    font-family: system-ui, sans-serif;
  }
  main {
    padding: 16px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 18px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 300px);
    gap: 10px;
  }
  .cell {
    position: relative;
    height: 360px;
    border-radius: 14px;
    background: var(--felt-bg);
    overflow: hidden;
  }
  h2 {
    margin: 8px 10px 0;
    font-size: 14px;
  }
  p {
    margin: 2px 10px 0;
    font-size: 11px;
    opacity: 0.7;
  }
  .area {
    position: absolute;
    left: 50%;
    top: 58%;
    width: 190px;
    height: 190px;
    transform: translate(-50%, -50%);
  }
  .under {
    position: absolute;
    inset: 0;
  }
  .spot {
    position: absolute;
  }
  .slot {
    position: relative;
    line-height: 0;
    border-radius: 6px;
  }
  .bottom {
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
  }
  .top {
    left: 50%;
    top: 0;
    transform: translateX(-50%);
  }
  .left {
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  .right {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
</style>
