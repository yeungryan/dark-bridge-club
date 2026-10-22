<script lang="ts">
  import { AWARDS, momentsWall, type Award, type ProfileInfo, type SavedNight, type ThemeId } from '@dark/engine';
  import { shortDate } from '../lib/history';
  import { awardText } from '../lib/stories';
  import { themeOf } from '../lib/themes';
  import AnimalIcon from './AnimalIcon.svelte';

  // Spec S20, the moments wall (Ryan): every night's best moments, newest first, at most two a
  // night (Epic Attic, Heist Master, Daredevil, That's 10 Dollars, Heartbreak Hotel, then the
  // rest alphabetically), and filterable by player. ▶ opens the game it happened in.
  let {
    profiles,
    nights,
    onWatch,
    loading,
  }: { profiles: readonly ProfileInfo[]; nights: readonly SavedNight[]; onWatch: (night: SavedNight, game: number) => void; loading: string | null } = $props();

  let who = $state<string | null>(null);
  const wall = $derived(momentsWall(nights, (k) => AWARDS[k as keyof typeof AWARDS]?.title ?? k, who));
  const animalOf = (id: string) => [...nights].sort((a, b) => b.startedAt - a.startedAt).find((n) => n.avatars?.[id])?.avatars?.[id]?.animal ?? null;
  /** The game an award happened in, when it names one that can be replayed. */
  const gameOf = (night: SavedNight, a: { payload: Readonly<Record<string, unknown>> }) => {
    const n = Number(a.payload.dealNumber);
    return Number.isFinite(n) && night.games.some((g) => g.dealNumber === n && g.replayable) ? n : null;
  };
</script>

<div class="chips" role="group" aria-label="Whose moments">
  <button class="chip" class:on={who === null} aria-pressed={who === null} onclick={() => (who = null)}>Everyone</button>
  {#each profiles as p (p.id)}
    <button class="chip" class:on={who === p.id} aria-pressed={who === p.id} onclick={() => (who = p.id)}><AnimalIcon animal={animalOf(p.id)} size="18px" /> {p.name}</button>
  {/each}
</div>

{#each wall as { night, awards } (night.id)}
  {@const t = themeOf((night.theme ?? 'clubhouse') as ThemeId)}
  <p class="when">{shortDate(night.startedAt)} · {t.flag} {t.name}</p>
  {#each awards as a, i (i)}
    {@const text = awardText({ ...a, score: 0 } as unknown as Award, profiles)}
    {@const game = gameOf(night, a)}
    <article class="m">
      <span class="e" aria-hidden="true">{text.emoji}</span>
      <div>
        <div class="h">{text.headline}</div>
        <div class="l">{text.line}{#if game}&nbsp;· Game {game}{/if}</div>
      </div>
      {#if game}
        <button class="play" aria-label="Replay game {game}" disabled={loading !== null} onclick={() => onWatch(night, game)}>{loading === `${night.id}:${game}` ? '…' : '▶'}</button>
      {/if}
    </article>
  {/each}
{:else}
  <p class="muted">No moments yet{who ? ' for this player' : ''}.</p>
{/each}

<style>
  .chips {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
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
  .when {
    margin: 12px 2px 6px;
    font-size: 11.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .m {
    display: grid;
    grid-template-columns: 34px 1fr auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 6px;
    padding: 10px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .e {
    font-size: 24px;
    text-align: center;
  }
  .h {
    font-weight: 700;
  }
  .l {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .play {
    width: 34px;
    height: 34px;
    min-height: 0;
    padding: 0;
    border-radius: 50%;
  }
</style>
