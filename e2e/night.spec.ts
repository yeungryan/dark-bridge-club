import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

// A whole night through the real UI and server: three practice bots plus Ryan,
// whom this test plays by tapping the screen like a person would.

type Frame = { type: string; view?: any; events?: any[] };

interface Player {
  id: string;
  pin: string;
  bot: boolean;
  context: BrowserContext;
  page: Page;
  frames: Frame[];
}

const SEATS = [
  { id: 'darren', pin: '1111', bot: true, slot: 1 },
  { id: 'adrian', pin: '2222', bot: true, slot: 2 },
  { id: 'ryan', pin: '3333', bot: false, slot: 3 },
  { id: 'kim', pin: '4444', bot: true, slot: 4 },
];

async function openPlayer(browser: Browser, seat: (typeof SEATS)[number]): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const player: Player = { ...seat, context, page, frames: [] };
  watchFrames(player, page);
  await page.goto(`/?slot=${seat.slot}&k=dev&as=${seat.id}&pin=${seat.pin}&bot=${seat.bot ? 1 : 0}`);
  return player;
}

function watchFrames(player: Player, page: Page): void {
  page.on('websocket', (ws) => ws.on('framereceived', (f) => player.frames.push(JSON.parse(String(f.payload)))));
}

/** Plays Ryan's turns until `deals` more deals have finished. */
async function playAsHuman(page: Page, deals: number): Promise<void> {
  let finished = 0;
  const deadline = Date.now() + 4 * 60_000;
  while (finished < deals) {
    if (Date.now() > deadline) throw new Error('Timed out playing as Ryan');

    const partnerButton = page.getByRole('button', { name: /^Partner with/ });
    if (await partnerButton.isVisible()) {
      await partnerButton.click();
      continue;
    }
    const nextDeal = page.getByRole('button', { name: 'Next deal' });
    if (await nextDeal.isVisible() && (await nextDeal.isEnabled())) {
      await nextDeal.click();
      finished++;
      continue;
    }
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    if (await pass.isVisible()) {
      await pass.click();
      await page.getByRole('button', { name: 'Confirm Pass' }).click();
      continue;
    }
    if (await page.getByText('Your turn to play').isVisible()) {
      // Tap a playable (not dimmed) card twice: raise, then play.
      const playable = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
      // Cards overlap, so tap the visible left edge, like a thumb would.
      await playable.click({ position: { x: 10, y: 30 } });
      await playable.click({ position: { x: 10, y: 30 } });
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(200);
  }
}

test.describe.serial('a night at the DARK table', () => {
  let players: Player[] = [];
  const ryan = () => players.find((p) => p.id === 'ryan')!;

  test.beforeAll(async ({ browser }) => {
    players = await Promise.all(SEATS.map((s) => openPlayer(browser, s)));
  });

  test.afterAll(async () => {
    await Promise.all(players.map((p) => p.context.close()));
  });

  test('the night starts once all four are here, and Ryan can bid and play two full deals', async () => {
    await playAsHuman(ryan().page, 2);
    const last = ryan().frames.filter((f) => f.type === 'state').at(-1)!;
    expect(last.view.wins.A + last.view.wins.B).toBeGreaterThanOrEqual(2);
  });

  test('no browser ever receives another player’s cards or a deal seed before the reveal', async () => {
    for (const player of players) {
      const states = player.frames.filter((f) => f.type === 'state');
      expect(states.length).toBeGreaterThan(20);
      for (const s of states) {
        const deal = s.view.deal;
        for (const e of s.events ?? []) if (e.type === 'dealStarted') expect(e.seed).toBe('');
        if (!deal) continue;
        if (deal.phase !== 'complete') expect(deal.revealedHands).toBeNull();
        expect(deal.hand.length).toBe(s.view.mySeat === null ? 0 : deal.handCounts[s.view.mySeat]);
        expect(JSON.stringify(s)).not.toMatch(/"seed":"[0-9a-f]{32}"/);
      }
    }
  });

  test('if Ryan drops, the table pauses; when he comes back, play resumes with his hand restored', async () => {
    const darren = players[0]!;
    const before = ryan().frames.filter((f) => f.type === 'state').at(-1)!.view.deal?.hand ?? [];
    await ryan().page.close();

    await expect(darren.page.getByText('Waiting for Ryan')).toBeVisible({ timeout: 20_000 });

    const page = await ryan().context.newPage();
    ryan().page = page;
    watchFrames(ryan(), page);
    await page.goto('/?slot=3');
    await expect(darren.page.getByText('Waiting for Ryan')).toBeHidden({ timeout: 15_000 });
    const after = ryan().frames.filter((f) => f.type === 'state').at(-1)!.view.deal?.hand ?? [];
    // Bots may not move while paused, so the hand is unchanged unless Ryan was mid-trick.
    expect(after.length).toBeGreaterThanOrEqual(before.length - 1);
  });

  test('ending the night needs everyone, then shows the final score', async () => {
    const page = ryan().page;
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'End the night' }).click();
    await expect(page.getByText(/win the night|A dead heat/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Start a new night' })).toBeVisible();
  });
});
