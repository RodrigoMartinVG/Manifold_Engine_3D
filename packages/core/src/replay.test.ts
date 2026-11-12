import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { NO_INPUT, pressed } from './input';
import { initPhysics } from './physics';
import { playReplay, replayFromText, replayOf, replayToText, sessionFor } from './replay';
import { registryFor, Session } from './session';
import type { PlayerInput } from './types';
import { SIMULATION_VERSION } from './version';

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

const input = (move: Vec3, jump = false, run = false): PlayerInput => ({ ...NO_INPUT, move, jump, run });
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
    expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
    expect(text).toContain('input 40 1 move 0.6 0 -0.8\n');
    expect(text).toContain('input 100 1 move 0.6 0 -0.8 jump\n');
    expect(text).toContain('input 110 1 move 1 0 0 run\n');
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
    const jumped = tampered.inputs.find((i) => i.input.jump)!;
    const { jump: _, ...rest } = jumped.input;
    jumped.input = rest;
    expect(playReplay(Level, tampered).same).toBe(false);
    session.world.dispose();
  });

  test('a line that is not understood says which one; a replay without its start or its end is refused', () => {
    const v = `# Manifold replay ${SIMULATION_VERSION}`;
    expect(() => replayFromText(`${v}\ngame level\nwhat 1\nend 1 00000000`)).toThrow(/line 3/);
    expect(() => replayFromText(`${v}\ninput 4 1 move 0 0\nend 5 00000000`)).toThrow(/line 2.*"move" has 2 numbers/);
    expect(() => replayFromText(`${v}\ninput 4 1 Move 0 0 1\nend 5 00000000`)).toThrow(/line 2.*not the name of an action/);
    expect(() => replayFromText('game level\nend 1 00000000')).toThrow(/must start/);
    expect(() => replayFromText(`${v}\ngame level`)).toThrow(/no end/);
  });

  test('a replay of another version says so (the same inputs would give another hash)', () => {
    // The first ones (stage 1c) had no version in their first line, and their inputs were only numbers.
    const old = '# Manifold replay\ngame level\ninput 40 1 0.6 0 -0.8 0 0 0 -\nend 240 00000000';
    expect(() => replayFromText(old)).toThrow(/line 1: a replay of version 1, and this engine plays version 3/);
    // Those of stage 1c2 already wrote their inputs as words, but their hash counted other things.
    expect(() => replayFromText('# Manifold replay 2\ngame level\nend 1 00000000')).toThrow(/version 2/);
  });

  test('what a game does not declare does not enter: a replay that brings it is refused, and a session leaves it out', () => {
    const v = `# Manifold replay ${SIMULATION_VERSION}`;
    const flying = replayFromText(`${v}\ngame level\ninput 4 1 move 0 0 1 level.fly\nend 5 00000000`);
    expect(() => sessionFor(Level, flying)).toThrow(/step 4: "level.fly" is not something a player can ask for/);
    const asAxis = replayFromText(`${v}\ngame level\ninput 4 1 jump 1\nend 5 00000000`);
    expect(() => sessionFor(Level, asAxis)).toThrow(/"jump" is a button, and it came as a axis/);
    expect(() => sessionFor(Level, replayFromText(`${v}\ngame other\nend 5 00000000`))).toThrow(/a replay of "other"/);
    const session = new Session(Level);
    session.setInput(1, { move: [0, 0, 1], 'level.fly': true, turn: 7, jump: false });
    session.step();
    expect(session.world.inputs.get(1)).toEqual({ move: [0, 0, 1], turn: 1 });
    session.world.dispose();
  });

  test("a game's own button: pressed once per press, recorded by its name, played again to the same world", () => {
    // A game with a button of its own: each press drops a box (held, it drops only one).
    const Waving: Cartridge = {
      ...Level,
      id: 'waving',
      inputs: [{ name: 'waving.drop', kind: 'button', description: 'drops a box' }],
      onStep(world) {
        if (pressed(world, 1, 'waving.drop'))
          world.createEntity({
            transform: { position: [0, 3, 3], rotation: quat.identity() },
            body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.2, 0.2, 0.2] } },
          });
      },
    };
    const session = new Session(Waving);
    const before = session.world.entities.size;
    for (let step = 1; step <= 90; step++) {
      // Held from 10 to 30 (one press), and again from 50 to 52 (another).
      const held = (step >= 10 && step < 30) || (step >= 50 && step < 53);
      session.setInput(1, held ? { 'waving.drop': true } : NO_INPUT);
      session.step();
    }
    expect(session.world.entities.size).toBe(before + 2);
    const text = replayToText(replayOf(session));
    expect(text).toContain('input 10 1 waving.drop\n');
    expect(text).toContain('input 30 1\n');
    expect(playReplay(Waving, replayFromText(text)).same).toBe(true);
    session.world.dispose();
  });

  test('a little negative number in an input (rounded to −0) plays again to the same hash', () => {
    // −0.003 rounds to −0, which is written "0" and read back as +0: different bits, another hash.
    const registry = registryFor(Level);
    const session = new Session(Level, { registry });
    for (let step = 1; step <= 120; step++) {
      session.setInput(1, input(step < 20 ? [0, 0, 0] : [-0.003, 0, -1]));
      session.step();
    }
    expect(playReplay(Level, replayFromText(replayToText(replayOf(session)))).same).toBe(true);
    session.world.dispose();
  });
});
