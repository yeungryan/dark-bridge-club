<script lang="ts">
  import { isThemeId } from '@dark/engine';
  import { PRACTICE_PROFILES, PracticeTable } from '../lib/practice.svelte';
  import { lastMe } from '../lib/session';
  import Game from './Game.svelte';

  // practice.html: you against three bots, all in this browser. Nothing is sent to the
  // server or recorded. You sit as whoever last signed in on this device (Darren found himself
  // playing as Ryan); ?as=darren (etc.) to sit as someone else; Ryan if nobody has signed in.
  // ?theme=bali (etc.) to practise in one theme; otherwise each night rolls one, like the real table.
  const params = new URLSearchParams(location.search);
  const asked = params.get('as') ?? lastMe() ?? 'ryan';
  const me = PRACTICE_PROFILES.some((p) => p.id === asked) ? asked : 'ryan';
  const theme = params.get('theme');
  const table = new PracticeTable(me, isThemeId(theme) ? theme : null);
</script>

<div class="tag">Practice · not recorded · <a href="lab.html">sound check</a> · <span class="build">build {__BUILD__}</span></div>
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
