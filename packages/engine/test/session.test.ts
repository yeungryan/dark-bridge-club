import { describe, expect, it } from 'vitest';
import {
  applySessionAction,
  bid,
  legalPlays,
  newSession,
  next,
  PASS,
  seatOf,
  seatToAct,
  type Call,
  type SessionAction,
  type SessionConfig,
  type SessionState,
} from '../src';

const config: SessionConfig = {
  profiles: ['darren', 'adrian', 'ryan', 'kim'],
  usualPartner: { darren: 'kim', kim: 'darren', adrian: 'ryan', ryan: 'adrian' },
  seed: '11112222333344445555666677778888',
};

function apply(state: SessionState, action: SessionAction): SessionState {
  const out = applySessionAction(state, action);
  if (!out.ok) throw new Error(`${action.type} rejected: ${out.error.code}`);
  return out.state;
}

/** Whoever is due to act in the current deal. */
function actor(s: SessionState): string {
  return s.seating![seatToAct(s.deal!)!];
}

function seated(captainPicksUsual = true): SessionState {
  let s = apply(newSession(config), { type: 'start' });
  const partner = captainPicksUsual ? s.suggestedPartner! : config.profiles.find((p) => p !== s.captain && p !== s.suggestedPartner)!;
  return apply(s, { type: 'pickPartner', by: s.captain!, partner });
}

function call(s: SessionState, c: Call): SessionState {
  return apply(s, { type: 'deal', by: actor(s), action: { type: 'call', call: c } });
}

/** Bid 1NT and play every deal to the clinch with the first legal card, then end at the clinch. */
function playDeal(s: SessionState): SessionState {
  s = [bid(1, 'NT'), PASS, PASS, PASS].reduce(call, s);
  while (s.deal!.phase === 'play') {
    const seat = seatToAct(s.deal!)!;
    const card = legalPlays(s.deal!.hands[seat], s.deal!.currentTrick!.cards)[0]!;
    s = apply(s, { type: 'deal', by: s.seating![seat], action: { type: 'play', card } });
  }
  if (s.deal!.phase === 'awaitingPlayOn') s = apply(s, { type: 'dealTimer', action: 'endAtClinch' });
  return s;
}

function allReady(s: SessionState): SessionState {
  return config.profiles.reduce((acc, by) => apply(acc, { type: 'readyForNext', by }), s);
}

describe('S05 session', () => {
  it('draws a captain and pre-selects their usual partner', () => {
    const s = apply(newSession(config), { type: 'start' });
    expect(s.phase).toBe('partnerPick');
    expect(config.profiles).toContain(s.captain);
    expect(s.suggestedPartner).toBe(config.usualPartner[s.captain!]);
  });

  it('only the captain picks, and never themselves', () => {
    const s = apply(newSession(config), { type: 'start' });
    const other = config.profiles.find((p) => p !== s.captain)!;
    expect(applySessionAction(s, { type: 'pickPartner', by: other, partner: s.captain! }).ok).toBe(false);
    expect(applySessionAction(s, { type: 'pickPartner', by: s.captain!, partner: s.captain! }).ok).toBe(false);
  });

  it('the captain can override the suggested partner', () => {
    const s = seated(false);
    expect(s.pairs!.A).not.toContain(s.suggestedPartner);
  });

  it('seats partners opposite each other', () => {
    const s = seated();
    for (const pair of [s.pairs!.A, s.pairs!.B]) {
      const a = seatOf(s, pair[0])!;
      expect(next(next(a))).toBe(seatOf(s, pair[1]));
    }
  });

  it('the dealer rotates counter-clockwise every deal, including after a pass-out', () => {
    let s = seated();
    const first = s.dealer!;
    const dealers = [first];
    s = [PASS, PASS, PASS, PASS].reduce(call, s); // pass-out → immediate redeal
    expect(s.passOuts).toBe(1);
    dealers.push(s.dealer!);
    for (let i = 0; i < 6; i++) {
      s = allReady(playDeal(s));
      dealers.push(s.dealer!);
    }
    for (let i = 1; i < dealers.length; i++) expect(dealers[i]).toBe(next(dealers[i - 1]!));
  });

  it('the tally always equals deals played minus pass-outs, and partnerships never change', () => {
    let s = seated();
    const pairs = s.pairs;
    s = [PASS, PASS, PASS, PASS].reduce(call, s);
    for (let i = 0; i < 5; i++) s = allReady(playDeal(s));
    s = playDeal(s);
    expect(s.wins.A + s.wins.B).toBe(s.records.length - s.passOuts);
    expect(s.wins.A + s.wins.B).toBe(6);
    expect(s.pairs).toEqual(pairs);
  });

  it('the next deal waits until all four are ready', () => {
    let s = playDeal(seated());
    expect(s.phase).toBe('betweenDeals');
    for (const by of config.profiles.slice(0, 3)) s = apply(s, { type: 'readyForNext', by });
    expect(s.phase).toBe('betweenDeals');
    s = apply(s, { type: 'readyForNext', by: config.profiles[3] });
    expect(s.phase).toBe('inDeal');
  });

  it('ending the night needs all four votes; a tie is a valid result', () => {
    let s = seated();
    for (const by of config.profiles.slice(0, 3)) s = apply(s, { type: 'voteEndNight', by });
    expect(s.phase).toBe('inDeal');
    s = apply(s, { type: 'cancelEndNight', by: 'kim' });
    expect(s.endNightVotes).toEqual([]);
    for (const by of config.profiles) s = apply(s, { type: 'voteEndNight', by });
    expect(s.phase).toBe('ended');
    expect(s.final).toEqual({ winner: 'tie', reason: 'agreed', wins: { A: 0, B: 0 }, discardedDeal: true });
  });

  it('auto-close after 30 minutes away keeps the tally and discards the unfinished deal', () => {
    let s = allReady(playDeal(seated()));
    s = call(s, bid(1, 'C'));
    s = apply(s, { type: 'autoClose' });
    expect(s.phase).toBe('ended');
    expect(s.final!.reason).toBe('autoClosed');
    expect(s.final!.discardedDeal).toBe(true);
    expect(s.final!.wins.A + s.final!.wins.B).toBe(1);
    expect(applySessionAction(s, { type: 'start' }).ok).toBe(false);
  });

  it('the same session seed replays identically', () => {
    const a = playDeal(seated());
    const b = playDeal(seated());
    expect(a).toEqual(b);
  });
});
