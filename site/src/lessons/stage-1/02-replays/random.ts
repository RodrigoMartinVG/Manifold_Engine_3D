/**
 * A SEEDED random generator, the simplest there is: a "linear congruential" one.
 *
 *     state = (a · state + c) modulo 2³²
 *
 * Each number comes from the previous one with a multiplication and an addition. The same initial
 * state (the SEED) always gives the same sequence: it looks random, but it can be repeated.
 *
 * Subtlety: this one is very simple and its low bits repeat often (for a game it is enough; the
 * engine uses a better one, SFC32). And for cryptography, neither of them will do.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0; // `>>> 0`: an unsigned 32-bit integer
  return () => {
    // Math.imul multiplies like a 32-bit processor (a plain multiplication would go out of range).
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296; // between 0 and 1, like Math.random()
  };
}
