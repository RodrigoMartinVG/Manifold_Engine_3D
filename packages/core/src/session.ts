import { formatValue, Registry, type Value } from '@manifold/commands';
import type { Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { EARTH } from './gravity';
import { actionsFor, isDown, NO_INPUT, normalizeInput, sameInput, type InputAction } from './input';
import type { PlayerInput } from './types';
import { copyData, World, type WorldSnapshot } from './world';

export interface SessionOptions {
  /**
   * The variables and commands (decision 0010), with the recipes already applied. If none is
   * given, a new one with what the engine and the cartridge declare, all at their defaults.
   */
  registry?: Registry<World>;
  /** For tests: the seed, without going through the registry. */
  seed?: number;
}

/** A world change that entered the session, and at which step: the basis of a replay. */
export interface WorldChange {
  step: number;
  line: string;
}

/** A player's input that entered the session, and at which step: the other half of a replay. */
export interface InputChange {
  step: number;
  player: number;
  input: PlayerInput;
}

/**
 * A SESSION'S SAVE (stage 1d): its world's snapshot, and what the session needs to go on as if
 * nothing had happened. Its history and inputs up to then (so its replay, from its birth, still
 * describes the world after going back), the world values of its registry, and what was waiting for
 * the next step. It lives in memory: it is for going back to a moment (like an emulator's "save
 * state"), not for saving a game (phase 3: the game's progress, as data of its own).
 */
export interface SessionSave {
  readonly world: WorldSnapshot;
  readonly history: readonly WorldChange[];
  readonly inputs: readonly InputChange[];
  readonly values: ReadonlyMap<string, Value>;
  readonly scheduled: readonly { line: string; apply: (world: World) => void }[];
  readonly pendingInputs: ReadonlyMap<number, readonly PlayerInput[]>;
}

/**
 * A session's state as it TRAVELS (stage 1e): what someone who joins a match already started
 * receives. Like a save, but only data (no functions), so it can be sent: the world's snapshot, the
 * history and inputs from the birth (so the joiner's replay also starts at the birth), and the world
 * values as pairs. What was waiting for the next step does not go: the next step will bring it.
 */
export interface SessionState {
  readonly birth: string;
  readonly world: WorldSnapshot;
  readonly history: readonly WorldChange[];
  readonly inputs: readonly InputChange[];
  readonly values: readonly [string, Value][];
}

/** A registry with what the engine and the cartridge declare (without the presentation or the console). */
export function registryFor(cartridge: Cartridge): Registry<World> {
  const registry = new Registry<World>();
  declareCore(registry);
  cartridge.onDeclare?.(registry);
  return registry;
}

/** What the core declares, for every game (each game decides whether to let people touch it). */
export function declareCore(registry: Registry<World>) {
  registry.declareVariable({
    name: 'seed',
    description: "The seed of the world's randomness: the same seed, the same world.",
    scope: 'startup',
    type: { kind: 'integer', min: 0, max: 4294967295 },
    default: 1,
  });
  registry.declareCommand({
    name: 'players.join',
    description:
      'A player comes into the match (the server says it, at a step): the game decides what that means, like a character for them.',
    args: [{ name: 'player', type: { kind: 'integer', min: 1, max: 64 } }],
    onWorld: (world, [player]) => void world.players.add(Number(player)),
  });
  registry.declareCommand({
    name: 'players.leave',
    description: 'A player leaves the match (the server says it, at a step).',
    args: [{ name: 'player', type: { kind: 'integer', min: 1, max: 64 } }],
    onWorld: (world, [player]) => void world.players.delete(Number(player)),
  });
  registry.declareVariable({
    name: 'physics.gravity',
    description: "The gravity, in m/s² along each axis (x y z): the Earth's is 0 -9.81 0. Try 0 -1.6 0, the Moon's.",
    scope: 'world',
    type: { kind: 'vector' },
    default: [...EARTH.vector],
    onWorld(world, value) {
      world.gravity = { kind: 'uniform', vector: [...(value as Vec3)] };
    },
  });
}

/**
 * A SESSION: a world and the cartridge that plays it. It is the only thing that calls the
 * cartridge, at fixed moments: at the start, and after every step, with that step's events. It runs
 * without a screen: the presentation, the tests and (later) the server use it.
 *
 * It is also THE CHANNEL FOR WORLD CHANGES (decision 0010): a change coming from the console (or,
 * later, the network) does not touch the world right away. It is scheduled, applied at the start of
 * the next step, always in the same order, and kept in `history` with its step. So two sessions
 * that receive the same changes at the same steps do exactly the same.
 */
export class Session {
  private current: World;
  readonly registry: Registry<World>;
  /** What its players can ask for: the core's actions and the cartridge's (stage 1d). */
  readonly actions: readonly InputAction[];
  /** Every world change that entered, with the step at which it was applied. */
  readonly history: WorldChange[] = [];
  /** Every player input that entered (only when it changed), with the step at which it was applied. */
  readonly inputs: InputChange[] = [];
  /**
   * How the world was born: its startup and world values that differ from their defaults, as recipe
   * lines (without the view's: they do not change the world). With `history` and `inputs`, a replay.
   */
  readonly birth: string;
  private scheduled: { line: string; apply: (world: World) => void }[] = [];
  /** What each player asked for that has not entered yet: usually one input; two when a press must not be lost. */
  private pendingInputs = new Map<number, PlayerInput[]>();

  constructor(
    readonly cartridge: Cartridge,
    o: SessionOptions = {},
  ) {
    this.registry = o.registry ?? registryFor(cartridge);
    this.actions = actionsFor(cartridge.inputs);
    this.birth = [
      ...(o.seed !== undefined ? [`seed ${o.seed}`] : []),
      ...this.registry
        .changed()
        .filter((v) => v.decl.scope !== 'view' && !(o.seed !== undefined && v.decl.name === 'seed'))
        .map((v) => `${v.decl.name} ${formatValue(v.value)}`),
    ].join('\n');
    this.current = new World({ seed: o.seed ?? Number(this.registry.value('seed')) });
    cartridge.onStart(this.world, this.registry);
    // World values that already came changed (from a recipe) are part of how it is born: step 0.
    this.registry.applyToWorld(this.world);
    // From now on, world changes go through here (if another session had this registry, it stops getting them).
    this.registry.scheduler = (line, apply) => this.scheduled.push({ line, apply });
  }

  /** Its world (another one, after `load`). */
  get world(): World {
    return this.current;
  }

  /**
   * What a player asks for, from now on: it enters at the start of the next step (like a world
   * change), and stays until it changes. Asking for the same again changes nothing, and is not kept.
   * Only what was declared enters (see input.ts): anything else is left out.
   */
  setInput(player: number, input: PlayerInput) {
    const next = normalizeInput(input, this.actions);
    const queue = this.pendingInputs.get(player) ?? [];
    const now = this.world.inputs.get(player) ?? NO_INPUT;
    const last = queue.at(-1);
    if (sameInput(next, last ?? now)) return;
    // What the world will have just before the last one that is waiting.
    const before = queue.at(-2) ?? now;
    // A PRESS MUST NOT BE LOST (stage 2a; a bug since 1b): a button pressed and released before a step
    // happened (a quick tap, a fast frame without a step) used to be replaced by its release, and the
    // jump never entered. If replacing the last one would drop a press that has not entered yet, the
    // new one waits its turn: one step with the press, the next one without it.
    const dropsAPress =
      last !== undefined && Object.keys(last).some((k) => isDown(last, k) && !isDown(before, k) && !isDown(next, k));
    if (last === undefined || dropsAPress) queue.push(next);
    else if (sameInput(next, before))
      queue.pop(); // back to what it was: nothing to change
    else queue[queue.length - 1] = next;
    if (queue.length) this.pendingInputs.set(player, queue);
    else this.pendingInputs.delete(player);
  }

  step() {
    const step = this.world.tick + 1;
    const scheduled = this.scheduled;
    this.scheduled = [];
    for (const s of scheduled) {
      s.apply(this.world);
      this.history.push({ step, line: s.line });
    }
    // One waiting input per player enters at each step.
    const entering = new Map<number, PlayerInput>();
    for (const [player, queue] of this.pendingInputs) {
      const input = queue.shift()!;
      entering.set(player, input);
      this.inputs.push({ step, player, input });
      if (!queue.length) this.pendingInputs.delete(player);
    }
    // On EVERY step, even if nobody changed anything: the world remembers the previous step's inputs.
    this.world.applyInputs(entering);
    this.world.step();
    this.cartridge.onStep?.(this.world, this.world.stepEvents);
  }

  /** This session's state, to send it: whoever receives it goes on from here (`saveOf`, then `load`). */
  state(): SessionState {
    return {
      birth: this.birth,
      world: this.world.snapshot(),
      history: copyData([...this.history]),
      inputs: copyData([...this.inputs]),
      values: [...this.registry.worldValues()],
    };
  }

  /** A save made of a state that came from elsewhere (nothing was waiting: the next step will bring it). */
  static saveOf(state: SessionState): SessionSave {
    return {
      world: state.world,
      history: copyData([...state.history]),
      inputs: copyData([...state.inputs]),
      values: new Map(state.values),
      scheduled: [],
      pendingInputs: new Map(),
    };
  }

  /** A save of this moment, to come back to it with `load`. */
  save(): SessionSave {
    return {
      world: this.world.snapshot(),
      history: [...this.history],
      inputs: [...this.inputs],
      values: this.registry.worldValues(),
      scheduled: [...this.scheduled],
      pendingInputs: new Map([...this.pendingInputs].map(([p, q]) => [p, [...q]])),
    };
  }

  /**
   * Back to a save of THIS session: its world comes back from the snapshot (a new one: the old one is
   * disposed), and the history, the inputs, the world values and what was waiting, as they were.
   * From there, the same inputs give the same hash as the first time.
   */
  load(save: SessionSave) {
    const old = this.current;
    this.current = World.restore(save.world);
    old.dispose();
    this.history.splice(0, this.history.length, ...save.history);
    this.inputs.splice(0, this.inputs.length, ...save.inputs);
    this.registry.restoreWorldValues(save.values);
    this.scheduled = [...save.scheduled];
    this.pendingInputs = new Map([...save.pendingInputs].map(([p, q]) => [p, [...q]]));
  }
}
