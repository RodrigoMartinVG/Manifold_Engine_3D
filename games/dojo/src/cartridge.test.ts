import { expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { registryFor, Session, stateHash, STEP } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

/** A Dojo registry with a recipe applied (like a link's or a room's). */
function registryWith(recipe = '') {
  const registry = registryFor(DojoCartridge);
  const errors = registry.run(recipe, 'recipe').filter((m) => m.level === 'error');
  expect(errors).toEqual([]);
  return registry;
}

test('the Dojo puts a cube that spins at |ω| rad/s, the same in two sessions with the same seed', () => {
  const a = new Session(DojoCartridge);
  const b = new Session(DojoCartridge);
  expect(a.world.entities.size).toBe(1);
  for (let i = 0; i < 300; i++) {
    a.step();
    b.step();
  }
  expect(stateHash(b.world)).toBe(stateHash(a.world));
  const cube = [...a.world.entities.values()][0]!;
  // Turned: |ω|·t (5 s at 0.99 rad/s = 4.95 rad). `angleBetween` gives the shortest way (0 to π).
  const turned = (Math.hypot(0.35, 0.9, 0.15) * 300 * STEP) % (2 * Math.PI);
  const shortest = Math.min(turned, 2 * Math.PI - turned);
  expect(quat.angleBetween(quat.identity(), cube.transform!.rotation)).toBeCloseTo(shortest, 9);
});

test("dojo.cubes (startup) adds cubes from the world's randomness; same seed, same cubes", () => {
  const a = new Session(DojoCartridge, { registry: registryWith('seed 7; dojo.cubes 10') });
  const b = new Session(DojoCartridge, { registry: registryWith('seed 7; dojo.cubes 10') });
  const c = new Session(DojoCartridge, { registry: registryWith('seed 8; dojo.cubes 10') });
  expect(a.world.entities.size).toBe(11);
  expect(stateHash(b.world)).toBe(stateHash(a.world));
  expect(stateHash(c.world)).not.toBe(stateHash(a.world));
  // A value that does not fit changes nothing (and says so): only the usual cube.
  const registry = registryFor(DojoCartridge);
  expect(registry.run('dojo.cubes many', 'recipe')[0]?.level).toBe('error');
  expect(new Session(DojoCartridge, { registry }).world.entities.size).toBe(1);
});

test('a WORLD change enters at the next step, stays in the history, and is deterministic', () => {
  const play = () => {
    const session = new Session(DojoCartridge, { registry: registryWith('dojo.cubes 3') });
    const hashes: number[] = [];
    for (let i = 1; i <= 120; i++) {
      if (i === 30) session.registry.run('dojo.spin 0 3 0');
      if (i === 60) session.registry.run('dojo.spawn 0 2 0');
      session.step();
      hashes.push(stateHash(session.world));
    }
    return { session, hashes };
  };
  const a = play();
  const b = play();
  // What was typed before step 30 enters AT THE START of step 30 (not "halfway" through another).
  expect(a.session.history).toEqual([
    { step: 30, line: 'dojo.spin 0 3 0' },
    { step: 60, line: 'dojo.spawn 0 2 0' },
  ]);
  expect(a.session.world.entities.get(1)!.spin!.angularVelocity).toEqual([0, 3, 0]);
  expect(a.session.world.entities.size).toBe(5);
  // The same changes at the same steps: the same hash, step by step.
  expect(b.hashes).toEqual(a.hashes);
  // And the change does change the world: without it, another hash from step 30.
  const unchanged = new Session(DojoCartridge, { registry: registryWith('dojo.cubes 3') });
  for (let i = 1; i <= 30; i++) unchanged.step();
  expect(stateHash(unchanged.world)).not.toBe(a.hashes[29]);
});

test('world values that come in a recipe are part of how the world is born (step 0)', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.spin 1 0 0') });
  expect(session.world.entities.get(1)!.spin!.angularVelocity).toEqual([1, 0, 0]);
  expect(session.history).toEqual([]); // it is not a change: it was born like that
});

test('a recipe cannot spawn cubes (dojo.spawn is an action, not a setting)', () => {
  const registry = registryFor(DojoCartridge);
  const messages = registry.run('dojo.spawn 0 2 0', 'recipe');
  expect(messages[0]?.text).toContain('cannot be used in a recipe');
});

test('every saved room of the Dojo loads without errors, and has a title', () => {
  expect(Object.keys(ROOMS).length).toBeGreaterThan(0);
  for (const [name, room] of Object.entries(ROOMS)) {
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); // its address: lowercase English words and dashes
    expect(room.title, name).toBeTruthy();
    const registry = registryFor(DojoCartridge);
    // View values are declared by the presentation: here only the game's and the engine's matter.
    const errors = registry
      .run(room.text, 'recipe')
      .filter((m) => m.level === 'error' && !/no such name "(show|view)\./.test(m.text));
    expect(errors, name).toEqual([]);
  }
});
