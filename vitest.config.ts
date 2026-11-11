import { defineConfig } from 'vitest/config';

/** Las pruebas sin pantalla: archivos `*.prueba.ts` junto al código que prueban (decisión 0001). */
export default defineConfig({
  test: {
    include: ['paquetes/*/src/**/*.prueba.ts', 'juegos/*/src/**/*.prueba.ts'],
    environment: 'node',
  },
});
