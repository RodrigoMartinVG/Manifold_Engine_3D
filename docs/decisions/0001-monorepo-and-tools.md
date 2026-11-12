# 0001. A monorepo, and its tools

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The platform has pieces that use each other: the engine (in layers), the games and the site. They have to be changeable together (touch the engine and see the change in the Dojo right away) without publishing packages anywhere.

## Decision

**A single repository with npm _workspaces_:**

```
packages/common         randomness, math (no dependencies)
packages/commands       the console's registry and interpreter (decision 0010)
packages/core           the simulation (no screen)
packages/presentation   Three.js: what is seen
games/dojo              the first game
site                    the web (Astro)
```

Each package is called `@manifold/...` and exports its TypeScript source code directly (without compiling): Vite and Vitest understand it, and changes show up hot.

**Tools:**

| For what             | What                                                                                                             | Why                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node                 | **26 LTS** (since 2026-11-11; before, 24), pinned with `mise.toml` (local) and `.nvmrc` (continuous integration) | 26 is the active LTS since October 2026, supported until April 2029; 24 went into maintenance. The types (`@types/node`) are bumped together with Node |
| Packages             | **npm** with _workspaces_                                                                                        | It comes with Node; no other tool to install. (pnpm is stricter with dependencies; that strictness comes here from the compiler and the linter: 0003)  |
| Language             | **TypeScript 6.0**                                                                                               | 7 (rewritten in Go) is out, but the linter and Astro's check do not accept it yet. It is revisited when they do                                        |
| Build and serve      | **Vite** (through Astro)                                                                                         | Fast and with hot reload; already known                                                                                                                |
| Headless tests       | **Vitest**, `*.test.ts` files next to the code                                                                   | It understands workspaces and TypeScript with no configuration                                                                                         |
| Tests in the browser | **Playwright** (Chromium), in `e2e/`                                                                             | It opens every page like a person. In V1, a change in the start-up broke every key without any test seeing it                                          |
| Style                | **ESLint** (with typescript-eslint) and **Prettier**                                                             | The linter also guards the boundaries (0003)                                                                                                           |

**Root scripts:** `npm run dev`, `build`, `check` (types), `lint`, `format`, `format:check`, `test`, `e2e`, and `verify` (all of the above except the browser).

## Consequences

- A single `npm install`, a single history and a single continuous integration.
- Exporting the source code without compiling is simple, but it ties the packages to tools that understand TypeScript. If a package is ever published, its build is added.

## Alternatives discarded

- **Several repositories:** every engine change would need a published version to see it in a game.
- **pnpm or Turborepo:** useful in big monorepos; here they add tools without a problem to solve yet.
- **Node's test runner** (`node:test`, V1's): it worked fine, but Vitest gives better reports, a watch mode and integrates with Vite.
