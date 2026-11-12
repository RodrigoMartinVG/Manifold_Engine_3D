import { expect, test, type Page } from '@playwright/test';

/**
 * THE NETWORKING SKELETON (stage 1e), in the browser: two tabs of the same browser, one match. One
 * opens its match (`net open`), the other joins it (`net join`) and gets its own character. Each
 * drives its own, and each sees the other's move; every second, the joiner's copy checks its world
 * with the host's hash.
 */

async function typeInConsole(page: Page, ...lines: string[]) {
  for (const line of lines) {
    await page.locator('.mg-console input').fill(line);
    await page.locator('.mg-console input').press('Enter');
  }
}
const data = (page: Page, name: string) => page.locator('#game').getAttribute(`data-${name}`);
const xyz = async (page: Page, name: string) => ((await data(page, name)) ?? '').split(' ').map(Number);
/** The other players' characters, as this page sees them: player → position. */
const others = async (page: Page) =>
  new Map(
    ((await data(page, 'others')) ?? '')
      .split('|')
      .filter(Boolean)
      .map((s) => {
        const [player, rest] = s.split(':');
        return [Number(player), rest!.split(' ').map(Number)] as const;
      }),
  );

test('two tabs, one match: the second joins with its own character, each drives its own, and the copies agree', async ({
  context,
}) => {
  test.setTimeout(120_000);
  const host = await context.newPage();
  const guest = await context.newPage();
  for (const page of [host, guest]) {
    await page.goto('jugar/dojo/course/');
    await expect.poll(() => data(page, 'me'), { timeout: 20_000 }).toBe('1');
  }
  await host.keyboard.press('Backquote');
  await typeInConsole(host, 'net open');
  await expect(host.locator('.mg-console-log')).toContainText('the match is open');
  await host.keyboard.press('Escape');

  await guest.keyboard.press('Backquote');
  await typeInConsole(guest, 'net join');
  await expect(guest.locator('.mg-console-log')).toContainText('you joined the match: you are player 2', { timeout: 10_000 });
  await guest.keyboard.press('Escape');
  await expect.poll(() => data(guest, 'net')).toBe('joined');

  // Each sees the other's character.
  await expect.poll(async () => (await others(host)).has(2), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await others(guest)).has(1), { timeout: 20_000 }).toBe(true);

  // The guest drives its own (player 2), and the host sees it move.
  const [, , z0] = await xyz(guest, 'player');
  await guest.keyboard.down('KeyW');
  await expect.poll(async () => (await xyz(guest, 'player'))[2], { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  await guest.keyboard.up('KeyW');
  await expect.poll(async () => (await others(host)).get(2)?.[2] ?? 99, { timeout: 20_000 }).toBeLessThan(z0! - 1.5);

  // The host drives its own (player 1), and the guest sees it move.
  const [, , h0] = await xyz(host, 'player');
  await host.keyboard.down('KeyW');
  await expect.poll(async () => (await xyz(host, 'player'))[2], { timeout: 30_000 }).toBeLessThan(h0! - 1.5);
  await host.keyboard.up('KeyW');
  await expect.poll(async () => (await others(guest)).get(1)?.[2] ?? 99, { timeout: 20_000 }).toBeLessThan(h0! - 1.5);

  // Every second, the guest's copy checked its world with the host's: always the same.
  await expect.poll(async () => Number(await data(guest, 'checks')), { timeout: 20_000 }).toBeGreaterThan(2);
  expect(await data(guest, 'desyncs')).toBeNull();

  // The guest leaves: its character leaves the host's world.
  await guest.close();
  await expect.poll(async () => (await others(host)).size, { timeout: 20_000 }).toBe(0);
});
