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
 *
 * DETERMINISM ACROSS BROWSERS (decision 0012): the JavaScript standard lets every engine compute
 * `Math.hypot`, `Math.sin`, `Math.cos`, `Math.atan2`… its own way, so two browsers may differ in the
 * last bit. Lengths are computed here with `Math.sqrt` of the sum of squares: the square root is
 * the operation every processor rounds the same way (IEEE 754). The functions used inside a
 * simulation step avoid the others (`fromAxisAngle` and `angleBetween` are for setting things up and
 * for tests).
 */
const sqrt = Math.sqrt;
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
  length: (a: Readonly<Vec3>): number => sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]),
  /** The same vector with length 1 (zero stays zero). */
  normalize: (a: Readonly<Vec3>): Vec3 => {
    const l = sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
  },
  /** What is left of `v` on the plane perpendicular to `n` (a unit vector): its "horizontal" part, if `n` is up. */
  onPlane: (v: Readonly<Vec3>, n: Readonly<Vec3>): Vec3 => {
    const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d];
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
    const l = sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    return l > 0 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : [0, 0, 0, 1];
  },

  /**
   * The rotation that makes a thing look towards `forward` with its head towards `up` (both of length
   * 1, and perpendicular). "Looking" is the −Z axis, Three.js's convention. It is built from the
   * three axes (right, up, back) as a rotation matrix, turned into a quaternion with only square
   * roots: no trigonometry, the same bits in every browser.
   */
  look: (forward: Readonly<Vec3>, up: Readonly<Vec3>): Quat => {
    const right = vec3.cross(forward, up); // x
    const back: Vec3 = [-forward[0], -forward[1], -forward[2]]; // z
    // The matrix's columns are right, up, back: m[row][column].
    const m00 = right[0],
      m01 = up[0],
      m02 = back[0];
    const m10 = right[1],
      m11 = up[1],
      m12 = back[1];
    const m20 = right[2],
      m21 = up[2],
      m22 = back[2];
    const trace = m00 + m11 + m22;
    // (Shoemake's method: the branch keeps the square root away from small numbers.)
    if (trace > 0) {
      const s = sqrt(trace + 1) * 2;
      return quat.normalize([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]);
    }
    if (m00 > m11 && m00 > m22) {
      const s = sqrt(1 + m00 - m11 - m22) * 2;
      return quat.normalize([s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]);
    }
    if (m11 > m22) {
      const s = sqrt(1 + m11 - m00 - m22) * 2;
      return quat.normalize([(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]);
    }
    const s = sqrt(1 + m22 - m00 - m11) * 2;
    return quat.normalize([(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]);
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
