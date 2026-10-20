<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';
  import { TIMING } from '../lib/juice/timing';

  // Spec S16: numbers count up to their value (tallies, HCP), with an optional rising tick.
  let { value, from = 0, delay = 0, ticks = false }: { value: number; from?: number; delay?: number; ticks?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  let shown = $state(settings.animated ? from : value);
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const target = value;
    // Read the current number without subscribing to it, or every frame would restart the count.
    const current = untrack(() => shown);
    const start = settings.animated ? Math.min(current, target) : target;
    if (!settings.animated || start === target) {
      shown = target;
      return;
    }
    timer = setTimeout(() => {
      const t0 = performance.now();
      const duration = settings.ms(TIMING.countUp);
      let lastShown = start;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        shown = Math.round(start + (target - start) * (1 - (1 - t) ** 3));
        if (ticks && shown !== lastShown) sound.count(shown);
        lastShown = shown;
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, settings.ms(delay));
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  });

  onDestroy(() => cancelAnimationFrame(raf));
</script>

<span class="count">{shown}</span>

<style>
  .count {
    font-variant-numeric: tabular-nums;
  }
</style>
