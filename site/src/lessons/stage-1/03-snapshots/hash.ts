import type RAPIER from '@dimforge/rapier3d-deterministic-compat';

/**
 * A HASH of a world: one number that sums up where every body is and how it is turned. It is
 * FNV-1a, the simplest good one: for every byte, an XOR and a multiplication. Two worlds with the
 * same hash are, almost surely, the same world; with different hashes, surely not.
 *
 * The numbers are hashed as their BYTES, written little-endian on purpose (a DataView), so that
 * every machine writes them the same way.
 */
const view = new DataView(new ArrayBuffer(4));

export function hashOf(world: RAPIER.World): number {
  let h = 0x811c9dc5;
  const add = (x: number) => {
    view.setFloat32(0, x, true);
    for (let i = 0; i < 4; i++) h = Math.imul(h ^ view.getUint8(i), 0x01000193) >>> 0;
  };
  world.forEachRigidBody((body) => {
    const p = body.translation();
    const r = body.rotation();
    for (const x of [p.x, p.y, p.z, r.x, r.y, r.z, r.w]) add(x);
  });
  return h;
}
