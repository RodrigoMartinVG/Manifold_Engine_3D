import type { Level } from '@manifold/commands';
import {
  Clock,
  registryFor,
  replayFromText,
  ReplayPlayer,
  Session,
  sessionFor,
  SIMULATION_VERSION,
  stateHash,
  type Cartridge,
  type SessionSave,
  type World,
} from '@manifold/core';
import type { Channel } from './channel';
import type { Match, Tick, ToClient, ToServer } from './protocol';

export interface ServerOptions {
  /** How the match is born: a recipe with its startup and world values. */
  birth?: string;
  /** Every how many steps the ticks bring the hash, so each client checks its world (60: once per second). */
  hashEvery?: number;
  /** A clock in milliseconds, for saying how long a snapshot took (the page gives `performance.now`). */
  now?: () => number;
}

interface Connection {
  readonly channel: Channel<ToClient, ToServer>;
  /** Its player number, once it said hello. */
  player: number | null;
}

const hex = (n: number) => n.toString(16).padStart(8, '0');

/**
 * THE SERVER (stage 1e): it keeps THE match, the one that counts. It has no screen and no transport of
 * its own: it lives in the page that plays alone, in the tab that opens a match to others, and (phase
 * 6) on a machine of its own.
 *
 * - Each connection that says hello becomes a player (the lowest number free), and the match gets a
 *   `players.join` at its next step. When it leaves, a `players.leave`.
 * - What a player asks for enters at the next step, like in a session (it is a session).
 * - A world change from a player's console enters if the game lets that player change the world
 *   (`mayChange`; without it, only player 1), and if it is one: a world value or a world action.
 * - On every step, everybody receives a tick: what entered at that step, and every `hashEvery` steps
 *   the hash, to check that their copies are the same world.
 * - Restarting, going back to a snapshot or playing a replay make a new session: everybody gets a
 *   new `welcome` with it.
 */
export class Server {
  private session: Session;
  private readonly connections = new Set<Connection>();
  private playback: ReplayPlayer | null = null;
  private saved: SessionSave | null = null;
  private readonly clock = new Clock();
  readonly hashEvery: number;
  private readonly now: () => number;

  constructor(
    readonly cartridge: Cartridge,
    o: ServerOptions = {},
  ) {
    this.hashEvery = o.hashEvery ?? 60;
    this.now = o.now ?? Date.now;
    this.session = this.born(o.birth ?? '');
  }

  /** The match's world (the presentation draws its own copy, the client's: this one is for tests and checks). */
  get world(): World {
    return this.session.world;
  }

  /** How far its clock is between two steps (the page that hosts it draws by it). */
  get alpha(): number {
    return this.clock.alpha;
  }

  /** The players connected now. */
  get players(): number[] {
    return [...this.connections].flatMap((c) => (c.player === null ? [] : [c.player])).sort((a, b) => a - b);
  }

  /** A new connection: it becomes a player when it says hello. */
  connect(channel: Channel<ToClient, ToServer>) {
    const c: Connection = { channel, player: null };
    this.connections.add(c);
    channel.onMessage = (m) => this.receive(c, m);
    channel.onClose = () => this.drop(c);
  }

  /** The steps its clock says are due after `dt` seconds (at most 5: see Clock); returns how many. */
  advance(dt: number): number {
    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) this.step();
    return steps;
  }

  /** One step of the match, and its tick to everybody. */
  step() {
    this.playback?.feed(this.session);
    this.session.step();
    const step = this.session.world.tick;
    const tick: Tick = { type: 'tick', step, inputs: [], changes: [] };
    // What entered at this step is at the end of the session's history (it only grows).
    for (let i = this.session.inputs.length - 1; i >= 0 && this.session.inputs[i]!.step === step; i--)
      tick.inputs.unshift([this.session.inputs[i]!.player, this.session.inputs[i]!.input]);
    for (let i = this.session.history.length - 1; i >= 0 && this.session.history[i]!.step === step; i--)
      tick.changes.unshift(this.session.history[i]!.line);
    if (step % this.hashEvery === 0) tick.hash = stateHash(this.session.world);
    this.broadcast(tick);
    if (this.playback?.finished(this.session)) {
      this.playback = null;
      this.syncPlayers();
    }
  }

  /** Frees the match's world. */
  dispose() {
    this.session.world.dispose();
    for (const c of this.connections) c.channel.close();
    this.connections.clear();
  }

  // ---------------------------------------------------------------- what comes from the players

  private receive(c: Connection, m: ToServer) {
    if (m.type === 'hello') return this.hello(c);
    const player = c.player;
    if (player === null) return;
    const may = this.cartridge.mayChange ? this.cartridge.mayChange(player) : player === 1;
    const refuse = () => this.say(c, 'in this match, only its host changes the world', 'warn');
    switch (m.type) {
      case 'input':
        if (!this.playback) this.session.setInput(player, m.input);
        return;
      case 'change': {
        if (!may) return refuse();
        if (!this.session.registry.isWorldChange(m.line))
          return this.say(c, `"${m.line}" is not a world change: only those go to the server`, 'warn');
        for (const e of this.session.registry.run(m.line, 'console')) if (e.level !== 'info') this.say(c, e.text, e.level);
        return;
      }
      case 'restart':
        if (!may) return refuse();
        this.replace(this.born(m.birth));
        return;
      case 'snapshot':
        if (!may) return refuse();
        return this.snapshot(c, m.action);
      case 'play':
        if (!may) return refuse();
        return this.play(c, m.replay);
      case 'stop':
        if (!may) return refuse();
        if (!this.playback) return this.say(c, 'no replay is playing');
        this.playback = null;
        this.syncPlayers();
        this.say(c, 'stopped: the control is yours');
        return;
    }
  }

  private hello(c: Connection) {
    if (c.player !== null) return;
    const taken = new Set(this.players);
    let player = 1;
    while (taken.has(player)) player++;
    c.player = player;
    this.welcome(c);
    this.syncPlayers();
  }

  private drop(c: Connection) {
    this.connections.delete(c);
    this.syncPlayers();
  }

  // ---------------------------------------------------------------- the match

  private born(birth: string): Session {
    const registry = registryFor(this.cartridge);
    registry.run(birth, 'recipe');
    return new Session(this.cartridge, { registry });
  }

  /** Another session (a restart, a replay): the old one is freed, and everybody is welcomed to the new one. */
  private replace(session: Session, playback: ReplayPlayer | null = null, replay?: Match['replay']) {
    this.session.world.dispose();
    this.session = session;
    this.saved = null;
    // (Before welcoming and syncing the players: a replay's world must not get any `players.join`.)
    this.playback = playback;
    for (const c of this.connections) if (c.player !== null) this.welcome(c, replay);
    this.syncPlayers();
  }

  /**
   * Who is in the world, as who is connected: a `players.join` for whoever came, a `players.leave` for
   * whoever left (at the next step). Not while a replay plays: its world is the recorded one.
   */
  private syncPlayers() {
    if (this.playback) return;
    const connected = new Set(this.players);
    const world = this.session.world;
    for (const p of connected) if (!world.players.has(p)) this.session.registry.run(`players.join ${p}`);
    for (const p of world.players) if (!connected.has(p)) this.session.registry.run(`players.leave ${p}`);
  }

  private welcome(c: Connection, replay?: Match['replay']) {
    const s = this.session;
    const atBirth = s.world.tick === 0;
    const match: Match = { birth: s.birth, ...(atBirth ? {} : { session: s.state() }), ...(replay ? { replay } : {}) };
    c.channel.send({ type: 'welcome', player: c.player!, game: this.cartridge.id, version: SIMULATION_VERSION, match });
  }

  private snapshot(c: Connection, action: 'save' | 'load') {
    const hash = () => hex(stateHash(this.session.world));
    if (action === 'save') {
      const start = this.now();
      this.saved = this.session.save();
      const ms = this.now() - start;
      const kb = (bytes: number) => (bytes / 1024).toFixed(1);
      const entities = JSON.stringify(this.saved.world.entities).length;
      this.say(
        c,
        `a snapshot at step ${this.session.world.tick} · hash ${hash()} · ${kb(this.saved.world.physics.length)} KB of physics and about ${kb(entities)} KB of entities · in ${ms.toFixed(2)} ms. \`snapshot load\` comes back here.`,
      );
      return;
    }
    if (!this.saved) return this.say(c, 'there is no snapshot of this match: `snapshot` takes one', 'warn');
    if (this.playback) return this.say(c, 'a replay is playing: `replay stop` first', 'warn');
    const start = this.now();
    this.session.load(this.saved);
    const ms = this.now() - start;
    for (const other of this.connections) if (other.player !== null) this.welcome(other);
    this.syncPlayers();
    this.say(c, `back at step ${this.session.world.tick} · hash ${hash()} · in ${ms.toFixed(2)} ms`);
  }

  private play(c: Connection, text: string) {
    let session: Session;
    let replay;
    try {
      replay = replayFromText(text);
      session = sessionFor(this.cartridge, replay);
    } catch (e) {
      return this.say(c, `the replay: ${(e as Error).message}`, 'warn');
    }
    this.replace(session, new ReplayPlayer(replay), { step: replay.end.step, hash: replay.end.hash });
  }

  private say(c: Connection, text: string, level: Level = 'info') {
    c.channel.send({ type: 'say', text, level });
  }

  private broadcast(m: ToClient) {
    for (const c of this.connections) if (c.player !== null) c.channel.send(m);
  }
}
