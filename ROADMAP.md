# Roadmap

Where Manifold Gaming is going, how far it got, and what is left. It is updated at the end of every step. The why of each piece is in [the decisions](docs/decisions/README.md); what happened in each step, with its findings and measurements, in [the Bitácora](https://rodrigomartinvg.github.io/Manifold_Gaming/bitacora/) (the site's log, in Spanish).

**Legend:** ✅ done · 🔨 in progress · ⬜ to do · 🔒 a decision is needed first

**Now:** phase 1. Done: 1a, the friendlier console, 1b, 1c (the phase's demonstration works) and 1c2 (turning and the camera). Next: step 1d, the networking skeleton.

## The plan in one table

| Phase                      | What it brings                                                                               | How it is shown                                                                   | Status          |
| -------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| 0. Foundations             | The repository and its tools, the site, the executable tutorial, the console, a minimal core | A cube spinning in the Dojo, computed by the simulation                           | ✅              |
| 1. Physics and a character | Physics, a character and its camera, replays, an early networking skeleton                   | A character runs and jumps in a classic level, and its replay gives the same hash | 🔨 (1a–1c done) |
| 2. Capabilities            | Climbing, grabbing…, composed                                                                | Turning capabilities on and off live                                              | ⬜              |
| 3. A world that responds   | Mechanisms, signals, breakables, light                                                       | Breaking a lamp changes what a guard sees                                         | ⬜              |
| 4. Combat and bots         | Weapons, enemies that use the world, navigation                                              | A guard who calls the elevator                                                    | ⬜              |
| 5. Games                   | Three classic games, complete: story, levels, graphics, sound                                | A platformer, an action adventure and a shooter, on the site                      | ⬜              |
| 6. Networking and levels   | Networked matches, a level editor                                                            | The shooter, online                                                               | ⬜              |
| 7. Strange worlds          | Gravity that changes from place to place, walking on walls, spaces glued to themselves       | Two games of the second wave                                                      | ⬜              |

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
- ✅ **1b — The character and its camera:** a character as data (capsule, character controller: slides along walls, climbs 35 cm steps and 50° slopes, snaps to the ground, pushes cubes), coyote time and jump buffering, its "up" from the gravity (tested walking on a wall with gravity along −Z), player inputs through the session at concrete steps (kept only when they change, part of the hash), keyboard and gamepad turned into a world direction by where the camera looks, a follow camera (`view.camera`), and a classic level in the Dojo (`dojo.level course`).
- ✅ **1c — Replays and ghosts:** a replay is the world's birth recipe, the inputs and console changes with their steps, and the last step's hash, as readable text; links (`#replay=…`, compressed) play it and check the hash at the end; `replay export|play|stop`; ghosts (`ghost`, `#ghost=…`) run another world in step, next to the player. The input gained "where to look" (`face`) before the format was fixed, for `view.camera aim`. A run driven with the keys in Chromium, Firefox and WebKit replays to the same hash in Node.
- ✅ **1c2 — Turning and the camera:** a second key scheme, `controls.scheme tank`: W and S go where the character looks, A and D turn it on its own axis, Q and E (or Alt with A and D) go to its sides. The input gains `ahead`, `side` and `turn`, resolved in the simulation (where the character looks is the world's), turning without trigonometry. Cameras: `follow` on a leash (going to a side turns it), a new `chase` that comes back behind the character, the gamepad's right stick, and aim's vertical mouse the right way round. Replays carry a version (`# Manifold replay 2`) and write inputs as words; a little negative input rounded to −0 no longer gives another hash on replay.
- ⬜ **1d — The networking skeleton:** a client and a server that run the same world, early, so it shapes everything else (decision 0000, rule 6).
- ⬜ **The phase's lessons:** a physics engine (Rapier in the live examples: it has to be added to `site/scripts/vendor.mjs`), the character and its camera, replays.
- ✅ **The demonstration:** a character runs and jumps in a classic level, and its replay gives the same hash — in Chromium, Firefox, WebKit and Node. The seed of the platformer.

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
- ⬜ **Shorter replay links** — 30 s in the course with the camera turning is about 5,900 characters (every little turn changes the direction asked for); some chat apps cut links that long. The direction could be kept coarser, or in binary.
