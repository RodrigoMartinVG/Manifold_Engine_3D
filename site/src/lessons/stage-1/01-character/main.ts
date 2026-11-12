import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';

await RAPIER.init();
const { scene, controls, onFrame } = createScene({ camera: [0, 5, 11] });
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

/** Something fixed in the level: a box, at a place, maybe tilted (around x, in degrees). */
function block(center: [number, number, number], half: [number, number, number], tilt = 0) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    (tilt * Math.PI) / 180,
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(...center)
      .setRotation(rotation),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half), body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
    new THREE.MeshStandardMaterial({ color: 0x8a6a42 }),
  );
  mesh.position.set(...center);
  mesh.quaternion.copy(rotation);
  scene.add(mesh);
}
block([0, -0.5, 0], [10, 0.5, 10]); // the floor
for (const [i, h] of [0.2, 0.4, 0.6].entries()) block([-4, h / 2, -1 - i], [1, h / 2, 0.5]); // steps
block([0, 0.6, -3], [1, 0.1, 2.5], 18); // a ramp, 18° (around x)
block([4, 1, -2], [0.25, 1, 2]); // a wall

// THE CHARACTER: a capsule (a cylinder with round ends), on a KINEMATIC body moved by position.
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 4),
);
const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
const hero = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1, 6, 16),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(hero);

// ITS CONTROLLER: it says how much of a desired movement the capsule can really do.
const controller = world.createCharacterController(0.02); // a 2 cm gap, so it does not get stuck
controller.enableSnapToGround(0.3);

const options = { speed: 4.5, jump: 6.5, coyote: 6, climbsSteps: true, maxSlope: 50 };
const readout = { grounded: false, stepsInAir: 0 };
const gui = new GUI({ title: 'Character' });
gui.add(options, 'speed', 1, 10, 0.5).name('speed (m/s)');
gui.add(options, 'jump', 2, 10, 0.5).name('jump (m/s up)');
gui.add(options, 'coyote', 0, 20, 1).name('coyote time (steps)');
gui.add(options, 'climbsSteps').name('climbs steps');
gui.add(options, 'maxSlope', 10, 80, 1).name('steepest slope (°)');
gui.add(readout, 'grounded').listen().disable();
gui.add(readout, 'stepsInAir').name('steps in the air').listen().disable();

// The keys held, and the ones pressed since the last step (a quick tap must not be lost).
const held = new Set<string>();
const pressed = new Set<string>();
addEventListener('keydown', (e) => {
  held.add(e.code);
  pressed.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));

let vy = 0; // the vertical velocity: gravity and the jump
let grounded = false;
let stepsInAir = 99;
let jumpWasHeld = false;

function step() {
  const down = (...codes: string[]) => codes.some((c) => held.has(c) || pressed.has(c));
  const x = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  const z = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  const length = Math.hypot(x, z) || 1;
  // A jump starts when Space is PRESSED, not while it is held; and up to `coyote` steps after leaving an edge.
  const jumping = down('Space');
  if (jumping && !jumpWasHeld && (grounded || stepsInAir <= options.coyote)) {
    vy = options.jump;
    stepsInAir = options.coyote + 1; // no second jump in the air
  }
  jumpWasHeld = jumping;
  pressed.clear();
  vy -= 9.81 * STEP;

  if (options.climbsSteps) controller.enableAutostep(0.35, 0.15, false);
  else controller.disableAutostep();
  controller.setMaxSlopeClimbAngle((options.maxSlope * Math.PI) / 180);
  // What it WANTS to move this step; the controller slides it along walls, up steps and slopes.
  const desired = {
    x: (x / length) * options.speed * STEP,
    y: vy * STEP,
    z: (z / length) * options.speed * STEP,
  };
  controller.computeColliderMovement(collider, desired);
  const moved = controller.computedMovement();
  grounded = controller.computedGrounded();
  if (grounded && vy < 0) vy = 0;
  stepsInAir = grounded ? 0 : stepsInAir + 1;
  const p = body.translation();
  body.setNextKinematicTranslation({ x: p.x + moved.x, y: p.y + moved.y, z: p.z + moved.z });
  world.step();
}

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }
  const p = body.translation();
  hero.position.set(p.x, p.y, p.z);
  controls.target.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.1); // the camera looks at it
  readout.grounded = grounded;
  readout.stepsInAir = Math.min(stepsInAir, 99);
});

console.log('A click on the drawing gives it the keyboard: WASD or the arrows, Space to jump.');
