import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';

const { scene, onFrame } = createScene();

const G = 9.81; // m/s²
const RADIUS = 0.25;
const INITIAL_SPEED = 7; // m/s upward: in theory it rises to RADIUS + v²/2g ≈ 2.75 m

/** A ball that only goes up and down: its height and its velocity. It bounces without losing energy. */
interface Ball {
  y: number;
  vy: number;
  highest: number; // the highest point it reached
}
const fresh = (): Ball => ({ y: RADIUS, vy: INITIAL_SPEED, highest: RADIUS });

/** A physics step of `dt` seconds (semi-implicit Euler: first the velocity, then the position). */
function integrate(b: Ball, dt: number) {
  b.vy -= G * dt;
  b.y += b.vy * dt;
  b.highest = Math.max(b.highest, b.y);
  if (b.y < RADIUS) {
    b.y = RADIUS;
    b.vy = Math.abs(b.vy);
  }
}

const sphere = (color: number, x: number) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 24, 16),
    new THREE.MeshStandardMaterial({ color }),
  );
  m.position.x = x;
  scene.add(m);
  return m;
};
const redMesh = sphere(0xe06c75, -1);
const greenMesh = sphere(0x98c379, 1);

let red = fresh();
let green = fresh();
let greenBefore = green.y; // to interpolate
let accumulator = 0;
let screenTime = 0;

const options = {
  screen: 60, // frames per second that we SIMULATE (a slow screen)
  step: 60, // fixed steps per second of the green ball
  interpolate: true,
  restart: () => {
    red = fresh();
    green = fresh();
    greenBefore = green.y;
    accumulator = 0;
  },
};
const readout = { red: 0, green: 0 };
const gui = new GUI({ title: 'Fixed step' });
gui.add(options, 'screen', 5, 120, 1).name('screen (frames/s)');
gui.add(options, 'step', 5, 120, 1).name('green step (per s)');
gui.add(options, 'interpolate').name('interpolate the green');
gui.add(options, 'restart');
const heights = gui.addFolder('Highest point (m)');
heights.add(readout, 'red').name('red (the screen dt)').listen().disable();
heights.add(readout, 'green').name('green (fixed step)').listen().disable();

onFrame((dt) => {
  // A SLOW screen, on purpose: the world only advances when one of its frames "arrives".
  screenTime += dt;
  if (screenTime < 1 / options.screen) return;
  const screenDt = screenTime;
  screenTime = 0;

  // RED: one step the size of the frame. If the screen is slow, the steps are big, and the result
  // (how high it goes) depends on the screen.
  integrate(red, screenDt);

  // GREEN: the time piles up, and is spent in EQUAL steps. What is left over waits for later.
  const step = 1 / options.step;
  accumulator += screenDt;
  while (accumulator >= step) {
    greenBefore = green.y;
    integrate(green, step);
    accumulator -= step;
  }

  redMesh.position.y = red.y;
  // Interpolate: draw it BETWEEN the previous step and the current one, by how much of the next
  // one already went by.
  const alpha = accumulator / step;
  greenMesh.position.y = options.interpolate
    ? greenBefore + (green.y - greenBefore) * alpha
    : green.y;
  readout.red = +red.highest.toFixed(2);
  readout.green = +green.highest.toFixed(2);
});

// Try: screen at 10 → the red one rises differently (the physics changed). Green step at 10 with
// interpolation off → the green one moves in jumps; turn it on → smooth, and it rises the same.
