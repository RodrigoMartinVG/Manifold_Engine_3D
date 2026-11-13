import { quat, type Quat, type Vec3 } from '@manifold/common';
import type { World } from './world';

/**
 * LEVELS AS DATA (stage 2a; decision 0000, rule 4). A level is text, one thing per line, that can be
 * read, compared by eye and written by hand, by code or (later) by an editor or an importer from
 * Blender, which only have to produce this same text:
 *
 *   # Manifold level 1                        the format's version
 *   title The course
 *   spawn 0 1 6                               where a player starts (x y z)…
 *   facing 0 0 -1                             …and where it looks
 *   box -4 0.62 1.5  1 0.1 2.2  rotate x 18  color #6f6a62
 *                                             a fixed box: its center, half its sizes, a turn
 *                                             (around x, y or z, in degrees) and its color
 *   sensor goal  -3 4.4 -7  1 0.8 1           a zone: what it is for (the game's word), center, half sizes
 *
 * The turns are written in degrees, as a person thinks them, and become quaternions with our own sine
 * and cosine (`quat.fromDegrees`): the browser's would give other bits in another browser, and the
 * world must be born the same everywhere.
 */
export const LEVEL_FORMAT = 1;
const HEADER = '# Manifold level';

/** A turn around one of the axes, as it is written. */
export interface Turn {
  axis: 'x' | 'y' | 'z';
  degrees: number;
}

export interface LevelBox {
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
  color: number;
}

export interface LevelSensor {
  kind: string;
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
}

export interface Level {
  title: string;
  spawn: Vec3;
  facing: Vec3;
  boxes: LevelBox[];
  sensors: LevelSensor[];
}

const AXES: Record<Turn['axis'], Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** The quaternion of a turn (or no turn). */
export const turnOf = (turn: Turn | null): Quat => (turn ? quat.fromDegrees(AXES[turn.axis], turn.degrees) : quat.identity());

/** A level from its text. A line that is not understood is an error, with its number. */
export function levelFromText(text: string): Level {
  const level: Level = { title: '', spawn: [0, 1, 0], facing: [0, 0, -1], boxes: [], sensors: [] };
  const rows = text.split(/\r?\n/);
  const fail = (n: number, why: string): never => {
    throw new Error(`level, line ${n + 1}: ${why}`);
  };
  const header = /^# Manifold level (\d+)$/.exec(rows[0]?.trim() ?? '');
  if (!header) fail(0, `it must start with "${HEADER} ${LEVEL_FORMAT}"`);
  if (Number(header![1]) !== LEVEL_FORMAT) fail(0, `a level of format ${header![1]}: this engine reads format ${LEVEL_FORMAT}`);
  rows.forEach((row, n) => {
    // A comment is a whole line that starts with # (a color, like #6f6a62, is not one).
    const line = row.trim();
    if (!line || line.startsWith('#')) return;
    const words = line.split(/\s+/);
    const kind = words[0]!;
    let at = 1;
    const number = () => {
      const t = words[at++];
      const x = Number(t);
      return t !== undefined && t !== '' && Number.isFinite(x) ? x : fail(n, `"${t ?? ''}" is not a number`);
    };
    const vector = (): Vec3 => [number(), number(), number()];
    /** What may come at the end of a box or a zone: a turn, and (a box) a color. */
    const extras = (color: boolean) => {
      let turn: Turn | null = null;
      let paint = 0x6f6a62;
      while (at < words.length) {
        const word = words[at++];
        if (word === 'rotate') {
          const axis = words[at++];
          if (axis !== 'x' && axis !== 'y' && axis !== 'z') fail(n, `"${axis ?? ''}" is not an axis (x, y or z)`);
          turn = { axis: axis as Turn['axis'], degrees: number() };
        } else if (word === 'color' && color) {
          const hex = words[at++] ?? '';
          if (!/^#[0-9a-f]{6}$/i.test(hex)) fail(n, `"${hex}" is not a color (#rrggbb)`);
          paint = parseInt(hex.slice(1), 16);
        } else fail(n, `"${word}" is not understood here`);
      }
      return { turn, color: paint };
    };
    switch (kind) {
      case 'title':
        level.title = line.slice('title'.length).trim();
        at = words.length; // the title is the rest of the line
        break;
      case 'spawn':
        level.spawn = vector();
        break;
      case 'facing':
        level.facing = vector();
        break;
      case 'box': {
        const center = vector();
        const half = vector();
        const { turn, color } = extras(true);
        level.boxes.push({ center, half, turn, color });
        break;
      }
      case 'sensor': {
        const what = words[at++];
        if (!what || !/^[a-z][a-z0-9.-]*$/.test(what)) fail(n, 'a zone needs what it is for, in one word (checkpoint, goal…)');
        const center = vector();
        const half = vector();
        const { turn } = extras(false);
        level.sensors.push({ kind: what!, center, half, turn });
        break;
      }
      default:
        fail(n, `"${kind}" is not understood (title, spawn, facing, box, sensor)`);
    }
    if (at < words.length) fail(n, `"${words[at]}" is extra`);
  });
  return level;
}

const numbers = (v: Vec3) => v.join(' ');
const turnText = (turn: Turn | null) => (turn ? `  rotate ${turn.axis} ${turn.degrees}` : '');

/** A level as text (what `levelFromText` reads back the same). */
export function levelToText(level: Level): string {
  return (
    [
      `${HEADER} ${LEVEL_FORMAT}`,
      `title ${level.title}`,
      `spawn ${numbers(level.spawn)}`,
      `facing ${numbers(level.facing)}`,
      ...level.boxes.map(
        (b) => `box ${numbers(b.center)}  ${numbers(b.half)}${turnText(b.turn)}  color #${b.color.toString(16).padStart(6, '0')}`,
      ),
      ...level.sensors.map((s) => `sensor ${s.kind}  ${numbers(s.center)}  ${numbers(s.half)}${turnText(s.turn)}`),
    ].join('\n') + '\n'
  );
}

/**
 * Puts a level into a world: its boxes, as fixed bodies that are seen, and its zones, as sensors that
 * are not (`show.sensors` draws them). Where the players start is the game's to use (`level.spawn`).
 */
export function buildLevel(world: World, level: Level) {
  for (const b of level.boxes)
    world.createEntity({
      transform: { position: [...b.center], rotation: turnOf(b.turn) },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [...b.half] } },
      appearance: { shape: 'box', size: [b.half[0] * 2, b.half[1] * 2, b.half[2] * 2], color: b.color },
    });
  for (const s of level.sensors)
    world.createEntity({
      transform: { position: [...s.center], rotation: turnOf(s.turn) },
      sensor: { kind: s.kind, half: [...s.half] },
    });
}
