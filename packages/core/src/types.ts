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

/** A collider's shape, in meters: a ball by its radius, a box by its half sizes. */
export type Shape = { kind: 'ball'; radius: number } | { kind: 'box'; halfExtents: Vec3 };

/**
 * A BODY: the physics moves it (`dynamic`), the game moves it and it pushes (`kinematic`), or it
 * never moves (`fixed`, like the floor). Its velocities are read back from the physics after every
 * step: they are part of the world's state, and of its hash.
 *
 * The real body lives in the physics (Rapier); the entity keeps only its `handle`, the number that
 * finds it (decision 0004): never the body itself, which a snapshot would leave pointing at an old world.
 */
export interface Body {
  type: 'dynamic' | 'kinematic' | 'fixed';
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

/** How it looks, as DATA (the presentation decides which material, depending on quality). */
export interface Appearance {
  /** A box of `size`, or a sphere whose diameter is `size` (all three the same). */
  shape: 'box' | 'sphere';
  size: Vec3;
  /** 0xRRGGBB */
  color: number;
}

/** The components an entity is created with (everything but the id, which the world gives, and a body as it is asked for). */
export type Components = Omit<Entity, 'id' | 'body'> & { body?: BodySpec };

/**
 * GRAVITY, as data (decision 0012): a field that says, at every point, where "down" is and how
 * strong. The classic games use the uniform one, "down" everywhere; the planets of phase 7 will add
 * other kinds. Being data, it is copied, compared and hashed with the rest of the world.
 */
export type GravityField = { kind: 'uniform'; vector: Vec3 };

/** What HAPPENED in a step, as data (for the presentation, the game, the network). */
export type Event = { type: 'entityCreated'; id: EntityId } | { type: 'entityRemoved'; id: EntityId };
