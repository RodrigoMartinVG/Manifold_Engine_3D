import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createRandom } from './random';

const { scene, onFrame } = createScene();

const options = { seed: 42, useMathRandom: false, regenerate: () => generate() };
const cubes = new THREE.Group();
scene.add(cubes);

/** A "level" generated at random: 60 cubes with place, size, color and turn taken from randomness. */
function generate() {
  cubes.clear();
  const random = options.useMathRandom ? Math.random : createRandom(options.seed);
  console.log(
    `first numbers: ${[random(), random(), random()].map((x) => x.toFixed(4)).join(', ')}`,
  );
  for (let i = 0; i < 60; i++) {
    const side = 0.15 + random() * 0.45;
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(side, side, side),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(random(), 0.55, 0.55) }),
    );
    cube.position.set((random() - 0.5) * 8, side / 2 + random() * 2.5, (random() - 0.5) * 8);
    cube.rotation.set(random() * Math.PI, random() * Math.PI, 0);
    cubes.add(cube);
  }
}
generate();

const gui = new GUI({ title: 'Randomness' });
gui.add(options, 'seed', 0, 999, 1).onChange(generate);
gui.add(options, 'useMathRandom').name('use Math.random').onChange(generate);
gui.add(options, 'regenerate');

onFrame((dt) => {
  cubes.rotation.y += 0.1 * dt;
});

// Try: "regenerate" with a seed → always the same. With Math.random → a different one each time.
// Look at the console: the first numbers of seed 42 are always the same.
