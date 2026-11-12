import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';

const { scene, camera, onFrame } = createScene();
camera.position.set(2.6, 2.4, 3.6); // closer than usual: the ship is small
camera.lookAt(0, 1.2, 0);

// A "ship": the nose says where it faces, and the red fin, which way is its "up".
const material = (color: number) => new THREE.MeshStandardMaterial({ color });
const ship = new THREE.Group();
ship.add(
  new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1.6), material(0x4f86c6)), // body
  new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.6, 16).rotateX(-Math.PI / 2).translate(0, 0, -1.1),
    material(0xe0a040),
  ), // nose
  new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.5).translate(0, 0.35, 0.5), material(0xe06c75)), // fin
  new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.5).translate(0, 0, 0.2), material(0x8aa0b8)), // wings
);
ship.position.y = 1.2;
scene.add(ship);

const rad = THREE.MathUtils.degToRad;
const gui = new GUI({ title: 'Orientation' });

// --- With ANGLES (Euler): three turns, one after the other, around fixed axes ---
// Order 'YXZ': first yaw (around Y), then pitch (X), then roll (Z).
const angles = { yaw: 0, pitch: 0, roll: 0 };
const applyAngles = () =>
  ship.rotation.set(rad(angles.pitch), rad(angles.yaw), rad(angles.roll), 'YXZ');
const euler = gui.addFolder('With angles (degrees)');
euler.add(angles, 'yaw', -180, 180, 1).name('yaw (Y)').onChange(applyAngles);
euler.add(angles, 'pitch', -90, 90, 1).name('pitch (X)').onChange(applyAngles);
euler.add(angles, 'roll', -180, 180, 1).name('roll (Z)').onChange(applyAngles);

// --- With a QUATERNION: turn around the ship's OWN axes, from wherever it is ---
// Multiplying on the right = turning in the ship's frame (its "right", its "up").
const turnOwn = (axis: THREE.Vector3) => () =>
  ship.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, rad(15)));
const quaternion = gui.addFolder('With a quaternion (15° each time)');
quaternion.add({ f: turnOwn(new THREE.Vector3(1, 0, 0)) }, 'f').name('pitch (its X)');
quaternion.add({ f: turnOwn(new THREE.Vector3(0, 1, 0)) }, 'f').name('yaw (its Y)');
quaternion.add({ f: turnOwn(new THREE.Vector3(0, 0, 1)) }, 'f').name('roll (its Z)');
quaternion.add({ f: () => ship.quaternion.identity() }, 'f').name('back to the start');

// The quaternion's four numbers, live (their squares always add up to 1: it is a rotation).
const readout = { x: 0, y: 0, z: 0, w: 1 };
const numbers = gui.addFolder('The quaternion (x, y, z, w)');
for (const k of ['x', 'y', 'z', 'w'] as const) numbers.add(readout, k).listen().disable();

onFrame(() => {
  const q = ship.quaternion;
  readout.x = +q.x.toFixed(3);
  readout.y = +q.y.toFixed(3);
  readout.z = +q.z.toFixed(3);
  readout.w = +q.w.toFixed(3);
});

// Try: pitch at 90 and then move the yaw and the roll. Do they do the same?
