<script lang="ts">
  import { animalArt } from '../lib/animalArt';

  // An animal face (Twemoji). Sized by `size` (default 1em, so it follows the text around it).
  // With `silhouette`, it's a solid shape in that colour instead (the scoreboard's set icons).
  // With `rim` too, the shape gets a thin outline in that colour (Team Black on dark panels),
  // drawn as offset copies behind it rather than a CSS filter, which phones often drop on masks.
  let {
    animal,
    size = '1em',
    silhouette = null,
    rim = null,
    label = null,
  }: { animal: string | null | undefined; size?: string; silhouette?: string | null; rim?: string | null; label?: string | null } = $props();

  const src = $derived(animalArt(animal));
  // Double quotes: the inlined SVG data URLs contain single quotes.
  const maskStyle = $derived(`--s: ${size}; --c: ${silhouette}; --src: url("${src}")`);
</script>

{#if src}
  {#if silhouette && rim}
    <span class="icon rimmed" data-animal={animal} role={label ? 'img' : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : 'true'} style={maskStyle}>
      {#each ['-1px 0', '1px 0', '0 -1px', '0 1px', '-0.7px -0.7px', '0.7px 0.7px', '-0.7px 0.7px', '0.7px -0.7px'] as at (at)}
        <span class="sil layer" style="--c: {rim}; translate: {at}"></span>
      {/each}
      <span class="sil layer"></span>
    </span>
  {:else if silhouette}
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
  .rimmed {
    position: relative;
  }
  .layer {
    position: absolute;
    inset: 0;
  }
  .sil {
    background: var(--c);
    mask: var(--src) center / contain no-repeat;
    -webkit-mask: var(--src) center / contain no-repeat;
  }
</style>
