import { quat, vec3, type Vec3 } from '@manifold/common';
import { gravityAt } from './gravity';
import { axisOf, isDown, NO_INPUT, vectorOf } from './input';
import type { Character, CharacterSpec, Entity } from './types';
import type { World } from './world';

/** A jump is still allowed this many steps after leaving an edge (0.1 s): "coyote time". */
export const COYOTE_STEPS = 6;
/** A jump asked for this many steps before landing is kept, and happens on landing (0.1 s). */
export const JUMP_BUFFER_STEPS = 6;
/** How fast it reaches the speed it is asked for, m/s²: quickly on the ground, slowly in the air. */
const GROUND_ACCELERATION = 50;
const AIR_ACCELERATION = 14;

export function newCharacter(spec: CharacterSpec): Character {
  return {
    player: spec.player,
    walkSpeed: spec.walkSpeed ?? 4.5,
    runSpeed: spec.runSpeed ?? 7.5,
    jumpSpeed: spec.jumpSpeed ?? 6.5,
    velocity: [0, 0, 0],
    grounded: false,
    // Born in the air: no coyote time until it has stood on something.
    stepsInAir: COYOTE_STEPS + 1,
    jumpPending: 0,
    jumpHeld: false,
    facing: [...(spec.facing ?? [0, 0, -1])],
    turnSpeed: spec.turnSpeed ?? 3,
  };
}

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
 * THE CHARACTER SYSTEM, one step of one character (stage 1b). All its math is additions,
 * multiplications and square roots (no trigonometry): the same bits in every browser.
 *
 *   1. it turns on its own axis, if asked to (stage 1c2);
 *   2. its velocity splits into "up" (along its up) and "horizontal" (the rest); the horizontal part
 *      goes towards what the player asks for (in the world, or by where the character looks), by an
 *      acceleration (quick on the ground, slow in the air: it can still steer a jump, a little);
 *   3. a jump: asked for (pressed, not held), kept a few steps if it was too early, allowed a few
 *      steps after leaving an edge;
 *   4. gravity;
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
  if (!told && turn !== 0) c.facing = turned(c.facing, up, turn, c.turnSpeed, dt);

  // 2: the velocity, split; the horizontal part towards what is asked for: in the world, plus forward
  // and to the side by where it looks now.
  let vUp = vec3.dot(c.velocity, up);
  let vH = vec3.onPlane(c.velocity, up);
  const inWorld = vec3.onPlane(vectorOf(input, 'move'), up);
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  const right = vec3.cross(ahead, up);
  let move = vec3.add(inWorld, vec3.add(vec3.scale(ahead, axisOf(input, 'ahead')), vec3.scale(right, axisOf(input, 'side'))));
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  const target = vec3.scale(move, isDown(input, 'run') ? c.runSpeed : c.walkSpeed);
  const maxChange = (c.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION) * dt;
  const diff = vec3.sub(target, vH);
  const away = vec3.length(diff);
  vH = away <= maxChange ? target : vec3.add(vH, vec3.scale(diff, maxChange / away));

  // 3: the jump.
  const jump = isDown(input, 'jump');
  if (jump && !c.jumpHeld) c.jumpPending = JUMP_BUFFER_STEPS;
  c.jumpHeld = jump;
  if (c.jumpPending > 0 && (c.grounded || c.stepsInAir <= COYOTE_STEPS)) {
    vUp = c.jumpSpeed;
    c.jumpPending = 0;
    c.stepsInAir = COYOTE_STEPS + 1; // no second jump in the air
  } else if (c.jumpPending > 0) c.jumpPending--;

  // 4: gravity.
  vUp -= gravity * dt;

  // 5: what it can really do.
  const desired = vec3.scale(vec3.add(vH, vec3.scale(up, vUp)), dt);
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
