import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { buildLevel, levelFromText, levelToText } from './level';
import { initPhysics } from './physics';
import { World } from './world';

beforeAll(initPhysics);

const TEXT = `# Manifold level 1
# A comment: a whole line that starts with #.
title A small yard
spawn 0 1 6
facing 0 0 -1
box 0 0.5 -2   1 0.5 1   color #8a6a42
box -4 0.62 1.5  1 0.1 2.2  rotate x 18  color #6f6a62
sensor goal  0 1.8 -2  1 0.8 1
sensor fall  0 -6 0    60 3 60  rotate y 45
`;

describe('levels as data (stage 2a)', () => {
  test('a level is read from its text, and written back the same', () => {
    const level = levelFromText(TEXT);
    expect(level.title).toBe('A small yard');
    expect(level.spawn).toEqual([0, 1, 6]);
    expect(level.boxes).toHaveLength(2);
    expect(level.boxes[0]!.color).toBe(0x8a6a42);
    expect(level.boxes[1]!.turn).toEqual({ axis: 'x', degrees: 18 });
    expect(level.sensors.map((s) => s.kind)).toEqual(['goal', 'fall']);
    expect(levelFromText(levelToText(level))).toEqual(level);
  });

  test('a line that is not understood says which one, and why', () => {
    const bad = (line: string) => () => levelFromText(`# Manifold level 1\ntitle x\n${line}\n`);
    expect(bad('box 0 0 0  1 1')).toThrow(/line 3: "" is not a number/);
    expect(bad('box 0 0 0  1 1 1  rotate w 10')).toThrow(/line 3: "w" is not an axis/);
    expect(bad('box 0 0 0  1 1 1  color red')).toThrow(/line 3: "red" is not a color/);
    expect(bad('sensor 0 0 0  1 1 1')).toThrow(/line 3: a zone needs what it is for/);
    expect(bad('tree 1 2 3')).toThrow(/line 3: "tree" is not understood/);
    expect(() => levelFromText('title x')).toThrow(/line 1: it must start with/);
    expect(() => levelFromText('# Manifold level 9\n')).toThrow(/format 9/);
  });

  test('built into a world: its boxes as fixed bodies that are seen, its zones as sensors that are not', () => {
    const world = new World({ seed: 1 });
    buildLevel(world, levelFromText(TEXT));
    const entities = [...world.entities.values()];
    expect(entities.filter((e) => e.body?.type === 'fixed' && e.appearance)).toHaveLength(2);
    const zones = entities.filter((e) => e.sensor);
    expect(zones.map((z) => z.sensor!.kind)).toEqual(['goal', 'fall']);
    expect(zones.every((z) => !z.appearance && !z.body)).toBe(true);
    // The ramp's 18°, with our own sine and cosine: the numbers the course used to have by hand.
    const ramp = entities[1]!.transform!.rotation;
    expect(quat.angleBetween(ramp, [0.15643446504023087, 0, 0, 0.9876883405951378])).toBeLessThan(1e-12);
    world.dispose();
  });
});

describe('zones (stage 2a)', () => {
  test('a ball falling through a zone: it came in, and then it left, once each', () => {
    const world = new World({ seed: 1 });
    const zone = world.createEntity({
      transform: { position: [0, 3, 0], rotation: quat.identity() },
      sensor: { kind: 'z', half: [1, 0.5, 1] },
    });
    const ball = world.createEntity({
      transform: { position: [0, 6, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      world.step();
      for (const ev of world.stepEvents)
        if (ev.type === 'sensorEntered' || ev.type === 'sensorLeft')
          seen.push(`${ev.type} ${ev.sensor} ${ev.entity} at ${world.tick}`);
    }
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatch(new RegExp(`^sensorEntered ${zone.id} ${ball.id} `));
    expect(seen[1]).toMatch(new RegExp(`^sensorLeft ${zone.id} ${ball.id} `));
    expect(zone.sensor!.inside).toEqual([]);
    world.dispose();
  });

  test('a turned zone notices by its own axes; and someone removed inside it simply is not there any more', () => {
    const world = new World({ seed: 1, gravity: { kind: 'uniform', vector: [0, 0, 0] } });
    // A thin, long zone along x, turned 45° around y: (1.4, 0, 1.4) is inside it, (2, 0, 0) is not.
    const zone = world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.fromDegrees([0, 1, 0], -45) },
      sensor: { kind: 'z', half: [3, 1, 0.3] },
    });
    const inside = world.createEntity({
      transform: { position: [1.4, 0, 1.4], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.1 } },
    });
    world.createEntity({
      transform: { position: [2, 0, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.1 } },
    });
    world.step();
    expect(zone.sensor!.inside).toEqual([inside.id]);
    world.removeEntity(inside.id);
    world.step();
    expect(zone.sensor!.inside).toEqual([]);
    expect(world.stepEvents.filter((e) => e.type === 'sensorLeft')).toEqual([]);
    world.dispose();
  });

  test('placing an entity: it is there at once, stopped, without crossing what is in between', () => {
    const world = new World({ seed: 1 });
    const ball = world.createEntity({
      transform: { position: [0, 5, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    for (let i = 0; i < 30; i++) world.step();
    world.place(ball, [3, 8, -2]);
    expect(ball.transform!.position).toEqual([3, 8, -2]);
    expect(ball.body!.linearVelocity).toEqual([0, 0, 0]);
    world.step();
    expect(ball.transform!.position[0]).toBeCloseTo(3, 5);
    expect(ball.transform!.position[1]).toBeGreaterThan(7.9);
    world.dispose();
  });
});
