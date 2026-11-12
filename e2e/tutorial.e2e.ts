import { expect, test, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * THE TUTORIAL, TESTED (decision 0007): every example of every lesson runs in Chromium and has to
 * work without errors. If a Three.js update (or a change of ours) breaks a lesson, it shows here,
 * before it is published, and a reader does not find it.
 *
 * The site's texts are in Spanish (decision 0011): its addresses and labels are looked for in Spanish.
 */
const DOCS = join(import.meta.dirname, '..', 'site', 'src', 'content', 'docs');

/** Tutorial pages that are not lessons: they have no examples to run. */
const NOT_LESSONS = new Set(['tutorial/glosario/']);

/** The tutorial's lessons, as addresses: `tutorial/`, `tutorial/etapa-0/01-primer-cubo/`... */
function tutorialLessons(): string[] {
  const pages: string[] = [];
  const walk = (folder: string) => {
    for (const e of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, e.name);
      if (e.isDirectory()) walk(file);
      else if (/\.mdx?$/.test(e.name))
        pages.push(
          relative(DOCS, file)
            .replace(/(index)?\.mdx?$/, '')
            .replace(/\/?$/, '/'),
        );
    }
  };
  walk(join(DOCS, 'tutorial'));
  return pages.filter((p) => !NOT_LESSONS.has(p)).sort();
}

/** Runs an example and waits until it works: until it draws 20 frames, or (if it does not animate) writes to the console. */
async function runAndWait(example: Locator) {
  await example.locator('.lc-run').click();
  // Chrome gives no frames to a cross-origin iframe that is off screen.
  await example.locator('.lc-result').scrollIntoViewIfNeeded();
  await expect(example).toHaveAttribute('data-state', 'running');
  await expect
    .poll(
      async () =>
        Number(await example.getAttribute('data-frames')) >= 20 || (await example.locator('.lc-console .lc-line').count()) > 0,
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** Replaces the code of the file open in the editor, typing like a person. */
async function typeCode(page: Page, example: Locator, code: string) {
  await example.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

for (const lesson of tutorialLessons()) {
  test(`every example of ${lesson} runs without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(lesson);
    const examples = page.locator('.live-code');
    const count = await examples.count();
    expect(count, 'a lesson without code is not a lesson').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const example = examples.nth(i);
      await runAndWait(example);
      const output = await example.locator('.lc-console').innerText();
      expect(await example.getAttribute('data-errors'), `errors in the example's console:\n${output}`).toBe('0');
    }
    expect(errors).toEqual([]);
  });
}

test('the glossary is not a lesson: it has no examples', async ({ page }) => {
  for (const p of NOT_LESSONS) {
    await page.goto(p);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.live-code')).toHaveCount(0);
  }
});

test('editing the code and running it; an error shows up with its file and its line', async ({ page }) => {
  await page.goto('tutorial/');
  const example = page.locator('.live-code').first();
  await typeCode(page, example, "console.log('edited in the test', { x: 1.23456789 });");
  await example.locator('.lc-run').click();
  await expect(example.locator('.lc-console')).toContainText('edited in the test {"x":1.2346}');

  await typeCode(page, example, "const x = 1;\nthrow new Error('on purpose ' + x);");
  await page.keyboard.press('ControlOrMeta+Enter'); // the shortcut runs it too
  await expect(example.locator('.lc-console')).toContainText('on purpose 1 (main.ts, línea 2)');
  await expect(example).toHaveAttribute('data-errors', '1');

  // ↺ Restaurar (reset) brings back the original code, which works.
  await example.locator('.lc-reset').click();
  await runAndWait(example);
  await expect(example.locator('.lc-console')).toContainText('hello 1');
});

test('full screen: the code and what it draws, side by side, without restarting the example', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('tutorial/etapa-0/01-primer-cubo/');
  const example = page.locator('.live-code').first();
  await runAndWait(example);
  // If the iframe moved in the page, the browser would reload it: its navigations are counted.
  let reloads = 0;
  page.on('framenavigated', (frame) => frame !== page.mainFrame() && reloads++);

  await example.locator('.lc-expand').click();
  await expect(example).toHaveAttribute('data-expanded', /^(screen|window)$/);
  await expect(example.locator('.lc-expand')).toHaveAttribute('aria-pressed', 'true');
  // It takes the screen, with the code to the left of what it draws.
  const editor = (await example.locator('.lc-editor').boundingBox())!;
  const result = (await example.locator('.lc-result').boundingBox())!;
  expect(editor.x + editor.width).toBeLessThanOrEqual(result.x);
  expect(result.x + result.width).toBeGreaterThan(1270);
  expect(result.height).toBeGreaterThan(650);
  // It keeps drawing, and it is the same example as before.
  const frames = Number(await example.getAttribute('data-frames'));
  await expect.poll(async () => Number(await example.getAttribute('data-frames'))).toBeGreaterThan(frames + 20);
  expect(reloads).toBe(0);

  // The divider, with the keyboard: twice → it gives the code 10 % more.
  const divider = example.locator('.lc-divider');
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '52');
  const widerEditor = (await example.locator('.lc-editor').boundingBox())!;
  expect(widerEditor.width).toBeGreaterThan(editor.width + 100);

  await example.locator('.lc-expand').click();
  await expect(example).not.toHaveAttribute('data-expanded');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(reloads).toBe(0);
});

test('without full screen (like on the iPhone), the example takes the window, and Esc brings it back', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }));
  await page.goto('tutorial/etapa-0/01-primer-cubo/');
  const example = page.locator('.live-code').first();
  await example.locator('.lc-expand').click();
  await expect(example).toHaveAttribute('data-expanded', 'window');
  const box = (await example.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, viewport.width, viewport.height]);
  await page.keyboard.press('Escape');
  await expect(example).not.toHaveAttribute('data-expanded');
});

test('the side panels hide and are remembered, and the example uses the width that is left', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('tutorial/etapa-0/03-paso-fijo/');
  const example = page.locator('.live-code').first();
  const sidebar = page.locator('header .mg-panels .mg-panel[data-panel="sidebar"]');
  const toc = page.locator('header .mg-panels .mg-panel[data-panel="toc"]');
  const column = (await page.locator('.sl-markdown-content').boundingBox())!.width;
  expect((await example.boundingBox())!.width).toBeLessThan(column + 40);

  await sidebar.click();
  await toc.click();
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(page.locator('.right-sidebar-container')).toBeHidden();
  // The example breaks out of the text's column, and puts the code and what it draws side by side.
  await expect(example).toHaveAttribute('data-side-by-side', '');
  expect((await example.boundingBox())!.width).toBeGreaterThan(1300);
  const editor = (await example.locator('.lc-editor').boundingBox())!;
  const result = (await example.locator('.lc-result').boundingBox())!;
  expect(editor.x + editor.width).toBeLessThanOrEqual(result.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);

  // On another page they are still hidden (it is remembered), until they are shown again.
  await page.goto('tutorial/etapa-0/01-primer-cubo/');
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(sidebar).toHaveAttribute('aria-pressed', 'false');
  await sidebar.click();
  await toc.click();
  await expect(page.locator('.sidebar-pane')).toBeVisible();
  await expect(page.locator('.right-sidebar-container')).toBeVisible();

  // They also hide with the "Ocultar" (hide) button each panel has at the top.
  await page.locator('.sidebar-pane .mg-hide').click();
  await page.locator('.right-sidebar .mg-hide').click();
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(page.locator('.right-sidebar-container')).toBeHidden();
  await expect(sidebar).toHaveAttribute('aria-pressed', 'false');

  // And they can always be shown again with the tabs at the screen's edge.
  await page.locator('header .mg-show-sidebar').click();
  await page.locator('header .mg-show-toc').click();
  await expect(page.locator('.sidebar-pane')).toBeVisible();
  await expect(page.locator('.right-sidebar-container')).toBeVisible();
  await expect(page.locator('header .mg-show-sidebar')).toBeHidden();
});
