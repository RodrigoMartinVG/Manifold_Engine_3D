import { quat, vec3, type Vec3 } from '@manifold/common';
import { gravityAt } from './gravity';
import { axisOf, isDown, NO_INPUT, vectorOf } from './input';
import type { Character, CharacterSpec, Entity, ModeName, Movement } from './types';
import type { World } from './world';

/**
 * A platformer's feel (the one the Dojo had until stage 2b): quick on the ground, a little steering
 * in the air, a jump of about 2 m, 0.1 s of coyote time and of jump buffering.
 */
export const DEFAULT_MOVEMENT: Readonly<Movement> = Object.freeze({
  walk: { speed: 4.5, run: 7.5, acceleration: 50 },
  air: { control: 14 },
  jump: { speed: 6.5, coyote: 6, buffer: 6 },
  turn: 3,
});

export function newCharacter(spec: CharacterSpec): Character {
  const m = spec.movement ?? {};
  const movement: Movement = {
    walk: { ...DEFAULT_MOVEMENT.walk, ...m.walk },
    air: { ...DEFAULT_MOVEMENT.air, ...m.air },
    jump: { ...DEFAULT_MOVEMENT.jump, ...m.jump },
    turn: m.turn ?? DEFAULT_MOVEMENT.turn,
  };
  return {
    player: spec.player,
    movement,
    mode: 'air',
    velocity: [0, 0, 0],
    grounded: false,
    // Born in the air: no coyote time until it has stood on something.
    stepsInAir: movement.jump.coyote + 1,
    jumpPending: 0,
    jumpHeld: false,
    facing: [...(spec.facing ?? [0, 0, -1])],
    carry: [0, 0, 0],
  };
}

/**
 * A WAY OF MOVING (stage 2b; decision 0000: "one exclusive locomotion mode plus contributions that
 * add up, resolved in one place"). Exactly one is active at each step, and it decides how the
 * velocity along the ground goes towards what the player asks for. What adds up whatever the mode
 * (gravity, what carries the character) is not a mode's business: see `moveCharacter`.
 */
interface Mode {
  /** The velocity along the ground at the end of this step, from the one it has and the one asked for. */
  steer(c: Character, now: Vec3, wanted: Vec3, dt: number): Vec3;
}

/** Goes from `now` towards `wanted`, changing at most `most` (m/s) in this step. */
const approach = (now: Vec3, wanted: Vec3, most: number): Vec3 => {
  const diff = vec3.sub(wanted, now);
  const away = vec3.length(diff);
  return away <= most ? wanted : vec3.add(now, vec3.scale(diff, most / away));
};

const MODES: Record<ModeName, Mode> = {
  // On the ground: towards what is asked, quickly (its feet push against the floor).
  walk: { steer: (c, now, wanted, dt) => approach(now, wanted, c.movement.walk.acceleration * dt) },
  // In the air: the same, but with what the game allows to steer (0: the jump's arc cannot change).
  air: { steer: (c, now, wanted, dt) => approach(now, wanted, c.movement.air.control * dt) },
};

/**
 * WHICH MODE, decided here and only here: standing on something, it walks; if not, it is in the air.
 * (Stage 2c adds its capabilities here: climbing when it holds a wall, gliding when it opens its wings…)
 */
const modeFor = (c: Character): ModeName => (c.grounded ? 'walk' : 'air');

/** "Up" at a point: the opposite of the gravity there (if there is no gravity, +Y). */
export function upAt(world: World, position: Vec3): Vec3 {
  const g = gravityAt(world.gravity, position);
  const length = vec3.length(g);
  return length > 0 ? vec3.scale(g, -1 / length) : [0, 1, 0];
}

/**
 * Where it looks after turning `turn` (from −1 to 1, + to the right) during one step, WITHOUT
 * TRIGONOMETRY (stage 1c2). Turning an angle takes a sine and a cosine, and the standard lets every
 * JavaScript engine compute them its own way: the last bits can differ, and a replay would end
 * somewhere else in another browser. Instead: a little of its right side is added to where it looks,
 * and the result is brought back to length 1. Additions, multiplications and a square root, which give
 * the same bits everywhere.
 *
 * It turns atan(k) instead of k radians (k = the speed × the step × `turn`): at 3 rad/s and 60 steps
 * per second, k = 0.05, and the difference is less than a thousandth.
 */
export function turned(facing: Vec3, up: Vec3, turn: number, turnSpeed: number, dt: number): Vec3 {
  const ahead = vec3.onPlane(facing, up);
  if (vec3.length(ahead) < 1e-6) return facing; // looking straight up or down: there is no turning
  const right = vec3.cross(ahead, up);
  return vec3.normalize(vec3.add(ahead, vec3.scale(right, turnSpeed * dt * turn)));
}

/**
 * THE CHARACTER SYSTEM, one step of one character (stage 1b; in modes since 2b). All its math is
 * additions, multiplications and square roots (no trigonometry): the same bits in every browser.
 * Everything is resolved here, in this order:
 *
 *   1. it turns on its own axis, if asked to (stage 1c2);
 *   2. THE MODE (only one): its velocity splits into "up" (along its up) and "along the ground" (the
 *      rest), and the mode steers the part along the ground towards what the player asks for;
 *   3. a jump: asked for (pressed, not held), kept a few steps if it was too early, allowed a few
 *      steps after leaving an edge; it sends it into the air;
 *   4. THE CONTRIBUTIONS, whatever the mode: gravity (it changes the velocity) and what the game makes
 *      it carry (it moves it, this step only);
 *   5. the character controller says how much of the desired movement it can really do: it slides
 *      along walls, climbs steps, stays on slopes and on the ground, and pushes what can be pushed;
 *   6. what it learned: whether it stands on something, whether it hit a ceiling, where it looks.
 *
 * The body moves there during the physics step (it is a kinematic body moved by position).
 */
export function moveCharacter(world: World, e: Entity, dt: number) {
  const c = e.character!;
  const body = e.body!;
  const input = world.inputs.get(c.player) ?? NO_INPUT;
  const gravity = vec3.length(gravityAt(world.gravity, e.transform!.position));
  const up = upAt(world, e.transform!.position);

  // 1: turning on its own axis (where it looks may be told instead: that comes first).
  const face = vec3.onPlane(vectorOf(input, 'face'), up);
  const told = vec3.length(face) > 0.1;
  const turn = axisOf(input, 'turn');
  if (!told && turn !== 0) c.facing = turned(c.facing, up, turn, c.movement.turn, dt);

  // 2: the mode, and the velocity along the ground towards what is asked for: in the world, plus
  // forward and to the side by where it looks now.
  c.mode = modeFor(c);
  let vUp = vec3.dot(c.velocity, up);
  let vH = vec3.onPlane(c.velocity, up);
  const inWorld = vec3.onPlane(vectorOf(input, 'move'), up);
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  const right = vec3.cross(ahead, up);
  let move = vec3.add(inWorld, vec3.add(vec3.scale(ahead, axisOf(input, 'ahead')), vec3.scale(right, axisOf(input, 'side'))));
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  const wanted = vec3.scale(move, isDown(input, 'run') ? c.movement.walk.run : c.movement.walk.speed);
  vH = MODES[c.mode].steer(c, vH, wanted, dt);

  // 3: the jump.
  const { jump } = c.movement;
  const jumping = isDown(input, 'jump');
  if (jumping && !c.jumpHeld) c.jumpPending = jump.buffer;
  c.jumpHeld = jumping;
  if (c.jumpPending > 0 && (c.grounded || c.stepsInAir <= jump.coyote)) {
    vUp = jump.speed;
    c.jumpPending = 0;
    c.stepsInAir = jump.coyote + 1; // no second jump in the air
  } else if (c.jumpPending > 0) c.jumpPending--;

  // 4: the contributions. Gravity changes the velocity; what carries it only moves it, this step.
  vUp -= gravity * dt;
  const carried: Vec3 = [...c.carry];
  c.carry = [0, 0, 0];

  // 5: what it can really do.
  const desired = vec3.scale(vec3.add(vec3.add(vH, vec3.scale(up, vUp)), carried), dt);
  const { movement, grounded, ceiling } = world.physics.moveCharacter(body.handle, desired, up);

  // 6: what it learned. (A ceiling is what the controller says hit its head: rising a little less
  // than asked is not one; that happens brushing a wall, and it used to cut jumps short.)
  if (vUp > 0 && ceiling) vUp = 0;
  if (grounded && vUp < 0) vUp = 0;
  c.grounded = grounded;
  c.stepsInAir = grounded ? 0 : c.stepsInAir + 1;
  c.velocity = vec3.add(vH, vec3.scale(up, vUp));
  // Where it looks: where it is told to, if it is told; if not, where it moves in the world. (Moving
  // by where it looks does not change it: walking back would turn it around, and back again.)
  if (told) c.facing = vec3.normalize(face);
  else if (vec3.length(inWorld) > 0.1) c.facing = vec3.normalize(inWorld);
  const position = vec3.add(world.physics.position(body.handle), movement);
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));
}
