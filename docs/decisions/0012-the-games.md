# 0012. The games: the classics first, the strange ones after

- **Status:** accepted (it changes phase 1's demonstration in the plan of [0000](0000-why-a-v2.md), and adds a phase 7)
- **Date:** 2026-11-12

## Context

[0000](0000-why-a-v2.md) planned "complete games on top of the engine" for phase 5, without saying which. Two attempts to say it leaned on what makes the engine unusual:

- **An external draft** proposed a catalog of eleven games: racing on Möbius strips, orbital puzzles, a shooter, a dungeon crawler, a tower defense… each one with two or three multiplayer modes. It got the shape right (every game tests a part of the engine and is a case study for the tutorial), but not the size, and it contradicted measured decisions: it relied on snapshots for rollback networking, which 0000 decided against, and on a determinism across machines that is not guaranteed.
- **A first shortlist of five games** kept the best ideas, but two of them lived on strange topologies and the rest on gravity fields.

The author's verdict: we were losing the north. The hard problems of an engine (a character that feels right, a camera that does not get in the way, collisions that do not snag, enemies that do not act dumb, networking) are the same in a classic game and in a strange one, and the strange one makes them worse. A classic also has references: everybody knows how a jump or a gunfight should feel. And the tutorial's reader comes to learn how a platformer or a shooter is made; the strange is the dessert.

## Decision

**What the games are for:** to prove the engine and to give the tutorial something real to teach. And they are **real games**, not tech demos: a story, designed levels, their own graphics and sound, a beginning and an end. Few and finished to that standard, better than many and promised.

**First wave: three classics that share one character.**

| Game                              | It grows in    | What it asks of the engine                                                                                                                        |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A third-person platformer         | Phases 1 and 2 | The character, its camera, moving platforms, and then the capabilities (climb, grab)                                                              |
| An action adventure (a small RPG) | Phases 3 and 4 | The same character in a world that responds: doors, mechanisms, breakables, light, enemies that use the world, an inventory, dungeons from a seed |
| A shooter                         | Phases 4 to 6  | The same character in first person: weapons, bots, and at the end, networking                                                                     |

Each one is complete in phase 5. The engine's unusual abilities come in as accents, not as the core: replays and ghosts by link, the console and its recipes, a platformer level on a small planet, a dungeon room with its gravity upside down.

**Second wave: the strange ones (a new phase 7).** Two games from the idea bank (planets and topologies, an arena glued to itself, an orbital puzzle, racing on a Möbius strip), chosen when the base is firm and the Dojo has shown what is fun. "Manifold" means three different things there, each with a different cost:

1. **Curved surfaces in space** (spheres, tori, Möbius strips): gravity fields and a character whose "up" changes. Rapier handles them as they are.
2. **Spaces glued to themselves** (leave through a wall, come back through the opposite one, maybe mirrored): they need a gluing system, in the physics, the drawing and the networking. A new capability of the engine.
3. **Truly non-Euclidean geometry** (hyperbolic): Rapier cannot; out of scope.

**What is prepared now, because it is cheap now and expensive later:**

- Gravity is a function of the position, not a constant (in the classics it always returns "down").
- The character receives its "up" as data (in the classics, always the same).
- Every input carries its player: `(step, player, action)`. Two players on one keyboard, a ghost, a bot and the network are the same thing for a cartridge.
- Determinism across machines: Rapier's deterministic build from the start, and a measurement of whether two runtimes give the same hash.
- A replay is the seed plus the inputs, small enough to travel in a link.
- The core does not assume the world is one seamless box (the gluing may come).

**What is not done now:** several gravity fields, walking on walls and ceilings, gluing spaces.

**Phase 1's demonstration changes:** from "walk around a planet" to **"a character runs and jumps in a classic level, and its replay gives the same hash"**. The planet goes to phase 7.

And for every game, first wave or second:

- **At most one natural multiplayer mode.** The engine guarantees the substrate; the game chooses.
- **An identity of its own.** The site's workshop look can be a nod, not an obligation.
- **Original.** A genre, yes; a copy of an existing game (its names, levels or look), no.

## Consequences

- The plan's phases stay, with a phase 7 at the end. The site's tables of phases change with it.
- Real games need what the plan did not list yet, and it enters as each game needs it:
  - **graphics and sound:** models, animations, materials, effects and audio, with a pipeline to bring them into the engine (glTF for the models), within what a modest integrated GPU can draw;
  - **levels as data,** made with a tool (the editor of phase 6 may have to come earlier);
  - **the story:** dialogue, the scenes that tell it, objectives that chain;
  - **saving the game,** on top of the world's snapshots.
- **Where the art comes from is still open:** made for the project (in Blender, or generated with code like the site's drawings), or free-licensed packs that allow it. Whatever the source, nothing copied from an existing game. It is decided before the first game needs it.
- The three classics share the character: what phase 1 builds is used three times, and the third use shows whether it was right.
- The risk is looking generic. What sets the games apart is the rest: replays and ghosts by link, the console and its recipes, the tutorial and the Bitácora that tell how each piece was made, and the accents.
- The external draft stays outside the repository, as an idea bank for phase 7.

## Alternatives discarded

- **A catalog of eleven games** (the external draft): years of work, two decisions of 0000 contradicted, and multiplayer forced into every game.
- **Five games leaning on strange topologies** (the first shortlist): the strange as the core, without references to compare against, and the hardest problems first.
- **The strange first, the classics after:** the same, in another order.
