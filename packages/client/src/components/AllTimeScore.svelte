<script lang="ts">
  import { countedNights, headToHead, type MatchupRecord, type ProfileInfo } from '@dark/engine';
  import { RED_ANCHOR } from '../lib/avatars';
  import { onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { loadHistoryShared, pairName } from '../lib/history';

  // Ryan (S1): one line under "Bridge Club", the all-time games won by the usual pairing (the
  // matchup played most), both numbers in white. Team black on the left, team red on the right.
  // Nothing shows before the first game.
  let { profiles }: { profiles: readonly ProfileInfo[] } = $props();

  let match = $state<MatchupRecord | null>(null);
  onMount(() => {
    loadHistoryShared()
      .then((h) => {
        const board = headToHead(
          profiles.map((p) => p.id),
          countedNights(h.nights, h.statsFrom ?? null),
          h.overrides,
          h.carried,
        );
        const top = [...board].sort((a, b) => b.games - a.games || (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0];
        match = top && top.games > 0 ? top : null;
      })
      .catch(() => {});
  });

  // Team red is the pair with Ryan in it.
  const sides = $derived(
    match ? [match.sides.find((s) => !s.players.includes(RED_ANCHOR)), match.sides.find((s) => s.players.includes(RED_ANCHOR))].filter((s) => !!s) : [],
  );
</script>

{#if match && sides.length === 2}
  {@const [black, red] = sides}
  <p
    class="score"
    aria-label="All-time games won: {pairName(profiles, black!.players)} {black!.gamesWon}, {pairName(profiles, red!.players)} {red!.gamesWon}"
  >
    <span class="pair" aria-hidden="true">
      {#each black!.players as id (id)}<i class="tile black">{profileOf(profiles, id).name[0]}</i>{/each}
    </span>
    <strong aria-hidden="true">{black!.gamesWon}</strong>
    <span class="dash" aria-hidden="true">–</span>
    <strong aria-hidden="true">{red!.gamesWon}</strong>
    <span class="pair" aria-hidden="true">
      {#each red!.players as id (id)}<i class="tile red">{profileOf(profiles, id).name[0]}</i>{/each}
    </span>
  </p>
{/if}

<style>
  .score {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: -12px 0 18px;
  }
  .pair {
    display: inline-flex;
    gap: 2px;
  }
  .tile {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 20px;
    border-radius: 4px;
    font: 800 11px Georgia, serif;
    font-style: normal;
    color: #fff;
  }
  .tile.black {
    background: var(--team-black, #161616);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.75);
  }
  .tile.red {
    background: var(--team-red, #d23a3a);
  }
  strong {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .dash {
    color: var(--ink-dim);
    font-size: 12px;
  }
</style>
