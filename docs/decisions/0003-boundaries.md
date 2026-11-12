# 0003. The boundaries between layers, guarded by the compiler and the linter

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The simulation has to run the same in the browser, on a server and in the tests. In V1 the boundary was guarded by a test that searched the code for words ("document", "THREE.Mesh"); before that test existed, the boundary was crossed (step 10c's "mesh debt").

## Decision

Three guards, from the strongest to the weakest:

1. **The compiler.** `packages/common`, `packages/commands` and `packages/core` compile **without the DOM library** (`"lib": ["ES2023"]`, `"types": []`). Writing `document`, `window` or `HTMLElement` in the simulation **does not compile**.
2. **The linter** (`eslint.config.js`, `no-restricted-imports`):
   - `common` and `commands` import nothing of the project, nor Three.js;
   - `core` does not import Three.js, nor the presentation, nor a game;
   - `presentation` does not import a game;
   - a game imports the engine (`common`, `commands`, `core`, `presentation`), never another game;
   - a game's **cartridge** (its rules) does not import Three.js nor the presentation: it runs without a screen.
3. **The declared dependencies:** each `package.json` says what it depends on; the core does not declare `three`.

## Consequences

- A boundary error shows up when compiling or linting, with a message that says why.
- The simulation's tests use Vitest; those files can import `vitest`, which brings Node types: they compile with `skipLibCheck`.

## Alternatives discarded

- **A test that searches text** (V1's): it works, but it comes late (when running the tests) and comments fool it.
- **dependency-cruiser or a boundaries plugin:** more powerful; for four layers, `no-restricted-imports` is enough.
