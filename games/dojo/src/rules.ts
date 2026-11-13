import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  buildLevel,
  DEFAULT_MOVEMENT,
  pressed,
  STEP,
  upAt,
  type Cartridge,
  type Event,
  type Level,
  type Movement,
  type World,
} from '@manifold/core';

/** The big cube's spin at the start (a tilted axis: so it shows that it spins in 3D, not just "turns"). */
const START_SPIN: Vec3 = [0.35, 0.9, 0.15];

/** A color from the world's randomness (not too dark). */
const randomColor = (world: World) => Math.floor(world.random.between(0.25, 1) * 0xffffff) & 0xf0f0f0;

/**
 * A small cube with place, size, spin and color taken from THE WORLD'S RANDOMNESS (not Math.random).
 * It is a dynamic body: it falls, bounces and piles up (stage 1a).
 */
function randomCube(world: World) {
  const r = world.random;
  const side = r.between(0.2, 0.6);
  world.createEntity({
    transform: { position: [r.between(-6, 6), r.between(0.5, 4), r.between(-6, 6)], rotation: quat.identity() },
    body: {
      type: 'dynamic',
      shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
      angularVelocity: [r.between(-2, 2), r.between(-2, 2), r.between(-2, 2)],
    },
    appearance: { shape: 'box', size: [side, side, side], color: randomColor(world) },
  });
}

/** A copy of a movement's numbers. */
const copyMovement = (m: Movement): Movement => ({ walk: { ...m.walk }, air: { ...m.air }, jump: { ...m.jump }, turn: m.turn });

/** A character: a capsule 1.6 m tall, and its game data for the level's loop. */
function character(world: World, player: number, at: Vec3, facing: Vec3, color: number, movement?: Movement) {
  world.createEntity({
    transform: { position: [...at], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    // (A copy of the numbers it moves with, if given: each character has its own.)
    character: { player, facing: [...facing], ...(movement ? { movement: copyMovement(movement) } : {}) },
    appearance: { shape: 'capsule', size: [0.6, 1.6, 0.6], color },
    // Where it comes back after falling, when it started, when it reached the goal (−1: not yet), its falls.
    game: { spawn: [...at], checkpoint: [...at], start: world.tick, finish: -1, falls: 0 },
  });
}

/**
 * A LEVEL (stage 2a: from its file, `dojo.level <name>`): its boxes and its zones, and player 1's
 * character where the level says.
 */
function buildDojoLevel(world: World, level: Level) {
  buildLevel(world, level);
  character(world, 1, level.spawn, level.facing, 0x93d9c9);
}

/**
 * A LEVEL'S LOOP (stage 2a), with its zones: the engine says who came into which one, and what it
 * means is the Dojo's.
 * - `checkpoint`: a character comes back here from now on, if it falls;
 * - `fall` (the void under the floor): a character goes back to its checkpoint; a cube or a ball is gone;
 * - `goal`: the time it took (from when it started) and how many times it fell, once.
 * What it keeps lives in the character's `game` data: it is the world's, so it is hashed, it travels in
 * snapshots, and a replay plays it the same.
 */
function levelLoop(world: World, events: readonly Event[]) {
  const notice = (player: number, text: string) => world.emit({ type: 'notice', text, player });
  for (const ev of events) {
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const e = world.entities.get(ev.entity);
    if (!zone?.sensor || !zone.transform || !e) continue;
    const game = e.game;
    const player = e.character?.player;
    switch (zone.sensor.kind) {
      case 'fall':
        if (!e.character) world.removeEntity(e.id);
        else if (game && player !== undefined) {
          world.place(e, game.checkpoint as Vec3);
          game.falls = (game.falls as number) + 1;
          notice(player, 'you fell: back to the checkpoint');
        }
        break;
      case 'checkpoint':
        if (game && player !== undefined && !vec3.equals(game.checkpoint as Vec3, zone.transform.position)) {
          game.checkpoint = [...zone.transform.position];
          notice(player, 'checkpoint');
        }
        break;
      case 'goal':
        if (game && player !== undefined && (game.finish as number) < 0) {
          game.finish = world.tick;
          const seconds = (((game.finish as number) - (game.start as number)) * STEP).toFixed(2);
          const falls = game.falls as number;
          notice(player, `the goal: ${seconds} s, ${falls === 1 ? '1 fall' : `${falls} falls`}`);
        }
        break;
    }
  }
}

/** A ball at a place, with its size and color from the world's randomness: it falls from there. */
function ball(world: World, position: Vec3, velocity: Vec3 = [0, 0, 0]) {
  const diameter = world.random.between(0.3, 0.7);
  world.createEntity({
    transform: { position: [...position], rotation: quat.identity() },
    // A little angular damping: Rapier has no rolling resistance, and without it the ball would roll
    // until it fell off the floor's edge.
    body: {
      type: 'dynamic',
      shape: { kind: 'ball', radius: diameter / 2 },
      restitution: 0.5,
      angularDamping: 0.8,
      linearVelocity: [...velocity],
    },
    appearance: { shape: 'sphere', size: [diameter, diameter, diameter], color: randomColor(world) },
  });
}

/** Each player's color: the first one's is the course's; the others', from this list. */
const PLAYER_COLORS = [0x4a9fd8, 0xd86a4a, 0x7ac25a, 0xc25ab8, 0xd8c04a];

/**
 * In a level with characters (the course), every player who comes into the match (stage 1e:
 * `players.join`) gets one, next to the first one's; whoever leaves loses it. Player 1's belongs to
 * the level: it is there from the start, and it stays.
 */
function joinedPlayers(world: World) {
  const characters = [...world.entities.values()].filter((e) => e.character);
  const first = characters.find((e) => e.character!.player === 1);
  if (!first) return;
  // Next to where the first one started, each one 1.2 m further to the right.
  const spawn = (first.game?.spawn as Vec3 | undefined) ?? [0, 1, 6];
  for (const p of world.players)
    if (p !== 1 && !characters.some((e) => e.character!.player === p))
      character(
        world,
        p,
        [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]],
        first.character!.facing,
        PLAYER_COLORS[(p - 2) % PLAYER_COLORS.length]!,
        // It moves like the first one (whatever `dojo.air` and the rest made of it).
        first.character!.movement,
      );
  for (const e of characters) if (e.character!.player !== 1 && !world.players.has(e.character!.player)) world.removeEntity(e.id);
}

/**
 * THE DOJO'S CARTRIDGE: the first game, the engine's lab. A floor, a big cube that spins (a
 * kinematic body: it pushes what it touches), small cubes that fall from the world's randomness, and
 * balls on demand. It tests what matters: that a game, from OUTSIDE the engine, puts things in a
 * world that the simulation runs (with its physics) and the presentation draws.
 *
 * What the Dojo lets people change it DECLARES (decision 0010), each thing with its scope:
 * - `dojo.cubes` is STARTUP: how many cubes there are when the world is born (changing it restarts it);
 * - `dojo.spin` is WORLD: the big cube's spin, which changes at a given step;
 * - `dojo.spawn x y z` is a WORLD action: a ball that falls from there, at a given step.
 * - `dojo.throw` is a PLAYER's button (stage 1d): the character throws a ball forward. The core does
 *   not know it: the Dojo declares it, reads it on every step, and its page says which key presses it.
 * (And the engine's `seed` and `physics.gravity`, which the Dojo lets people touch too.)
 *
 * The Dojo's rules do not touch the screen (this file runs the same in tests): what is seen is
 * decided by `index.ts`.
 */
export function createDojo(levels: Readonly<Record<string, Level>>): Cartridge {
  return {
    id: 'dojo',
    title: 'Dojo',
    inputs: [{ name: 'dojo.throw', kind: 'button', description: 'the character throws a ball forward' }],
    // A lab: in a match, everybody may change the world (another game may let only its host).
    mayChange: () => true,

    onDeclare(registry) {
      registry.declareVariable({
        name: 'dojo.cubes',
        description:
          "Small cubes at the start, at places taken from the world's randomness: with the same seed, always the same ones.",
        scope: 'startup',
        type: { kind: 'integer', min: 0, max: 200 },
        default: 0,
      });
      registry.declareVariable({
        name: 'dojo.level',
        description:
          'What there is on the floor: `empty`, or a level from `games/dojo/levels/`, like `course`: a small classic level with a character to drive (WASD or the arrows, Space to jump, Shift to run), checkpoints and a goal.',
        scope: 'startup',
        type: { kind: 'option', options: ['empty', ...Object.keys(levels)] },
        default: 'empty',
      });
      registry.declareVariable({
        name: 'dojo.air',
        description:
          "How much a character can steer in the air, in m/s² (stage 2b). 14 is a platformer's; 0, none at all, like real physics (once in the air, there is nothing to push against); 50, as much as on the ground. It changes at a step, for every character.",
        scope: 'world',
        type: { kind: 'number', min: 0, max: 60 },
        default: DEFAULT_MOVEMENT.air.control,
        onWorld(world, value) {
          for (const e of world.entities.values()) if (e.character) e.character.movement.air.control = Number(value);
        },
      });
      registry.declareVariable({
        name: 'dojo.spin',
        description: 'How the big cube spins: radians per second around each axis (x y z).',
        scope: 'world',
        type: { kind: 'vector' },
        default: START_SPIN,
        onWorld(world, value) {
          // The big cube is the world's first entity (id 1): `onStart` creates it, before anything else.
          const cube = world.entities.get(1);
          if (cube?.spin) cube.spin.angularVelocity = [...(value as Vec3)];
        },
      });
      registry.declareCommand({
        name: 'dojo.spawn',
        description: "Drops a ball from (x, y, z), with its size and color taken from the world's randomness.",
        args: [{ name: 'x y z', type: { kind: 'vector' } }],
        onWorld(world, [place]) {
          ball(world, place as Vec3);
        },
      });
    },

    onStep(world, events) {
      joinedPlayers(world);
      levelLoop(world, events);
      // Each press throws one ball (held, it does not throw more): from the chest, forward and up a little.
      for (const e of world.entities.values()) {
        if (!e.character || !e.transform || !pressed(world, e.character.player, 'dojo.throw')) continue;
        const up = upAt(world, e.transform.position);
        const from = vec3.add(e.transform.position, vec3.add(vec3.scale(e.character.facing, 0.75), vec3.scale(up, 0.4)));
        ball(world, from, vec3.add(vec3.scale(e.character.facing, 9), vec3.scale(up, 2.5)));
      }
    },

    onStart(world, registry) {
      // The big cube goes first: it is entity 1, the one `dojo.spin` turns.
      world.createEntity({
        transform: { position: [0, 1, 0], rotation: quat.identity() },
        spin: { angularVelocity: [...START_SPIN] },
        body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
        appearance: { shape: 'box', size: [1, 1, 1], color: 0xe0a040 },
      });
      // The floor: a fixed body whose top is at y = 0, under the grid. It has no appearance: the grid is
      // what is seen.
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
      });
      const level = levels[String(registry.value('dojo.level'))];
      if (level) buildDojoLevel(world, level);
      const cubes = Number(registry.value('dojo.cubes'));
      for (let i = 0; i < cubes; i++) randomCube(world);
    },
  };
}
