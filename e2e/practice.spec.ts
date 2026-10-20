import { expect, test, type Locator, type Page } from '@playwright/test';

// The practice table (you against three bots, all in the browser) on an emulated phone,
// which also lets us check what a real night can't easily show: that sound switches on
// after a tap, and that every step of the feel ladder actually fires.

const sounds = (page: Page) => page.evaluate(() => (window as unknown as { __darkSounds: string[] }).__darkSounds.slice());

async function tap(locator: Locator): Promise<boolean> {
  return locator.tap({ timeout: 3000 }).then(
    () => true,
    () => false,
  );
}

/** Drag a card from the hand onto the middle of the table, like a thumb would. */
async function dragToTable(page: Page, card: Locator): Promise<void> {
  const from = (await card.boundingBox())!;
  const area = (await page.locator('.area').boundingBox())!;
  const x0 = from.x + 10;
  const y0 = from.y + 30;
  const x1 = area.x + area.width / 2;
  const y1 = area.y + area.height * 0.7;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
  await page.mouse.up();
}

/** Move along (captain draw, partner pick, Next deal, passing) until `until` is true. */
async function playUntil(page: Page, until: () => Promise<boolean>, opts: { bidSuitFirst?: boolean } = {}): Promise<void> {
  const deadline = Date.now() + 150_000;
  while (!(await until())) {
    if (Date.now() > deadline) throw new Error('Practice table got stuck');
    const skip = page.getByRole('button', { name: 'Skip the captain draw' });
    const partner = page.getByRole('button', { name: /^Partner with/ });
    const next = page.getByRole('button', { name: 'Next deal' });
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    const surprise = page.getByRole('button', { name: 'Surprise me' });
    if (await surprise.isVisible()) await tap(surprise);
    else if (await skip.isVisible()) await tap(skip);
    else if (await partner.isVisible()) await tap(partner);
    else if ((await next.isVisible()) && (await next.isEnabled())) await tap(next);
    else if (await pass.isVisible()) {
      if (await tap(pass)) await tap(page.getByRole('button', { name: 'Confirm Pass' }));
    } else if (await page.getByText('Your turn to play').isVisible()) {
      await dragToTable(page, page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first());
      await page.waitForTimeout(200);
    } else await page.waitForTimeout(150);
  }
}

test('no sound before the first tap; after it, the game is audible', async ({ page }) => {
  await page.goto('/practice.html');
  // The bots' avatar picks happen before anyone has touched the phone: no sound yet.
  await page.waitForTimeout(1500);
  expect(await sounds(page)).toEqual([]);
  await playUntil(page, async () => (await sounds(page)).length > 0);
  expect(await page.evaluate(() => (window as unknown as { __darkSounds: string[] }).__darkSounds.length)).toBeGreaterThan(0);
});

test('a bid can be chosen suit first, then level', async ({ page }) => {
  await page.goto('/practice.html');
  await playUntil(page, () => page.locator('.box .strains').isVisible());
  const strain = page.locator('.strains button:not([disabled])').last();
  await strain.tap();
  await expect(page.locator('.confirm')).toContainText('choose a level');
  await page.locator('.levels button:not([disabled]):not(.faint)').first().tap();
  await expect(page.locator('.confirm')).toContainText(/^Bid \d/);
  const label = ((await page.locator('.confirm').textContent()) ?? '').replace('Bid ', '').trim();
  await page.locator('.confirm').tap();
  await expect(page.locator('.strip .call').filter({ hasText: 'Ryan' }).last()).toContainText(label);
});

test('a whole deal by dragging cards: every beat of the feel ladder fires', async ({ page }) => {
  await page.goto('/practice.html');
  await playUntil(page, () => page.getByRole('button', { name: 'Next deal' }).isVisible());
  // A deal settled on its last trick ends at once; its clinch lands a moment later.
  await expect.poll(async () => (await sounds(page)).includes('clinch'), { timeout: 3000 }).toBe(true);
  const heard = new Set(await sounds(page));
  for (const beat of ['card', 'pass', 'sold', 'sweep', 'pip', 'clinch']) expect(heard, `missing "${beat}"`).toContain(beat);
  // Somebody took the lead of a trick at some point in 13 tricks... unless every trick was won by its opening lead.
  expect(heard.has('lead') || heard.has('trumpIn')).toBe(true);
});

test('Tap twice style: the second tap plays the raised card', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dark.main.settings', JSON.stringify({ playStyle: 'tap', v: 2 })));
  await page.goto('/practice.html');
  await playUntil(page, () => page.getByText('Your turn to play').isVisible());
  const before = await page.locator('.hand .slot').count();
  const card = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
  await card.click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot.up')).toHaveCount(1);
  await page.locator('.hand .slot.up').click({ position: { x: 10, y: 30 } });
  await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
});

test('Drag style: a second tap does not play; it asks for a swipe', async ({ page }) => {
  await page.goto('/practice.html');
  await playUntil(page, () => page.getByText('Your turn to play').isVisible());
  const before = await page.locator('.hand .slot').count();
  const card = page.locator('.hand .slot').filter({ has: page.locator('.card:not(.dim)') }).first();
  await card.click({ position: { x: 10, y: 30 } });
  await page.locator('.hand .slot.up').click({ position: { x: 10, y: 30 } });
  await expect(page.getByText('Swipe it up to the table to play.')).toBeVisible();
  await expect(page.locator('.hand .slot')).toHaveCount(before);
  await dragToTable(page, page.locator('.hand .slot.up'));
  await expect(page.locator('.hand .slot')).toHaveCount(before - 1);
});

test('avatars: pick an animal and element, then everyone flips together and shows on the table', async ({ page }) => {
  await page.goto('/practice.html');
  await expect(page.getByText('Who are you tonight?')).toBeVisible();
  // Three animals on offer; one reroll, then it's used up.
  await expect(page.locator('.picker .animal')).toHaveCount(3);
  const before = await page.locator('.picker .animal').allTextContents();
  await page.getByRole('button', { name: /Show me three others/ }).tap();
  await expect(page.getByRole('button', { name: 'Reroll used' })).toBeDisabled();
  const after = await page.locator('.picker .animal').allTextContents();
  expect(after.some((a) => before.includes(a))).toBe(false);

  await page.locator('.picker .animal').first().tap();
  await page.getByRole('button', { name: /Water/ }).tap();
  await page.getByRole('button', { name: /^Lock in Water/ }).tap();
  // The bots pick too; then the four avatars flip, and Ryan's badge carries his.
  await expect(page.locator('.reveal .card')).toHaveCount(4, { timeout: 15_000 });
  const mine = (await page.locator('.reveal .card').filter({ hasText: 'Ryan' }).textContent()) ?? '';
  expect(mine).toContain('Water');
  const emojis = await page.locator('.reveal .card .big').allTextContents();
  expect(new Set(emojis).size).toBe(4);
  await playUntil(page, () => page.locator('[data-badge-seat] .avatar').first().isVisible());
});
