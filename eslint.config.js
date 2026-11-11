// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

/**
 * El linter. Además de las reglas habituales, vigila LAS FRONTERAS entre capas (decisión 0003).
 * El compilador ya impide que el núcleo use `document` (no tiene la librería DOM); esto impide
 * que IMPORTE lo que no debe. Si alguien lo intenta, `npm run lint` falla con el porqué.
 */
const juegos = {
  group: ['@manifold/dojo', '@manifold/dojo/*', '**/juegos/**'],
  message: 'El motor no conoce a los juegos: los recibe como cartuchos (decisión 0003).',
};
const dibujo = {
  group: ['three', 'three/*'],
  message: 'Esta capa no dibuja: Three.js es solo de la presentación (decisión 0003).',
};
const presentacion = {
  group: ['@manifold/presentacion', '@manifold/presentacion/*'],
  message: 'La simulación no conoce a la presentación (decisión 0003).',
};

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.astro/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: { ...globals.node } } },
  {
    files: ['paquetes/comun/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [dibujo, { group: ['@manifold/*'], message: 'comun no depende de ningún otro paquete.' }] },
      ],
    },
  },
  {
    files: ['paquetes/nucleo/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [dibujo, presentacion, juegos] }] },
  },
  {
    files: ['paquetes/presentacion/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [juegos] }] },
  },
  {
    // Un juego usa el motor, nunca otro juego.
    files: ['juegos/*/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@manifold/*', '!@manifold/comun', '!@manifold/nucleo', '!@manifold/presentacion'],
              message: 'Un juego importa el motor, nunca otro juego (decisión 0003).',
            },
          ],
        },
      ],
    },
  },
  {
    // Las REGLAS de un juego (su cartucho) corren sin pantalla: también en el servidor y en las pruebas.
    files: ['juegos/*/src/cartucho*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              ...dibujo,
              message: 'Las reglas de un juego corren sin pantalla (también en el servidor y en las pruebas): decisión 0003.',
            },
            {
              ...presentacion,
              message: 'Las reglas de un juego corren sin pantalla (también en el servidor y en las pruebas): decisión 0003.',
            },
          ],
        },
      ],
    },
  },
);
