// Compares the practice bots' old and new bidding (round 15) over many all-bot deals.
// Run with `npx tsx scripts/bot-bidding-sim.ts [deals]` from packages/engine. Deterministic.
// Card play is the same for both (botCard); only the auction changes.
import {
  applyDealAction,
  bid,
  hcp,
  newDeal,
  partner,
  PASS,
  Rng,
  seatToAct,
  SUITS,
  type Call,
  type Card,
  type DealState,
  type DealView,
  type Seat,
  type Suit,
} from '../src';
import { botCall, botCard } from '../src/bots';
import { seatView } from '../test/helpers';

type Bidder = (view: DealView, me: Seat) => Call;

/** The pre-round-15 botCall, kept here only for comparison. */
function oldBotCall(view: DealView, me: Seat): Call {
  const longestSuit = (hand: readonly Card[]): Suit =>
    SUITS.reduce((best, s) =>
      hand.filter((c) => c.suit === s).length >= hand.filter((c) => c.suit === best).length ? s : best,
    );
  const isLegal = (call: Call) =>
    view.legalCalls.some(
      (c) => c.type === call.type && (c.type === 'pass' || (call.type === 'bid' && c.level === call.level && c.strain === call.strain)),
    );
  const hand = view.hand;
  const points = hcp(hand);
  const bids = view.calls.filter((c) => c.call.type === 'bid');
  if (bids.length === 0 && points >= 12) {
    const balanced = SUITS.every((s) => hand.filter((c) => c.suit === s).length >= 2);
    const opening = balanced && points >= 15 && points <= 17 ? bid(1, 'NT') : bid(1, longestSuit(hand));
    if (isLegal(opening)) return opening;
  }
  const last = bids[bids.length - 1];
  const myBids = view.calls.filter((c) => c.seat === me && c.call.type === 'bid').length;
  if (last && last.seat === partner(me) && last.call.type === 'bid' && myBids === 0 && points >= 6) {
    const strain = last.call.strain;
    const support = strain === 'NT' ? 0 : hand.filter((c) => c.suit === strain).length;
    if ((strain === 'NT' || support >= 3) && last.call.level < 4) {
      const raise = bid((last.call.level + 1) as 2 | 3 | 4, strain);
      if (isLegal(raise)) return raise;
    }
  }
  return PASS;
}

function act(state: DealState, action: Parameters<typeof applyDealAction>[1]): DealState {
  const out = applyDealAction(state, action);
  if (!out.ok) throw new Error(`${action.type}: ${out.error.code}`);
  return out.state;
}

interface Stats {
  deals: number;
  passedOut: number;
  contracts: number;
  made: number;
  levelSum: number;
  levels: number[];
  bids: number;
  uncontestedRaises: number;
  dealsWithUncontestedRaise: number;
  contested: number;
  strongerSideDeclared: number;
  unevenDeals: number;
}

function simulate(bidder: Bidder, deals: number): Stats {
  const rng = Rng.fromSeed('b0b5b1dd000000000000000000000015');
  const stats: Stats = {
    deals, passedOut: 0, contracts: 0, made: 0, levelSum: 0, levels: [0, 0, 0, 0, 0, 0, 0, 0],
    bids: 0, uncontestedRaises: 0, dealsWithUncontestedRaise: 0, contested: 0, strongerSideDeclared: 0, unevenDeals: 0,
  };
  for (let i = 0; i < deals; i++) {
    let s = newDeal(rng.deriveSeed(), (i % 4) as Seat);
    let raisedHere = false;
    while (s.phase === 'auction') {
      const seat = seatToAct(s)!;
      const call = bidder(seatView(s, seat), seat);
      if (call.type === 'bid') {
        stats.bids++;
        const bids = s.auction.calls.filter((c) => c.call.type === 'bid');
        const last = bids[bids.length - 1];
        // A raise of partner's suit while partner already holds the contract.
        if (last && last.seat === partner(seat) && last.call.type === 'bid' && last.call.strain === call.strain) {
          stats.uncontestedRaises++;
          raisedHere = true;
        }
      }
      s = act(s, { type: 'call', seat, call });
    }
    if (raisedHere) stats.dealsWithUncontestedRaise++;
    if (s.phase === 'passedOut') {
      stats.passedOut++;
      continue;
    }
    while (s.phase !== 'complete') {
      if (s.phase === 'awaitingPlayOn') {
        s = act(s, { type: 'endAtClinch' });
        continue;
      }
      const seat = seatToAct(s)!;
      s = act(s, { type: 'play', seat, card: botCard(seatView(s, seat), seat, s.tricks) });
    }
    stats.contracts++;
    const sides = new Set(s.auction.calls.filter((c) => c.call.type === 'bid').map((c) => c.seat % 2));
    if (sides.size === 2) stats.contested++;
    const declarer = s.contract!.declarer;
    const ours = hcp(s.originalHands[declarer]) + hcp(s.originalHands[partner(declarer)]);
    if (ours !== 20) {
      stats.unevenDeals++;
      if (ours > 20) stats.strongerSideDeclared++;
    }
    stats.levelSum += s.contract!.level;
    stats.levels[s.contract!.level]!++;
    if (s.result!.winner === 'declarers') stats.made++;
  }
  return stats;
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)}%`);

function report(name: string, st: Stats): void {
  console.log(`\n${name}`);
  console.log(`  contracts made:           ${pct(st.made, st.contracts)} (${st.made}/${st.contracts})`);
  console.log(`  average contract level:   ${(st.levelSum / Math.max(1, st.contracts)).toFixed(2)}`);
  console.log(`  contracts by level 1–7:   ${st.levels.slice(1).join(' / ')}`);
  console.log(`  pass-out rate:            ${pct(st.passedOut, st.deals)} (${st.passedOut}/${st.deals})`);
  console.log(`  contested auctions:       ${pct(st.contested, st.contracts)} of contracts`);
  console.log(`  stronger side declares:   ${pct(st.strongerSideDeclared, st.unevenDeals)} (when points aren't 20–20)`);
  console.log(`  uncontested raises:       ${pct(st.uncontestedRaises, st.bids)} of all bids; in ${pct(st.dealsWithUncontestedRaise, st.deals)} of deals`);
}

const deals = Number(process.argv[2] ?? 2000);
console.log(`${deals} all-bot deals, same seeds and card play for both.`);
report('Old bidding', simulate(oldBotCall, deals));
report('New bidding (round 15)', simulate(botCall, deals));
