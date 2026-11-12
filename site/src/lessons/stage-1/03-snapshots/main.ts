import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createRandom } from './random';
import { hashOf } from './hash';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [0, 6, 12], target: [0, 1.5, 0] });
const STEP = 1 / 60;
const SIDE = 3; // the original is drawn 3 m to the left, the twin 3 m to the right (each in its own world)
const box = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const random = createRandom(11);

/** A world: a floor, and boxes falling in a pile. */
function build(): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.5, 3), floor);
  firstBox = drop(world).handle;
  for (let i = 1; i < 40; i++) drop(world);
  return world;
}
function drop(world: RAPIER.World): RAPIER.RigidBody {
  const at = { x: random() * 2 - 1, y: 1 + random() * 8, z: random() * 2 - 1 };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25), body);
  return body;
}
/** The first box's HANDLE: the same number in the world and in every world restored from it. */
let firstBox = 0;

/**
 * The meshes of a world, BY THE HANDLE of each body (a number), not by the body: a restored world is
 * a new world, with new body objects, but every body keeps its handle.
 */
function drawer(color: number, opacity: number, shift: number) {
  const meshes = new Map<number, THREE.Mesh>();
  const material = new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity });
  return {
    draw(world: RAPIER.World | null) {
      const seen = new Set<number>();
      world?.forEachRigidBody((body) => {
        if (body.isFixed()) return;
        let mesh = meshes.get(body.handle);
        if (!mesh) {
          mesh = new THREE.Mesh(box, material);
          meshes.set(body.handle, mesh);
          scene.add(mesh);
        }
        const p = body.translation();
        const r = body.rotation();
        mesh.position.set(p.x + shift, p.y, p.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
        seen.add(body.handle);
      });
      // A body that is not in this world any more (it came after the snapshot): its mesh goes.
      for (const [handle, mesh] of meshes)
        if (!seen.has(handle)) {
          scene.remove(mesh);
          meshes.delete(handle);
        }
    },
  };
}

let world = build();
let twin: RAPIER.World | null = null;
let saved: { bytes: Uint8Array; step: number } | null = null;
let step = 0;
const live = drawer(0x8a6a42, 1, -SIDE);
const twins = drawer(0x93d9c9, 0.45, SIDE);
const readout = { step: 0, size: '-', took: '-', twin: '-' };

const options = {
  snapshot: () => {
    const start = performance.now();
    const bytes = world.takeSnapshot();
    readout.took = `${(performance.now() - start).toFixed(2)} ms`;
    readout.size = `${(bytes.length / 1024).toFixed(1)} KB`;
    saved = { bytes, step };
    // A twin, born from those bytes: from now on it gets the same steps as the original.
    twin?.free();
    twin = RAPIER.World.restoreSnapshot(bytes);
    readout.twin = 'the same';
  },
  goBack: () => {
    if (!saved) return;
    world.free();
    world = RAPIER.World.restoreSnapshot(saved.bytes);
    step = saved.step;
    twin?.free();
    twin = null;
    readout.twin = '-';
  },
  nudgeTheTwin: () => {
    // A ten-thousandth of a newton-second, on the twin's first box: found by its handle.
    twin?.getRigidBody(firstBox)?.applyImpulse({ x: 0.0001, y: 0, z: 0 }, true);
  },
  dropMore: () => {
    for (let i = 0; i < 5; i++) drop(world);
  },
};
const gui = new GUI({ title: 'Snapshots' });
gui.add(options, 'snapshot').name('take a snapshot (and a twin)');
gui.add(options, 'goBack').name('go back to the snapshot');
gui.add(options, 'nudgeTheTwin').name('nudge the twin');
gui.add(options, 'dropMore').name('drop 5 more (here only)');
gui.add(readout, 'step').listen().disable();
gui.add(readout, 'size').name('snapshot size').listen().disable();
gui.add(readout, 'took').name('took').listen().disable();
gui.add(readout, 'twin').name('the twin is').listen().disable();

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    world.step();
    twin?.step();
    step++;
    // Every step, the two hashes: the same world, as long as both get the same.
    if (twin && readout.twin === 'the same' && hashOf(twin) !== hashOf(world))
      readout.twin = `another world since step ${step}`;
    accumulator -= STEP;
  }
  // The first snapshot comes by itself, when the pile is falling.
  if (step >= 90 && !saved) options.snapshot();
  live.draw(world);
  twins.draw(twin);
  readout.step = step;
});
