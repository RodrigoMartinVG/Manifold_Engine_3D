import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import {
  initPhysics,
  NO_INPUT,
  playReplay,
  registryFor,
  replayFromText,
  replayOf,
  replayToText,
  stateHash,
  type Cartridge,
  type PlayerInput,
} from '@manifold/core';
import { localPair, type Channel } from './channel';
import { Client } from './client';
import type { Match, ToClient, ToServer } from './protocol';
import { Server } from './server';

beforeAll(initPhysics);

/** A floor, boxes from the randomness, and a character for every player in the match. */
const Arena: Cartridge = {
  id: 'arena',
  title: 'Arena',
  onStart(world) {
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
    });
    for (let i = 0; i < 12; i++)
      world.createEntity({
        transform: {
          position: [world.random.between(-3, 3), world.random.between(1, 5), world.random.between(-3, 3)],
          rotation: quat.identity(),
        },
        body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] } },
      });
  },
  onStep(world) {
    for (const p of world.players)
      if (![...world.entities.values()].some((e) => e.character?.player === p))
        world.createEntity({
          transform: { position: [p * 1.5, 1, 4], rotation: quat.identity() },
          body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
          character: { player: p },
        });
  },
};
const OpenArena: Cartridge = { ...Arena, mayChange: () => true };

/** A client joined to a server, with what it heard. */
function join(server: Server, cartridge = Arena, o: { later?: boolean } = {}) {
  const pair = localPair<ToClient, ToServer>(o);
  server.connect(pair.a);
  const heard: string[] = [];
  const desyncs: number[] = [];
  const welcomes: Match[] = [];
  const client = new Client(cartridge, registryFor(cartridge), pair.b as Channel<ToServer, ToClient>, {
    welcome: (_, match) => welcomes.push(match),
    say: (text) => heard.push(text),
    desync: (step) => desyncs.push(step),
  });
  client.hello();
  pair.flush();
  return { client, pair, heard, desyncs, welcomes };
}

/** What player p asks for at a step: walking around, jumping now and then. */
const script = (p: number, step: number): PlayerInput =>
  step % 90 < 40 ? { move: [Math.sign(p - 1.5) * 0.6, 0, -0.8] as Vec3, jump: step % 90 === 20 } : NO_INPUT;

describe('the networking skeleton (stage 1e)', () => {
  test('playing alone through a server: the client simulates its own copy, and it is the same world', () => {
    const server = new Server(Arena);
    const { client, desyncs } = join(server);
    expect(client.player).toBe(1);
    for (let step = 1; step <= 300; step++) {
      client.sendInput(script(1, step));
      server.step();
      client.drain();
    }
    expect(stateHash(client.session!.world)).toBe(stateHash(server.world));
    expect(client.checks).toBe(5);
    expect(desyncs).toEqual([]);
    // The server said who came, at the first step; the game gave them a character.
    expect(client.session!.history[0]).toEqual({ step: 1, line: 'players.join 1' });
    expect([...client.session!.world.entities.values()].filter((e) => e.character)).toHaveLength(1);
    server.dispose();
  });

  test('two players, with lag: every copy is the server world at every check', () => {
    const server = new Server(Arena, { hashEvery: 30 });
    const a = join(server, Arena, { later: true });
    const b = join(server, Arena, { later: true });
    expect([a.client.player, b.client.player]).toEqual([1, 2]);
    for (let step = 1; step <= 400; step++) {
      a.client.sendInput(script(1, step));
      b.client.sendInput(script(2, step));
      server.step();
      // The messages arrive in bursts: every 3 steps for one, every 5 for the other.
      if (step % 3 === 0) a.pair.flush();
      if (step % 5 === 0) b.pair.flush();
      a.client.drain();
      b.client.drain();
    }
    a.pair.flush();
    b.pair.flush();
    a.client.drain();
    b.client.drain();
    for (const { client, desyncs } of [a, b]) {
      expect(client.session!.world.tick).toBe(server.world.tick);
      expect(stateHash(client.session!.world)).toBe(stateHash(server.world));
      expect(client.checks).toBe(13);
      expect(desyncs).toEqual([]);
    }
    expect([...server.world.entities.values()].filter((e) => e.character)).toHaveLength(2);
    server.dispose();
  });

  test('joining a match already started: its state, then its steps; and the replay starts at the birth', () => {
    const server = new Server(Arena, { birth: 'seed 9' });
    const a = join(server);
    for (let step = 1; step <= 150; step++) {
      a.client.sendInput(script(1, step));
      server.step();
      a.client.drain();
    }
    const b = join(server);
    expect(b.welcomes[0]!.session?.world.tick).toBe(150);
    expect(stateHash(b.client.session!.world)).toBe(stateHash(server.world));
    for (let step = 151; step <= 300; step++) {
      a.client.sendInput(script(1, step));
      b.client.sendInput(script(2, step));
      server.step();
      a.client.drain();
      b.client.drain();
    }
    expect(b.desyncs).toEqual([]);
    expect(b.client.checks).toBe(3);
    const replay = replayFromText(replayToText(replayOf(b.client.session!)));
    expect(replay.birth).toBe('seed 9');
    expect(playReplay(Arena, replay).same).toBe(true);
    server.dispose();
  });

  test('who changes the world: by default only player 1; a game can let everybody; only world changes go', () => {
    const server = new Server(Arena);
    const a = join(server);
    const b = join(server);
    a.client.registry.run('physics.gravity 0 -3 0');
    b.client.registry.run('physics.gravity 0 -20 0');
    expect(b.heard).toContain('in this match, only its host changes the world');
    server.step();
    a.client.drain();
    b.client.drain();
    for (const w of [server.world, a.client.session!.world, b.client.session!.world])
      expect(w.gravity).toEqual({ kind: 'uniform', vector: [0, -3, 0] });
    // A startup value is not a world change (it restarts the match: that is `restart`).
    a.client.request({ type: 'change', line: 'seed 4' } as never);
    expect(a.heard.at(-1)).toMatch(/"seed 4" is not a world change/);
    server.dispose();

    const open = new Server(OpenArena);
    join(open, OpenArena);
    const c = join(open, OpenArena);
    c.client.registry.run('physics.gravity 0 -1 0');
    open.step();
    c.client.drain();
    expect(c.client.session!.world.gravity).toEqual({ kind: 'uniform', vector: [0, -1, 0] });
    open.dispose();
  });

  test('a desync is caught: a copy that differs says at which step', () => {
    const server = new Server(Arena);
    const { client, desyncs } = join(server);
    for (let step = 1; step <= 70; step++) {
      server.step();
      client.drain();
      // A bug, simulated: this copy draws one more random number than the server's. (Moving a box here
      // would not do: its pose is read back from the physics on every step, and the change is lost.)
      if (step === 70) client.session!.world.random.between(0, 1);
    }
    for (let step = 71; step <= 120; step++) {
      server.step();
      client.drain();
    }
    expect(desyncs).toEqual([120]);
    server.dispose();
  });

  test('leaving: the match gets a players.leave at its next step', () => {
    const server = new Server(Arena);
    const a = join(server);
    const b = join(server);
    server.step();
    a.client.drain();
    b.client.close();
    server.step();
    a.client.drain();
    expect(a.client.session!.history.at(-1)).toEqual({ step: 2, line: 'players.leave 2' });
    expect(server.world.players).toEqual(new Set([1]));
    server.dispose();
  });

  test('a snapshot and a replay, through the server: everybody goes back, everybody watches', () => {
    const server = new Server(Arena);
    const { client, heard } = join(server);
    for (let step = 1; step <= 100; step++) {
      client.sendInput(script(1, step));
      server.step();
      client.drain();
    }
    const at100 = stateHash(server.world);
    client.request({ type: 'snapshot', action: 'save' });
    expect(heard.at(-1)).toMatch(/^a snapshot at step 100/);
    for (let step = 101; step <= 160; step++) {
      server.step();
      client.drain();
    }
    client.request({ type: 'snapshot', action: 'load' });
    expect(heard.at(-1)).toMatch(/^back at step 100/);
    expect(stateHash(client.session!.world)).toBe(at100);
    // Now a replay of this match: the server plays it, the client follows, and gets to its hash.
    const text = replayToText(replayOf(client.session!));
    client.request({ type: 'play', replay: text });
    for (let step = 1; step <= 100; step++) {
      server.step();
      client.drain();
    }
    expect(client.session!.world.tick).toBe(100);
    expect(stateHash(client.session!.world)).toBe(at100);
    server.dispose();
  });
});
