# Roadmap

Where Manifold Gaming is going, how far it got, and what is left. It is updated at the end of every step. The why of each piece is in [the decisions](docs/decisions/README.md); what happened in each step, with its findings and measurements, in [the Bitácora](https://rodrigomartinvg.github.io/Manifold_Gaming/bitacora/) (the site's log, in Spanish).

**Legend:** ✅ done · 🔨 in progress · ⬜ to do · 🔒 a decision is needed first

**Now:** phase 1. Done: 1a and the friendlier console. Next: step 1b, the character and its camera.

## The plan in one table

| Phase                      | What it brings                                                                               | How it is shown                                                                   | Status       |
| -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| 0. Foundations             | The repository and its tools, the site, the executable tutorial, the console, a minimal core | A cube spinning in the Dojo, computed by the simulation                           | ✅           |
| 1. Physics and a character | Physics, a character and its camera, replays, an early networking skeleton                   | A character runs and jumps in a classic level, and its replay gives the same hash | 🔨 (1a done) |
| 2. Capabilities            | Climbing, grabbing…, composed                                                                | Turning capabilities on and off live                                              | ⬜           |
| 3. A world that responds   | Mechanisms, signals, breakables, light                                                       | Breaking a lamp changes what a guard sees                                         | ⬜           |
| 4. Combat and bots         | Weapons, enemies that use the world, navigation                                              | A guard who calls the elevator                                                    | ⬜           |
| 5. Games                   | Three classic games, complete: story, levels, graphics, sound                                | A platformer, an action adventure and a shooter, on the site                      | ⬜           |
| 6. Networking and levels   | Networked matches, a level editor                                                            | The shooter, online                                                               | ⬜           |
| 7. Strange worlds          | Gravity that changes from place to place, walking on walls, spaces glued to themselves       | Two games of the second wave                                                      | ⬜           |

The games (decision [0012](docs/decisions/0012-the-games.md)): first three classics that share one character, growing with the phases — the platformer with phases 1–2, the action adventure with 3–4, the shooter with 4–6 — and complete in phase 5. The strange ones come after, in phase 7.

## Phase 0 — Foundations ✅

- ✅ **0** — The monorepo and its tools, the boundaries between layers, the state as plain data, the site on GitHub Pages, a minimal core (world, fixed step, randomness, hash), the Dojo as the first game. Decisions 0000–0006.
- ✅ **0b** — The executable tutorial: lessons with code that is edited and run in the page (0007).
- ✅ **0c** — The workshop look, side panels that hide, full-width examples, the tutorial with context and math in layers (0008), straight to main (0009).
- ✅ **0d** — The Quake-like console and the recipes: rooms, links with a recipe inside, startup recipe, bindings (0010).
- ✅ **0e** — Everything in English except the site's texts; the tutorial introduces the English terms and has a glossary (0011).
- ✅ **0f** — The site with sections: Jugar, Tutorial, Bitácora, Proyecto; one sidebar per section; a home page with doors.

## Phase 1 — Physics and a character 🔨

- ✅ **1a — The physics engine.** Rapier (its deterministic build) behind a small boundary; bodies as data; gravity as a field, stored as data; the Dojo with physics; the same hash in Chromium, Firefox, WebKit and Node.
- ✅ **Before 1b — The console and the camera, friendlier:** a free camera in the Dojo (drag to orbit, wheel to zoom, `camera.reset`); `help` with the game's examples; console output that can be clicked (examples, rooms, Tab options, suggestions with the whole line corrected); `inspect <id>` and a click on an object to inspect it; `reset [name]`; `vars` grouped by scope; clearer usage messages; `show.stats` with the physics step's time and the number of bodies.
- ⬜ **1b — The character and its camera:** a character that runs and jumps (kinematic controller), a third-person camera that follows it, its "up" received as data (always the same, for now), keyboard, mouse and gamepad.
- ⬜ **1c — Replays and ghosts:** every input carries its player `(step, player, action)`; a replay is the seed plus the inputs, small enough to travel in a link; ghosts by link.
- ⬜ **1d — The networking skeleton:** a client and a server that run the same world, early, so it shapes everything else (decision 0000, rule 6).
- ⬜ **The phase's lessons:** a physics engine (Rapier in the live examples: it has to be added to `site/scripts/vendor.mjs`), the character and its camera, replays.
- ⬜ **The demonstration:** a character runs and jumps in a classic level, and its replay gives the same hash — the seed of the platformer.

## Phase 2 — Capabilities ⬜

- ⬜ The composition protocol: one exclusive locomotion mode plus contributions that add up, resolved in one place (decision 0000).
- ⬜ Climbing, grabbing, gliding… as pieces that are turned on and off live.
- ⬜ The platformer grows: moving platforms, levels.
- 🔒 **Where the art comes from** (made in Blender, generated with code, or free-licensed packs; never copied) — before the character needs a model.
- ⬜ Models and animations (glTF), within what a modest integrated GPU can draw.

## Phase 3 — A world that responds ⬜

- ⬜ Mechanisms and signals: doors, elevators, buttons.
- ⬜ Things that break; light that can be turned off.
- ⬜ Sound.
- ⬜ Levels as data, made with a tool (the phase 6 editor may have to come earlier).
- ⬜ Saving the game, on top of the world's snapshots.
- ⬜ The action adventure starts.

## Phase 4 — Combat and bots ⬜

- ⬜ Weapons: hitscan and projectiles.
- ⬜ Bots that patrol, see, hear, chase, and use the world (the guard who calls the elevator).
- ⬜ Navigation.
- ⬜ The story: dialogue, scenes, objectives that chain.
- ⬜ The shooter starts.

## Phase 5 — Games ⬜

- ⬜ The platformer, complete.
- ⬜ The action adventure, complete.
- ⬜ The shooter, complete (single player, with bots).

## Phase 6 — Networking and levels ⬜

- ⬜ Networked matches: the shooter online (prediction, reconciliation, lag compensation).
- 🔒 Who can change the world in a networked match (the permissions left open by decision 0010).
- ⬜ A level editor.

## Phase 7 — Strange worlds ⬜

- ⬜ Gravity fields that change from place to place (planets, tori), walking on walls and ceilings.
- ⬜ A gluing system: spaces that wrap around, or come back mirrored (physics, drawing and networking across the seams).
- ⬜ Two games of the second wave, chosen from the idea bank when the base is firm.

## Open questions

- 🔒 **The art's source** — before phase 2's character model.
- ⬜ **Firefox and WebKit in continuous integration** — the physics determinism test runs in them locally; in GitHub, only Chromium until their WebGL is checked on Linux.
- ⬜ **The hash on every step** — 1.8 ms with 200 bodies, three times a physics step; to revisit if replays need it on every step.
- ⬜ **Rapier's usual build** — whether it would also be deterministic across browsers was not measured; the deterministic one was chosen so as not to depend on it.
