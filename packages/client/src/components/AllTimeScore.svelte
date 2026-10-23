<script lang="ts">
  import { countedNights, headToHead, pairKey, type MatchupRecord, type ProfileId, type ProfileInfo } from '@dark/engine';
  import { RED_ANCHOR } from '../lib/avatars';
  import { profileOf } from '../lib/format';
  import { loadHistoryShared, pairName } from '../lib/history';

  // Ryan (S1): one line under "Bridge Club", the all-time games won by the usual pairing (the
  // matchup played most), both numbers in white. Team black on the left, team red on the right.
  // Nothing shows before the first game.
  // Ryan (round 12): the same line, smaller, under "Game N" while you play (`small`). There it's
  // tonight's pairing (`pairs`), and it loads again whenever `refresh` changes, so the last game
  // counts once the next one starts.
  let {
    profiles,
    small = false,
    pairs = null,
    refresh = 0,
  }: { profiles: readonly ProfileInfo[]; small?: boolean; pairs?: readonly (readonly ProfileId[])[] | null; refresh?: unknown } = $props();

  let match = $state<MatchupRecord | null>(null);
  $effect(() => {
    void refresh;
    const tonight = pairs?.map((p) => pairKey(p));
    loadHistoryShared()
      .then((h) => {
        const board = headToHead(
          profiles.map((p) => p.id),
          countedNights(h.nights, h.statsFrom ?? null),
          h.overrides,
          h.carried,
        );
        const top = tonight
          ? board.find((m) => m.sides.every((s) => tonight.includes(pairKey(s.players))))
          : [...board].sort((a, b) => b.games - a.games || (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))[0];
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
    class:small
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
    /* Round 13 (Ryan): more room below, so "Tonight's table" groups with the picker instead. */
    margin: -12px 0 34px;
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
  /* Under "Game N" (1.05rem): the same line, a size down from the title. */
  .small {
    gap: 5px;
    margin: 1px 0 0;
    line-height: 1;
  }
  .small .tile {
    width: 12px;
    height: 13px;
    border-radius: 3px;
    font-size: 7.5px;
  }
  .small strong {
    font-size: 12px;
  }
  .small .dash {
    font-size: 9px;
  }
</style>
