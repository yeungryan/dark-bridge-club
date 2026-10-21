<script lang="ts">
  import { headToHead, partnershipRecords, winRate, type ProfileInfo, type SavedNight, type ThemeId } from '@dark/engine';
  import { onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { loadGame, loadNights, nightLine, pairName, shortDate } from '../lib/history';
  import { sound } from '../lib/juice/sound';
  import { savedReplay, type ReplayGame } from '../lib/replayGame';
  import { themeOf } from '../lib/themes';
  import CallText from './CallText.svelte';
  import Replay from './Replay.svelte';
  import TableScene from './TableScene.svelte';

  // Spec S20 (first part): the rivalry board (the three ways the four of you can pair up, and
  // every partnership's record) and the night log, where any saved game opens in the replay.
  let { profiles, me, theme, onClose }: { profiles: readonly ProfileInfo[]; me: string; theme: ThemeId; onClose: () => void } = $props();

  let nights = $state<SavedNight[] | null>(null);
  let failed = $state(false);
  let tab = $state<'rivals' | 'nights'>('rivals');
  let open = $state<string | null>(null);
  let replay = $state<ReplayGame | null>(null);
  let loadingGame = $state<string | null>(null);

  onMount(() => {
    loadNights()
      .then((n) => (nights = n))
      .catch(() => (failed = true));
  });

  const ids = $derived(profiles.map((p) => p.id));
  const board = $derived(nights ? headToHead(ids, nights) : []);
  const name = (id: string) => profileOf(profiles, id).name;

  // Every partnership (six of them): nights and games together.
  const partnerships = $derived(nights ? partnershipRecords(ids, nights) : []);

  const rate = (won: number, played: number) => {
    const r = winRate(won, played);
    return r === null ? '—' : `${r}%`;
  };

  async function watch(night: SavedNight, dealNumber: number) {
    const key = `${night.id}:${dealNumber}`;
    loadingGame = key;
    try {
      replay = savedReplay(await loadGame(night.id, dealNumber), me, profiles, theme);
      sound.flip();
    } catch {
      failed = true;
    } finally {
      loadingGame = null;
    }
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape' && !replay) onClose();
  }
</script>

<svelte:window onkeydown={key} />

<div class="history" role="dialog" aria-modal="true" aria-label="History">
  <TableScene {theme} />
  <header>
    <button class="ghost close" aria-label="Close the history" onclick={onClose}>✕</button>
    <h2>History</h2>
    <span></span>
  </header>
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={tab === 'rivals'} class:on={tab === 'rivals'} onclick={() => (tab = 'rivals')}>Rivals</button>
    <button role="tab" aria-selected={tab === 'nights'} class:on={tab === 'nights'} onclick={() => (tab = 'nights')}>Nights</button>
  </div>

  <div class="body">
    {#if failed}
      <p class="muted">Couldn't load the history. Try again in a moment.</p>
    {:else if !nights}
      <p class="muted">Loading…</p>
    {:else if tab === 'rivals'}
      <section aria-label="Head to head">
        <h3>Head to head</h3>
        {#each board as m, i (i)}
          {@const [a, b] = m.sides}
          <article class="match" class:fresh={m.nights === 0 && m.games === 0}>
            <div class="side">
              <span class="who">{pairName(profiles, a.players)}</span>
              <strong class="big">{a.nightsWon}</strong>
            </div>
            <span class="vs">vs</span>
            <div class="side right">
              <strong class="big">{b.nightsWon}</strong>
              <span class="who">{pairName(profiles, b.players)}</span>
            </div>
            <p class="sub">
              {#if m.nights === 0 && m.games === 0}
                Never played this way round
              {:else}
                {m.nights} {m.nights === 1 ? 'night' : 'nights'} · games {a.gamesWon}–{b.gamesWon}{#if m.lastPlayed}
                  · last {shortDate(m.lastPlayed)}{/if}
              {/if}
            </p>
          </article>
        {/each}
      </section>
      <section aria-label="Partnerships">
        <h3>Partnerships</h3>
        <table>
          <thead><tr><th></th><th>Nights</th><th>Games</th><th>Win</th></tr></thead>
          <tbody>
            {#each partnerships as p (p.pair.join())}
              <tr class:mine={p.pair.includes(me)}>
                <th scope="row">{name(p.pair[0])} & {name(p.pair[1])}</th>
                <td>{p.nightsWon}/{p.nights}</td>
                <td>{p.gamesWon}/{p.games}</td>
                <td>{rate(p.gamesWon, p.games)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="note">Won/played. A win rate shows once a partnership has 5 games behind it.</p>
      </section>
    {:else}
      <section aria-label="Night log">
        {#if nights.length === 0}<p class="muted">No nights yet.</p>{/if}
        {#each nights as night (night.id)}
          {@const t = themeOf((night.theme ?? 'clubhouse') as ThemeId)}
          <article class="night" class:open={open === night.id}>
            <button class="night-head" aria-expanded={open === night.id} onclick={() => (open = open === night.id ? null : night.id)}>
              <span class="when">{shortDate(night.startedAt)} · {t.flag} {t.name}</span>
              <strong>{nightLine(night, profiles)}</strong>
              <span class="pairs">{pairName(profiles, night.pairs.A)} vs {pairName(profiles, night.pairs.B)}</span>
            </button>
            {#if open === night.id}
              <ol class="games">
                {#each night.games as g (g.dealNumber)}
                  <li>
                    <span class="n">Game {g.dealNumber}</span>
                    {#if g.contract}
                      <span class="what"
                        ><CallText call={{ type: 'bid', level: g.contract.level, strain: g.contract.strain }} />
                        {#if night.seating}by {name(night.seating[g.contract.declarer])}{/if}
                        · {g.result?.winner === 'declarers' ? 'made' : 'defeated'}{#if g.result?.overUnder}
                          ({g.result.overUnder > 0 ? '+' : ''}{g.result.overUnder}){/if}</span
                      >
                    {:else}
                      <span class="what muted">Passed out</span>
                    {/if}
                    {#if g.replayable}
                      <button
                        class="watch"
                        aria-label="Replay game {g.dealNumber}"
                        disabled={loadingGame !== null}
                        onclick={() => watch(night, g.dealNumber)}>{loadingGame === `${night.id}:${g.dealNumber}` ? '…' : '▶'}</button
                      >
                    {/if}
                  </li>
                {:else}
                  <li class="muted">No games finished.</li>
                {/each}
              </ol>
            {/if}
          </article>
        {/each}
      </section>
    {/if}
  </div>
</div>

{#if replay}<Replay game={replay} onClose={() => (replay = null)} />{/if}

<style>
  .history {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 8px;
    max-width: 720px;
    margin: 0 auto;
    padding: 8px 12px 0;
    background: var(--felt-bg, var(--felt));
    animation: fade-in calc(200ms * var(--speed));
  }
  header {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
  }
  h2 {
    margin: 0;
    text-align: center;
    font-size: 1.15rem;
  }
  .close {
    min-height: 40px;
    font-size: 1.1rem;
  }
  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 110px;
    padding: 4px;
    border-radius: 12px;
    background: var(--panel);
  }
  .tabs button {
    min-height: 38px;
    border: 0;
    background: none;
    color: var(--ink-dim);
    font-weight: 700;
  }
  .tabs button.on {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
  section {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  h3 {
    margin: 4px 0 0;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  /* A matchup: the two pairs with their nights won between them, like a score. */
  .match {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .match.fresh {
    opacity: 0.6;
  }
  .side {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .who {
    font-family: var(--font-name);
    font-weight: 700;
    font-size: 14px;
    line-height: 1.2;
  }
  .side.right .who {
    text-align: right;
  }
  .big {
    font-family: var(--font-display);
    font-size: 1.9rem;
    line-height: 1;
    color: var(--accent);
  }
  .vs {
    font-size: 11px;
    color: var(--ink-dim);
    text-transform: uppercase;
  }
  .sub {
    grid-column: 1 / -1;
    margin: 0;
    text-align: center;
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    background: var(--panel);
    border-radius: 14px;
    overflow: hidden;
  }
  th,
  td {
    padding: 8px 10px;
    text-align: right;
  }
  thead th {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  tbody th {
    text-align: left;
    font-family: var(--font-name);
    font-weight: 700;
  }
  tbody tr + tr {
    border-top: 1px solid var(--line);
  }
  tr.mine th {
    color: var(--accent);
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-dim);
  }
  /* The night log: one card per night; tap it for its games. */
  .night {
    border-radius: 14px;
    background: var(--panel);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .night-head {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    background: none;
    text-align: left;
    color: var(--ink);
  }
  .when,
  .pairs {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .games {
    list-style: none;
    margin: 0;
    padding: 0 12px 10px;
    display: grid;
    gap: 4px;
  }
  .games li {
    display: grid;
    grid-template-columns: 4.6em 1fr 40px;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    min-height: 40px;
    border-top: 1px solid var(--line);
  }
  .n {
    color: var(--ink-dim);
  }
  .what {
    font-family: var(--font-card);
  }
  .watch {
    min-height: 36px;
    padding: 0;
  }
</style>
