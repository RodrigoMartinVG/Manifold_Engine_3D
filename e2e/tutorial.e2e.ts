import { expect, test, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * EL TUTORIAL, PROBADO (decisión 0007): cada ejemplo de cada lección se ejecuta en Chromium y
 * tiene que andar sin errores. Si una actualización de Three.js (o un cambio nuestro) rompe una
 * lección, se ve aquí, en el pull request, y no lo descubre un lector.
 */
const DOCS = join(import.meta.dirname, '..', 'sitio', 'src', 'content', 'docs');

/** Las páginas del tutorial, como direcciones: `tutorial/`, `tutorial/etapa-0/01-primer-cubo/`... */
function paginasDelTutorial(): string[] {
  const paginas: string[] = [];
  const recorrer = (carpeta: string) => {
    for (const e of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (/\.mdx?$/.test(e.name))
        paginas.push(
          relative(DOCS, ruta)
            .replace(/(index)?\.mdx?$/, '')
            .replace(/\/?$/, '/'),
        );
    }
  };
  recorrer(join(DOCS, 'tutorial'));
  return paginas.sort();
}

/** Ejecuta un ejemplo y espera a que ande: que dibuje 20 cuadros, o (si no anima) que escriba en la consola. */
async function ejecutarYEsperar(ejemplo: Locator) {
  await ejemplo.locator('.cv-ejecutar').click();
  // Chrome no le da cuadros a un iframe de otro origen que está fuera de la pantalla.
  await ejemplo.locator('.cv-resultado').scrollIntoViewIfNeeded();
  await expect(ejemplo).toHaveAttribute('data-estado', 'corriendo');
  await expect
    .poll(
      async () =>
        Number(await ejemplo.getAttribute('data-cuadros')) >= 20 || (await ejemplo.locator('.cv-consola .cv-linea').count()) > 0,
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** Reemplaza el código del archivo abierto en el editor, tecleando como una persona. */
async function escribirCodigo(page: Page, ejemplo: Locator, codigo: string) {
  await ejemplo.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(codigo);
}

for (const pagina of paginasDelTutorial()) {
  test(`cada ejemplo de ${pagina} se ejecuta sin errores`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto(pagina);
    const ejemplos = page.locator('.codigo-vivo');
    const cantidad = await ejemplos.count();
    expect(cantidad, 'una lección sin código no es una lección').toBeGreaterThan(0);
    for (let i = 0; i < cantidad; i++) {
      const ejemplo = ejemplos.nth(i);
      await ejecutarYEsperar(ejemplo);
      const consola = await ejemplo.locator('.cv-consola').innerText();
      expect(await ejemplo.getAttribute('data-errores'), `errores en la consola del ejemplo:\n${consola}`).toBe('0');
    }
    expect(errores).toEqual([]);
  });
}

test('editar el código y ejecutarlo; un error aparece con su archivo y su línea', async ({ page }) => {
  await page.goto('tutorial/');
  const ejemplo = page.locator('.codigo-vivo').first();
  await escribirCodigo(page, ejemplo, "console.log('editado en la prueba', { x: 1.23456789 });");
  await ejemplo.locator('.cv-ejecutar').click();
  await expect(ejemplo.locator('.cv-consola')).toContainText('editado en la prueba {"x":1.2346}');

  await escribirCodigo(page, ejemplo, "const x = 1;\nthrow new Error('a propósito ' + x);");
  await page.keyboard.press('ControlOrMeta+Enter'); // el atajo también ejecuta
  await expect(ejemplo.locator('.cv-consola')).toContainText('a propósito 1 (main.ts, línea 2)');
  await expect(ejemplo).toHaveAttribute('data-errores', '1');

  // ↺ Restaurar vuelve al código original, que anda.
  await ejemplo.locator('.cv-restaurar').click();
  await ejecutarYEsperar(ejemplo);
  await expect(ejemplo.locator('.cv-consola')).toContainText('hola 1');
});

test('pantalla completa: el código y lo que dibuja, lado a lado, sin reiniciar el ejemplo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('tutorial/etapa-0/01-primer-cubo/');
  const ejemplo = page.locator('.codigo-vivo').first();
  await ejecutarYEsperar(ejemplo);
  // Si el iframe cambiara de lugar en la página, el navegador lo recargaría: se cuentan sus navegaciones.
  let recargas = 0;
  page.on('framenavigated', (marco) => marco !== page.mainFrame() && recargas++);

  await ejemplo.locator('.cv-ampliar').click();
  await expect(ejemplo).toHaveAttribute('data-ampliado', /^(pantalla|ventana)$/);
  await expect(ejemplo.locator('.cv-ampliar')).toHaveAttribute('aria-pressed', 'true');
  // Ocupa la pantalla, con el código a la izquierda de lo que dibuja.
  const editor = (await ejemplo.locator('.cv-editor').boundingBox())!;
  const resultado = (await ejemplo.locator('.cv-resultado').boundingBox())!;
  expect(editor.x + editor.width).toBeLessThanOrEqual(resultado.x);
  expect(resultado.x + resultado.width).toBeGreaterThan(1270);
  expect(resultado.height).toBeGreaterThan(650);
  // Sigue dibujando, y es el mismo ejemplo de antes.
  const cuadros = Number(await ejemplo.getAttribute('data-cuadros'));
  await expect.poll(async () => Number(await ejemplo.getAttribute('data-cuadros'))).toBeGreaterThan(cuadros + 20);
  expect(recargas).toBe(0);

  // El divisor, con el teclado: dos veces → le da un 10 % más al código.
  const divisor = ejemplo.locator('.cv-divisor');
  await divisor.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(divisor).toHaveAttribute('aria-valuenow', '52');
  const editorMasAncho = (await ejemplo.locator('.cv-editor').boundingBox())!;
  expect(editorMasAncho.width).toBeGreaterThan(editor.width + 100);

  await ejemplo.locator('.cv-ampliar').click();
  await expect(ejemplo).not.toHaveAttribute('data-ampliado');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(recargas).toBe(0);
});

test('sin pantalla completa (como en el iPhone), el ejemplo ocupa la ventana, y Esc lo devuelve', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }));
  await page.goto('tutorial/etapa-0/01-primer-cubo/');
  const ejemplo = page.locator('.codigo-vivo').first();
  await ejemplo.locator('.cv-ampliar').click();
  await expect(ejemplo).toHaveAttribute('data-ampliado', 'ventana');
  const caja = (await ejemplo.boundingBox())!;
  const ventana = page.viewportSize()!;
  expect([caja.x, caja.y, caja.width, caja.height]).toEqual([0, 0, ventana.width, ventana.height]);
  await page.keyboard.press('Escape');
  await expect(ejemplo).not.toHaveAttribute('data-ampliado');
});
