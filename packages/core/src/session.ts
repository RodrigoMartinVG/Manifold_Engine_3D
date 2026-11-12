import { Registry } from '@manifold/commands';
import type { Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { NO_INPUT } from './character';
import { EARTH } from './gravity';
import type { PlayerInput } from './types';
import { World } from './world';

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
 * An input as it travels (in a replay, in a link, over the network): the movement rounded to
 * hundredths. Small, comparable, and without the noise of a camera that turns a little every frame.
 */
const quantize = (i: PlayerInput): PlayerInput => ({
  move: [Math.round(i.move[0] * 100) / 100, Math.round(i.move[1] * 100) / 100, Math.round(i.move[2] * 100) / 100],
  jump: i.jump,
  run: i.run,
});
const sameInput = (a: PlayerInput, b: PlayerInput) =>
  a.jump === b.jump && a.run === b.run && a.move.every((x, i) => x === b.move[i]);

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
  readonly world: World;
  readonly registry: Registry<World>;
  /** Every world change that entered, with the step at which it was applied. */
  readonly history: WorldChange[] = [];
  /** Every player input that entered (only when it changed), with the step at which it was applied. */
  readonly inputs: InputChange[] = [];
  private scheduled: { line: string; apply: (world: World) => void }[] = [];
  private pendingInputs = new Map<number, PlayerInput>();

  constructor(
    readonly cartridge: Cartridge,
    o: SessionOptions = {},
  ) {
    this.registry = o.registry ?? registryFor(cartridge);
    this.world = new World({ seed: o.seed ?? Number(this.registry.value('seed')) });
    cartridge.onStart(this.world, this.registry);
    // World values that already came changed (from a recipe) are part of how it is born: step 0.
    this.registry.applyToWorld(this.world);
    // From now on, world changes go through here (if another session had this registry, it stops getting them).
    this.registry.scheduler = (line, apply) => this.scheduled.push({ line, apply });
  }

  /**
   * What a player asks for, from now on: it enters at the start of the next step (like a world
   * change), and stays until it changes. Asking for the same again changes nothing, and is not kept.
   */
  setInput(player: number, input: PlayerInput) {
    const next = quantize(input);
    const current = this.pendingInputs.get(player) ?? this.world.inputs.get(player) ?? NO_INPUT;
    if (sameInput(next, current)) return;
    this.pendingInputs.set(player, next);
  }

  step() {
    const step = this.world.tick + 1;
    const scheduled = this.scheduled;
    this.scheduled = [];
    for (const s of scheduled) {
      s.apply(this.world);
      this.history.push({ step, line: s.line });
    }
    for (const [player, input] of this.pendingInputs) {
      this.world.inputs.set(player, input);
      this.inputs.push({ step, player, input });
    }
    this.pendingInputs.clear();
    this.world.step();
    this.cartridge.onStep?.(this.world, this.world.stepEvents);
  }
}
