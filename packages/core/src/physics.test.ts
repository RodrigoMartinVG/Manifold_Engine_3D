import { beforeAll, describe, expect, test } from 'vitest';
import { Random, quat, type Vec3 } from '@manifold/common';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import type { Shape } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A floor: a fixed box whose top is at y = 0. */
function floor(world: World) {
  return world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
  });
}

/** `n` balls and boxes at places taken from the world's randomness, falling on the floor. */
function rain(world: World, n: number, nudge = 0) {
  const r = world.random;
  for (let i = 0; i < n; i++) {
    const position: Vec3 = [r.between(-3, 3) + (i === 0 ? nudge : 0), r.between(1, 6), r.between(-3, 3)];
    const shape: Shape =
      r.between(0, 1) < 0.5
        ? { kind: 'ball', radius: r.between(0.1, 0.4) }
        : { kind: 'box', halfExtents: [r.between(0.1, 0.4), r.between(0.1, 0.4), r.between(0.1, 0.4)] };
    world.createEntity({ transform: { position, rotation: quat.identity() }, body: { type: 'dynamic', shape } });
  }
}

describe('the physics (Rapier, behind physics.ts)', () => {
  test('a ball falls, bounces and stays on the floor; its pose and velocity are in its components', () => {
    const world = new World({ seed: 1 });
    floor(world);
    const ball = world.createEntity({
      transform: { position: [0, 2, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 } },
    });
    // Half a second later it is falling: about g·t = 4.9 m/s downward.
    for (let i = 0; i < 30; i++) world.step();
    expect(ball.body!.linearVelocity[1]).toBeLessThan(-4);
    expect(ball.transform!.position[1]).toBeLessThan(2);
    // Four seconds later it rests on the floor: its center at its radius' height.
    for (let i = 0; i < 240; i++) world.step();
    expect(ball.transform!.position[1]).toBeCloseTo(0.25, 2);
    expect(Math.abs(ball.body!.linearVelocity[1])).toBeLessThan(0.01);
    world.dispose();
  });

  test('two worlds with the same seed give the same hash at every step (60 bodies, 10 seconds)', () => {
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    for (const w of [a, b]) {
      floor(w);
      rain(w, 60);
    }
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
      expect(stateHash(b), `step ${i + 1}`).toBe(stateHash(a));
    }
    a.dispose();
    b.dispose();
  });

  test('Rapier counts in 32-bit numbers: a billionth of a meter does not exist for it', () => {
    // Near 3 m, a 32-bit number cannot tell apart two positions closer than about 0.24 µm. The nudge
    // changes our position (64 bits) and the hash at the start, but it is lost when it enters Rapier.
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    floor(a);
    floor(b);
    rain(a, 10);
    rain(b, 10, 1e-9);
    expect(stateHash(b)).not.toBe(stateHash(a));
    a.step();
    b.step();
    expect(stateHash(b)).toBe(stateHash(a));
    a.dispose();
    b.dispose();
  });

  test('a hundredth of a millimeter in one body changes the hash, and the worlds drift apart', () => {
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    floor(a);
    floor(b);
    rain(a, 60);
    rain(b, 60, 1e-5);
    let firstDifferent = 0;
    for (let i = 1; i <= 600; i++) {
      a.step();
      b.step();
      if (!firstDifferent && stateHash(b) !== stateHash(a)) firstDifferent = i;
    }
    // From the first step on, and for good: the hash says AT WHICH STEP two simulations separated.
    expect(firstDifferent).toBe(1);
    expect(stateHash(b)).not.toBe(stateHash(a));
    a.dispose();
    b.dispose();
  });

  test('a kinematic body that spins is turned by the physics, at its angular velocity', () => {
    const world = new World({ seed: 1 });
    const spinner = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      spin: { angularVelocity: [0, 1.5, 0] },
      body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
    });
    for (let i = 0; i < 60; i++) world.step();
    // One second at 1.5 rad/s around y: 1.5 rad, and it did not move.
    expect(quat.angleBetween(quat.identity(), spinner.transform!.rotation)).toBeCloseTo(1.5, 5);
    expect(spinner.transform!.position).toEqual([0, 1, 0]);
    world.dispose();
  });

  test('removing an entity removes its body from the physics', () => {
    const world = new World({ seed: 1 });
    floor(world);
    rain(world, 5);
    expect(world.physics.bodyCount).toBe(6);
    world.removeEntity(3);
    expect(world.physics.bodyCount).toBe(5);
    expect(world.entities.has(3)).toBe(false);
    world.dispose();
  });

  test('the gravity is part of the state: changing it changes how things fall, and the hash', () => {
    const fall = (vector?: Vec3) => {
      const world = new World({ seed: 1 });
      if (vector) world.gravity = { kind: 'uniform', vector };
      const ball = world.createEntity({
        transform: { position: [0, 10, 0], rotation: quat.identity() },
        body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.5 } },
      });
      const before = stateHash(world);
      for (let i = 0; i < 60; i++) world.step();
      const result = { y: ball.transform!.position[1], before };
      world.dispose();
      return result;
    };
    const earth = fall();
    const moon = fall([0, -1.62, 0]);
    // In one second: on Earth it falls about ½·9.81 = 4.9 m; on the Moon, about 0.8 m.
    expect(10 - earth.y).toBeCloseTo(4.9, 0);
    expect(10 - moon.y).toBeCloseTo(0.81, 1);
    expect(moon.before).not.toBe(earth.before);
  });
});

test('the random generator is untouched by the physics: the world consumes it only when a game asks', () => {
  const world = new World({ seed: 3 });
  const fresh = new Random(3);
  for (let i = 0; i < 30; i++) world.step();
  expect(world.random.state).toEqual(fresh.state);
  world.dispose();
});
