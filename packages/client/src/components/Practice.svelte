<script lang="ts">
  import { PRACTICE_PROFILES, PracticeTable } from '../lib/practice.svelte';
  import Game from './Game.svelte';

  // practice.html: you against three bots, all in this browser. Nothing is sent to the
  // server or recorded. ?as=darren (etc.) to sit as someone else; Ryan by default.
  const asked = new URLSearchParams(location.search).get('as') ?? 'ryan';
  const me = PRACTICE_PROFILES.some((p) => p.id === asked) ? asked : 'ryan';
  const table = new PracticeTable(me);
</script>

<div class="tag">Practice · not recorded · <a href="lab.html">sound check</a></div>
<Game link={table} onSignedOut={() => {}} />

<style>
  .tag {
    position: fixed;
    bottom: max(2px, env(safe-area-inset-bottom));
    right: 8px;
    z-index: 30;
    font-size: 11px;
    color: var(--ink-dim);
    opacity: 0;
    pointer-events: none;
    /* Shown for a few seconds, then out of the way of the hand. */
    animation: tag 6s ease-out;
  }
  @keyframes tag {
    0%,
    80% {
      opacity: 0.9;
      pointer-events: auto;
    }
  }
  a {
    color: var(--accent);
  }
</style>
