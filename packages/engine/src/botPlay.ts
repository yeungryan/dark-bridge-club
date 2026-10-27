// Card play for the dev-only practice bots (spec S22, round 17). Like the bidding, a bot decides
// only from what its seat could know: its own hand, the calls everyone heard, and the cards
// everyone saw played. It remembers every card played this deal (a careful player would; Ryan
// chose full memory) and reads the auction for where the length and the strength sit.
// A player's view shows only the last trick (S06), so the caller passes the earlier ones in.
import type { AuctionCall } from './auction';
import { cardId, fullDeck } from './cards';
import { trumpSuit, winningPlay, type CompletedTrick, type PlayedCard } from './play';
import { next, partner, SEATS } from './seats';
import { SUITS, type Card, type Seat, type Suit } from './types';
import type { DealView } from './views';

const lowest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank > a.rank ? b : a));
const ofSuit = (cards: readonly Card[], suit: Suit) => cards.filter((c) => c.suit === suit);
const byRankDown = (cards: readonly Card[]) => [...cards].sort((a, b) => b.rank - a.rank);

/** What one seat's calls told the table. */
interface Read {
  /** Suits they bid. */
  readonly bid: Set<Suit>;
  /** The length their bids showed in each suit: 4 for a suit they named, +1 each time they bid it again, 3 for a raise. */
  readonly length: Record<Suit, number>;
  /** Suits their partner bid that they bid away from and never supported: likely short there. */
  readonly shortIn: Set<Suit>;
  /** They never bid at all: probably the weaker hand of their pair. */
  readonly silent: boolean;
}

/**
 * Reads the auction the way Ryan reads it (round 17):
 * - bidding a new suit over partner's suit, without ever supporting it, shows shortness there;
 * - raising partner's suit shows a fit: that pair holds most of the suit.
 */
function readAuction(calls: readonly AuctionCall[]): { seats: Record<Seat, Read>; fits: Record<0 | 1, Set<Suit>> } {
  const seats = Object.fromEntries(
    SEATS.map((s) => [s, { bid: new Set<Suit>(), length: { C: 0, D: 0, H: 0, S: 0 }, shortIn: new Set<Suit>(), silent: true }]),
  ) as Record<Seat, { bid: Set<Suit>; length: Record<Suit, number>; shortIn: Set<Suit>; silent: boolean }>;
  const fits: Record<0 | 1, Set<Suit>> = { 0: new Set(), 1: new Set() };
  for (const { seat, call } of calls) {
    if (call.type !== 'bid') continue;
    const me = seats[seat];
    me.silent = false;
    if (call.strain === 'NT') continue;
    const theirs = seats[partner(seat)].bid;
    const len = me.length[call.strain];
    me.length[call.strain] = len > 0 ? Math.min(len + 1, 6) : theirs.has(call.strain) ? 3 : 4;
    if (theirs.has(call.strain)) {
      fits[(seat % 2) as 0 | 1].add(call.strain);
      me.shortIn.delete(call.strain);
    } else {
      for (const s of theirs) if (!me.bid.has(s)) me.shortIn.add(s);
    }
    me.bid.add(call.strain);
  }
  return { seats, fits };
}

/** Everything a bot knows when it picks a card. */
interface Memory {
  readonly me: Seat;
  readonly hand: readonly Card[];
  readonly trump: Suit | null;
  readonly declaring: boolean;
  /** Cards the other three still hold between them: not played, not in my hand. */
  readonly unseen: readonly Card[];
  /** Suits each seat has shown out of (failed to follow). */
  readonly voids: Record<Seat, Set<Suit>>;
  readonly reads: Record<Seat, Read>;
  readonly fits: Record<0 | 1, Set<Suit>>;
  /** The cards each seat has played this deal. */
  readonly playedBy: Record<Seat, Card[]>;
  /** How many times each suit has been led this deal. */
  readonly ledCount: Record<Suit, number>;
}

function remember(view: DealView, me: Seat, earlier: readonly CompletedTrick[]): Memory {
  const trump = trumpSuit(view.contract!.strain);
  const tricks = [...earlier.map((t) => t.cards), view.currentTrick?.cards ?? []];
  const gone = new Set<string>(view.hand.map(cardId));
  const voids = Object.fromEntries(SEATS.map((s) => [s, new Set<Suit>()])) as Record<Seat, Set<Suit>>;
  const ledCount: Record<Suit, number> = { C: 0, D: 0, H: 0, S: 0 };
  const playedBy = Object.fromEntries(SEATS.map((s) => [s, [] as Card[]])) as Record<Seat, Card[]>;
  for (const cards of tricks) {
    const led = cards[0]?.card.suit;
    if (led) ledCount[led]++;
    for (const { seat, card } of cards) {
      gone.add(cardId(card));
      playedBy[seat].push(card);
      if (card.suit !== led) voids[seat].add(led!);
    }
  }
  const { seats, fits } = readAuction(view.calls);
  return {
    me,
    hand: view.hand,
    trump,
    declaring: me % 2 === view.contract!.declarer % 2,
    unseen: fullDeck().filter((c) => !gone.has(cardId(c))),
    voids,
    reads: seats,
    fits,
    playedBy,
    ledCount,
  };
}

/** No card anyone else still holds beats it in its own suit. */
const isMaster = (m: Memory, card: Card) => !m.unseen.some((c) => c.suit === card.suit && c.rank > card.rank);

/** Could this seat still hold a trump? */
const mayHoldTrump = (m: Memory, seat: Seat) =>
  m.trump !== null && !m.voids[seat].has(m.trump) && m.unseen.some((c) => c.suit === m.trump);

/** Could `seat` (still to play) take this trick from `card`, with `led` the suit led? */
function canBeat(m: Memory, seat: Seat, card: Card, led: Suit): boolean {
  const higher = (suit: Suit) => m.unseen.some((c) => c.suit === suit && (suit !== card.suit || c.rank > card.rank));
  const outOfLed = m.voids[seat].has(led);
  if (card.suit === m.trump) return mayHoldTrump(m, seat) && (led === m.trump || outOfLed) && higher(m.trump!);
  if (!outOfLed && higher(card.suit)) return true;
  // A ruff: they've shown out of the suit, or their partner's bidding says they're short in it.
  const short = outOfLed || m.reads[seat].shortIn.has(led);
  return short && mayHoldTrump(m, seat);
}

const opponents = (me: Seat): Seat[] => [next(me), next(partner(me))];

// ---------------------------------------------------------------------------------------------
// Leading
// ---------------------------------------------------------------------------------------------

/** The declaring side pulls the opponents' trumps while it clearly holds more of them. */
function trumpPull(m: Memory): Card | null {
  if (!m.declaring || m.trump === null) return null;
  const mine = ofSuit(m.hand, m.trump);
  if (mine.length === 0) return null;
  const theirs = opponents(m.me).filter((s) => mayHoldTrump(m, s));
  if (theirs.length === 0) return null;
  const out = ofSuit(m.unseen, m.trump).length;
  // Partner bid the trump suit: count the length their bids showed, less the trumps they've played.
  const partnerSeat = partner(m.me);
  const played = m.playedBy[partnerSeat].filter((c) => c.suit === m.trump).length;
  const partnerHas = Math.min(out, Math.max(0, m.reads[partnerSeat].length[m.trump] - played));
  const theyHave = out - partnerHas;
  if (theyHave <= 0) return null;
  const master = mine.find((c) => isMaster(m, c));
  // An opponent who bid away from their partner's suit is short somewhere: get their trumps out sooner.
  const ruffThreat = opponents(m.me).some((s) => m.reads[s].shortIn.size > 0 || m.voids[s].size > 0);
  const enough = mine.length + partnerHas > theyHave && (mine.length >= 3 || master !== undefined || ruffThreat);
  if (!enough) return null;
  return master ?? lowest(mine);
}

/**
 * Leading a suit partner has shown out of, so partner can trump it (Ryan, round 19). Only when
 * it gains: partner may still hold a trump, and on the declaring side only when partner is the
 * shorter trump hand. The longer hand's trumps win sets anyway; the shorter hand's would just be
 * pulled. (No opponent may be able to trump first or over the top: see `ruffed` in leadScore.)
 */
function feedsPartner(m: Memory, suit: Suit): boolean {
  const p = partner(m.me);
  if (m.trump === null || suit === m.trump || !m.voids[p].has(suit) || !mayHoldTrump(m, p)) return false;
  if (!m.declaring) return true;
  const played = m.playedBy[p].filter((c) => c.suit === m.trump).length;
  const partnerShows = Math.max(0, m.reads[p].length[m.trump] - played);
  return partnerShows <= ofSuit(m.hand, m.trump).length;
}

/** How good a suit is to lead from (higher is better). */
function leadScore(m: Memory, suit: Suit, noTrumps: boolean): number {
  const cards = byRankDown(ofSuit(m.hand, suit));
  const top = cards[0]!;
  const side = (m.me % 2) as 0 | 1;
  const partnerSeat = partner(m.me);
  const theirSide = (1 - side) as 0 | 1;
  let score = (noTrumps ? 0.6 : 0.25) * cards.length;

  // Ruff danger: an opponent who has shown out (or is short by their bidding) and may hold trumps.
  const ruffed = opponents(m.me).some(
    (s) => (m.voids[s].has(suit) || m.reads[s].shortIn.has(suit)) && mayHoldTrump(m, s),
  );

  if (isMaster(m, top)) score += ruffed ? -1 : 5; // a sure winner: cash it
  if (ruffed) score -= 3;

  // Partner's suit, and partner's ruff.
  if (m.reads[partnerSeat].bid.has(suit)) score += m.declaring ? 1.5 : 3;
  if (feedsPartner(m, suit) && !ruffed) score += 4;

  // The opponents' suits: they hold the length and the honours.
  if (opponents(m.me).some((s) => m.reads[s].bid.has(suit)) && !isMaster(m, top)) score -= 3;
  // Their fit: lead it once at most; the second round is likely ruffed.
  if (m.fits[theirSide].has(suit) && suit !== m.trump) score -= m.ledCount[suit] > 0 ? 3 : 1;

  // A singleton side card: void next time, then ruff (Ryan: a lone king is fine to lead too).
  if (cards.length === 1 && m.trump !== null && suit !== m.trump && ofSuit(m.hand, m.trump).length > 0) {
    score += m.declaring ? 1 : 2;
  }

  // Leading away from a lone king or queen hands it to the ace or king behind it.
  const second = cards[1];
  const sequence = second !== undefined && second.rank === top.rank - 1 && top.rank >= 10;
  if (cards.length >= 2 && top.rank >= 11 && !isMaster(m, top) && !sequence) score -= 3;
  if (sequence) score += 1.5;
  if (cards.length >= 2 && top.rank <= 10) score += 0.5; // nothing to lose in it
  return score;
}

/** Which card of the chosen suit to lead. */
function leadFrom(m: Memory, suit: Suit): Card {
  const cards = byRankDown(ofSuit(m.hand, suit));
  const top = cards[0]!;
  if (isMaster(m, top) || cards.length === 1) return top;
  // Partner will trump it: lead the lowest and keep the honours.
  if (feedsPartner(m, suit)) return cards[cards.length - 1]!;
  const second = cards[1]!;
  if (second.rank === top.rank - 1 && top.rank >= 10) return top; // top of a sequence
  if (cards.length === 2 && top.rank <= 11) return top; // high from a short suit
  return cards[cards.length - 1]!;
}

function lead(m: Memory, noTrumps: boolean): Card {
  const pull = trumpPull(m);
  if (pull) return pull;
  const sideSuits = SUITS.filter((s) => s !== m.trump && m.hand.some((c) => c.suit === s));
  if (sideSuits.length === 0) {
    // Only trumps left: the top one if it's a winner, else the lowest.
    const master = m.hand.find((c) => isMaster(m, c));
    return master ?? lowest(m.hand);
  }
  let best = sideSuits[0]!;
  let bestScore = -Infinity;
  for (const s of sideSuits) {
    const score = leadScore(m, s, noTrumps);
    if (score > bestScore) [best, bestScore] = [s, score];
  }
  return leadFrom(m, best);
}

// ---------------------------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------------------------

/** The card to throw away when not trying to win: the one this hand needs least. */
function cheapest(m: Memory, legal: readonly Card[], led: Suit): Card {
  const following = legal.filter((c) => c.suit === led);
  if (following.length > 0) return lowest(following);
  const discards = legal.filter((c) => c.suit !== m.trump);
  if (discards.length === 0) return lowest(legal);
  const partnerSuits = m.reads[partner(m.me)].bid;
  const value = (c: Card) => {
    const suit = ofSuit(m.hand, c.suit);
    let v = c.rank;
    if (isMaster(m, c)) v += 20;
    // A guard: a small card keeping a king or queen company.
    const guarded = suit.some((h) => h.rank >= 12 && h.rank !== c.rank && !isMaster(m, h));
    if (guarded && suit.length <= 3) v += 8;
    if (partnerSuits.has(c.suit)) v += 3;
    // Emptying a suit lets this hand ruff it later.
    if (suit.length === 1 && m.trump !== null && ofSuit(m.hand, m.trump).length > 0) v -= 2;
    return v;
  };
  return discards.reduce((a, b) => (value(b) < value(a) ? b : a));
}

function follow(m: Memory, trick: readonly PlayedCard[], legal: readonly Card[]): Card {
  const led = trick[0]!.card.suit;
  const current = winningPlay(trick, m.trump);
  const still = [next(m.me), partner(m.me), next(partner(m.me))].slice(0, 3 - trick.length);
  const opponentsAfter = still.filter((s) => s % 2 !== m.me % 2);
  const wins = (c: Card) => winningPlay([...trick, { seat: m.me, card: c }], m.trump).seat === m.me;
  const safe = (c: Card) => !opponentsAfter.some((s) => canBeat(m, s, c, led));
  const winners = legal.filter(wins);

  if (current.seat === partner(m.me)) {
    // Partner is winning. Last to play: let it be. Third hand: take over with a sure winner
    // when the last opponent could beat partner's card. Out of the suit, that's a trump the
    // last opponent can't overtrump (round 19, Ryan: Adrian threw a heart on his ♠8).
    const threatened = opponentsAfter.some((s) => canBeat(m, s, current.card, led));
    const sure = winners.filter(safe);
    if (threatened && sure.length > 0) return lowest(sure);
    return cheapest(m, legal, led);
  }

  if (winners.length === 0) return cheapest(m, legal, led);
  if (opponentsAfter.length === 0) return lowest(winners); // last to play: win as cheaply as possible
  const sure = winners.filter(safe);
  if (sure.length > 0) return lowest(sure);
  // Nothing wins for certain. Second hand plays low and leaves it to partner; third hand
  // plays its cheapest winner to make the last opponent spend a higher card.
  if (trick.length === 1) return cheapest(m, legal, led);
  return lowest(winners);
}

/**
 * A practice bot's card. `tricksSoFar` is every finished trick this deal (public: everyone saw
 * them played); without it the bot remembers only the last trick, as its view shows.
 */
export function botCard(view: DealView, me: Seat, tricksSoFar?: readonly CompletedTrick[]): Card {
  const legal = view.legalPlays;
  if (legal.length === 1) return legal[0]!;
  const m = remember(view, me, tricksSoFar ?? (view.lastTrick ? [view.lastTrick] : []));
  const trick = view.currentTrick?.cards ?? [];
  if (trick.length === 0) return lead(m, view.contract!.strain === 'NT');
  return follow(m, trick, legal);
}
