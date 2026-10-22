<script lang="ts">
  import { animalRecords, awardCounts, AWARDS, elementRecords, leaderboard, playerStats, type AwardKind, type Element, type LeaderStat, type ProfileInfo, type SavedNight, type Carried } from '@dark/engine';
  import { elementArt } from '../lib/animalArt';
  import { profileOf } from '../lib/format';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S20, "All" (Ryan's design): the leaderboard as four champion cards (LB2), the award
  // tracker as big-number tiles (T5), then animals and elements.
  let { profiles, nights, carried }: { profiles: readonly ProfileInfo[]; nights: readonly SavedNight[]; carried?: Carried } = $props();

  const ids = $derived(profiles.map((p) => p.id));
  const all = $derived(ids.map((id) => playerStats(id, ids, nights, carried)));
  const board = $derived(leaderboard(all));
  const name = (id: string) => profileOf(profiles, id).name;
  const animalOf = (id: string) => [...nights].sort((a, b) => b.startedAt - a.startedAt).find((n) => n.avatars?.[id])?.avatars?.[id]?.animal ?? null;

  const STATS: { key: LeaderStat; label: string }[] = [
    { key: 'sets', label: 'Sets won' },
    { key: 'games', label: 'Games won' },
    { key: 'declaring', label: 'Declaring W–L' },
    { key: 'defending', label: 'Defending W–L' },
  ];

  // The award tracker (Ryan): each award with what it means in a few words. Three show at a
  // time; swipe left past Heist Master for the two sweeps (round 10).
  const TRACKED: { kind: AwardKind; means: string }[] = [
    { kind: 'epicAttic', means: 'Bid 4+ and won.' },
    { kind: 'daredevil', means: 'Bid with <8 HCP and won.' },
    { kind: 'heist', means: 'Stood by with <8 HCP and still won.' },
    { kind: 'broomGod', means: 'Bid and swept all sets.' },
    { kind: 'dogMroob', means: 'Stood by and still swept all sets.' },
  ];

  const animals = $derived(animalRecords(ids, nights, carried));
  const ELEMENTS: Element[] = ['fire', 'water', 'air', 'earth'];
  const elements = $derived(elementRecords(ids, nights, carried));
  const bestOf = (pct: Record<Element, number | null>) => Math.max(-1, ...ELEMENTS.map((e) => pct[e] ?? -1));
</script>

<h3>Leaderboard</h3>
<div class="lb">
  {#each STATS as st (st.key)}
    {@const rows = board[st.key]}
    <div class="champ">
      <span class="k">{st.label}</span>
      <span class="lead"><AnimalIcon animal={animalOf(rows[0]!.profile)} size="28px" /> {name(rows[0]!.profile)} <b>{rows[0]!.value}</b></span>
      <!-- 2nd and 3rd on one line, 4th on the next (Ryan). -->
      <span class="rest">
        {#each rows.slice(1, 3) as r, i (r.profile)}{#if i}&nbsp;·&nbsp;{/if}<span class="nowrap">{name(r.profile)} {r.value}</span>{/each}
        {#if rows[3]}<br /><span class="nowrap">{name(rows[3].profile)} {rows[3].value}</span>{/if}
      </span>
    </div>
  {/each}
</div>
<p class="note">Declaring and Defending rank by games played in that role.</p>

<h3>Awards</h3>
<div class="awards" aria-label="Awards (swipe for more)">
  {#each TRACKED as t (t.kind)}
    {@const counts = awardCounts(t.kind, all)}
    {@const lead = counts[0]!}
    <div class="award">
      <span class="wm" class:flip={AWARDS[t.kind].flip} aria-hidden="true">{AWARDS[t.kind].emoji}</span>
      <span class="an">{AWARDS[t.kind].title}</span>
      <span class="means">{t.means}</span>
      <span class="x">{lead.count}</span>
      <span class="who">
        {#if lead.count}<AnimalIcon animal={animalOf(lead.profile)} size="20px" /> {name(lead.profile)}{:else}No one yet{/if}
      </span>
      <span class="others">{counts.slice(1).map((c) => `${name(c.profile)} ${c.count}`).join(' · ')}</span>
    </div>
  {/each}
</div>

<h3>Animals</h3>
<div class="card">
  <div class="an-row head"><span></span><span>Most picked</span><span>Luckiest</span></div>
  {#each animals as a (a.profile)}
    <div class="an-row">
      <b>{name(a.profile)}</b>
      <span>{#if a.mostPicked}<AnimalIcon animal={a.mostPicked.animal} size="20px" /> ×{a.mostPicked.nights}{:else}—{/if}</span>
      <span>{#if a.luckiest}<AnimalIcon animal={a.luckiest.animal} size="20px" /> {a.luckiest.pct}%{:else}—{/if}</span>
    </div>
  {/each}
  <p class="note">Luckiest: the best share of games won, among animals picked for at least 5 games.</p>
</div>

<h3>Elements</h3>
<div class="card">
  <table>
    <thead><tr><th></th>{#each ELEMENTS as e (e)}<th><img src={elementArt(e)} alt={e} /></th>{/each}</tr></thead>
    <tbody>
      {#each elements as r (r.profile)}
        {@const best = bestOf(r.pct)}
        <tr>
          <th scope="row">{name(r.profile)}</th>
          {#each ELEMENTS as e (e)}<td class:best={r.pct[e] !== null && r.pct[e] === best}>{r.pct[e] === null ? '—' : `${r.pct[e]}%`}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">Games won with each element. Gold: each player's best. "—" until 5 games.</p>
</div>

<style>
  h3 {
    margin: 14px 2px 8px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  h3:first-child {
    margin-top: 4px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px;
  }
  .note {
    margin: 6px 2px 0;
    font-size: 12px;
    color: var(--ink-dim);
  }
  /* LB2: a gold card per stat, its leader big. */
  .lb {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .champ {
    display: grid;
    gap: 4px;
    padding: 10px;
    border-radius: 14px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--win) 22%, transparent), rgba(0, 0, 0, 0.35) 60%);
    border: 1px solid color-mix(in srgb, var(--win) 50%, transparent);
    min-width: 0;
  }
  .champ .k {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--win);
  }
  .lead {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 700 15px var(--font-name);
  }
  .lead b {
    margin-left: auto;
    font-size: 19px;
    white-space: nowrap;
  }
  .rest {
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--ink-dim);
  }
  .nowrap {
    white-space: nowrap;
  }
  /* T5: the count as a huge number, the award's icon large behind it. Three tiles across, the
     rest a swipe away. Every tile shares one set of rows (subgrid), so the big numbers, leaders
     and runners-up line up however long each description is (Ryan, round 10). */
  .awards {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 16px) / 3);
    grid-template-rows: repeat(5, auto);
    column-gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .awards::-webkit-scrollbar {
    display: none;
  }
  .award {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-row: span 5;
    grid-template-rows: subgrid;
    align-content: start;
    row-gap: 2px;
    scroll-snap-align: start;
    min-height: 168px;
    padding: 10px 8px;
    border-radius: 14px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .award > * {
    position: relative;
  }
  .wm {
    position: absolute;
    right: -14px;
    top: 18px;
    font-size: 72px;
    line-height: 1;
    opacity: 0.25;
  }
  /* Dog Mroob's broom, upside down. */
  .flip {
    rotate: 180deg;
  }
  /* One line each (Ryan, round 10: the sweeps are Broom God and Dog Mroob so they fit). */
  .an {
    font: 700 12px var(--font-name);
    color: var(--win);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .means {
    font-size: 10.5px;
    line-height: 1.3;
    color: var(--ink-dim);
  }
  .x {
    margin-top: 6px;
    font: 800 44px var(--font-name);
    line-height: 1;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font: 700 12.5px var(--font-name);
  }
  .others {
    font-size: 10px;
    line-height: 1.4;
    color: var(--ink-dim);
  }
  .an-row {
    display: grid;
    grid-template-columns: 64px 1fr 1fr;
    gap: 6px;
    align-items: center;
    margin: 6px 0;
    font-size: 13px;
  }
  .an-row span {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .an-row.head span {
    font-size: 11.5px;
    color: var(--ink-dim);
  }
  .an-row b {
    font-family: var(--font-name);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    padding: 6px 4px;
    text-align: center;
  }
  thead img {
    width: 22px;
    height: 22px;
  }
  tbody th {
    text-align: left;
    font-family: var(--font-name);
  }
  tbody tr + tr > * {
    border-top: 1px solid var(--line);
  }
  td.best {
    color: var(--win);
    font-weight: 700;
  }
</style>
