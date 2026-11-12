// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

/**
 * The linter. Besides the usual rules, it guards THE BOUNDARIES between layers (decision 0003).
 * The compiler already keeps the core from using `document` (it has no DOM library); this keeps
 * it from IMPORTING what it must not. If someone tries, `npm run lint` fails and says why.
 */
const games = {
  group: ['@manifold/dojo', '@manifold/dojo/*', '**/games/**'],
  message: 'The engine does not know the games: it receives them as cartridges (decision 0003).',
};
const drawing = {
  group: ['three', 'three/*'],
  message: 'This layer does not draw: Three.js belongs to the presentation only (decision 0003).',
};
const presentation = {
  group: ['@manifold/presentation', '@manifold/presentation/*'],
  message: 'The simulation does not know the presentation (decision 0003).',
};
const headless = "A game's rules run without a screen (also on a server and in tests): decision 0003.";

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      'playwright-report/**',
      'test-results/**',
      'site/public/vendor/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  // A name that starts with "_" is unused on purpose (a parameter that the signature needs but this
  // version does not, like the position in a uniform gravity field).
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { languageOptions: { globals: { ...globals.node } } },
  // The site and its lessons run in the browser.
  { files: ['site/src/**/*.ts'], languageOptions: { globals: { ...globals.browser } } },
  {
    files: ['packages/common/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [drawing, { group: ['@manifold/*'], message: 'common depends on no other package.' }] },
      ],
    },
  },
  {
    // Variables, commands and recipes (decision 0010): no screen, and no dependencies.
    files: ['packages/commands/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [drawing, { group: ['@manifold/*'], message: 'commands depends on no other package.' }] },
      ],
    },
  },
  {
    files: ['packages/core/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [drawing, presentation, games] }] },
  },
  {
    files: ['packages/presentation/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [games] }] },
  },
  {
    // A game uses the engine, never another game.
    files: ['games/*/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@manifold/*', '!@manifold/common', '!@manifold/commands', '!@manifold/core', '!@manifold/presentation'],
              message: 'A game imports the engine, never another game (decision 0003).',
            },
          ],
        },
      ],
    },
  },
  {
    // A game's RULES (its cartridge) run without a screen: also on a server and in tests.
    files: ['games/*/src/cartridge*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { ...drawing, message: headless },
            { ...presentation, message: headless },
          ],
        },
      ],
    },
  },
);
