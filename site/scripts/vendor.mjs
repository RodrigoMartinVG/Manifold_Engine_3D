// @ts-check
/**
 * LAS LIBRERÍAS DEL TUTORIAL, en un archivo cada una (decisión 0007).
 *
 * El código de las lecciones corre en un iframe AISLADO (con su propio origen), que no puede
 * pedirle módulos al sitio. Entonces el sitio arma, al compilar, un archivo por librería (con
 * todo adentro: sin `import` relativos que el iframe no podría resolver), los lee y se los pasa
 * al iframe, que los convierte en módulos con un mapa de importaciones. Así una lección escribe
 * `import * as THREE from 'three'` como en cualquier proyecto, y usa la MISMA versión que el motor.
 *
 * Para agregar una librería: una entrada más en BIBLIOTECAS.
 */
import { build } from 'vite';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const entradas = fileURLToPath(new URL('../.vendor-entradas/', import.meta.url));
const destino = fileURLToPath(new URL('../public/vendor/', import.meta.url));

/** Lo que una lección puede importar: su especificador, el archivo que lo resuelve y qué deja afuera. */
const BIBLIOTECAS = [
  { especificador: 'three', archivo: 'three.js', codigo: "export * from 'three';", externas: [] },
  {
    especificador: 'three/addons/controls/OrbitControls.js',
    archivo: 'orbit-controls.js',
    codigo: "export * from 'three/addons/controls/OrbitControls.js';",
    // Usa Three.js: lo importa por su nombre, y el iframe le da el mismo módulo (una sola copia).
    externas: ['three'],
  },
  {
    especificador: 'three/addons/libs/lil-gui.module.min.js',
    archivo: 'lil-gui.js',
    codigo:
      "export * from 'three/addons/libs/lil-gui.module.min.js';\nexport { default } from 'three/addons/libs/lil-gui.module.min.js';",
    externas: [],
  },
];

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });
await mkdir(entradas, { recursive: true });
/** @type {Record<string, string>} */
const manifiesto = {};
for (const b of BIBLIOTECAS) {
  const entrada = `${entradas}${b.archivo}`;
  await writeFile(entrada, b.codigo);
  await build({
    configFile: false,
    root: raiz,
    publicDir: false, // la salida va DENTRO de public/: que Vite no intente copiarla en sí misma
    logLevel: 'warn',
    build: {
      lib: { entry: entrada, formats: ['es'], fileName: () => b.archivo },
      outDir: destino,
      emptyOutDir: false,
      minify: true,
      rolldownOptions: { external: b.externas },
    },
  });
  manifiesto[b.especificador] = b.archivo;
}
await writeFile(`${destino}manifiesto.json`, JSON.stringify(manifiesto, null, 2));
await rm(entradas, { recursive: true, force: true });
console.log(`Librerías del tutorial: ${Object.keys(manifiesto).join(', ')}`);
