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
  jump: { speed: 6.5, coyote: 6, buffer: 6, air: 1 },
  glide: { fall: 1.5, control: 20 },
  climb: { speed: 2.5, top: 4, off: 4 },
  turn: 3,
});

export function newCharacter(spec: CharacterSpec): Character {
  const m = spec.movement ?? {};
  const movement: Movement = {
    walk: { ...DEFAULT_MOVEMENT.walk, ...m.walk },
    air: { ...DEFAULT_MOVEMENT.air, ...m.air },
    jump: { ...DEFAULT_MOVEMENT.jump, ...m.jump },
    glide: { ...DEFAULT_MOVEMENT.glide, ...m.glide },
    climb: { ...DEFAULT_MOVEMENT.climb, ...m.climb },
    turn: m.turn ?? DEFAULT_MOVEMENT.turn,
  };
  return {
    player: spec.player,
    movement,
    // Without capabilities, unless the game gives them (stage 2c).
    can: { doubleJump: false, glide: false, climb: false, ...spec.can },
    airJumps: movement.jump.air,
    wall: [0, 0, 0],
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
 * add up, resolved in one place"). Exactly one is active at each step. It decides how the velocity
 * along the ground goes towards what the player asks for; and, if it is its business, the velocity up:
 * a mode that holds itself (climbing) sets it, and gravity does not apply; a mode that slows the fall
 * (gliding) says how fast it can fall at most.
 */
interface Mode {
  /** The velocity along the ground at the end of this step, from the one it has, the one asked for and the direction asked. */
  steer(c: Character, now: Vec3, wanted: Vec3, move: Vec3, dt: number): Vec3;
  /** If it holds itself against gravity: its own velocity up. */
  holds?(c: Character, move: Vec3): number;
  /** If it slows the fall: the fastest it falls, m/s. */
  fall?(c: Character): number;
}

/** Goes from `now` towards `wanted`, changing at most `most` (m/s) in this step. */
const approach = (now: Vec3, wanted: Vec3, most: number): Vec3 => {
  const diff = vec3.sub(wanted, now);
  const away = vec3.length(diff);
  return away <= most ? wanted : vec3.add(now, vec3.scale(diff, most / away));
};
const isZero = (v: Vec3) => v[0] === 0 && v[1] === 0 && v[2] === 0;

const MODES: Record<ModeName, Mode> = {
  // On the ground: towards what is asked, quickly (its feet push against the floor).
  walk: { steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.walk.acceleration * dt) },
  // In the air: the same, but with what the game allows to steer (0: the jump's arc cannot change).
  air: { steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.air.control * dt) },
  // Gliding (stage 2c): it steers more, and it falls slowly.
  glide: {
    steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.glide.control * dt),
    fall: (c) => c.movement.glide.fall,
  },
  // Climbing (stage 2c): along the wall, as much as is asked along it; up, as much as it pushes
  // against it. Not towards it: the controller would not let it rise along something that steep.
  // Gravity does not pull it.
  climb: {
    steer: (c, _now, _wanted, move) => vec3.scale(vec3.onPlane(move, c.wall), c.movement.climb.speed),
    holds: (c, move) => c.movement.climb.speed * Math.max(0, vec3.dot(move, c.wall)),
  },
};

/**
 * WHICH MODE, decided here and only here (stage 2b), with what it can do (stage 2c):
 * - pushing against a wall it touches, if it can climb: it climbs (from the ground, or going on
 *   climbing, or in the air while it is not going up: just after jumping off a wall, it does not grab
 *   it again before it starts to fall);
 * - standing on something: it walks;
 * - falling while it holds the jump, if it can glide: it glides;
 * - otherwise: it is in the air.
 */
const modeFor = (c: Character, move: Vec3, jumping: boolean, vUp: number): ModeName => {
  if (c.can.climb && vec3.dot(move, c.wall) > 0.5 && (c.grounded || c.mode === 'climb' || vUp <= 0)) return 'climb';
  if (c.grounded) return 'walk';
  if (c.can.glide && jumping && vUp < 0) return 'glide';
  return 'air';
};

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
 *   2. THE MODE (only one, chosen in `modeFor`): its velocity splits into "up" (along its up) and
 *      "along the ground" (the rest), and the mode steers the part along the ground;
 *   3. a jump: asked for (pressed, not held), kept a few steps if it was too early, allowed a few
 *      steps after leaving an edge; or from a wall, or one more in the air, if it can (stage 2c);
 *   4. THE CONTRIBUTIONS, whatever the mode: gravity (unless the mode holds itself, as climbing; a mode
 *      may slow the fall, as gliding) and what the game makes it carry (it moves it, this step only);
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

  // 2: what is asked for (in the world, plus forward and to the side by where it looks now); the
  // mode; and the velocity along the ground, as the mode steers it.
  let vUp = vec3.dot(c.velocity, up);
  let vH = vec3.onPlane(c.velocity, up);
  const inWorld = vec3.onPlane(vectorOf(input, 'move'), up);
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  const right = vec3.cross(ahead, up);
  let move = vec3.add(inWorld, vec3.add(vec3.scale(ahead, axisOf(input, 'ahead')), vec3.scale(right, axisOf(input, 'side'))));
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  const wanted = vec3.scale(move, isDown(input, 'run') ? c.movement.walk.run : c.movement.walk.speed);
  const jumping = isDown(input, 'jump');
  // A wall, if it can climb: from its feet, towards the wall it climbs, or towards where it is asked
  // to go (a little beyond its radius). From its feet, so it keeps climbing until they pass the top.
  if (c.can.climb) {
    const towards = isZero(c.wall) ? (vec3.length(move) > 0.1 ? vec3.normalize(move) : null) : c.wall;
    const feet = vec3.add(e.transform!.position, vec3.scale(up, -0.5));
    c.wall = towards ? world.physics.wallAhead(body.handle, feet, towards, 0.55, up) : [0, 0, 0];
  } else c.wall = [0, 0, 0];
  const before = c.mode;
  c.mode = modeFor(c, move, jumping, vUp);
  let mode = MODES[c.mode];
  vH = mode.steer(c, vH, wanted, move, dt);
  // The top of a wall: it was climbing and the wall ended. A hop up, so it gets onto it.
  if (before === 'climb' && c.mode !== 'climb' && isZero(c.wall)) vUp = Math.max(vUp, c.movement.climb.top);

  // 3: the jump: from the ground (or just after leaving it), from a wall, or one more in the air.
  const { jump } = c.movement;
  if (jumping && !c.jumpHeld) c.jumpPending = jump.buffer;
  c.jumpHeld = jumping;
  if (c.grounded || c.mode === 'climb') c.airJumps = jump.air;
  if (c.jumpPending > 0) {
    if (c.mode === 'climb') {
      // Off the wall: up, and away from it.
      vUp = jump.speed;
      vH = vec3.scale(c.wall, -c.movement.climb.off);
      c.mode = 'air';
      mode = MODES.air;
      c.jumpPending = 0;
      c.stepsInAir = jump.coyote + 1;
    } else if (c.grounded || c.stepsInAir <= jump.coyote) {
      vUp = jump.speed;
      c.jumpPending = 0;
      c.stepsInAir = jump.coyote + 1; // the coyote time is over: from now on, only a jump in the air
    } else if (c.can.doubleJump && c.airJumps > 0) {
      vUp = jump.speed;
      c.airJumps--;
      c.jumpPending = 0;
    } else c.jumpPending--;
  }

  // 4: the contributions. Gravity changes the velocity (unless the mode holds itself; a mode may
  // slow the fall); what carries it only moves it, this step.
  if (mode.holds) vUp = mode.holds(c, move);
  else {
    vUp -= gravity * dt;
    const fall = mode.fall?.(c);
    if (fall !== undefined) vUp = Math.max(vUp, -fall);
  }
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
  // Climbing, it looks at its wall.
  if (told) c.facing = vec3.normalize(face);
  else if (c.mode === 'climb' && !isZero(c.wall)) c.facing = [...c.wall];
  else if (vec3.length(inWorld) > 0.1) c.facing = vec3.normalize(inWorld);
  const position = vec3.add(world.physics.position(body.handle), movement);
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));
}
