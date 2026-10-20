<script lang="ts">
  import type { Call, Strain } from '@dark/engine';
  import Suit from './Suit.svelte';

  // A call ("2♠", "3NT", "Pass") or a bare strain, with the drawn suit symbol (see Suit.svelte).
  // `red` colours hearts and diamonds with the given colour (the felt or card red).
  let { call = null, strain = null, red = 'var(--red-on-felt)' }: { call?: Call | null; strain?: Strain | null; red?: string } = $props();
  const s = $derived(call ? (call.type === 'bid' ? call.strain : null) : strain);
</script>

<span class="call">
  {#if call?.type === 'pass'}Pass{:else}{#if call?.type === 'bid'}{call.level}{/if}{#if s === 'NT'}NT{:else if s}<span
        class="s"
        style={s === 'H' || s === 'D' ? `color: ${red}` : ''}><Suit suit={s} /></span
      >{/if}{/if}
</span>

<style>
  .call {
    white-space: nowrap;
  }
</style>
