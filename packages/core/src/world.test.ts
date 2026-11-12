import { describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { World, STEP } from './world';
import { stateHash } from './hash';

/** A world with some spinning boxes, at places and speeds taken from its randomness. */
function testWorld(seed: number) {
  const w = new World({ seed });
  for (let i = 0; i < 5; i++) {
    w.createEntity({
      transform: { position: [w.random.between(-5, 5), 1, w.random.between(-5, 5)], rotation: quat.identity() },
      spin: { angularVelocity: [w.random.between(-2, 2), w.random.between(-2, 2), w.random.between(-2, 2)] },
    });
  }
  return w;
}

describe('World', () => {
  test('every world has its own ids: two worlds created one after the other start the same', () => {
    const a = new World({ seed: 1 });
    const b = new World({ seed: 1 });
    expect(a.createEntity({}).id).toBe(1);
    expect(b.createEntity({}).id).toBe(1);
    expect(a.createEntity({}).id).toBe(2);
  });

  test('determinism: same seed, same hash at EVERY step; another seed, another hash', () => {
    const a = testWorld(5);
    const b = testWorld(5);
    const c = testWorld(6);
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
      c.step();
      expect(stateHash(b)).toBe(stateHash(a));
    }
    expect(stateHash(c)).not.toBe(stateHash(a));
  });

  test('the hash changes if any number changes (even by a rounding)', () => {
    const a = testWorld(5);
    const before = stateHash(a);
    const e = a.entities.get(3)!;
    e.transform!.position[1] += 1e-15;
    expect(stateHash(a)).not.toBe(before);
  });

  test('spin: after t seconds, the angle turned is |ω|·t (and the rotation stays unit)', () => {
    const w = new World({ seed: 1 });
    const e = w.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.identity() },
      spin: { angularVelocity: [0, 0.9, 0] },
    });
    for (let i = 0; i < 120; i++) w.step(); // 2 s
    const q = e.transform!.rotation;
    expect(quat.angleBetween(quat.identity(), q)).toBeCloseTo(0.9 * 120 * STEP, 9);
    expect(Math.hypot(...q)).toBeCloseTo(1, 14);
  });

  test("events: the game sees each step's; the presentation, all the ones it has not read", () => {
    const w = new World({ seed: 1 });
    w.step();
    w.createEntity({});
    expect(w.stepEvents).toHaveLength(1);
    w.step(); // a new step: the game's list starts empty...
    expect(w.stepEvents).toHaveLength(0);
    w.createEntity({});
    // ...but the presentation, which did not read in between, sees both.
    expect(w.takeEvents().map((e) => e.type)).toEqual(['entityCreated', 'entityCreated']);
    expect(w.takeEvents()).toHaveLength(0);
  });
});
