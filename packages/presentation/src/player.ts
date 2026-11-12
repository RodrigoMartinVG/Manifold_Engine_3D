import { vec3, type Vec3 } from '@manifold/common';
import type { InputValue, PlayerInput } from '@manifold/core';

/**
 * WHAT THE PLAYER ASKS FOR, from the keyboard and a gamepad (stage 1b).
 *
 * The keys say "forward", "left"…, but the simulation does not know where the camera looks (the camera
 * is the view's, not the world's): here they become a direction IN THE WORLD, on the plane
 * perpendicular to the character's "up", by where the camera looks. That direction is what enters the
 * world, through the session (and what a replay keeps).
 *
 * - Keyboard: WASD or the arrows to move, Space to jump, Shift to run. By physical key (`code`), so
 *   WASD is in the same place on any layout.
 * - Gamepad (the first one connected): the left stick moves (as far as it is pushed: walking slower is
 *   possible), A jumps, B or pressing the stick runs. The right stick turns the camera (`cameraStick`).
 *
 * Two schemes (stage 1c2), chosen with `controls.scheme`:
 *
 * - `camera`: "forward" is where the camera looks, and A and D go to its sides. The character looks
 *   where it walks.
 * - `tank`: W and S go forward and back where the CHARACTER looks, A and D turn it on its own axis,
 *   and Q and E (or A and D with Alt held, as in the old shooters) go to its sides without turning.
 *   With a gamepad: the left stick turns and goes forward, the shoulder buttons go to the sides. This
 *   is not resolved here but in the simulation (`ahead`, `side`, `turn`): where the character looks is
 *   the world's.
 *
 * A game's own buttons (stage 1d: `dojo.throw`…) come with the keys the game chose for them (`buttons`).
 *
 * Nothing is read while the console is open, or while typing somewhere else.
 *
 * A key pressed and released between two frames still counts: every press is kept until the next
 * reading. Without that, a quick tap of Space on a slow machine (few frames per second) lost the jump.
 */
export type ControlScheme = 'camera' | 'tank';

/** A game's button and what presses it: keys (by `code`) and, maybe, a gamepad button. */
export interface GameButton {
  /** The action the game declared (`dojo.throw`). */
  action: string;
  /** Physical keys (`KeyboardEvent.code`): `KeyF`. */
  keys: readonly string[];
  /** A gamepad button, by its standard number (2 is X, or the left one of the four). */
  pad?: number;
}

/** What presses the character's actions, in words (for the console's `inputs`). */
export const CHARACTER_KEYS: Record<string, string> = {
  move: 'W A S D or the arrows, by the camera (or the left stick)',
  ahead: 'W and S, in `controls.scheme tank` (or the left stick)',
  side: 'Q and E, or A and D with Alt held, in `controls.scheme tank` (or the shoulder buttons)',
  turn: 'A and D, in `controls.scheme tank` (or the left stick)',
  face: 'the mouse, in `view.camera aim`',
  jump: 'Space (or A)',
  run: 'Shift (or B, or pressing the left stick)',
};

export interface PlayerControls {
  /**
   * What is asked for now, with the camera looking towards `look` and the character's `up`. (Where to
   * look comes as zero, "where it moves": the client fills it in when the mouse aims.)
   */
  read(look: Vec3, up: Vec3, scheme: ControlScheme): PlayerInput;
  /** The gamepad's right stick, to turn the camera: right (+x) and down (+y), from −1 to 1 (zero at rest). */
  cameraStick(): [x: number, y: number];
  stop(): void;
}

const MOVE_KEYS: Record<string, [forward: number, right: number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};
/** To the sides without turning, in the `tank` scheme. */
const SIDE_KEYS: Record<string, number> = { KeyQ: -1, KeyE: 1 };
const OTHER_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight']);
/** Below this, a gamepad's stick is resting (sticks never return exactly to zero). */
const DEAD_ZONE = 0.2;
const axis = (pad: Gamepad, i: number) => (Math.abs(pad.axes[i] ?? 0) > DEAD_ZONE ? pad.axes[i]! : 0);
const clamp = (x: number) => Math.max(-1, Math.min(1, x));

export function mountPlayerControls(o: { blocked(): boolean; buttons?: readonly GameButton[] }): PlayerControls {
  const buttons = o.buttons ?? [];
  const gameKeys = new Set(buttons.flatMap((b) => b.keys));
  const held = new Set<string>();
  /** Pressed since the last reading (even if already released). */
  const pressed = new Set<string>();
  const typing = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');

  const down = (e: KeyboardEvent) => {
    // (Alt is not left out: held, A and D go to the sides. Ctrl and Cmd are the browser's.)
    if (o.blocked() || typing(e) || e.ctrlKey || e.metaKey) return;
    if (!(e.code in MOVE_KEYS) && !(e.code in SIDE_KEYS) && !OTHER_KEYS.has(e.code) && !gameKeys.has(e.code)) return;
    held.add(e.code);
    pressed.add(e.code);
    // The arrows and Space would scroll the page, or press the focused button; Alt would take the
    // focus to the browser's menu (on Windows), and Alt with an arrow would go back a page.
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  // If the window loses the focus with a key held, its key-up never comes: everything is released.
  const release = () => {
    held.clear();
    pressed.clear();
  };
  document.addEventListener('keydown', down);
  document.addEventListener('keyup', up);
  window.addEventListener('blur', release);

  return {
    read(look, upVector, scheme) {
      if (o.blocked()) release();
      const keys = new Set([...held, ...pressed]);
      pressed.clear();
      let forward = 0;
      let right = 0;
      let sideways = 0;
      for (const code of keys) {
        const k = MOVE_KEYS[code];
        if (k) {
          forward += k[0];
          right += k[1];
        }
        sideways += SIDE_KEYS[code] ?? 0;
      }
      let jump = keys.has('Space');
      let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const alt = keys.has('AltLeft') || keys.has('AltRight');

      const pad = navigator.getGamepads?.()[0];
      if (pad && !o.blocked()) {
        right += axis(pad, 0);
        forward -= axis(pad, 1); // the stick's "up" is negative
        sideways += (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
        jump ||= pad.buttons[0]?.pressed ?? false;
        run ||= (pad.buttons[1]?.pressed ?? false) || (pad.buttons[10]?.pressed ?? false);
      }

      // The game's buttons, by their keys (or the gamepad's).
      const own: Record<string, InputValue> = {};
      for (const b of buttons)
        if (b.keys.some((k) => keys.has(k)) || (b.pad !== undefined && pad && !o.blocked() && pad.buttons[b.pad]?.pressed))
          own[b.action] = true;

      // Tank: forward and back, turning and to the sides, all by where the character looks.
      if (scheme === 'tank')
        return {
          ahead: clamp(forward),
          side: clamp(sideways + (alt ? right : 0)),
          turn: alt ? 0 : clamp(right),
          jump,
          run,
          ...own,
        };

      // By the camera: its forward and right, flattened on the character's ground.
      const ahead = vec3.normalize(vec3.onPlane(look, upVector));
      const side = vec3.cross(ahead, upVector);
      let move = vec3.add(vec3.scale(ahead, forward), vec3.scale(side, right));
      const length = vec3.length(move);
      if (length > 1) move = vec3.scale(move, 1 / length);
      return { move, jump, run, ...own };
    },
    cameraStick() {
      const pad = navigator.getGamepads?.()[0];
      return pad && !o.blocked() ? [axis(pad, 2), axis(pad, 3)] : [0, 0];
    },
    stop() {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    },
  };
}
