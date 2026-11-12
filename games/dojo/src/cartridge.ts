import { quat } from '@manifold/common';
import type { Vec3 } from '@manifold/commands';
import type { Cartridge, World } from '@manifold/core';

/** The big cube's spin at the start (a tilted axis: so it shows that it spins in 3D, not just "turns"). */
const START_SPIN: Vec3 = [0.35, 0.9, 0.15];

/** A color from the world's randomness (not too dark). */
const randomColor = (world: World) => Math.floor(world.random.between(0.25, 1) * 0xffffff) & 0xf0f0f0;

/**
 * A small cube with place, size, spin and color taken from THE WORLD'S RANDOMNESS (not Math.random).
 * It is a dynamic body: it falls, bounces and piles up (stage 1a).
 */
function randomCube(world: World) {
  const r = world.random;
  const side = r.between(0.2, 0.6);
  world.createEntity({
    transform: { position: [r.between(-6, 6), r.between(0.5, 4), r.between(-6, 6)], rotation: quat.identity() },
    body: {
      type: 'dynamic',
      shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
      angularVelocity: [r.between(-2, 2), r.between(-2, 2), r.between(-2, 2)],
    },
    appearance: { shape: 'box', size: [side, side, side], color: randomColor(world) },
  });
}

/** A ball at a place, with its size and color from the world's randomness: it falls from there. */
function ball(world: World, position: Vec3) {
  const diameter = world.random.between(0.3, 0.7);
  world.createEntity({
    transform: { position: [...position], rotation: quat.identity() },
    // A little angular damping: Rapier has no rolling resistance, and without it the ball would roll
    // until it fell off the floor's edge.
    body: { type: 'dynamic', shape: { kind: 'ball', radius: diameter / 2 }, restitution: 0.5, angularDamping: 0.8 },
    appearance: { shape: 'sphere', size: [diameter, diameter, diameter], color: randomColor(world) },
  });
}

/**
 * THE DOJO'S CARTRIDGE: the first game, the engine's lab. A floor, a big cube that spins (a
 * kinematic body: it pushes what it touches), small cubes that fall from the world's randomness, and
 * balls on demand. It tests what matters: that a game, from OUTSIDE the engine, puts things in a
 * world that the simulation runs (with its physics) and the presentation draws.
 *
 * What the Dojo lets people change it DECLARES (decision 0010), each thing with its scope:
 * - `dojo.cubes` is STARTUP: how many cubes there are when the world is born (changing it restarts it);
 * - `dojo.spin` is WORLD: the big cube's spin, which changes at a given step;
 * - `dojo.spawn x y z` is a WORLD action: a ball that falls from there, at a given step.
 * (And the engine's `seed` and `physics.gravity`, which the Dojo lets people touch too.)
 *
 * The Dojo's rules do not touch the screen (this file runs the same in tests): what is seen is
 * decided by `index.ts`.
 */
export const DojoCartridge: Cartridge = {
  id: 'dojo',
  title: 'Dojo',

  onDeclare(registry) {
    registry.declareVariable({
      name: 'dojo.cubes',
      description:
        "Small cubes at the start, at places taken from the world's randomness: with the same seed, always the same ones.",
      scope: 'startup',
      type: { kind: 'integer', min: 0, max: 200 },
      default: 0,
    });
    registry.declareVariable({
      name: 'dojo.spin',
      description: 'How the big cube spins: radians per second around each axis (x y z).',
      scope: 'world',
      type: { kind: 'vector' },
      default: START_SPIN,
      onWorld(world, value) {
        // The big cube is the world's first entity (id 1): `onStart` creates it, before anything else.
        const cube = world.entities.get(1);
        if (cube?.spin) cube.spin.angularVelocity = [...(value as Vec3)];
      },
    });
    registry.declareCommand({
      name: 'dojo.spawn',
      description: "Drops a ball from (x, y, z), with its size and color taken from the world's randomness.",
      args: [{ name: 'place', type: { kind: 'vector' } }],
      onWorld(world, [place]) {
        ball(world, place as Vec3);
      },
    });
  },

  onStart(world, registry) {
    // The big cube goes first: it is entity 1, the one `dojo.spin` turns.
    world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      spin: { angularVelocity: [...START_SPIN] },
      body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
      appearance: { shape: 'box', size: [1, 1, 1], color: 0xe0a040 },
    });
    // The floor: a fixed body whose top is at y = 0, under the grid. It has no appearance: the grid is
    // what is seen.
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
    });
    const cubes = Number(registry.value('dojo.cubes'));
    for (let i = 0; i < cubes; i++) randomCube(world);
  },
};
