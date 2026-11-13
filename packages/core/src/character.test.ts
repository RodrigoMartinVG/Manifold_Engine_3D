import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { DEFAULT_MOVEMENT, turned } from './character';
import { NO_INPUT } from './input';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import { Session } from './session';
import type { Entity, GravityField, PlayerInput } from './types';
import { STEP, World } from './world';

beforeAll(initPhysics);

const STAND = 0.8; // a capsule 1.6 m tall stands with its center 0.8 m above the floor
const input = (move: Vec3 = [0, 0, 0], jump = false, run = false, face: Vec3 = [0, 0, 0]): PlayerInput => ({
  ...NO_INPUT,
  move,
  face,
  jump,
  run,
});

/** A world with a floor (its top at y = 0), boxes, and a character. */
function setUp(o: { at?: Vec3; gravity?: GravityField; boxes?: [center: Vec3, half: Vec3][] } = {}) {
  const world = new World({ seed: 1, gravity: o.gravity });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  for (const [center, half] of o.boxes ?? [])
    world.createEntity({
      transform: { position: center, rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: half } },
    });
  const hero = world.createEntity({
    transform: { position: o.at ?? [0, 1.5, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });
  return { world, hero };
}

function run(world: World, steps: number, give?: (step: number) => PlayerInput) {
  for (let i = 1; i <= steps; i++) {
    if (give) world.inputs.set(1, give(i));
    world.step();
  }
}

const y = (e: Entity) => e.transform!.position[1];

describe('the character (stage 1b)', () => {
  test('it falls and stands on the floor', () => {
    const { world, hero } = setUp();
    run(world, 120);
    expect(hero.character!.grounded).toBe(true);
    expect(y(hero)).toBeCloseTo(STAND, 1);
    expect(vec3.length(hero.character!.velocity)).toBeLessThan(1e-6);
    world.dispose();
  });

  test('it walks where it is asked, at its speed, and looks there; running is faster', () => {
    const walk = setUp();
    run(walk.world, 60);
    run(walk.world, 60, () => input([1, 0, 0]));
    // One second at 4.5 m/s (it reaches that speed in under a tenth of a second).
    expect(walk.hero.transform!.position[0]).toBeGreaterThan(4.2);
    expect(walk.hero.transform!.position[0]).toBeLessThan(4.6);
    expect(walk.hero.character!.facing).toEqual([1, 0, 0]);
    // Looking at +X: its −Z axis (its "forward") turned towards +X.
    const forward = quat.rotate(walk.hero.transform!.rotation, [0, 0, -1]);
    expect(vec3.dot(forward, [1, 0, 0])).toBeGreaterThan(0.999);
    const sprint = setUp();
    run(sprint.world, 60);
    run(sprint.world, 60, () => input([1, 0, 0], false, true));
    // At 7.5 m/s: about 6.9 m in that second, counting how long it takes to get there.
    expect(sprint.hero.transform!.position[0]).toBeGreaterThan(6.5);
    walk.world.dispose();
    sprint.world.dispose();
  });

  test('it jumps when the jump is pressed, not while it is held; it rises about v²/2g and lands', () => {
    const { world, hero } = setUp();
    run(world, 60);
    let highest = 0;
    let jumps = 0;
    let wasGrounded = true;
    // The jump held for two seconds: one jump only.
    run(world, 120, () => {
      if (wasGrounded && !hero.character!.grounded) jumps++;
      wasGrounded = hero.character!.grounded;
      highest = Math.max(highest, y(hero));
      return input([0, 0, 0], true);
    });
    expect(jumps).toBe(1);
    // 6.5 m/s on Earth: 6.5² / (2 · 9.81) = 2.15 m above where it stood.
    expect(highest - STAND).toBeGreaterThan(2.0);
    expect(highest - STAND).toBeLessThan(2.2);
    expect(hero.character!.grounded).toBe(true);
    // Released and pressed again: another jump.
    run(world, 1, () => input());
    run(world, 10, () => input([0, 0, 0], true));
    expect(y(hero)).toBeGreaterThan(STAND + 0.3);
    world.dispose();
  });

  test('coyote time: a jump a few steps after leaving an edge still counts; later, it does not', () => {
    const jumpAfter = (stepsOffTheEdge: number) => {
      // A platform 2 m high whose edge is at x = 1; the character walks off it towards +x.
      const { world, hero } = setUp({
        at: [0, 2.8, 0],
        boxes: [
          [
            [0, 1, 0],
            [1, 1, 1],
          ],
        ],
      });
      run(world, 60);
      let off = 0;
      let jumped = false;
      run(world, 60, () => {
        if (!hero.character!.grounded) off++;
        const jump = off === stepsOffTheEdge;
        if (jump) jumped = true;
        return input([1, 0, 0], jump && jumped);
      });
      const risen = hero.character!.velocity[1] > 0 || y(hero) > 2.8;
      world.dispose();
      return { risen, highestCheck: risen };
    };
    expect(jumpAfter(DEFAULT_MOVEMENT.jump.coyote - 2).risen).toBe(true);
    expect(jumpAfter(DEFAULT_MOVEMENT.jump.coyote + 6).risen).toBe(false);
  });

  test('a jump asked for a few steps before landing is kept, and happens on landing', () => {
    const { world, hero } = setUp({ at: [0, 3, 0] });
    // Falling: the jump is pressed when it is 4 steps from the floor (about 0.6 m above it).
    let pressed = false;
    let landedAt = 0;
    let rose = false;
    run(world, 90, (step) => {
      const press = !pressed && !hero.character!.grounded && y(hero) < STAND + 0.35 && hero.character!.velocity[1] < 0;
      if (press) pressed = true;
      if (hero.character!.grounded && !landedAt) landedAt = step;
      if (landedAt && hero.character!.velocity[1] > 1) rose = true;
      return input([0, 0, 0], press);
    });
    expect(pressed).toBe(true);
    expect(rose).toBe(true);
    world.dispose();
  });

  test('it climbs a 30 cm step by walking, but not a 60 cm wall; and it pushes a cube', () => {
    // A long step (from x = 1.5 to 5.5): after a second of walking, it is on top of it.
    const step = setUp({
      boxes: [
        [
          [3.5, 0.15, 0],
          [2, 0.15, 2],
        ],
      ],
    });
    run(step.world, 60);
    run(step.world, 60, () => input([1, 0, 0]));
    expect(step.hero.transform!.position[0]).toBeGreaterThan(2);
    expect(y(step.hero)).toBeCloseTo(STAND + 0.3, 1);

    const wall = setUp({
      boxes: [
        [
          [2, 0.3, 0],
          [0.5, 0.3, 2],
        ],
      ],
    });
    run(wall.world, 60);
    run(wall.world, 60, () => input([1, 0, 0]));
    expect(wall.hero.transform!.position[0]).toBeLessThan(1.5);
    expect(y(wall.hero)).toBeCloseTo(STAND, 1);

    const push = setUp();
    const cube = push.world.createEntity({
      transform: { position: [1.5, 0.25, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] } },
    });
    run(push.world, 60);
    run(push.world, 90, () => input([1, 0, 0]));
    expect(cube.transform!.position[0]).toBeGreaterThan(2);
    step.world.dispose();
    wall.world.dispose();
    push.world.dispose();
  });

  test('a jump next to a wall, or while a spinning cube drags it, reaches its full height; a ceiling stops it', () => {
    const highestJump = (o: { boxes?: [Vec3, Vec3][]; spinner?: boolean; walk?: Vec3 }) => {
      const { world, hero } = setUp({ at: [0, 1.5, 3], boxes: o.boxes });
      if (o.spinner)
        world.createEntity({
          transform: { position: [0, 1, 0], rotation: quat.identity() },
          spin: { angularVelocity: [0.35, 0.9, 0.15] },
          body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
        });
      // Walk into the wall (or the cube) and press jump while touching it.
      run(world, 50, () => input(o.walk ?? [0, 0, -1]));
      let highest = 0;
      run(world, 60, (step) => {
        highest = Math.max(highest, y(hero));
        return input([0, 0, 0], step < 3);
      });
      world.dispose();
      return highest - STAND;
    };
    // A wall right in front: z from 1.6 to 2.
    expect(
      highestJump({
        boxes: [
          [
            [0, 2, 1.8],
            [2, 2, 0.2],
          ],
        ],
      }),
    ).toBeGreaterThan(2);
    expect(highestJump({ spinner: true })).toBeGreaterThan(2);
    // A ceiling 1 m above its head (a slab whose bottom is at 2.6 m): it stops there.
    expect(
      highestJump({
        boxes: [
          [
            [0, 2.8, 3],
            [2, 0.2, 2],
          ],
        ],
        walk: [0, 0, 0],
      }),
    ).toBeLessThan(1.1);
  });

  test('told where to look, it looks there and walks sideways without turning (the aim)', () => {
    const { world, hero } = setUp();
    run(world, 60);
    // Looking at −Z, walking towards +X: a step to the side.
    run(world, 60, () => input([1, 0, 0], false, false, [0, 0, -1]));
    expect(hero.character!.facing).toEqual([0, 0, -1]);
    expect(hero.transform!.position[0]).toBeGreaterThan(4.2);
    expect(vec3.dot(quat.rotate(hero.transform!.rotation, [0, 0, -1]), [0, 0, -1])).toBeGreaterThan(0.999);
    world.dispose();
  });

  test('it turns on its own axis without moving, and walks where it looks: forward, back and to the side (tank controls)', () => {
    const { world, hero } = setUp();
    run(world, 60);
    const at: Vec3 = [...hero.transform!.position];
    // Half a second turning right: 30 steps of atan(3 / 60), about 86°; it does not move.
    run(world, 30, () => ({ ...NO_INPUT, turn: 1 }));
    const facing = hero.character!.facing;
    expect(Math.acos(vec3.dot(facing, [0, 0, -1]))).toBeCloseTo(30 * Math.atan(3 / 60), 9);
    expect(vec3.length(facing)).toBeCloseTo(1, 12);
    expect(facing[1]).toBe(0);
    expect(vec3.length(vec3.sub(hero.transform!.position, at))).toBeLessThan(0.01);
    // Forward: where it looks (+X, almost), and it keeps looking there.
    run(world, 60, () => ({ ...NO_INPUT, ahead: 1 }));
    expect(hero.transform!.position[0] - at[0]!).toBeGreaterThan(4);
    expect(hero.character!.facing).toEqual(facing);
    // Back: it does not turn around (it would, if it looked where it moves).
    const front = hero.transform!.position[0];
    run(world, 30, () => ({ ...NO_INPUT, ahead: -1 }));
    expect(hero.transform!.position[0]).toBeLessThan(front - 1); // (it first stops: it was going forward)
    expect(hero.character!.facing).toEqual(facing);
    // To its right (+Z, looking at +X), without turning.
    const z = hero.transform!.position[2];
    run(world, 30, () => ({ ...NO_INPUT, side: 1 }));
    expect(hero.transform!.position[2]).toBeGreaterThan(z + 1.5);
    expect(hero.character!.facing).toEqual(facing);
    world.dispose();
  });

  test('turning is additions, multiplications and a square root: atan(k) per step, on its ground, of length 1', () => {
    const k = 3 / 60;
    const once = turned([0, 0, -1], [0, 1, 0], 1, 3, 1 / 60);
    expect(Math.acos(vec3.dot(once, [0, 0, -1]))).toBeCloseTo(Math.atan(k), 12);
    expect(once[0]).toBeGreaterThan(0); // + is to the right: from −Z towards +X
    // Looking a little up, it turns on its ground (perpendicular to its up).
    const tilted = turned([0, 0.3, -1], [0, 1, 0], -1, 3, 1 / 60);
    expect(tilted[1]).toBe(0);
    expect(vec3.length(tilted)).toBeCloseTo(1, 12);
    expect(tilted[0]).toBeLessThan(0);
  });

  test('told where to look, turning does nothing: where to look comes first', () => {
    const { world, hero } = setUp();
    run(world, 30, () => ({ ...NO_INPUT, turn: 1, face: [0, 0, -1] }));
    expect(hero.character!.facing).toEqual([0, 0, -1]);
    world.dispose();
  });

  test('modes (stage 2b): on the ground it walks, off it it is in the air; resolved on every step', () => {
    const { world, hero } = setUp();
    run(world, 1);
    expect(hero.character!.mode).toBe('air'); // born above the floor
    run(world, 60);
    expect(hero.character!.mode).toBe('walk');
    run(world, 5, (step) => input([0, 0, 0], step === 1));
    expect(hero.character!.mode).toBe('air');
    world.dispose();
  });

  test("air control is data: at 0 a jump's arc cannot be steered; with the ground's, it steers as on the ground", () => {
    const sideways = (control: number) => {
      const { world, hero } = setUp();
      hero.character!.movement.air.control = control;
      run(world, 60);
      // A jump straight up, and only once in the air, the player asks to go to the side.
      run(world, 2, (step) => input([0, 0, 0], step === 1));
      run(world, 15, () => input([1, 0, 0]));
      const vx = hero.character!.velocity[0];
      world.dispose();
      return vx;
    };
    expect(sideways(0)).toBe(0);
    expect(sideways(14)).toBeCloseTo(15 * 14 * STEP, 6); // 14 m/s² for 15 steps
    expect(sideways(50)).toBeCloseTo(4.5, 6); // as on the ground: the walking speed at once
  });

  test('what carries it moves it this step only, whatever its mode; its velocity does not keep it', () => {
    const { world, hero } = setUp();
    run(world, 60);
    const x0 = hero.transform!.position[0];
    for (let i = 0; i < 30; i++) {
      hero.character!.carry = [2, 0, 0]; // the game says it on every step it applies (a wind, a belt…)
      run(world, 1);
    }
    expect(hero.transform!.position[0] - x0).toBeCloseTo(1, 2); // 2 m/s for half a second
    expect(hero.character!.velocity[0]).toBe(0);
    run(world, 30);
    expect(hero.transform!.position[0] - x0).toBeCloseTo(1, 2); // nothing carries it: it stays
    world.dispose();
  });

  test("a character's movement as it is asked for: only what is said changes, the rest is the default", () => {
    const world = new World({ seed: 1 });
    const hero = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1, movement: { jump: { speed: 3 }, air: { control: 0 } } },
    });
    expect(hero.character!.movement).toEqual({
      ...DEFAULT_MOVEMENT,
      jump: { ...DEFAULT_MOVEMENT.jump, speed: 3 },
      air: { control: 0 },
    });
    world.dispose();
  });

  test('its "up" comes from the gravity: with gravity along −Z, it stands on a wall that is a floor', () => {
    // The same world turned: gravity towards −Z, and a "floor" whose top is at z = 0.
    const world = new World({ seed: 1, gravity: { kind: 'uniform', vector: [0, 0, -9.81] } });
    world.createEntity({
      transform: { position: [0, 0, -0.5], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 30, 0.5] } },
    });
    const hero = world.createEntity({
      transform: { position: [0, 0, 1.5], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1, facing: [1, 0, 0] },
    });
    run(world, 120);
    expect(hero.character!.grounded).toBe(true);
    expect(hero.transform!.position[2]).toBeCloseTo(STAND, 1);
    // Its head points along +Z, and it walks on that wall-floor.
    expect(vec3.dot(quat.rotate(hero.transform!.rotation, [0, 1, 0]), [0, 0, 1])).toBeGreaterThan(0.999);
    run(world, 60, () => input([0, 1, 0]));
    expect(hero.transform!.position[1]).toBeGreaterThan(4);
    expect(hero.transform!.position[2]).toBeCloseTo(STAND, 1);
    world.dispose();
  });
});

describe('the players inputs, through the session', () => {
  test('a press and its release before any step: the press is not lost (it enters, and then the release)', () => {
    const session = new Session(Course, { seed: 1 });
    session.step();
    // A quick tap of Space within one frame without a step: pressed, and released.
    session.setInput(1, { jump: true });
    session.setInput(1, NO_INPUT);
    session.step();
    expect(session.world.inputs.get(1)).toEqual({ jump: true });
    session.step();
    expect(session.world.inputs.get(1)).toEqual({});
    // Changes without a press in between are not queued: only the last one enters.
    session.setInput(1, { move: [1, 0, 0] });
    session.setInput(1, { move: [0, 0, 1] });
    session.step();
    expect(session.world.inputs.get(1)).toEqual({ move: [0, 0, 1] });
    expect(session.inputs.slice(-3).map((i) => i.input)).toEqual([{ jump: true }, {}, { move: [0, 0, 1] }]);
    session.world.dispose();
  });

  const Course: Cartridge = {
    id: 'test',
    title: 'Test',
    onStart(world) {
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
      });
      world.createEntity({
        transform: { position: [0, 1.5, 0], rotation: quat.identity() },
        body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
        character: { player: 1 },
      });
    },
  };

  /** A little run around: walking, turning, jumping, running. */
  const script = (step: number): PlayerInput =>
    step < 40
      ? input()
      : step < 100
        ? input([0.6, 0, -0.8])
        : step < 130
          ? input([0.6, 0, -0.8], true)
          : step < 200
            ? input([-1, 0, 0], false, true)
            : input();

  test('they enter at the next step, are kept only when they change, and replaying them gives the same hash', () => {
    const play = () => {
      const session = new Session(Course);
      const hashes: number[] = [];
      for (let step = 1; step <= 240; step++) {
        // Asked every frame, as a presentation does: only the changes are kept.
        session.setInput(1, script(step));
        session.step();
        hashes.push(stateHash(session.world));
      }
      return { session, hashes };
    };
    const a = play();
    const b = play();
    expect(b.hashes).toEqual(a.hashes);
    expect(a.session.inputs.map((i) => i.step)).toEqual([40, 100, 130, 200]);
    // The movement is kept in hundredths (it travels in replays and over the network).
    a.session.setInput(1, input([0.123456, 0, 0]));
    a.session.step();
    expect(a.session.inputs.at(-1)!.input.move).toEqual([0.12, 0, 0]);
    a.session.setInput(1, { ...NO_INPUT, ahead: 0.987, side: -0.333, turn: 0.4567 });
    a.session.step();
    expect(a.session.inputs.at(-1)!.input).toMatchObject({ ahead: 0.99, side: -0.33, turn: 0.46 });
    a.session.world.dispose();
    b.session.world.dispose();
  });
});
