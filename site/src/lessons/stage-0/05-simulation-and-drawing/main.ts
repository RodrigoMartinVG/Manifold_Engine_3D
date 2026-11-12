import { createScene } from './scene';
import { advance, createWorld, STEP, summary } from './simulation';
import { createView } from './view';

// 1. WITHOUT A SCREEN: two worlds with the same seed, 600 steps (10 s of game) each, right now.
const start = performance.now();
const a = createWorld(7, 25);
const b = createWorld(7, 25);
for (let i = 0; i < 600; i++) {
  advance(a);
  advance(b);
}
console.log(`two worlds, 600 steps each, in ${(performance.now() - start).toFixed(1)} ms`);
console.log(`summary A: ${summary(a)}`);
console.log(`summary B: ${summary(b)}  → ${summary(a) === summary(b) ? 'equal' : 'DIFFERENT'}`);

// 2. WITH A SCREEN: the same kind of world, now drawn. Real time is spent in fixed steps.
const { scene, onFrame } = createScene();
const world = createWorld(7, 25);
const view = createView(scene, world);
let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    advance(world);
    accumulator -= STEP;
  }
  view.draw();
});

// Try: change B's seed. And in simulation.ts, add `import * as THREE from 'three'`: it works, but
// it could no longer run without a screen (in the engine, that does not compile).
