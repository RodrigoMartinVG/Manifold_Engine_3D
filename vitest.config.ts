import { defineConfig } from 'vitest/config';

/** The headless tests: `*.test.ts` files next to the code they test (decision 0001). */
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'games/*/src/**/*.test.ts', 'site/src/**/*.test.ts'],
    environment: 'node',
  },
});
