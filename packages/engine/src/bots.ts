// Dev-only practice bots (spec S22). They decide from a player's own view, exactly like a person,
// so they can never peek at other hands. Not exported from index.ts; never used in real games.
import { bid, bidRank, PASS, type AuctionCall } from './auction';
import { hcp } from './cards';
import { next, partner } from './seats';
import { trumpSuit, winningPlay } from './play';
import { SUITS, type Call, type Card, type Level, type Seat, type Strain, type Suit } from './types';
import type { DealView } from './views';

const lowest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (cards: readonly Card[]) => cards.reduce((a, b) => (b.rank > a.rank ? b : a));

function longestSuit(hand: readonly Card[]): Suit {
  return SUITS.reduce((best, s) =>
    hand.filter((c) => c.suit === s).length >= hand.filter((c) => c.suit === best).length ? s : best,
  );
}

// ---------------------------------------------------------------------------------------------
// Bidding (round 15). House rules: a contract is simply won or lost, at any level, so bidding
// higher than needed only adds risk. A bot bids only to win the auction for its side, at the
// cheapest level, and never above the level it thinks its side can make (its "safe level").
// ---------------------------------------------------------------------------------------------

type Bid = AuctionCall & { call: { type: 'bid' } };
type Lengths = Record<Suit, number>;

const lengthsOf = (hand: readonly Card[]): Lengths => ({
  C: hand.filter((c) => c.suit === 'C').length,
  D: hand.filter((c) => c.suit === 'D').length,
  H: hand.filter((c) => c.suit === 'H').length,
  S: hand.filter((c) => c.suit === 'S').length,
});

/** No void or singleton, and at most one doubleton (4-3-3-3, 4-4-3-2, 5-3-3-2). */
function isBalanced(hand: readonly Card[]): boolean {
  const lens = Object.values(lengthsOf(hand));
  return lens.every((n) => n >= 2) && lens.filter((n) => n === 2).length <= 1;
}

/** Losing-trick count for one suit: missing ace, king and queen among its top three cards. */
function suitLosers(cards: readonly Card[]): number {
  const has = (rank: number) => cards.some((c) => c.rank === rank);
  if (cards.length === 0) return 0;
  if (cards.length === 1) return has(14) ? 0 : 1;
  if (cards.length === 2) return (has(14) ? 0 : 1) + (has(13) ? 0 : 1);
  return (has(14) ? 0 : 1) + (has(13) ? 0 : 1) + (has(12) ? 0 : 1);
}

/**
 * Tricks this hand takes by itself with `suit` as trumps (a conservative count): every trump
 * except the trump losers, plus side aces, plus a side king sitting with its ace.
 */
function soloTricks(hand: readonly Card[], suit: Suit): number {
  const trumps = hand.filter((c) => c.suit === suit);
  let tricks = trumps.length - suitLosers(trumps);
  for (const s of SUITS) {
    if (s === suit) continue;
    const side = hand.filter((c) => c.suit === s);
    if (side.some((c) => c.rank === 14)) tricks += side.some((c) => c.rank === 13) ? 2 : 1;
  }
  return tricks;
}

/** A, Kx or Qxx: enough to stop the opponents running their suit in no trumps. */
function hasStopper(hand: readonly Card[], suit: Suit): boolean {
  const cards = hand.filter((c) => c.suit === suit);
  const has = (rank: number) => cards.some((c) => c.rank === rank);
  return has(14) || (has(13) && cards.length >= 2) || (has(12) && cards.length >= 3);
}

/** The minimum a seat has shown by its bids so far. Public: everyone heard the calls. */
interface Shown {
  readonly bid: boolean;
  /** Minimum high-card points. */
  readonly points: number;
  /** Minimum length in each suit (0 = nothing shown). */
  readonly length: Lengths;
}

/**
 * What a seat's bids show, read the way these bots bid:
 * - an opening 1-bid: 12+ points and 4+ cards (1NT: 15+, balanced);
 * - an opening above level 1 (the blocking opening): a long, strong suit of 7+ cards, 10+ points;
 * - a bid in a suit partner already named (support): 3+ cards, 6+ points;
 * - any other new suit: 5+ cards, 8+ points; any other NT: 12+ points, balanced.
 */
function shownBy(calls: readonly AuctionCall[], seat: Seat): Shown {
  let points = 0;
  let didBid = false;
  const length: Lengths = { C: 0, D: 0, H: 0, S: 0 };
  const named = new Map<Seat, Set<Strain>>();
  let anyBid = false;
  for (const { seat: who, call } of calls) {
    if (call.type !== 'bid') continue;
    if (who === seat) {
      didBid = true;
      const { level, strain } = call;
      const support = named.get(partner(seat))?.has(strain) ?? false;
      if (strain === 'NT') {
        points = Math.max(points, !anyBid && level === 1 ? 15 : 12);
      } else if (!anyBid) {
        points = Math.max(points, level === 1 ? 12 : 10);
        length[strain] = Math.max(length[strain], level === 1 ? 4 : 7);
      } else if (support) {
        points = Math.max(points, 6);
        length[strain] = Math.max(length[strain], 3);
      } else {
        points = Math.max(points, 8);
        length[strain] = Math.max(length[strain], 5);
      }
    }
    if (!named.has(who)) named.set(who, new Set());
    named.get(who)!.add(call.strain);
    anyBid = true;
  }
  return { bid: didBid, points, length };
}

/** Everything a bot reads from its own view before bidding. */
interface Table {
  readonly me: Seat;
  readonly hand: readonly Card[];
  readonly myLengths: Lengths;
  readonly bids: readonly Bid[];
  readonly last: Bid | null;
  readonly partnerShown: Shown;
  /** Partner's points: what they showed, or a share of the unseen points if they haven't bid. */
  readonly partnerPoints: number;
  /** Suits either opponent has named. */
  readonly opponentSuits: ReadonlySet<Suit>;
}

function readTable(view: DealView, me: Seat): Table {
  const hand = view.hand;
  const bids = view.calls.filter((c): c is Bid => c.call.type === 'bid');
  const partnerShown = shownBy(view.calls, partner(me));
  const opponentPoints = shownBy(view.calls, next(me)).points + shownBy(view.calls, next(partner(me))).points;
  // Partner hasn't bid: a fair share of the points we can't account for. They're split between
  // the hands that haven't shown any: three before anyone bids, two once an opponent has
  // (round 16: thirds underrated partner, so bots stayed quiet).
  const unknownHands = opponentPoints > 0 ? 2 : 3;
  const partnerPoints = partnerShown.bid
    ? partnerShown.points
    : Math.max(0, (40 - hcp(hand) - opponentPoints) / unknownHands);
  const opponentSuits = new Set<Suit>();
  for (const b of bids) {
    if (b.seat !== me && b.seat !== partner(me) && b.call.strain !== 'NT') opponentSuits.add(b.call.strain);
  }
  return {
    me,
    hand,
    myLengths: lengthsOf(hand),
    bids,
    last: bids[bids.length - 1] ?? null,
    partnerShown,
    partnerPoints,
    opponentSuits,
  };
}

/** Partner's length in a suit: what they showed, else a guess from what's left. */
function partnerLength(t: Table, suit: Suit): number {
  const shown = t.partnerShown.length[suit];
  if (shown > 0) return shown;
  if (SUITS.some((s) => t.partnerShown.length[s] >= 4)) return 2; // their length is elsewhere
  return t.myLengths[suit] >= 5 ? 2 : 3;
}

/** Trick adjustment for the combined trump length: 8 cards is the normal fit. */
function fitAdjustment(fit: number): number {
  if (fit >= 10) return 1;
  if (fit === 9) return 0.5;
  if (fit === 8) return 0;
  return -0.5; // 7 cards
}

/** Points for short side suits, counted only when supporting a suit partner showed. */
function shortnessPoints(lengths: Lengths, trumps: Suit): number {
  return SUITS.filter((s) => s !== trumps).reduce((sum, s) => sum + Math.max(0, 3 - lengths[s]), 0);
}

/**
 * Tricks our side expects to win in a suit contract. Combined points map to tricks the usual way
 * (26 points ≈ 10 tricks, 33 ≈ 12; about 2 tricks per 7 points), adjusted for the trump fit.
 * A long strong suit never counts for less than the tricks it takes by itself.
 */
function suitTricks(t: Table, suit: Suit): number {
  const mine = t.myLengths[suit];
  const fit = mine + partnerLength(t, suit);
  if (fit < 7) return 0; // no trump fit: not a contract we want
  const supporting = t.partnerShown.length[suit] >= 4 && mine >= 3;
  const distribution = supporting ? shortnessPoints(t.myLengths, suit) : Math.max(0, mine - 4);
  const points = hcp(t.hand) + distribution + t.partnerPoints;
  const byPoints = 10 + ((points - 26) * 2) / 7 + fitAdjustment(fit);
  // Ryan (round 16): weigh the hand's shape too. A void or a doubleton beside a long suit lets
  // you trump early, so the losing-trick count rates it higher than points alone; averaging the
  // two keeps a wild shape from promising a slam.
  const byShape = 24 - myLosers(t, suit) - partnerLosers(t) + fitAdjustment(fit);
  const tricks = (byPoints + byShape) / 2;
  return Math.min(13, Math.max(tricks, soloTricks(t.hand, suit)));
}

/**
 * Losing-trick count with `trumps` as trumps: in each suit up to three losers, less each of
 * A, K, Q among them, so a void has none and a singleton at most one. Shortness in a suit
 * partner bid is a misfit, not a ruffing chance, so it gets no credit there.
 */
function myLosers(t: Table, trumps: Suit): number {
  return SUITS.reduce((n, s) => {
    const cards = t.hand.filter((c) => c.suit === s);
    const losers = suitLosers(cards);
    const misfit = s !== trumps && t.partnerShown.length[s] >= 4 && cards.length < 3;
    return n + (misfit ? Math.max(losers, 2) : losers);
  }, 0);
}

/** Partner's losers, from what they showed: an opener has about 7, a new suit 8, a raise 9. */
function partnerLosers(t: Table): number {
  const p = t.partnerShown;
  if (!p.bid) return 9;
  if (p.points >= 12) return 7;
  if (p.points >= 8) return 8;
  return 9;
}

/** NT needs no short suit in my hand and a stopper in every suit the opponents named. */
function canPlayNoTrumps(t: Table): boolean {
  if (SUITS.some((s) => t.myLengths[s] < 2)) return false;
  return [...t.opponentSuits].every((s) => hasStopper(t.hand, s));
}

/** Tricks our side expects in no trumps: 25 points ≈ 9 tricks, 33 ≈ 12. */
function noTrumpTricks(t: Table): number {
  if (!canPlayNoTrumps(t)) return 0;
  const points = hcp(t.hand) + t.partnerPoints;
  return Math.min(13, 9 + ((points - 25) * 3) / 8);
}

/** Highest level our side can safely contract for: expected tricks − 6 (round 16: no extra margin
 *  on top of the estimate's own caution; it kept bots out of auctions they'd have won). */
function safeLevelFromTricks(tricks: number): number {
  return Math.max(0, Math.min(7, Math.floor(tricks) - 6));
}

function safeLevelsFor(t: Table): Record<Strain, number> {
  return {
    C: safeLevelFromTricks(suitTricks(t, 'C')),
    D: safeLevelFromTricks(suitTricks(t, 'D')),
    H: safeLevelFromTricks(suitTricks(t, 'H')),
    S: safeLevelFromTricks(suitTricks(t, 'S')),
    NT: safeLevelFromTricks(noTrumpTricks(t)),
  };
}

/** The highest level, per strain, this bot will bid to. Exported for tests. */
export function safeLevels(view: DealView, me: Seat): Record<Strain, number> {
  return safeLevelsFor(readTable(view, me));
}

/** The cheapest bid in `strain` that outranks the last bid, or null above 7. */
function cheapestBid(t: Table, strain: Strain): (Call & { type: 'bid' }) | null {
  const floor = t.last ? bidRank(t.last.call.level, t.last.call.strain) : -1;
  for (let level = 1; level <= 7; level++) {
    if (bidRank(level as Level, strain) > floor) return bid(level as Level, strain) as Call & { type: 'bid' };
  }
  return null;
}

/** The cheapest winning bid in `strain`, if it is within the safe level; otherwise null. */
function safeBid(t: Table, strain: Strain, safe: Record<Strain, number>): Call | null {
  const call = cheapestBid(t, strain);
  return call && call.level <= safe[strain] ? call : null;
}

/** The strain partner bid most recently, if any. */
function partnersStrain(t: Table): Strain | null {
  const theirs = t.bids.filter((b) => b.seat === partner(t.me));
  return theirs[theirs.length - 1]?.call.strain ?? null;
}

/** How many times I bid a different strain from the one partner had just named (at most once). */
function switchesOnPartner(t: Table): number {
  let partnerStrain: Strain | null = null;
  let switches = 0;
  for (const b of t.bids) {
    if (b.seat === partner(t.me)) partnerStrain = b.call.strain;
    else if (b.seat === t.me && partnerStrain !== null && b.call.strain !== partnerStrain) switches++;
  }
  return switches;
}

/** Partner bid a different strain after my last bid: they don't like mine, so I won't repeat it. */
function partnerSwitchedOnMe(t: Table): boolean {
  const myLast = t.bids.filter((b) => b.seat === t.me).pop();
  if (!myLast) return false;
  const after = t.bids.slice(t.bids.indexOf(myLast) + 1).filter((b) => b.seat === partner(t.me));
  return after.some((b) => b.call.strain !== myLast.call.strain);
}

/**
 * Ryan's rule 2 ("skip level 1 to block"): a hand built on one long, strong suit that makes a
 * contract largely by itself opens at the level its own tricks support (at most 4).
 */
function blockingOpening(hand: readonly Card[]): Call | null {
  const suit = longestSuit(hand);
  const cards = hand.filter((c) => c.suit === suit);
  const topHonours = cards.filter((c) => c.rank >= 12).length;
  if (cards.length < 7 || topHonours < 2) return null;
  const level = Math.min(4, soloTricks(hand, suit) - 6);
  return level >= 2 ? bid(level as Level, suit) : null;
}

/** Two of the top three honours (A, K, Q) in a suit. */
const strongSuit = (hand: readonly Card[], suit: Suit) => hand.filter((c) => c.suit === suit && c.rank >= 12).length >= 2;

/**
 * Nobody has bid yet: block with a long strong suit, open 1 with 12+ points, otherwise pass.
 * Round 16 (Ryan's Darren deal): 9–11 points with a strong six-card suit opens too, at 2 if
 * that's safe (it blocks the opponents' cheap bids); and by the Rule of 20, 10–11 points open
 * when points plus the two longest suits' lengths reach 20.
 */
function openingCall(t: Table, safe: Record<Strain, number>): Call {
  const block = blockingOpening(t.hand);
  if (block) return block;
  const points = hcp(t.hand);
  if (points >= 9 && points < 12) {
    const six = SUITS.find((s) => t.myLengths[s] >= 6 && strongSuit(t.hand, s));
    if (six) return bid(safe[six] >= 2 ? 2 : 1, six);
    const [first, second] = Object.values(t.myLengths).sort((a, b) => b - a);
    if (points >= 10 && points + first! + second! >= 20) return bid(1, longestSuit(t.hand));
  }
  if (points < 12) return PASS;
  if (isBalanced(t.hand) && points >= 15 && points <= 17) return bid(1, 'NT');
  return bid(1, longestSuit(t.hand));
}

/**
 * Partner holds the contract: pass, because raising wins nothing. The one exception is Ryan's
 * rule 1 ("bid against partner"): with 0–2 cards in partner's suit and a 5+ card suit of my own
 * that is safe at the cheapest level, offer my suit instead. Once per auction, and never after
 * partner has turned down one of my suits.
 */
function partnerHoldsCall(t: Table, safe: Record<Strain, number>): Call {
  const theirs = t.last!.call.strain;
  if (theirs === 'NT') return PASS;
  if (switchesOnPartner(t) > 0 || partnerSwitchedOnMe(t)) return PASS;
  // Round 16: a strong six-card suit of my own is offered even with three cards in partner's.
  if (t.myLengths[theirs] <= 3) {
    const six = SUITS.filter((s) => s !== theirs && t.myLengths[s] >= 6 && strongSuit(t.hand, s) && !t.opponentSuits.has(s))
      .map((s) => safeBid(t, s, safe))
      .filter((c): c is Call => c !== null);
    if (six[0]) return six[0];
  }
  if (t.myLengths[theirs] > 2) return PASS;
  const options = SUITS.filter((s) => s !== theirs && t.myLengths[s] >= 5 && !t.opponentSuits.has(s))
    .map((s) => safeBid(t, s, safe))
    .filter((c): c is Call => c !== null);
  return bestOf(options, safe) ?? PASS;
}

/**
 * An opponent holds the contract. Ryan's rule 3: with 3+ cards in partner's suit, raise it to the
 * cheapest winning level (a fit beats a new suit). Otherwise compete in my own best strain at the
 * cheapest winning level. Either way only within the safe level; otherwise pass.
 */
function opponentHoldsCall(t: Table, safe: Record<Strain, number>): Call {
  const theirs = partnersStrain(t);
  if (theirs !== null) {
    // Partner turned my suit down, or I already offered one: support or pass, nothing new.
    const settled = partnerSwitchedOnMe(t) || switchesOnPartner(t) > 0;
    // Round 16: my own six-card suit beats three-card support when it's at least as safe.
    if (!settled && theirs !== 'NT' && t.myLengths[theirs] <= 3) {
      const own = SUITS.find((s) => s !== theirs && t.myLengths[s] >= 6 && !t.opponentSuits.has(s) && safe[s] >= safe[theirs]);
      const call = own ? safeBid(t, own, safe) : null;
      if (call) return call;
    }
    const fits = theirs === 'NT' ? canPlayNoTrumps(t) : t.myLengths[theirs] >= 3;
    if (fits) {
      const raise = safeBid(t, theirs, safe);
      if (raise) return raise;
    }
    // Round 18 (Ryan's Darren deal): having offered my own suit isn't a reason to go quiet.
    // Unless partner turned it down, I compete in it again over the opponents.
    if (settled) {
      if (partnerSwitchedOnMe(t)) return PASS;
      const mine = new Set(t.bids.filter((b) => b.seat === t.me).map((b) => b.call.strain));
      const again = [...mine]
        .filter((s) => s !== theirs && (s === 'NT' || !t.opponentSuits.has(s)))
        .map((s) => safeBid(t, s, safe))
        .filter((c): c is Call => c !== null);
      return bestOf(again, safe) ?? PASS;
    }
  }
  const strains: Strain[] = SUITS.filter((s) => s !== theirs && t.myLengths[s] >= 5 && !t.opponentSuits.has(s));
  if (theirs !== 'NT' && isBalanced(t.hand)) strains.push('NT');
  const options = strains.map((s) => safeBid(t, s, safe)).filter((c): c is Call => c !== null);
  return bestOf(options, safe) ?? lightOvercall(t, theirs);
}

/**
 * Round 16: an opponent holds the contract and nothing above was safe, but 8+ points and a
 * five-card suit still compete, up to level 2. Letting them play cheaply cost the stronger side
 * most of those games (it won only 40% when it stayed quiet).
 */
function lightOvercall(t: Table, partners: Strain | null): Call {
  if (hcp(t.hand) < 8) return PASS;
  const five = SUITS.filter((s) => s !== partners && t.myLengths[s] >= 5 && !t.opponentSuits.has(s))
    .sort((a, b) => t.myLengths[b] - t.myLengths[a])
    .map((s) => cheapestBid(t, s))
    .filter((c): c is Call & { type: 'bid' } => c !== null && c.level <= 2);
  return five[0] ?? PASS;
}

/** The option with the most room under its safe level; ties go to the cheaper bid. */
function bestOf(options: readonly Call[], safe: Record<Strain, number>): Call | null {
  let best: (Call & { type: 'bid' }) | null = null;
  for (const call of options) {
    if (call.type !== 'bid') continue;
    if (!best) {
      best = call;
      continue;
    }
    const room = safe[call.strain] - call.level;
    const bestRoom = safe[best.strain] - best.level;
    if (room > bestRoom || (room === bestRoom && bidRank(call.level, call.strain) < bidRank(best.level, best.strain))) {
      best = call;
    }
  }
  return best;
}

function isLegal(view: DealView, call: Call): boolean {
  return view.legalCalls.some(
    (c) => c.type === call.type && (c.type === 'pass' || (call.type === 'bid' && c.level === call.level && c.strain === call.strain)),
  );
}

/**
 * Bids "just enough": estimate per strain how many sets our side can win (own hand plus what
 * partner's bids showed), never bid above that, and only bid when it wins the auction for us.
 */
export function botCall(view: DealView, me: Seat): Call {
  const t = readTable(view, me);
  const safe = safeLevelsFor(t);
  let call: Call;
  if (!t.last) call = openingCall(t, safe);
  else if (t.last.seat === partner(me)) call = partnerHoldsCall(t, safe);
  else if (t.last.seat === me) call = PASS;
  else call = opponentHoldsCall(t, safe);
  return isLegal(view, call) ? call : PASS;
}

export { botCard } from './botPlay';
