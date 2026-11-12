import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
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
  // Con GPU tarda menos de 1 s; sin GPU (como en la integración continua) unos 3 s, y con otra
  // prueba corriendo al lado, más de 15 s alguna vez. De ahí el margen.
  await expect(page.locator('.vitrina')).toHaveAttribute('data-estado', 'lista', { timeout: 40_000 });
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

// ---------------------------------------------------------------- la consola y las recetas (decisión 0010)

const mallas = (page: Page) => page.locator('#juego').getAttribute('data-mallas').then(Number);
const registroDeLaConsola = (page: Page) => page.locator('.mg-consola-registro');

async function escribirEnLaConsola(page: Page, ...lineas: string[]) {
  for (const linea of lineas) {
    await page.locator('.mg-consola input').fill(linea);
    await page.locator('.mg-consola input').press('Enter');
  }
}

test('la consola del Dojo se abre con la tecla º y cambia el mundo', async ({ page }) => {
  const lista = errores(page);
  await page.goto('jugar/dojo/');
  await expect.poll(() => mallas(page), { timeout: 15_000 }).toBe(1);
  await page.keyboard.press('Backquote');
  await expect(page.locator('.mg-consola')).toHaveAttribute('data-abierta', 'si');

  // De arranque: el mundo vuelve a empezar con 20 cubos más.
  await escribirEnLaConsola(page, 'dojo.cubos 20');
  await expect.poll(() => mallas(page)).toBe(21);
  // Del mundo: un cubo nuevo, en el paso siguiente.
  await escribirEnLaConsola(page, 'dojo.crear 0 2 0');
  await expect.poll(() => mallas(page)).toBe(22);
  // Un nombre mal escrito sugiere el parecido.
  await escribirEnLaConsola(page, 'dojo.cubo 3');
  await expect(registroDeLaConsola(page)).toContainText('¿Quisiste decir "dojo.cubos"?');
  // Exportar arma el enlace con la receta de lo cambiado.
  await escribirEnLaConsola(page, 'exportar');
  await expect(registroDeLaConsola(page)).toContainText('/jugar/dojo/#receta=dojo.cubos+20');
  // Esc cierra.
  await page.locator('.mg-consola input').press('Escape');
  await expect(page.locator('.mg-consola')).toHaveAttribute('data-abierta', 'no');
  expect(lista).toEqual([]);
});

/** Las salas guardadas del Dojo, leídas de sus archivos: una sala nueva queda probada sola. */
function salasDelDojo() {
  const carpeta = path.join(process.cwd(), 'juegos/dojo/recetas');
  return readdirSync(carpeta)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => {
      const texto = readFileSync(path.join(carpeta, f), 'utf8');
      return {
        nombre: f.replace(/\.txt$/, ''),
        titulo: texto.match(/^#\s*(.+)$/m)![1]!,
        cubos: Number(texto.match(/^dojo\.cubos\s+(\d+)/m)?.[1] ?? 0),
      };
    });
}

for (const sala of salasDelDojo()) {
  test(`la sala guardada "${sala.nombre}" tiene su dirección y nace con su receta`, async ({ page }) => {
    const lista = errores(page);
    await page.goto(`jugar/dojo/${sala.nombre}/`);
    await expect(page).toHaveTitle(new RegExp(sala.titulo));
    await expect.poll(() => mallas(page), { timeout: 15_000 }).toBe(1 + sala.cubos);
    expect(lista).toEqual([]);
  });
}

test('un enlace con la receta adentro: aplica lo que entiende, avisa lo demás, y no toca las preferencias', async ({ page }) => {
  const lista = errores(page);
  await page.goto('jugar/dojo/#receta=dojo.cubos+5;inicio+guardar;inventado+3');
  await expect.poll(() => mallas(page), { timeout: 15_000 }).toBe(6);
  await page.keyboard.press('Backquote');
  await expect(registroDeLaConsola(page)).toContainText('la receta del enlace: 2 líneas no se entendieron');
  await expect(registroDeLaConsola(page)).toContainText('"inicio" no se puede usar en una receta');
  expect(await page.evaluate(() => localStorage.getItem('manifold.dojo.inicio'))).toBeNull();
  expect(lista).toEqual([]);
});

test('la receta de inicio y los atajos se guardan, y valen la próxima vez', async ({ page }) => {
  await page.goto('jugar/dojo/');
  await page.keyboard.press('Backquote');
  await escribirEnLaConsola(page, 'dojo.cubos 4', 'inicio guardar', 'atajo t alternar ver.triangulos');
  await page.reload();
  // Nace con la receta de inicio...
  await expect.poll(() => mallas(page), { timeout: 15_000 }).toBe(5);
  // ...y el atajo anda con la consola cerrada.
  await page.locator('#juego canvas').click();
  await page.keyboard.press('t');
  await page.keyboard.press('Backquote');
  await expect(registroDeLaConsola(page)).toContainText('(atajo t)');
  await expect(registroDeLaConsola(page)).toContainText('ver.triangulos = si');
});
