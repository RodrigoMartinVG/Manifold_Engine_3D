/**
 * SEEDED RANDOM NUMBERS.
 *
 * `Math.random()` gives another sequence on every run. For a simulation to be repeatable (the
 * same match, a shared experiment, the server and the client in agreement), all the randomness
 * that changes the world comes from a SEEDED generator: the same starting number always gives the
 * same sequence.
 *
 * This is SFC32 ("small fast counter", by Chris Doty-Humphrey): four 32-bit numbers of state,
 * mixed on every call with additions, shifts and rotations. It is fast, it passes the usual
 * statistical test batteries, and it is not for cryptography. One of its four numbers is a counter
 * that only grows by one: it guarantees the sequence does not fall into a short cycle.
 *
 * The seed (a single number) is spread into the four state numbers with SPLITMIX32, another small
 * generator that turns similar numbers (1, 2, 3...) into very different states.
 *
 * The state can be read and restored (`state`, `restore`): so a snapshot of the world includes
 * "where we were in the random sequence".
 */
export class Random {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    let s = seed >>> 0;
    const splitmix = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = splitmix();
    this.b = splitmix();
    this.c = splitmix();
    this.d = 1; // the counter
    // A few idle rounds: the first numbers of a freshly seeded state look alike.
    for (let i = 0; i < 12; i++) this.uint32();
  }

  /** An unsigned 32-bit integer. */
  uint32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** A number in [0, 1), like `Math.random()`. */
  next(): number {
    return this.uint32() / 4294967296;
  }

  /** A number in [min, max). */
  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** An element of the list, each one with the same probability. */
  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('Cannot pick from an empty list');
    return list[Math.floor(this.next() * list.length)] as T;
  }

  /** The state, to keep it in a snapshot of the world. */
  get state(): readonly [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  /** Go back to a saved state: the sequence continues from there. */
  restore(s: readonly [number, number, number, number]) {
    [this.a, this.b, this.c, this.d] = s;
  }
}
