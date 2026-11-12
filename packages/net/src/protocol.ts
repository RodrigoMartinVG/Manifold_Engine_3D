import type { Level } from '@manifold/commands';
import type { PlayerInput, SessionState } from '@manifold/core';

/**
 * WHAT TRAVELS between a client and the server (stage 1e). Plain data, so any transport can carry it:
 * a function call in the same page, a channel between tabs, later a socket.
 *
 * The idea: the server keeps THE match, and decides at which step each thing enters. On every step it
 * tells everybody what entered (a "tick"). Every client simulates its own copy with exactly that; being
 * deterministic, it gets the same world. Every few steps the tick brings the server's hash, and each
 * client checks that it has the same one. A different one is a bug (a desync), not latency.
 */

/** What a client says to the server. */
export type ToServer =
  /** I am here: the server answers with a `welcome`, and the match gets a new player. */
  | { type: 'hello' }
  /** What my player asks for, from now on (only when it changes). */
  | { type: 'input'; input: PlayerInput }
  /** A world change typed in my console (a world value, or a world action). */
  | { type: 'change'; line: string }
  /** The match starts over, born with this recipe (a startup value changed, or `restart`). */
  | { type: 'restart'; birth: string }
  /** Save this moment, or go back to it. */
  | { type: 'snapshot'; action: 'save' | 'load' }
  /** Play this replay (its text): the match starts over like it, and its inputs are the players'. */
  | { type: 'play'; replay: string }
  /** Stop the replay: the players drive again. */
  | { type: 'stop' };

/** A step, as the server tells it: what entered at it, and maybe its hash. */
export interface Tick {
  type: 'tick';
  step: number;
  inputs: [player: number, input: PlayerInput][];
  changes: string[];
  /** The world's hash at the end of this step (every `hashEvery` steps). */
  hash?: number;
}

/** What the server says to a client. */
export type ToClient =
  /** Here is the match, and you are this player. Also after a restart, a snapshot load or a replay. */
  | { type: 'welcome'; player: number; game: string; version: number; match: Match }
  | Tick
  /** Something for the console of whoever asked. */
  | { type: 'say'; text: string; level: Level };

/** A match as it is sent: how it was born, and where it is, if it is not at its birth. */
export interface Match {
  birth: string;
  /** If it is not at step 0: the whole session (its world and its history), to go on from there. */
  session?: SessionState;
  /** If a replay is playing: its last step and hash, so each client can check its world at the end. */
  replay?: { step: number; hash: number };
}
