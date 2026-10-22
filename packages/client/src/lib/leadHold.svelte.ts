// Round 11 (Ryan, option A): after a set, the next card can't be led until that set has played
// out on everyone's screen (the server says when: room.leadOpensAt). Until then the leader's
// cards stay asleep; the Table keeps this up to date.
class LeadHold {
  /** True while the next lead has to wait. */
  waiting = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** `opensAt` in server time; `now` is the server's clock as this phone reckons it. */
  update(opensAt: number | null, now: number): void {
    clearTimeout(this.timer);
    const left = opensAt === null ? 0 : opensAt - now;
    this.waiting = left > 0;
    if (left > 0) this.timer = setTimeout(() => (this.waiting = false), left);
  }
}

export const leadHold = new LeadHold();
