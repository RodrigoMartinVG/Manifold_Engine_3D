import type { World } from './world';

const buffer = new DataView(new ArrayBuffer(8));

/**
 * THE STATE HASH of a world: a 32-bit number that sums up ALL its state (the clock, the random
 * generator and every number of every entity). Two worlds with the same hash are, almost surely,
 * in the same state; with different hashes, surely not.
 *
 * It is for determinism: instead of comparing thousands of numbers by hand, one hash per step is
 * compared, and if two simulations drift apart, we know AT WHICH STEP (decision 0000, from the
 * strategic evaluation).
 *
 * It is FNV-1a over the BYTES of every number (as `Float64`): so 0.1 + 0.2 and 0.3 give different
 * hashes, as they must. It visits the entities in id order and their components in a fixed key
 * order.
 */
export function stateHash(world: World): number {
  let h = 0x811c9dc5;
  const byte = (b: number) => {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const number = (n: number) => {
    buffer.setFloat64(0, n);
    for (let i = 0; i < 8; i++) byte(buffer.getUint8(i));
  };
  const text = (t: string) => {
    for (let i = 0; i < t.length; i++) number(t.charCodeAt(i));
  };
  const value = (v: unknown): void => {
    if (typeof v === 'number') number(v);
    else if (typeof v === 'string') text(v);
    else if (typeof v === 'boolean') byte(v ? 1 : 0);
    else if (Array.isArray(v)) {
      number(v.length);
      for (const x of v) value(x);
    } else if (v && typeof v === 'object') {
      for (const key of Object.keys(v).sort()) {
        text(key);
        value((v as Record<string, unknown>)[key]);
      }
    } else byte(0);
  };
  number(world.tick);
  for (const n of world.random.state) number(n);
  const ids = [...world.entities.keys()].sort((a, b) => a - b);
  for (const id of ids) value(world.entities.get(id));
  return h >>> 0;
}
