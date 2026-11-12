import { expect, test, type FrameLocator, type Page } from '@playwright/test';

/**
 * THE LESSONS SAY SOMETHING, and these tests check that they show it (stage 1f). Running without
 * errors was not enough: a lesson ran "fine" while its ball flew off the floor, and showed nothing.
 * Here the panels of the stage 1 lessons are read, as a reader would read them.
 */

/** Opens a lesson and waits for its first example to run; its iframe, to read its panel. */
async function open(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  const example = page.locator('.live-code').first();
  await example.locator('.lc-result').scrollIntoViewIfNeeded();
  await expect(example).toHaveAttribute('data-state', 'running', { timeout: 20_000 });
  return page.frameLocator('.live-code .lc-result iframe').first();
}
/** A value of the example's panel (lil-gui), by the name of its row. */
const value = async (f: FrameLocator, name: string) => {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  return (await row.locator('input').first().inputValue()).trim();
};
const click = (f: FrameLocator, name: string) => f.locator('.lil-gui button', { hasText: name }).first().click();

test('replays: the ghost gives the same hash on every step; one step late, another', async ({ page }) => {
  test.setTimeout(90_000);
  const f = await open(page, 'tutorial/etapa-1/02-repeticiones/');
  await expect.poll(async () => Number(await value(f, 'steps')), { timeout: 30_000 }).toBeGreaterThan(120);
  await click(f, 'race your ghost');
  await expect.poll(async () => Number(await value(f, 'steps checked')), { timeout: 30_000 }).toBeGreaterThan(100);
  expect(await value(f, 'different hash')).toBe('0');
  await f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: 'one step late' }) })
    .locator('input')
    .click();
  await click(f, 'race your ghost');
  await expect.poll(async () => Number(await value(f, 'different hash')), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('snapshots: the twin born from a snapshot is the same world, until it is nudged', async ({ page }) => {
  test.setTimeout(90_000);
  const f = await open(page, 'tutorial/etapa-1/03-instantaneas/');
  await expect.poll(async () => Number(await value(f, 'step')), { timeout: 30_000 }).toBeGreaterThan(200);
  expect(await value(f, 'the twin is')).toBe('the same');
  await click(f, 'nudge the twin');
  await expect.poll(() => value(f, 'the twin is'), { timeout: 30_000 }).toMatch(/another world since step/);
});

test('server and client: the hash checks agree; an input lost by the client is a desync', async ({ page }) => {
  test.setTimeout(90_000);
  const f = await open(page, 'tutorial/etapa-1/04-servidor-y-cliente/');
  await expect.poll(async () => Number(await value(f, 'hash checks')), { timeout: 30_000 }).toBeGreaterThan(2);
  expect(await value(f, 'desyncs')).toBe('0');
  await click(f, 'loses an input');
  await expect.poll(async () => Number(await value(f, 'desyncs')), { timeout: 30_000 }).toBeGreaterThan(0);
});
