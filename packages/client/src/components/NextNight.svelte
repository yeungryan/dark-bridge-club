<script lang="ts">
  import { stillToVote, type ProfileInfo } from '@dark/engine';
  import { onDestroy, onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { loadSchedule, type ScheduleState } from '../lib/schedule';
  import { countdown, slotLabel } from '../lib/when';

  // Spec S21 on the home screen: the next night's countdown once it's locked; otherwise how many
  // times are up for a vote and who hasn't voted yet (a gentle nudge, no messages sent).
  let { profiles, me, onOpen, refreshKey = 0 }: { profiles: readonly ProfileInfo[]; me: string; onOpen: () => void; refreshKey?: number } = $props();

  let data = $state<ScheduleState | null>(null);
  let now = $state(Date.now());
  const refresh = () =>
    loadSchedule()
      .then((s) => (data = s))
      .catch(() => {});
  let poll: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    void refresh();
    poll = setInterval(() => {
      now = Date.now();
      void refresh();
    }, 30_000);
  });
  onDestroy(() => clearInterval(poll));
  // Back from the scheduler: show what changed there.
  $effect(() => {
    if (refreshKey) void refresh();
  });

  const schedule = $derived(data?.schedule ?? null);
  const waiting = $derived(schedule && data ? stillToVote(schedule, data.players) : []);
  const name = (id: string) => (id === me ? 'you' : profileOf(profiles, id).name);
</script>

{#if schedule}
  <button class="next panel" class:on={!!schedule.locked} onclick={onOpen} aria-label="Next night">
    {#if schedule.locked}
      {@const when = slotLabel(schedule.locked.at)}
      <span class="kicker">Next night · {countdown(schedule.locked.at - now)}</span>
      <strong>{when.day} · {when.time}</strong>
    {:else if schedule.slots.length}
      <span class="kicker">Next night</span>
      <strong>{schedule.slots.length} {schedule.slots.length === 1 ? 'time' : 'times'} to vote on</strong>
      {#if waiting.length}<small>Waiting on {waiting.map(name).join(', ')}</small>{/if}
    {:else}
      <span class="kicker">Next night</span>
      <strong>📅 Plan the next one</strong>
    {/if}
    <span class="go" aria-hidden="true">›</span>
  </button>
{/if}

<style>
  .next {
    position: relative;
    display: grid;
    gap: 2px;
    width: 100%;
    margin-top: 18px;
    padding: 12px 34px 12px 14px;
    text-align: left;
    border-radius: 14px;
    color: var(--ink);
  }
  .next.on {
    box-shadow: 0 0 0 1.5px var(--accent), 0 0 18px var(--accent-glow);
  }
  .kicker {
    font-size: 11.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  strong {
    font-size: 1.05rem;
  }
  .on strong {
    color: var(--accent);
    font-family: var(--font-display);
    font-size: 1.2rem;
  }
  small {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .go {
    position: absolute;
    right: 14px;
    top: 50%;
    translate: 0 -50%;
    font-size: 1.4rem;
    color: var(--ink-dim);
  }
</style>
