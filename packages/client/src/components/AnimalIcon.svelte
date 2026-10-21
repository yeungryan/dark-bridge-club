<script lang="ts">
  import { animalArt } from '../lib/animalArt';

  // An animal face (Twemoji). Sized by `size` (default 1em, so it follows the text around it).
  // With `silhouette`, it's a solid shape in that colour instead (the scoreboard's set icons).
  let {
    animal,
    size = '1em',
    silhouette = null,
    label = null,
  }: { animal: string | null | undefined; size?: string; silhouette?: string | null; label?: string | null } = $props();

  const src = $derived(animalArt(animal));
  // Double quotes: the inlined SVG data URLs contain single quotes.
  const maskStyle = $derived(`--s: ${size}; --c: ${silhouette}; --src: url("${src}")`);
</script>

{#if src}
  {#if silhouette}
    <span
      class="icon sil"
      data-animal={animal}
      role={label ? 'img' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : 'true'}
      style={maskStyle}
    ></span>
  {:else}
    <img class="icon" data-animal={animal} src={src} alt={label ?? ''} aria-hidden={label ? undefined : 'true'} style="--s: {size}" draggable="false" />
  {/if}
{/if}

<style>
  .icon {
    display: inline-block;
    flex: none;
    width: var(--s);
    height: var(--s);
    vertical-align: -0.15em;
    user-select: none;
    pointer-events: none;
  }
  .sil {
    background: var(--c);
    mask: var(--src) center / contain no-repeat;
    -webkit-mask: var(--src) center / contain no-repeat;
  }
</style>
