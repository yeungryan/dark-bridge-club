import { applyDealAction, newDeal, type DealAction, type DealEvent, type DealResult, type DealState } from './deal';
import { Rng, rngStateFromSeed, type RngState, type Seed } from './rng';
import { next, partner, SEATS } from './seats';
import { fail, type Contract, type Outcome, type PerSeat, type Seat } from './types';

// Spec S05: everything that spans more than one deal in a night.

export type ProfileId = string;

/** Pair "A" is the captain's pair; pair "B" is the other two. */
export type PairId = 'A' | 'B';

export interface SessionConfig {
  /** The four players. */
  readonly profiles: readonly [ProfileId, ProfileId, ProfileId, ProfileId];
  /** Each player's usual partner, pre-selected when they are captain (R1). */
  readonly usualPartner: Readonly<Record<ProfileId, ProfileId>>;
  /** Server-generated; makes the whole night replayable. */
  readonly seed: Seed;
  /** Ryan: the pair this player is in trades seats every SWAP_EVERY games (S05 seat swap). */
  readonly swapAnchor?: ProfileId;
}

/** Games between seat swaps, within one night. */
export const SWAP_EVERY = 5;

/** `awaitingDeal`: the next dealer is known and the deck is being shuffled; nothing is dealt
 * until they tap Deal (Ryan: the dealer starts each game, no automatic deal). */
export type SessionPhase = 'lobby' | 'partnerPick' | 'awaitingDeal' | 'inDeal' | 'betweenDeals' | 'ended';

export interface DealRecord {
  readonly dealNumber: number;
  readonly dealer: Seat;
  readonly seed: Seed;
  /** null for a pass-out. */
  readonly contract: Contract | null;
  readonly result: DealResult | null;
  /** The pair that won the deal, or null for a pass-out. */
  readonly winningPair: PairId | null;
  /** Who sat where for this game (seats can swap during a night); absent on older games. */
  readonly seating?: PerSeat<ProfileId>;
}

export interface NightResult {
  readonly winner: PairId | 'tie';
  readonly reason: 'agreed' | 'autoClosed';
  readonly wins: Readonly<Record<PairId, number>>;
  /** True if a deal was in progress and thrown away when the night ended. */
  readonly discardedDeal: boolean;
}

export interface SessionState {
  readonly config: SessionConfig;
  readonly rng: RngState;
  readonly phase: SessionPhase;
  readonly captain: ProfileId | null;
  readonly suggestedPartner: ProfileId | null;
  readonly pairs: Readonly<Record<PairId, readonly [ProfileId, ProfileId]>> | null;
  readonly seating: PerSeat<ProfileId> | null;
  readonly dealer: Seat | null;
  readonly dealNumber: number;
  readonly deal: DealState | null;
  readonly records: readonly DealRecord[];
  readonly wins: Readonly<Record<PairId, number>>;
  readonly passOuts: number;
  readonly readyForNext: readonly ProfileId[];
  readonly endNightVotes: readonly ProfileId[];
  readonly final: NightResult | null;
}

/** Deal actions a player can send; the session fills in their seat. */
export type PlayerDealAction =
  | { type: 'call'; call: Extract<DealAction, { type: 'call' }>['call'] }
  | { type: 'play'; card: Extract<DealAction, { type: 'play' }>['card'] }
  | { type: 'playOn' }
  | { type: 'proposeConcession' }
  | { type: 'acceptConcession' }
  | { type: 'declineConcession' };

export type SessionAction =
  /** Server: all four players are connected. */
  | { type: 'start' }
  | { type: 'pickPartner'; by: ProfileId; partner: ProfileId }
  | { type: 'deal'; by: ProfileId; action: PlayerDealAction }
  /** Server timers (R11 clinch window, S04 concession expiry). */
  | { type: 'dealTimer'; action: 'endAtClinch' | 'expireConcession' }
  | { type: 'readyForNext'; by: ProfileId }
  /** The dealer deals the next game. */
  | { type: 'dealCards'; by: ProfileId }
  | { type: 'voteEndNight'; by: ProfileId }
  | { type: 'cancelEndNight'; by: ProfileId }
  /** Server: a player has been away for 30 minutes (S05, S08). */
  | { type: 'autoClose' };

export type SessionEvent =
  | { type: 'captainDrawn'; captain: ProfileId; suggestedPartner: ProfileId | null }
  | { type: 'partnerChosen'; captain: ProfileId; partner: ProfileId; pairs: Record<PairId, [ProfileId, ProfileId]> }
  | { type: 'seated'; seating: PerSeat<ProfileId> }
  /** Two partners traded seats: everyone's left and right opponents trade places. */
  | { type: 'seatsSwapped'; seating: PerSeat<ProfileId>; players: [ProfileId, ProfileId] }
  | { type: 'awaitingDeal'; dealer: Seat }
  | { type: 'dealStarted'; dealNumber: number; dealer: Seat; seed: Seed }
  | { type: 'deal'; event: DealEvent }
  | { type: 'redeal'; nextDealer: Seat }
  | { type: 'tallyUpdated'; wins: Record<PairId, number>; winningPair: PairId }
  | { type: 'readyChanged'; ready: ProfileId[] }
  | { type: 'endNightVotesChanged'; votes: ProfileId[] }
  | { type: 'nightEnded'; final: NightResult };

type SessionOutcome = Outcome<SessionState, SessionEvent>;

export function newSession(config: SessionConfig): SessionState {
  if (new Set(config.profiles).size !== 4) throw new Error('A session needs four distinct players');
  return {
    config,
    rng: rngStateFromSeed(config.seed),
    phase: 'lobby',
    captain: null,
    suggestedPartner: null,
    pairs: null,
    seating: null,
    dealer: null,
    dealNumber: 0,
    deal: null,
    records: [],
    wins: { A: 0, B: 0 },
    passOuts: 0,
    readyForNext: [],
    endNightVotes: [],
    final: null,
  };
}

export function seatOf(state: SessionState, profile: ProfileId): Seat | null {
  if (!state.seating) return null;
  return SEATS.find((s) => state.seating![s] === profile) ?? null;
}

export function pairOfSeat(state: SessionState, seat: Seat): PairId {
  const occupant = state.seating![seat];
  return state.pairs!.A.includes(occupant) ? 'A' : 'B';
}

export function applySessionAction(state: SessionState, action: SessionAction): SessionOutcome {
  if (state.phase === 'ended') return fail('NIGHT_ENDED', 'This night is over.');
  switch (action.type) {
    case 'start':
      return start(state);
    case 'pickPartner':
      return pickPartner(state, action.by, action.partner);
    case 'deal':
      return playerDealAction(state, action.by, action.action);
    case 'dealTimer':
      return dealTimer(state, action.action);
    case 'readyForNext':
      return readyForNext(state, action.by);
    case 'dealCards':
      return dealCards(state, action.by);
    case 'voteEndNight':
      return voteEndNight(state, action.by);
    case 'cancelEndNight':
      return cancelEndNight(state, action.by);
    case 'autoClose':
      return endNight(state, 'autoClosed', []);
  }
}

function isPlayer(state: SessionState, profile: ProfileId): boolean {
  return state.config.profiles.includes(profile);
}

function start(state: SessionState): SessionOutcome {
  if (state.phase !== 'lobby') return fail('ALREADY_STARTED', 'The night has already started.');
  const rng = new Rng(state.rng);
  const captain = rng.pick(state.config.profiles);
  const usual = state.config.usualPartner[captain];
  const suggestedPartner = usual && usual !== captain && isPlayer(state, usual) ? usual : null;
  return {
    ok: true,
    state: { ...state, rng: rng.state(), phase: 'partnerPick', captain, suggestedPartner },
    events: [{ type: 'captainDrawn', captain, suggestedPartner }],
  };
}

function pickPartner(state: SessionState, by: ProfileId, chosen: ProfileId): SessionOutcome {
  if (state.phase !== 'partnerPick') return fail('NOT_PICKING', 'Partners are not being picked right now.');
  if (by !== state.captain) return fail('NOT_CAPTAIN', 'Only the captain picks a partner.');
  if (chosen === by || !isPlayer(state, chosen)) return fail('BAD_PARTNER', 'Pick one of the other three players.');

  const others = state.config.profiles.filter((p) => p !== by && p !== chosen);
  const pairs: Record<PairId, [ProfileId, ProfileId]> = { A: [by, chosen], B: [others[0]!, others[1]!] };

  // Random seating with partners opposite: a random seat for the captain, a random side for pair B.
  const rng = new Rng(state.rng);
  const captainSeat = rng.pick(SEATS);
  const flip = rng.int(2) === 1;
  const seating = {} as PerSeat<ProfileId>;
  seating[captainSeat] = by;
  seating[partner(captainSeat)] = chosen;
  seating[next(captainSeat)] = flip ? pairs.B[1] : pairs.B[0];
  seating[partner(next(captainSeat))] = flip ? pairs.B[0] : pairs.B[1];
  const dealer = rng.pick(SEATS);

  const events: SessionEvent[] = [
    { type: 'partnerChosen', captain: by, partner: chosen, pairs },
    { type: 'seated', seating },
  ];
  const seated: SessionState = { ...state, rng: rng.state(), pairs, seating };
  return awaitDeal(seated, dealer, events);
}

/** The next game is ready to be dealt: its dealer shuffles until they tap Deal. */
function awaitDeal(state: SessionState, dealer: Seat, events: SessionEvent[]): SessionOutcome {
  events.push({ type: 'awaitingDeal', dealer });
  return { ok: true, state: { ...state, phase: 'awaitingDeal', dealer, deal: null, readyForNext: [] }, events };
}

/** Only the dealer can deal, and only when a game is waiting to be dealt. */
function dealCards(state: SessionState, by: ProfileId): SessionOutcome {
  if (state.phase !== 'awaitingDeal') return fail('NOT_DEALING', 'There is nothing to deal right now.');
  if (seatOf(state, by) !== state.dealer) return fail('NOT_DEALER', 'Only the dealer can deal.');
  return startDeal(state, state.dealer!, []);
}

function startDeal(state: SessionState, dealer: Seat, events: SessionEvent[]): SessionOutcome {
  const rng = new Rng(state.rng);
  const seed = rng.deriveSeed();
  const dealNumber = state.dealNumber + 1;
  events.push({ type: 'dealStarted', dealNumber, dealer, seed });
  return {
    ok: true,
    state: {
      ...state,
      rng: rng.state(),
      phase: 'inDeal',
      dealer,
      dealNumber,
      deal: newDeal(seed, dealer),
      readyForNext: [],
    },
    events,
  };
}

function playerDealAction(state: SessionState, by: ProfileId, action: PlayerDealAction): SessionOutcome {
  if (state.phase !== 'inDeal' || !state.deal) return fail('NO_DEAL', 'No deal is in progress.');
  const seat = seatOf(state, by);
  if (seat === null) return fail('NOT_SEATED', 'That player is not at the table.');
  return applyToDeal(state, { ...action, seat } as DealAction);
}

function dealTimer(state: SessionState, action: 'endAtClinch' | 'expireConcession'): SessionOutcome {
  if (state.phase !== 'inDeal' || !state.deal) return fail('NO_DEAL', 'No deal is in progress.');
  return applyToDeal(state, { type: action });
}

function applyToDeal(state: SessionState, action: DealAction): SessionOutcome {
  const outcome = applyDealAction(state.deal!, action);
  if (!outcome.ok) return outcome;
  const deal = outcome.state;
  const events: SessionEvent[] = outcome.events.map((event) => ({ type: 'deal', event }));
  const updated: SessionState = { ...state, deal };

  if (deal.phase === 'passedOut') {
    const record: DealRecord = {
      dealNumber: state.dealNumber,
      dealer: deal.dealer,
      seed: deal.seed!,
      contract: null,
      result: null,
      winningPair: null,
      seating: state.seating!,
    };
    const nextDealer = next(deal.dealer);
    events.push({ type: 'redeal', nextDealer });
    return awaitDeal({ ...updated, records: [...state.records, record], passOuts: state.passOuts + 1 }, nextDealer, events);
  }

  if (deal.phase === 'complete') {
    const result = deal.result!;
    const contract = deal.contract!;
    const declarerPair = pairOfSeat(state, contract.declarer);
    const winningPair: PairId = result.winner === 'declarers' ? declarerPair : declarerPair === 'A' ? 'B' : 'A';
    const wins = { ...state.wins, [winningPair]: state.wins[winningPair] + 1 };
    const record: DealRecord = {
      dealNumber: state.dealNumber,
      dealer: deal.dealer,
      seed: deal.seed!,
      contract,
      result,
      winningPair,
      seating: state.seating!,
    };
    events.push({ type: 'tallyUpdated', wins, winningPair });
    return {
      ok: true,
      state: { ...updated, phase: 'betweenDeals', wins, records: [...state.records, record], readyForNext: [] },
      events,
    };
  }

  return { ok: true, state: updated, events };
}

/** The reveal stays up until all four tap "Next deal" (S14). */
function readyForNext(state: SessionState, by: ProfileId): SessionOutcome {
  if (state.phase !== 'betweenDeals') return fail('NOT_BETWEEN_DEALS', 'There is no finished deal to move on from.');
  if (!isPlayer(state, by)) return fail('NOT_A_PLAYER', 'Unknown player.');
  if (state.readyForNext.includes(by)) return { ok: true, state, events: [] };
  const ready = [...state.readyForNext, by];
  const events: SessionEvent[] = [{ type: 'readyChanged', ready }];
  if (ready.length < 4) return { ok: true, state: { ...state, readyForNext: ready }, events };
  return awaitDeal(swapSeats({ ...state, readyForNext: ready }, events), next(state.dealer!), events);
}

/**
 * Ryan: after every fifth game played (pass-outs are redeals, so they don't count), the anchor's
 * pair trades seats. Partners stay opposite, so on everyone's screen it's the opponents on the
 * left and right who trade places, and the bidding and play order changes. The dealer button stays
 * with the seat. A new night starts from its own seating.
 */
function swapSeats(state: SessionState, events: SessionEvent[]): SessionState {
  const anchor = state.config.swapAnchor;
  const played = state.wins.A + state.wins.B;
  if (!anchor || played === 0 || played % SWAP_EVERY !== 0) return state;
  const seat = seatOf(state, anchor);
  if (seat === null) return state;
  const mate = partner(seat);
  const seating = { ...state.seating!, [seat]: state.seating![mate], [mate]: anchor } as PerSeat<ProfileId>;
  events.push({ type: 'seatsSwapped', seating, players: [anchor, state.seating![mate]] });
  return { ...state, seating };
}

/** Ending the night needs all four votes (S05). */
function voteEndNight(state: SessionState, by: ProfileId): SessionOutcome {
  if (state.phase !== 'inDeal' && state.phase !== 'betweenDeals' && state.phase !== 'awaitingDeal') {
    return fail('CANNOT_END_YET', 'The night can only be ended once play has started.');
  }
  if (!isPlayer(state, by)) return fail('NOT_A_PLAYER', 'Unknown player.');
  if (state.endNightVotes.includes(by)) return { ok: true, state, events: [] };
  const votes = [...state.endNightVotes, by];
  const events: SessionEvent[] = [{ type: 'endNightVotesChanged', votes }];
  if (votes.length < 4) return { ok: true, state: { ...state, endNightVotes: votes }, events };
  return endNight({ ...state, endNightVotes: votes }, 'agreed', events);
}

function cancelEndNight(state: SessionState, by: ProfileId): SessionOutcome {
  if (!isPlayer(state, by)) return fail('NOT_A_PLAYER', 'Unknown player.');
  if (state.endNightVotes.length === 0) return { ok: true, state, events: [] };
  return {
    ok: true,
    state: { ...state, endNightVotes: [] },
    events: [{ type: 'endNightVotesChanged', votes: [] }],
  };
}

/** An unfinished deal is discarded and does not count (R13). */
function endNight(state: SessionState, reason: NightResult['reason'], events: SessionEvent[]): SessionOutcome {
  const discardedDeal = state.phase === 'inDeal';
  const { A, B } = state.wins;
  const final: NightResult = { winner: A > B ? 'A' : B > A ? 'B' : 'tie', reason, wins: state.wins, discardedDeal };
  events.push({ type: 'nightEnded', final });
  return { ok: true, state: { ...state, phase: 'ended', deal: null, final }, events };
}

