<script lang="ts">
  import { AWARDS, momentsWall, playerStats, shares, winRate, type AwardKind, type ProfileInfo, type SavedNight, type Strain, type Suit as SuitT, type Carried } from '@dark/engine';
  import { profileOf } from '../lib/format';
  import { shortDate } from '../lib/history';
  import AnimalIcon from './AnimalIcon.svelte';
  import Highlight from './Highlight.svelte';
  import Suit from './Suit.svelte';

  // Spec S20, a player's card (Ryan's design): the award icons beside the name, four tall stat
  // tiles, the favourite bid suit and level side by side (the favourite as a headline, the rest
  // as one quiet line), the favourite partner, and their highlights (newest first, each with ▶).
  let {
    profile,
    profiles,
    nights,
    carried,
    onWatch,
    loading,
  }: {
    profile: string;
    profiles: readonly ProfileInfo[];
    nights: readonly SavedNight[];
    /** Totals carried forward from deleted games. */
    carried?: Carried;
    onWatch: (night: SavedNight, game: number) => void;
    loading: string | null;
  } = $props();

  const ids = $derived(profiles.map((p) => p.id));
  const s = $derived(playerStats(profile, ids, nights, carried));
  const name = (id: string) => profileOf(profiles, id).name;
  /** The animal someone picked most recently. */
  const animalOf = (id: string) => [...nights].sort((a, b) => b.startedAt - a.startedAt).find((n) => n.avatars?.[id])?.avatars?.[id]?.animal ?? null;
  const pct = (won: number, played: number) => (played ? Math.round((won / played) * 100) : 0);

  // Only the noteworthy awards, as icons with counts (Ryan).
  const CHIPS: AwardKind[] = ['wall', 'epicAttic', 'heist', 'daredevil', 'broomGod', 'dogMroob'];
  const chips = $derived(
    CHIPS.filter((k) => (s.awards[k] ?? 0) > 0).map((k) => ({ k, emoji: AWARDS[k].emoji, flip: !!AWARDS[k].flip, title: AWARDS[k].title, n: s.awards[k]! })),
  );

  const suits = $derived(shares(s.strains));
  const levels = $derived(shares(s.levels).filter((l) => l.pct > 0));
  const declared = $derived(s.declaring.won + s.declaring.lost);
  const RED: Strain[] = ['H', 'D'];
  // Their awards from every night (the top two a night, as on the night log).
  const highlights = $derived(momentsWall(nights, (k) => AWARDS[k as AwardKind]?.title ?? k, profile).flatMap((m) => m.awards.map((award) => ({ night: m.night, award }))));

  // Partners, best win rate first ("—" until 5 games together).
  const partners = $derived(
    s.partners
      .map((p) => ({ ...p, rate: winRate(p.won, p.played) }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.played - a.played),
  );
</script>

{#snippet strainMark(strain: Strain)}
  {#if strain === 'NT'}NT{:else}<span class="pip" class:red={RED.includes(strain)}><Suit suit={strain as SuitT} label={false} /></span>{/if}
{/snippet}

<section class="card hero" aria-label="{name(profile)}'s card">
  <span class="face"><AnimalIcon animal={animalOf(profile)} size="56px" /></span>
  <div>
    <div class="n">
      {name(profile)}
      {#each chips as c (c.k)}<span class="aw" title="{c.title} ×{c.n}"><span aria-hidden="true" style={c.flip ? 'display: inline-block; rotate: 180deg' : undefined}>{c.emoji}</span> <b>×{c.n}</b></span>{/each}
    </div>
    <div class="sub">{s.nights} {s.nights === 1 ? 'night' : 'nights'}{#if s.since}&nbsp;· since {shortDate(s.since)}{/if}</div>
  </div>
</section>

<div class="tiles">
  <div class="tile"><span class="k">Sets won</span><span class="v">{s.sets.won}</span><span class="s">of {s.sets.played} · {pct(s.sets.won, s.sets.played)}%</span></div>
  <div class="tile"><span class="k">Games won</span><span class="v">{s.games.won}</span><span class="s">of {s.games.played} · {pct(s.games.won, s.games.played)}%</span></div>
  <div class="tile"><span class="k">Declaring</span><span class="v">{s.declaring.won}–{s.declaring.lost}</span><span class="s">won–lost</span></div>
  <div class="tile"><span class="k">Defending</span><span class="v">{s.defending.won}–{s.defending.lost}</span><span class="s">won–lost</span></div>
</div>

<div class="faves">
  <section class="card fave">
    <h3>Fave bid suit</h3>
    {#if declared}
      <div class="head"><b class="big">{@render strainMark(suits[0]!.key)}</b><em>{suits[0]!.pct}%</em></div>
      <p class="rest">
        {#each suits.slice(1) as x, i (x.key)}{#if i}&nbsp;·&nbsp;{/if}<span class="item">{@render strainMark(x.key)} {x.pct}%</span>{/each}
      </p>
    {:else}<p class="rest">No contracts declared yet.</p>{/if}
  </section>
  <section class="card fave">
    <h3>Fave bid level</h3>
    {#if declared}
      <!-- The level as a little bid card (Ryan), the same size as the suit headline. -->
      <div class="head"><b class="lvl">{levels[0]!.key}</b><em>{levels[0]!.pct}%</em></div>
      <p class="rest">
        {#each levels.slice(1) as x, i (x.key)}{#if i}&nbsp;·&nbsp;{/if}<span class="item"><b class="mini">{x.key}</b> {x.pct}%</span>{/each}
      </p>
    {:else}<p class="rest">No contracts declared yet.</p>{/if}
  </section>
</div>

<h3 class="sec">Fave partner</h3>
<div class="partners">
  {#each partners as p, i (p.partner)}
    <div class="pt" class:top={i === 0 && p.rate !== null}>
      <AnimalIcon animal={animalOf(p.partner)} size="30px" />
      <span class="pn">{name(p.partner)}</span>
      <b>{p.rate === null ? '—' : `${p.rate}%`}</b>
      <small>{p.played} {p.played === 1 ? 'game' : 'games'}</small>
    </div>
  {/each}
</div>
<p class="note">Win % with each partner (once you've played 5 games together), and games played.</p>

<h3 class="sec">Highlights</h3>
{#if highlights.length}
  <div class="highlights">
    {#each highlights as h, i (i)}<Highlight award={h.award} night={h.night} {profiles} {onWatch} {loading} />{/each}
  </div>
{:else}<p class="note">No highlights yet.</p>{/if}

<style>
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px;
  }
  .hero {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
  }
  .face {
    display: grid;
  }
  .n {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font: 700 24px var(--font-name);
  }
  .aw {
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    font: 600 12.5px system-ui, sans-serif;
  }
  .aw b {
    color: var(--ink-dim);
    font-weight: 600;
  }
  .sub {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .tile {
    display: grid;
    gap: 4px;
    justify-items: center;
    padding: 10px 4px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    text-align: center;
  }
  .k {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .v {
    font: 700 24px var(--font-name);
    white-space: nowrap;
  }
  .s {
    font-size: 11px;
    color: var(--ink-dim);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .sec {
    margin: 14px 2px 8px;
  }
  /* The two favourites side by side (Ryan). */
  .faves {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }
  .fave {
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
  }
  .big {
    display: grid;
    font: 800 34px var(--font-card);
    line-height: 1;
  }
  .big .pip {
    width: 32px;
    height: 32px;
  }
  /* The favourite level as a little card-white bid tile, about the suit's height. */
  .lvl {
    display: grid;
    place-items: center;
    width: 30px;
    height: 38px;
    border-radius: 5px;
    background: var(--card);
    color: var(--card-ink);
    font: 800 22px var(--font-card);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
  }
  .head em {
    font: 700 24px var(--font-name);
    font-style: normal;
    color: var(--win);
  }
  .rest {
    margin: 8px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink-dim);
  }
  .item {
    white-space: nowrap;
    color: var(--ink-dim);
  }
  .pip {
    display: inline-grid;
    width: 0.95em;
    height: 0.95em;
    vertical-align: -0.1em;
    color: var(--ink);
  }
  .pip :global(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  .pip.red {
    color: var(--red-on-felt);
  }
  .mini {
    display: inline-grid;
    place-items: center;
    min-width: 13px;
    height: 16px;
    border-radius: 3px;
    background: var(--card);
    color: var(--card-ink);
    font: 800 10.5px var(--font-card);
  }
  .partners {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .pt {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .pt .pn {
    font: 700 13px var(--font-name);
  }
  .pt b {
    font: 700 18px var(--font-name);
  }
  .pt small {
    font-size: 11px;
    color: var(--ink-dim);
  }
  .pt.top {
    background: color-mix(in srgb, var(--win) 16%, var(--panel));
    box-shadow: inset 0 0 0 1.5px var(--win);
  }
  .pt.top b {
    color: var(--win);
  }
  .highlights {
    display: grid;
    gap: 6px;
  }
  .note {
    margin: 6px 2px 0;
    font-size: 12px;
    color: var(--ink-dim);
  }
</style>
