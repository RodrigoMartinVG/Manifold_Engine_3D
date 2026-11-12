import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { initPhysics } from './physics';
import { playReplay, replayFromText, replayOf, replayToText } from './replay';
import { registryFor, Session } from './session';
import type { PlayerInput } from './types';

beforeAll(initPhysics);

/** A floor, a few boxes to bump into and to push, and a character. */
const Level: Cartridge = {
  id: 'level',
  title: 'Level',
  onStart(world) {
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
    });
    for (const x of [2, 3.5])
      world.createEntity({
        transform: { position: [x, 0.3, -2], rotation: quat.identity() },
        body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.3, 0.3, 0.3] } },
      });
    world.createEntity({
      transform: { position: [0, 1.5, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
  },
};

const input = (move: Vec3, jump = false, run = false): PlayerInput => ({ move, face: [0, 0, 0], jump, run });
const script = (step: number): PlayerInput =>
  step < 40
    ? input([0, 0, 0])
    : step < 100
      ? input([0.6, 0, -0.8])
      : step < 110
        ? input([0.6, 0, -0.8], true)
        : input([1, 0, 0], false, true);

/** A session born from a recipe, played for `steps` steps with the script, and a gravity change at step 90. */
function record(steps = 240) {
  const registry = registryFor(Level);
  registry.run('seed 5\nphysics.gravity 0 -5 0', 'recipe');
  const session = new Session(Level, { registry });
  for (let step = 1; step <= steps; step++) {
    if (step === 90) session.registry.run('physics.gravity 0 -9.81 0');
    session.setInput(1, script(step));
    session.step();
  }
  return session;
}

describe('replays (stage 1c)', () => {
  test('a replay holds how the world was born, the inputs and the changes; its text comes back the same', () => {
    const session = record();
    const replay = replayOf(session);
    expect(replay.birth).toBe('seed 5\nphysics.gravity 0 -5 0');
    const text = replayToText(replay);
    expect(text).toContain('birth physics.gravity 0 -5 0');
    expect(text).toContain('change 90 physics.gravity 0 -9.81 0');
    expect(text).toContain('input 40 1 0.6 0 -0.8 0 0 0 -');
    expect(text).toContain('input 100 1 0.6 0 -0.8 0 0 0 j');
    expect(text).toMatch(/^end 240 [0-9a-f]{8}$/m);
    expect(replayFromText(text)).toEqual(replay);
    session.world.dispose();
  });

  test('playing it again gives the same hash; with a single input changed, it does not', () => {
    const session = record();
    const replay = replayOf(session);
    const again = playReplay(Level, replayFromText(replayToText(replay)));
    expect(again.same).toBe(true);
    expect(again.session.world.tick).toBe(240);
    // The jump never pressed: the world is another one.
    const tampered = replayFromText(replayToText(replay));
    tampered.inputs.find((i) => i.input.jump)!.input.jump = false;
    expect(playReplay(Level, tampered).same).toBe(false);
    session.world.dispose();
  });

  test('a line that is not understood says which one; a replay without its start or its end is refused', () => {
    expect(() => replayFromText('# Manifold replay\ngame level\nwhat 1\nend 1 00000000')).toThrow(/line 3/);
    expect(() => replayFromText('# Manifold replay\ninput 4 1 0 0 1 0 0 0 x\nend 5 00000000')).toThrow(/line 2.*flags/);
    expect(() => replayFromText('game level\nend 1 00000000')).toThrow(/must start/);
    expect(() => replayFromText('# Manifold replay\ngame level')).toThrow(/no end/);
  });
});
