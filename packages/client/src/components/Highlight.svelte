<script lang="ts">
  import type { Award, ProfileInfo, SavedAward, SavedNight } from '@dark/engine';
  import { awardText } from '../lib/stories';

  // One highlight (an award from a night): its icon, headline and line, and ▶ to replay the game
  // it happened in, when it names one that was played out.
  let {
    award,
    night,
    profiles,
    onWatch,
    loading,
  }: { award: SavedAward; night: SavedNight; profiles: readonly ProfileInfo[]; onWatch: (night: SavedNight, game: number) => void; loading: string | null } = $props();

  const text = $derived(awardText({ ...award, score: 0 } as unknown as Award, profiles));
  const game = $derived.by(() => {
    const n = Number(award.payload.dealNumber);
    return Number.isFinite(n) && night.games.some((g) => g.dealNumber === n && g.replayable) ? n : null;
  });
</script>

<div class="m">
  <span class="e" aria-hidden="true">{text.emoji}</span>
  <div>
    <div class="h">{text.headline}</div>
    <div class="l">{text.line}{#if game}&nbsp;· Game {game}{/if}</div>
  </div>
  {#if game}
    <button class="play" aria-label="Replay game {game}" disabled={loading !== null} onclick={() => onWatch(night, game!)}>{loading === `${night.id}:${game}` ? '…' : '▶'}</button>
  {/if}
</div>

<style>
  .m {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
  }
  .e {
    font-size: 22px;
    text-align: center;
  }
  .h {
    font-weight: 700;
    font-size: 14px;
  }
  .l {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .play {
    width: 32px;
    height: 32px;
    min-height: 0;
    padding: 0;
    border-radius: 50%;
  }
</style>
