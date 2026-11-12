import type { World } from './world';

// One number is written as 8 bytes (little-endian, explicitly: the same bytes on every machine) and
// read back as bytes, in one go.
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
const bytes = new Uint8Array(buffer);
/** The hash of every text (key names and values like 'dynamic'), computed once: they repeat in every entity. */
const textHashes = new Map<string, number>();

/**
 * THE STATE HASH of a world: a 32-bit number that sums up ALL its state (the clock, the random
 * generator, the gravity and every number of every entity, the bodies' poses and velocities
 * included). Two worlds with the same hash are, almost surely, in the same state; with different
 * hashes, surely not.
 *
 * It is for determinism: instead of comparing thousands of numbers by hand, one hash per step is
 * compared, and if two simulations drift apart, we know AT WHICH STEP (decision 0000, from the
 * strategic evaluation).
 *
 * It is FNV-1a over the BYTES of every number (as `Float64`): so 0.1 + 0.2 and 0.3 give different
 * hashes, as they must. It visits the entities in id order and their components in a fixed key
 * order.
 *
 * Its cost (stage 1a, measured on the development Mac): with 200 bodies, about 1.8 ms, three times a
 * physics step. It was 5.5 ms: it read every byte through a function call and walked every key name
 * letter by letter. What is left is the generic walk (sorting each component's keys); if replays need
 * the hash on every step, that is where to look.
 */
export function stateHash(world: World): number {
  let h = 0x811c9dc5;
  const byte = (b: number) => {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const number = (n: number) => {
    view.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193) >>> 0;
  };
  /** A text (a key name, or a value like 'dynamic'): its own hash, computed once, as one number. */
  const text = (t: string) => {
    let th = textHashes.get(t);
    if (th === undefined) {
      th = 0x811c9dc5;
      for (let i = 0; i < t.length; i++) th = Math.imul(th ^ t.charCodeAt(i), 0x01000193) >>> 0;
      textHashes.set(t, th);
    }
    number(th);
  };
  const value = (v: unknown): void => {
    if (typeof v === 'number') number(v);
    else if (typeof v === 'string') text(v);
    else if (typeof v === 'boolean') byte(v ? 1 : 0);
    else if (Array.isArray(v)) {
      number(v.length);
      for (const x of v) value(x);
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v).sort()) {
        text(k);
        value((v as Record<string, unknown>)[k]);
      }
    } else byte(0);
  };
  number(world.tick);
  // The id counter too (stage 1d): two worlds with the same entities but different counters give
  // their next entity a different id. It was left out until snapshots made it obvious.
  number(world.lastEntityId);
  for (const n of world.random.state) number(n);
  value(world.gravity);
  // Who is in the match (stage 1e).
  number(world.players.size);
  for (const player of [...world.players].sort((a, b) => a - b)) number(player);
  for (const inputs of [world.inputs, world.lastInputs]) {
    number(inputs.size); // so {1: x} now and {} before do not hash like {} now and {1: x} before
    for (const player of [...inputs.keys()].sort((a, b) => a - b)) {
      number(player);
      value(inputs.get(player));
    }
  }
  const ids = [...world.entities.keys()].sort((a, b) => a - b);
  for (const id of ids) value(world.entities.get(id));
  return h >>> 0;
}
