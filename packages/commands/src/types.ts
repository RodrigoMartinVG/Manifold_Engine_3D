/**
 * THE PIECES OF THE REGISTRY (decision 0010).
 *
 * Every part of the system (the core, the presentation, each game) DECLARES what can be changed
 * or done: variables and commands. Nobody reads the address or the keyboard on their own. The
 * console, links, rooms and tests all use these declarations.
 *
 * The console's vocabulary is English, and fixed (decision 0011): like a programming language, it
 * is not translated, so a recipe works for anyone, anywhere.
 */

/**
 * What a variable touches, and so, what happens when it changes:
 * - `startup`: how the world is born (the seed, how many cubes). Changing it restarts the world.
 * - `world`: something in the running world (gravity, a spin). It enters at a given step, like a
 *   player's key press, and stays in the session's history: it does not break determinism.
 * - `view`: only what is seen (drawing the triangles, going slower). It does not touch the simulation.
 */
export type Scope = 'startup' | 'world' | 'view';

export type Vec3 = [number, number, number];
export type Value = number | boolean | string | Vec3;

/** The type of a value, with what is needed to validate it (and to explain it in the help). */
export type Type =
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'integer'; min?: number; max?: number }
  | { kind: 'boolean' }
  | { kind: 'vector' }
  | { kind: 'text' }
  | { kind: 'option'; options: readonly string[] }
  /** The rest of the line, as is (for `bind t toggle show.axes`). Only as the last argument. */
  | { kind: 'rest' };

/** A variable: a name, a typed value, and what to do when it changes. `W` is the world. */
export interface Variable<W = unknown> {
  /** Namespaced: `dojo.cubes`, `show.wireframe`. Lowercase letters, digits and `_`. */
  name: string;
  description: string;
  scope: Scope;
  type: Type;
  default: Value;
  /** For the view: what to do when it changes (right away). */
  onChange?(value: Value): void;
  /**
   * For the world: how it is applied to the world. Not called right away: the session calls it at
   * the start of the next step (and when the world is created, if the value is not the default).
   */
  onWorld?(world: W, value: Value): void;
}

export interface Argument {
  name: string;
  type: Type;
  optional?: boolean;
}

/** A command: an action with arguments (`restart`, `step 10`, `dojo.spawn 0 5 0`). */
export interface Command<W = unknown> {
  name: string;
  description: string;
  args?: readonly Argument[];
  /**
   * Whether a recipe (a link's, a room's, the startup one) can run it. By default NO: someone
   * else's link can only set variables and what is declared safe (decision 0010).
   */
  inRecipes?: boolean;
  /** If it is a world action: it is applied at a step, like world variables. */
  onWorld?(world: W, args: Value[]): void;
  /** If it is not a world action: it is done right away, and it can write to the console. */
  run?(args: Value[], out: Output): void;
}

export type Level = 'info' | 'warn' | 'error';

export interface Message {
  level: Level;
  text: string;
}

export interface Output {
  write(text: string, level?: Level): void;
}

/** Where a line comes from: typed in the console, or from a recipe (a link, a room, the startup one). */
export type Source = 'console' | 'recipe';
