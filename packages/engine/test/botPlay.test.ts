import { describe, expect, it } from 'vitest';
import {
  bid,
  cardId,
  fullDeck,
  newDealWithHands,
  PASS,
  sameCard,
  seatToAct,
  type Call,
  type Card,
  type DealState,
  type PerSeat,
  type Rank,
  type Seat,
  type Suit,
} from '../src';
import { botCard } from '../src/bots';
import { act, runAuction, seatView } from './helpers';

// Round 17 card play: the bots remember every card played, lead properly, and read the auction.

const RANK: Record<string, Rank> = { A: 14, K: 13, Q: 12, J: 11 };

/** "K43.A.98765.7654" = spades.hearts.diamonds.clubs; fewer than 13 cards is fine with `fill`. */
function cards(text: string): Card[] {
  const order: Suit[] = ['S', 'H', 'D', 'C'];
  return text.split('.').flatMap((part, i) =>
    (part.match(/10|[2-9JQKA]/g) ?? []).map((r) => ({ suit: order[i]!, rank: RANK[r] ?? (Number(r) as Rank) })),
  );
}

/** The given hands, with every other card dealt round the seats that still need some. */
function fill(given: Partial<Record<Seat, string>>): PerSeat<Card[]> {
  const hands = { 0: cards(given[0] ?? ''), 1: cards(given[1] ?? ''), 2: cards(given[2] ?? ''), 3: cards(given[3] ?? '') };
  const used = new Set(Object.values(hands).flat().map(cardId));
  const rest = fullDeck().filter((c) => !used.has(cardId(c)));
  for (const c of rest) {
    const seat = ([0, 1, 2, 3] as Seat[]).find((s) => hands[s].length < 13)!;
    hands[seat].push(c);
  }
  return hands;
}

/** Dealer 3, so seat 0 calls first. */
function dealt(hands: PerSeat<Card[]>, calls: Call[]): DealState {
  return runAuction(newDealWithHands(hands, 3), calls);
}

function play(s: DealState, text: string): DealState {
  for (const card of text.split(' ').map((t) => cards(t)[0]!)) {
    s = act(s, { type: 'play', seat: seatToAct(s)!, card });
  }
  return s;
}

const botAt = (s: DealState) => botCard(seatView(s, seatToAct(s)!), seatToAct(s)!, s.tricks);
const card = (text: string) => cards(text)[0]!;

describe('S22 round 17: leads', () => {
  // Seat 0 declares 1♣. Seat 1 leads ♥A (wins), then is on lead again with ♠K43.
  const hands = {
    0: cards('987.KQJ109..AKQJ9'),
    1: cards('K43.A.98765.7654'),
    2: cards('652.8765432.32.8'),
    3: cards('AQJ10..AKQJ104.1032'),
  } as PerSeat<Card[]>;
  const auction = [bid(1, 'C'), PASS, PASS, PASS];

  it('does not lead a king while the ace is still out (Ryan: Adrian\'s ♠K into Darren\'s ♠A)', () => {
    // Trick 1: ♥A, and seat 3 (out of hearts) throws a diamond. The ♠A is still out there.
    const s = play(dealt(hands, auction), '.A.. .2.. ..4. .9..');
    expect(seatToAct(s)).toBe(1);
    expect(botAt(s).suit).not.toBe('S');
  });

  it('leads the king once the ace has gone: it is the top spade now', () => {
    // Same, but seat 3 throws the ♠A on trick 1.
    const s = play(dealt(hands, auction), '.A.. .2.. A... .9..');
    expect(seatToAct(s)).toBe(1);
    expect(sameCard(botAt(s), card('K'))).toBe(true);
  });

  it('leads a singleton king (Ryan: it is lost to the ace anyway, and leaves a void to ruff)', () => {
    const s = dealt(fill({ 1: 'K.532.Q754.J8642' }), [bid(1, 'H'), PASS, PASS, PASS]);
    expect(seatToAct(s)).toBe(1);
    expect(sameCard(botAt(s), card('K'))).toBe(true);
  });

  it("leads partner's bid suit", () => {
    // Seat 3 bid diamonds; seat 1 leads against 2♥.
    const s = dealt(fill({ 1: 'K73.52.963.Q8642' }), [bid(1, 'H'), PASS, PASS, bid(2, 'D'), bid(2, 'H'), PASS, PASS, PASS]);
    expect(seatToAct(s)).toBe(1);
    expect(botAt(s).suit).toBe('D');
  });
});

describe('S22 round 19: saving partner\'s set', () => {
  it("trumps partner's low card when the last opponent could beat it (Ryan: Adrian threw a heart on his ♠8)", () => {
    // Seat 0 declares 1♦. Trick 1: Kim leads ♣2, Ryan wins with ♣A. Ryan leads ♠8, Kim ♠3;
    // Adrian (seat 2, no spades, ♦QJ8) is next, and Darren still holds the top spades.
    const hands = fill({ 0: '98..10974.A', 1: '3...2', 2: '.AKQ8765.QJ8.QJ9', 3: 'AKJ7...10' });
    let s = dealt(hands, [bid(1, 'D'), PASS, PASS, PASS]);
    s = play(s, '...2 ...9 ...10 ...A');
    s = play(s, '8... 3...');
    expect(seatToAct(s)).toBe(2);
    expect(sameCard(botAt(s), cards('..8.')[0]!)).toBe(true);
  });

  it("leads low into the suit partner is out of, so partner can trump it", () => {
    // Seat 0 declares 1♥. Seat 1 cashes ♠A, then ♣A; partner (seat 3) shows out of clubs but
    // holds hearts. Seat 1 leads clubs again, low (♣3, not the ♣Q from Q-J), for partner to trump.
    const hands = {
      0: cards('987.AKQJ106.2.K109'),
      1: cards('A.54.987654.AQJ3'),
      2: cards('65432.32..876542'),
      3: cards('KQJ10.987.AKQJ103.'),
    } as PerSeat<Card[]>;
    let s = dealt(hands, [bid(1, 'H'), PASS, PASS, PASS]);
    s = play(s, 'A... 2... 10... 7...');
    s = play(s, '...A ...2 ..3. ...9');
    expect(seatToAct(s)).toBe(1);
    expect(sameCard(botAt(s), cards('...3')[0]!)).toBe(true);
  });
});

describe("S22 round 17: Ryan's 3♣ deal", () => {
  // Ryan 876.Q942.QJ.AQJ6, Kim J10.J1073.K643.872, Adrian K543.AK86.8.K1095, Darren AQ92.5.A109752.43.
  // Same auction as the screenshot: 1♣ P P 1♦, 2♣ P P 2♦, P P 3♣ (Adrian) P P P.
  const hands = {
    0: cards('876.Q942.QJ.AQJ6'),
    1: cards('J10.J1073.K643.872'),
    2: cards('K543.AK86.8.K1095'),
    3: cards('AQ92.5.A109752.43'),
  } as PerSeat<Card[]>;
  const auction = [bid(1, 'C'), PASS, PASS, bid(1, 'D'), bid(2, 'C'), PASS, PASS, bid(2, 'D'), PASS, PASS, bid(3, 'C'), PASS, PASS, PASS];

  it('Adrian pulls trumps first and never leads ♠K into the ♠A; the contract makes', () => {
    let s = dealt(hands, auction);
    expect(s.contract).toMatchObject({ level: 3, strain: 'C', declarer: 2 });
    const adrianLeads: Card[] = [];
    let aceOut = true;
    while (s.phase === 'play' || s.phase === 'awaitingPlayOn') {
      if (s.phase === 'awaitingPlayOn') {
        s = act(s, { type: 'endAtClinch' });
        continue;
      }
      const seat = seatToAct(s)!;
      const c = botAt(s);
      if (seat === 2 && s.currentTrick!.cards.length === 0) {
        adrianLeads.push(c);
        if (aceOut) expect(sameCard(c, card('K'))).toBe(false);
      }
      if (sameCard(c, card('A'))) aceOut = false;
      s = act(s, { type: 'play', seat, card: c });
    }
    expect(adrianLeads[0]!.suit).toBe('C');
    expect(s.result!.winner).toBe('declarers');
  });
});
