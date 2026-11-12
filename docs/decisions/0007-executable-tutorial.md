# 0007. The executable tutorial and the Bitácora

- **Status:** accepted (it modifies the shape of the "chapters" of 0002 and 0005)
- **Date:** 2026-11-11

## Context

The first idea was a tutorial with one long chapter per stage: everything we did, with findings, measurements, self-evaluation and a glossary. The author discarded it: repeating in detail what we do is heavy, and the repository and the reports are already there for that. What is wanted is **to learn the technology by touching it**: every idea attached to a small piece of code that runs in the page, shows something and can be changed.

## Decision

**Two sections on the site:**

| Section      | What it is                                                                                                                                | Where                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Tutorial** | Short lessons that go with each stage, simplified: one idea, executable code, its subtleties and a link to "this is how Manifold does it" | `site/src/content/docs/tutorial/<stage>/` and its code in `site/src/lessons/<stage>/<lesson>/` |
| **Bitácora** | Each stage's report (the log): what we did, findings, measurements, decisions                                                             | `site/src/content/docs/bitacora/`                                                              |

**The runner** (`<LiveCode lesson="..." />`, in `site/src/components/` and `site/src/live-code/`):

- **Editor:** CodeMirror 6, one tab per lesson file (to show how it splits into modules). Run: ▶ or Ctrl/⌘ + Enter. ↺ goes back to the original.
- **Real TypeScript.** Sucrase strips the types in the browser (it keeps the line numbers). Type checking is done by the compiler in the repository: the lessons are real `.ts` files, checked by `astro check` and by the linter.
- **Isolated:** the code runs in a `sandbox="allow-scripts"` iframe, without `allow-same-origin`. It has another origin: it cannot read anything of the site, and an error of its own does not break the page. They talk with `postMessage`.
- **Libraries:** the same versions as the engine. `site/scripts/vendor.mjs` builds, at build time, one file per library (Three.js, OrbitControls, lil-gui), without relative imports. The page hands them to the iframe, which turns them into `blob:` modules with an **import map**. The lesson's files are called `lesson/<name>` in that map (a `blob:` has no folder to resolve `./` against).
- **One at a time:** running an example stops the one that was running, and its iframe is removed (each one uses a WebGL context).
- **The result goes above the code.** What is seen is the first thing the reader finds. Besides, Chrome gives no frames to a cross-origin iframe that is off screen (measured: 0 frames), so below a long editor nothing showed.
- **Tested:** the browser tests (`e2e/tutorial.e2e.ts`) run every example of every tutorial page and demand that it draws (or writes to the console) without errors. If an update breaks a lesson, the check fails.

**Pace:** the tutorial goes a little behind the engine. A lesson is written when the idea of its stage has settled.

## Consequences

- The lessons do not rot: they compile, pass the linter and run on every change.
- They are almost always independent of the engine (they use the libraries directly); the ones that teach how to _use_ the engine will import `@manifold/...` (it will have to be added to the library build).
- An infinite loop in the reader's code can hang the tab: an iframe in the same process shares the thread. It can be mitigated later (a time limit, or an iframe in another process).
- A lesson with Rapier needs it added to `vendor.mjs` (its file carries the WebAssembly inside: about 2 MB, fetched only when run).

## Alternatives discarded

- **Long chapters per stage** (the first version): heavy, and it repeated the repository.
- **Sandpack or StackBlitz:** turnkey executable editors, but they depend on external services and are heavy.
- **A same-origin iframe** with a runner page: simpler (the browser caches the modules), but the reader's code would have access to the site.
