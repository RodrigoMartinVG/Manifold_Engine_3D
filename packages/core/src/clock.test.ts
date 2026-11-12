import { expect, test } from 'vitest';
import { STEP } from './world';
import { Clock } from './clock';

test('at 60 frames per second, one step per frame; at 30, two; at 144, sometimes none', () => {
  const count = (fps: number, seconds: number) => {
    const clock = new Clock();
    let steps = 0;
    for (let i = 0; i < fps * seconds; i++) steps += clock.advance(1 / fps);
    return steps;
  };
  // In 10 seconds, always 600 steps (±1 for what was left in the accumulator).
  for (const fps of [30, 60, 144, 75]) expect(Math.abs(count(fps, 10) - 600)).toBeLessThanOrEqual(1);
});

test('alpha: how much of the next step has passed (to draw halfway)', () => {
  const clock = new Clock();
  expect(clock.advance(STEP * 2.25)).toBe(2);
  expect(clock.alpha).toBeCloseTo(0.25, 9);
});

test('a long pause does not run hundreds of steps at once', () => {
  const clock = new Clock();
  expect(clock.advance(10)).toBe(5);
  expect(clock.alpha).toBe(0);
});
