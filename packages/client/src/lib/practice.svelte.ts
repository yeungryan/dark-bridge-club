import {
  isLead,
  leadHoldAfter,
  applyAvatarAction,
  applySessionAction,
  avatarsOf,
  dealHistory,
  dealMoments,
  newThinkClock,
  nightAwards,
  tickThinkClock,
  type Award,
  type DealHistory,
  type Moment,
  type ThinkClock,
  ELEMENTS,
  lockedIn,
  newAvatarLobby,
  rollTheme,
  type AvatarLobby,
  type ThemeBag,
  type ThemeId,
  newSession,
  randomSeed,
  seatToAct,
  tableView,
  type ClientIntent,
  type ClientMessage,
  type ProfileId,
  type ProfileInfo,
  type SessionAction,
  type SessionEvent,
  type SessionState,
} from '@dark/engine';
import { botCall, botCard } from '@dark/engine/bots';
import { Connection } from './connection.svelte';
import { TURBO, TURBO_SPEED } from './juice/timing';

// The practice table: you against three bots, entirely in this browser. It runs the same
// rules engine the server runs and plays the same table screens, but nothing is sent
// anywhere, so it never touches the real night's records. Timers mirror the server's
// (5 s "Play it out?" window, 15 s concession offer); bots never answer concessions.

export const PRACTICE_PROFILES: readonly ProfileInfo[] = [
  { id: 'darren', name: 'Darren', color: '#e0703a' },
  { id: 'adrian', name: 'Adrian', color: '#3a8fe0' },
  { id: 'ryan', name: 'Ryan', color: '#3fb27f' },
  { id: 'kim', name: 'Kim', color: '#b45ad6' },
];
const IDS = PRACTICE_PROFILES.map((p) => p.id) as [ProfileId, ProfileId, ProfileId, ProfileId];
const USUAL_PARTNER: Record<ProfileId, ProfileId> = { darren: 'kim', kim: 'darren', adrian: 'ryan', ryan: 'adrian' };

const CLINCH_MS = TURBO ? 600 : 5000;
const CONCESSION_MS = 15_000;
/** How long bots "think"; a little random so the table doesn't feel mechanical. */
const think = (base: number) => (TURBO ? 30 : base + Math.random() * base * 0.6);

export class PracticeTable extends Connection {
  private session!: SessionState;
  private avatars!: AvatarLobby;
  private theme: ThemeId = 'clubhouse';
  private themeBag: ThemeBag = { remaining: [] };
  private version = 0;
  private clinchAt: number | null = null;
  /** Round 11: when the next set may be led (ms). */
  private leadOpensAt = 0;
  private concessionAt: number | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  /** Moments and awards (S19), worked out here exactly as the server does. */
  private clock: ThinkClock = newThinkClock();
  private history: DealHistory[] = [];
  private gameMoments: Moment[] = [];
  private awards: Award[] | null = null;

  /** `fixedTheme`: practice in one theme every night (practice.html?theme=bali). */
  constructor(
    private readonly me: ProfileId,
    private readonly fixedTheme: ThemeId | null = null,
  ) {
    super(true);
    this.newNight();
  }

  override intent(intent: ClientIntent): void {
    this.apply({ ...intent, by: this.me } as SessionAction);
  }

  override send(message: ClientMessage): void {
    if (message.type === 'intent') this.intent(message.intent);
    else if (message.type === 'newNight') this.newNight();
    else if (message.type === 'avatar') this.avatar(this.me, message.action);
  }

  private newNight(): void {
    this.clearTimers();
    this.session = newSession({ profiles: IDS, usualPartner: USUAL_PARTNER, seed: randomSeed(), swapAnchor: 'ryan' });
    this.clock = newThinkClock();
    this.history = [];
    this.gameMoments = [];
    this.awards = null;
    const last = this.avatars ? Object.fromEntries(IDS.map((id) => [id, this.avatars.picks[id]?.avatar?.animal])) : {};
    this.avatars = newAvatarLobby(IDS, Math.random, last);
    const roll = rollTheme(this.themeBag, Math.random, this.theme);
    this.theme = this.fixedTheme ?? roll.theme;
    this.themeBag = roll.bag;
    this.publish([]);
    // The bots pick their avatars over a few seconds; the night starts when you've picked too.
    IDS.filter((id) => id !== this.me).forEach((id, i) =>
      this.later(900 + i * 700 + Math.random() * 600, () => {
        const offered = this.avatars.picks[id]!.offered;
        const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]!;
        this.avatar(id, { type: 'lock', animal: offered[Math.floor(Math.random() * offered.length)]!, element });
      }),
    );
  }

  private avatar(by: ProfileId, action: Parameters<typeof applyAvatarAction>[2]): void {
    if (this.session.phase !== 'lobby') return;
    const out = applyAvatarAction(this.avatars, by, action, Math.random);
    if (!out.ok) {
      if (by === this.me) this.receive({ type: 'error', code: out.error.code, message: out.error.message });
      return;
    }
    this.avatars = out.state;
    if (lockedIn(this.avatars).length === IDS.length) this.apply({ type: 'start' });
    else this.publish([]);
  }

  private apply(action: SessionAction): void {
    // Round 11, like the server: the next lead waits until the last set has played out.
    if (action.type === 'deal' && action.action.type === 'play' && isLead(this.session.deal) && Date.now() < this.leadOpensAt) {
      if (action.by === this.me) this.receive({ type: 'error', code: 'TOO_SOON', message: 'One moment: the last set is still playing out.' });
      return;
    }
    const outcome = applySessionAction(this.session, action);
    if (!outcome.ok) {
      if ('by' in action && action.by === this.me) this.receive({ type: 'error', code: outcome.error.code, message: outcome.error.message });
      return;
    }
    this.session = outcome.state;
    const hold = leadHoldAfter(outcome.events, outcome.state.deal);
    if (hold !== null) this.leadOpensAt = Date.now() + (TURBO ? hold * TURBO_SPEED : hold);
    this.reconcileTimers(outcome.events);
    this.recordHistory(outcome.events);
    this.publish(outcome.events);
    this.scheduleBots();
  }

  /** Like the server: time each turn, keep each finished game, and award the night. */
  private recordHistory(events: readonly SessionEvent[]): void {
    const s = this.session;
    this.clock = tickThinkClock(this.clock, s, false, Date.now());
    if (!s.seating || !s.pairs) return;
    // The night's starting seating; each game carries its own (seats swap every five games).
    const night = { seating: this.history[0]?.seating ?? s.seating, pairs: s.pairs, deals: this.history };
    for (const record of s.records.slice(this.history.length)) {
      const full = s.deal && s.deal.phase === 'complete' && record.dealNumber === s.dealNumber ? s.deal : null;
      const game = dealHistory(record, full, this.clock.dealNumber === record.dealNumber ? this.clock.totals : null);
      this.history = [...this.history, game];
      this.gameMoments = dealMoments(game, { ...night, deals: this.history });
    }
    if (events.some((e) => e.type === 'nightEnded')) this.awards = nightAwards({ ...night, deals: this.history });
  }

  private publish(events: readonly SessionEvent[]): void {
    const publicEvents = events.map((e) => (e.type === 'dealStarted' ? { ...e, seed: '' } : e));
    this.receive({
      type: 'state',
      seq: ++this.version,
      view: tableView(this.session, this.me),
      room: {
        profiles: PRACTICE_PROFILES,
        presence: Object.fromEntries(IDS.map((id) => [id, 'connected'])),
        paused: false,
        autoCloseAt: null,
        clinchDeadline: this.clinchAt,
        leadOpensAt: this.leadOpensAt > Date.now() ? this.leadOpensAt : null,
        concessionDeadline: this.concessionAt,
        serverTime: Date.now(),
        avatarReady: Object.fromEntries(IDS.map((id) => [id, !!this.avatars.picks[id]?.avatar])),
        avatars: this.session.phase === 'lobby' ? null : avatarsOf(this.avatars),
        pendingReset: null,
        theme: this.theme,
        gameMoments: this.gameMoments,
        awards: this.session.phase === 'ended' ? this.awards : null,
      },
      events: publicEvents,
      myAvatar: this.avatars.picks[this.me] ?? null,
    });
  }

  private reconcileTimers(events: readonly SessionEvent[]): void {
    const deal = this.session.deal;
    const fresh = (type: string) => events.some((e) => e.type === 'deal' && e.event.type === type);
    if (deal?.phase === 'awaitingPlayOn') {
      if (this.clinchAt === null || fresh('clinched')) {
        this.clinchAt = Date.now() + CLINCH_MS;
        const at = this.clinchAt;
        this.later(CLINCH_MS, () => {
          if (this.clinchAt === at && this.session.deal?.phase === 'awaitingPlayOn') this.apply({ type: 'dealTimer', action: 'endAtClinch' });
        });
      }
    } else this.clinchAt = null;
    if (deal?.concession) {
      if (this.concessionAt === null || fresh('concessionProposed')) {
        this.concessionAt = Date.now() + CONCESSION_MS;
        const at = this.concessionAt;
        this.later(CONCESSION_MS, () => {
          if (this.concessionAt === at && this.session.deal?.concession) this.apply({ type: 'dealTimer', action: 'expireConcession' });
        });
      }
    } else this.concessionAt = null;
  }

  /** Whatever a bot should do next, after a human-feeling pause. */
  private scheduleBots(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
    const s = this.session;
    const bots = IDS.filter((id) => id !== this.me);
    let delay = 0;
    let action: SessionAction | null = null;

    const voter = s.endNightVotes.length > 0 ? bots.find((b) => !s.endNightVotes.includes(b)) : undefined;
    if (voter) {
      action = { type: 'voteEndNight', by: voter };
      delay = think(300);
    } else if (s.phase === 'partnerPick' && s.captain && s.captain !== this.me) {
      action = { type: 'pickPartner', by: s.captain, partner: s.suggestedPartner ?? bots.find((b) => b !== s.captain)! };
      delay = 3500; // let the captain draw play out
    } else if (s.phase === 'awaitingDeal' && s.dealer !== null && s.seating![s.dealer] !== this.me) {
      // A bot dealer shuffles for a moment, then deals.
      action = { type: 'dealCards', by: s.seating![s.dealer] };
      delay = think(1600);
    } else if (s.phase === 'betweenDeals') {
      const waiting = bots.find((b) => !s.readyForNext.includes(b));
      if (waiting) {
        action = { type: 'readyForNext', by: waiting };
        delay = think(500);
      }
    } else if (s.phase === 'inDeal' && s.deal) {
      const seat = seatToAct(s.deal);
      const by = seat === null ? null : s.seating![seat];
      if (seat !== null && by && by !== this.me) {
        const view = tableView(s, by).deal!;
        if (s.deal.phase === 'auction') {
          action = { type: 'deal', by, action: { type: 'call', call: botCall(view, seat) } };
          delay = think(700);
        } else if (s.deal.phase === 'play') {
          action = { type: 'deal', by, action: { type: 'play', card: botCard(view, seat) } };
          // Leading to a fresh trick waits for the last one to be swept up (round 11: at least
          // until the lead opens).
          delay = think(s.deal.currentTrick?.cards.length ? 650 : 1300);
          if (isLead(s.deal)) delay = Math.max(delay, this.leadOpensAt - Date.now() + 50);
        }
      }
    }
    if (action) {
      const a = action;
      this.botTimer = setTimeout(() => this.apply(a), delay);
    }
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.botTimer) clearTimeout(this.botTimer);
    this.clinchAt = null;
    this.concessionAt = null;
  }
}
