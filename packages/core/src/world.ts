import { Random, quat } from '@manifold/common';
import type { Components, Entity, Event, EntityId } from './types';

/** The fixed step: the simulation always advances 1/60 of a second, whatever the frame rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  /** The seed of its randomness: the same world with the same seed does exactly the same. */
  seed: number;
}

/**
 * A WORLD: the whole state of a simulation, and nothing outside it.
 *
 * Lesson from V1 (decision 0000): an id counter or a "program-wide" random generator makes two
 * worlds in the same process (a server with two rooms, a match and its replay, a test with a
 * server and a client) steal numbers from each other. Here every world has ITS clock, ITS id
 * counter and ITS randomness. A hundred worlds can be created at once without noticing each other.
 */
export class World {
  /** How many steps it took. */
  tick = 0;
  readonly random: Random;
  readonly entities = new Map<EntityId, Entity>();
  private lastId = 0;
  /**
   * Events have TWO readers, at two rates:
   * - the game (the cartridge), once per STEP: `stepEvents`, emptied at the start of every step;
   * - the presentation, once per screen FRAME: `takeEvents()`. Those are NOT emptied on every
   *   step: if two steps happen in one frame, the presentation must see the events of both
   *   (V1's lesson, which the architecture proposal forgot).
   */
  stepEvents: Event[] = [];
  private pending: Event[] = [];

  constructor(o: WorldOptions) {
    this.random = new Random(o.seed);
  }

  createEntity(components: Components): Entity {
    const entity: Entity = { id: ++this.lastId, ...components };
    this.entities.set(entity.id, entity);
    this.emit({ type: 'entityCreated', id: entity.id });
    return entity;
  }

  removeEntity(id: EntityId) {
    if (this.entities.delete(id)) this.emit({ type: 'entityRemoved', id });
  }

  /**
   * One fixed step. The systems ALWAYS run in the same order, and entities are visited in
   * creation order (a `Map` keeps insertion order): the order is part of determinism.
   */
  step() {
    this.stepEvents = [];
    this.tick++;
    this.spin();
  }

  /** Record that something happened (for both readers). */
  emit(event: Event) {
    this.stepEvents.push(event);
    this.pending.push(event);
  }

  /** For the presentation: the events since the last time it asked (and forgets them). */
  takeEvents(): Event[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /**
   * SPIN system: the rotation advances this step's angle around the axis of its angular velocity.
   * With a fixed axis this is exact (rotations around the same axis add up); it is renormalized
   * so rounding does not accumulate.
   */
  private spin() {
    for (const e of this.entities.values()) {
      if (!e.spin || !e.transform) continue;
      const w = e.spin.angularVelocity;
      const speed = Math.hypot(w[0], w[1], w[2]);
      if (speed === 0) continue;
      const delta = quat.fromAxisAngle(w, speed * STEP);
      e.transform.rotation = quat.normalize(quat.multiply(delta, e.transform.rotation));
    }
  }
}
