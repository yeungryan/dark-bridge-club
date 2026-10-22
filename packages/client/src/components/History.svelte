<script lang="ts">
  import { AWARDS, countedNights, emptyCarried, headToHead, momentsWall, partnershipRecords, winRate, type PendingChange, type ProfileInfo, type SavedNight, type ScoreOverride, type ThemeId, type Carried } from '@dark/engine';
  import { onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { loadGame, loadHistory, nightLine, pairName, shortDate, type HistoryData } from '../lib/history';
  import { sound } from '../lib/juice/sound';
  import { savedReplay, type ReplayGame } from '../lib/replayGame';
  import { themeOf } from '../lib/themes';
  import CallText from './CallText.svelte';
  import Replay from './Replay.svelte';
  import TableScene from './TableScene.svelte';
  import PendingChanges from './PendingChanges.svelte';
  import ScoreEditor from './ScoreEditor.svelte';
  import PlayerCard from './PlayerCard.svelte';
  import AllPlayers from './AllPlayers.svelte';
  import Highlight from './Highlight.svelte';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S20: the rivalry board (the three ways the four of you can pair up, and every
  // partnership's record), the players (everyone's leaderboard, awards, animals and elements, or
  // one player's card), and the night log: each night with its two highlights (Ryan: the moments
  // wall lives here now), where any saved game opens in the replay.
  let { profiles, me, theme, onClose }: { profiles: readonly ProfileInfo[]; me: string; theme: ThemeId; onClose: () => void } = $props();

  let nights = $state<SavedNight[] | null>(null);
  let overrides = $state<ScoreOverride[]>([]);
  let pending = $state<PendingChange[]>([]);
  let carried = $state<Carried>(emptyCarried());
  let statsFrom = $state<number | null>(null);
  // The matchup whose score is being changed (Ryan: set by hand, with everyone's OK).
  let editing = $state<number | null>(null);
  const update = (d: HistoryData) => {
    nights = d.nights;
    overrides = d.overrides;
    pending = d.pending;
    carried = d.carried ?? emptyCarried();
    statsFrom = d.statsFrom ?? null;
  };
  let failed = $state(false);
  let tab = $state<'rivals' | 'players' | 'nights'>('rivals');
  // Players: "All", or one player's card.
  let player = $state<string | null>(null);
  let open = $state<string | null>(null);
  let replay = $state<ReplayGame | null>(null);
  let loadingGame = $state<string | null>(null);

  onMount(() => {
    loadHistory()
      .then(update)
      .catch(() => (failed = true));
  });

  const ids = $derived(profiles.map((p) => p.id));
  // Each night's top two awards, by night id.
  const highlights = $derived(new Map((nights ? momentsWall(nights, (k) => AWARDS[k as keyof typeof AWARDS]?.title ?? k) : []).map((m) => [m.night.id, m.awards])));
  // The all-time numbers: nights since the last reset to 0–0, plus what was carried forward from
  // deleted games. The night log still lists every night kept.
  const counted = $derived(nights ? countedNights(nights, statsFrom) : []);
  const board = $derived(nights ? headToHead(ids, counted, overrides, carried) : []);
  const name = (id: string) => profileOf(profiles, id).name;

  // Every partnership (six of them): nights and games together.
  const partnerships = $derived(nights ? partnershipRecords(ids, counted, overrides, carried) : []);

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
    <button role="tab" aria-selected={tab === 'players'} class:on={tab === 'players'} onclick={() => (tab = 'players')}>Players</button>
    <button role="tab" aria-selected={tab === 'nights'} class:on={tab === 'nights'} onclick={() => (tab = 'nights')}>Nights</button>
  </div>

  <div class="body">
    {#if failed}
      <p class="muted">Couldn't load the history. Try again in a moment.</p>
    {:else if !nights}
      <p class="muted">Loading…</p>
    {:else}
      <PendingChanges {profiles} {me} {pending} {board} onUpdate={update} />
      {#if tab === 'rivals'}
      <section aria-label="Head to head">
        <h3>Head to head</h3>
        {#each board as m, i (i)}
          {@const [a, b] = m.sides}
          <article class="match" class:fresh={m.nights === 0 && m.games === 0 && editing !== i}>
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
              {#if m.setAt}<br /><span class="set">Score agreed by all four on {shortDate(m.setAt)}</span>{/if}
            </p>
            {#if editing === i}
              <ScoreEditor {profiles} match={m} onUpdate={update} onCancel={() => (editing = null)} />
            {:else}
              <button class="ghost edit" aria-label="Change the score: {pairName(profiles, a.players)} vs {pairName(profiles, b.players)}" onclick={() => (editing = i)}
                >✏️ Change score</button
              >
            {/if}
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
    {:else if tab === 'players'}
      <section aria-label="Players">
        <div class="chips" role="group" aria-label="Whose card">
          <button class="chip" class:on={player === null} aria-pressed={player === null} onclick={() => (player = null)}>All</button>
          {#each profiles as p (p.id)}
            {@const animal = [...nights].sort((a, b) => b.startedAt - a.startedAt).find((n) => n.avatars?.[p.id])?.avatars?.[p.id]?.animal ?? null}
            <button class="chip" class:on={player === p.id} aria-pressed={player === p.id} onclick={() => (player = p.id)}><AnimalIcon {animal} size="18px" /> {p.name}</button>
          {/each}
        </div>
        {#if player}
          <PlayerCard profile={player} {profiles} nights={counted} {carried} onWatch={watch} loading={loadingGame} />
        {:else}
          <AllPlayers {profiles} nights={counted} {carried} />
        {/if}
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
            <!-- The night's two highlights, by Ryan's priority (outside the header button: no nested buttons). -->
            {#if highlights.has(night.id)}
              <div class="highlights">
                {#each highlights.get(night.id)! as award, i (i)}
                  <Highlight {award} {night} {profiles} onWatch={watch} loading={loadingGame} />
                {/each}
              </div>
            {/if}
            {#if open === night.id}
              <ol class="games">
                {#each night.games as g (g.dealNumber)}
                  <li>
                    <span class="n">Game {g.dealNumber}</span>
                    {#if g.contract}
                      <span class="what"
                        ><CallText call={{ type: 'bid', level: g.contract.level, strain: g.contract.strain }} />
                        {#if g.seating ?? night.seating}by {name((g.seating ?? night.seating)![g.contract.declarer])}{/if}
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
    grid-template-columns: repeat(3, 1fr);
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
  .highlights {
    display: grid;
    gap: 6px;
    padding: 0 10px 10px;
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
  .set {
    font-size: 11.5px;
    color: var(--accent);
  }
  .edit {
    grid-column: 1 / -1;
    justify-self: center;
    min-height: 32px;
    padding: 0 10px;
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .chips {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: none;
    color: var(--ink);
    font-size: 13px;
    white-space: nowrap;
  }
  .chip.on {
    background: var(--ink);
    color: #141414;
    border-color: var(--ink);
  }
  .watch {
    min-height: 36px;
    padding: 0;
  }
</style>
