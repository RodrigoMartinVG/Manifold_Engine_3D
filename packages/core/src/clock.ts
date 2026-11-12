import { STEP } from './world';

/** At most, how many steps are taken in one frame (if the tab was asleep, it does not try to catch up). */
const MAX_STEPS = 5;

/**
 * THE FIXED-STEP CLOCK. The screen draws when it can (60, 30 or 144 times per second); the
 * simulation always advances by `STEP`. The clock gathers the real time that passed and says how
 * many whole steps it "bought"; what is left over stays for the next frame.
 *
 * `alpha` (between 0 and 1) is how much of the next step has already passed: the presentation uses
 * it to draw things halfway between the previous step and the current one (interpolation), so they
 * look smooth even if the screen runs at another rate.
 */
export class Clock {
  private accumulated = 0;

  /** Adds `seconds` of real time and returns how many steps to take now. */
  advance(seconds: number): number {
    this.accumulated += Math.max(0, seconds);
    let steps = Math.floor(this.accumulated / STEP + 1e-9);
    if (steps > MAX_STEPS) {
      // A long pause (another tab, the debugger): it is dropped, instead of running hundreds of
      // steps at once and freezing everything (the "spiral of death").
      steps = MAX_STEPS;
      this.accumulated = 0;
      return steps;
    }
    this.accumulated -= steps * STEP;
    if (this.accumulated < 0) this.accumulated = 0;
    return steps;
  }

  get alpha(): number {
    return Math.min(1, this.accumulated / STEP);
  }
}
