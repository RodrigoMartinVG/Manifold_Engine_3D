import { expect, test, type Page } from '@playwright/test';
import { initPhysics, registryFor, Session, stateHash } from '@manifold/core';
import { DojoCartridge } from '@manifold/dojo/cartridge';

/**
 * DETERMINISM ACROSS PROGRAMS (decision 0012): the same world, simulated in the browser and here (in
 * Node, outside any browser), has to give the same hash after the same steps. It is what replays,
 * ghosts by link and networking need, and why the engine uses Rapier's deterministic build.
 */

const hex = (n: number) => n.toString(16).padStart(8, '0');

async function typeInConsole(page: Page, ...lines: string[]) {
  for (const line of lines) {
    await page.locator('.mg-console input').fill(line);
    await page.locator('.mg-console input').press('Enter');
  }
}

test('the same world in the browser and in Node gives the same hash after the same steps', async ({ page }) => {
  // Forty cubes falling on the floor and on the spinning cube: collisions, bounces, piles.
  await page.goto('jugar/dojo/#recipe=seed+7;dojo.cubes+40');
  await expect.poll(() => page.locator('#game').getAttribute('data-step').then(Number), { timeout: 20_000 }).toBeGreaterThan(180);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'hash');
  const log = await page.locator('.mg-console-log').innerText();
  const [, step, browserHash] = [...log.matchAll(/step (\d+) · hash ([0-9a-f]{8})/g)].at(-1)!;

  await initPhysics();
  const registry = registryFor(DojoCartridge);
  expect(registry.run('seed 7\ndojo.cubes 40', 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  for (let i = 0; i < Number(step); i++) session.step();
  expect(hex(stateHash(session.world)), `step ${step}`).toBe(browserHash);
  session.world.dispose();
});

test('show.physics draws what the physics sees, without breaking anything', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('jugar/dojo/#recipe=dojo.cubes+5;show.physics+on');
  await expect
    .poll(() => page.locator('#game').getAttribute('data-frames').then(Number), { timeout: 20_000 })
    .toBeGreaterThan(30);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'show.physics', 'dojo.spawn 2 4 2');
  await expect(page.locator('.mg-console-log')).toContainText('show.physics = on');
  // The ball enters at the next step: one more mesh (the floor has none: the grid is what is seen).
  await expect.poll(() => page.locator('#game').getAttribute('data-meshes').then(Number)).toBe(7);
  expect(errors).toEqual([]);
});
