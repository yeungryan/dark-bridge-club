<script lang="ts">
  import { MAX_PER_PROPOSAL, stillToVote, type ProfileInfo, type Slot, type ThemeId, type Vote } from '@dark/engine';
  import { onDestroy, onMount } from 'svelte';
  import { profileOf } from '../lib/format';
  import { ribbons } from '../lib/juice/particles';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { downloadIcs, loadSchedule, myZone, sendSchedule, shareLink, type ScheduleState } from '../lib/schedule';
  import { cssColor } from '../lib/themes';
  import { countdown, inviteText, quickTimes, slotLabel, theirTime } from '../lib/when';
  import TableScene from './TableScene.svelte';

  // Spec S21, the next-game scheduler: propose a few evenings, everyone marks Yes / Maybe / No,
  // and the first time all four say Yes locks: confetti, a calendar file and a countdown.
  // Messenger stays the way you nudge each other ("Copy invite"); nothing sends messages.
  let { profiles, me, theme, onClose }: { profiles: readonly ProfileInfo[]; me: string; theme: ThemeId; onClose: () => void } = $props();

  let data = $state<ScheduleState | null>(null);
  let failed = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let proposing = $state(false);
  let picked = $state<number[]>([]);
  let custom = $state('');
  let copied = $state(false);
  let lockCard = $state<HTMLElement>();
  let now = $state(Date.now());

  const zone = myZone();
  const schedule = $derived(data?.schedule ?? null);
  const players = $derived(data?.players ?? profiles.map((p) => p.id));
  const waiting = $derived(schedule ? stillToVote(schedule, players) : []);
  const name = (id: string) => profileOf(profiles, id).name;
  const picks = $derived(quickTimes(now));

  // A new lock (by anyone) gets the celebration, once.
  let wasLocked: string | null | undefined;
  $effect(() => {
    const locked = schedule?.locked?.id ?? null;
    if (wasLocked === null && locked) celebrate();
    if (schedule) wasLocked = locked;
  });

  function celebrate() {
    sound.fanfare();
    if (!settings.motion) return;
    setTimeout(() => {
      const r = lockCard?.getBoundingClientRect();
      if (r) ribbons(r.left + r.width / 2, r.top + r.height / 3, 90, [cssColor('--accent', '#e8c25a'), cssColor('--card', '#fbf8f0'), '#5fd6d0', '#ff7a5c']);
    }, 120);
  }

  async function refresh() {
    try {
      data = await loadSchedule();
      failed = false;
    } catch {
      failed = data === null;
    }
  }

  // Votes from the others arrive by checking every so often while this is open.
  let poll: ReturnType<typeof setInterval> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    void refresh();
    poll = setInterval(refresh, 15_000);
    tick = setInterval(() => (now = Date.now()), 30_000);
  });
  onDestroy(() => {
    clearInterval(poll);
    clearInterval(tick);
  });

  async function send(action: Parameters<typeof sendSchedule>[0]) {
    if (busy) return;
    busy = true;
    error = null;
    try {
      data = await sendSchedule(action);
      return true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'That didn’t go through.';
      return false;
    } finally {
      busy = false;
    }
  }

  function vote(slot: Slot, v: Vote) {
    sound.tap();
    void send({ type: 'vote', slot: slot.id, vote: v });
  }

  function togglePick(at: number) {
    sound.tap();
    picked = picked.includes(at) ? picked.filter((t) => t !== at) : picked.length < MAX_PER_PROPOSAL ? [...picked, at] : picked;
  }

  function addCustom() {
    if (!custom) return;
    const at = new Date(custom).getTime(); // a datetime-local value is read in this phone's zone
    if (Number.isFinite(at) && !picked.includes(at) && picked.length < MAX_PER_PROPOSAL) picked = [...picked, at].sort((a, b) => a - b);
    custom = '';
  }

  async function propose() {
    if (!picked.length) return;
    if (await send({ type: 'propose', times: picked, zone })) {
      picked = [];
      proposing = false;
      sound.stamp(2, true);
    }
  }

  async function copyInvite() {
    if (!schedule) return;
    try {
      await navigator.clipboard.writeText(inviteText(schedule, shareLink(), zone));
      copied = true;
      sound.tap();
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = 'Couldn’t copy on this phone.';
    }
  }

  const VOTE_LABEL: Record<Vote, string> = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
  const VOTE_ICON: Record<Vote, string> = { yes: '✓', maybe: '?', no: '✕' };

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={key} />

<div class="scheduler" role="dialog" aria-modal="true" aria-label="Next night">
  <TableScene {theme} />
  <header>
    <button class="ghost close" aria-label="Close the scheduler" onclick={onClose}>✕</button>
    <h2>Next night</h2>
    <span></span>
  </header>

  <div class="body">
    {#if failed}
      <p class="muted">Couldn't load the plans. Try again in a moment.</p>
    {:else if !schedule}
      <p class="muted">Loading…</p>
    {:else if schedule.locked}
      {@const when = slotLabel(schedule.locked.at)}
      <!-- All four said Yes. -->
      <section class="locked panel" bind:this={lockCard} aria-label="The next night is on">
        <p class="kicker">🎉 Game on</p>
        <strong class="day">{when.day}</strong>
        <strong class="time">{when.time}</strong>
        <p class="count">{countdown(schedule.locked.at - now)}</p>
        <div class="row">
          <button class="primary" onclick={() => downloadIcs(schedule.locked!, shareLink())}>📅 Add to calendar</button>
          <button onclick={copyInvite}>{copied ? 'Copied!' : '💬 Copy invite'}</button>
        </div>
        <button class="ghost small" onclick={() => send({ type: 'unlock' })}>Plans changed? Reopen voting</button>
      </section>
    {:else}
      {#if waiting.length}
        <p class="nudge">Waiting on {waiting.map((id) => (id === me ? 'you' : name(id))).join(', ')}</p>
      {/if}
      {#if schedule.slots.length === 0 && !proposing}
        <p class="empty">No times yet. Propose a few evenings and everyone votes.</p>
      {/if}
      <ol class="slots">
        {#each schedule.slots as slot (slot.id)}
          {@const when = slotLabel(slot.at)}
          {@const theirs = theirTime(slot, zone)}
          {@const mine = slot.votes[me]}
          <li class="slot panel">
            <div class="when">
              <strong>{when.day} · {when.time}</strong>
              <small>{slot.proposedBy === me ? 'You' : name(slot.proposedBy)}{#if theirs}&nbsp;· {theirs} their time{/if}</small>
            </div>
            <div class="votes" role="group" aria-label="Your vote for {when.day} {when.time}">
              {#each ['yes', 'maybe', 'no'] as const as v (v)}
                <button class="vote {v}" class:on={mine === v} aria-pressed={mine === v} disabled={busy} onclick={() => vote(slot, v)}
                  ><span aria-hidden="true">{VOTE_ICON[v]}</span> {VOTE_LABEL[v]}</button
                >
              {/each}
            </div>
            <div class="who" aria-label="Votes so far">
              {#each players as id (id)}
                {@const v = slot.votes[id]}
                <span class="voter {v ?? 'none'}" title="{name(id)}: {v ? VOTE_LABEL[v] : 'not yet'}" aria-label="{name(id)}: {v ? VOTE_LABEL[v] : 'not yet'}"
                  >{name(id)[0]}</span
                >
              {/each}
              {#if slot.proposedBy === me}
                <button class="ghost withdraw" aria-label="Take back {when.day} {when.time}" onclick={() => send({ type: 'withdraw', slot: slot.id })}>Take back</button>
              {/if}
            </div>
          </li>
        {/each}
      </ol>

      {#if proposing}
        <!-- Propose: tap a few evenings (or add a custom time), then Propose. -->
        <section class="propose panel" aria-label="Propose times">
          <p class="label">Pick up to {MAX_PER_PROPOSAL} evenings</p>
          <div class="chips">
            {#each picks as at (at)}
              {@const l = slotLabel(at)}
              <button class="chip" class:on={picked.includes(at)} aria-pressed={picked.includes(at)} onclick={() => togglePick(at)}>
                <span>{l.day}</span><small>{l.time}</small>
              </button>
            {/each}
          </div>
          <div class="custom">
            <input type="datetime-local" bind:value={custom} aria-label="Another day and time" />
            <button onclick={addCustom} disabled={!custom}>Add</button>
          </div>
          {#if picked.some((t) => !picks.includes(t))}
            <p class="extra">
              Also: {picked
                .filter((t) => !picks.includes(t))
                .map((t) => `${slotLabel(t).day} ${slotLabel(t).time}`)
                .join(' · ')}
            </p>
          {/if}
          <div class="row">
            <button class="ghost" onclick={() => ((proposing = false), (picked = []))}>Cancel</button>
            <button class="primary" disabled={!picked.length || busy} onclick={propose}>Propose {picked.length || ''}</button>
          </div>
        </section>
      {:else}
        <div class="row">
          <button class="primary" onclick={() => (proposing = true)}>＋ Propose times</button>
          <button onclick={copyInvite} disabled={!schedule.slots.length}>{copied ? 'Copied!' : '💬 Copy invite'}</button>
        </div>
      {/if}
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
</div>

<style>
  .scheduler {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: grid;
    grid-template-rows: auto 1fr;
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
  .body {
    display: grid;
    align-content: start;
    gap: 12px;
    padding: 110px 0 max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  p {
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .row button {
    min-height: 48px;
  }
  .nudge,
  .empty {
    text-align: center;
    font-size: 14px;
    color: var(--ink-dim);
  }
  /* The night is on: the date big, a countdown, then the calendar and the invite. */
  .locked {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 20px 16px 14px;
    text-align: center;
    border-radius: 18px;
    box-shadow: 0 0 0 1.5px var(--accent), 0 0 28px var(--accent-glow);
  }
  .kicker {
    font-size: 13px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .day {
    font-family: var(--font-display);
    font-size: 1.9rem;
    color: var(--accent);
  }
  .time {
    font-size: 1.3rem;
  }
  .count {
    margin: 4px 0 10px;
    color: var(--ink-dim);
  }
  .locked .row {
    width: 100%;
    grid-template-columns: 1fr;
  }
  .small {
    min-height: 36px;
    margin-top: 6px;
    font-size: 13px;
  }
  /* The times to vote on. */
  .slots {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .slot {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
  }
  .when {
    display: grid;
    gap: 2px;
  }
  .when strong {
    font-size: 1.05rem;
  }
  .when small {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
  .votes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .vote {
    min-height: 42px;
    padding: 0 4px;
    font-size: 14px;
    font-weight: 650;
  }
  .vote.on.yes {
    background: #3f9d5a;
    border-color: #3f9d5a;
    color: #fff;
  }
  .vote.on.maybe {
    background: #c99a2e;
    border-color: #c99a2e;
    color: #1c1405;
  }
  .vote.on.no {
    background: color-mix(in srgb, var(--ink) 30%, transparent);
    color: var(--ink);
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .voter {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    font-family: var(--font-name);
    font-size: 12px;
    font-weight: 800;
    border: 1.5px dashed var(--line);
    color: var(--ink-dim);
  }
  .voter.yes {
    border: 0;
    background: #3f9d5a;
    color: #fff;
  }
  .voter.maybe {
    border: 0;
    background: #c99a2e;
    color: #1c1405;
  }
  .voter.no {
    border-style: solid;
    text-decoration: line-through;
    opacity: 0.6;
  }
  .withdraw {
    margin-left: auto;
    min-height: 30px;
    padding: 0 8px;
    font-size: 12.5px;
  }
  /* Proposing. */
  .propose {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
  }
  .label {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 6px;
  }
  .chip {
    display: grid;
    gap: 1px;
    min-height: 50px;
    padding: 4px;
    font-size: 13.5px;
    font-weight: 650;
  }
  .chip small {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-dim);
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .chip.on small {
    color: inherit;
  }
  .custom {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
  }
  .custom input {
    min-height: 42px;
    min-width: 0;
  }
  .extra {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .error {
    text-align: center;
    color: var(--bad, #ff7a5c);
    font-size: 14px;
  }
</style>
