# Roadmap

Where Manifold Gaming is going, how far it got, and what is left. It is updated at the end of every step. The why of each piece is in [the decisions](docs/decisions/README.md); what happened in each step, with its findings and measurements, in [the Bitácora](https://rodrigomartinvg.github.io/Manifold_Gaming/bitacora/) (the site's log, in Spanish).

**Legend:** ✅ done · 🔨 in progress · ⬜ to do · 🔒 a decision is needed first

**Now:** phase 1 is done (1a–1f: physics, a character, replays, snapshots, the networking skeleton, and its five lessons). Next: phase 2, starting with the platformer as a game — levels as data, sensors, a level's loop — and the decision on where the art and the sound come from.

## The plan in one table

| Phase                      | What it brings                                                                                             | How it is shown                                                                   | Status |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| 0. Foundations             | The repository and its tools, the site, the executable tutorial, the console, a minimal core               | A cube spinning in the Dojo, computed by the simulation                           | ✅     |
| 1. Physics and a character | Physics, a character and its camera, replays, the world's state that travels, an early networking skeleton | A character runs and jumps in a classic level, and its replay gives the same hash | ✅     |
| 2. Capabilities            | Levels as data; climbing, grabbing…, composed; models and animations                                       | Turning capabilities on and off live, in a real level                             | ⬜     |
| 3. A world that responds   | Mechanisms, signals, breakables, light, sound; the game's interface; saving                                | Breaking a lamp changes what a guard sees                                         | ⬜     |
| 4. Combat and bots         | Weapons, enemies that use the world, navigation, the story                                                 | A guard who calls the elevator                                                    | ⬜     |
| 5. Games                   | Three classic games, complete: story, levels, graphics, sound                                              | A platformer, an action adventure and a shooter, on the site                      | ⬜     |
| 6. Networking and levels   | Networked matches, a level editor                                                                          | The shooter, online                                                               | ⬜     |
| 7. Strange worlds          | Gravity that changes from place to place, walking on walls, spaces glued to themselves                     | Two games of the second wave                                                      | ⬜     |

The games (decision [0012](docs/decisions/0012-the-games.md)): first three classics that share one character, growing with the phases — the platformer with phases 1–2, the action adventure with 3–4, the shooter with 4–6 — and complete in phase 5. The strange ones come after, in phase 7.

## What each phase leaves for the next

The question for the start of every step: does it have what it needs, and does it leave what the next ones will need? Reviewed on 2026-11-12, after 1c2. That review moved levels and sensors to phase 2, put snapshots and an extensible input before the network, and added what no phase built (the game's interface, the inventory, dungeons from a seed, where the server runs).

| Piece                                                                        | Built in               | Needed by                                                                                       |
| ---------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Determinism across browsers, measured; no trigonometry in the step           | 1a, 1c2; guarded in 1f | Replays and ghosts, networking, bots                                                            |
| Inputs with their player, at concrete steps                                  | 1b                     | Ghosts (1c), bots (4), networking (1e, 6)                                                       |
| An input each game extends: movement axes plus named buttons                 | 1d                     | Grabbing (2), using (3), firing and reloading (4), without a new replay version for each action |
| Snapshots: the components, Rapier's snapshot and the randomness (0004)       | 1d                     | Joining a match already started (1e), branching a replay, debugging                             |
| Everything through the network's path, even playing alone                    | 1e                     | The shooter online (6): it adds latency handling, without being rebuilt                         |
| Levels as data, in a versioned format                                        | 2                      | The platformer's levels (2), dungeons (3), navigation (4), the editor (6)                       |
| Sensors: volumes that notice who enters                                      | 2                      | Checkpoints and goals (2), buttons and traps (3), bots that hear (4)                            |
| Capabilities, composed                                                       | 2                      | Navigation edges that need a capability (4); the three games                                    |
| The game's interface: menus, pause, HUD, dialogue, inventory                 | 3                      | The action adventure (3), the story (4), the games (5)                                          |
| A pose history for hit tests                                                 | 4                      | Lag compensation (6)                                                                            |
| "Up" as data; where it looks and the camera, carried along when "up" changes | 1b; finished in 7      | The strange worlds (7)                                                                          |

## Phase 0 — Foundations ✅

- ✅ **0** — The monorepo and its tools, the boundaries between layers, the state as plain data, the site on GitHub Pages, a minimal core (world, fixed step, randomness, hash), the Dojo as the first game. Decisions 0000–0006.
- ✅ **0b** — The executable tutorial: lessons with code that is edited and run in the page (0007).
- ✅ **0c** — The workshop look, side panels that hide, full-width examples, the tutorial with context and math in layers (0008), straight to main (0009).
- ✅ **0d** — The Quake-like console and the recipes: rooms, links with a recipe inside, startup recipe, bindings (0010).
- ✅ **0e** — Everything in English except the site's texts; the tutorial introduces the English terms and has a glossary (0011).
- ✅ **0f** — The site with sections: Jugar, Tutorial, Bitácora, Proyecto; one sidebar per section; a home page with doors.

## Phase 1 — Physics and a character ✅

- ✅ **1a — The physics engine.** Rapier (its deterministic build) behind a small boundary; bodies as data; gravity as a field, stored as data; the Dojo with physics; the same hash in Chromium, Firefox, WebKit and Node.
- ✅ **Before 1b — The console and the camera, friendlier:** a free camera in the Dojo (drag to orbit, wheel to zoom, `camera.reset`); `help` with the game's examples; console output that can be clicked (examples, rooms, Tab options, suggestions with the whole line corrected); `inspect <id>` and a click on an object to inspect it; `reset [name]`; `vars` grouped by scope; clearer usage messages; `show.stats` with the physics step's time and the number of bodies.
- ✅ **1b — The character and its camera:** a character as data (capsule, character controller: slides along walls, climbs 35 cm steps and 50° slopes, snaps to the ground, pushes cubes), coyote time and jump buffering, its "up" from the gravity (tested walking on a wall with gravity along −Z), player inputs through the session at concrete steps (kept only when they change, part of the hash), keyboard and gamepad turned into a world direction by where the camera looks, a follow camera (`view.camera`), and a classic level in the Dojo (`dojo.level course`).
- ✅ **1c — Replays and ghosts:** a replay is the world's birth recipe, the inputs and console changes with their steps, and the last step's hash, as readable text; links (`#replay=…`, compressed) play it and check the hash at the end; `replay export|play|stop`; ghosts (`ghost`, `#ghost=…`) run another world in step, next to the player. The input gained "where to look" (`face`) before the format was fixed, for `view.camera aim`. A run driven with the keys in Chromium, Firefox and WebKit replays to the same hash in Node.
- ✅ **1c2 — Turning and the camera:** a second key scheme, `controls.scheme tank`: W and S go where the character looks, A and D turn it on its own axis, Q and E (or Alt with A and D) go to its sides. The input gains `ahead`, `side` and `turn`, resolved in the simulation (where the character looks is the world's), turning without trigonometry. Cameras: `follow` on a leash (going to a side turns it), a new `chase` that comes back behind the character, the gamepad's right stick, and aim's vertical mouse the right way round. Replays carry a version (`# Manifold replay 2`) and write inputs as words; a little negative input rounded to −0 no longer gives another hash on replay.
- ✅ **1d — The world's state that travels:** what a player asks for is named values (buttons, axes, vectors) of declared actions: the core declares the character's, each game its own with its namespace (the Dojo's first: `dojo.throw`, F). The session lets in only what was declared, and a replay that brings anything else is refused. The world remembers the previous step's inputs (`pressed`). Snapshots as decision 0004 defined them (the components, Rapier's snapshot, the randomness, the inputs): restored, the same hash on every step, in Chromium, Firefox, WebKit and Node; `snapshot` and `snapshot load` in the console, and the replay still holds after going back. The hash now counts the id counter. One version for replays and snapshots (3). Measured: the course with 12 cubes, 32 KB of physics and 11 KB of entities, 0.7 ms to save.
- ✅ **1e — The networking skeleton** (decision 0000, rule 6): a new package, `@manifold/net` (no screen, no transport of its own). The server keeps the match, decides at which step each thing enters and sends a tick per step, with the hash every second; every client simulates its own copy and checks it. **Every game plays through it**, with a server in the same page when alone, so every match also checks determinism while it is played. `players.join` and `players.leave` as world data (in the course, a character for each player); who changes the world is the game's (`mayChange`; the Dojo lets everybody); joining a started match with a snapshot and the history; snapshots, restarts and replays are the server's. Two tabs of the same browser play one match (`net open`, `net join`, through a `BroadcastChannel`). Measured: through the server 0.72 ms per step against 0.45 alone (two worlds); a tick, about 52 characters. Left for phase 6, on purpose: internet, prediction, and smoothing what arrives in bursts.
- ✅ **1f — Closing the phase:** a lint rule that keeps out of the simulation (the core, the network, a game's rules) what each JavaScript engine computes its own way (`Math.sin`, `cos`, `atan2`, `hypot`, `exp`, `pow`, `**`), `Math.random` and `quat.fromAxisAngle`; it found the last two uses, the spin of entities without a body, which now turns without trigonometry. The physics lab promised by decision 0010: `show.vectors`, `show.contacts` (read from Rapier through the boundary), `show.gravity`. Rapier in the live examples (4.4 MB, 1.7 MB compressed: each lesson now fetches only the libraries it imports), and the phase's five lessons: a physics engine, a character, replays and ghosts, snapshots, a server and a client — with tests that read what each lesson shows, not only that it runs.
- ✅ **The demonstration:** a character runs and jumps in a classic level, and its replay gives the same hash — in Chromium, Firefox, WebKit and Node. The seed of the platformer.

## Phase 2 — Capabilities ⬜

- ⬜ **First, the platformer as a game, not as a course:**
  - levels as data, in a versioned format (decision 0000: rule 4, and the "versioned world format"): the course leaves the code;
  - sensors: volumes that notice who enters;
  - a level's loop: the start, checkpoints, falling means coming back, the goal.
- 🔒 **Where the art and the sound come from** (made in Blender, generated with code, or free-licensed packs; never copied) — at the start of the phase, together with the level format: if levels are made in Blender, they can come out of it too.
- ⬜ The composition protocol: one exclusive locomotion mode plus contributions that add up, resolved in one place (decision 0000).
- ⬜ Climbing, grabbing, gliding… as pieces that are turned on and off live.
- ⬜ Moving and turning platforms that carry the character (in V1, the character controller got stuck on kinematic bodies).
- ⬜ Models and animations (glTF), within what a modest integrated GPU can draw.

## Phase 3 — A world that responds ⬜

- ⬜ Mechanisms and signals: doors (kinematic, decision 0000), elevators, buttons, on top of phase 2's sensors.
- ⬜ Things that break; light that can be turned off.
- ⬜ Sound: what the simulation's events make heard (steps, hits, doors).
- ⬜ The game's interface: menus, pause, HUD, dialogue boxes, inventory.
- ⬜ A tool to make levels (the phase 6 editor may have to come earlier).
- ⬜ Saving the game: **the game's progress as versioned data** (where you are, what you carry, what you already did), not a raw snapshot of the world. A snapshot, like a replay, belongs to the engine version that made it: the next update would erase every saved game. (Decision 0012 said "on top of the world's snapshots"; refined here.)
- ⬜ The action adventure starts: its inventory, and dungeons made from a seed.

## Phase 4 — Combat and bots ⬜

- ⬜ Weapons: hitscan and projectiles. Hits are tested against a history of poses, so that phase 6 can look back in time (lag compensation).
- ⬜ A first-person camera, for the shooter.
- ⬜ Bots that patrol, see, hear, chase, and use the world (the guard who calls the elevator); their inputs enter like a player's.
- ⬜ Navigation, with edges that need a capability (decision 0000).
- ⬜ The story: dialogue, scenes, objectives that chain.
- ⬜ The shooter starts.

## Phase 5 — Games ⬜

- ⬜ The platformer, complete.
- ⬜ The action adventure, complete.
- ⬜ The shooter, complete (single player, with bots).

## Phase 6 — Networking and levels ⬜

- ⬜ Networked matches: the shooter online, on top of 1e's path: prediction, reconciliation (re-simulating only one's own, decision 0000), lag compensation.
- 🔒 Where the server runs (decision 0002: Pages only serves files): a hosted server, or one of the browsers as the host.
- 🔒 Who can change the world in a networked match (the permissions left open by decision 0010; 1e leaves a first rule).
- ⬜ A level editor, on top of phase 2's level format.

## Phase 7 — Strange worlds ⬜

- ⬜ Gravity fields that change from place to place (planets, tori), walking on walls and ceilings. Where the character looks and the camera are carried along when "up" changes (decision 0000: also standing still, and with an opposite "up").
- ⬜ A gluing system: spaces that wrap around, or come back mirrored (physics, drawing and networking across the seams).
- ⬜ Two games of the second wave, chosen from the idea bank when the base is firm.

## Open questions

- 🔒 **Where the art and the sound come from** — at the start of phase 2.
- 🔒 **Where the server runs** — before phase 6. 1e keeps it open by running in Node and in a browser.
- ⬜ **Replays and ghosts across versions** — a replay only plays on the engine version that recorded it, and the site keeps only the latest one. Before the platformer shares ghosts (phase 5): keep each version published, or ghosts as recorded positions (they survive the changes, but are not checked), with replays by inputs for what must be exact.
- ⬜ **Touch controls** — the site works on phones; the games do not, yet. Before phase 5: touch controls, or keyboard and gamepad only.
- ⬜ **Lessons per step or per phase** — decision 0005 asks for them with each step; phase 1 paid them at its end (1f). For phase 2: either they come with each step, or the rule is changed on purpose.
- ⬜ **Firefox and WebKit in continuous integration** — the physics determinism tests run in them locally; in GitHub, only Chromium until their WebGL is checked on Linux.
- ⬜ **The hash on every step** — 1.8 ms with 200 bodies, three times a physics step. It matters in 1e: the desync check will compare it every few steps, not on every one.
- ⬜ **Rapier's usual build** — whether it would also be deterministic across browsers was not measured; the deterministic one was chosen so as not to depend on it.
- ⬜ **Shorter replay links** — 30 s in the course with the camera turning is about 5,900 characters (every little turn changes the direction asked for); some chat apps cut links that long. The direction could be kept coarser, or in binary.
