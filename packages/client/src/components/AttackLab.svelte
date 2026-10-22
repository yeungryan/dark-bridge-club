<script lang="ts">
  import type { Card as CardT } from '@dark/engine';
  import { airAttack, at, earthAttack, fireAttack, holdStill, waterAttack } from '../lib/juice/cardFx';
  import { clearEffects } from '../lib/juice/particles';
  import { SUB_SETS } from '../lib/juice/subFx';
  import { FINISH, powerUp } from '../lib/juice/finishFx';
  import { sound, __renderSequenceForTest } from '../lib/juice/sound';
  import Card from './Card.svelte';
  import Particles from './Particles.svelte';

  // fxlab.html?set=attack: Ryan's round 8 mockups. The set's winner (bottom) attacks the three
  // losing cards, at the real size of the table's trick area (190px, cards 52px wide).
  const ROWS = [
    { id: 'fire', title: 'Fire · Ignite → burnt', note: 'Fireballs set the losers alight; they end charred' },
    { id: 'air', title: 'Air · Wind slash → sliced', note: 'Slashes cut the losers in two; the halves stay, parted' },
    { id: 'water', title: 'Water · Splash crown → pierced', note: 'Ripples under the card; jets punch holes, the cards wither' },
    { id: 'earth', title: 'Earth · Boulder slam → holed', note: 'A giant boulder punches a hole through each loser' },
  ] as const;
  // ?set=attack: batch 1 (the four elements). ?set=lightning, sound, ice, metal: batch 2, each
  // now beside its three options.
  const params = new URLSearchParams(location.search);
  const sub = SUB_SETS[params.get('set') ?? ''];
  const one = params.get('only');
  // ?set=picks: Ryan's eight picks together (batch 1's four, then batch 2's chosen options).
  const PICKS: [string, number][] = [
    ['lightning', 1],
    ['sound', 1],
    ['ice', 2],
    ['metal', 1],
  ];
  // ?set=finish1 / finish2: the game-winning set for batch 1's / batch 2's picks: the attack,
  // then that element's finisher.
  const finish = params.get('set') === 'finish1' ? 1 : params.get('set') === 'finish2' ? 2 : 0;
  const picks = params.get('set') === 'picks' || finish > 0;
  const rows: { id: string; title: string; note: string; i?: number; sub?: string }[] = picks
    ? [
        ...(finish === 2 ? [] : ROWS),
        ...(finish === 1 ? [] : PICKS).map(([k, i]) => ({ id: `${k}${i}`, title: `${SUB_SETS[k]!.title.split(' (')[0]} · ${SUB_SETS[k]!.options[i]!.name}`, note: SUB_SETS[k]!.options[i]!.note, i, sub: k })),
      ]
    : sub
      ? sub.options.map((o, i) => ({ id: `sub${i}`, title: `${o.label} · ${o.name}`, note: o.note, i }))
      : one
        ? ROWS.filter((r) => r.id === one)
        : [...ROWS];
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
    const ctx = { under: cell.querySelector<HTMLElement>('.under')!, shake };
    if (finish) {
      const key = rows[i]!.sub ?? id;
      powerUp(win!);
      at(1000, () => FINISH[key]?.(win!, losers, ctx));
    }
    if (rows[i]!.sub) SUB_SETS[rows[i]!.sub!]!.options[rows[i]!.i!]!.play(win!, losers, ctx);
    else if (sub) sub.options[rows[i]!.i!]!.play(win!, losers, ctx);
    else if (id === 'fire') fireAttack(win!, losers);
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
  // For the videos: log every sound with when it played, then render the log offline (the same
  // chain as live) into a WAV to lay under the screen recording. A white flash marks time zero.
  const log: [string, unknown[], number][] = [];
  let rendering = false;
  const S = sound as unknown as Record<string, (...a: unknown[]) => void>;
  for (const name of Object.keys(S)) {
    const orig = S[name]!;
    S[name] = (...a: unknown[]) => {
      if (!rendering) log.push([name, a, performance.now()]);
      orig(...a);
    };
  }
  let flash = $state(false);
  async function syncFlash(): Promise<number> {
    flash = true;
    const t0 = performance.now();
    await wait(120);
    flash = false;
    return t0;
  }
  function wav(ch: Float32Array[], rate: number): string {
    const n = ch[0]!.length;
    const buf = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    buf.setUint32(4, 36 + n * 4, true);
    str(8, 'WAVEfmt ');
    buf.setUint32(16, 16, true);
    buf.setUint16(20, 1, true);
    buf.setUint16(22, 2, true);
    buf.setUint32(24, rate, true);
    buf.setUint32(28, rate * 4, true);
    buf.setUint16(32, 4, true);
    buf.setUint16(34, 16, true);
    str(36, 'data');
    buf.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 2; c++) buf.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c]![i]!)) * 32767, true);
    let bin = '';
    const bytes = new Uint8Array(buf.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  (window as unknown as { fx: object }).fx = {
    /** Play everything once (or `rounds` times), after a white flash; return each sound and
     *  when it played, in seconds from the flash. */
    async record(rounds = 1) {
      log.length = 0;
      const t0 = await syncFlash();
      await wait(400);
      for (let r = 0; r < rounds; r++) await playAll();
      return log.map(([n, a, t]) => [n, a, (t - t0) / 1000]);
    },
    /** Render timed sounds offline into a WAV (base64). */
    async render(steps: [string, unknown[], number][], seconds: number) {
      rendering = true;
      try {
        return wav(await __renderSequenceForTest(steps, seconds, 44100), 44100);
      } finally {
        rendering = false;
      }
    },
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
{#if flash}<div class="sync"></div>{/if}
<main>
  <header>
    <h1>{finish ? `Game-winning set · batch ${finish}: the attack, then the finisher` : sub ? sub.title : picks ? 'Your picks · set won, with sound' : 'Set won · the element attacks the losing cards'}</h1>
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
    row-gap: 10px;
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
  .sync {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #fff;
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
