// Dev-only (spec S22): lets the four-seat test page fill seats with practice bots.
// The bot sees exactly what its player sees, and acts through the same messages a person sends.
// Bots never propose or answer concessions; an offer to a bot simply expires.
import { ELEMENTS } from '@dark/engine';
import { botCall, botCard } from '@dark/engine/bots';
import type { Connection } from './connection.svelte';

const THINK_MS = 450;

export function startAutopilot(conn: Connection): () => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastKey = '';

  const tick = () => {
    const view = conn.view;
    const room = conn.room;
    if (!view || !room || room.paused || conn.status !== 'open') return;
    const me = view.me;
    const deal = view.deal;
    const key = `${view.endNightVotes.length}:${view.phase}:${view.dealNumber}:${deal?.calls.length}:${deal?.tricksPlayed}:${deal?.currentTrick?.cards.length}:${view.readyForNext.length}:${deal?.concession?.by}`;
    if (key === lastKey) return;

    let act: (() => void) | null = null;
    const pick = conn.myAvatar;
    if (view.phase === 'lobby' && pick && !pick.avatar) {
      // A bot picks a random animal from its offer and a random element (S24).
      const avatarKey = `avatar:${pick.offered.join()}`;
      if (lastKey === avatarKey) return;
      lastKey = avatarKey;
      const animal = pick.offered[Math.floor(Math.random() * pick.offered.length)]!;
      const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]!;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => conn.send({ type: 'avatar', action: { type: 'lock', animal, element } }), THINK_MS);
      return;
    }
    if (view.endNightVotes.length > 0 && !view.endNightVotes.includes(me)) {
      // A bot agrees when a person proposes ending the night.
      act = () => conn.intent({ type: 'voteEndNight' });
    } else if (view.phase === 'partnerPick' && view.captain === me) {
      const choice = view.suggestedPartner ?? view.profiles.find((p) => p !== me)!;
      act = () => conn.intent({ type: 'pickPartner', partner: choice });
    } else if (view.phase === 'awaitingDeal' && view.dealer !== null && view.dealer === view.mySeat) {
      act = () => conn.intent({ type: 'dealCards' });
    } else if (view.phase === 'betweenDeals' && !view.readyForNext.includes(me)) {
      act = () => conn.intent({ type: 'readyForNext' });
    } else if (deal && view.mySeat !== null) {
      if (deal.turn === view.mySeat && deal.phase === 'auction') {
        act = () => conn.intent({ type: 'deal', action: { type: 'call', call: botCall(deal, view.mySeat!) } });
      } else if (deal.turn === view.mySeat && deal.phase === 'play') {
        act = () => conn.intent({ type: 'deal', action: { type: 'play', card: botCard(deal, view.mySeat!) } });
      }
    }
    if (!act) return;
    lastKey = key;
    if (pending) clearTimeout(pending);
    pending = setTimeout(act, THINK_MS);
  };

  const interval = setInterval(tick, 150);
  return () => {
    clearInterval(interval);
    if (pending) clearTimeout(pending);
  };
}
