import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createRandom } from './random';
import { hashOf } from './hash';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [0, 9, 12], target: [0, 1.8, 0] });
const STEP = 1 / 60;

/** What the player asks for at a step: a direction on the floor, x and z, each −1, 0 or 1. */
type Input = [number, number];
/** A recording: the inputs only when they changed, with their step; and the hash after every step. */
interface Recording {
  inputs: { step: number; input: Input }[];
  hashes: number[];
}

const walls: THREE.Mesh[] = [];

/** A world, always born the same: a floor, boxes from a SEEDED randomness, and the player's ball. */
function createWorld(ghost: boolean) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.5, 10), floor);
  const material = (color: number) =>
    new THREE.MeshStandardMaterial({ color, transparent: ghost, opacity: ghost ? 0.3 : 1 });
  const meshes: [RAPIER.RigidBody, THREE.Mesh][] = [];
  // Low walls around the yard, so nothing leaves it (drawn once: the ghost's are the same).
  for (const [x, z, hx, hz] of [
    [0, -5.5, 5.5, 0.15],
    [0, 5.5, 5.5, 0.15],
    [-5.5, 0, 0.15, 5.5],
    [5.5, 0, 0.15, 5.5],
  ]) {
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x!, 0.3, z!));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx!, 0.3, hz!), wall);
    if (!ghost) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx! * 2, 0.6, hz! * 2), material(0x5a4a38));
      mesh.position.set(x!, 0.3, z!);
      scene.add(mesh);
      walls.push(mesh);
    }
  }
  const random = createRandom(7); // the same seed: the same boxes, every time
  for (let i = 0; i < 16; i++) {
    const at = { x: random() * 8 - 4, y: 0.3 + random() * 2, z: random() * 6 - 4 };
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3), body);
    meshes.push([body, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), material(0x8a6a42))]);
  }
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.4, 4).setLinearDamping(1.5),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(0.4), ball);
  meshes.push([ball, new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), material(0x93d9c9))]);
  for (const [, mesh] of meshes) scene.add(mesh);
  return {
    world,
    /** One step: what is asked for pushes the ball, and the world advances. */
    step(input: Input) {
      // A small push every step (the ball weighs about 270 g): up to about 4.5 m/s, with the damping.
      ball.applyImpulse({ x: input[0] * 0.03, y: 0, z: input[1] * 0.03 }, true);
      world.step();
    },
    draw() {
      for (const [body, mesh] of meshes) {
        const p = body.translation();
        const r = body.rotation();
        mesh.position.set(p.x, p.y, p.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    },
    remove() {
      for (const [, mesh] of meshes) scene.remove(mesh);
      if (!ghost) for (const wall of walls.splice(0)) scene.remove(wall);
      world.free();
    },
  };
}

// ---------- The live world, and what it records ----------
let live = createWorld(false);
let recording: Recording = { inputs: [], hashes: [] };
let last: Input = [0, 0];

// ---------- The ghost: another world, fed with the previous recording ----------
let ghost: {
  world: ReturnType<typeof createWorld>;
  recording: Recording;
  next: number;
  input: Input;
} | null = null;

const options = {
  autopilot: true,
  late: false,
  race: () => {
    // The world starts over, with a ghost doing again what was just recorded, next to it.
    ghost?.world.remove();
    ghost = { world: createWorld(true), recording, next: 0, input: [0, 0] };
    live.remove();
    live = createWorld(false);
    recording = { inputs: [], hashes: [] };
    last = [0, 0];
    readout.checked = readout.different = 0;
    readout.firstDifferent = '-';
  },
};
const readout = { steps: 0, changes: 0, checked: 0, different: 0, firstDifferent: '-' };
const gui = new GUI({ title: 'Replays and ghosts' });
gui.add(options, 'autopilot').name('autopilot (or WASD)');
gui.add(options, 'race').name('race your ghost');
gui.add(options, 'late').name('the ghost, one step late');
const recorded = gui.addFolder('Recorded');
recorded.add(readout, 'steps').listen().disable();
recorded.add(readout, 'changes').name('input changes').listen().disable();
const checks = gui.addFolder('The ghost, checked');
checks.add(readout, 'checked').name('steps checked').listen().disable();
checks.add(readout, 'different').name('different hash').listen().disable();
checks.add(readout, 'firstDifferent').name('first different step').listen().disable();

// The keys (a click on the drawing gives it the keyboard), or an autopilot with its own seed.
const held = new Set<string>();
addEventListener('keydown', (e) => held.add(e.code));
addEventListener('keyup', (e) => held.delete(e.code));
const pilot = createRandom(3);
let pilotInput: Input = [0, 0];
function ask(step: number): Input {
  const keys: Input = [
    (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
    (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0),
  ];
  if (!options.autopilot || keys[0] || keys[1]) return keys;
  if (step % 45 === 0) pilotInput = [Math.floor(pilot() * 3) - 1, Math.floor(pilot() * 3) - 1];
  return pilotInput;
}

function step() {
  // LIVE: what is asked for, recorded only when it changes; and the hash after the step.
  const step = recording.hashes.length;
  const input = ask(step);
  if (input[0] !== last[0] || input[1] !== last[1]) recording.inputs.push({ step, input });
  last = input;
  live.step(input);
  recording.hashes.push(hashOf(live.world));

  // GHOST: its step k gets what was asked for at step k (or one step late, to break it), and its
  // hash must be the one recorded at step k.
  if (ghost && ghost.next < ghost.recording.hashes.length) {
    const g = ghost;
    const k = g.next++;
    const change = g.recording.inputs.find((c) => c.step + (options.late ? 1 : 0) === k);
    if (change) g.input = change.input;
    g.world.step(g.input);
    readout.checked++;
    if (hashOf(g.world.world) !== g.recording.hashes[k]) {
      readout.different++;
      if (readout.firstDifferent === '-') readout.firstDifferent = String(k);
    }
  }
  readout.steps = recording.hashes.length;
  readout.changes = recording.inputs.length;
}

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }
  live.draw();
  ghost?.world.draw();
});
