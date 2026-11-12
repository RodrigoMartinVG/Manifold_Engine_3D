import { quat, vec3, type Vec3 } from '@manifold/common';
import { gravityAt } from './gravity';
import type { Character, CharacterSpec, Entity, PlayerInput } from './types';
import type { World } from './world';

/** What a player who asks for nothing asks for. */
export const NO_INPUT: Readonly<PlayerInput> = { move: [0, 0, 0], face: [0, 0, 0], jump: false, run: false };

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
  };
}

/** "Up" at a point: the opposite of the gravity there (if there is no gravity, +Y). */
export function upAt(world: World, position: Vec3): Vec3 {
  const g = gravityAt(world.gravity, position);
  const length = vec3.length(g);
  return length > 0 ? vec3.scale(g, -1 / length) : [0, 1, 0];
}

/**
 * THE CHARACTER SYSTEM, one step of one character (stage 1b). All its math is additions,
 * multiplications and square roots (no trigonometry): the same bits in every browser.
 *
 *   1. its velocity splits into "up" (along its up) and "horizontal" (the rest);
 *   2. the horizontal part goes towards what the player asks for, by an acceleration (quick on the
 *      ground, slow in the air: it can still steer a jump, a little);
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

  // 1 and 2: the velocity, split; the horizontal part towards what is asked for.
  let vUp = vec3.dot(c.velocity, up);
  let vH = vec3.onPlane(c.velocity, up);
  let move = vec3.onPlane(input.move, up);
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  const target = vec3.scale(move, input.run ? c.runSpeed : c.walkSpeed);
  const maxChange = (c.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION) * dt;
  const diff = vec3.sub(target, vH);
  const away = vec3.length(diff);
  vH = away <= maxChange ? target : vec3.add(vH, vec3.scale(diff, maxChange / away));

  // 3: the jump.
  if (input.jump && !c.jumpHeld) c.jumpPending = JUMP_BUFFER_STEPS;
  c.jumpHeld = input.jump;
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
  // Where it looks: where it is told to, if it is told; if not, where it moves.
  const face = vec3.onPlane(input.face, up);
  if (vec3.length(face) > 0.1) c.facing = vec3.normalize(face);
  else if (asked > 0.1) c.facing = vec3.normalize(move);
  const position = vec3.add(world.physics.position(body.handle), movement);
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));
}
