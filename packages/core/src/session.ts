import { Registry } from '@manifold/commands';
import type { Cartridge } from './cartridge';
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
  private scheduled: { line: string; apply: (world: World) => void }[] = [];

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

  step() {
    const step = this.world.tick + 1;
    const scheduled = this.scheduled;
    this.scheduled = [];
    for (const s of scheduled) {
      s.apply(this.world);
      this.history.push({ step, line: s.line });
    }
    this.world.step();
    this.cartridge.onStep?.(this.world, this.world.stepEvents);
  }
}
