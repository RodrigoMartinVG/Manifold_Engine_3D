import type { Registry } from '@manifold/commands';
import type { InputAction } from './input';
import type { Event } from './types';
import type { World } from './world';

/**
 * THE CONTRACT BETWEEN THE ENGINE AND A GAME (decision 0000: "mechanism and policy").
 *
 * The engine simulates; it does not know what is being played. A game (the Dojo is the first) is a
 * CARTRIDGE the engine receives: it says what is in the world at the start and what happenings
 * mean. The engine never imports a game (the compiler and the linter watch it: decision 0003).
 *
 * Stage 0: the minimum. It will grow with what games ask for (in V1 they needed: capabilities,
 * weapons, saving the game, travelling between levels, the ending, teams...), and every new thing
 * comes with its test and its tutorial lesson.
 */
export interface Cartridge {
  /** For addresses and replays: "dojo". */
  readonly id: string;
  readonly title: string;
  /**
   * Its variables and commands (decision 0010): what this game lets people change and do. Each
   * game decides what it exposes: the Dojo, everything; a competitive game, maybe nothing. Called
   * once per registry, before the world is created.
   */
  onDeclare?(registry: Registry<World>): void;
  /**
   * What its players can ask for, besides what the character reads (stage 1d): its own buttons, axes
   * and vectors, with its namespace (`dojo.throw`). The session lets in only what was declared; the
   * game reads them in `onStep` (`pressed`, `isDown`…), and says in the presentation which keys press them.
   */
  readonly inputs?: readonly InputAction[];
  /**
   * In a match (stage 1e): whether this player may change the world, from the console (world values
   * and actions, a restart, a snapshot, a replay). Without it, only player 1, who opened the match.
   * The Dojo, a lab, lets everybody. (Finer permissions: phase 6, decision 0010.)
   */
  mayChange?(player: number): boolean;
  /**
   * Once, with the freshly created world: put whatever there is at the start. STARTUP values (how
   * many cubes, which room) are read from the registry, which already has the recipes applied.
   */
  onStart(world: World, registry: Registry<World>): void;
  /** On every step, after the world advanced, with that step's events. */
  onStep?(world: World, events: readonly Event[]): void;
}
