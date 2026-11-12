import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';

// Rapier is WebAssembly: it loads asynchronously, ONCE, before creating any world.
await RAPIER.init();

const { scene, onFrame } = createScene();
const STEP = 1 / 60; // the physics advances 1/60 of a second at a time: the fixed step

/** Something the physics moves, and the mesh that shows it. */
interface Thing {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
}

const box = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const sphere = new THREE.SphereGeometry(0.25, 20, 14);
let world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
let things: Thing[] = [];

const options = {
  gravity: -9.81, // m/s², along y
  bounciness: 0.3, // restitution: 0 does not bounce, 1 bounces back to the same height
  bodies: 40,
  dropMore: () => {
    for (let i = 0; i < 10; i++) drop();
  },
  restart,
};

/** A DYNAMIC body: the physics moves it (gravity, collisions). Its shape is its COLLIDER. */
function drop() {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(
      Math.random() * 4 - 2,
      3 + Math.random() * 6,
      Math.random() * 4 - 2,
    ),
  );
  const round = Math.random() < 0.3;
  const shape = round
    ? RAPIER.ColliderDesc.ball(0.25)
    : RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25);
  world.createCollider(shape.setRestitution(options.bounciness), body);
  const color = new THREE.Color().setHSL(Math.random(), 0.45, 0.55);
  const mesh = new THREE.Mesh(round ? sphere : box, new THREE.MeshStandardMaterial({ color }));
  scene.add(mesh);
  things.push({ body, mesh });
}

function restart() {
  for (const t of things) scene.remove(t.mesh);
  things = [];
  // Its memory is WebAssembly's, which the garbage collector does not see: it is freed by hand.
  world.free();
  world = new RAPIER.World({ x: 0, y: options.gravity, z: 0 });
  world.timestep = STEP;
  // The floor: a FIXED body (it never moves), with a box collider 20 × 1 × 20 m, its top at y = 0.
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.5, 10), floor);
  for (let i = 0; i < options.bodies; i++) drop();
}
restart();

const readout = { awake: 0 };
const gui = new GUI({ title: 'Physics engine' });
gui
  .add(options, 'gravity', -20, 0, 0.1)
  .onChange((g: number) => (world.gravity = { x: 0, y: g, z: 0 }));
gui.add(options, 'bounciness', 0, 1, 0.05).name('bounciness (on restart)');
gui.add(options, 'bodies', 1, 150, 1).name('bodies (on restart)');
gui.add(options, 'dropMore').name('drop 10 more');
gui.add(options, 'restart');
gui.add(readout, 'awake').name('bodies awake').listen().disable();

let accumulator = 0;
onFrame((dt) => {
  // The fixed step (stage 0): the time piles up, and the physics spends it in equal steps.
  accumulator += dt;
  while (accumulator >= STEP) {
    world.step();
    accumulator -= STEP;
  }
  // Each mesh, where the physics has its body.
  for (const t of things) {
    const p = t.body.translation();
    const r = t.body.rotation();
    t.mesh.position.set(p.x, p.y, p.z);
    t.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
  // Bodies that stop moving fall asleep: the physics does not compute them until something wakes them.
  readout.awake = things.filter((t) => !t.body.isSleeping()).length;
});
