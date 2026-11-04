<script lang="ts">
  import { install } from '../lib/install.svelte';

  // "add to home screen", a quiet link beside "sound check" on the title screen (Ryan). Android
  // browsers ask for themselves; on an iPhone, or where the browser can't, it shows the steps.
  let steps = $state(false);

  async function add() {
    if (!(await install.prompt())) steps = !steps;
  }
</script>

{#if !install.installed}
  · <button class="link" aria-expanded={steps} onclick={add}>add to home screen</button>
  {#if steps}
    <span class="steps" role="note">
      {#if install.platform === 'ios'}
        Tap <b>Share</b>
        <!-- iOS's own Share symbol: a rounded box, open at the top, with an arrow rising out of it. -->
        <svg class="share" viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M8.5 9H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1.5" /><path d="M12 2.5v12" /><path d="m8.5 6 3.5-3.5L15.5 6" /></svg
        >, then <b>Add to Home Screen</b>.
      {:else}
        Open the browser menu <span aria-hidden="true">(⋮)</span> and tap <b>Install app</b> or <b>Add to Home screen</b>.
      {/if}
      You'll sign in with your PIN once in the new app.
    </span>
  {/if}
{/if}

<style>
  .link {
    display: inline;
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .share {
    width: 1.15em;
    height: 1.15em;
    vertical-align: -0.2em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .steps {
    display: block;
    margin: 8px auto 0;
    max-width: 300px;
    line-height: 1.4;
  }
</style>
