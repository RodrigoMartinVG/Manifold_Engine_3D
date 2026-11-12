import type { Vec3 } from '@manifold/common';
import type { GravityField } from './types';

/** The Earth's: 9.81 m/s², down (-y). */
export const EARTH: GravityField = { kind: 'uniform', vector: [0, -9.81, 0] };

/**
 * The gravity at a point (m/s²). Everything that needs "down" asks here, never assumes −y: the
 * character's "up" will be the opposite of this (decision 0012). Today there is only the uniform
 * field, so the point does not matter yet.
 */
export function gravityAt(field: GravityField, _position: Vec3): Vec3 {
  switch (field.kind) {
    case 'uniform':
      return [...field.vector];
  }
}
