import { Random, quat } from '@manifold/common';
import { moveCharacter, newCharacter } from './character';
import { EARTH, gravityAt } from './gravity';
import { Physics } from './physics';
import type { Components, Entity, Event, EntityId, GravityField, PlayerInput } from './types';

/** The fixed step: the simulation always advances 1/60 of a second, whatever the frame rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  /** The seed of its randomness: the same world with the same seed does exactly the same. */
  seed: number;
  /** Its gravity (the Earth's, if not said). */
  gravity?: GravityField;
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
  /**
   * What each player asks for now (stage 1b), by player number: it enters through the session, at a
   * concrete step, and it is part of the state (and of the hash), like everything else.
   */
  readonly inputs = new Map<number, PlayerInput>();
  /** Its gravity field: data, like the rest of its state (decision 0012). */
  private field: GravityField;
  /**
   * ITS physics (Rapier, behind the boundary of physics.ts): every world has its own, like its
   * randomness. The entities keep only their bodies' handles (decision 0004).
   */
  readonly physics: Physics;

  constructor(o: WorldOptions) {
    this.random = new Random(o.seed);
    this.field = o.gravity ?? EARTH;
    this.physics = new Physics(this.uniformGravity(), STEP);
  }

  get gravity(): GravityField {
    return this.field;
  }

  set gravity(field: GravityField) {
    this.field = field;
    this.physics.setGravity(this.uniformGravity());
  }

  /** The uniform field is handed to the physics as is (the planets of phase 7 will push each body instead). */
  private uniformGravity() {
    return gravityAt(this.field, [0, 0, 0]);
  }

  createEntity(components: Components): Entity {
    const { body, character, ...rest } = components;
    const entity: Entity = { id: ++this.lastId, ...rest };
    if (body) {
      if (!entity.transform) throw new Error('A body needs a transform: where is it?');
      entity.body = this.physics.addBody(body, entity.transform);
    }
    if (character) {
      if (entity.body?.type !== 'character') throw new Error("A character needs a body of type 'character'.");
      entity.character = newCharacter(character);
    }
    this.entities.set(entity.id, entity);
    this.emit({ type: 'entityCreated', id: entity.id });
    return entity;
  }

  removeEntity(id: EntityId) {
    const entity = this.entities.get(id);
    if (!entity) return;
    if (entity.body) this.physics.removeBody(entity.body.handle);
    this.entities.delete(id);
    this.emit({ type: 'entityRemoved', id });
  }

  /**
   * One fixed step. The systems ALWAYS run in the same order, and entities are visited in
   * creation order (a `Map` keeps insertion order): the order is part of determinism.
   *
   *   1. spin: what spins without a body turns here; a kinematic body gets its velocity;
   *   2. characters: each one decides where it can go, with what its player asks for (character.ts);
   *   3. physics: Rapier advances one step (gravity, collisions, bounces; the characters move);
   *   4. read back: every moving body's pose and velocities go to its components.
   */
  step() {
    this.stepEvents = [];
    this.tick++;
    this.spin();
    for (const e of this.entities.values()) if (e.character && e.body?.type === 'character') moveCharacter(this, e, STEP);
    this.physics.step();
    for (const e of this.entities.values())
      if (e.body && e.transform && e.body.type !== 'fixed') this.physics.read(e.body.handle, e.transform, e.body);
  }

  /** Frees its physics. A world that is no longer used must be disposed (WebAssembly's memory is not collected). */
  dispose() {
    this.physics.dispose();
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
      // With a kinematic body, the physics turns it (with its deterministic math), and pushes what it touches.
      if (e.body?.type === 'kinematic') {
        this.physics.setKinematicVelocity(e.body.handle, e.body.linearVelocity, w);
        continue;
      }
      if (e.body) continue; // a dynamic or fixed body is moved by the physics, or not at all
      const speed = Math.hypot(w[0], w[1], w[2]);
      if (speed === 0) continue;
      const delta = quat.fromAxisAngle(w, speed * STEP);
      e.transform.rotation = quat.normalize(quat.multiply(delta, e.transform.rotation));
    }
  }
}
