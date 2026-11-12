import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * The usual, in a module of its own: renderer, scene, camera (dragging turns it around), lights,
 * floor and the loop. So `main.ts` keeps only what matters in the lesson.
 */
export function createScene(
  o: { camera?: [number, number, number]; target?: [number, number, number] } = {},
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15120f);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(...(o.camera ?? [7, 6, 10]));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...(o.target ?? [0, 1, 0]));
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 6, 2);
  scene.add(sun);
  scene.add(new THREE.GridHelper(20, 20, 0x3a4050, 0x262a33));

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
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  return { scene, camera, controls, onFrame };
}
