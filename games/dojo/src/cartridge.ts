import { quat } from '@manifold/common';
import type { Vec3 } from '@manifold/commands';
import type { Cartridge, World } from '@manifold/core';

/** The big cube's spin at the start (a tilted axis: so it shows that it spins in 3D, not just "turns"). */
const START_SPIN: Vec3 = [0.35, 0.9, 0.15];

/** A small cube with place, size, spin and color taken from THE WORLD'S RANDOMNESS (not Math.random). */
function randomCube(world: World, position?: Vec3) {
  const r = world.random;
  const side = r.between(0.2, 0.6);
  const place: Vec3 = position ?? [r.between(-6, 6), r.between(0.5, 4), r.between(-6, 6)];
  world.createEntity({
    transform: { position: place, rotation: quat.identity() },
    spin: { angularVelocity: [r.between(-2, 2), r.between(-2, 2), r.between(-2, 2)] },
    appearance: { shape: 'box', size: [side, side, side], color: Math.floor(r.between(0.25, 1) * 0xffffff) & 0xf0f0f0 },
  });
}

/**
 * THE DOJO'S CARTRIDGE: the first game, the engine's lab. For now, a spinning cube and small random
 * cubes. It looks like little, and it tests what matters: that a game, from OUTSIDE the engine, puts
 * things in a world that the simulation runs and the presentation draws.
 *
 * What the Dojo lets people change it DECLARES (decision 0010), each thing with its scope:
 * - `dojo.cubes` is STARTUP: how many cubes there are when the world is born (changing it restarts it);
 * - `dojo.spin` is WORLD: the big cube's spin, which changes at a given step;
 * - `dojo.spawn x y z` is a WORLD action: a new cube, at a given step.
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
      description: "Creates a small cube at (x, y, z), with size, spin and color taken from the world's randomness.",
      args: [{ name: 'place', type: { kind: 'vector' } }],
      onWorld(world, [place]) {
        randomCube(world, place as Vec3);
      },
    });
  },

  onStart(world, registry) {
    world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      spin: { angularVelocity: [...START_SPIN] },
      appearance: { shape: 'box', size: [1, 1, 1], color: 0xe0a040 },
    });
    const cubes = Number(registry.value('dojo.cubes'));
    for (let i = 0; i < cubes; i++) randomCube(world);
  },
};
