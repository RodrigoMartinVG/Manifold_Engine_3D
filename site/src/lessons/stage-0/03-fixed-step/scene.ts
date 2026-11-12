import * as THREE from 'three';

/**
 * The usual, in a module of its own: renderer, scene, camera, lights, floor and the loop. So
 * `main.ts` keeps only what matters in the lesson.
 */
export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15120f);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(4, 3, 6);
  camera.lookAt(0, 0.8, 0);
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 6, 2);
  scene.add(sun);
  scene.add(new THREE.GridHelper(10, 10, 0x3a4050, 0x262a33));

  const fit = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  fit();

  /** Calls `update` on every frame with the seconds since the previous one, and draws. */
  function onFrame(update: (dt: number) => void) {
    let before = performance.now();
    const frame = (now: number) => {
      update(Math.min(0.25, (now - before) / 1000));
      before = now;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  return { renderer, scene, camera, onFrame };
}
