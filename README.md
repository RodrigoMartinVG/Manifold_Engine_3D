# Manifold Gaming

**A lab of 3D physical worlds for the web.** An engine of its own (TypeScript, [Three.js](https://threejs.org), [Rapier](https://rapier.rs)) where gravity is a field, things are made of capabilities and what happens can be replayed; a **Dojo** to experiment with it; **games** on top; and a **tutorial** written as the engine grows.

🌐 **Site:** https://rodrigomartinvg.github.io/Manifold_Gaming/ (in Spanish for now)

> Status: **phase 1** (physics and a character). The Dojo has physics (Rapier, its deterministic build): cubes that fall, balls dropped from its console, a gravity that can be changed.

## How it is organized

```
packages/common         seeded randomness and math on plain data
packages/commands       the registry and interpreter behind the console (no screen)
packages/core           the simulation: the world, its fixed step, its events (no screen)
packages/presentation   what is seen: Three.js, and the console
games/dojo              the first game (the lab), with its saved rooms in recipes/
site                    the website: home, the project, play, the tutorial and the Bitácora (Astro + Starlight)
site/src/lessons        the lessons' code (edited and run in the page)
docs/decisions          the architecture decisions, with their why
e2e                     tests in a real browser (Playwright)
```

The layers only depend inward: the core knows neither the presentation nor the games. The compiler and the linter guard it ([decision 0003](docs/decisions/0003-boundaries.md)).

**Languages:** the site (the tutorial, the Bitácora, its pages) is in Spanish; everything else, the code, the console, the tests, the decisions and the commits, is in English ([decision 0011](docs/decisions/0011-languages.md)).

## Working on it

You need [mise](https://mise.jdx.dev) (or Node 26).

```bash
mise install          # Node 26, this project's
npm install
npm run dev           # the site and the Dojo, with hot reload
```

| Command                | What it does                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | The site at http://localhost:4321/Manifold_Gaming/                                                                                                      |
| `npm run verify`       | Types, linter, formatting and headless tests                                                                                                            |
| `npm run test:watch`   | The tests, run again on every save                                                                                                                      |
| `npm run e2e`          | Builds the site and tests it in Chromium, and the physics also in Firefox and WebKit (the first time: `npx playwright install chromium firefox webkit`) |
| `npm run build`        | The site ready to publish, in `site/dist`                                                                                                               |
| `npm run draw -w site` | Generates the site's drawings again (background, logo, gears) from their geometry                                                                       |

Where it is going and how far it got: [ROADMAP.md](ROADMAP.md).

How we work: straight on `main`, checking on the machine first ([decision 0009](docs/decisions/0009-straight-to-main.md)); commits and tags per stage in [decision 0005](docs/decisions/0005-way-of-working.md). All the decisions: [docs/decisions](docs/decisions/README.md).

## Where it comes from

It is the second version of an engine that grew step by step as a shooter. No code is copied from that version: lessons are brought over, written down with their numbers in [decision 0000](docs/decisions/0000-why-a-v2.md).
