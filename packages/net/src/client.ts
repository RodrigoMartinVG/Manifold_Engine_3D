import type { Level, Registry } from '@manifold/commands';
import {
  normalizeInput,
  sameInput,
  Session,
  SIMULATION_VERSION,
  stateHash,
  type Cartridge,
  type PlayerInput,
  type World,
} from '@manifold/core';
import type { Channel } from './channel';
import type { Match, Tick, ToClient, ToServer } from './protocol';

export interface ClientHandlers {
  /** A session to show: at the start, after a restart, a snapshot load, a replay. The old one is already freed. */
  welcome(session: Session, match: Match): void;
  /** What the server says for this console. */
  say(text: string, level: Level): void;
  /** The server's hash at that step is not this world's: a desync (a bug, not latency). */
  desync?(step: number, mine: number, theirs: number): void;
}

/**
 * A CLIENT (stage 1e): this page's place in a match. It simulates ITS OWN COPY of the world with what
 * the server says entered at each step, and checks it with the server's hash every few steps. Being
 * deterministic, the copy is the same world; if it is not, `desync` says at which step.
 *
 * What it sends: what its player asks for (only when it changes), and the world changes typed in its
 * console. Those do not touch this copy right away: they go to the server, and come back in a tick,
 * at the step the server decided, like everybody else's. (In phase 6, with real latency, the player's
 * own character will be predicted, so as not to wait for that round trip.)
 */
export class Client {
  session: Session | null = null;
  player = 0;
  /** How many hash checks came out the same, and how many did not. */
  checks = 0;
  desyncs = 0;
  private queue: Tick[] = [];
  private applying = false;
  private lastSent: PlayerInput | null = null;

  constructor(
    readonly cartridge: Cartridge,
    /** The registry the session uses (the presentation's, with the console's and the view's). */
    readonly registry: Registry<World>,
    private readonly channel: Channel<ToServer, ToClient>,
    private readonly on: ClientHandlers,
  ) {
    channel.onMessage = (m) => this.receive(m);
  }

  /** Says hello: the server answers with the match, and this page becomes one of its players. */
  hello() {
    this.channel.send({ type: 'hello' });
  }

  /** What this page's player asks for now (sent only when it changes). */
  sendInput(input: PlayerInput) {
    if (!this.session) return;
    const next = normalizeInput(input, this.session.actions);
    if (this.lastSent && sameInput(next, this.lastSent)) return;
    this.lastSent = next;
    this.channel.send({ type: 'input', input: next });
  }

  /** Asks the server for something about the whole match. */
  request(m: Exclude<ToServer, { type: 'hello' | 'input' | 'change' }>) {
    this.channel.send(m);
  }

  /** How many steps came and are waiting to be simulated here. */
  get waiting(): number {
    return this.queue.length;
  }

  /**
   * Simulates what came, step by step, with exactly what entered at each one. `before` and `after`
   * run around each step (the presentation saves the poses to draw between two steps). Returns how
   * many steps it took.
   */
  drain(o: { before?(): void; after?(): void } = {}): number {
    let steps = 0;
    while (this.queue.length && this.session) {
      const tick = this.queue.shift()!;
      const session = this.session;
      for (const [player, input] of tick.inputs) session.setInput(player, input);
      // The changes, as if typed here, but scheduled in THIS copy (not sent back to the server).
      this.applying = true;
      for (const line of tick.changes) this.registry.run(line, 'console');
      this.applying = false;
      o.before?.();
      session.step();
      o.after?.();
      steps++;
      if (session.world.tick !== tick.step) {
        this.on.say(`step ${session.world.tick} here, ${tick.step} at the server: a step was lost`, 'error');
        this.queue = [];
        break;
      }
      if (tick.hash !== undefined) {
        const mine = stateHash(session.world);
        if (mine === tick.hash) this.checks++;
        else {
          this.desyncs++;
          this.on.desync?.(tick.step, mine, tick.hash);
        }
      }
    }
    return steps;
  }

  /** Leaves the match (the server says `players.leave`). */
  close() {
    this.channel.close();
  }

  private receive(m: ToClient) {
    if (m.type === 'tick') this.queue.push(m);
    else if (m.type === 'say') this.on.say(m.text, m.level);
    else if (m.type === 'welcome') {
      if (m.version !== SIMULATION_VERSION || m.game !== this.cartridge.id) {
        this.on.say(
          `a match of "${m.game}", version ${m.version}: this page is "${this.cartridge.id}", version ${SIMULATION_VERSION}`,
          'error',
        );
        return;
      }
      this.player = m.player;
      this.queue = [];
      this.lastSent = null;
      this.session?.world.dispose();
      this.session = this.build(m.match);
      this.on.welcome(this.session, m.match);
    }
  }

  /**
   * The match's session, here: the registry as the match was born (its defaults, then its birth; the
   * view's values stay), a session from there, and, if the match is not at its birth, its state.
   */
  private build(match: Match): Session {
    const registry = this.registry;
    const restart = registry.onStartupChange;
    registry.onStartupChange = null;
    registry.scheduler = null;
    registry.resetWorldValues();
    registry.run(match.birth, 'recipe');
    const session = new Session(this.cartridge, { registry });
    if (match.session) session.load(Session.saveOf(match.session));
    registry.onStartupChange = restart;
    // From now on, a world change typed here goes to the server; one that comes from it, to this copy.
    const local = registry.scheduler!;
    registry.scheduler = (line, apply) => (this.applying ? local(line, apply) : this.channel.send({ type: 'change', line }));
    return session;
  }
}
