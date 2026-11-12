import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { stateHash } from './hash';
import { NO_INPUT } from './input';
import { initPhysics } from './physics';
import { playReplay, replayFromText, replayOf, replayToText } from './replay';
import { Session } from './session';
import type { PlayerInput } from './types';
import { SIMULATION_VERSION } from './version';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, a cube that spins (kinematic: it pushes), thirty boxes falling in random places, and a character. */
const Yard: Cartridge = {
  id: 'yard',
  title: 'Yard',
  onStart(world) {
    world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      spin: { angularVelocity: [0.3, 1.1, 0.2] },
      body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
    });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
    });
    for (let i = 0; i < 30; i++)
      world.createEntity({
        transform: {
          position: [world.random.between(-2, 2), world.random.between(2, 8), world.random.between(-2, 2)],
          rotation: quat.identity(),
        },
        body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.2, 0.2, 0.2] } },
      });
    world.createEntity({
      transform: { position: [3, 1.5, 3], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
  },
};

/** What player 1 asks for at each step: walk into the boxes, jump, turn. */
const script = (step: number): PlayerInput =>
  step < 30 ? NO_INPUT : step < 160 ? { move: [-0.7, 0, -0.7] as Vec3, jump: step % 50 < 3 } : { ahead: 1, turn: -0.5 };

function play(session: Session, from: number, to: number) {
  for (let step = from; step <= to; step++) {
    session.setInput(1, script(step));
    session.step();
  }
}

describe('snapshots (stage 1d)', () => {
  test('a world restored from a snapshot goes on to exactly the same: the same hash on every step', () => {
    const original = new Session(Yard);
    play(original, 1, 100);
    const snapshot = original.world.snapshot();
    const at100 = stateHash(original.world);
    const restored = World.restore(snapshot);
    expect(stateHash(restored)).toBe(at100);
    // The same inputs, step by step, to both: in the original, through its session; in the copy, by hand.
    for (let step = 101; step <= 300; step++) {
      original.setInput(1, script(step));
      original.step();
      restored.applyInputs(new Map([[1, original.world.inputs.get(1)!]]));
      restored.step();
      expect(stateHash(restored), `step ${step}`).toBe(stateHash(original.world));
    }
    original.world.dispose();
    restored.dispose();
  });

  test('a snapshot is a copy: the world going on does not change it, and it can be restored twice', () => {
    const session = new Session(Yard);
    play(session, 1, 60);
    const snapshot = session.world.snapshot();
    const hash = stateHash(session.world);
    play(session, 61, 120);
    const a = World.restore(snapshot);
    a.step();
    const b = World.restore(snapshot);
    expect(stateHash(b)).toBe(hash);
    b.step();
    expect(stateHash(b)).toBe(stateHash(a));
    for (const w of [session.world, a, b]) w.dispose();
  });

  test('a snapshot of another version is refused', () => {
    const world = new World({ seed: 1 });
    const old = { ...world.snapshot(), version: SIMULATION_VERSION - 1 };
    expect(() => World.restore(old)).toThrow(/version/);
    world.dispose();
  });

  test('going back with a save: the world, the history, the world values and the replay, as they were', () => {
    const session = new Session(Yard);
    play(session, 1, 80);
    const save = session.save();
    const hash = stateHash(session.world);
    const nextId = session.world.lastEntityId + 1;
    // After the save: other inputs, a gravity change from the console, a new entity.
    session.registry.run('physics.gravity 0 -3 0');
    for (let step = 81; step <= 150; step++) {
      session.setInput(1, { move: [1, 0, 0] });
      session.step();
    }
    session.world.createEntity({ transform: { position: [0, 9, 0], rotation: quat.identity() } });
    expect(session.history.length).toBe(1);

    session.load(save);
    expect(session.world.tick).toBe(80);
    expect(stateHash(session.world)).toBe(hash);
    expect(session.history).toEqual([]);
    expect(session.registry.value('physics.gravity')).toEqual([0, -9.81, 0]);
    // (Its id counter too: checked without creating anything, which would change this world.)
    expect(session.world.lastEntityId + 1).toBe(nextId);
    // From there, on; and its replay, from its birth, still describes the world it reaches.
    play(session, 81, 200);
    const replay = replayFromText(replayToText(replayOf(session)));
    expect(playReplay(Yard, replay).same).toBe(true);
    session.world.dispose();
  });

  test('the hash counts the id counter and the previous inputs (both decide what comes next)', () => {
    const a = new World({ seed: 1 });
    const b = new World({ seed: 1 });
    a.removeEntity(a.createEntity({}).id);
    expect(stateHash(a)).not.toBe(stateHash(b));
    const c = new World({ seed: 1 });
    const d = new World({ seed: 1 });
    c.applyInputs(new Map([[1, { jump: true }]]));
    d.applyInputs(new Map([[1, { jump: true }]]));
    d.applyInputs(new Map());
    // The same inputs now; in d, the jump was already held: pressing it again is not a press.
    expect(c.inputs).toEqual(d.inputs);
    expect(stateHash(c)).not.toBe(stateHash(d));
    for (const w of [a, b, c, d]) w.dispose();
  });
});
