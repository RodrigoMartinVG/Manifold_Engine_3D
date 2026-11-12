/**
 * THE SHOWCASE'S PHYSICS, without Three.js or a screen (so it is tested with Vitest).
 *
 * A "softened" central field: the potential is Φ(r) = −GM / √(r² + ε²), and the acceleration,
 * g = −∇Φ = −GM r / (r² + ε²)^(3/2). The ε keeps the well from being infinite at the center.
 * Because of it the orbits do not close (it is not exactly 1/r²): they turn little by little and
 * draw rosettes.
 *
 * It is integrated with a fixed step and semi-implicit Euler, like in the fixed-step lesson: first
 * the velocity, then the position with the NEW velocity. That order matters: this way the energy
 * wobbles a little but does not drift, and the orbits do not open up over time (in the other
 * order, they do).
 */

export const STEP = 1 / 60;
export const GM = 1.5;
export const EPS2 = 0.45 ** 2;
/** How far the drawn sheet reaches. */
export const SHEET_RADIUS = 3;
/** The central body's radius. */
export const CENTER_RADIUS = 0.3;

export const potential = (r: number) => -GM / Math.sqrt(r * r + EPS2);

/** The speed of a circular orbit of radius `r`: just enough for g to bend it. */
export const circularSpeed = (r: number) => Math.sqrt((GM * r * r) / (r * r + EPS2) ** 1.5);

export interface Orbit {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** The previous step's position, to draw in between (interpolate). */
  xBefore: number;
  zBefore: number;
}

/**
 * The showcase's three orbits: each one starts at distance `r`, at angle `phase`, with a
 * perpendicular velocity equal to the circular one times `factor` (less than 1: an ellipse that
 * comes closer).
 */
export const INITIAL_ORBITS = [
  { r: 1.15, factor: 0.82, phase: 0 },
  { r: 1.85, factor: 1, phase: 2.1 },
  { r: 2.6, factor: 0.86, phase: 4.2 },
] as const;

export function createOrbit(r: number, factor: number, phase: number): Orbit {
  const v = circularSpeed(r) * factor;
  const x = r * Math.cos(phase);
  const z = r * Math.sin(phase);
  return { x, z, vx: -v * Math.sin(phase), vz: v * Math.cos(phase), xBefore: x, zBefore: z };
}

/** One fixed semi-implicit Euler step. */
export function advance(o: Orbit) {
  o.xBefore = o.x;
  o.zBefore = o.z;
  const k = -GM / (o.x * o.x + o.z * o.z + EPS2) ** 1.5; // g = k · (x, z)
  o.vx += k * o.x * STEP;
  o.vz += k * o.z * STEP;
  o.x += o.vx * STEP;
  o.z += o.vz * STEP;
}

/** The energy per unit of mass: kinetic plus potential. If the integrator is good, it barely changes. */
export const energy = (o: Orbit) => 0.5 * (o.vx * o.vx + o.vz * o.vz) + potential(Math.hypot(o.x, o.z));
