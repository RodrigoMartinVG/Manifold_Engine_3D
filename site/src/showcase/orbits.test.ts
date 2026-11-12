import { describe, expect, it } from 'vitest';
import { CENTER_RADIUS, INITIAL_ORBITS, SHEET_RADIUS, advance, createOrbit, energy } from './orbits';

describe("the showcase's orbits", () => {
  // Ten minutes of showcase open, at 60 steps per second.
  const STEPS = 10 * 60 * 60;

  it.each(INITIAL_ORBITS)('the one at r = $r neither leaves the sheet nor touches the center', ({ r, factor, phase }) => {
    const o = createOrbit(r, factor, phase);
    let nearest = Infinity;
    let farthest = 0;
    for (let i = 0; i < STEPS; i++) {
      advance(o);
      const d = Math.hypot(o.x, o.z);
      nearest = Math.min(nearest, d);
      farthest = Math.max(farthest, d);
    }
    expect(nearest).toBeGreaterThan(CENTER_RADIUS + 0.15);
    expect(farthest).toBeLessThan(SHEET_RADIUS);
  });

  it.each(INITIAL_ORBITS)('the one at r = $r keeps its energy (it wobbles, but does not drift)', ({ r, factor, phase }) => {
    const o = createOrbit(r, factor, phase);
    const initial = energy(o);
    let worst = 0;
    for (let i = 0; i < STEPS; i++) {
      advance(o);
      worst = Math.max(worst, Math.abs((energy(o) - initial) / initial));
    }
    // Measured: 0.46 % for the one that comes closest to the center (there the step is coarser
    // compared to the curve). With explicit Euler, instead, it grows without end and the orbits open.
    expect(worst).toBeLessThan(0.01);
  });
});
