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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El tutorial');
  expect(lista).toEqual([]);
});

test('la vitrina del inicio se enciende y su simulación avanza', async ({ page }) => {
  const lista = errores(page);
  await page.goto('./');
  // Three.js llega después de la página (import dinámico): la vitrina pasa de "cargando" a "lista".
  await expect(page.locator('.vitrina')).toHaveAttribute('data-estado', 'lista', { timeout: 15_000 });
  await expect
    .poll(async () => Number(await page.locator('.vitrina-ventana').getAttribute('data-cuadros')), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(30);
  // La placa muestra el paso de la simulación, y sigue subiendo.
  const paso = async () => Number((await page.locator('.vitrina-paso b').textContent())?.replace(/\D/g, ''));
  const antes = await paso();
  await expect.poll(paso).toBeGreaterThan(antes);
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
