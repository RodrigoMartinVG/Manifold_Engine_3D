import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:4321/Manifold_Gaming/';

/**
 * The tests IN A REAL BROWSER (decision 0001): the site built as it is published, every page opens
 * without errors and the Dojo draws. It is V1's lesson (step 14): a change in the start-up broke
 * every key, and no headless test saw it.
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
        // Without a GPU (in continuous integration), WebGL runs on the CPU with SwiftShader.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    // (Vite's server and not `astro preview`: outside a terminal, Astro 7 goes to the background
    // by itself, and Playwright thinks it exited.)
    command: 'npm run build && npm run serve:site',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
