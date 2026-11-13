import { expect, test, type Page } from '@playwright/test';
import { initPhysics, levelFromText, playReplay, registryFor, replayFromText, Session, stateHash } from '@manifold/core';
import { replayFromFragment } from '@manifold/presentation';
import { createDojo } from '@manifold/dojo/rules';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Dojo, with its levels read from disk (here, in Node, there is no Vite to find them, as the site
 * and the unit tests have): the same files, so the same cartridge as the page's.
 */
const LEVELS_DIR = join(import.meta.dirname, '..', 'games', 'dojo', 'levels');
const DojoCartridge = createDojo(
  Object.fromEntries(
    readdirSync(LEVELS_DIR)
      .filter((f) => f.endsWith('.level'))
      .sort()
      .map((f) => [f.replace(/\.level$/, ''), levelFromText(readFileSync(join(LEVELS_DIR, f), 'utf8'))]),
  ),
);

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

/** Pauses, exports the run as a replay link from the console, and gives the link and its text. */
async function exportReplay(page: Page) {
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'replay export');
  const log = page.locator('.mg-console-log');
  await expect(log).toContainText('#replay=', { timeout: 10_000 });
  const link = (await log.innerText())
    .split('\n')
    .find((l) => l.includes('#replay='))!
    .trim();
  return { link, text: (await replayFromFragment(new URL(link).hash, 'replay='))! };
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
  // Like the page's server (stage 1e): its player comes into the match at the first step.
  session.registry.run('players.join 1');
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

test('a run driven with the keys, as a replay link: Node plays it to the same hash, and so does the browser', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const at = async () => ((await page.locator('#game').getAttribute('data-player')) ?? '').split(' ').map(Number);
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await at()).length, { timeout: 20_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [, , z0] = await at();
  // Walk, jump, turn: inputs at steps that depend on this machine's frames, recorded as they came.
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await at())[2], { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.press('Space');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  const { link, text } = await exportReplay(page);

  // In Node, outside any browser: the same world, the same inputs at the same steps, the same hash.
  expect(text).toContain('birth dojo.level course');
  expect(text).toMatch(/^input \d+ 1 move /m);
  await initPhysics();
  const { session, same } = playReplay(DojoCartridge, replayFromText(text));
  expect(same).toBe(true);
  session.world.dispose();

  // And opened in the browser: it plays, and at its end it says it gave the same hash.
  await page.goto('about:blank');
  await page.goto(link);
  await expect(page.locator('#game')).toHaveAttribute('data-replay', 'same', { timeout: 90_000 });
});

test('tank controls turn without trigonometry: a run that turns, recorded in the browser, gives the same hash in Node', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const facing = async () => ((await page.locator('#game').getAttribute('data-facing')) ?? '').split(' ').map(Number);
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank');
  await expect.poll(async () => (await facing()).length, { timeout: 20_000 }).toBe(3);
  await page.waitForTimeout(1500);
  // Forward while turning left (a curve), then to the right side with Alt held (as in the old shooters).
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await expect.poll(async () => (await facing())[0], { timeout: 30_000 }).toBeLessThan(-0.5);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('Alt');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('Alt');
  await page.keyboard.up('KeyW');
  const { text } = await exportReplay(page);
  expect(text).toMatch(/^input \d+ 1 ahead 1 turn -1$/m);
  expect(text).toMatch(/^input \d+ 1 ahead 1 side 1$/m);

  await initPhysics();
  const { session, same } = playReplay(DojoCartridge, replayFromText(text));
  expect(same).toBe(true);
  session.world.dispose();
});

test('a snapshot restored in this browser goes on like the original: the replay of a world that went back plays in Node to the same hash', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const at = async () => ((await page.locator('#game').getAttribute('data-player')) ?? '').split(' ').map(Number);
  await page.goto('jugar/dojo/course/#recipe=dojo.cubes+12');
  await expect.poll(async () => (await at()).length, { timeout: 20_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [, , z0] = await at();
  // Forward, a snapshot, more forward and a throw, back to the snapshot, and to the side.
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await at())[2], { timeout: 30_000 }).toBeLessThan(z0! - 1);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'snapshot');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(400);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'snapshot load');
  await expect(page.locator('.mg-console-log')).toContainText('back at step');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  const { text } = await exportReplay(page);
  // The replay goes from the birth: what happened between the snapshot and going back is not in it.
  expect(text).not.toMatch(/dojo\.throw/);

  await initPhysics();
  const { session, same } = playReplay(DojoCartridge, replayFromText(text));
  expect(same).toBe(true);
  session.world.dispose();
});

test('the physics lab (stage 1f): vectors, contacts and the gravity field are drawn without breaking anything', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('jugar/dojo/course/#recipe=dojo.cubes+8;show.vectors+on;show.contacts+on;show.gravity+on');
  await expect
    .poll(() => page.locator('#game').getAttribute('data-frames').then(Number), { timeout: 20_000 })
    .toBeGreaterThan(30);
  // The cubes fell and rest on the floor and on the steps: there are contacts to draw.
  await expect
    .poll(() => page.locator('#game').getAttribute('data-contacts').then(Number), { timeout: 20_000 })
    .toBeGreaterThan(8);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'physics.gravity 0 -1.62 0', 'show.gravity');
  await expect(page.locator('.mg-console-log')).toContainText('show.gravity = on');
  expect(errors).toEqual([]);
});
