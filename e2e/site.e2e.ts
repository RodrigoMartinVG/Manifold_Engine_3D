import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Collects the page's errors (exceptions and `console.error`) to demand there are none. */
function errors(page: Page) {
  const list: string[] = [];
  page.on('pageerror', (e) => list.push(`exception: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') list.push(`console: ${m.text()}`);
  });
  return list;
}

// The site's texts are in Spanish (decision 0011): the links and headings are looked for in Spanish.
test('the home page opens and leads to the Dojo, the tutorial and the project', async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  await expect(page).toHaveTitle(/Manifold/);
  await expect(page.getByRole('link', { name: 'Entrar al Dojo' })).toBeVisible();
  await page.getByRole('link', { name: 'Empezar el tutorial' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El tutorial');
  await page.locator('header nav.mg-sections').getByRole('link', { name: 'Proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El proyecto');
  expect(list).toEqual([]);
});

test("the home page's showcase lights up and its simulation advances", async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  // Three.js arrives after the page (dynamic import): the showcase goes from "loading" to "ready".
  // With a GPU it takes less than 1 s; without one (as in continuous integration) about 3 s, and
  // with another test running alongside, more than 15 s once in a while. Hence the margin.
  await expect(page.locator('.showcase')).toHaveAttribute('data-state', 'ready', { timeout: 40_000 });
  await expect
    .poll(async () => Number(await page.locator('.showcase-window').getAttribute('data-frames')), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(30);
  // The plate shows the simulation's step, and it keeps going up.
  const step = async () => Number((await page.locator('.showcase-step b').textContent())?.replace(/\D/g, ''));
  const before = await step();
  await expect.poll(step).toBeGreaterThan(before);
  expect(list).toEqual([]);
});

for (const [address, cubes] of [
  ['jugar/dojo/', 1],
  ['jugar/dojo/#recipe=dojo.cubes+20;seed+3', 21],
] as const) {
  test(`the Dojo draws without errors, one mesh per cube (${address})`, async ({ page }) => {
    const list = errors(page);
    await page.goto(address);
    await expect(page.locator('#game canvas')).toBeVisible();
    // The client writes down how many frames it drew: at least 30 must go by (half a second).
    await expect
      .poll(async () => Number(await page.locator('#game').getAttribute('data-frames')), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(30);
    // One mesh per entity, not one more (in step 0, every cube was drawn twice).
    expect(Number(await page.locator('#game').getAttribute('data-meshes'))).toBe(cubes);
    expect(list).toEqual([]);
  });
}

// ---------------------------------------------------------------- the console and the recipes (decision 0010)

const meshes = (page: Page) => page.locator('#game').getAttribute('data-meshes').then(Number);
const consoleLog = (page: Page) => page.locator('.mg-console-log');

async function typeInConsole(page: Page, ...lines: string[]) {
  for (const line of lines) {
    await page.locator('.mg-console input').fill(line);
    await page.locator('.mg-console input').press('Enter');
  }
}

test("the Dojo's console opens with the º key and changes the world", async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(1);
  await page.keyboard.press('Backquote');
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'true');

  // Startup: the world starts over with 20 more cubes.
  await typeInConsole(page, 'dojo.cubes 20');
  await expect.poll(() => meshes(page)).toBe(21);
  // World: a new cube, at the next step.
  await typeInConsole(page, 'dojo.spawn 0 2 0');
  await expect.poll(() => meshes(page)).toBe(22);
  // A misspelled name suggests the similar one.
  await typeInConsole(page, 'dojo.cube 3');
  // The whole line, corrected, as a button: a click puts it in the line.
  await expect(consoleLog(page)).toContainText('Did you mean dojo.cubes 3?');
  // Export builds the link with the recipe of what changed.
  await typeInConsole(page, 'export');
  await expect(consoleLog(page)).toContainText('/jugar/dojo/#recipe=dojo.cubes+20');
  // Esc closes.
  await page.locator('.mg-console input').press('Escape');
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'false');
  expect(list).toEqual([]);
});

/** The Dojo's saved rooms, read from their files: a new room gets tested by itself. */
function dojoRooms() {
  const folder = path.join(process.cwd(), 'games/dojo/recipes');
  return readdirSync(folder)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => {
      const text = readFileSync(path.join(folder, f), 'utf8');
      return {
        name: f.replace(/\.txt$/, ''),
        title: text.match(/^#\s*(.+)$/m)![1]!,
        cubes: Number(text.match(/^dojo\.cubes\s+(\d+)/m)?.[1] ?? 0),
      };
    });
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const room of dojoRooms()) {
  test(`the saved room "${room.name}" has its address and is born with its recipe`, async ({ page }) => {
    const list = errors(page);
    await page.goto(`jugar/dojo/${room.name}/`);
    await expect(page).toHaveTitle(new RegExp(escapeRegExp(room.title)));
    // The big cube and the room's cubes, at least (a room may bring a level, with more meshes).
    await expect.poll(() => meshes(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1 + room.cubes);
    expect(list).toEqual([]);
  });
}

test('a link with the recipe inside: it applies what it understands, reports the rest, and does not touch the preferences', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/#recipe=dojo.cubes+5;startup+save;made.up+3');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(6);
  await page.keyboard.press('Backquote');
  await expect(consoleLog(page)).toContainText("the link's recipe: 2 lines were not understood");
  await expect(consoleLog(page)).toContainText('"startup" cannot be used in a recipe');
  expect(await page.evaluate(() => localStorage.getItem('manifold.dojo.startup'))).toBeNull();
  expect(list).toEqual([]);
});

test('the startup recipe and the key bindings are saved, and hold the next time', async ({ page }) => {
  await page.goto('jugar/dojo/');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.cubes 4', 'startup save', 'bind t toggle show.wireframe');
  await page.reload();
  // It is born with the startup recipe...
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(5);
  // ...and the binding works with the console closed. (The click goes to an empty corner: a click on an
  // object would inspect it, and open the console.)
  await page.locator('#game canvas').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('t');
  await page.keyboard.press('Backquote');
  await expect(consoleLog(page)).toContainText('(bind t)');
  await expect(consoleLog(page)).toContainText('show.wireframe = on');
});

// ---------------------------------------------------------------- the console, friendlier (before stage 1b)

test("help's examples are buttons: a click puts one in the line, and Enter runs it", async ({ page }) => {
  await page.goto('jugar/dojo/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(1);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'help');
  await consoleLog(page).getByRole('button', { name: 'dojo.spawn 0 5 0' }).click();
  await expect(page.locator('.mg-console input')).toHaveValue('dojo.spawn 0 5 0 ');
  await page.locator('.mg-console input').press('Enter');
  await expect.poll(() => meshes(page)).toBe(2);
  // A suggestion is a button too, with the whole line corrected.
  await typeInConsole(page, 'show.phisics on');
  // (The last one: help's examples have one with the same text.)
  await consoleLog(page).getByRole('button', { name: 'show.physics on' }).last().click();
  await expect(page.locator('.mg-console input')).toHaveValue('show.physics on ');
});

test('the free camera turns with a drag, camera.reset brings it back, and a click on an object inspects it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('jugar/dojo/');
  const game = page.locator('#game');
  await expect.poll(() => game.getAttribute('data-camera'), { timeout: 15_000 }).toBe('3.20 2.40 4.20');
  // Dragging turns the camera around the scene (the world does not change: only the view).
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.mouse.move(700, 320, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => game.getAttribute('data-camera')).not.toBe('3.20 2.40 4.20');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'camera.reset');
  await expect.poll(() => game.getAttribute('data-camera')).toBe('3.20 2.40 4.20');
  await page.keyboard.press('Escape');
  // The camera looks at the big cube: a click in the middle of the screen inspects it.
  await page.mouse.click(640, 400);
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'true');
  await expect(consoleLog(page)).toContainText('entity 1, at step');
  await expect(consoleLog(page)).toContainText('body');
  await expect(consoleLog(page)).toContainText('type kinematic');
  // inspect with no id counts the entities; the stats show the physics.
  await typeInConsole(page, 'inspect', 'show.stats on');
  await expect(consoleLog(page)).toContainText('2 entities: 1 kinematic, 1 fixed');
  await expect(page.locator('.mg-stats')).toContainText('ms per step');
});

test('reset puts everything back to its default value, and vars shows it by scope', async ({ page }) => {
  await page.goto('jugar/dojo/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(1);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.cubes 5', 'show.axes on', 'vars');
  await expect(consoleLog(page)).toContainText('startup: changing them restarts the world');
  await expect(consoleLog(page)).toContainText('(changed; default 0)');
  await expect.poll(() => meshes(page)).toBe(6);
  await typeInConsole(page, 'reset', 'changed');
  await expect.poll(() => meshes(page)).toBe(1);
  await expect(consoleLog(page)).toContainText('nothing changed: everything is at its default value');
});

// ---------------------------------------------------------------- the character (stage 1b)

const position = async (page: Page, what: 'player' | 'camera' | 'ghost' | 'facing') =>
  ((await page.locator('#game').getAttribute(`data-${what}`)) ?? '').split(' ').map(Number);

test('in the course, the keys drive the character: it walks where the camera looks, jumps, and the camera follows', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  // It falls onto the floor and stands still (its position stops changing).
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect
    .poll(
      async () => {
        const a = await position(page, 'player');
        await page.waitForTimeout(300);
        const b = await position(page, 'player');
        return a[1] === b[1];
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  const [, y0, z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  // W held: the camera is behind it, looking at the course (−Z), so it walks towards −Z. (Held until it
  // advances 2 m, not for a fixed time: without a GPU, as in these tests, there are few frames per
  // second, and the fixed step runs at most 5 steps per frame, so the world goes slower than the clock.)
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 2);
  await page.keyboard.up('KeyW');
  // The camera came along.
  expect((await position(page, 'camera'))[2]).toBeLessThan(camera0[2]! - 2);
  // Space, pressed and released at once (maybe between two frames): it jumps all the same.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await position(page, 'player'))[1]).toBeGreaterThan(y0! + 1);
  expect(list).toEqual([]);
});

test('a link can leave the camera free: the character walks, and the camera stays', async ({ page }) => {
  const list = errors(page);
  // (A recipe runs before the world exists: view.camera must not need anything that comes later.)
  await page.goto('jugar/dojo/course/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [, , z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  expect(await position(page, 'camera')).toEqual(camera0);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- replays, ghosts and aiming (stage 1c)

test('ghost: the world starts over and a ghost does what you did, next to you', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [, , z0] = await position(page, 'player');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'ghost');
  await expect(consoleLog(page)).toContainText('a ghost of');
  await page.keyboard.press('Escape');
  // Back at the start, the player waits; the ghost walks the same way again.
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 15_000 }).toBeGreaterThan(z0! - 0.1);
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  expect((await position(page, 'player'))[2]).toBeGreaterThan(z0! - 0.1);
});

test('aim: the character looks where the camera looks, and walks sideways without turning', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('jugar/dojo/course/#recipe=view.camera+aim');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [x0] = await position(page, 'player');
  // D: to the right of the camera (+X); the character keeps looking ahead (−Z).
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 1);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'inspect 11');
  await expect(consoleLog(page)).toContainText('facing 0 0 -1');
});

// ---------------------------------------------------------------- turning and the camera (stage 1c2)

test('follow is a leash: going to a side turns the camera towards the character', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(1500);
  const [x0] = await position(page, 'player');
  // D: to the camera's right (+X). Before, the camera moved as much as the character and never turned.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 3);
  await page.keyboard.up('KeyD');
  const [px, , pz] = await position(page, 'player');
  const [cx, , cz] = await position(page, 'camera');
  // Where the camera looks along the ground now has a good part of +X.
  expect((px! - cx!) / Math.hypot(px! - cx!, pz! - cz!)).toBeGreaterThan(0.3);
});

test('tank controls: A and D turn the character on its own axis, W goes where it looks, and chase puts the camera behind', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const list = errors(page);
  /**
   * What the page says, once it stops changing. It writes it every 10 frames (with its step), and
   * here there are few: two readings are compared only if the page wrote again in between.
   */
  const settled = async (what: 'player' | 'facing' | 'camera') => {
    const step = () => page.locator('#game').getAttribute('data-step');
    let [at, a] = [await step(), await position(page, what)];
    for (;;) {
      await page.waitForTimeout(200);
      const now = await step();
      if (now === at) continue;
      const b = await position(page, what);
      if (a.join() === b.join()) return b;
      [at, a] = [now, b];
    }
  };
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank;view.camera+chase');
  await expect.poll(async () => (await position(page, 'facing')).length, { timeout: 15_000 }).toBe(3);
  const [x0, , z0] = await settled('player');
  // D held: it turns right, from −Z towards +X, without going anywhere.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'facing'))[0], { timeout: 30_000 }).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyD');
  const [fx, , fz] = await settled('facing');
  const [x1, , z1] = await position(page, 'player');
  expect(Math.hypot(x1! - x0!, z1! - z0!)).toBeLessThan(0.1);
  // W: forward, where it looks now.
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => Math.hypot((await position(page, 'player'))[0]! - x1!, (await position(page, 'player'))[2]! - z1!), {
      timeout: 30_000,
    })
    .toBeGreaterThan(2);
  await page.keyboard.up('KeyW');
  const [x2, , z2] = await settled('player');
  const along = ((x2! - x1!) * fx! + (z2! - z1!) * fz!) / Math.hypot(x2! - x1!, z2! - z1!);
  expect(along).toBeGreaterThan(0.95);
  // The chasing camera came back behind it: on the side opposite to where it looks.
  const [cx, , cz] = await settled('camera');
  expect(((cx! - x2!) * fx! + (cz! - z2!) * fz!) / Math.hypot(cx! - x2!, cz! - z2!)).toBeLessThan(-0.9);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- snapshots and a game's own button (stage 1d)

test('snapshot: save, walk and throw, load: the character is back, the ball is gone, and the hash is the same', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'snapshot');
  await expect(consoleLog(page)).toContainText('a snapshot at step');
  const [, step, hash] = /a snapshot at step (\d+) · hash ([0-9a-f]{8})/.exec(await consoleLog(page).innerText())!;
  const saved = await position(page, 'player');
  const shown = await meshes(page);
  await typeInConsole(page, 'pause');
  await page.keyboard.press('Escape');
  // Forward, and a ball thrown (F: the Dojo's own button).
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(saved[2]! - 1.5);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(shown + 1);
  // Back: where it was, without the ball, with the same hash.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'snapshot load');
  await expect(consoleLog(page)).toContainText(`back at step ${step} · hash ${hash}`);
  await expect.poll(() => position(page, 'player')).toEqual(saved);
  await expect.poll(() => meshes(page)).toBe(shown);
  expect(list).toEqual([]);
});
