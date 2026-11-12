import type { Quat, Vec3 } from '@manifold/common';

/** The number that names an entity. Unique within ITS world (not in the whole program). */
export type EntityId = number;

/**
 * An ENTITY is an id and its COMPONENTS: plain data, no methods. An entity with `transform` is
 * somewhere; with `spin`, it also spins; with `body`, the physics moves it and makes it collide;
 * with `appearance`, the presentation knows how to draw it. No component holds Three.js or Rapier
 * objects: that is why a world can be copied, compared and snapshotted (decision 0004).
 *
 * (Stage 0 brought the first three; stage 1a, `body`. Every engine stage adds its own.)
 */
export interface Entity {
  readonly id: EntityId;
  transform?: Transform;
  spin?: Spin;
  body?: Body;
  character?: Character;
  appearance?: Appearance;
}

export interface Transform {
  position: Vec3;
  rotation: Quat;
}

/**
 * Spins at a constant rate: `angularVelocity` is the axis times the speed (rad/s). On an entity with
 * a kinematic body, the physics turns it (and what it touches feels it); without a body, the world.
 */
export interface Spin {
  angularVelocity: Vec3;
}

/**
 * A collider's shape, in meters: a ball by its radius, a box by its half sizes, a capsule (a
 * cylinder with half spheres at its ends, standing along its "up") by the half height of its
 * cylinder and its radius.
 */
export type Shape =
  { kind: 'ball'; radius: number } | { kind: 'box'; halfExtents: Vec3 } | { kind: 'capsule'; halfHeight: number; radius: number };

/**
 * A BODY: the physics moves it (`dynamic`), the game moves it and it pushes (`kinematic`), it never
 * moves (`fixed`, like the floor), or it is a character's (`character`: it walks, climbs steps and
 * stops at walls, moved by the character controller, see `Character`). Its velocities are read back from the physics after every
 * step: they are part of the world's state, and of its hash.
 *
 * The real body lives in the physics (Rapier); the entity keeps only its `handle`, the number that
 * finds it (decision 0004): never the body itself, which a snapshot would leave pointing at an old world.
 */
export interface Body {
  type: 'dynamic' | 'kinematic' | 'fixed' | 'character';
  shape: Shape;
  /** How much it bounces: 0 (none) to 1 (it keeps all its speed). */
  restitution: number;
  friction: number;
  /**
   * How fast it loses its speed by itself, per second (0: never). Rapier has no rolling resistance:
   * without angular damping, a ball rolls on a flat floor almost forever.
   */
  linearDamping: number;
  angularDamping: number;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  /** Given by the world when the entity is created. */
  handle: number;
}

/** A body as it is asked for: the shape and the type; the rest has defaults. */
export type BodySpec = Pick<Body, 'type' | 'shape'> &
  Partial<Pick<Body, 'restitution' | 'friction' | 'linearDamping' | 'angularDamping' | 'linearVelocity' | 'angularVelocity'>>;

/**
 * A CHARACTER (stage 1b): something a player drives. Its body is a `character` body, a capsule; this
 * is the rest of its state, all data, part of the hash:
 * - how it moves: its speeds, and the velocity it has now;
 * - whether it stands on something, and how many steps it has been in the air (a jump is still
 *   allowed a few steps after leaving an edge: "coyote time");
 * - a jump asked for a little before landing is kept a few steps ("jump buffering"), so it is not lost;
 * - where it looks.
 *
 * Its "up" is not stored: it is the opposite of the gravity where it stands (decision 0012). Today
 * that is always +Y; on the planets of phase 7 it will change from place to place.
 */
export interface Character {
  /** The player who drives it (the inputs carry this number). */
  player: number;
  walkSpeed: number;
  runSpeed: number;
  /** The upward speed of a jump, m/s: it rises v² / 2g (6.5 m/s on Earth: about 2.15 m). */
  jumpSpeed: number;
  velocity: Vec3;
  grounded: boolean;
  stepsInAir: number;
  /** Steps left to jump when it touches the ground (0: no jump pending). */
  jumpPending: number;
  /** Whether the jump input was held at the previous step: a jump starts when it is pressed, not while held. */
  jumpHeld: boolean;
  /** Where it looks: a unit vector perpendicular to its "up". */
  facing: Vec3;
}

/** A character as it is asked for: its player; the rest has defaults. */
export type CharacterSpec = Pick<Character, 'player'> &
  Partial<Pick<Character, 'walkSpeed' | 'runSpeed' | 'jumpSpeed' | 'facing'>>;

/**
 * WHAT A PLAYER ASKS FOR at a step: where to move (a vector in the world, of length up to 1:
 * the presentation turns the keys into it, by where the camera looks), whether to jump and whether
 * to run. It enters the world through the session, at a concrete step, like any world change.
 */
export interface PlayerInput {
  move: Vec3;
  jump: boolean;
  run: boolean;
}

/** How it looks, as DATA (the presentation decides which material, depending on quality). */
export interface Appearance {
  /**
   * A box of `size`, a sphere whose diameter is `size` (all three the same), or a capsule `size[1]`
   * tall and `size[0]` wide.
   */
  shape: 'box' | 'sphere' | 'capsule';
  size: Vec3;
  /** 0xRRGGBB */
  color: number;
}

/** The components an entity is created with (everything but the id, which the world gives; a body and a character as they are asked for). */
export type Components = Omit<Entity, 'id' | 'body' | 'character'> & { body?: BodySpec; character?: CharacterSpec };

/**
 * GRAVITY, as data (decision 0012): a field that says, at every point, where "down" is and how
 * strong. The classic games use the uniform one, "down" everywhere; the planets of phase 7 will add
 * other kinds. Being data, it is copied, compared and hashed with the rest of the world.
 */
export type GravityField = { kind: 'uniform'; vector: Vec3 };

/** What HAPPENED in a step, as data (for the presentation, the game, the network). */
export type Event = { type: 'entityCreated'; id: EntityId } | { type: 'entityRemoved'; id: EntityId };
