import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:4321/Manifold_Engine_3D/';

/**
 * Las pruebas EN UN NAVEGADOR DE VERDAD (decisión 0001): el sitio armado como se publica, cada
 * página abre sin errores y el Dojo dibuja. Es la lección de la V1 (paso 14): un cambio en el
 * arranque rompió todas las teclas y ninguna prueba sin pantalla lo vio.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sin GPU (en la integración continua), WebGL corre en la CPU con SwiftShader.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    // (El servidor de Vite y no `astro preview`: Astro 7, fuera de una terminal, se va a
    // segundo plano solo, y Playwright cree que terminó.)
    command: 'npm run build && npm run servir-sitio',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
