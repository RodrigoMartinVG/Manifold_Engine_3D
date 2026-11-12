import { describe, expect, test } from 'vitest';
import { Random } from './random';

describe('seeded random', () => {
  test('the same seed gives the same sequence; another seed, another one', () => {
    const a = new Random(42);
    const b = new Random(42);
    const c = new Random(43);
    const sa = Array.from({ length: 100 }, () => a.uint32());
    const sb = Array.from({ length: 100 }, () => b.uint32());
    const sc = Array.from({ length: 100 }, () => c.uint32());
    expect(sb).toEqual(sa);
    expect(sc).not.toEqual(sa);
  });

  test('neighbouring seeds (1, 2, 3) give sequences that do not look alike', () => {
    const firsts = [1, 2, 3].map((s) => new Random(s).next());
    // If the seed were spread badly, the three first numbers would be almost equal.
    expect(Math.abs(firsts[0]! - firsts[1]!)).toBeGreaterThan(0.01);
    expect(Math.abs(firsts[1]! - firsts[2]!)).toBeGreaterThan(0.01);
  });

  test('spreads evenly: 100,000 numbers in 10 buckets, each with its 10 % (±0.5 %)', () => {
    const random = new Random(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[Math.floor(random.next() * 10)]++;
    for (const b of buckets) expect(Math.abs(b / 100_000 - 0.1)).toBeLessThan(0.005);
  });

  test('next() is always in [0, 1); between() and pick() respect their limits', () => {
    const random = new Random(1);
    for (let i = 0; i < 10_000; i++) {
      const x = random.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const y = random.between(-2, 3);
      expect(y).toBeGreaterThanOrEqual(-2);
      expect(y).toBeLessThan(3);
    }
    expect(['a', 'b', 'c']).toContain(random.pick(['a', 'b', 'c']));
    expect(() => random.pick([])).toThrow();
  });

  test('saving the state and restoring it repeats the sequence from that point', () => {
    const random = new Random(99);
    for (let i = 0; i < 37; i++) random.uint32();
    const snapshot = random.state;
    const after = Array.from({ length: 20 }, () => random.uint32());
    random.restore(snapshot);
    expect(Array.from({ length: 20 }, () => random.uint32())).toEqual(after);
  });
});
