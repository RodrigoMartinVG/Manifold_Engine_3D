# 0004. The world's state as plain data

- **Status:** accepted (it is completed in phase 1, with the physics)
- **Date:** 2026-11-11

## Context

In V1, the state was spread over classes with objects inside (Three.js vectors, Rapier bodies, references between objects). It worked, but "taking a snapshot of the world" (to save the game at any moment, go back or share an experiment) was left out in step 16k: each system's state had to be gathered by hand.

Measured on V1: the snapshot Rapier takes of its own world weighs 244 KB on the main map (710 colliders), takes 0.75 ms and is restored in 3 ms. And **restoring it creates a new Rapier world**: anything that kept a reference to a body is left pointing at the old world.

## Decision

- **All of the simulation's state lives in `World`**: the clock, the id counter, the randomness (with its state readable and restorable) and the entities.
- **An entity is an id and components**: plain objects of numbers, strings and tuples. No classes, no methods, no Three.js or Rapier objects.
- **Vectors and quaternions are tuples** (`[x, y, z]`, `[x, y, z, w]`), with a minimal math of our own in `common`. This way the core does not depend on Three.js (which belongs to the presentation).
- **Phase 1 (physics):** entities keep the **identifier** of their Rapier body, never the body; the body is looked up by identifier when needed.
- **The hash** (`stateHash(world)`) sums up the whole state in one number, to check determinism step by step.

## Consequences

- A snapshot of the world is "the components, plus Rapier's snapshot, plus the randomness's state"; comparing them or sending them over the network needs no conversion.
- Writing the math by hand costs (and it has to be tested); in exchange, every calculation is understood.
- Tuples are created and thrown away often: in hot loops, functions that write into an existing tuple will be used, when the profiler asks for it.

## Alternatives discarded

- **Using Three.js's math in the core** (like V1, which allowed only its math classes): it tied the core to Three.js and put objects with methods in the state.
- **An ECS library** (like bitecs): meant for thousands of entities with contiguous data; here there are dozens, Rapier already keeps the physics, and it reads worse for learning. It can be revisited if there are ever thousands.
