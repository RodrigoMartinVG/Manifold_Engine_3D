import type { Quat, Vec3 } from '@manifold/common';

/** The number that names an entity. Unique within ITS world (not in the whole program). */
export type EntityId = number;

/**
 * An ENTITY is an id and its COMPONENTS: plain data, no methods. An entity with `transform` is
 * somewhere; with `spin`, it also spins; with `appearance`, the presentation knows how to draw it.
 * No component holds Three.js or Rapier objects: that is why a world can be copied, compared and
 * snapshotted (decision 0004).
 *
 * (Stage 0: the first three. Every engine stage adds its own.)
 */
export interface Entity {
  readonly id: EntityId;
  transform?: Transform;
  spin?: Spin;
  appearance?: Appearance;
}

export interface Transform {
  position: Vec3;
  rotation: Quat;
}

/** Spins at a constant rate: `angularVelocity` is the axis times the speed (rad/s). */
export interface Spin {
  angularVelocity: Vec3;
}

/** How it looks, as DATA (the presentation decides which material, depending on quality). */
export interface Appearance {
  shape: 'box';
  size: Vec3;
  /** 0xRRGGBB */
  color: number;
}

/** The components an entity is created with (everything but the id, which the world gives). */
export type Components = Omit<Entity, 'id'>;

/** What HAPPENED in a step, as data (for the presentation, the game, the network). */
export type Event = { type: 'entityCreated'; id: EntityId } | { type: 'entityRemoved'; id: EntityId };
