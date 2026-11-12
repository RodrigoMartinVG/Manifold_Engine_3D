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
  await expect(consoleLog(page)).toContainText('Did you mean "dojo.cubes"?');
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
    await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(1 + room.cubes);
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
  // ...and the binding works with the console closed.
  await page.locator('#game canvas').click();
  await page.keyboard.press('t');
  await page.keyboard.press('Backquote');
  await expect(consoleLog(page)).toContainText('(bind t)');
  await expect(consoleLog(page)).toContainText('show.wireframe = on');
});
