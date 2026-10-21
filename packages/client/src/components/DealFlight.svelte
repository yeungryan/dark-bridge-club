<script lang="ts">
  import { next, type Seat } from '@dark/engine';
  import { onMount, tick } from 'svelte';
  import { director } from '../lib/juice/director.svelte';
  import { buzz } from '../lib/juice/haptics';
  import { settings } from '../lib/juice/settings.svelte';
  import { sound } from '../lib/juice/sound';

  // The deal (Ryan): 52 cards fly from the middle of the table, one at a time, round the table
  // from the dealer's left, with a flick each; your 13 land in your hand, which then fans open.
  let { dealer, me }: { dealer: Seat; me: Seat } = $props();

  const CARDS = 52;
  const GAP = 27;
  const FLY = 260;
  let layer = $state<HTMLElement>();

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = () => director.finishDeal();
    void tick().then(() => {
      const center = document.querySelector('.center')?.getBoundingClientRect();
      if (!layer || !center) return finish();
      const from = { x: center.left + center.width / 2, y: center.top + center.height / 2 };
      const targetOf = (seat: Seat) => {
        const el = seat === me ? document.querySelector('.hand') : document.querySelector(`[data-badge-seat="${seat}"]`);
        const r = el?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : from;
      };
      const gap = settings.ms(GAP);
      const fly = settings.ms(FLY);
      let seat = next(dealer);
      for (let i = 0; i < CARDS; i++) {
        const to = targetOf(seat);
        const mine = seat === me;
        const card = document.createElement('span');
        card.className = 'flying';
        card.style.left = `${from.x - 14}px`;
        card.style.top = `${from.y - 20}px`;
        layer.append(card);
        const spin = (i % 2 ? 1 : -1) * (180 + (i % 5) * 30);
        card.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${spin}deg) scale(${mine ? 1.2 : 0.7})`, opacity: mine ? 1 : 0.15 },
          ],
          { duration: fly, delay: i * gap, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
        );
        timers.push(setTimeout(() => sound.dealCard(i, CARDS), i * gap));
        seat = next(seat);
      }
      // The last card lands: your hand fans open.
      timers.push(
        setTimeout(
          () => {
            sound.fan();
            buzz('tap');
            finish();
          },
          (CARDS - 1) * gap + fly,
        ),
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      finish();
    };
  });
</script>

<div class="flight" bind:this={layer} aria-hidden="true"></div>

<style>
  .flight {
    position: fixed;
    inset: 0;
    z-index: 40;
    pointer-events: none;
  }
  .flight :global(.flying) {
    position: fixed;
    width: 28px;
    height: 40px;
    border-radius: 4px;
    background: var(--card-back);
    box-shadow:
      0 0 0 1px var(--card),
      0 2px 4px rgba(0, 0, 0, 0.4);
  }
</style>
