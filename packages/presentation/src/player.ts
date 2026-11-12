import { vec3, type Vec3 } from '@manifold/common';
import type { PlayerInput } from '@manifold/core';

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
 *   possible), A jumps, B or pressing the stick runs.
 *
 * Nothing is read while the console is open, or while typing somewhere else.
 *
 * A key pressed and released between two frames still counts: every press is kept until the next
 * reading. Without that, a quick tap of Space on a slow machine (few frames per second) lost the jump.
 */
export interface PlayerControls {
  /** What is asked for now, with the camera looking towards `look` and the character's `up`. */
  read(look: Vec3, up: Vec3): PlayerInput;
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
const OTHER_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
/** Below this, a gamepad's stick is resting (sticks never return exactly to zero). */
const DEAD_ZONE = 0.2;

export function mountPlayerControls(o: { blocked(): boolean }): PlayerControls {
  const held = new Set<string>();
  /** Pressed since the last reading (even if already released). */
  const pressed = new Set<string>();
  const typing = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');

  const down = (e: KeyboardEvent) => {
    if (o.blocked() || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!(e.code in MOVE_KEYS) && !OTHER_KEYS.has(e.code)) return;
    held.add(e.code);
    pressed.add(e.code);
    // The arrows and Space would scroll the page, or press the focused button.
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
    read(look, upVector) {
      if (o.blocked()) release();
      const keys = new Set([...held, ...pressed]);
      pressed.clear();
      let forward = 0;
      let right = 0;
      for (const code of keys) {
        const k = MOVE_KEYS[code];
        if (k) {
          forward += k[0];
          right += k[1];
        }
      }
      let jump = keys.has('Space');
      let run = keys.has('ShiftLeft') || keys.has('ShiftRight');

      const pad = navigator.getGamepads?.()[0];
      if (pad && !o.blocked()) {
        const x = Math.abs(pad.axes[0] ?? 0) > DEAD_ZONE ? pad.axes[0]! : 0;
        const y = Math.abs(pad.axes[1] ?? 0) > DEAD_ZONE ? pad.axes[1]! : 0;
        right += x;
        forward -= y; // the stick's "up" is negative
        jump ||= pad.buttons[0]?.pressed ?? false;
        run ||= (pad.buttons[1]?.pressed ?? false) || (pad.buttons[10]?.pressed ?? false);
      }

      // The camera's forward and right, flattened on the character's ground.
      const ahead = vec3.normalize(vec3.onPlane(look, upVector));
      const side = vec3.cross(ahead, upVector);
      let move = vec3.add(vec3.scale(ahead, forward), vec3.scale(side, right));
      const length = vec3.length(move);
      if (length > 1) move = vec3.scale(move, 1 / length);
      return { move, jump, run };
    },
    stop() {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    },
  };
}
