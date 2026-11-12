/**
 * MATH ON PLAIN DATA.
 *
 * Vectors and quaternions are tuples of numbers (`[x, y, z]`, `[x, y, z, w]`), not objects with
 * methods. That way the world's state is only data: it is copied, compared, kept in a snapshot and
 * sent over the network without converting anything (decision 0004). The functions return new
 * tuples.
 *
 * Axis convention (Three.js's, so the presentation does not translate): X to the right, Y up, Z
 * towards the camera (forward is −Z). But the engine does NOT assume "up" is +Y: gravity is a
 * field (decision 0000), and every thing has its own "up".
 */
export type Vec3 = [x: number, y: number, z: number];
/** A unit quaternion: a rotation. `w` is the real part. */
export type Quat = [x: number, y: number, z: number, w: number];

export const vec3 = {
  zero: (): Vec3 => [0, 0, 0],
  add: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Readonly<Vec3>, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Readonly<Vec3>, b: Readonly<Vec3>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  length: (a: Readonly<Vec3>): number => Math.hypot(a[0], a[1], a[2]),
  /** The same vector with length 1 (zero stays zero). */
  normalize: (a: Readonly<Vec3>): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
  },
};

export const quat = {
  identity: (): Quat => [0, 0, 0, 1],

  /** The rotation of `angle` radians around `axis` (it does not need length 1). */
  fromAxisAngle: (axis: Readonly<Vec3>, angle: number): Quat => {
    const [x, y, z] = vec3.normalize(axis);
    const s = Math.sin(angle / 2);
    return [x * s, y * s, z * s, Math.cos(angle / 2)];
  },

  /**
   * a × b: rotates by b first, then by a (like matrices: the right one is applied first).
   * The Hamilton product, written component by component.
   */
  multiply: (a: Readonly<Quat>, b: Readonly<Quat>): Quat => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],

  /**
   * Back to length 1. Multiplying quaternions thousands of times accumulates rounding error, and
   * the rotation would start to "stretch" things: it is renormalized after every integration.
   */
  normalize: (q: Readonly<Quat>): Quat => {
    const l = Math.hypot(q[0], q[1], q[2], q[3]);
    return l > 0 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : [0, 0, 0, 1];
  },

  /** Rotates the vector `v` by `q` (q · v · q⁻¹, written without building intermediate quaternions). */
  rotate: (q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 => {
    const [x, y, z, w] = q;
    // t = 2 · (q.xyz × v)
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    // v' = v + w·t + q.xyz × t
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  },

  /** The angle (radians, from 0 to π) of the rotation that takes `a` to `b`. */
  angleBetween: (a: Readonly<Quat>, b: Readonly<Quat>): number => {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return 2 * Math.acos(Math.min(1, d));
  },
};
