import { splitLines } from '@manifold/commands';
import type { Cartridge } from './cartridge';
import { stateHash } from './hash';
import { actionsFor, inputProblem } from './input';
import { registryFor, Session, type InputChange, type WorldChange } from './session';
import type { InputValue } from './types';
import { SIMULATION_VERSION } from './version';

/**
 * A REPLAY (stage 1c): everything needed to play a session again, step by step, and to check that it
 * gave exactly the same.
 *
 *   - how the world was born (a recipe: its startup and world values);
 *   - what each player asked for, and at which step (only the changes);
 *   - the world changes typed in the console, and at which step;
 *   - the last step and its hash: playing it again must end with the same hash.
 *
 * Not the world itself: being deterministic, the same start and the same inputs are enough. That is
 * why it is small, and fits in a link.
 */
export interface Replay {
  /** The cartridge it belongs to ("dojo"). */
  game: string;
  birth: string;
  inputs: InputChange[];
  changes: WorldChange[];
  end: { step: number; hash: number };
}

/** The replay of a session, from its birth up to now. */
export function replayOf(session: Session): Replay {
  return {
    game: session.cartridge.id,
    birth: session.birth,
    inputs: session.inputs.map((i) => ({ ...i, input: { ...i.input } })),
    changes: session.history.map((c) => ({ ...c })),
    end: { step: session.world.tick, hash: stateHash(session.world) },
  };
}

const HEADER = '# Manifold replay';
const hex = (n: number) => n.toString(16).padStart(8, '0');

/**
 * What a player asked for, as words: each action by its name, with its numbers (none for a button,
 * one for an axis, three for a vector). Only what is not zero: `input 41 1` is "nothing".
 */
function inputText(i: InputChange): string {
  const parts = [`input ${i.step} ${i.player}`];
  for (const [name, value] of Object.entries(i.input)) {
    if (value === true) parts.push(name);
    else if (typeof value === 'number') parts.push(`${name} ${value}`);
    else if (Array.isArray(value)) parts.push(`${name} ${value.join(' ')}`);
  }
  return parts.join(' ');
}

/**
 * As text, one thing per line, in step order: it can be read, and compared by eye.
 *
 *   # Manifold replay 3                     the simulation's version (version.ts)
 *   game dojo
 *   birth dojo.level course
 *   input 41 1 move 0 0 -1                  step, player, and each action that is not zero, by
 *   input 96 1 ahead 1 turn -1 jump           its name: a vector (three numbers), an axis (one),
 *   input 130 1 dojo.throw                    a button (none)
 *   change 120 dojo.spawn 0 5 0       step, and the line typed in the console
 *   end 600 1a2b3c4d                  the last step, and its hash
 */
export function replayToText(r: Replay): string {
  const lines = [`${HEADER} ${SIMULATION_VERSION}`, `game ${r.game}`, ...splitLines(r.birth).map((l) => `birth ${l}`)];
  const events: [step: number, line: string][] = [
    ...r.changes.map((c): [number, string] => [c.step, `change ${c.step} ${c.line}`]),
    ...r.inputs.map((i): [number, string] => [i.step, inputText(i)]),
  ];
  // By step; at the same step, the changes first (the session applies them first). Stable otherwise.
  events.sort((a, b) => a[0] - b[0] || Number(b[1].startsWith('change')) - Number(a[1].startsWith('change')));
  lines.push(...events.map((e) => e[1]), `end ${r.end.step} ${hex(r.end.hash)}`);
  return lines.join('\n') + '\n';
}

/** Back from text. A line that is not understood is an error, with its number. */
export function replayFromText(text: string): Replay {
  const replay: Replay = { game: '', birth: '', inputs: [], changes: [], end: { step: -1, hash: 0 } };
  const birth: string[] = [];
  const rows = text.split(/\r?\n/);
  const fail = (n: number, why: string): never => {
    throw new Error(`replay, line ${n + 1}: ${why}`);
  };
  const header = /^# Manifold replay(?: (\d+))?$/.exec(rows[0]?.trim() ?? '');
  if (!header) fail(0, `it must start with "${HEADER} ${SIMULATION_VERSION}"`);
  const version = header![1] ? Number(header![1]) : 1;
  if (version !== SIMULATION_VERSION)
    fail(
      0,
      `a replay of version ${version}, and this engine plays version ${SIMULATION_VERSION}: it was recorded by another engine`,
    );
  rows.forEach((row, n) => {
    const line = row.trim();
    if (!line || line.startsWith('#')) return;
    const [kind, ...rest] = line.split(/\s+/);
    const integer = (t: string | undefined) => (t !== undefined && /^\d+$/.test(t) ? Number(t) : fail(n, `"${t}" is not a step`));
    const number = (t: string | undefined) => {
      const x = Number(t);
      return t !== undefined && t !== '' && Number.isFinite(x) ? x : fail(n, `"${t}" is not a number`);
    };
    switch (kind) {
      case 'game':
        replay.game = rest.join(' ');
        break;
      case 'birth':
        birth.push(line.slice('birth'.length).trim());
        break;
      case 'change':
        replay.changes.push({ step: integer(rest[0]), line: line.replace(/^change\s+\d+\s+/, '') });
        break;
      case 'input': {
        // Each name, followed by its numbers: none (a button), one (an axis) or three (a vector).
        const input: Record<string, InputValue> = {};
        let at = 2;
        while (at < rest.length) {
          const name = rest[at++]!;
          if (!/^[a-z][a-z0-9.]*$/.test(name)) fail(n, `"${name}" is not the name of an action`);
          const values: number[] = [];
          while (at < rest.length && !/^[a-z]/.test(rest[at]!)) values.push(number(rest[at++]));
          if (values.length === 0) input[name] = true;
          else if (values.length === 1) input[name] = values[0]!;
          else if (values.length === 3) input[name] = [values[0]!, values[1]!, values[2]!];
          else fail(n, `"${name}" has ${values.length} numbers: an action has none, one or three`);
        }
        replay.inputs.push({ step: integer(rest[0]), player: integer(rest[1]), input });
        break;
      }
      case 'end':
        replay.end = {
          step: integer(rest[0]),
          hash: /^[0-9a-f]{8}$/.test(rest[1] ?? '') ? parseInt(rest[1]!, 16) : fail(n, 'the hash has 8 hexadecimal digits'),
        };
        break;
      default:
        fail(n, `"${kind}" is not understood`);
    }
  });
  if (replay.end.step < 0) fail(rows.length - 1, 'it has no end');
  replay.birth = birth.join('\n');
  return replay;
}

/**
 * PLAYING A REPLAY on a session born like the recorded one: before each step, `feed` gives it what
 * entered at that step (the changes, through the registry as if they were typed; the inputs, through
 * the session). Whoever plays it does not send the live player's inputs meanwhile.
 */
export class ReplayPlayer {
  private nextInput = 0;
  private nextChange = 0;

  constructor(readonly replay: Replay) {}

  feed(session: Session) {
    const step = session.world.tick + 1;
    const { inputs, changes } = this.replay;
    while (this.nextChange < changes.length && changes[this.nextChange]!.step <= step) {
      const c = changes[this.nextChange++]!;
      if (c.step === step) session.registry.run(c.line, 'console');
    }
    while (this.nextInput < inputs.length && inputs[this.nextInput]!.step <= step) {
      const i = inputs[this.nextInput++]!;
      if (i.step === step) session.setInput(i.player, i.input);
    }
  }

  /** Whether the session reached the replay's last step. */
  finished(session: Session): boolean {
    return session.world.tick >= this.replay.end.step;
  }

  /** At the end: whether the world is exactly the recorded one (the same hash). */
  same(session: Session): boolean {
    return stateHash(session.world) === this.replay.end.hash;
  }
}

/**
 * A session born like the replay's (its recipe applied). The recipe's errors are thrown, and so is
 * an input this game does not declare: a replay must be understood whole.
 */
export function sessionFor(cartridge: Cartridge, replay: Replay): Session {
  if (replay.game && replay.game !== cartridge.id) throw new Error(`a replay of "${replay.game}", not of "${cartridge.id}"`);
  const actions = actionsFor(cartridge.inputs);
  for (const i of replay.inputs) {
    const problem = inputProblem(i.input, actions);
    if (problem) throw new Error(`replay, the input at step ${i.step}: ${problem}`);
  }
  const registry = registryFor(cartridge);
  const errors = registry.run(replay.birth, 'recipe').filter((m) => m.level === 'error');
  if (errors.length) throw new Error(`replay birth: ${errors.map((e) => e.text).join('; ')}`);
  return new Session(cartridge, { registry });
}

/** Plays a whole replay without a screen (tests, a server): the session at the end, and whether its hash matched. */
export function playReplay(cartridge: Cartridge, replay: Replay): { session: Session; same: boolean } {
  const session = sessionFor(cartridge, replay);
  const player = new ReplayPlayer(replay);
  while (!player.finished(session)) {
    player.feed(session);
    session.step();
  }
  return { session, same: player.same(session) };
}
