<script lang="ts">
  import { clearEffects, freeze } from '../lib/juice/particles';
  import { CURRENT_OTHERS, SET_FX, type FxOption } from '../lib/juice/setFxOptions';
  import Card from './Card.svelte';
  import Particles from './Particles.svelte';

  // fxlab.html: the set-win effects review (Ryan, round 8). ?set=current shows every effect as
  // it plays now; ?set=fire (air, water, earth…) shows one effect now beside its three options.
  // Tap a card to play it; "Play all" plays them one after another.
  const set = new URLSearchParams(location.search).get('set') ?? 'current';
  const rows = set === 'current' ? [...SET_FX, ...CURRENT_OTHERS].map((r) => ({ ...r.options[0]!, title: r.title })) : SET_FX.find((r) => r.id === set)!.options.map((o) => ({ ...o, title: `${o.label} · ${o.name}` }));
  let cells: HTMLElement[] = $state([]);
  let playing = $state<number | null>(null);

  function play(i: number): void {
    const el = cells[i]!;
    const card = el.querySelector('.slot')!.getBoundingClientRect();
    const o: FxOption = rows[i]!;
    o.play(card.left + card.width / 2, card.top + card.height / 2);
    if (o.shake) el.animate([0, 1, 2, 3, 4, 5].map((k) => ({ transform: `translate(${k % 2 ? o.shake : -o.shake}px, ${(k % 3) - 1}px)` })).concat([{ transform: 'none' }]), { duration: 180 });
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function playAll(): Promise<void> {
    for (let i = 0; i < rows.length; i++) {
      playing = i;
      await wait(250);
      play(i);
      await wait(1400);
    }
    playing = null;
  }
  // For the screenshots: play one cell, then hold everything still `at` ms in.
  (window as unknown as { fx: object }).fx = {
    count: rows.length,
    async still(i: number, at: number) {
      clearEffects();
      await wait(60);
      play(i);
      await wait(at);
      freeze(1e7);
    },
    playAll,
  };
</script>

<Particles />
<main>
  <header>
    <h1>{set === 'current' ? 'Set-win effects · now' : SET_FX.find((r) => r.id === set)!.title}</h1>
    <button onclick={playAll}>Play all</button>
  </header>
  <div class="grid" class:wide={rows.length > 4}>
    {#each rows as r, i (i)}
      <section class="cell" class:on={playing === i} bind:this={cells[i]}>
        <h2>{r.title}</h2>
        {#if r.note}<p>{r.note}</p>{/if}
        <button class="slot" aria-label="Play {r.title}" onclick={() => play(i)}><Card card={{ suit: 'S', rank: 14 }} width={58} /></button>
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
    gap: 12px;
  }
  h1 {
    margin: 0 0 10px;
    font-size: 18px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 250px);
    gap: 10px;
  }
  .grid.wide {
    grid-template-columns: repeat(5, 250px);
  }
  .cell {
    position: relative;
    height: 320px;
    border-radius: 14px;
    background: var(--felt-bg);
    overflow: hidden;
    outline: 2px solid transparent;
  }
  .cell.on {
    outline-color: #e8c25a;
  }
  h2 {
    margin: 8px 10px 0;
    font-size: 14px;
  }
  p {
    margin: 2px 10px 0;
    font-size: 11px;
    line-height: 1.3;
    opacity: 0.7;
  }
  .slot {
    position: absolute;
    left: 50%;
    top: 62%;
    transform: translate(-50%, -50%);
    padding: 0;
    border: 0;
    background: none;
  }
</style>
