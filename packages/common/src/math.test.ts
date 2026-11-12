import { describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from './math';

const close = (a: readonly number[], b: readonly number[], tolerance = 1e-12) =>
  a.forEach((x, i) => expect(Math.abs(x - b[i]!)).toBeLessThan(tolerance));

describe('vectors', () => {
  test('cross product: X × Y = Z (right hand), and it is perpendicular to both', () => {
    close(vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    const a: Vec3 = [1, 2, 3];
    const b: Vec3 = [-4, 0.5, 2];
    const c = vec3.cross(a, b);
    expect(Math.abs(vec3.dot(c, a))).toBeLessThan(1e-12);
    expect(Math.abs(vec3.dot(c, b))).toBeLessThan(1e-12);
  });

  test('normalize leaves length 1 (and zero stays zero, without dividing by zero)', () => {
    expect(vec3.length(vec3.normalize([3, 4, 12]))).toBeCloseTo(1, 15);
    expect(vec3.normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('quaternions', () => {
  test('90° around Y take +X to −Z (right-hand rule)', () => {
    const q = quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
    close(quat.rotate(q, [1, 0, 0]), [0, 0, -1]);
  });

  test('the identity does not rotate; multiplying by it changes nothing', () => {
    const q = quat.fromAxisAngle([1, 2, 3], 0.7);
    close(quat.multiply(quat.identity(), q), q);
    close(quat.multiply(q, quat.identity()), q);
    close(quat.rotate(quat.identity(), [4, 5, 6]), [4, 5, 6]);
  });

  test('composing: a × b rotates by b first and then by a', () => {
    const a = quat.fromAxisAngle([0, 0, 1], 0.4);
    const b = quat.fromAxisAngle([1, 0, 0], 1.1);
    const v: Vec3 = [0.3, -2, 5];
    close(quat.rotate(quat.multiply(a, b), v), quat.rotate(a, quat.rotate(b, v)));
  });

  test('around the same axis, the angles add up', () => {
    const axis: Vec3 = [1, 1, 0];
    const q = quat.multiply(quat.fromAxisAngle(axis, 0.3), quat.fromAxisAngle(axis, 0.5));
    close(q, quat.fromAxisAngle(axis, 0.8));
    expect(quat.angleBetween(quat.identity(), q)).toBeCloseTo(0.8, 12);
  });

  test('rotating keeps the length of vectors', () => {
    const q = quat.fromAxisAngle([-2, 1, 4], 2.3);
    const v: Vec3 = [7, -1, 0.5];
    expect(vec3.length(quat.rotate(q, v))).toBeCloseTo(vec3.length(v), 12);
  });
});

describe('looking somewhere (for characters)', () => {
  test('onPlane keeps the part of a vector that is perpendicular to the normal', () => {
    close(vec3.onPlane([3, 5, -2], [0, 1, 0]), [3, 0, -2]);
    const n = vec3.normalize([1, 1, 0]);
    expect(Math.abs(vec3.dot(vec3.onPlane([2, -1, 4], n), n))).toBeLessThan(1e-12);
  });

  test('look: looking at −Z with +Y up is no rotation; any other way, the axes go where they should', () => {
    close(quat.look([0, 0, -1], [0, 1, 0]), [0, 0, 0, 1]);
    // Four directions around +Y, and three tilted "ups" (also with the forward opposite to each branch).
    const cases: [Vec3, Vec3][] = [
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 0],
      ],
      [
        [-1, 0, 0],
        [0, 1, 0],
      ],
      [vec3.normalize([1, 0, -1]), [0, 1, 0]],
      [
        [0, 1, 0],
        [0, 0, 1],
      ],
      [
        [0, -1, 0],
        [1, 0, 0],
      ],
      [vec3.normalize([1, 1, 0]), vec3.normalize([-1, 1, 0])],
    ];
    for (const [forward, up] of cases) {
      const q = quat.look(forward, up);
      close(quat.rotate(q, [0, 0, -1]), forward, 1e-12);
      close(quat.rotate(q, [0, 1, 0]), up, 1e-12);
    }
  });
});
