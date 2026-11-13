import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { quat } from '@manifold/common';
import {
  initPhysics,
  NO_INPUT,
  type PlayerInput,
  playReplay,
  registryFor,
  replayFromText,
  replayOf,
  replayToText,
  Session,
  stateHash,
  STEP,
} from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

// The Dojo's worlds have physics (stage 1a), and Rapier loads asynchronously.
beforeAll(initPhysics);

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
  expect(a.world.entities.size).toBe(2); // the cube and the floor
  for (let i = 0; i < 300; i++) {
    a.step();
    b.step();
  }
  expect(stateHash(b.world)).toBe(stateHash(a.world));
  const cube = [...a.world.entities.values()][0]!;
  // Turned: |ω|·t (5 s at 0.99 rad/s = 4.95 rad). `angleBetween` gives the shortest way (0 to π).
  // The physics turns it now, in 32-bit numbers: close to a millionth of a radian.
  const turned = (Math.hypot(0.35, 0.9, 0.15) * 300 * STEP) % (2 * Math.PI);
  const shortest = Math.min(turned, 2 * Math.PI - turned);
  expect(quat.angleBetween(quat.identity(), cube.transform!.rotation)).toBeCloseTo(shortest, 4);
});

test("dojo.cubes (startup) adds cubes from the world's randomness; same seed, same cubes", () => {
  const a = new Session(DojoCartridge, { registry: registryWith('seed 7; dojo.cubes 10') });
  const b = new Session(DojoCartridge, { registry: registryWith('seed 7; dojo.cubes 10') });
  const c = new Session(DojoCartridge, { registry: registryWith('seed 8; dojo.cubes 10') });
  expect(a.world.entities.size).toBe(12);
  expect(stateHash(b.world)).toBe(stateHash(a.world));
  expect(stateHash(c.world)).not.toBe(stateHash(a.world));
  // A value that does not fit changes nothing (and says so): only the usual cube.
  const registry = registryFor(DojoCartridge);
  expect(registry.run('dojo.cubes many', 'recipe')[0]?.level).toBe('error');
  expect(new Session(DojoCartridge, { registry }).world.entities.size).toBe(2);
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
  expect(a.session.world.entities.size).toBe(6); // the cube, the floor, 3 cubes and the ball
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

test('a recipe cannot drop balls (dojo.spawn is an action, not a setting)', () => {
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

test('the cubes fall on the floor and stay there; a ball dropped from the console too', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('seed 4; dojo.cubes 30') });
  // Beside the big cube: dropped on it, the spinning cube would keep carrying it around (as it should).
  session.registry.run('dojo.spawn 3 5 3');
  for (let i = 0; i < 300; i++) session.step();
  const fallen = [...session.world.entities.values()].filter((e) => e.body?.type === 'dynamic');
  expect(fallen).toHaveLength(31);
  for (const e of fallen) {
    // Resting: above the floor (y = 0), and still.
    expect(e.transform!.position[1], `entity ${e.id}`).toBeGreaterThan(0);
    expect(Math.hypot(...e.body!.linearVelocity), `entity ${e.id}`).toBeLessThan(0.5);
  }
});

test('physics.gravity is a world value: it enters at the next step and goes into the history', () => {
  const play = (gravity?: string) => {
    const session = new Session(DojoCartridge);
    session.registry.run('dojo.spawn 3 10 3');
    if (gravity) session.registry.run(gravity);
    for (let i = 0; i < 60; i++) session.step();
    return session;
  };
  const earth = play();
  const moon = play('physics.gravity 0 -1.62 0');
  expect(moon.history).toEqual([
    { step: 1, line: 'dojo.spawn 3 10 3' },
    { step: 1, line: 'physics.gravity 0 -1.62 0' },
  ]);
  const height = (s: Session) => [...s.world.entities.values()][2]!.transform!.position[1];
  // In one second: on Earth it falls almost 5 m; on the Moon, less than one.
  expect(10 - height(earth)).toBeGreaterThan(4.5);
  expect(10 - height(moon)).toBeLessThan(1);
});

test('dojo.level course builds a classic level with player 1 character, who lands and walks', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  const hero = [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  expect(hero).toBeDefined();
  for (let i = 0; i < 120; i++) session.step();
  expect(hero.character!.grounded).toBe(true);
  const start = hero.transform!.position[2];
  // Forward (−Z, towards the course) for half a second.
  for (let i = 0; i < 30; i++) {
    session.setInput(1, { ...NO_INPUT, move: [0, 0, -1] });
    session.step();
  }
  expect(hero.transform!.position[2]).toBeLessThan(start - 1.5);
  session.world.dispose();
});

test('a run through the course, recorded and played again, ends in the same world', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course; dojo.cubes 6') });
  for (let step = 1; step <= 300; step++) {
    const move: [number, number, number] = step < 60 ? [0, 0, 0] : step < 200 ? [0.3, 0, -1] : [-1, 0, 0];
    session.setInput(1, { ...NO_INPUT, move, jump: step >= 150 && step < 155, run: step > 200 });
    session.step();
  }
  const replay = replayFromText(replayToText(replayOf(session)));
  expect(replay.birth).toContain('dojo.level course');
  expect(playReplay(DojoCartridge, replay).same).toBe(true);
  session.world.dispose();
});

test('dojo.throw, the Dojo’s own button: one ball per press, thrown where the character looks, and in the replay', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  for (let i = 0; i < 90; i++) session.step();
  const before = session.world.entities.size;
  // Held for half a second: a single ball. Then pressed again: another.
  for (let step = 1; step <= 60; step++) {
    session.setInput(1, step <= 30 || step > 40 ? { 'dojo.throw': true } : NO_INPUT);
    session.step();
  }
  const balls = [...session.world.entities.values()].filter((e) => e.appearance?.shape === 'sphere');
  expect(session.world.entities.size).toBe(before + 2);
  expect(balls).toHaveLength(2);
  // The character looks at −Z: the first ball went that way.
  expect(balls[0]!.transform!.position[2]).toBeLessThan(5);
  const text = replayToText(replayOf(session));
  expect(text).toMatch(/^input \d+ 1 dojo\.throw$/m);
  expect(playReplay(DojoCartridge, replayFromText(text)).same).toBe(true);
  session.world.dispose();
});

test('in the course, every player who comes into the match gets a character, and loses it when leaving', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  const characters = () => [...session.world.entities.values()].filter((e) => e.character).map((e) => e.character!.player);
  session.registry.run('players.join 1; players.join 2');
  session.step();
  session.step();
  expect(characters()).toEqual([1, 2]);
  session.registry.run('players.leave 2');
  session.step();
  session.step();
  expect(characters()).toEqual([1]);
  session.world.dispose();
});

test("the course's loop: a checkpoint, a fall back to it, the goal with its time; a ball in the void is gone", () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  const world = () => session.world;
  const hero = () => [...world().entities.values()].find((e) => e.character?.player === 1)!;
  const zone = (kind: string) => [...world().entities.values()].find((e) => e.sensor?.kind === kind)!;
  const notices: string[] = [];
  const steps = (n: number) => {
    for (let i = 0; i < n; i++) {
      session.step();
      for (const ev of world().stepEvents) if (ev.type === 'notice') notices.push(ev.text);
    }
  };
  steps(60);
  // The character gets to the checkpoint (put there, as if it had jumped: the test is the loop, not the jumps).
  world().place(hero(), zone('checkpoint').transform!.position);
  steps(2);
  expect(notices).toEqual(['checkpoint']);
  // It falls off the floor's edge: back to the checkpoint.
  world().place(hero(), [12, 1, 0]);
  steps(120);
  expect(notices).toEqual(['checkpoint', 'you fell: back to the checkpoint']);
  expect(hero().game!.falls).toBe(1);
  expect(hero().transform!.position[2]).toBeCloseTo(-4, 1);
  // The goal: once, with the time since it started.
  world().place(hero(), zone('goal').transform!.position);
  steps(30);
  world().place(hero(), zone('goal').transform!.position);
  steps(30);
  expect(notices.filter((n) => n.startsWith('the goal'))).toEqual([
    `the goal: ${((hero().game!.finish as number) * STEP).toFixed(2)} s, 1 fall, 0 stars`,
  ]);
  // A ball thrown off the floor is gone when it falls into the void.
  const before = world().entities.size;
  session.registry.run('dojo.spawn 15 2 0');
  steps(5);
  expect(world().entities.size).toBe(before + 1);
  steps(120);
  expect(world().entities.size).toBe(before);
  session.world.dispose();
});

test('a run that falls off the floor and comes back, driven by its inputs, plays again to the same world', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  const hero = () => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  // Back (+Z) from the start, 4 m to the floor's edge, and on into the void; then still.
  for (let step = 1; step <= 360; step++) {
    session.setInput(1, step > 30 && step < 150 ? { move: [0, 0, 1] } : NO_INPUT);
    session.step();
  }
  expect(hero().game!.falls).toBe(1);
  expect(hero().transform!.position[2]).toBeLessThan(7);
  expect(playReplay(DojoCartridge, replayFromText(replayToText(replayOf(session)))).same).toBe(true);
  session.world.dispose();
});

test('dojo.air: no steering in the air for every character, from a step; a joiner moves the same; the replay holds', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  const characters = () => [...session.world.entities.values()].filter((e) => e.character);
  for (let step = 1; step <= 60; step++) session.step();
  session.registry.run('dojo.air 0');
  session.registry.run('players.join 2');
  for (let step = 1; step <= 120; step++) {
    // A jump, and in the air, asking to go to the side: with dojo.air 0, it keeps its arc.
    session.setInput(1, step === 10 ? { jump: true } : step > 12 && step < 40 ? { move: [1, 0, 0] } : NO_INPUT);
    session.step();
    if (step === 30) expect(characters()[0]!.character!.velocity[0]).toBe(0);
  }
  expect(characters().map((e) => e.character!.movement.air.control)).toEqual([0, 0]);
  expect(playReplay(DojoCartridge, replayFromText(replayToText(replayOf(session)))).same).toBe(true);
  session.world.dispose();
});

describe('capabilities in the course (stage 2c): each star needs its own', () => {
  /** The course with some capabilities on, the character put somewhere, driven for some steps. */
  function attempt(recipe: string, at: Vec3, drive: (step: number) => PlayerInput, steps: number) {
    const session = new Session(DojoCartridge, { registry: registryWith(`dojo.level course\n${recipe}`) });
    const hero = () => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
    for (let i = 0; i < 30; i++) session.step();
    session.world.place(hero(), at);
    for (let step = 1; step <= steps; step++) {
      session.setInput(1, drive(step));
      session.step();
    }
    const result = { stars: hero().game!.stars as number, falls: hero().game!.falls as number, session };
    return result;
  }
  // Towards the tower, pushing against it.
  const tower = (step: number): PlayerInput => (step < 200 ? { move: [1, 0, 0] } : NO_INPUT);
  // From the highest platform's edge, walking towards the island, the jump held all the way (it glides
  // when it falls). Walking: running, it glides past the island (a player would steer back; this does not).
  const island = (step: number): PlayerInput => ({ move: [-1, 0, 0], jump: step > 1 });
  // On the highest platform, a jump, and another one at the top of the first.
  const high = (step: number): PlayerInput => ({ jump: step === 2 || step === 42 });

  test('the course has three stars, seen (a small gold cube) and spinning', () => {
    const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
    const stars = [...session.world.entities.values()].filter((e) => e.sensor?.kind === 'star');
    expect(stars).toHaveLength(3);
    expect(stars.every((e) => e.appearance?.color === 0xf0c040 && e.spin)).toBe(true);
    session.world.dispose();
  });

  test('the tower: climbing reaches its star; a second jump does not', () => {
    expect(attempt('dojo.climb on', [6, 1, 2], tower, 300).stars).toBe(1);
    expect(attempt('dojo.doublejump on', [6, 1, 2], (s) => ({ ...tower(s), jump: s === 2 || s === 42 }), 300).stars).toBe(0);
  });

  test('the island: gliding reaches its star; a running jump falls into the void', () => {
    expect(attempt('dojo.glide on', [-3.5, 4.5, -7], island, 300).stars).toBe(1);
    const without = attempt('', [-3.5, 4.5, -7], island, 300);
    expect(without.stars).toBe(0);
    expect(without.falls).toBe(1);
  });

  test('high above the last platform: a second jump reaches its star; one jump does not', () => {
    expect(attempt('dojo.doublejump on', [-3, 4.5, -7], high, 120).stars).toBe(1);
    expect(attempt('', [-3, 4.5, -7], high, 120).stars).toBe(0);
  });

  test('a run with all of them on, driven only by its inputs (no character put anywhere), plays again the same', () => {
    const session = new Session(DojoCartridge, {
      registry: registryWith('dojo.level course\ndojo.climb on\ndojo.glide on\ndojo.doublejump on'),
    });
    const modes = new Set<string>();
    for (let step = 1; step <= 300; step++) {
      // Forward, a jump, another in the air, and the jump held while falling: it glides.
      session.setInput(1, step < 40 ? NO_INPUT : { move: [0.3, 0, -1], jump: step === 50 || (step >= 80 && step < 200) });
      session.step();
      const hero = [...session.world.entities.values()].find((e) => e.character)!;
      modes.add(hero.character!.mode);
    }
    expect([...modes].sort()).toEqual(['air', 'glide', 'walk']);
    expect(playReplay(DojoCartridge, replayFromText(replayToText(replayOf(session)))).same).toBe(true);
    session.world.dispose();
  });
});

test('dojo.goto puts player 1 somewhere, at a step; the replay has it', () => {
  const session = new Session(DojoCartridge, { registry: registryWith('dojo.level course') });
  for (let i = 0; i < 30; i++) session.step();
  session.registry.run('dojo.goto 8 1 5');
  session.step();
  const hero = [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  expect(hero.transform!.position[0]).toBeCloseTo(8, 1);
  for (let i = 0; i < 30; i++) session.step();
  expect(playReplay(DojoCartridge, replayFromText(replayToText(replayOf(session)))).same).toBe(true);
  session.world.dispose();
});
