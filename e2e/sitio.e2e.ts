import { expect, test, type Page } from '@playwright/test';

/** Junta los errores de la página (excepciones y `console.error`) para exigir que no haya. */
function errores(page: Page) {
  const lista: string[] = [];
  page.on('pageerror', (e) => lista.push(`excepción: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') lista.push(`consola: ${m.text()}`);
  });
  return lista;
}

test('el inicio abre y lleva al Dojo, al tutorial y al proyecto', async ({ page }) => {
  const lista = errores(page);
  await page.goto('./');
  await expect(page).toHaveTitle(/Manifold/);
  await expect(page.getByRole('link', { name: 'Entrar al Dojo' })).toBeVisible();
  await page.getByRole('link', { name: 'Leer el tutorial' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Antes de empezar');
  expect(lista).toEqual([]);
});

for (const [direccion, cubos] of [
  ['jugar/dojo/', 1],
  ['jugar/dojo/?cubos=20&semilla=3', 21],
] as const) {
  test(`el Dojo dibuja sin errores, una malla por cubo (${direccion})`, async ({ page }) => {
    const lista = errores(page);
    await page.goto(direccion);
    await expect(page.locator('#juego canvas')).toBeVisible();
    // El cliente anota cuántos cuadros dibujó: que pasen al menos 30 (medio segundo).
    await expect
      .poll(async () => Number(await page.locator('#juego').getAttribute('data-cuadros')), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(30);
    // Una malla por entidad, ni una más (en el paso 0, cada cubo se dibujaba dos veces).
    expect(Number(await page.locator('#juego').getAttribute('data-mallas'))).toBe(cubos);
    expect(lista).toEqual([]);
  });
}
