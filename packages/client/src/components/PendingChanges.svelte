<script lang="ts">
  import type { PendingChange, ProfileInfo, SavedNight } from '@dark/engine';
  import { profileOf } from '../lib/format';
  import { pairName, sendChange, shortDate, type HistoryData } from '../lib/history';
  import { sound } from '../lib/juice/sound';

  // Changes to the all-time history waiting for everyone's OK (Ryan): add an offline night, or
  // take one back out. It applies once all four approve; anyone can turn it down.
  let {
    profiles,
    me,
    pending,
    nights,
    onUpdate,
  }: { profiles: readonly ProfileInfo[]; me: string; pending: readonly PendingChange[]; nights: readonly SavedNight[]; onUpdate: (d: HistoryData) => void } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);
  const name = (id: string) => (id === me ? 'you' : profileOf(profiles, id).name);

  function describe(p: PendingChange): string {
    if (p.change.kind === 'add') {
      const n = p.change.night;
      return `Add an offline night: ${shortDate(n.playedAt)} · ${pairName(profiles, n.pairs.A)} ${n.wins.A}–${n.wins.B} ${pairName(profiles, n.pairs.B)}`;
    }
    const id = p.change.nightId;
    const n = nights.find((x) => x.id === id);
    return n?.offline
      ? `Take out the offline night of ${shortDate(n.startedAt)} (${n.offline.wins.A}–${n.offline.wins.B})`
      : 'Take out an offline night';
  }

  async function act(type: 'approve' | 'reject', id: string) {
    busy = true;
    error = null;
    try {
      onUpdate(await sendChange({ type, id }));
      sound.tap();
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
    } finally {
      busy = false;
    }
  }
</script>

{#if pending.length}
  <section class="pending" aria-label="Changes waiting for approval">
    <h3>Waiting for everyone's OK</h3>
    {#each pending as p (p.id)}
      {@const waiting = profiles.map((x) => x.id).filter((id) => !p.approvals.includes(id))}
      <article class="change panel">
        <p class="what">{describe(p)}</p>
        <p class="who">
          {p.proposedBy === me ? 'You proposed' : `${name(p.proposedBy)} proposed`} · {p.approvals.length} of {profiles.length} OK{#if waiting.length}
            · waiting on {waiting.map(name).join(', ')}{/if}
        </p>
        <div class="row">
          {#if !p.approvals.includes(me)}
            <button class="primary" disabled={busy} onclick={() => act('approve', p.id)}>Approve</button>
            <button disabled={busy} onclick={() => act('reject', p.id)}>Turn down</button>
          {:else}
            <button class="ghost" disabled={busy} onclick={() => act('reject', p.id)}>{p.proposedBy === me ? 'Withdraw' : 'Turn down'}</button>
          {/if}
        </div>
      </article>
    {/each}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  .pending {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  h3 {
    margin: 4px 0 0;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .change {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  p {
    margin: 0;
  }
  .what {
    font-weight: 650;
  }
  .who {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    min-height: 40px;
    flex: 1;
  }
  .error {
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
</style>
