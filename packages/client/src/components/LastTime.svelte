<script lang="ts">
  import { lastNight, type ProfileInfo, type SavedNight, type ThemeId } from '@dark/engine';
  import { onMount } from 'svelte';
  import { loadHistory, nightLine, pairName, shortDate, topAwardOf } from '../lib/history';
  import { awardText } from '../lib/stories';
  import { themeOf } from '../lib/themes';

  // Spec S20: as a night begins, a card recalls the last one: when and where, who won, and its
  // headline award, so tonight picks up where that left off. Nothing shows before the first night.
  let { profiles, me, onHistory }: { profiles: readonly ProfileInfo[]; me: string; onHistory: () => void } = $props();

  let last = $state<SavedNight | null>(null);
  // History changes (offline nights) still waiting for your OK.
  let needsMe = $state(0);
  onMount(() => {
    loadHistory()
      .then((h) => {
        last = lastNight(h.nights);
        needsMe = h.pending.filter((p) => !p.approvals.includes(me)).length;
      })
      .catch(() => {});
  });

  const loser = (n: SavedNight) => (n.final?.winner === 'A' ? 'B' : 'A');
</script>

{#if needsMe}
  <button class="ask panel" onclick={onHistory}>📝 {needsMe} history {needsMe === 1 ? 'change needs' : 'changes need'} your OK ›</button>
{/if}
{#if last}
  {@const t = themeOf((last.theme ?? 'clubhouse') as ThemeId)}
  {@const award = topAwardOf(last)}
  <section class="last panel" aria-label="Last time">
    <p class="when">Last time · {shortDate(last.startedAt)} · {#if last.offline}offline{:else}{t.flag} {t.name}{/if}</p>
    <strong class="line">{nightLine(last, profiles)}</strong>
    {#if last.final && last.final.winner !== 'tie'}
      <span class="vs">over {pairName(profiles, last.pairs[loser(last)])}</span>
    {/if}
    {#if award}
      {@const text = awardText(award, profiles)}
      <p class="award"><span aria-hidden="true">{text.emoji}</span> <b>{text.headline}</b> {text.line}</p>
    {/if}
    <button class="ghost more" onclick={onHistory}>History &amp; rivals ›</button>
  </section>
{/if}

<style>
  .ask {
    width: 100%;
    margin-top: 18px;
    padding: 10px 14px;
    border-radius: 14px;
    text-align: left;
    font-weight: 650;
    color: var(--ink);
    box-shadow: 0 0 0 1.5px var(--accent);
  }
  .last {
    display: grid;
    gap: 3px;
    margin-top: 18px;
    padding: 12px 14px;
    text-align: left;
    border-radius: 14px;
    animation: fade-in calc(300ms * var(--speed));
  }
  .when {
    margin: 0;
    font-size: 11.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .line {
    font-family: var(--font-display);
    font-size: 1.15rem;
    color: var(--accent);
  }
  .vs {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .award {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .award b {
    color: var(--ink);
  }
  .more {
    justify-self: start;
    min-height: 36px;
    margin-top: 4px;
    padding: 0 10px;
    font-size: 13.5px;
  }
</style>
