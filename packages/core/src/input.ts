import type { Vec3 } from '@manifold/common';
import type { InputValue, PlayerInput } from './types';
import type { World } from './world';

/**
 * WHAT A PLAYER CAN ASK FOR (stage 1d): actions with a name and a kind, declared by the core (what
 * the character reads) and by each game (its own buttons). The session accepts only what was
 * declared, so a replay or a message from the network cannot bring anything else.
 */
export interface InputAction {
  /** The core's (`move`, `jump`…) or a game's, with its namespace (`dojo.throw`). */
  name: string;
  /** `button`: held or not; `axis`: an amount from −1 to 1; `vector`: three numbers. */
  kind: 'button' | 'axis' | 'vector';
  description: string;
}

/** What the character system reads (stages 1b and 1c2): every game has them. */
export const CHARACTER_ACTIONS: readonly InputAction[] = [
  { name: 'move', kind: 'vector', description: 'where to go, in the world (length up to 1)' },
  { name: 'ahead', kind: 'axis', description: 'forward (+) or back (−), where the character looks' },
  { name: 'side', kind: 'axis', description: 'to its right (+) or left (−), without turning' },
  { name: 'turn', kind: 'axis', description: 'turning on its own axis: to the right (+) or the left (−)' },
  { name: 'face', kind: 'vector', description: 'where to look, if it is given' },
  { name: 'jump', kind: 'button', description: 'jumping' },
  { name: 'run', kind: 'button', description: 'running' },
];

/** The actions of a game: the core's, then its own. Its own need a namespace, and cannot repeat a name. */
export function actionsFor(own: readonly InputAction[] = []): readonly InputAction[] {
  const names = new Set(CHARACTER_ACTIONS.map((a) => a.name));
  for (const a of own) {
    if (!/^[a-z][a-z0-9]*\.[a-z][a-z0-9.]*$/.test(a.name))
      throw new Error(`The action "${a.name}" needs its game's namespace, like "dojo.throw".`);
    if (names.has(a.name)) throw new Error(`The action "${a.name}" is declared twice.`);
    names.add(a.name);
  }
  return [...CHARACTER_ACTIONS, ...own];
}

/** A vector the player asks for, or zero. */
export const vectorOf = (input: PlayerInput, name: string): Vec3 => {
  const v = input[name];
  return Array.isArray(v) ? v : [0, 0, 0];
};
/** An axis the player asks for, or zero. */
export const axisOf = (input: PlayerInput, name: string): number => {
  const v = input[name];
  return typeof v === 'number' ? v : 0;
};
/** Whether a button is held. */
export const isDown = (input: PlayerInput, name: string): boolean => input[name] === true;

/** What a player who asks for nothing asks for. */
export const NO_INPUT: PlayerInput = Object.freeze({});

/**
 * Whether a button was PRESSED at this step: held now, and not at the step before. (Holding it is
 * not pressing it again: a jump, a throw, a shot happen once per press.)
 */
export function pressed(world: World, player: number, name: string): boolean {
  return isDown(world.inputs.get(player) ?? NO_INPUT, name) && !isDown(world.lastInputs.get(player) ?? NO_INPUT, name);
}

const hundredth = (x: number) =>
  // `|| 0`: a little negative number rounds to −0, which is written "0" and read back as +0; the two
  // have different bits, so a replay of it gave another hash (stage 1c2). Here it is +0 from the start.
  // Something that is not a number (NaN, infinity) is zero: it cannot enter the world.
  Number.isFinite(x) ? Math.round(x * 100) / 100 || 0 : 0;

/**
 * An input as it enters the world and travels (in a replay, in a link, over the network): only the
 * declared actions, its numbers rounded to hundredths (axes from −1 to 1), and only what is not zero
 * or not held. Small, comparable, and without the noise of a camera that turns a little every frame.
 * In the declared order: so it is written the same way every time.
 */
export function normalizeInput(input: PlayerInput, actions: readonly InputAction[]): PlayerInput {
  const out: Record<string, InputValue> = {};
  for (const a of actions) {
    const v = input[a.name];
    if (a.kind === 'button') {
      if (v === true) out[a.name] = true;
    } else if (a.kind === 'axis') {
      const x = typeof v === 'number' ? hundredth(Math.max(-1, Math.min(1, v))) : 0;
      if (x !== 0) out[a.name] = x;
    } else if (Array.isArray(v) && v.length === 3) {
      const x: Vec3 = [hundredth(v[0]), hundredth(v[1]), hundredth(v[2])];
      if (x.some((n) => n !== 0)) out[a.name] = x;
    }
  }
  return out;
}

const sameValue = (a: InputValue | undefined, b: InputValue | undefined) =>
  Array.isArray(a) && Array.isArray(b) ? a.every((x, i) => x === b[i]) : a === b;

/** Whether two normalized inputs ask for the same. */
export function sameInput(a: PlayerInput, b: PlayerInput): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => sameValue(a[k], b[k]));
}

/** Why an input does not fit the declared actions (a name nobody declared, a value of another kind), or null. */
export function inputProblem(input: PlayerInput, actions: readonly InputAction[]): string | null {
  for (const [name, value] of Object.entries(input)) {
    const a = actions.find((x) => x.name === name);
    if (!a) return `"${name}" is not something a player can ask for here`;
    const kind = value === true ? 'button' : typeof value === 'number' ? 'axis' : Array.isArray(value) ? 'vector' : '?';
    if (kind !== a.kind) return `"${name}" is a ${a.kind}, and it came as a ${kind}`;
  }
  return null;
}
