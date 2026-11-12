/**
 * THE SIMULATION: balls that bounce in a box. Only DATA and arithmetic: it does not import
 * Three.js, it does not know a screen exists. That is why it can run without drawing (faster than
 * real time, for testing or for a server) and always give the same with the same seed.
 */

export const STEP = 1 / 60; // seconds per step: always the same
const G = 9.81;
export const HALF_WIDTH = 3; // the box goes from −3 to 3 in X and in Z

export interface Ball {
  position: [number, number, number];
  velocity: [number, number, number];
  radius: number;
}

export interface World {
  balls: Ball[];
  steps: number;
}

export function createWorld(seed: number, count: number): World {
  let state = seed >>> 0;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const balls: Ball[] = [];
  for (let i = 0; i < count; i++) {
    const radius = 0.12 + random() * 0.2;
    balls.push({
      position: [(random() - 0.5) * 4, 1 + random() * 3, (random() - 0.5) * 4],
      velocity: [(random() - 0.5) * 6, 0, (random() - 0.5) * 6],
      radius,
    });
  }
  return { balls, steps: 0 };
}

/** One step: gravity, motion and the bounces (off the floor and the walls). */
export function advance(world: World) {
  for (const b of world.balls) {
    b.velocity[1] -= G * STEP;
    for (let axis = 0; axis < 3; axis++) b.position[axis]! += b.velocity[axis]! * STEP;
    if (b.position[1] < b.radius) {
      b.position[1] = b.radius;
      b.velocity[1] = Math.abs(b.velocity[1]) * 0.92; // it loses a little on each bounce
    }
    for (const axis of [0, 2]) {
      const limit = HALF_WIDTH - b.radius;
      if (Math.abs(b.position[axis]!) > limit) {
        b.position[axis] = Math.sign(b.position[axis]!) * limit;
        b.velocity[axis] = -b.velocity[axis]!;
      }
    }
  }
  world.steps++;
}

/** A summary of the world (to compare two worlds without looking at every number). */
export function summary(world: World): string {
  let sum = 0;
  for (const b of world.balls) sum += b.position[0] + 3 * b.position[1] + 7 * b.position[2];
  return sum.toFixed(9);
}
