import { describe, expect, it } from 'vitest';
import {
  applySessionAction,
  cardId,
  newSession,
  SEATS,
  seatToAct,
  tableView,
  type SessionAction,
  type SessionConfig,
  type SessionState,
} from '../src';
import { botCall, botCard } from '../src/bots';

const config: SessionConfig = {
  profiles: ['darren', 'adrian', 'ryan', 'kim'],
  usualPartner: { darren: 'kim', kim: 'darren', adrian: 'ryan', ryan: 'adrian' },
  seed: '0f0e0d0c0b0a09080706050403020100',
};

function apply(s: SessionState, a: SessionAction): SessionState {
  const out = applySessionAction(s, a);
  if (!out.ok) throw new Error(out.error.code);
  return out.state;
}

/** Plays a whole night of bot deals, calling `check` after every action. */
function botNight(deals: number, check: (s: SessionState) => void): SessionState {
  let s = apply(newSession(config), { type: 'start' });
  s = apply(s, { type: 'pickPartner', by: s.captain!, partner: s.suggestedPartner! });
  let completed = 0;
  while (completed < deals) {
    check(s);
    if (s.phase === 'betweenDeals') {
      completed++;
      for (const by of config.profiles) s = apply(s, { type: 'readyForNext', by });
      continue;
    }
    const deal = s.deal!;
    if (deal.phase === 'awaitingPlayOn') {
      s = apply(s, { type: 'dealTimer', action: 'endAtClinch' });
      continue;
    }
    const seat = seatToAct(deal)!;
    const by = s.seating![seat];
    const view = tableView(s, by).deal!;
    s = deal.phase === 'auction'
      ? apply(s, { type: 'deal', by, action: { type: 'call', call: botCall(view, seat) } })
      : apply(s, { type: 'deal', by, action: { type: 'play', card: botCard(view, seat) } });
  }
  return s;
}

describe('S06 per-player views', () => {
  it('before the reveal, a view holds only your own hand, and never the seed', () => {
    botNight(20, (s) => {
      if (!s.deal || s.deal.phase === 'complete') return;
      for (const me of config.profiles) {
        const view = tableView(s, me);
        const mySeat = view.mySeat!;
        expect(view.deal!.revealedHands).toBeNull();
        expect(view.deal!.hand).toEqual(s.deal.hands[mySeat]);

        // No unplayed card belonging to anyone else appears anywhere in the serialized view.
        const json = JSON.stringify(view);
        expect(json).not.toContain(s.deal.seed!);
        for (const seat of SEATS) {
          if (seat === mySeat) continue;
          for (const card of s.deal.hands[seat]) {
            expect(json).not.toContain(JSON.stringify(card));
          }
        }
      }
    });
  });

  it('only the most recent trick is visible', () => {
    botNight(5, (s) => {
      const deal = s.deal;
      if (!deal || deal.phase === 'complete' || deal.tricks.length < 2) return;
      const json = JSON.stringify(tableView(s, 'ryan'));
      const older = deal.tricks[deal.tricks.length - 2]!;
      // A card from an older trick can't appear (it's been played, so it's in no hand either).
      expect(json).not.toContain(JSON.stringify(older.cards[0]!.card));
    });
  });

  it('after the deal is complete, all four original hands are revealed to everyone', () => {
    botNight(3, (s) => {
      if (s.deal?.phase !== 'complete') return;
      for (const me of config.profiles) {
        const revealed = tableView(s, me).deal!.revealedHands!;
        const all = SEATS.flatMap((seat) => revealed[seat].map(cardId));
        expect(new Set(all).size).toBe(52);
      }
    });
  });

  it('legal options are only given to the player whose turn it is', () => {
    botNight(3, (s) => {
      if (!s.deal || (s.deal.phase !== 'auction' && s.deal.phase !== 'play')) return;
      const turn = seatToAct(s.deal);
      for (const me of config.profiles) {
        const view = tableView(s, me).deal!;
        const options = view.legalCalls.length + view.legalPlays.length;
        if (tableView(s, me).mySeat !== turn) expect(options).toBe(0);
        else expect(options).toBeGreaterThan(0);
      }
    });
  });
  it('counts tricks won by a trump, and only by a trump (S16 "first trump")', () => {
    let sawTrumpTrick = false;
    botNight(20, (s) => {
      const deal = s.deal;
      if (!deal?.contract) return;
      const view = tableView(s, 'ryan').deal!;
      const trump = deal.contract.strain === 'NT' ? null : deal.contract.strain;
      const expected = deal.tricks.filter((t) => trump !== null && t.winningCard.suit === trump).length;
      expect(view.trumpTricksWon).toBe(expected);
      expect(view.trickWinners).toEqual(deal.tricks.map((t) => t.winner));
      if (expected > 0) sawTrumpTrick = true;
    });
    expect(sawTrumpTrick).toBe(true);
  });
});

describe('S22 bots', () => {
  it('bots only ever make legal moves across 200 deals', () => {
    const s = botNight(200, () => {});
    expect(s.wins.A + s.wins.B).toBe(200);
  });
});
