import { Random, quat } from '@manifold/common';
import { moveCharacter, newCharacter } from './character';
import { EARTH, gravityAt } from './gravity';
import { Physics } from './physics';
import type { Components, Entity, Event, EntityId, GravityField, PlayerInput } from './types';
import { SIMULATION_VERSION } from './version';

/** The fixed step: the simulation always advances 1/60 of a second, whatever the frame rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  /** The seed of its randomness: the same world with the same seed does exactly the same. */
  seed: number;
  /** Its gravity (the Earth's, if not said). */
  gravity?: GravityField;
  /** A snapshot of Rapier's world to start from, instead of an empty one (`World.restore` uses it). */
  physics?: Uint8Array;
}

/**
 * A SNAPSHOT OF A WORLD (stage 1d, as decision 0004 defined it): everything it is, at the end of a
 * step. Its clock and its id counter, its randomness's state, its gravity, its players' inputs (and
 * the previous step's), its entities (plain data: copied as they are), and Rapier's own snapshot of
 * its physics, which also keeps what is not in the entities: the contacts, and what the solver
 * carries from one step to the next. Restored, it goes on exactly as the original would have
 * (measured before this stage: the same bits 300 steps later).
 */
export interface WorldSnapshot {
  /** The simulation's version it was taken with: only that one restores it. */
  readonly version: number;
  readonly tick: number;
  readonly lastId: number;
  readonly random: readonly [number, number, number, number];
  readonly gravity: GravityField;
  readonly inputs: readonly [number, PlayerInput][];
  readonly lastInputs: readonly [number, PlayerInput][];
  readonly players: readonly number[];
  readonly entities: readonly Entity[];
  /** Rapier's snapshot: its bodies, colliders, contacts and solver, as bytes. */
  readonly physics: Uint8Array;
}

/**
 * A copy of plain data (numbers, texts, booleans, arrays and objects of them: what the state is made
 * of, decision 0004), all the way down. Not with JSON: it would turn −0 into 0 (different bits:
 * another hash) and NaN into null. Nor with `structuredClone`, which is the browser's and Node's,
 * not JavaScript's: the core runs on the language alone.
 */
export function copyData<T>(x: T): T {
  if (Array.isArray(x)) return x.map(copyData) as T;
  // Bytes (Rapier's snapshot): copied as bytes, not as an object with numbered keys.
  if (ArrayBuffer.isView(x)) return (x as unknown as Uint8Array).slice() as T;
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) out[k] = copyData(v);
    return out as T;
  }
  return x;
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
  /**
   * What each player asked for at the PREVIOUS step (stage 1d): a button is pressed when it is held
   * now and was not then (`pressed` in input.ts). Also part of the state.
   */
  readonly lastInputs = new Map<number, PlayerInput>();
  /**
   * Who is in the match (stage 1e): the server says it, with `players.join` and `players.leave`, at a
   * concrete step. The game decides what that means (in the Dojo's course, a character for each one).
   */
  readonly players = new Set<number>();
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
    this.physics = new Physics(this.uniformGravity(), STEP, o.physics);
  }

  /** The last id given (the next entity gets the following one): part of the state. */
  get lastEntityId(): number {
    return this.lastId;
  }

  /**
   * The inputs for the next step: the current ones become the previous step's, and the changes enter.
   * The session calls it before EVERY step, even without changes.
   */
  applyInputs(changes: ReadonlyMap<number, PlayerInput>) {
    this.lastInputs.clear();
    for (const [player, input] of this.inputs) this.lastInputs.set(player, input);
    for (const [player, input] of changes) this.inputs.set(player, input);
  }

  /** A snapshot of this moment: copies, so it does not change when the world goes on. */
  snapshot(): WorldSnapshot {
    return {
      version: SIMULATION_VERSION,
      tick: this.tick,
      lastId: this.lastId,
      random: [...this.random.state],
      gravity: copyData(this.field),
      inputs: copyData([...this.inputs]),
      lastInputs: copyData([...this.lastInputs]),
      players: [...this.players],
      entities: copyData([...this.entities.values()]),
      physics: this.physics.snapshot(),
    };
  }

  /**
   * A NEW world from a snapshot, the same as the one that took it. It emits no events: its entities
   * were already there (whoever draws it reads them from `entities`).
   */
  static restore(s: WorldSnapshot): World {
    if (s.version !== SIMULATION_VERSION)
      throw new Error(`A snapshot of version ${s.version}, and this engine is version ${SIMULATION_VERSION}.`);
    const world = new World({ seed: 0, gravity: copyData(s.gravity), physics: s.physics });
    world.tick = s.tick;
    world.lastId = s.lastId;
    world.random.restore(s.random);
    for (const [player, input] of copyData(s.inputs)) world.inputs.set(player, input);
    for (const [player, input] of copyData(s.lastInputs)) world.lastInputs.set(player, input);
    for (const player of s.players) world.players.add(player);
    for (const e of copyData(s.entities)) world.entities.set(e.id, e);
    return world;
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
